using System.Data;
using System.Text;
using System.Xml;
using BackOffice.Application.DTOs.Mian.License;
using BackOffice.Application.Extensions;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Application.Interfaces.Services.Security;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Domain.Encryption;
// Aliased to dodge the name collision between
// BackOffice.Domain.Entities.Tenant.Task (an actual entity in this codebase)
// and System.Threading.Tasks.Task. Only Store is needed here.
using TenantEntities = BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace BackOffice.Persistence.Services.Main
{
    /// <summary>
    /// Reads / writes the AES-encrypted EncData blob on each tenant DB. The
    /// flow is:
    ///
    ///   GET:  MainDb → look up tenant connection info → open TenantDBContext
    ///         → SP_GetEncData → pick the Type IS NULL row → decrypt → load
    ///         into a DataSet (schema from embedded EncDataDS.xsd) → map first
    ///         EncData row + every StoreData row into LicenseDto.
    ///
    ///   PUT:  Same lookup → fetch + decrypt existing XML so unknown / legacy
    ///         fields survive → overlay DTO values onto the DataSet → WriteXml
    ///         → encrypt → SP_SetEncData.
    ///
    /// Cross-tenant integrity: every operation uses the per-customer DBs only,
    /// never the main DB. SuperAdmin must be enforced at the controller; this
    /// service trusts its caller.
    /// </summary>
    public sealed class LicenseService : ILicenseService
    {
        private readonly MainDBContext _mainDb;
        private readonly ITenantDbContextFactory _tenantDbContextFactory;
        private readonly IPasswordCipher _passwordCipher;
        private readonly ILegacyEncCipher _legacyCipher;
        // Resolved lazily inside UpdateLicenseAsync so we don't introduce a
        // construction-time DI cycle with TenantSetupService (which in turn
        // depends on this service to read the encrypted blob). The service
        // provider hand-out is the standard escape hatch the framework
        // documents for exactly this scenario.
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<LicenseService> _logger;

        public LicenseService(
            MainDBContext mainDb,
            ITenantDbContextFactory tenantDbContextFactory,
            IPasswordCipher passwordCipher,
            ILegacyEncCipher legacyCipher,
            ILogger<LicenseService> logger,
            IServiceProvider serviceProvider)
        {
            _mainDb = mainDb;
            _tenantDbContextFactory = tenantDbContextFactory;
            _passwordCipher = passwordCipher;
            _legacyCipher = legacyCipher;
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        public async Task<LicenseDto?> GetLicenseAsync(int customerId, CancellationToken ct = default)
        {
            var customer = await _mainDb.Customers.AsNoTracking()
                .FirstOrDefaultAsync(c => c.CustomerId == customerId, ct)
                ?? throw new InvalidOperationException(
                    $"Customer {customerId} not found in main DB.");

            await using var dbContextBase = _tenantDbContextFactory.CreateForCustomer(
                customer.ServerName, customer.DBName, customer.DBUser,
                customer.ResolveDBPassword(_passwordCipher));
            var tenantDb = (TenantDBContext)dbContextBase;

            var rows = await tenantDb.Procedures.SP_GetEncDataAsync(cancellationToken: ct);

            // The global license row is the one with Type IS NULL (POS rows
            // use a different per-store cipher and aren't our concern here).
            var globalRow = rows.FirstOrDefault(r => r.Type == null);
            if (globalRow is null || string.IsNullOrWhiteSpace(globalRow.EncData))
            {
                _logger.LogInformation(
                    "Customer {CustomerId}: no global EncData row yet.", customerId);
                return null;
            }

            string xml;
            try
            {
                xml = _legacyCipher.Decrypt(globalRow.EncData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Customer {CustomerId}: EncData decrypt failed. Blob may be corrupt or " +
                    "encrypted with a different key.", customerId);
                throw;
            }

            var dto = ParseXmlToDto(xml);

            // Decorate each StoreData row with the friendly StoreName from
            // dbo.Store. The name isn't in the encrypted blob (the legacy
            // FrmStartWz reads it implicitly via GlobalDataAccess.StoreID),
            // but our SuperAdmin UI lists every store at once so it needs a
            // human-readable label. One round-trip query, keyed by StoreID.
            try
            {
                var ids = dto.Stores.Select(s => (Guid?)s.StoreID).ToList();
                var nameMap = await tenantDb.Set<TenantEntities.Store>()
                    .AsNoTracking()
                    .Where(s => ids.Contains(s.StoreID))
                    .Select(s => new { s.StoreID, s.StoreName })
                    .ToDictionaryAsync(s => s.StoreID, s => s.StoreName, ct);

                foreach (var s in dto.Stores)
                {
                    if (nameMap.TryGetValue(s.StoreID, out var name))
                        s.StoreName = name;
                }
            }
            catch (Exception ex)
            {
                // Don't fail the whole GET just because we couldn't resolve
                // names — the encrypted data is still useful. Modal falls
                // back to the address / shortId rendering.
                _logger.LogWarning(ex,
                    "Customer {CustomerId}: could not resolve store names from dbo.Store; " +
                    "returning blob without names.", customerId);
            }

            return dto;
        }

        public async Task UpdateLicenseAsync(int customerId, LicenseDto dto, CancellationToken ct = default)
        {
            if (dto is null) throw new ArgumentNullException(nameof(dto));

            var customer = await _mainDb.Customers.AsNoTracking()
                .FirstOrDefaultAsync(c => c.CustomerId == customerId, ct)
                ?? throw new InvalidOperationException(
                    $"Customer {customerId} not found in main DB.");

            await using var dbContextBase = _tenantDbContextFactory.CreateForCustomer(
                customer.ServerName, customer.DBName, customer.DBUser,
                customer.ResolveDBPassword(_passwordCipher));
            var tenantDb = (TenantDBContext)dbContextBase;

            // Load current XML so we keep any legacy/unknown fields the DTO
            // doesn't surface. If there's no row yet, start from an empty
            // dataset.
            var ds = EncDataDatasetFactory.CreateEmpty();
            var rows = await tenantDb.Procedures.SP_GetEncDataAsync(cancellationToken: ct);
            var globalRow = rows.FirstOrDefault(r => r.Type == null);
            if (globalRow is not null && !string.IsNullOrWhiteSpace(globalRow.EncData))
            {
                try
                {
                    var existingXml = _legacyCipher.Decrypt(globalRow.EncData);
                    using var sr = new StringReader(existingXml);
                    ds.ReadXml(sr, XmlReadMode.IgnoreSchema);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex,
                        "Customer {CustomerId}: could not parse existing EncData; " +
                        "overwriting from scratch.", customerId);
                    ds = EncDataDatasetFactory.CreateEmpty();
                }
            }

            ApplyDtoToDataset(ds, dto);

            // WriteXml without the inline schema — desktop SP_SetEncData
            // pipeline does the same. IgnoreSchema also avoids inflating the
            // ciphertext with a redundant schema dump every save.
            string newXml;
            using (var sw = new StringWriter())
            {
                ds.WriteXml(sw, XmlWriteMode.IgnoreSchema);
                newXml = sw.ToString();
            }

            var encrypted = _legacyCipher.Encrypt(newXml);
            await tenantDb.Procedures.SP_SetEncDataAsync(encrypted, cancellationToken: ct);

            // Drop the tenant-setup cache so the next GetSetupAsync re-reads
            // the updated blob instead of returning stale flags. Resolved
            // lazily to avoid the construction-time circular DI with
            // TenantSetupService — see ctor comment above. Best-effort only;
            // the cache also self-expires after 30 minutes if the resolve
            // ever fails (e.g. during early app startup).
            try
            {
                var tenantSetup = _serviceProvider.GetService<ITenantSetupService>();
                tenantSetup?.InvalidateCache(customerId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to invalidate tenant-setup cache for Customer {CustomerId}.", customerId);
            }

            _logger.LogInformation(
                "Customer {CustomerId}: license updated ({Bytes} bytes plaintext).",
                customerId, Encoding.UTF8.GetByteCount(newXml));
        }

        // ─── XML ↔ DTO mapping ────────────────────────────────────────────

        private static LicenseDto ParseXmlToDto(string xml)
        {
            var ds = EncDataDatasetFactory.CreateEmpty();
            using (var sr = new StringReader(xml))
            {
                ds.ReadXml(sr, XmlReadMode.IgnoreSchema);
            }

            var encDataTable = ds.Tables[EncDataDatasetFactory.EncDataTableName]
                ?? throw new InvalidDataException("Decrypted XML missing EncData table.");
            var storeTable = ds.Tables[EncDataDatasetFactory.StoreDataTableName];

            var dto = new LicenseDto();

            if (encDataTable.Rows.Count > 0)
            {
                var r = encDataTable.Rows[0];
                dto.CompanyName       = GetString(r, "CompanyName");
                dto.NewCompanyName    = GetString(r, "NewCompanyName");
                dto.ApplicationName   = GetString(r, "ApplicationName");
                // DataSoftUser / DataSoftPassword intentionally NOT read into
                // the DTO — see comment in LicenseDto for rationale. They
                // stay in the encrypted XML and round-trip untouched.
                dto.AppType           = GetNullable<short>(r, "AppType");
                dto.VersionType       = GetNullable<int>(r, "VersionType");
                dto.ExpDate           = GetNullable<DateTime>(r, "ExpDate");
                dto.BeginDate         = GetNullable<DateTime>(r, "BeginDate");
                dto.Days              = GetNullable<int>(r, "Days");
                dto.Expired           = GetNullable<bool>(r, "Expired");
                dto.ComputersNo       = GetNullable<int>(r, "ComputersNo");
                dto.BOCompNo          = GetNullable<int>(r, "BOCompNo");
                dto.StoresNo          = GetNullable<int>(r, "StoresNo");
                dto.PocketPCsNo       = GetNullable<int>(r, "PocketPCsNo");
                dto.StoreType         = GetNullable<int>(r, "StoreType");
                dto.Multiplelocation  = GetNullable<bool>(r, "Multiplelocation");
                dto.AccountPayable    = GetNullable<bool>(r, "AccountPayable");
                dto.ApproveCost       = GetNullable<bool>(r, "ApproveCost");
                dto.ReorderWizard     = GetNullable<bool>(r, "ReorderWizard");
                dto.RestockingWizard  = GetNullable<bool>(r, "RestockingWizard");
                dto.PurchaseOrder     = GetNullable<bool>(r, "PurchaseOrder");
                dto.SaleOrder         = GetNullable<bool>(r, "SaleOrder");
                dto.Resellers         = GetString(r, "Resellers");
                dto.Web               = GetNullable<bool>(r, "Web");
                dto.PhoneOrder        = GetNullable<bool>(r, "PhoneOrder");
                dto.Email             = GetNullable<bool>(r, "Email");
                dto.PocketPC          = GetNullable<bool>(r, "PocketPC");
                dto.DailyProfitReport = GetString(r, "DailyProfitReport");
                dto.Loyalty           = GetNullable<bool>(r, "Loyalty");
                dto.ScanReceiveOrder  = GetString(r, "ScanReceiveOrder");
            }

            if (storeTable is not null)
            {
                foreach (DataRow r in storeTable.Rows)
                {
                    var store = new StoreInfoDto
                    {
                        // StoreID is xs:string in the XML but System.Guid in
                        // the typed column; DataSet does the conversion.
                        StoreID      = GetNullable<Guid>(r, "StoreID") ?? Guid.Empty,
                        Address      = GetString(r, "Address"),
                        // XSD uses the literal column name "City,State,Zip"
                        // — DataSet keeps it un-escaped in ColumnName.
                        CityStateZip = GetString(r, "City,State,Zip"),
                        Country      = GetString(r, "Country"),
                        Phone1       = GetString(r, "Phone1"),
                        Phone2       = GetString(r, "Phone2"),
                        Fax          = GetString(r, "Fax"),
                    };

                    if (storeTable.Columns.Contains("Logo")
                        && r["Logo"] is byte[] logoBytes && logoBytes.Length > 0)
                    {
                        store.LogoBase64 = Convert.ToBase64String(logoBytes);
                    }

                    dto.Stores.Add(store);
                }
            }

            return dto;
        }

        private static void ApplyDtoToDataset(DataSet ds, LicenseDto dto)
        {
            var encDataTable = ds.Tables[EncDataDatasetFactory.EncDataTableName]
                ?? throw new InvalidDataException("Dataset missing EncData table.");

            var r = encDataTable.Rows.Count > 0
                ? encDataTable.Rows[0]
                : encDataTable.NewRow();

            SetOrClear(r, "CompanyName",       dto.CompanyName);
            SetOrClear(r, "NewCompanyName",    dto.NewCompanyName);
            SetOrClear(r, "ApplicationName",   dto.ApplicationName);
            // DataSoftUser / DataSoftPassword deliberately skipped — they're
            // not in the DTO (security). Because we loaded the existing XML
            // into this DataSet before overlaying, the existing values
            // round-trip on save with no change.
            SetOrClear(r, "AppType",           dto.AppType);
            SetOrClear(r, "VersionType",       dto.VersionType);
            SetOrClear(r, "ExpDate",           dto.ExpDate);
            SetOrClear(r, "BeginDate",         dto.BeginDate);
            SetOrClear(r, "Days",              dto.Days);
            SetOrClear(r, "Expired",           dto.Expired);
            SetOrClear(r, "ComputersNo",       dto.ComputersNo);
            SetOrClear(r, "BOCompNo",          dto.BOCompNo);
            SetOrClear(r, "StoresNo",          dto.StoresNo);
            SetOrClear(r, "PocketPCsNo",       dto.PocketPCsNo);
            SetOrClear(r, "StoreType",         dto.StoreType);
            SetOrClear(r, "Multiplelocation",  dto.Multiplelocation);
            SetOrClear(r, "AccountPayable",    dto.AccountPayable);
            SetOrClear(r, "ApproveCost",       dto.ApproveCost);
            SetOrClear(r, "ReorderWizard",     dto.ReorderWizard);
            SetOrClear(r, "RestockingWizard",  dto.RestockingWizard);
            SetOrClear(r, "PurchaseOrder",     dto.PurchaseOrder);
            SetOrClear(r, "SaleOrder",         dto.SaleOrder);
            SetOrClear(r, "Resellers",         dto.Resellers);
            SetOrClear(r, "Web",               dto.Web);
            SetOrClear(r, "PhoneOrder",        dto.PhoneOrder);
            SetOrClear(r, "Email",             dto.Email);
            SetOrClear(r, "PocketPC",          dto.PocketPC);
            SetOrClear(r, "DailyProfitReport", dto.DailyProfitReport);
            SetOrClear(r, "Loyalty",           dto.Loyalty);
            SetOrClear(r, "ScanReceiveOrder",  dto.ScanReceiveOrder);

            if (r.RowState == DataRowState.Detached)
            {
                encDataTable.Rows.Add(r);
            }

            // StoreData: full replace. We're authoritative on stores from the
            // DTO since the desktop also overwrites the full per-store record
            // when saving the wizard.
            var storeTable = ds.Tables[EncDataDatasetFactory.StoreDataTableName]
                ?? throw new InvalidDataException("Dataset missing StoreData table.");
            storeTable.Rows.Clear();
            foreach (var s in dto.Stores)
            {
                var sr = storeTable.NewRow();
                sr["StoreID"]        = s.StoreID;
                SetOrClear(sr, "Address",        s.Address);
                SetOrClear(sr, "City,State,Zip", s.CityStateZip);
                SetOrClear(sr, "Country",        s.Country);
                SetOrClear(sr, "Phone1",         s.Phone1);
                SetOrClear(sr, "Phone2",         s.Phone2);
                SetOrClear(sr, "Fax",            s.Fax);
                if (!string.IsNullOrEmpty(s.LogoBase64))
                {
                    try { sr["Logo"] = Convert.FromBase64String(s.LogoBase64); }
                    catch (FormatException)
                    {
                        // Caller sent a non-base64 string. Skip rather than
                        // corrupting the blob.
                    }
                }
                storeTable.Rows.Add(sr);
            }
        }

        // ─── DataRow helpers ──────────────────────────────────────────────

        private static string? GetString(DataRow r, string column)
            => r.Table.Columns.Contains(column) && r[column] is not DBNull && r[column] != null
                ? Convert.ToString(r[column])
                : null;

        private static T? GetNullable<T>(DataRow r, string column) where T : struct
        {
            if (!r.Table.Columns.Contains(column)) return null;
            var v = r[column];
            if (v is DBNull || v is null) return null;
            try { return (T)Convert.ChangeType(v, typeof(T))!; }
            catch { return null; }
        }

        private static void SetOrClear(DataRow r, string column, object? value)
        {
            if (!r.Table.Columns.Contains(column)) return;
            r[column] = value ?? (object)DBNull.Value;
        }
    }
}
