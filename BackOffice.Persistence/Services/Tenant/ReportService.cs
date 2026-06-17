using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Reports;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Linq;
using System.Globalization;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Tenant
{
    /// <summary>
    /// Service for report generation
    /// Based on VB.NET report logic from RepTaxCollected, etc.
    /// </summary>
    public class ReportService : IReportService
    {
        private readonly IUnitOfWorkTenant _unitOfWork;
        private readonly IMapper _mapper;
        private readonly TenantDBContext _dbContext;

        public ReportService(IUnitOfWorkTenant unitOfWork, IMapper mapper, TenantDBContext dbContext)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
            _dbContext = dbContext;
        }

        // ── Advanced "Filters" dialog → SP @CustomerFilter builder ───────────
        // Mirrors the desktop GetCustomerFilter / BuildINFilter (DBTransactions
        // Queries.vb): each selected list becomes ` AND <col> IN (...)` against
        // CustomerRepFilter. The SP wraps these after "Where (1=1)". GUID/int
        // values are format-safe; string (Zip) values are single-quote escaped.
        private static string BuildTaxCollectedCustomerFilter(TaxCollectedRequestDto r)
            => BuildCustomerRepFilterSql(r.FilterCustomerIds, r.CustomerTypes, r.CustomerGroupIds,
                                         r.PriceLevels, r.Zips, r.DiscountIds, r.Taxable);

        // Shared by every report whose SP supports the @CustomerFilter mechanism
        // (Tax Collected, Tax By Store, Summary). Each populated list becomes an
        // ` AND <col> IN (...)` condition against CustomerRepFilter.
        private static string BuildCustomerRepFilterSql(
            List<Guid>? customerIds, List<int>? customerTypes, List<Guid>? groupIds,
            List<int>? priceLevels, List<string>? zips, List<Guid>? discountIds, bool? taxable)
        {
            var sb = new StringBuilder();
            AppendGuidInFilter(sb, "CustomerID", customerIds);
            AppendIntInFilter(sb, "CustomerType", customerTypes);
            AppendGuidInFilter(sb, "CustomerGroupID", groupIds);
            AppendIntInFilter(sb, "PriceLevelID", priceLevels);
            AppendStringInFilter(sb, "Zip", zips);
            AppendGuidInFilter(sb, "DiscountID", discountIds);
            // Desktop maps the "Taxable" check straight onto the TaxExempt column
            // (BuildBooleanFilter(CustomerTaxable, "TaxExempt")); checked => =1.
            if (taxable == true)
                sb.Append(" AND TaxExempt=1");
            return sb.ToString();
        }

        // Total-Sales-style reports expose only @Filter (no #ItemSelect/#CustomerSelect
        // temp-table mechanism). Apply the Item/Supplier and Customer tabs as correlated
        // EXISTS subqueries appended to @Filter — itemAlias/txnAlias are the report query's
        // TransactionEntry / Transaction aliases. Returns "" when nothing is selected.
        private static string BuildItemsRepFilterExists(
            string entryAlias,
            List<Guid>? itemIds, List<Guid>? departmentIds, List<Guid>? manufacturerIds,
            List<int>? itemTypes, List<string>? itemGroupIds, List<Guid>? supplierIds,
            bool? isDiscount, bool? isTaxable, bool? isFoodStampable, bool? isWic)
        {
            var c = new StringBuilder();
            AppendGuidInFilter(c, "irf.ItemNo", itemIds);
            AppendGuidInFilter(c, "irf.DepartmentID", departmentIds);
            AppendGuidInFilter(c, "irf.ManufacturerID", manufacturerIds);
            AppendIntInFilter(c, "irf.ItemType", itemTypes);
            // ItemGroupID is an int column; ignore any non-numeric group ids defensively.
            var groupInts = itemGroupIds?.Where(s => int.TryParse(s, out _)).Select(int.Parse).ToList();
            AppendIntInFilter(c, "irf.ItemGroupID", groupInts);
            AppendGuidInFilter(c, "irf.SupplierNo", supplierIds);
            if (isDiscount == true) c.Append(" AND irf.IsDiscount=1");
            if (isTaxable == true) c.Append(" AND irf.IsTaxable=1");
            if (isFoodStampable == true) c.Append(" AND irf.IsFoodStampable=1");
            if (isWic == true) c.Append(" AND irf.IsWIC=1");
            if (c.Length == 0) return string.Empty;
            return $" AND EXISTS (SELECT 1 FROM ItemsRepFilter irf WHERE irf.ItemStoreID = {entryAlias}.ItemStoreID{c})";
        }

        private static string BuildCustomerRepFilterExists(
            string txnAlias,
            List<Guid>? customerIds, List<int>? customerTypes, List<Guid>? groupIds,
            List<int>? priceLevels, List<string>? zips, List<Guid>? discountIds, bool? taxable)
        {
            var c = new StringBuilder();
            AppendGuidInFilter(c, "crf.CustomerID", customerIds);
            AppendIntInFilter(c, "crf.CustomerType", customerTypes);
            AppendGuidInFilter(c, "crf.CustomerGroupID", groupIds);
            AppendIntInFilter(c, "crf.PriceLevelID", priceLevels);
            AppendStringInFilter(c, "crf.Zip", zips);
            AppendGuidInFilter(c, "crf.DiscountID", discountIds);
            if (taxable == true) c.Append(" AND crf.TaxExempt=1");
            if (c.Length == 0) return string.Empty;
            return $" AND EXISTS (SELECT 1 FROM CustomerRepFilter crf WHERE crf.CustomerID = {txnAlias}.CustomerID{c})";
        }

        private static void AppendGuidInFilter(StringBuilder sb, string column, List<Guid>? ids)
        {
            if (ids == null || ids.Count == 0) return;
            sb.Append($" AND {column} IN (")
              .Append(string.Join(",", ids.Select(id => $"'{id}'")))
              .Append(')');
        }

        private static void AppendIntInFilter(StringBuilder sb, string column, List<int>? values)
        {
            if (values == null || values.Count == 0) return;
            sb.Append($" AND {column} IN (")
              .Append(string.Join(",", values))
              .Append(')');
        }

        private static void AppendStringInFilter(StringBuilder sb, string column, List<string>? values)
        {
            if (values == null || values.Count == 0) return;
            var safe = values
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Select(v => "'" + v.Trim().Replace("'", "''") + "'")
                .ToList();
            if (safe.Count == 0) return;
            sb.Append($" AND {column} IN (")
              .Append(string.Join(",", safe))
              .Append(')');
        }

        /// <summary>
        /// Gets Tax Collected report data using Web_SP_GetTaxCollected with server-side pagination.
        /// Date/store filters are pushed into @Filter SQL; grand totals (TotalTaxSum, TotalSale) come
        /// from SUM() OVER() window aggregates on the SP. AG-Grid column FilterModel / SortColumn are
        /// intentionally ignored — the SP paginates with a fixed [Date] DESC sort.
        /// </summary>
        public ApiResponse<TaxCollectedResponseDto> GetTaxCollectedReport(TaxCollectedRequestDto request)
        {
            try
            {
                request ??= new TaxCollectedRequestDto();

                var filterParts = new List<string>();
                if (request.FromDate.HasValue)
                    filterParts.Add($"AND EndSaleTime >= '{request.FromDate.Value:yyyy-MM-dd}'");
                if (request.ToDate.HasValue)
                    filterParts.Add($"AND EndSaleTime < '{request.ToDate.Value.Date.AddDays(1):yyyy-MM-dd}'");
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    filterParts.Add($"AND StoreID = '{request.StoreId.Value}'");

                var filterString = string.Join(" ", filterParts);
                // Customer-tab Filters dialog selections → @CustomerFilter (the SP
                // turns these into a #CustomerSelect of matching CustomerIDs and
                // keeps only transactions for those customers). Empty when nothing
                // is selected, so the SP skips the customer join entirely.
                var customerFilter = BuildTaxCollectedCustomerFilter(request);

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var data = new List<TaxCollectedDto>();
                int totalRecords = 0;
                decimal totalTaxSum = 0m;
                decimal totalSale = 0m;

                var previousTimeout = _dbContext.Database.GetCommandTimeout();
                _dbContext.Database.SetCommandTimeout(120);
                try
                {
                    var conn = _dbContext.Database.GetDbConnection();
                    if (conn.State != ConnectionState.Open)
                        conn.Open();

                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = "[dbo].[Web_SP_GetTaxCollected]";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.CommandTimeout = 120;

                    var pFilter = cmd.CreateParameter();
                    pFilter.ParameterName = "Filter";
                    pFilter.Value = (object?)filterString ?? DBNull.Value;
                    pFilter.DbType = DbType.String;
                    cmd.Parameters.Add(pFilter);

                    var pCustomerFilter = cmd.CreateParameter();
                    pCustomerFilter.ParameterName = "CustomerFilter";
                    pCustomerFilter.Value = customerFilter;
                    pCustomerFilter.DbType = DbType.String;
                    cmd.Parameters.Add(pCustomerFilter);

                    var pPageNumber = cmd.CreateParameter();
                    pPageNumber.ParameterName = "PageNumber";
                    pPageNumber.Value = pageNumber;
                    pPageNumber.DbType = DbType.Int32;
                    cmd.Parameters.Add(pPageNumber);

                    var pPageSize = cmd.CreateParameter();
                    pPageSize.ParameterName = "PageSize";
                    pPageSize.Value = pageSize;
                    pPageSize.DbType = DbType.Int32;
                    cmd.Parameters.Add(pPageSize);

                    using var reader = ((DbCommand)cmd).ExecuteReader();

                    int Ord(string name)
                    {
                        for (var i = 0; i < reader.FieldCount; i++)
                            if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                                return i;
                        return -1;
                    }

                    var oTransNo  = Ord("TransactionNo");
                    var oTransId  = Ord("TransactionID");
                    var oStoreId  = Ord("StoreID");
                    var oDate     = Ord("Date");
                    var oTaxRate  = Ord("TaxRate");
                    var oTaxSum   = Ord("TaxSum");
                    var oCustNo   = Ord("CustomerNo");
                    var oCustName = Ord("CustomerName");
                    var oTotalSal = Ord("TotalSale");
                    var oPayment  = Ord("Payment");
                    var oTaxName  = Ord("TaxName");
                    var oTotal    = Ord("TotalRecords");
                    var oGtTax    = Ord("GrandTotalTaxSum");
                    var oGtSale   = Ord("GrandTotalSale");

                    decimal Dec(int i) => i >= 0 && !reader.IsDBNull(i) ? Convert.ToDecimal(reader.GetValue(i)) : 0m;
                    string  Str(int i) => i >= 0 && !reader.IsDBNull(i) ? reader.GetValue(i)?.ToString() ?? string.Empty : string.Empty;

                    while (reader.Read())
                    {
                        data.Add(new TaxCollectedDto
                        {
                            TransactionNo = Str(oTransNo),
                            TransactionID = oTransId >= 0 && !reader.IsDBNull(oTransId) ? reader.GetGuid(oTransId) : Guid.Empty,
                            StoreID       = oStoreId >= 0 && !reader.IsDBNull(oStoreId) ? reader.GetGuid(oStoreId) : Guid.Empty,
                            StoreName     = string.Empty, // filled below from StoreViews
                            Date          = oDate >= 0 && !reader.IsDBNull(oDate) ? reader.GetDateTime(oDate) : DateTime.MinValue,
                            TaxRate       = Dec(oTaxRate) * 100m,
                            TaxSum        = Dec(oTaxSum),
                            CustomerNo    = Str(oCustNo),
                            CustomerName  = Str(oCustName),
                            TotalSale     = Dec(oTotalSal),
                            Payment       = Str(oPayment),
                            TaxName       = Str(oTaxName)
                        });

                        if (totalRecords == 0 && oTotal >= 0 && !reader.IsDBNull(oTotal))
                            totalRecords = Convert.ToInt32(reader.GetValue(oTotal));
                        if (totalTaxSum == 0m && oGtTax >= 0 && !reader.IsDBNull(oGtTax))
                            totalTaxSum = Convert.ToDecimal(reader.GetValue(oGtTax));
                        if (totalSale == 0m && oGtSale >= 0 && !reader.IsDBNull(oGtSale))
                            totalSale = Convert.ToDecimal(reader.GetValue(oGtSale));
                    }
                }
                finally
                {
                    _dbContext.Database.SetCommandTimeout(previousTimeout);
                }

                if (data.Count > 0)
                {
                    var storeIds = data.Where(r => r.StoreID != Guid.Empty).Select(r => r.StoreID).Distinct().ToList();
                    // Project to ONLY StoreID/StoreName before materializing. Using
                    // ToDictionary on the entity directly makes EF SELECT every mapped
                    // column (incl. StoreInt), which throws "Invalid column name
                    // 'StoreInt'" on tenants whose StoreView lacks that column.
                    var storeNames = _dbContext.StoreViews
                        .Where(s => storeIds.Contains(s.StoreID))
                        .Select(s => new { s.StoreID, s.StoreName })
                        .ToDictionary(s => s.StoreID, s => s.StoreName ?? string.Empty);
                    foreach (var row in data)
                        if (storeNames.TryGetValue(row.StoreID, out var name))
                            row.StoreName = name;
                }

                var response = new TaxCollectedResponseDto
                {
                    Data = data,
                    TotalRecords = totalRecords,
                    TotalTaxSum = totalTaxSum,
                    TotalSale = totalSale
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TaxCollectedResponseDto>($"Failed to generate Tax Collected report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Tax By Store report - same pattern as Tax Collected: pagination, sort, in-memory filter, then return Data/TotalRecords/TotalTaxSum/TotalSale
        /// </summary>
        public async Task<ApiResponse<TaxByStoreResponseDto>> GetTaxByStoreReportAsync(TaxByStoreRequestDto request)
        {
            try
            {
                request ??= new TaxByStoreRequestDto();

                var startDate = request.FromDate ?? DateTime.Today.AddYears(-1);
                var endDate   = request.ToDate ?? DateTime.Today.AddDays(1);
                if (endDate.Date == endDate && endDate.TimeOfDay == TimeSpan.Zero)
                    endDate = endDate.AddDays(1);
                var storeId = request.StoreId == Guid.Empty ? (Guid?)null : request.StoreId;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var data = new List<TaxByStoreDto>();
                int totalRecords = 0;
                decimal totalSale = 0m, totalTaxable = 0m, totalExempt = 0m, totalNonTax = 0m, totalTaxSum = 0m;

                var previousTimeout = _dbContext.Database.GetCommandTimeout();
                _dbContext.Database.SetCommandTimeout(120);
                try
                {
                    var conn = _dbContext.Database.GetDbConnection();
                    if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = "[dbo].[Web_SP_GetTaxReprtByStore]";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.CommandTimeout = 120;

                    AddParam(cmd, "StartDate", startDate, DbType.DateTime);
                    AddParam(cmd, "EndDate",   endDate,   DbType.DateTime);
                    AddParam(cmd, "StoreID",   (object?)storeId ?? DBNull.Value, DbType.Guid);
                    // Customer-tab Filters dialog selections → @CustomerFilter (SP builds
                    // a #CustomerSelect and constrains the report to those customers).
                    AddParam(cmd, "CustomerFilter", BuildCustomerRepFilterSql(
                        request.FilterCustomerIds, request.CustomerTypes, request.CustomerGroupIds,
                        request.PriceLevels, request.Zips, request.DiscountIds, request.Taxable), DbType.String);
                    AddParam(cmd, "PageNumber", pageNumber, DbType.Int32);
                    AddParam(cmd, "PageSize",   pageSize,   DbType.Int32);

                    using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();

                    int Ord(string n) { for (var i = 0; i < reader.FieldCount; i++) if (string.Equals(reader.GetName(i), n, StringComparison.OrdinalIgnoreCase)) return i; return -1; }

                    var oStore = Ord("StoreName");
                    var oRate  = Ord("TaxRate");
                    var oTotal = Ord("TotalSales");
                    var oTaxbl = Ord("TaxableSales");
                    var oExmpt = Ord("TotalExempt");
                    var oNonTx = Ord("NonTaxableSales");
                    var oTax   = Ord("Tax");
                    var oTRec  = Ord("TotalRecords");
                    var oGTSal = Ord("GrandTotalSale");
                    var oGTTax = Ord("GrandTotalTaxableSales");
                    var oGTExm = Ord("GrandTotalExempt");
                    var oGTNon = Ord("GrandTotalNonTaxableSales");
                    var oGTTSm = Ord("GrandTotalTaxSum");

                    while (await reader.ReadAsync())
                    {
                        data.Add(new TaxByStoreDto
                        {
                            StoreName       = ReadStr(reader, oStore),
                            // SP returns TaxRate as raw percentage value (e.g. 3.2 = 3.2%).
                            // Frontend just appends "%" (no multiplication) so pass through unchanged.
                            // Matches desktop Tax Report display: "3.2000".
                            TaxRate         = ReadDec(reader, oRate),
                            TotalSales      = ReadDec(reader, oTotal),
                            TaxableSales    = ReadDec(reader, oTaxbl),
                            TotalExempt     = ReadDec(reader, oExmpt),
                            NonTaxableSales = ReadDec(reader, oNonTx),
                            Tax             = ReadDec(reader, oTax)
                        });
                        if (totalRecords == 0) totalRecords = ReadInt(reader, oTRec);
                        if (totalSale == 0m)   totalSale    = ReadDec(reader, oGTSal);
                        if (totalTaxable == 0m) totalTaxable = ReadDec(reader, oGTTax);
                        if (totalExempt == 0m)  totalExempt  = ReadDec(reader, oGTExm);
                        if (totalNonTax == 0m)  totalNonTax  = ReadDec(reader, oGTNon);
                        if (totalTaxSum == 0m)  totalTaxSum  = ReadDec(reader, oGTTSm);
                    }
                }
                finally { _dbContext.Database.SetCommandTimeout(previousTimeout); }

                var response = new TaxByStoreResponseDto
                {
                    Data = data,
                    TotalRecords = totalRecords,
                    TotalTaxSum = totalTaxSum,
                    TotalSale = totalSale,
                    TotalTaxableSales = totalTaxable,
                    TotalExempt = totalExempt,
                    TotalNonTaxableSales = totalNonTax
                };
                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TaxByStoreResponseDto>($"Failed to generate Tax By Store report: {ex.Message}");
            }
        }

        // ------------------------------ small private helpers for Web_ SP calls ------------------------------
        private static void AddParam(System.Data.Common.DbCommand cmd, string name, object value, DbType type)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = value ?? DBNull.Value;
            p.DbType = type;
            cmd.Parameters.Add(p);
        }
        private static int    ReadInt(System.Data.Common.DbDataReader r, int o) => o >= 0 && !r.IsDBNull(o) ? Convert.ToInt32(r.GetValue(o))   : 0;
        private static decimal ReadDec(System.Data.Common.DbDataReader r, int o) => o >= 0 && !r.IsDBNull(o) ? Convert.ToDecimal(r.GetValue(o)) : 0m;
        private static string  ReadStr(System.Data.Common.DbDataReader r, int o) => o >= 0 && !r.IsDBNull(o) ? (r.GetValue(o)?.ToString() ?? "") : "";
        private static DateTime? ReadDate(System.Data.Common.DbDataReader r, int o) => o >= 0 && !r.IsDBNull(o) ? r.GetDateTime(o) : (DateTime?)null;
        private static Guid    ReadGuid(System.Data.Common.DbDataReader r, int o) => o >= 0 && !r.IsDBNull(o) ? r.GetGuid(o) : Guid.Empty;
        private static int OrdOf(System.Data.Common.DbDataReader r, string n) { for (var i = 0; i < r.FieldCount; i++) if (string.Equals(r.GetName(i), n, StringComparison.OrdinalIgnoreCase)) return i; return -1; }

        // ------------------------------------------------------------------------------------
        // Tender Totals — allowlist of "standard" back-office tender types. The SP can return
        // many synthetic tenders (Pay Out, Apply To Account, Retail Points, 10 Percent, Self
        // Points, etc.) that the desktop's Tender Totals report does NOT show — only the
        // canonical money-movement tenders below. Anything not in this set is dropped from
        // both the column list and the per-row pivot amounts.
        // ------------------------------------------------------------------------------------
        private static readonly HashSet<string> StandardTenderTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "CASH",
            "CHECK",
            "CREDIT CARD",
            "CC OFFLINE",
            "DEBIT",
            "EBT",
            "WIC",
            "GIFT CARD",
            "CREDIT SLIP",
            "GIFT",
        };

        /// <summary>
        /// True when a tender column belongs in the canonical "back office" tender list.
        /// Accepts both the plain tender name ("CASH", "DEBIT") and the
        /// "TenderType / CreditType" form ("CREDIT CARD / Visa", "GIFT / GIFT CARD").
        /// </summary>
        private static bool IsStandardTenderColumn(string? columnName)
        {
            if (string.IsNullOrWhiteSpace(columnName)) return false;
            var name = columnName.Trim();
            var slashIdx = name.IndexOf('/');
            var head = slashIdx >= 0 ? name.Substring(0, slashIdx).Trim() : name;
            return StandardTenderTypes.Contains(head);
        }

        /// <summary>
        /// True when the raw (TenderType, CreditType) pair from SP_GetTendersCashier is a
        /// "standard" back-office tender. Used to filter detail rows before they reach the
        /// pivot so synthetic tenders (Pay Out, Apply To Account, etc.) never contribute to
        /// per-row totals or Grand Total.
        /// </summary>
        private static bool IsStandardTenderDetail(string? tenderType, string? creditType)
        {
            var tt = (tenderType ?? string.Empty).Trim();
            if (StandardTenderTypes.Contains(tt)) return true;
            // Older rows where the meaningful tender lives in CreditType (rare): also accept those.
            var ct = (creditType ?? string.Empty).Trim();
            return !string.IsNullOrEmpty(ct) && StandardTenderTypes.Contains(ct);
        }

        /// <summary>Reads all rows from Web_Rpt_AcountReceivable (callers handle their own aggregation/pagination).</summary>
        private async Task<List<Rpt_AcountReceivableResult>> ReadAccountReceivableViaWebSpAsync(DateTime fromDate, DateTime toDate, Guid? storeId)
        {
            var results = new List<Rpt_AcountReceivableResult>();
            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "[dbo].[Web_Rpt_AcountReceivable]";
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandTimeout = 120;
            AddParam((DbCommand)cmd, "FromDate", fromDate, DbType.DateTime);
            AddParam((DbCommand)cmd, "ToDate",   toDate,   DbType.DateTime);
            AddParam((DbCommand)cmd, "StoreID",  (object?)storeId ?? DBNull.Value, DbType.Guid);
            AddParam((DbCommand)cmd, "PageNumber", 1, DbType.Int32);
            AddParam((DbCommand)cmd, "PageSize",   int.MaxValue, DbType.Int32);

            using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
            var oName = OrdOf(reader, "Name");
            var oBalDoe = OrdOf(reader, "BalanceDoe");
            var oFirstName = OrdOf(reader, "FirstName");
            var oCustomerId = OrdOf(reader, "CustomerID");
            var oCustomerNo = OrdOf(reader, "CustomerNo");
            var oLastName = OrdOf(reader, "LastName");
            var oAddress = OrdOf(reader, "Address");
            var oPhone = OrdOf(reader, "Phone");
            var oTransNo = OrdOf(reader, "TransactionNo");
            var oSale = OrdOf(reader, "Sale");
            var oAmtPay = OrdOf(reader, "AmountPayments");
            var oActionId = OrdOf(reader, "ActionID");
            var oBatchId = OrdOf(reader, "BatchID");
            var oUserName = OrdOf(reader, "UserName");
            var oAmtSales = OrdOf(reader, "AmountSales");
            var oSaleTime = OrdOf(reader, "SaleTime");

            while (await reader.ReadAsync())
            {
                results.Add(new Rpt_AcountReceivableResult
                {
                    Name             = ReadStr(reader, oName),
                    BalanceDoe       = oBalDoe >= 0 && !reader.IsDBNull(oBalDoe) ? Convert.ToDecimal(reader.GetValue(oBalDoe)) : (decimal?)null,
                    FirstName        = ReadStr(reader, oFirstName),
                    CustomerID       = oCustomerId >= 0 && !reader.IsDBNull(oCustomerId) ? reader.GetGuid(oCustomerId) : (Guid?)null,
                    CustomerNo       = ReadStr(reader, oCustomerNo),
                    LastName         = ReadStr(reader, oLastName),
                    Address          = ReadStr(reader, oAddress),
                    Phone            = ReadStr(reader, oPhone),
                    TransactionNo    = ReadStr(reader, oTransNo),
                    Sale             = oSale >= 0 && !reader.IsDBNull(oSale) ? Convert.ToDecimal(reader.GetValue(oSale)) : (decimal?)null,
                    AmountPayments   = oAmtPay >= 0 && !reader.IsDBNull(oAmtPay) ? Convert.ToDecimal(reader.GetValue(oAmtPay)) : (decimal?)null,
                    ActionID         = ReadGuid(reader, oActionId),
                    BatchID          = oBatchId >= 0 && !reader.IsDBNull(oBatchId) ? reader.GetGuid(oBatchId) : (Guid?)null,
                    UserName         = ReadStr(reader, oUserName),
                    AmountSales      = oAmtSales >= 0 && !reader.IsDBNull(oAmtSales) ? Convert.ToDecimal(reader.GetValue(oAmtSales)) : (decimal?)null,
                    SaleTime         = ReadDate(reader, oSaleTime)
                });
            }
            return results;
        }

        /// <summary>
        /// One per-transaction row returned by [dbo].[SP_GetTransactionLivesView] —
        /// i.e. one row of dbo.TransactionLivesView + a computed `Total` column. This is
        /// the SAME data shape the desktop's `FrmLiveReport` consumes when the user
        /// double-clicks a row in `RepAcountReceivableSales` (the "Account Receivable
        /// Sales/Payments For NAME" detail screen).
        /// </summary>
        private sealed class TransactionLivesViewRow
        {
            public string Type { get; set; } = string.Empty;          // "Sale" / "Open Balance" / "Add Charge" / "Return Items"
            public DateTime? DateT { get; set; }
            public string Num { get; set; } = string.Empty;           // TransactionNo
            public Guid? IDc { get; set; }                            // TransactionID
            public Guid? PID { get; set; }                            // CustomerID
            public string Name { get; set; } = string.Empty;          // Customer display name
            public string CustomerNo { get; set; } = string.Empty;
            public decimal Debit { get; set; }
            public decimal Credit { get; set; }
            public decimal Amount { get; set; }                       // Debit - Credit (signed)
            public decimal Total { get; set; }                        // ABS(Debit - Credit) — added by the SP
            public short Status { get; set; }
            public byte TransactionType { get; set; }
            public Guid? StoreID { get; set; }
            public string StoreName { get; set; } = string.Empty;
            public string UserName { get; set; } = string.Empty;
        }

        /// <summary>
        /// Calls [dbo].[SP_GetTransactionLivesView] with the same kind of @Filter the desktop
        /// builds in `RepAcountReceivableSales.GcCustomers_DoubleClick` →
        /// `TransQ.FillTransactionForLiveReport`. The SP appends @Filter to a dynamic SELECT
        /// against `TransactionLivesView`, so the predicate string must start with " and "
        /// and follow the desktop's exact predicates so we get row-for-row parity.
        ///
        /// Desktop filter (verbatim, from RepAcountReceivableSales.vb lines 160-167):
        ///   Payments:  " and DateT&gt;='MM/dd/yy hh:mm:ss' and DateT&lt;='MM/dd/yy hh:mm:ss' And Credit>Debit And PID='customerId' And Status>0 And TransactionType<>2"
        ///   Sales:     " and DateT&gt;='MM/dd/yy hh:mm:ss' and DateT&lt;='MM/dd/yy hh:mm:ss' And Debit>Credit And PID='customerId' And Status>0 And TransactionType<>2"
        ///
        /// The CustomerID is interpolated as a single-quoted string. The desktop does the same;
        /// it's safe here because customerId is a typed Guid (the caller already validated it).
        /// </summary>
        private async Task<List<TransactionLivesViewRow>> ReadTransactionLivesViewAsync(string filter)
        {
            var results = new List<TransactionLivesViewRow>();
            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "[dbo].[SP_GetTransactionLivesView]";
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandTimeout = 120;
            AddStringParam((DbCommand)cmd, "Filter", filter ?? string.Empty);

            using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
            var oType        = OrdOf(reader, "Type");
            var oDateT       = OrdOf(reader, "DateT");
            var oNum         = OrdOf(reader, "Num");
            var oIdc         = OrdOf(reader, "IDc");
            var oPid         = OrdOf(reader, "PID");
            var oName        = OrdOf(reader, "Name");
            var oCustNo      = OrdOf(reader, "CustomerNo");
            var oDebit       = OrdOf(reader, "Debit");
            var oCredit      = OrdOf(reader, "Credit");
            var oAmount      = OrdOf(reader, "Amount");
            var oTotal       = OrdOf(reader, "Total");
            var oStatus      = OrdOf(reader, "Status");
            var oTxnType     = OrdOf(reader, "TransactionType");
            var oStoreId     = OrdOf(reader, "StoreID");
            var oStoreName   = OrdOf(reader, "StoreName");
            var oUserName    = OrdOf(reader, "UserName");

            while (await reader.ReadAsync())
            {
                results.Add(new TransactionLivesViewRow
                {
                    Type             = ReadStr(reader, oType),
                    DateT            = ReadDate(reader, oDateT),
                    Num              = ReadStr(reader, oNum),
                    IDc              = oIdc      >= 0 && !reader.IsDBNull(oIdc)      ? reader.GetGuid(oIdc)   : (Guid?)null,
                    PID              = oPid      >= 0 && !reader.IsDBNull(oPid)      ? reader.GetGuid(oPid)   : (Guid?)null,
                    Name             = ReadStr(reader, oName),
                    CustomerNo       = ReadStr(reader, oCustNo),
                    Debit            = ReadDec(reader, oDebit),
                    Credit           = ReadDec(reader, oCredit),
                    Amount           = ReadDec(reader, oAmount),
                    Total            = ReadDec(reader, oTotal),
                    Status           = (short)ReadInt(reader, oStatus),
                    TransactionType  = (byte)ReadInt(reader, oTxnType),
                    StoreID          = oStoreId  >= 0 && !reader.IsDBNull(oStoreId)  ? reader.GetGuid(oStoreId) : (Guid?)null,
                    StoreName        = ReadStr(reader, oStoreName),
                    UserName         = ReadStr(reader, oUserName),
                });
            }
            return results;
        }

        /// <summary>
        /// One per-customer aggregate row returned by [dbo].[Rpt_AcountReceivableTotals].
        /// Mirrors the SP's projection so the On Account Sales / Payments parent grids match
        /// the desktop's RepAcountReceivableSales view 1:1 (the desktop calls this SP for the
        /// summary view via TransQ.FillRepAcountReceivableTotals).
        /// </summary>
        private sealed class AcountReceivableTotalsRow
        {
            public Guid? CustomerID { get; set; }
            public string CustomerNo { get; set; } = string.Empty;
            public string LastName { get; set; } = string.Empty;
            public string FirstName { get; set; } = string.Empty;
            public string Address { get; set; } = string.Empty;
            public string Phone { get; set; } = string.Empty;
            public decimal BalanceDoe { get; set; }
            /// <summary>[Transaction].StoreID — the store where the payment/charge occurred.</summary>
            public Guid? StoreId { get; set; }
            /// <summary>Store.StoreName for the transaction store.</summary>
            public string StoreName { get; set; } = string.Empty;
            /// <summary>
            /// Sum(Debit - Credit) where Debit > Credit and TransactionType not in (2,4),
            /// scoped by date/store/Status>0. Identical to the desktop SP's correlated subquery.
            /// </summary>
            public decimal AmountSales { get; set; }
            /// <summary>
            /// Sum(Credit - Debit) where Credit > Debit and TransactionType not in (2,4),
            /// scoped by date/store/Status>0. Identical to the desktop SP's correlated subquery.
            /// </summary>
            public decimal AmountPayments { get; set; }
        }

        /// <summary>
        /// Calls [dbo].[Web_Rpt_AcountReceivableTotals] and projects the aggregate rows for the
        /// On Account Sales / Payments parent grids. Rows are aggregated per customer PER
        /// TRANSACTION STORE ([Transaction].StoreID), so StoreId/StoreName reflect the store where
        /// the payment/charge actually occurred — NOT the customer's home store. This makes the
        /// Store filter scope correctly (selecting a store shows only that store's rows). The web
        /// drill-down continues to use Web_Rpt_AcountReceivable for per-transaction detail.
        /// </summary>
        private async Task<List<AcountReceivableTotalsRow>> ReadAccountReceivableTotalsAsync(DateTime fromDate, DateTime toDate, Guid? storeId)
        {
            var results = new List<AcountReceivableTotalsRow>();
            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using var cmd = conn.CreateCommand();
            cmd.CommandText = "[dbo].[Web_Rpt_AcountReceivableTotals]";
            cmd.CommandType = CommandType.StoredProcedure;
            cmd.CommandTimeout = 180; // Aggregation over Actions/Transaction; allow headroom on large datasets.
            AddParam((DbCommand)cmd, "FromDate", fromDate, DbType.DateTime);
            AddParam((DbCommand)cmd, "ToDate", toDate, DbType.DateTime);
            AddParam((DbCommand)cmd, "StoreID", (object?)storeId ?? DBNull.Value, DbType.Guid);

            using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
            // Aggregated columns (StoreID/StoreName are the TRANSACTION store). Mapped by name so
            // column-order changes in the SP don't break us.
            var oCustomerId   = OrdOf(reader, "CustomerID");
            var oCustomerNo   = OrdOf(reader, "CustomerNo");
            var oLastName     = OrdOf(reader, "LastName");
            var oFirstName    = OrdOf(reader, "FirstName");
            var oAddress      = OrdOf(reader, "Address");
            var oPhone        = OrdOf(reader, "Phone");
            var oBalanceDoe   = OrdOf(reader, "BalanceDoe");
            var oStoreId      = OrdOf(reader, "StoreID");
            var oStoreName    = OrdOf(reader, "StoreName");
            var oAmtSales     = OrdOf(reader, "AmountSales");
            var oAmtPayments  = OrdOf(reader, "AmountPayments");

            while (await reader.ReadAsync())
            {
                results.Add(new AcountReceivableTotalsRow
                {
                    CustomerID     = oCustomerId   >= 0 && !reader.IsDBNull(oCustomerId)   ? reader.GetGuid(oCustomerId) : (Guid?)null,
                    CustomerNo     = ReadStr(reader, oCustomerNo),
                    LastName       = ReadStr(reader, oLastName),
                    FirstName      = ReadStr(reader, oFirstName),
                    Address        = ReadStr(reader, oAddress),
                    Phone          = ReadStr(reader, oPhone),
                    BalanceDoe     = ReadDec(reader, oBalanceDoe),
                    StoreId        = oStoreId      >= 0 && !reader.IsDBNull(oStoreId)      ? reader.GetGuid(oStoreId) : (Guid?)null,
                    StoreName      = ReadStr(reader, oStoreName),
                    AmountSales    = ReadDec(reader, oAmtSales),
                    AmountPayments = ReadDec(reader, oAmtPayments),
                });
            }
            return results;
        }

        /// <summary>
        /// Gets Tender Totals report (desktop-style): pivot by Location (Register) and Cashier, columns = tender/credit types.
        /// Uses SP_GetTendersCashier for detail data, SP_GetTendersCashierTotal for column list, then aggregates and pivots.
        /// </summary>
        public async Task<ApiResponse<TenderTotalsResponseDto>> GetTenderTotalsReportAsync(TenderTotalsRequestDto request)
        {
            try
            {
                request ??= new TenderTotalsRequestDto();

                // Build full date/time range: default both to today so parameters match what the client sends
                var fromDate = request.FromDate ?? DateTime.Today;
                var toDate = request.ToDate ?? DateTime.Today;

                var fromDateTime = ApplyTimeToDate(fromDate, request.FromTime ?? "00:00");
                var toDateTime = ApplyTimeToDate(toDate, request.ToTime ?? "23:59");
                // If To is midnight, treat as end of that day inclusive
                if (toDateTime.TimeOfDay <= TimeSpan.Zero)
                    toDateTime = toDateTime.Date.AddDays(1).AddSeconds(-1);

                // SP signature: SP_GetTendersCashier(@StoreID, ...) compares against
                //   WHERE (@StoreID = '00000000-0000-0000-0000-000000000000' OR #Tepm1.StoreID = @StoreID)
                // so "All Stores" must be Guid.Empty (NOT NULL — NULL makes both predicates UNKNOWN
                // and the filter drops every row, which is why the web showed "No Data Found").
                Guid storeId = (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    ? request.StoreId.Value
                    : Guid.Empty;

                // Default IncludePayOut so SP gets a non-null value (SQL WHERE IncludePayOut = @IncludePayOut returns no rows when @IncludePayOut is NULL)
                var includePayOut = true; // Station report always includes payouts; no UI filter

                // Detail data: SP_GetTendersCashier (null-safe). Pass null for TenderType/CreditType so SP returns all tenders when it uses (IS NULL OR = @param)
                var spResults = await _dbContext.Procedures.SP_GetTendersCashierAsync(
                    storeId,
                    fromDateTime,
                    toDateTime,
                    includePayOut,
                    tenderType: null!,
                    creditType: null!
                ) ?? new List<SP_GetTendersCashierResult>();

                // Column name rules to match desktop and show both Tender Type and Credit Type in grid headers:
                // - Tender Type is the main bucket
                // - When CreditType is meaningful (not a generic 'Other CC'), use "TenderType / CreditType" (e.g. "CREDIT CARD / Visa")
                // - When CreditType is generic (e.g. 'Other CC') or missing, use TenderType alone (e.g. "CASH", "CHECK", "EBT", "GIFT CARD")
                string ColumnName(string? tenderType, string? creditType)
                {
                    var tt = (tenderType ?? "").Trim();
                    var ct = (creditType ?? "").Trim();

                    if (!string.IsNullOrEmpty(tt))
                    {
                        var ttUpper = tt.ToUpperInvariant();

                        // Treat CREDIT SLIP and GIFT CARD as part of GIFT group (desktop behavior)
                        if ((ttUpper == "CREDIT SLIP" || ttUpper == "GIFT CARD") &&
                            (string.IsNullOrEmpty(ct) || ct.Equals("Other CC", StringComparison.OrdinalIgnoreCase)))
                        {
                            return $"GIFT / {tt}";
                        }
                    }

                    if (!string.IsNullOrEmpty(tt) && !string.IsNullOrEmpty(ct))
                    {
                        if (ct.Equals("Other CC", StringComparison.OrdinalIgnoreCase))
                            return tt;

                        return $"{tt} / {ct}";
                    }

                    // Fallback: prefer TenderType when present, otherwise CreditType
                    return string.IsNullOrEmpty(tt) ? ct : tt;
                }

                // Column list from SP_GetTendersCashierTotal (order and names) (null-safe)
                var totalSpResults = await _dbContext.Procedures.SP_GetTendersCashierTotalAsync(
                    storeId,
                    fromDateTime,
                    toDateTime,
                    includePayOut
                ) ?? new List<SP_GetTendersCashierTotalResult>();
                var tenderColumnNames = totalSpResults
                    .OrderBy(r => r.SortOrder ?? 0)
                    .ThenBy(r => r.TenderTypeInt ?? 0)
                    .Select(r => ColumnName(r.TenderType, r.CreditType))
                    .Where(n => !string.IsNullOrEmpty(n))
                    .Where(IsStandardTenderColumn) // Drop Pay Out, Apply To Account, Retail Points, 10 Percent, Self Points, etc.
                    .Distinct()
                    .ToList();
                if (tenderColumnNames.Count == 0)
                {
                    tenderColumnNames = new List<string>
                    {
                        "CASH", "CHECK", "CC OFFLINE", "CREDIT CARD / AMEX", "CREDIT CARD / Discover",
                        "CREDIT CARD / Master Card", "CREDIT CARD / Visa", "CREDIT CARD",
                        "DEBIT", "EBT", "WIC", "CREDIT SLIP", "GIFT CARD"
                    };
                }

                // Map detail (TenderType, CreditType) to canonical column name from tenderColumnNames (case-insensitive match)
                string ToCanonicalColumn(string? tenderType, string? creditType)
                {
                    var key = ColumnName(tenderType, creditType);
                    if (string.IsNullOrEmpty(key)) return key;
                    var match = tenderColumnNames.FirstOrDefault(c => string.Equals(c, key, StringComparison.OrdinalIgnoreCase));
                    return match ?? key;
                }

                var tenderColumnSet = new HashSet<string>(tenderColumnNames, StringComparer.OrdinalIgnoreCase);

                // Drop detail rows whose tender isn't in the standard back-office allowlist so
                // Pay Out / Apply To Account / Retail Points / 10 Percent / Self Points never
                // contribute to per-row totals or Grand Total.
                spResults = spResults.Where(r => IsStandardTenderDetail(r.TenderType, r.CreditType)).ToList();

                // Normalize Register/Cashier so we don't drop rows when SP returns null/empty (ensures DTO gets data)
                string NormalizeRegister(string? v) => string.IsNullOrWhiteSpace(v) ? "" : v.Trim();
                string NormalizeCashier(string? v) => string.IsNullOrWhiteSpace(v) ? "" : v.Trim();

                // Group by Register then Cashier, then by canonical column name -> sum(Amount). Only use columns from tenderColumnNames so count/names match desktop.
                var grouped = spResults
                    .GroupBy(r => new { Register = NormalizeRegister(r.RegistersBackoffice), Cashier = NormalizeCashier(r.Cashier) })
                    .Select(g =>
                    {
                        var amounts = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
                        foreach (var col in tenderColumnNames)
                            amounts[col] = 0m;
                        foreach (var x in g)
                        {
                            var canon = ToCanonicalColumn(x.TenderType, x.CreditType);
                            if (string.IsNullOrEmpty(canon) || !tenderColumnSet.Contains(canon)) continue;
                            amounts[canon] += x.Amount ?? 0m;
                        }

                        // Derive CREDIT CARD total column: sum all CREDIT CARD / <brand> columns into plain "CREDIT CARD"
                        var creditBrandKeys = amounts.Keys
                            .Where(k => k.StartsWith("CREDIT CARD /", StringComparison.OrdinalIgnoreCase))
                            .ToList();
                        if (creditBrandKeys.Count > 0)
                        {
                            var creditCardKey = tenderColumnNames
                                .FirstOrDefault(c => c.Equals("CREDIT CARD", StringComparison.OrdinalIgnoreCase));
                            if (!string.IsNullOrEmpty(creditCardKey))
                            {
                                decimal creditTotal = 0m;
                                foreach (var key in creditBrandKeys)
                                    creditTotal += amounts[key];
                                amounts[creditCardKey] = creditTotal;
                            }
                        }

                        return new { g.Key.Register, g.Key.Cashier, Amounts = amounts };
                    })
                    .ToList();

                var detailRows = grouped
                    .OrderBy(r => r.Register)
                    .ThenBy(r => r.Cashier)
                    .Select(r => new TenderTotalsPivotRowDto
                    {
                        RegisterNo = r.Register,
                        Cashier = r.Cashier,
                        TenderAmounts = r.Amounts
                    })
                    .ToList();

                // Detail rows go straight through — no synthetic "Register Total" row injection.
                // The desktop's per-register subtotal is a *footer* on its pivot grid, not a row
                // in the dataset. Injecting it here both (a) misrenders as a cashier named
                // "Register Total" in the web grid, and (b) double-counts in the grand total.
                // The web grid handles per-group subtotals via its built-in grouping (defaultGroupByColumns).
                var pivotRows = detailRows;

                var totalAmount = pivotRows.Sum(r => r.TenderAmounts.Values.Sum());

                var response = new TenderTotalsResponseDto
                {
                    Data = pivotRows,
                    TenderColumnNames = tenderColumnNames,
                    TotalRecords = pivotRows.Count,
                    TotalAmount = totalAmount
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TenderTotalsResponseDto>($"Failed to generate Tender Totals report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Tender Totals By Station report: pivot by Location (Register) only, columns = tender/credit types (same rules as Tender Totals).
        /// Reuses SP_GetTendersCashier and SP_GetTendersCashierTotal but aggregates by register only.
        /// </summary>
        public async Task<ApiResponse<TenderTotalsResponseDto>> GetTenderTotalsByStationReportAsync(TenderTotalsRequestDto request)
        {
            try
            {
                request ??= new TenderTotalsRequestDto();

                var fromDate = request.FromDate ?? DateTime.Today;
                var toDate = request.ToDate ?? DateTime.Today;

                var fromDateTime = ApplyTimeToDate(fromDate, request.FromTime ?? "00:00");
                var toDateTime = ApplyTimeToDate(toDate, request.ToTime ?? "23:59");
                if (toDateTime.TimeOfDay <= TimeSpan.Zero)
                    toDateTime = toDateTime.Date.AddDays(1).AddSeconds(-1);

                Guid? storeId = null;
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    storeId = request.StoreId.Value;

                var includePayOut = request.IncludePayOut;

                // Use station-specific SP so Location (RegisterNo) matches desktop "By Station" report
                var spResults = await _dbContext.Procedures.SP_GetTendersCashierByStationAsync(
                    fromDateTime,
                    toDateTime,
                    storeId,
                    registerID: null
                ) ?? new List<SP_GetTendersCashierByStationResult>();

                string ColumnName(string? tenderName, string? creditName)
                {
                    var tt = (tenderName ?? "").Trim();
                    var ct = (creditName ?? "").Trim();

                    if (!string.IsNullOrEmpty(tt))
                    {
                        var ttUpper = tt.ToUpperInvariant();

                        // Treat CREDIT SLIP and GIFT CARD as part of GIFT group (desktop behavior)
                        if ((ttUpper == "CREDIT SLIP" || ttUpper == "GIFT CARD") &&
                            (string.IsNullOrEmpty(ct) || ct.Equals("Other CC", StringComparison.OrdinalIgnoreCase)))
                        {
                            return $"GIFT / {tt}";
                        }
                    }

                    if (!string.IsNullOrEmpty(tt) && !string.IsNullOrEmpty(ct))
                    {
                        if (ct.Equals("Other CC", StringComparison.OrdinalIgnoreCase))
                            return tt;

                        return $"{tt} / {ct}";
                    }

                    return string.IsNullOrEmpty(tt) ? ct : tt;
                }

                // SP_GetTendersCashierTotal needs Guid.Empty for "all stores" (same WHERE pattern as
                // SP_GetTendersCashier — NULL filters out every row). The by-station SP above accepts
                // NULL natively because it has dedicated IF/ELSE branches, hence the two distinct
                // values: storeId for the by-station SP, totalStoreId for the totals SP.
                var totalStoreId = storeId ?? Guid.Empty;
                var totalSpResults = await _dbContext.Procedures.SP_GetTendersCashierTotalAsync(
                    totalStoreId,
                    fromDateTime,
                    toDateTime,
                    includePayOut
                ) ?? new List<SP_GetTendersCashierTotalResult>();
                var tenderColumnNames = totalSpResults
                    .OrderBy(r => r.SortOrder ?? 0)
                    .ThenBy(r => r.TenderTypeInt ?? 0)
                    .Select(r => ColumnName(r.TenderType, r.CreditType))
                    .Where(n => !string.IsNullOrEmpty(n))
                    .Where(IsStandardTenderColumn) // Drop Pay Out, Apply To Account, Retail Points, 10 Percent, Self Points, etc.
                    .Distinct()
                    .ToList();
                if (tenderColumnNames.Count == 0)
                {
                    tenderColumnNames = new List<string>
                    {
                        "CASH", "CHECK", "CC OFFLINE", "CREDIT CARD / AMEX", "CREDIT CARD / Discover",
                        "CREDIT CARD / Master Card", "CREDIT CARD / Visa", "CREDIT CARD",
                        "DEBIT", "EBT", "WIC", "CREDIT SLIP", "GIFT CARD"
                    };
                }

                string ToCanonicalColumn(string? tenderName, string? creditName)
                {
                    var key = ColumnName(tenderName, creditName);
                    if (string.IsNullOrEmpty(key)) return key;
                    var match = tenderColumnNames.FirstOrDefault(c => string.Equals(c, key, StringComparison.OrdinalIgnoreCase));
                    return match ?? key;
                }

                var tenderColumnSet = new HashSet<string>(tenderColumnNames, StringComparer.OrdinalIgnoreCase);

                // Same back-office allowlist as the main Tender Totals: drop synthetic tenders
                // (Pay Out / Apply To Account / Retail Points / 10 Percent / Self Points / etc.).
                spResults = spResults.Where(r => IsStandardTenderDetail(r.TenderName, r.CreditName)).ToList();

                string NormalizeRegister(string? v) => string.IsNullOrWhiteSpace(v) ? "" : v.Trim();
                string NormalizeTransaction(string? v) => string.IsNullOrWhiteSpace(v) ? "" : v.Trim();

                // Group by Register + TransactionNo (station + transaction), then by canonical column name -> sum(Amount).
                var grouped = spResults
                    .GroupBy(r => new { Register = NormalizeRegister(r.RegisterNo), TransactionNo = NormalizeTransaction(r.TransactionNo) })
                    .Select(g =>
                    {
                        var amounts = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
                        foreach (var col in tenderColumnNames)
                            amounts[col] = 0m;
                        foreach (var x in g)
                        {
                            var canon = ToCanonicalColumn(x.TenderName, x.CreditName);
                            if (string.IsNullOrEmpty(canon) || !tenderColumnSet.Contains(canon)) continue;
                            amounts[canon] += x.Amount ?? 0m;
                        }

                        // CREDIT CARD total across brands into plain "CREDIT CARD"
                        var creditBrandKeys = amounts.Keys
                            .Where(k => k.StartsWith("CREDIT CARD /", StringComparison.OrdinalIgnoreCase))
                            .ToList();
                        if (creditBrandKeys.Count > 0)
                        {
                            var creditCardKey = tenderColumnNames
                                .FirstOrDefault(c => c.Equals("CREDIT CARD", StringComparison.OrdinalIgnoreCase));
                            if (!string.IsNullOrEmpty(creditCardKey))
                            {
                                decimal creditTotal = 0m;
                                foreach (var key in creditBrandKeys)
                                    creditTotal += amounts[key];
                                amounts[creditCardKey] = creditTotal;
                            }
                        }

                        return new { g.Key.Register, g.Key.TransactionNo, Amounts = amounts };
                    })
                    .ToList();

                var pivotRows = grouped
                    .OrderBy(r => r.Register)
                    .ThenBy(r => r.TransactionNo)
                    .Select(r => new TenderTotalsPivotRowDto
                    {
                        RegisterNo = r.Register,
                        Cashier = r.TransactionNo,
                        TenderAmounts = r.Amounts
                    })
                    .ToList();

                var totalAmount = pivotRows.Sum(r => r.TenderAmounts.Values.Sum());

                var response = new TenderTotalsResponseDto
                {
                    Data = pivotRows,
                    TenderColumnNames = tenderColumnNames,
                    TotalRecords = pivotRows.Count,
                    TotalAmount = totalAmount
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TenderTotalsResponseDto>($"Failed to generate Tender Totals By Station report: {ex.Message}");
            }
        }

        /// <summary>
        /// Drill-down for Tender Totals: returns the transaction-level rows behind a single
        /// Register+Cashier pivot cell. Same filters as the parent report; results are filtered
        /// by Cashier (and optionally RegisterNo) in memory. Mirrors the desktop's
        /// RepTendersCashier window opened from a double-click on RepTenders.
        /// </summary>
        public async Task<ApiResponse<TenderTotalsDetailsResponseDto>> GetTenderTotalsDetailsAsync(TenderTotalsDetailsRequestDto request)
        {
            try
            {
                request ??= new TenderTotalsDetailsRequestDto();

                var fromDate = request.FromDate ?? DateTime.Today;
                var toDate = request.ToDate ?? DateTime.Today;

                var fromDateTime = ApplyTimeToDate(fromDate, request.FromTime ?? "00:00");
                var toDateTime = ApplyTimeToDate(toDate, request.ToTime ?? "23:59");
                if (toDateTime.TimeOfDay <= TimeSpan.Zero)
                    toDateTime = toDateTime.Date.AddDays(1).AddSeconds(-1);

                // Same store semantics as parent report: "All Stores" => Guid.Empty
                // (SP uses `@StoreID = '00000000-0000-0000-0000-000000000000' OR ...`).
                Guid storeId = (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    ? request.StoreId.Value
                    : Guid.Empty;

                var includePayOut = request.IncludePayOut;

                var spResults = await _dbContext.Procedures.SP_GetTendersCashierAsync(
                    storeId,
                    fromDateTime,
                    toDateTime,
                    includePayOut,
                    tenderType: null!,
                    creditType: null!
                ) ?? new List<SP_GetTendersCashierResult>();

                static string Norm(string? v) => string.IsNullOrWhiteSpace(v) ? "" : v.Trim();
                var cashier = Norm(request.Cashier);
                var registerNo = Norm(request.RegisterNo);

                // Filter to the cell that was double-clicked. Cashier match is required;
                // RegisterNo is optional (empty/null = include all registers for that cashier).
                // Also drop synthetic tenders (Pay Out / Apply To Account / Retail Points / etc.)
                // so the drill-down totals match the parent pivot cell.
                var filtered = spResults.Where(r =>
                {
                    if (!IsStandardTenderDetail(r.TenderType, r.CreditType)) return false;
                    var c = Norm(r.Cashier);
                    var reg = Norm(r.RegistersBackoffice);
                    bool cashierOk = string.Equals(c, cashier, StringComparison.OrdinalIgnoreCase);
                    bool regOk = string.IsNullOrEmpty(registerNo) ||
                                 string.Equals(reg, registerNo, StringComparison.OrdinalIgnoreCase);
                    return cashierOk && regOk;
                }).ToList();

                var rows = filtered
                    .OrderBy(r => r.TenderDate ?? DateTime.MinValue)
                    .ThenBy(r => Norm(r.TransactionNo))
                    .Select(r => new TenderTotalsDetailsRowDto
                    {
                        TransactionType = Norm(r.TransactionType),
                        TenderType = Norm(r.TenderType),
                        CreditType = Norm(r.CreditType),
                        TransactionNo = Norm(r.TransactionNo),
                        TransactionID = r.TransactionID,
                        TenderDate = r.TenderDate,
                        Amount = r.Amount ?? 0m,
                        Cashier = Norm(r.Cashier),
                        RegisterNo = Norm(r.RegistersBackoffice),
                        CustomerNo = Norm(r.CustomerNo),
                        CustomerName = Norm(r.CustomerName),
                        StoreName = Norm(r.StoreName),
                    })
                    .ToList();

                var response = new TenderTotalsDetailsResponseDto
                {
                    Rows = rows,
                    TotalRecords = rows.Count,
                    GrandTotalAmount = rows.Sum(r => r.Amount),
                    Cashier = cashier,
                    RegisterNo = registerNo,
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TenderTotalsDetailsResponseDto>($"Failed to load Tender Totals drill-down: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets On Account Sales report (parent grid). Mirrors the desktop's
        /// RepAcountReceivableSales (Sales mode = Totals view) which calls
        /// [dbo].[Rpt_AcountReceivableTotals] and then filters where AmountSales > 0.
        /// Returns one row per customer with their period AmountSales / AmountPayments /
        /// Balance, scoped to the date range and optional store.
        /// </summary>
        public async Task<ApiResponse<OnAccountSalesResponseDto>> GetOnAccountSalesReportAsync(OnAccountSalesRequestDto request)
        {
            try
            {
                request ??= new OnAccountSalesRequestDto();

                var fromDate = request.FromDate ?? DateTime.Today.AddDays(-30);
                var toDate = request.ToDate ?? DateTime.Today;

                // Ensure inclusive end-of-day range (desktop style)
                if (toDate.Date == toDate && toDate.TimeOfDay == TimeSpan.Zero)
                    toDate = toDate.AddDays(1).AddSeconds(-1);

                Guid? storeId = null;
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    storeId = request.StoreId.Value;

                // Call the SAME SP the desktop uses for the parent grid. The SP itself does the
                // per-customer roll-up via correlated subqueries against [Transaction], filtering
                // transactionType <> 2 AND <> 4 AND Status > 0 — semantics we DON'T replicate by
                // hand from Web_Rpt_AcountReceivable. (Web_Rpt_AcountReceivable joins Actions
                // with ActionType=17 only, which is the desktop's drill-down dataset, not the
                // parent grid dataset — that mismatch is what produced "1 row $173 vs 11 rows
                // $835" before this change.)
                var totals = await ReadAccountReceivableTotalsAsync(fromDate, toDate, storeId).ConfigureAwait(false);

                if (request.CustomerId.HasValue && request.CustomerId.Value != Guid.Empty)
                {
                    var cid = request.CustomerId.Value;
                    totals = totals.Where(r => r.CustomerID.HasValue && r.CustomerID.Value == cid).ToList();
                }

                // Desktop parity (RepAcountReceivableSales.TransQ_EvBackFillEnd → DataView filter
                // "AmountSales > 0"): drop blank-customer rows and customers with no period sales.
                var grouped = totals
                    .Where(r => !string.IsNullOrWhiteSpace(r.CustomerNo))
                    .Where(r => r.AmountSales > 0m)
                    .Select(r => new OnAccountSalesRowDto
                    {
                        StoreId = r.StoreId,
                        StoreName = r.StoreName,
                        CustomerId = r.CustomerID,
                        CustomerNo = r.CustomerNo,
                        // Build a display "Name" for legacy callers; LastName/FirstName are also
                        // exposed separately so the grid can group by either.
                        Name = string.IsNullOrEmpty(r.LastName) && string.IsNullOrEmpty(r.FirstName)
                            ? string.Empty
                            : $"{r.LastName} {r.FirstName}".Trim(),
                        LastName = r.LastName,
                        FirstName = r.FirstName,
                        Address = r.Address,
                        Phone = r.Phone,
                        TransactionNo = string.Empty,
                        SaleTime = null,
                        UserName = string.Empty,
                        // The desktop's "Sale" column on the legacy DTO mirrored AmountSales for
                        // backwards compat; keep that here so any consumer still wired to .Sale
                        // sees the same value.
                        Sale = r.AmountSales,
                        AmountPayments = r.AmountPayments,
                        AmountSales = r.AmountSales,
                        BalanceDoe = r.BalanceDoe,
                    })
                    .OrderBy(r => r.StoreName)
                    .ThenBy(r => r.CustomerNo)
                    .ToList();

                var response = new OnAccountSalesResponseDto
                {
                    Data = grouped,
                    TotalRecords = grouped.Count,
                    TotalSale = grouped.Sum(r => r.Sale),
                    TotalPayments = grouped.Sum(r => r.AmountPayments),
                    TotalBalance = grouped.Sum(r => r.BalanceDoe)
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<OnAccountSalesResponseDto>($"Failed to generate On Account Sales report: {ex.Message}");
            }
        }

        /// <summary>
        /// Drill-down for On Account Sales / Payments — returns the per-transaction rows
        /// behind the customer the user double-clicked. Calls the SAME SP the desktop's
        /// FrmLiveReport uses ([dbo].[SP_GetTransactionLivesView]) with the same kind of
        /// @Filter string the desktop builds in RepAcountReceivableSales (Sales mode uses
        /// "Debit>Credit", Payments mode uses "Credit>Debit").
        ///
        /// Why not Web_Rpt_AcountReceivable: that SP joins Actions with ActionType=17 and
        /// misses Transactions that have no matching A/R Action row (e.g. SMITH's "-35983"
        /// refund, which is the row the desktop drill-down shows under Payments). Calling
        /// the same view the desktop uses gives row-for-row parity.
        /// </summary>
        public async Task<ApiResponse<OnAccountSalesDetailsResponseDto>> GetOnAccountSalesDetailsAsync(OnAccountSalesDetailsRequestDto request)
        {
            try
            {
                request ??= new OnAccountSalesDetailsRequestDto();

                var fromDate = request.FromDate ?? DateTime.Today.AddDays(-30);
                var toDate = request.ToDate ?? DateTime.Today;
                if (toDate.Date == toDate && toDate.TimeOfDay == TimeSpan.Zero)
                    toDate = toDate.AddDays(1).AddSeconds(-1);

                Guid? storeId = null;
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    storeId = request.StoreId.Value;

                // Resolve CustomerID. The SP filter requires a Guid string (PID='...'). When the
                // client only sent a CustomerNo (e.g. legacy rows without a resolved Guid on the
                // parent), look the customer up by CustomerNo so we can build the desktop's
                // exact filter shape.
                var custId = (request.CustomerId.HasValue && request.CustomerId.Value != Guid.Empty)
                    ? (Guid?)request.CustomerId.Value
                    : null;
                var custNo = (request.CustomerNo ?? string.Empty).Trim();

                if (!custId.HasValue && !string.IsNullOrEmpty(custNo))
                {
                    var matched = await _dbContext.CustomerViews
                        .Where(c => c.CustomerNo == custNo)
                        .Select(c => (Guid?)c.CustomerID)
                        .FirstOrDefaultAsync()
                        .ConfigureAwait(false);
                    if (matched.HasValue) custId = matched;
                }

                if (!custId.HasValue)
                {
                    // No customer identifier — return empty rather than calling the SP with no PID,
                    // which would (with no PID predicate) return all customers' transactions.
                    return ApiResponseFactory.Success(new OnAccountSalesDetailsResponseDto
                    {
                        Rows = new List<OnAccountSalesDetailsRowDto>(),
                        TotalRecords = 0,
                        GrandTotalAmount = 0m,
                        CustomerNo = custNo,
                        CustomerName = string.Empty,
                    });
                }

                // Mode controls the Debit/Credit predicate (matches the desktop).
                var mode = (request.Mode ?? "sales").Trim().ToLowerInvariant();
                bool isPaymentsMode = mode == "payments" || mode == "payment";

                // Build the desktop's filter verbatim. The dates use the same MM/dd/yy HH:mm:ss
                // format the VB code uses. ToDate is +1 day inclusive (per VB's DateAdd(Day,1,EndDate)).
                var fromStr = fromDate.ToString("MM/dd/yy HH:mm:ss", CultureInfo.InvariantCulture);
                var toStr   = toDate.Date.AddDays(1).ToString("MM/dd/yy HH:mm:ss", CultureInfo.InvariantCulture);
                var debitCreditPredicate = isPaymentsMode ? "Credit>Debit" : "Debit>Credit";
                var filter =
                    $" and DateT>='{fromStr}' and DateT<='{toStr}' " +
                    $"And {debitCreditPredicate} And PID='{custId.Value}' " +
                    "And Status>0 And TransactionType<>2";

                var spResults = await ReadTransactionLivesViewAsync(filter).ConfigureAwait(false);

                // The parent grid passes the row's storeId (when the row belongs to a specific
                // store group). The desktop's drill-down doesn't filter by store at all —
                // matches behavior with empty storeId — but when the client explicitly narrows
                // to a single store, respect it.
                if (storeId.HasValue)
                {
                    spResults = spResults
                        .Where(r => r.StoreID.HasValue && r.StoreID.Value == storeId.Value)
                        .ToList();
                }

                var rows = spResults
                    .OrderBy(r => r.DateT ?? DateTime.MinValue)
                    .ThenBy(r => r.Num)
                    .Select(r =>
                    {
                        // For the displayed Amount: desktop convention is signed (Debit-Credit).
                        // Payments mode rows show negative amounts (Credit>Debit -> Amount<0).
                        // Sales mode rows show positive amounts.
                        return new OnAccountSalesDetailsRowDto
                        {
                            TransactionNo = r.Num,
                            Type = r.Type,
                            Date = r.DateT,
                            UserName = r.UserName,
                            CustomerNo = r.CustomerNo,
                            CustomerName = r.Name,
                            // Total = ABS(Debit-Credit), per the SP.
                            Total = r.Total,
                            // Amount = signed Debit-Credit (negative for payment-heavy rows).
                            Amount = r.Amount,
                            // Per-mode contributions (for downstream consumers that need them).
                            AmountSales = r.Debit > r.Credit ? r.Debit - r.Credit : 0m,
                            AmountPayments = r.Credit > r.Debit ? r.Credit - r.Debit : 0m,
                        };
                    })
                    .ToList();

                var firstRow = spResults.FirstOrDefault();
                var response = new OnAccountSalesDetailsResponseDto
                {
                    Rows = rows,
                    TotalRecords = rows.Count,
                    GrandTotalAmount = rows.Sum(r => r.Amount),
                    CustomerNo = firstRow?.CustomerNo ?? custNo,
                    CustomerName = firstRow?.Name ?? string.Empty,
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<OnAccountSalesDetailsResponseDto>($"Failed to load On Account Sales drill-down: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Daily Hour Sales report: sales metrics aggregated by store and hour within a
        /// date range and optional store.
        ///
        /// Calls the same stored procedure the desktop client uses
        /// (`SP_GetDailyHourSales(@FromDate, @Todate, @StoreID, @ReportType)`), which:
        ///   - Buckets each transaction to a FULL clock-hour (so the Hour column shows
        ///     "11:00 AM - 12:00 PM", not "11:36 AM - 12:36 PM" as the older view-based
        ///     implementation did).
        ///   - Computes SalePrec / CustomerPrec relative to the FILTERED window, not the
        ///     view's global totals — so Daily Sales % for a row equals that row's sale
        ///     ÷ the total across all returned rows (matching the desktop's 0.42 / 1.48 /
        ///     98.10% sample) instead of always being 100%.
        ///
        /// ReportType defaults to 2 (Daily) per `RepDailyHoursSales.LoadData` / the
        /// `HourlyReport` enum in the desktop project.
        /// </summary>
        public async Task<ApiResponse<DailyHourSalesResponseDto>> GetDailyHourSalesReportAsync(DailyHourSalesRequestDto request)
        {
            try
            {
                request ??= new DailyHourSalesRequestDto();

                var fromDate = request.FromDate ?? DateTime.Today.AddDays(-30);
                var toDate = request.ToDate ?? DateTime.Today;

                // Ensure inclusive end-of-day range when the caller passes a bare date.
                if (toDate.Date == toDate && toDate.TimeOfDay == TimeSpan.Zero)
                    toDate = toDate.AddDays(1).AddSeconds(-1);

                Guid? storeId = null;
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    storeId = request.StoreId.Value;

                var reportType = request.ReportType ?? 2; // Daily — desktop parity

                // Read the SP via raw ADO.NET instead of the EF-generated wrapper.
                // The wrapper types SalePrec/CustomerPrec as double?, but the underlying
                // SP currently returns those columns as INT — EF's materializer throws
                // "Unable to cast object of type 'System.Int32' to type 'System.Double'".
                // Convert.ToDouble handles whatever numeric type SQL hands back.
                var rows = new List<DailyHourSalesRowDto>();

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "[dbo].[SP_GetDailyHourSales]";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.CommandTimeout = 120;

                    AddParam((DbCommand)cmd, "FromDate",   fromDate,                                  DbType.DateTime);
                    AddParam((DbCommand)cmd, "Todate",     toDate,                                    DbType.DateTime);
                    AddParam((DbCommand)cmd, "StoreID",    (object?)storeId ?? DBNull.Value,          DbType.Guid);
                    AddParam((DbCommand)cmd, "ReportType", reportType,                                DbType.Int32);

                    using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
                    var oStore    = OrdOf(reader, "StoreName");
                    var oWeekDay  = OrdOf(reader, "WeekDay");
                    var oHour     = OrdOf(reader, "Hour");
                    var oDebit    = OrdOf(reader, "Debit");
                    var oCredit   = OrdOf(reader, "Credit");
                    var oBalance  = OrdOf(reader, "Balance");
                    var oCntTx    = OrdOf(reader, "CountTransaction");
                    var oRegs     = OrdOf(reader, "Registers");
                    var oSalePct  = OrdOf(reader, "SalePrec");
                    var oCusts    = OrdOf(reader, "Customers");
                    var oTxWCust  = OrdOf(reader, "TransactionWithCustomer");
                    var oCustPct  = OrdOf(reader, "CustomerPrec");
                    var oCustDr   = OrdOf(reader, "CustomerDebit");
                    var oItems    = OrdOf(reader, "Items");
                    // Optional columns needed for drill-down (OrdOf returns -1 if absent)
                    var oDate     = OrdOf(reader, "Date");
                    var oOrderCol = OrdOf(reader, "OrderCol");
                    var oStoreId  = OrdOf(reader, "StoreID");

                    while (await reader.ReadAsync())
                    {
                        rows.Add(new DailyHourSalesRowDto
                        {
                            StoreName               = ReadStr(reader, oStore),
                            WeekDay                 = ReadStr(reader, oWeekDay),
                            Hour                    = ReadStr(reader, oHour),
                            Debit                   = oDebit   >= 0 && !reader.IsDBNull(oDebit)   ? Convert.ToDecimal(reader.GetValue(oDebit))   : 0m,
                            Credit                  = oCredit  >= 0 && !reader.IsDBNull(oCredit)  ? Convert.ToDecimal(reader.GetValue(oCredit))  : 0m,
                            Balance                 = oBalance >= 0 && !reader.IsDBNull(oBalance) ? Convert.ToDecimal(reader.GetValue(oBalance)) : 0m,
                            CountTransaction        = ReadInt(reader, oCntTx),
                            Registers               = ReadInt(reader, oRegs),
                            SalePrec                = oSalePct >= 0 && !reader.IsDBNull(oSalePct) ? Convert.ToDouble(reader.GetValue(oSalePct)) : 0d,
                            Customers               = ReadInt(reader, oCusts),
                            TransactionWithCustomer = ReadInt(reader, oTxWCust),
                            CustomerPrec            = oCustPct >= 0 && !reader.IsDBNull(oCustPct) ? Convert.ToDouble(reader.GetValue(oCustPct)) : 0d,
                            CustomerDebit           = oCustDr  >= 0 && !reader.IsDBNull(oCustDr)  ? Convert.ToDecimal(reader.GetValue(oCustDr))  : 0m,
                            Items                   = oItems   >= 0 && !reader.IsDBNull(oItems)   ? Convert.ToDecimal(reader.GetValue(oItems))   : 0m,
                            Date                    = ReadStr(reader, oDate),
                            OrderCol                = oOrderCol >= 0 && !reader.IsDBNull(oOrderCol) ? Convert.ToDateTime(reader.GetValue(oOrderCol)) : (DateTime?)null,
                            StoreId                 = oStoreId  >= 0 && !reader.IsDBNull(oStoreId)  ? reader.GetGuid(oStoreId)                       : (Guid?)null
                        });
                    }
                }

                return ApiResponseFactory.Success(new DailyHourSalesResponseDto
                {
                    Data         = rows,
                    TotalRecords = rows.Count,
                    TotalDebit   = rows.Sum(r => r.Debit),
                    TotalCredit  = rows.Sum(r => r.Credit),
                    TotalBalance = rows.Sum(r => r.Balance)
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DailyHourSalesResponseDto>($"Failed to generate Daily Hour Sales report: {ex.Message}");
            }
        }

        /// <summary>
        /// Drill-down for the Daily Hour Sales report: returns every transaction in
        /// [HourStart, HourStart + 1 hour) for the given store. Calls the same SP the
        /// desktop's `FillInvoices` uses — `SP_GetInvoices` — with a WHERE filter that
        /// matches the desktop's bucket semantics. Triggered by double-clicking a row
        /// in the Daily Hour Sales grid.
        /// </summary>
        public async Task<ApiResponse<DailyHourSalesDetailsResponseDto>> GetDailyHourSalesDetailsAsync(DailyHourSalesDetailsRequestDto request)
        {
            try
            {
                request ??= new DailyHourSalesDetailsRequestDto();
                if (!request.HourStart.HasValue)
                {
                    return ApiResponseFactory.BadRequest<DailyHourSalesDetailsResponseDto>("hourStart is required");
                }

                var hourStart = request.HourStart.Value;
                var hourEnd   = hourStart.AddHours(1);
                Guid? storeId = (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty) ? request.StoreId : null;

                // SP_GetInvoices accepts a free-form Filter string appended to its WHERE clause.
                // Status > 0 mirrors the desktop's filter (skips voided rows). The date column
                // (DateT) is the transaction timestamp the SP exposes.
                var filter = $" AND Status > 0 AND DateT >= '{hourStart:yyyy-MM-dd HH:mm:ss}' AND DateT < '{hourEnd:yyyy-MM-dd HH:mm:ss}' ";
                if (storeId.HasValue)
                    filter += $" AND StoreID = '{storeId.Value}' ";

                var spRows = await _dbContext.Procedures.SP_GetInvoicesAsync(filter);

                var rows = spRows.Select(r => new DailyHourSalesDetailsRowDto
                {
                    No            = r.Num ?? string.Empty,
                    Type          = r.Type ?? string.Empty,
                    Date          = r.DateT,
                    UserName      = r.UserName ?? string.Empty,
                    CustomerNo    = r.CustomerNo ?? string.Empty,
                    CustomerName  = r.Name ?? string.Empty,
                    Total         = r.Debit,        // Per desktop: "Total" column comes from Debit
                    OpenBalance   = r.OpenBalance,
                    AmountPay     = r.AmountPay,
                    Amount        = r.Amount,
                    TransactionId = r.IDc
                }).ToList();

                // Display label like the desktop's "Daily Hours Sales For Tuesday, August 23, 2022 / 2:00 PM - 3:00 PM"
                var hourLabel = $"{hourStart:dddd, MMMM d, yyyy} / {hourStart:h:mm tt} - {hourEnd:h:mm tt}";

                string storeName = string.Empty;
                if (storeId.HasValue)
                {
                    // Mirror the pattern used elsewhere in this service — StoreViews is the only
                    // DbSet that exposes the store name on this DbContext.
                    // Project to StoreName only — materializing the full entity makes
                    // EF SELECT StoreInt, which fails on tenants whose StoreView lacks it.
                    storeName = await _dbContext.StoreViews.AsNoTracking()
                                            .Where(x => x.StoreID == storeId.Value)
                                            .Select(x => x.StoreName)
                                            .FirstOrDefaultAsync() ?? string.Empty;
                }

                return ApiResponseFactory.Success(new DailyHourSalesDetailsResponseDto
                {
                    Data         = rows,
                    TotalRecords = rows.Count,
                    TotalAmount  = rows.Sum(r => r.Amount ?? 0m),
                    HourLabel    = hourLabel,
                    StoreName    = storeName
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DailyHourSalesDetailsResponseDto>($"Failed to load Daily Hour Sales drill-down: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Item Daily Sales report: aggregated sales per item and day within a date range.
        /// Uses SP_ItemsDailySales with a desktop-compatible Filter string (EndSaleTime + StoreID).
        /// </summary>
        public async Task<ApiResponse<ItemDailySalesResponseDto>> GetItemDailySalesReportAsync(ItemDailySalesRequestDto request)
        {
            try
            {
                request ??= new ItemDailySalesRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;

                var from = fromDate.Date;
                var to = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                Guid? departmentId = request.DepartmentId;
                if (departmentId.HasValue && departmentId.Value == Guid.Empty)
                    departmentId = null;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var (rows, totalRecords, totalQty, totalAmount) = await GetItemDailySalesFromSpAsync(from, to, storeId, pageNumber, pageSize).ConfigureAwait(false);

                var response = new ItemDailySalesResponseDto
                {
                    Data = rows,
                    TotalRecords = totalRecords,
                    TotalQty = totalQty,
                    TotalAmount = totalAmount
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemDailySalesResponseDto>($"Failed to generate Item Daily Sales report: {ex.Message}");
            }
        }

        /// <summary>
        /// Pivoted Item Daily Sales — mirrors desktop RepItemsDailySales which feeds a DevExpress
        /// PivotGrid with row fields (Department > ItemName > Barcode) and column field (SaleDate).
        /// We call the same underlying [dbo].[Web_SP_ItemsDailySales] with an effectively unlimited
        /// page size (the SP groups by date+item, so the row count is bounded by distinct items ×
        /// distinct days, which is small compared to raw transaction rows), then reshape the flat
        /// result into the pivot DTO so the frontend can render it directly without re-pivoting.
        /// </summary>
        public async Task<ApiResponse<ItemDailySalesPivotResponseDto>> GetItemDailySalesPivotAsync(ItemDailySalesPivotRequestDto request)
        {
            try
            {
                request ??= new ItemDailySalesPivotRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate   = ParseDate(request.ToDate)   ?? DateTime.Today;
                var from = fromDate.Date;
                var to   = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty) storeId = null;

                Guid? departmentId = request.DepartmentId;
                if (departmentId.HasValue && departmentId.Value == Guid.Empty) departmentId = null;

                // Re-use the flat SP at "give me everything" page size. The SP itself caps memory
                // by GROUPing on (day, item) before paging, so the universe is bounded and safe.
                const int allRowsPageSize = 100_000;
                var (rows, _totalRecords, _gQty, _gAmt) = await GetItemDailySalesFromSpAsync(
                    from, to, storeId, pageNumber: 1, pageSize: allRowsPageSize).ConfigureAwait(false);

                // Department filter is applied here in C# rather than in the SP's @Filter so we
                // don't have to special-case the [NO DEPARTMENT] / null-Guid combination inside
                // the existing SP. This matches the data volume well — pivot rows are already
                // small after SP-side grouping.
                IEnumerable<ItemDailySalesRowDto> filtered = rows;
                if (departmentId.HasValue)
                    filtered = filtered.Where(r => r.DepartmentID == departmentId.Value);

                // -- Reshape into the pivot DTO --------------------------------------------------
                // Key each output row by (departmentId, itemName, barcode) so two items with the
                // same name but different barcodes still appear as separate rows (matches the
                // desktop pivot's row-field set).
                var ci = CultureInfo.InvariantCulture;
                string KeyOf(ItemDailySalesRowDto r) =>
                    $"{(r.DepartmentID?.ToString() ?? "_")}|{r.ItemName ?? string.Empty}|{r.BarcodeNumber ?? string.Empty}";

                var pivotRows = new Dictionary<string, ItemDailySalesPivotRowDto>(StringComparer.Ordinal);
                var dateKeysSeen = new SortedSet<string>(StringComparer.Ordinal);
                var totalsByDate = new Dictionary<string, ItemDailySalesPivotCellDto>(StringComparer.Ordinal);
                decimal grandQty = 0m, grandAmount = 0m;

                foreach (var r in filtered)
                {
                    var dateKey = r.SaleDate.Date.ToString("yyyy-MM-dd", ci);
                    dateKeysSeen.Add(dateKey);
                    var key = KeyOf(r);

                    if (!pivotRows.TryGetValue(key, out var pr))
                    {
                        pr = new ItemDailySalesPivotRowDto
                        {
                            ItemId       = r.ItemID,
                            DepartmentId = r.DepartmentID,
                            Department   = string.IsNullOrWhiteSpace(r.Department) ? "[NO DEPARTMENT]" : r.Department,
                            ItemName     = r.ItemName ?? string.Empty,
                            Barcode      = r.BarcodeNumber,
                        };
                        pivotRows[key] = pr;
                    }

                    // Cells: aggregate in case the SP ever returns multiple rows per (item,date)
                    if (!pr.Cells.TryGetValue(dateKey, out var cell))
                    {
                        cell = new ItemDailySalesPivotCellDto();
                        pr.Cells[dateKey] = cell;
                    }
                    cell.Qty    += r.Qty;
                    cell.Amount += r.Total;

                    // Per-date footer totals
                    if (!totalsByDate.TryGetValue(dateKey, out var dt))
                    {
                        dt = new ItemDailySalesPivotCellDto();
                        totalsByDate[dateKey] = dt;
                    }
                    dt.Qty    += r.Qty;
                    dt.Amount += r.Total;

                    grandQty    += r.Qty;
                    grandAmount += r.Total;
                }

                // Order rows so the pivot is stable: Department → Item Name → Barcode (matches desktop).
                var orderedRows = pivotRows.Values
                    .OrderBy(r => r.Department, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(r => r.ItemName,   StringComparer.OrdinalIgnoreCase)
                    .ThenBy(r => r.Barcode ?? string.Empty, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                return ApiResponseFactory.Success(new ItemDailySalesPivotResponseDto
                {
                    Dates  = dateKeysSeen.ToList(),
                    Rows   = orderedRows,
                    Totals = new ItemDailySalesPivotTotalsDto
                    {
                        ByDate = totalsByDate,
                        Grand  = new ItemDailySalesPivotCellDto { Qty = grandQty, Amount = grandAmount },
                    },
                    TotalRecords = orderedRows.Count,
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemDailySalesPivotResponseDto>($"Failed to generate Item Daily Sales pivot: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Item Weekly Sales report: aggregated sales per item and week within a date range.
        /// Uses SP_ItemsWeeklySales with a desktop-compatible Filter string (EndSaleTime + StoreID).
        /// </summary>
        public async Task<ApiResponse<ItemWeeklySalesResponseDto>> GetItemWeeklySalesReportAsync(ItemWeeklySalesRequestDto request)
        {
            try
            {
                request ??= new ItemWeeklySalesRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;

                var from = fromDate.Date;
                var to = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var (rows, totalRecords, totalQty, totalAmount) = await GetItemWeeklySalesFromSpAsync(from, to, storeId, pageNumber, pageSize).ConfigureAwait(false);

                var response = new ItemWeeklySalesResponseDto
                {
                    Data = rows,
                    TotalRecords = totalRecords,
                    TotalQty = totalQty,
                    TotalAmount = totalAmount
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemWeeklySalesResponseDto>($"Failed to generate Item Weekly Sales report: {ex.Message}");
            }
        }

        /// <summary>
        /// Pivoted Item Weekly Sales — mirrors desktop RepItemsWeeklySales. Same shape as the
        /// daily pivot but the column key is the *week-start date*.
        ///
        /// Implementation note: the underlying weekly SP [dbo].[Web_SP_ItemsWeeklySales] uses a
        /// fragile dynamic-SQL pattern that concatenates the store's WeekStartDay (from
        /// SetupValues OptionID=131) into a sub-query inside the SELECT. With a store-less /
        /// All-Stores query (StoreID = Guid.Empty) that sub-query returns no rows, the resulting
        /// @FirstDayOfWeek smallint variable is NULL, and the downstream
        /// dbo.GetFirstDayOfWeek(...) call fails in ways that bubble up as confusing
        /// "Conversion failed when converting the nvarchar value 'ItemName' to data type
        /// smallint" errors. Rather than fight the SP, we side-step it: we call the daily SP
        /// (which works reliably) and bucket each daily row into its week-start date in C#.
        /// </summary>
        public async Task<ApiResponse<ItemWeeklySalesPivotResponseDto>> GetItemWeeklySalesPivotAsync(ItemWeeklySalesPivotRequestDto request)
        {
            try
            {
                request ??= new ItemWeeklySalesPivotRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate   = ParseDate(request.ToDate)   ?? DateTime.Today;
                var from = fromDate.Date;
                var to   = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty) storeId = null;

                Guid? departmentId = request.DepartmentId;
                if (departmentId.HasValue && departmentId.Value == Guid.Empty) departmentId = null;

                // Use the DAILY SP (groups by day+item server-side, so row count is bounded by
                // distinct items × distinct days — fine to pull in one page) and bucket into
                // weeks in C# below. Default week-start day matches the desktop's most common
                // setting in the absence of a per-store override: Sunday.
                const int allRowsPageSize = 100_000;
                const DayOfWeek weekStartDay = DayOfWeek.Sunday;
                var (rows, _t, _gQ, _gA) = await GetItemDailySalesFromSpAsync(from, to, storeId, 1, allRowsPageSize).ConfigureAwait(false);

                IEnumerable<ItemDailySalesRowDto> filtered = rows;
                if (departmentId.HasValue)
                    filtered = filtered.Where(r => r.DepartmentID == departmentId.Value);

                // -- Reshape ---------------------------------------------------------------------
                var ci = CultureInfo.InvariantCulture;
                string KeyOf(ItemDailySalesRowDto r) =>
                    $"{(r.DepartmentID?.ToString() ?? "_")}|{r.ItemName ?? string.Empty}|{r.BarcodeNumber ?? string.Empty}";

                // Snap a calendar date to its week-start date (e.g. the Sunday on/before `d`).
                static DateTime SnapToWeekStart(DateTime d, DayOfWeek start)
                {
                    var diff = ((int)d.DayOfWeek - (int)start + 7) % 7;
                    return d.Date.AddDays(-diff);
                }

                var pivotRows = new Dictionary<string, ItemWeeklySalesPivotRowDto>(StringComparer.Ordinal);
                var dateKeysSeen = new SortedSet<string>(StringComparer.Ordinal);
                var totalsByDate = new Dictionary<string, ItemWeeklySalesPivotCellDto>(StringComparer.Ordinal);
                decimal grandQty = 0m, grandAmount = 0m;

                foreach (var r in filtered)
                {
                    var weekStart = SnapToWeekStart(r.SaleDate, weekStartDay);
                    var dateKey = weekStart.ToString("yyyy-MM-dd", ci);
                    dateKeysSeen.Add(dateKey);
                    var key = KeyOf(r);

                    if (!pivotRows.TryGetValue(key, out var pr))
                    {
                        pr = new ItemWeeklySalesPivotRowDto
                        {
                            ItemId       = r.ItemID,
                            DepartmentId = r.DepartmentID,
                            Department   = string.IsNullOrWhiteSpace(r.Department) ? "[NO DEPARTMENT]" : r.Department,
                            ItemName     = r.ItemName ?? string.Empty,
                            Barcode      = r.BarcodeNumber,
                        };
                        pivotRows[key] = pr;
                    }

                    // Multiple daily rows can fall into the same week, so we ACCUMULATE here.
                    if (!pr.Cells.TryGetValue(dateKey, out var cell))
                    {
                        cell = new ItemWeeklySalesPivotCellDto();
                        pr.Cells[dateKey] = cell;
                    }
                    cell.Qty    += r.Qty;
                    cell.Amount += r.Total;

                    if (!totalsByDate.TryGetValue(dateKey, out var dt))
                    {
                        dt = new ItemWeeklySalesPivotCellDto();
                        totalsByDate[dateKey] = dt;
                    }
                    dt.Qty    += r.Qty;
                    dt.Amount += r.Total;

                    grandQty    += r.Qty;
                    grandAmount += r.Total;
                }

                var orderedRows = pivotRows.Values
                    .OrderBy(r => r.Department, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(r => r.ItemName,   StringComparer.OrdinalIgnoreCase)
                    .ThenBy(r => r.Barcode ?? string.Empty, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                return ApiResponseFactory.Success(new ItemWeeklySalesPivotResponseDto
                {
                    Dates  = dateKeysSeen.ToList(),
                    Rows   = orderedRows,
                    Totals = new ItemWeeklySalesPivotTotalsDto
                    {
                        ByDate = totalsByDate,
                        Grand  = new ItemWeeklySalesPivotCellDto { Qty = grandQty, Amount = grandAmount },
                    },
                    TotalRecords = orderedRows.Count,
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemWeeklySalesPivotResponseDto>($"Failed to generate Item Weekly Sales pivot: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Item Monthly Sales report: aggregated sales per item and month within a date range.
        /// Uses SP_ItemsMonthlySales with a desktop-compatible Filter string (EndSaleTime + StoreID).
        /// </summary>
        public async Task<ApiResponse<ItemMonthlySalesResponseDto>> GetItemMonthlySalesReportAsync(ItemMonthlySalesRequestDto request)
        {
            try
            {
                request ??= new ItemMonthlySalesRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-365);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;

                var from = fromDate.Date;
                var to = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var (rows, totalRecords, totalQty, totalAmount) = await GetItemMonthlySalesFromSpAsync(from, to, storeId, pageNumber, pageSize).ConfigureAwait(false);

                var response = new ItemMonthlySalesResponseDto
                {
                    Data = rows,
                    TotalRecords = totalRecords,
                    TotalQty = totalQty,
                    TotalAmount = totalAmount
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemMonthlySalesResponseDto>($"Failed to generate Item Monthly Sales report: {ex.Message}");
            }
        }

        /// <summary>
        /// Pivoted Item Monthly Sales — mirrors desktop RepItemsMonthlySales. Same approach as
        /// the weekly pivot: call the working daily SP (Web_SP_ItemsDailySales) and bucket each
        /// daily row into its month-start date in C#. Avoids the legacy monthly SP entirely.
        /// Date keys are emitted as yyyy-MM-01 so the frontend can derive both Year (yyyy)
        /// and Month (MM) trivially without locale-sensitive month-name parsing.
        /// </summary>
        public async Task<ApiResponse<ItemMonthlySalesPivotResponseDto>> GetItemMonthlySalesPivotAsync(ItemMonthlySalesPivotRequestDto request)
        {
            try
            {
                request ??= new ItemMonthlySalesPivotRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-365);
                var toDate   = ParseDate(request.ToDate)   ?? DateTime.Today;
                var from = fromDate.Date;
                var to   = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty) storeId = null;

                Guid? departmentId = request.DepartmentId;
                if (departmentId.HasValue && departmentId.Value == Guid.Empty) departmentId = null;

                const int allRowsPageSize = 200_000;
                var (rows, _t, _gQ, _gA) = await GetItemDailySalesFromSpAsync(from, to, storeId, 1, allRowsPageSize).ConfigureAwait(false);

                IEnumerable<ItemDailySalesRowDto> filtered = rows;
                if (departmentId.HasValue)
                    filtered = filtered.Where(r => r.DepartmentID == departmentId.Value);

                var ci = CultureInfo.InvariantCulture;
                string KeyOf(ItemDailySalesRowDto r) =>
                    $"{(r.DepartmentID?.ToString() ?? "_")}|{r.ItemName ?? string.Empty}|{r.BarcodeNumber ?? string.Empty}";

                var pivotRows = new Dictionary<string, ItemMonthlySalesPivotRowDto>(StringComparer.Ordinal);
                var dateKeysSeen = new SortedSet<string>(StringComparer.Ordinal);
                var totalsByDate = new Dictionary<string, ItemMonthlySalesPivotCellDto>(StringComparer.Ordinal);
                decimal grandQty = 0m, grandAmount = 0m;

                foreach (var r in filtered)
                {
                    var monthStart = new DateTime(r.SaleDate.Year, r.SaleDate.Month, 1);
                    var dateKey = monthStart.ToString("yyyy-MM-dd", ci); // yyyy-MM-01
                    dateKeysSeen.Add(dateKey);
                    var key = KeyOf(r);

                    if (!pivotRows.TryGetValue(key, out var pr))
                    {
                        pr = new ItemMonthlySalesPivotRowDto
                        {
                            // Master ItemID — flows through to the frontend's double-click
                            // handler, which uses it to look up transactions for this item
                            // in the clicked month via /api/Reports/ItemSalesTransactions.
                            // Null for manual rows (e.g. "[MANUAL ITEM]").
                            ItemId       = r.ItemID,
                            DepartmentId = r.DepartmentID,
                            Department   = string.IsNullOrWhiteSpace(r.Department) ? "[NO DEPARTMENT]" : r.Department,
                            ItemName     = r.ItemName ?? string.Empty,
                            Barcode      = r.BarcodeNumber,
                        };
                        pivotRows[key] = pr;
                    }

                    if (!pr.Cells.TryGetValue(dateKey, out var cell))
                    {
                        cell = new ItemMonthlySalesPivotCellDto();
                        pr.Cells[dateKey] = cell;
                    }
                    cell.Qty    += r.Qty;
                    cell.Amount += r.Total;

                    if (!totalsByDate.TryGetValue(dateKey, out var dt))
                    {
                        dt = new ItemMonthlySalesPivotCellDto();
                        totalsByDate[dateKey] = dt;
                    }
                    dt.Qty    += r.Qty;
                    dt.Amount += r.Total;

                    grandQty    += r.Qty;
                    grandAmount += r.Total;
                }

                var orderedRows = pivotRows.Values
                    .OrderBy(r => r.Department, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(r => r.ItemName,   StringComparer.OrdinalIgnoreCase)
                    .ThenBy(r => r.Barcode ?? string.Empty, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                return ApiResponseFactory.Success(new ItemMonthlySalesPivotResponseDto
                {
                    Dates  = dateKeysSeen.ToList(),
                    Rows   = orderedRows,
                    Totals = new ItemMonthlySalesPivotTotalsDto
                    {
                        ByDate = totalsByDate,
                        Grand  = new ItemMonthlySalesPivotCellDto { Qty = grandQty, Amount = grandAmount },
                    },
                    TotalRecords = orderedRows.Count,
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemMonthlySalesPivotResponseDto>($"Failed to generate Item Monthly Sales pivot: {ex.Message}");
            }
        }

        /// <summary>
        /// Drill-down for pivot cells (daily / weekly / monthly). Mirrors desktop
        /// `RepMothlySalesDetails` / `RepWeeklySalesDetails`: returns every TransactionEntryItem
        /// row for a given (item, date window). Match logic:
        ///   • If ItemId is supplied and non-empty: filter by ItemID = ItemId.
        ///   • Else (manual item): filter by Name = ItemName and optionally DepartmentID
        ///     so two distinct manual items with the same name don't bleed together.
        ///   • Always filtered by EndSaleTime in [FromDate, ToDate+1) and optional StoreID.
        ///   • Status > 0 to drop voided entries (same as the existing details endpoint).
        /// </summary>
        public async Task<ApiResponse<ItemSalesTransactionsResponseDto>> GetItemSalesTransactionsAsync(ItemSalesTransactionsRequestDto request)
        {
            try
            {
                request ??= new ItemSalesTransactionsRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate   = ParseDate(request.ToDate)   ?? DateTime.Today;
                var from = fromDate.Date;
                var toExclusive = toDate.Date.AddDays(1);

                Guid? itemId = request.ItemId;
                if (itemId.HasValue && itemId.Value == Guid.Empty) itemId = null;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty) storeId = null;

                Guid? departmentId = request.DepartmentId;
                if (departmentId.HasValue && departmentId.Value == Guid.Empty) departmentId = null;

                var itemName = request.ItemName?.Trim();

                if (!itemId.HasValue && string.IsNullOrEmpty(itemName))
                {
                    // No item criteria → nothing to drill into.
                    return ApiResponseFactory.Success(new ItemSalesTransactionsResponseDto());
                }

                // We use raw ADO.NET against the TransactionEntryItem view instead of EF LINQ
                // because the auto-generated EF entity for this view declares `TransactionType`
                // as `int`, but the underlying view column comes back as `decimal` in some
                // tenant databases — EF then throws
                //   "Unable to cast object of type 'System.Decimal' to type 'System.Int32'"
                // during materialization. Reading via DbDataReader with explicit Convert.*
                // calls is robust to either underlying type.

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                var sql = new StringBuilder();
                sql.Append(@"
                    SELECT TransactionID, TransactionNo, StartSaleTime, TransactionType,
                           QTY, Price, Cost, ExtCost, ExtPrice, StoreID, StoreName
                    FROM dbo.TransactionEntryItem
                    WHERE EndSaleTime >= @FromDate AND EndSaleTime < @ToExclusive
                ");
                if (itemId.HasValue)
                {
                    sql.Append(" AND ItemID = @ItemID ");
                }
                else
                {
                    sql.Append(" AND [Name] = @ItemName ");
                    sql.Append(departmentId.HasValue
                        ? " AND DepartmentID = @DepartmentID "
                        : " AND DepartmentID IS NULL ");
                }
                if (storeId.HasValue) sql.Append(" AND StoreID = @StoreID ");
                sql.Append(" ORDER BY StartSaleTime DESC ");

                var rows = new List<ItemSalesTransactionsRowDto>();
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = sql.ToString();
                    cmd.CommandType = CommandType.Text;

                    AddParam((DbCommand)cmd, "FromDate",    from,        DbType.DateTime);
                    AddParam((DbCommand)cmd, "ToExclusive", toExclusive, DbType.DateTime);
                    if (itemId.HasValue) AddGuidParam((DbCommand)cmd, "ItemID", itemId.Value);
                    else
                    {
                        AddStringParam((DbCommand)cmd, "ItemName", itemName ?? string.Empty);
                        if (departmentId.HasValue) AddGuidParam((DbCommand)cmd, "DepartmentID", departmentId.Value);
                    }
                    if (storeId.HasValue) AddGuidParam((DbCommand)cmd, "StoreID", storeId.Value);

                    using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                    {
                        // Resolve ordinals once; missing-column ordinals stay at -1 and are skipped.
                        int Ord(string n) => OrdOf(reader, n);
                        var oTxId  = Ord("TransactionID");
                        var oTxNo  = Ord("TransactionNo");
                        var oDate  = Ord("StartSaleTime");
                        var oType  = Ord("TransactionType");
                        var oQty   = Ord("QTY");        if (oQty == -1) oQty = Ord("Qty");
                        var oPrice = Ord("Price");
                        var oCost  = Ord("Cost");
                        var oXCost = Ord("ExtCost");
                        var oXPrice= Ord("ExtPrice");
                        var oSId   = Ord("StoreID");
                        var oSNam  = Ord("StoreName");

                        while (await reader.ReadAsync())
                        {
                            // Convert.ToInt32 tolerates Decimal / Int16 / Int32 / numeric strings;
                            // raw GetInt32 would throw on numeric() columns coming back as Decimal.
                            int txType = 0;
                            if (oType >= 0 && !reader.IsDBNull(oType))
                            {
                                try { txType = Convert.ToInt32(reader.GetValue(oType), CultureInfo.InvariantCulture); }
                                catch { txType = 0; }
                            }

                            rows.Add(new ItemSalesTransactionsRowDto
                            {
                                TransactionId   = oTxId  >= 0 && !reader.IsDBNull(oTxId)  ? reader.GetGuid(oTxId) : Guid.Empty,
                                TransactionNo   = oTxNo  >= 0 && !reader.IsDBNull(oTxNo)  ? Convert.ToString(reader.GetValue(oTxNo), CultureInfo.InvariantCulture) ?? string.Empty : string.Empty,
                                SaleDate        = ReadDate(reader, oDate),
                                TransactionType = txType,
                                Qty             = oQty   >= 0 && !reader.IsDBNull(oQty)   ? (decimal?)Convert.ToDecimal(reader.GetValue(oQty),   CultureInfo.InvariantCulture) : null,
                                Price           = oPrice >= 0 && !reader.IsDBNull(oPrice) ? (decimal?)Convert.ToDecimal(reader.GetValue(oPrice), CultureInfo.InvariantCulture) : null,
                                Cost            = oCost  >= 0 && !reader.IsDBNull(oCost)  ? (decimal?)Convert.ToDecimal(reader.GetValue(oCost),  CultureInfo.InvariantCulture) : null,
                                ExtCost         = oXCost >= 0 && !reader.IsDBNull(oXCost) ? (decimal?)Convert.ToDecimal(reader.GetValue(oXCost), CultureInfo.InvariantCulture) : null,
                                ExtPrice        = oXPrice>= 0 && !reader.IsDBNull(oXPrice)? (decimal?)Convert.ToDecimal(reader.GetValue(oXPrice),CultureInfo.InvariantCulture) : null,
                                StoreId         = oSId   >= 0 && !reader.IsDBNull(oSId)   ? reader.GetGuid(oSId) : (Guid?)null,
                                StoreName       = oSNam  >= 0 && !reader.IsDBNull(oSNam)  ? Convert.ToString(reader.GetValue(oSNam), CultureInfo.InvariantCulture) : null,
                            });
                        }
                    }
                }

                return ApiResponseFactory.Success(new ItemSalesTransactionsResponseDto
                {
                    Data          = rows,
                    TotalRecords  = rows.Count,
                    TotalQty      = rows.Sum(r => r.Qty ?? 0m),
                    TotalExtCost  = rows.Sum(r => r.ExtCost ?? 0m),
                    TotalExtPrice = rows.Sum(r => r.ExtPrice ?? 0m),
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemSalesTransactionsResponseDto>($"Failed to load item sales transactions: {ex.Message}");
            }
        }

        /// <summary>
        /// Returns the printable receipt text for a single Transaction. Calls [dbo].[SP_GetReciept]
        /// (DB SP name has the historical typo). Mirrors how the desktop's FrmReciept reads the
        /// receipt body from a single nvarchar column (`RecieptTxt`) and renders it line-by-line.
        /// </summary>
        public async Task<ApiResponse<TransactionReceiptResponseDto>> GetTransactionReceiptAsync(TransactionReceiptRequestDto request)
        {
            try
            {
                request ??= new TransactionReceiptRequestDto();
                if (!request.TransactionId.HasValue || request.TransactionId.Value == Guid.Empty)
                {
                    return ApiResponseFactory.BadRequest<TransactionReceiptResponseDto>("transactionId is required");
                }

                var spRows = await _dbContext.Procedures.SP_GetRecieptTextAsync(request.TransactionId.Value, request.TransLogId);
                var text = spRows?.FirstOrDefault()?.RecieptTxt ?? string.Empty;
                return ApiResponseFactory.Success(new TransactionReceiptResponseDto { ReceiptText = text });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TransactionReceiptResponseDto>($"Failed to load transaction receipt: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Department Daily Sales report: aggregated sales per department and day within a date range.
        /// Uses SP_DepartmentsDailySales with a desktop-compatible Filter string (EndSaleTime + StoreID).
        /// </summary>
        public async Task<ApiResponse<DepartmentDailySalesResponseDto>> GetDepartmentDailySalesReportAsync(DepartmentDailySalesRequestDto request)
        {
            try
            {
                request ??= new DepartmentDailySalesRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;

                var from = fromDate.Date;
                var to = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var (rows, totalRecords, totalQty, totalAmount) = await GetDepartmentDailySalesFromSpAsync(from, to, storeId, pageNumber, pageSize).ConfigureAwait(false);

                var response = new DepartmentDailySalesResponseDto
                {
                    Data = rows,
                    TotalRecords = totalRecords,
                    TotalQty = totalQty,
                    TotalAmount = totalAmount
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DepartmentDailySalesResponseDto>($"Failed to generate Department Daily Sales report: {ex.Message}");
            }
        }

        /// <summary>
        /// Pivoted Department Daily Sales — uses the same SP the desktop calls
        /// (RepDepartmentDailySales -> ItemQ.GetDepartmentsDailySales -> SP_DepartmentsDailySales).
        /// Our paginated wrapper is [dbo].[Web_SP_DepartmentsDailySales] which is functionally
        /// identical to the desktop's SP_DepartmentsDailySales (same SELECT + GROUP BY + filter
        /// shape, with OFFSET/FETCH NEXT added for paging). We call it via the existing
        /// GetDepartmentDailySalesFromSpAsync helper and then reshape the flat result into the
        /// pivot DTO. Same code path the desktop uses — same data.
        /// </summary>
        public async Task<ApiResponse<DepartmentDailySalesPivotResponseDto>> GetDepartmentDailySalesPivotAsync(DepartmentDailySalesPivotRequestDto request)
        {
            try
            {
                request ??= new DepartmentDailySalesPivotRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate   = ParseDate(request.ToDate)   ?? DateTime.Today;
                var from = fromDate.Date;
                var to   = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty) storeId = null;

                // Same SP the desktop calls. SP already aggregates per
                // (day, StoreName, Department, DepartmentID) and is bounded by distinct dates ×
                // stores × departments, so a large single page is safe.
                const int allRowsPageSize = 200_000;
                var (rows, _t, _gQ, _gA) = await GetDepartmentDailySalesFromSpAsync(from, to, storeId, 1, allRowsPageSize).ConfigureAwait(false);

                var ci = CultureInfo.InvariantCulture;
                // Direct query above surfaces StoreID, so the row key can use it (stable even if
                // two stores share a name). Fallback to StoreName when StoreID is missing.
                string RowKeyOf(DepartmentDailySalesRowDto r) =>
                    r.StoreID.HasValue
                        ? $"{r.SaleDate.Date:yyyy-MM-dd}|{r.StoreID.Value}"
                        : $"{r.SaleDate.Date:yyyy-MM-dd}|{(r.StoreName ?? string.Empty)}";

                var pivotRows = new Dictionary<string, DepartmentDailySalesPivotRowDto>(StringComparer.Ordinal);
                // Capture each unique department once with its display name + canonical ID
                // (ID may be null for "[NO DEPARTMENT]"). Keep the FIRST non-null ID we see
                // per name in case some rows arrive without one.
                var deptIdByName = new Dictionary<string, Guid?>(StringComparer.OrdinalIgnoreCase);
                var totalsByDept = new Dictionary<string, DepartmentDailySalesPivotCellDto>(StringComparer.OrdinalIgnoreCase);
                decimal grandQty = 0m, grandAmount = 0m;

                foreach (var r in rows)
                {
                    var deptName = string.IsNullOrWhiteSpace(r.Department) ? "[NO DEPARTMENT]" : r.Department;
                    if (!deptIdByName.TryGetValue(deptName, out var existingId) || (!existingId.HasValue && r.DepartmentID.HasValue))
                        deptIdByName[deptName] = r.DepartmentID;

                    var key = RowKeyOf(r);
                    if (!pivotRows.TryGetValue(key, out var pr))
                    {
                        pr = new DepartmentDailySalesPivotRowDto
                        {
                            Date      = r.SaleDate.Date.ToString("yyyy-MM-dd", ci),
                            StoreId   = r.StoreID,
                            StoreName = r.StoreName ?? string.Empty,
                        };
                        pivotRows[key] = pr;
                    }

                    if (!pr.Cells.TryGetValue(deptName, out var cell))
                    {
                        cell = new DepartmentDailySalesPivotCellDto();
                        pr.Cells[deptName] = cell;
                    }
                    cell.Qty    += r.Qty;
                    cell.Amount += r.Total;

                    if (!totalsByDept.TryGetValue(deptName, out var dt))
                    {
                        dt = new DepartmentDailySalesPivotCellDto();
                        totalsByDept[deptName] = dt;
                    }
                    dt.Qty    += r.Qty;
                    dt.Amount += r.Total;

                    grandQty    += r.Qty;
                    grandAmount += r.Total;
                }

                // Department columns: alphabetical by name (frontend can re-sort).
                var departments = deptIdByName
                    .Select(kv => new DepartmentDailySalesPivotColumnDto { Name = kv.Key, Id = kv.Value })
                    .OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                // Rows: newest date first, then by store name — matches the desktop's default ordering.
                var orderedRows = pivotRows.Values
                    .OrderByDescending(p => p.Date, StringComparer.Ordinal)
                    .ThenBy(p => p.StoreName, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                return ApiResponseFactory.Success(new DepartmentDailySalesPivotResponseDto
                {
                    Departments = departments,
                    Rows        = orderedRows,
                    Totals      = new DepartmentDailySalesPivotTotalsDto
                    {
                        ByDepartment = totalsByDept,
                        Grand        = new DepartmentDailySalesPivotCellDto { Qty = grandQty, Amount = grandAmount },
                    },
                    TotalRecords = orderedRows.Count,
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DepartmentDailySalesPivotResponseDto>($"Failed to generate Department Daily Sales pivot: {ex.Message}");
            }
        }

        /// <summary>
        /// Pivoted Department Weekly Sales — mirrors desktop RepDepartmentWeeklySales. Same
        /// rationale as the Item weekly pivot: instead of fighting the fragile
        /// Web_SP_DepartmentWeeklySales (which has the same ItemsRepFilter / dynamic-SQL
        /// quirks as Web_SP_ItemsWeeklySales), we call the working
        /// Web_SP_DepartmentsDailySales and snap each daily row to its week-start date in C#.
        /// </summary>
        public async Task<ApiResponse<DepartmentWeeklySalesPivotResponseDto>> GetDepartmentWeeklySalesPivotAsync(DepartmentWeeklySalesPivotRequestDto request)
        {
            try
            {
                request ??= new DepartmentWeeklySalesPivotRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-84);
                var toDate   = ParseDate(request.ToDate)   ?? DateTime.Today;
                var from = fromDate.Date;
                var to   = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty) storeId = null;

                const int allRowsPageSize = 200_000;
                const DayOfWeek weekStartDay = DayOfWeek.Sunday;
                var (rows, _t, _gQ, _gA) = await GetDepartmentDailySalesFromSpAsync(from, to, storeId, 1, allRowsPageSize).ConfigureAwait(false);

                static DateTime SnapToWeekStart(DateTime d, DayOfWeek start)
                {
                    var diff = ((int)d.DayOfWeek - (int)start + 7) % 7;
                    return d.Date.AddDays(-diff);
                }

                var ci = CultureInfo.InvariantCulture;
                // Key each output row by (Department name, Store name). DepartmentID can be null
                // for "[NO DEPARTMENT]"; StoreID isn't surfaced by the SP so fall back to name.
                string RowKeyOf(DepartmentDailySalesRowDto r) =>
                    $"{(string.IsNullOrWhiteSpace(r.Department) ? "[NO DEPARTMENT]" : r.Department)}|{(r.StoreName ?? string.Empty)}";

                var pivotRows = new Dictionary<string, DepartmentWeeklySalesPivotRowDto>(StringComparer.Ordinal);
                var weekKeysSeen = new SortedSet<string>(StringComparer.Ordinal);
                var totalsByWeek = new Dictionary<string, DepartmentWeeklySalesPivotCellDto>(StringComparer.Ordinal);
                decimal grandQty = 0m, grandAmount = 0m;

                foreach (var r in rows)
                {
                    var weekStart = SnapToWeekStart(r.SaleDate, weekStartDay);
                    var weekKey   = weekStart.ToString("yyyy-MM-dd", ci);
                    weekKeysSeen.Add(weekKey);
                    var deptName  = string.IsNullOrWhiteSpace(r.Department) ? "[NO DEPARTMENT]" : r.Department;
                    var key       = RowKeyOf(r);

                    if (!pivotRows.TryGetValue(key, out var pr))
                    {
                        pr = new DepartmentWeeklySalesPivotRowDto
                        {
                            DepartmentId = r.DepartmentID,
                            Department   = deptName,
                            StoreId      = r.StoreID,
                            StoreName    = r.StoreName ?? string.Empty,
                        };
                        pivotRows[key] = pr;
                    }

                    if (!pr.Cells.TryGetValue(weekKey, out var cell))
                    {
                        cell = new DepartmentWeeklySalesPivotCellDto();
                        pr.Cells[weekKey] = cell;
                    }
                    cell.Qty    += r.Qty;
                    cell.Amount += r.Total;

                    if (!totalsByWeek.TryGetValue(weekKey, out var dt))
                    {
                        dt = new DepartmentWeeklySalesPivotCellDto();
                        totalsByWeek[weekKey] = dt;
                    }
                    dt.Qty    += r.Qty;
                    dt.Amount += r.Total;

                    grandQty    += r.Qty;
                    grandAmount += r.Total;
                }

                // Order: Department asc, then Store asc — matches desktop grouping.
                var orderedRows = pivotRows.Values
                    .OrderBy(p => p.Department, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(p => p.StoreName, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                return ApiResponseFactory.Success(new DepartmentWeeklySalesPivotResponseDto
                {
                    Weeks  = weekKeysSeen.ToList(),
                    Rows   = orderedRows,
                    Totals = new DepartmentWeeklySalesPivotTotalsDto
                    {
                        ByWeek = totalsByWeek,
                        Grand  = new DepartmentWeeklySalesPivotCellDto { Qty = grandQty, Amount = grandAmount },
                    },
                    TotalRecords = orderedRows.Count,
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DepartmentWeeklySalesPivotResponseDto>($"Failed to generate Department Weekly Sales pivot: {ex.Message}");
            }
        }

        /// <summary>
        /// Pivoted Department Monthly Sales — mirrors desktop RepDepartmentMonthlySales.
        /// Rows are (Year, Month). Columns are (Department, Store) pairs — frontend renders
        /// them as a 3-level header (Department super-group → Store group → Amount/Qty subs).
        /// Buckets from the daily SP, no separate monthly SP needed.
        /// </summary>
        public async Task<ApiResponse<DepartmentMonthlySalesPivotResponseDto>> GetDepartmentMonthlySalesPivotAsync(DepartmentMonthlySalesPivotRequestDto request)
        {
            try
            {
                request ??= new DepartmentMonthlySalesPivotRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-365);
                var toDate   = ParseDate(request.ToDate)   ?? DateTime.Today;
                var from = fromDate.Date;
                var to   = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty) storeId = null;

                const int allRowsPageSize = 200_000;
                var (rows, _t, _gQ, _gA) = await GetDepartmentDailySalesFromSpAsync(from, to, storeId, 1, allRowsPageSize).ConfigureAwait(false);

                var ci = CultureInfo.InvariantCulture;
                var monthNames = ci.DateTimeFormat.MonthNames; // 0=Jan, ..., 11=Dec

                // Stable column key — name-based so duplicate dept/store names across stores
                // are still distinguishable (in practice they shouldn't repeat).
                static string ColumnKey(string dept, string store) => $"{dept}|{store}";

                var columnMap   = new Dictionary<string, DepartmentMonthlySalesPivotColumnDto>(StringComparer.Ordinal);
                var rowsByMonth = new Dictionary<string, DepartmentMonthlySalesPivotRowDto>(StringComparer.Ordinal);
                var totalsByCol = new Dictionary<string, DepartmentMonthlySalesPivotCellDto>(StringComparer.Ordinal);
                decimal grandQty = 0m, grandAmount = 0m;

                foreach (var r in rows)
                {
                    var year  = r.SaleDate.Year;
                    var month = r.SaleDate.Month;
                    var monthKey = $"{year:0000}-{month:00}";

                    var deptName  = string.IsNullOrWhiteSpace(r.Department) ? "[NO DEPARTMENT]" : r.Department;
                    var storeName = r.StoreName ?? string.Empty;
                    var colKey    = ColumnKey(deptName, storeName);

                    // Register the column once
                    if (!columnMap.TryGetValue(colKey, out _))
                    {
                        columnMap[colKey] = new DepartmentMonthlySalesPivotColumnDto
                        {
                            Key            = colKey,
                            DepartmentId   = r.DepartmentID,
                            DepartmentName = deptName,
                            StoreId        = r.StoreID,
                            StoreName      = storeName,
                        };
                    }

                    // Register the (year, month) row once
                    if (!rowsByMonth.TryGetValue(monthKey, out var pr))
                    {
                        pr = new DepartmentMonthlySalesPivotRowDto
                        {
                            Year      = year,
                            Month     = month,
                            MonthName = (month >= 1 && month <= 12) ? monthNames[month - 1] : month.ToString(ci),
                            MonthKey  = monthKey,
                        };
                        rowsByMonth[monthKey] = pr;
                    }

                    if (!pr.Cells.TryGetValue(colKey, out var cell))
                    {
                        cell = new DepartmentMonthlySalesPivotCellDto();
                        pr.Cells[colKey] = cell;
                    }
                    cell.Qty    += r.Qty;
                    cell.Amount += r.Total;

                    if (!totalsByCol.TryGetValue(colKey, out var dt))
                    {
                        dt = new DepartmentMonthlySalesPivotCellDto();
                        totalsByCol[colKey] = dt;
                    }
                    dt.Qty    += r.Qty;
                    dt.Amount += r.Total;

                    grandQty    += r.Qty;
                    grandAmount += r.Total;
                }

                // Columns ordered Department asc, Store asc — keeps the Dept super-group spans
                // contiguous when the frontend renders the 3-level header.
                var orderedColumns = columnMap.Values
                    .OrderBy(c => c.DepartmentName, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(c => c.StoreName, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                // Rows ordered Year asc, Month asc (frontend can flip).
                var orderedRows = rowsByMonth.Values
                    .OrderBy(p => p.Year)
                    .ThenBy(p => p.Month)
                    .ToList();

                return ApiResponseFactory.Success(new DepartmentMonthlySalesPivotResponseDto
                {
                    Columns = orderedColumns,
                    Rows    = orderedRows,
                    Totals  = new DepartmentMonthlySalesPivotTotalsDto
                    {
                        ByColumn = totalsByCol,
                        Grand    = new DepartmentMonthlySalesPivotCellDto { Qty = grandQty, Amount = grandAmount },
                    },
                    TotalRecords = orderedRows.Count,
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DepartmentMonthlySalesPivotResponseDto>($"Failed to generate Department Monthly Sales pivot: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Department Weekly Sales report: aggregated sales per department and week within a date range.
        /// Uses SP_DepartmentWeeklySales with a desktop-compatible Filter string (EndSaleTime + StoreID).
        /// </summary>
        public async Task<ApiResponse<DepartmentWeeklySalesResponseDto>> GetDepartmentWeeklySalesReportAsync(DepartmentWeeklySalesRequestDto request)
        {
            try
            {
                request ??= new DepartmentWeeklySalesRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;

                var from = fromDate.Date;
                var to = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var (rows, totalRecords, totalQty, totalAmount) = await GetDepartmentWeeklySalesFromSpAsync(from, to, storeId, pageNumber, pageSize).ConfigureAwait(false);

                var response = new DepartmentWeeklySalesResponseDto
                {
                    Data = rows,
                    TotalRecords = totalRecords,
                    TotalQty = totalQty,
                    TotalAmount = totalAmount
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DepartmentWeeklySalesResponseDto>($"Failed to generate Department Weekly Sales report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Department Monthly Sales report: aggregated sales per department and month within a date range.
        /// Uses SP_DepartmentMonthlySales with a desktop-compatible Filter string (EndSaleTime + StoreID).
        /// </summary>
        public async Task<ApiResponse<DepartmentMonthlySalesResponseDto>> GetDepartmentMonthlySalesReportAsync(DepartmentMonthlySalesRequestDto request)
        {
            try
            {
                request ??= new DepartmentMonthlySalesRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-365);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;

                var from = fromDate.Date;
                var to = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var (rows, totalRecords, totalQty, totalAmount) = await GetDepartmentMonthlySalesFromSpAsync(from, to, storeId, pageNumber, pageSize).ConfigureAwait(false);

                var response = new DepartmentMonthlySalesResponseDto
                {
                    Data = rows,
                    TotalRecords = totalRecords,
                    TotalQty = totalQty,
                    TotalAmount = totalAmount
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DepartmentMonthlySalesResponseDto>($"Failed to generate Department Monthly Sales report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Total Daily Sales report: total sales per day within a date range.
        /// Uses Rpt_TotalSalesDaily with a desktop-compatible Filter string (EndSaleTime + StoreID).
        /// </summary>
        public async Task<ApiResponse<TotalDailySalesResponseDto>> GetTotalDailySalesReportAsync(TotalDailySalesRequestDto request)
        {
            try
            {
                request ??= new TotalDailySalesRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;

                var from = fromDate.Date;
                var to = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                Guid? departmentId = request.DepartmentId;
                if (departmentId.HasValue && departmentId.Value == Guid.Empty)
                    departmentId = null;

                var ci = CultureInfo.InvariantCulture;
                var fromDateStr = from.ToString("yyyy-MM-dd", ci);
                var toExclusiveStr = to.AddDays(1).ToString("yyyy-MM-dd", ci);

                // Follow the same pattern as PriceChangeHistory / desktop:
                // first predicate on [Date], then optional StoreNo/DepartmentID filters.
                var filter = " AND [EndSaleTime]>='" + fromDateStr + "'";
                filter += " And [EndSaleTime]<'" + toExclusiveStr + "'";
                if (storeId.HasValue && storeId.Value != Guid.Empty)
                    filter += BuildPriceChangeInFilter("StoreID", new[] { storeId.Value.ToString() });
                if (departmentId.HasValue && departmentId.Value != Guid.Empty)
                    filter += BuildPriceChangeInFilter("DepartmentID", new[] { departmentId.Value.ToString() });

                // Advanced "Filters" dialog (Item / Supplier / Customer tabs) → EXISTS
                // subqueries on @Filter. The SP's inner query aliases TransactionEntry as E
                // and [Transaction] as T, so item/supplier correlate to E.ItemStoreID and
                // customer to T.CustomerID.
                filter += BuildItemsRepFilterExists("E",
                    request.ItemIds, request.ItemDepartmentIds, request.ManufacturerIds,
                    request.ItemTypes, request.ItemGroupIds, request.SupplierIds,
                    request.IsDiscount, request.IsTaxable, request.IsFoodStampable, request.IsWic);
                filter += BuildCustomerRepFilterExists("T",
                    request.FilterCustomerIds, request.CustomerTypes, request.CustomerGroupIds,
                    request.PriceLevels, request.Zips, request.DiscountIds, request.Taxable);

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var rows = new List<TotalDailySalesRowDto>();
                int totalRecords = 0;
                decimal totalAmount = 0m;
                long totalTrans = 0;

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "[dbo].[Web_Rpt_TotalSalesDaily]";
                    cmd.CommandType = CommandType.StoredProcedure;

                    AddStringParam((DbCommand)cmd, "Filter", filter);
                    AddBoolParam((DbCommand)cmd, "IncludeDiscount", false);
                    AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                    AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                    using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
                    var oDate  = OrdOf(reader, "Date");
                    var oTotal = OrdOf(reader, "Total");
                    var oTrans = OrdOf(reader, "Trans");
                    var oAvg   = OrdOf(reader, "AvgSale");
                    var oTRec  = OrdOf(reader, "TotalRecords");
                    var oGAmt  = OrdOf(reader, "GrandTotalAmount");
                    var oGTrans = OrdOf(reader, "GrandTotalTransactions");

                    while (await reader.ReadAsync())
                    {
                        var dateStr = ReadStr(reader, oDate);
                        DateTime parsedDate;
                        if (!DateTime.TryParse(dateStr, out parsedDate)) parsedDate = from;
                        rows.Add(new TotalDailySalesRowDto
                        {
                            Date    = parsedDate,
                            Total   = ReadDec(reader, oTotal),
                            Trans   = ReadInt(reader, oTrans),
                            AvgSale = ReadDec(reader, oAvg)
                        });
                        if (totalRecords == 0) totalRecords = ReadInt(reader, oTRec);
                        if (totalAmount == 0m) totalAmount = ReadDec(reader, oGAmt);
                        if (totalTrans == 0) totalTrans = oGTrans >= 0 && !reader.IsDBNull(oGTrans) ? Convert.ToInt64(reader.GetValue(oGTrans)) : 0;
                    }
                }

                var response = new TotalDailySalesResponseDto
                {
                    Data = rows,
                    TotalRecords = totalRecords,
                    TotalAmount = totalAmount,
                    TotalTransactions = (int)totalTrans,
                    AverageSale = totalTrans > 0 ? totalAmount / totalTrans : 0m
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TotalDailySalesResponseDto>($"Failed to generate Total Daily Sales report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Total Weekly Sales report: total sales per week within a date range.
        /// Uses Rpt_TotalSalesWeekly with a desktop-compatible Filter string (EndSaleTime + StoreNo/DepartmentID).
        /// </summary>
        public async Task<ApiResponse<TotalWeeklySalesResponseDto>> GetTotalWeeklySalesReportAsync(TotalWeeklySalesRequestDto request)
        {
            try
            {
                request ??= new TotalWeeklySalesRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-90);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;

                var from = fromDate.Date;
                var to = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                Guid? departmentId = request.DepartmentId;
                if (departmentId.HasValue && departmentId.Value == Guid.Empty)
                    departmentId = null;

                var ci = CultureInfo.InvariantCulture;
                var fromDateStr = from.ToString("yyyy-MM-dd", ci);
                var toExclusiveStr = to.AddDays(1).ToString("yyyy-MM-dd", ci);

                var filter = " AND [EndSaleTime]>='" + fromDateStr + "'";
                filter += " And [EndSaleTime]<'" + toExclusiveStr + "'";
                if (storeId.HasValue && storeId.Value != Guid.Empty)
                    filter += BuildPriceChangeInFilter("StoreID", new[] { storeId.Value.ToString() });
                if (departmentId.HasValue && departmentId.Value != Guid.Empty)
                    filter += BuildPriceChangeInFilter("DepartmentID", new[] { departmentId.Value.ToString() });

                // Advanced "Filters" dialog → EXISTS subqueries on @Filter. Weekly SP's
                // inner query aliases TransactionEntry as E and [Transaction] as T.
                filter += BuildItemsRepFilterExists("E",
                    request.ItemIds, request.ItemDepartmentIds, request.ManufacturerIds,
                    request.ItemTypes, request.ItemGroupIds, request.SupplierIds,
                    request.IsDiscount, request.IsTaxable, request.IsFoodStampable, request.IsWic);
                filter += BuildCustomerRepFilterExists("T",
                    request.FilterCustomerIds, request.CustomerTypes, request.CustomerGroupIds,
                    request.PriceLevels, request.Zips, request.DiscountIds, request.Taxable);

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var rows = new List<TotalWeeklySalesRowDto>();
                int totalRecords = 0;
                decimal totalAmount = 0m;
                long totalTrans = 0;

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "[dbo].[Web_Rpt_TotalSalesWeekly]";
                    cmd.CommandType = CommandType.StoredProcedure;
                    AddStringParam((DbCommand)cmd, "Filter", filter);
                    AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                    AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                    using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
                    var oDate  = OrdOf(reader, "Date");
                    var oTotal = OrdOf(reader, "Total");
                    var oTrans = OrdOf(reader, "Trans");
                    var oAvg   = OrdOf(reader, "AvgSale");
                    var oTRec  = OrdOf(reader, "TotalRecords");
                    var oGAmt  = OrdOf(reader, "GrandTotalAmount");
                    var oGTrans = OrdOf(reader, "GrandTotalTransactions");

                    while (await reader.ReadAsync())
                    {
                        rows.Add(new TotalWeeklySalesRowDto
                        {
                            WeekStartDate = ReadDate(reader, oDate) ?? from,
                            Total   = ReadDec(reader, oTotal),
                            Trans   = ReadInt(reader, oTrans),
                            AvgSale = ReadDec(reader, oAvg)
                        });
                        if (totalRecords == 0) totalRecords = ReadInt(reader, oTRec);
                        if (totalAmount == 0m) totalAmount = ReadDec(reader, oGAmt);
                        if (totalTrans == 0) totalTrans = oGTrans >= 0 && !reader.IsDBNull(oGTrans) ? Convert.ToInt64(reader.GetValue(oGTrans)) : 0;
                    }
                }

                var response = new TotalWeeklySalesResponseDto
                {
                    Data = rows,
                    TotalRecords = totalRecords,
                    TotalAmount = totalAmount,
                    TotalTransactions = (int)totalTrans,
                    AverageSale = totalTrans > 0 ? totalAmount / totalTrans : 0m
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TotalWeeklySalesResponseDto>($"Failed to generate Total Weekly Sales report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Total Monthly Sales report: total sales per month within a date range.
        /// Uses Rpt_TotalSalesMonthly with a desktop-compatible Filter string (EndSaleTime + StoreNo/DepartmentID).
        /// </summary>
        public async Task<ApiResponse<TotalMonthlySalesResponseDto>> GetTotalMonthlySalesReportAsync(TotalMonthlySalesRequestDto request)
        {
            try
            {
                request ??= new TotalMonthlySalesRequestDto();

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddYears(-1);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;

                var from = fromDate.Date;
                var to = toDate.Date;

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                Guid? departmentId = request.DepartmentId;
                if (departmentId.HasValue && departmentId.Value == Guid.Empty)
                    departmentId = null;

                var ci = CultureInfo.InvariantCulture;
                var fromDateStr = from.ToString("yyyy-MM-dd", ci);
                var toExclusiveStr = to.AddDays(1).ToString("yyyy-MM-dd", ci);

                // Match desktop style filter on EndSaleTime, with optional StoreNo/DepartmentID
                var filter = " AND EndSaleTime >='" + fromDateStr + "'";
                filter += " And EndSaleTime <'" + toExclusiveStr + "'";
                if (storeId.HasValue && storeId.Value != Guid.Empty)
                    filter += BuildPriceChangeInFilter("StoreID", new[] { storeId.Value.ToString() });
                if (departmentId.HasValue && departmentId.Value != Guid.Empty)
                    filter += BuildPriceChangeInFilter("DepartmentID", new[] { departmentId.Value.ToString() });

                // Advanced "Filters" dialog → EXISTS subqueries on @Filter. The Monthly SP's
                // inner query is grounded on (unaliased) TransactionEntryItem (which carries
                // both ItemStoreID and CustomerID), so correlate to that. The SP's
                // REPLACE(@Filter,'EndSaleTime',…) doesn't touch these clauses (no EndSaleTime).
                filter += BuildItemsRepFilterExists("TransactionEntryItem",
                    request.ItemIds, request.ItemDepartmentIds, request.ManufacturerIds,
                    request.ItemTypes, request.ItemGroupIds, request.SupplierIds,
                    request.IsDiscount, request.IsTaxable, request.IsFoodStampable, request.IsWic);
                filter += BuildCustomerRepFilterExists("TransactionEntryItem",
                    request.FilterCustomerIds, request.CustomerTypes, request.CustomerGroupIds,
                    request.PriceLevels, request.Zips, request.DiscountIds, request.Taxable);

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var rows = new List<TotalMonthlySalesRowDto>();
                int totalRecords = 0;
                decimal totalAmount = 0m;
                long totalTrans = 0;

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "[dbo].[Web_Rpt_TotalSalesMonthly]";
                    cmd.CommandType = CommandType.StoredProcedure;
                    AddStringParam((DbCommand)cmd, "Filter", filter);
                    AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                    AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                    using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
                    var oDate  = OrdOf(reader, "Date");
                    var oTotal = OrdOf(reader, "Total");
                    var oTrans = OrdOf(reader, "Trans");
                    var oAvg   = OrdOf(reader, "AvgSale");
                    var oYr    = OrdOf(reader, "Yr");
                    var oMt    = OrdOf(reader, "Mt");
                    var oTRec  = OrdOf(reader, "TotalRecords");
                    var oGAmt  = OrdOf(reader, "GrandTotalAmount");
                    var oGTrans = OrdOf(reader, "GrandTotalTransactions");

                    while (await reader.ReadAsync())
                    {
                        DateTime monthStart;
                        var dt = ReadDate(reader, oDate);
                        if (dt.HasValue) monthStart = dt.Value.Date;
                        else if (oYr >= 0 && !reader.IsDBNull(oYr) && oMt >= 0 && !reader.IsDBNull(oMt))
                            monthStart = new DateTime(Convert.ToInt32(reader.GetValue(oYr)), Convert.ToInt32(reader.GetValue(oMt)), 1);
                        else monthStart = new DateTime(from.Year, from.Month, 1);

                        rows.Add(new TotalMonthlySalesRowDto
                        {
                            MonthStartDate = monthStart,
                            Year    = monthStart.Year,
                            Month   = monthStart.Month,
                            Total   = ReadDec(reader, oTotal),
                            Trans   = ReadInt(reader, oTrans),
                            AvgSale = ReadDec(reader, oAvg)
                        });
                        if (totalRecords == 0) totalRecords = ReadInt(reader, oTRec);
                        if (totalAmount == 0m) totalAmount = ReadDec(reader, oGAmt);
                        if (totalTrans == 0) totalTrans = oGTrans >= 0 && !reader.IsDBNull(oGTrans) ? Convert.ToInt64(reader.GetValue(oGTrans)) : 0;
                    }
                }

                var response = new TotalMonthlySalesResponseDto
                {
                    Data = rows,
                    TotalRecords = totalRecords,
                    TotalAmount = totalAmount,
                    TotalTransactions = (int)totalTrans,
                    AverageSale = totalTrans > 0 ? totalAmount / totalTrans : 0m
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TotalMonthlySalesResponseDto>($"Failed to generate Total Monthly Sales report: {ex.Message}");
            }
        }

        /// <summary>
        /// Calls [dbo].[SP_ItemsDailySales] using a filter string like:
        ///  And EndSaleTime&gt;='2009-01-01' And EndSaleTime&lt;'2014-01-02' And StoreID In('guid')
        /// and maps a subset of columns into ItemDailySalesRowDto for the web grid.
        /// </summary>
        private async Task<(List<ItemDailySalesRowDto> items, int totalRecords, decimal totalQty, decimal totalAmount)> GetItemDailySalesFromSpAsync(DateTime from, DateTime to, Guid? storeId, int pageNumber, int pageSize)
        {
            var ci = CultureInfo.InvariantCulture;
            var fromDateStr = from.Date.ToString("yyyy-MM-dd", ci);
            var toExclusiveStr = to.Date.AddDays(1).ToString("yyyy-MM-dd", ci);

            var filterParts = new List<string>();
            filterParts.Add($" And EndSaleTime>='{fromDateStr}' And EndSaleTime<'{toExclusiveStr}' ");
            if (storeId.HasValue && storeId.Value != Guid.Empty)
                filterParts.Add($" And StoreID In('{storeId.Value}' ) ");

            var filter = string.Join("", filterParts);
            const string itemFilter = "";
            const string customerFilter = "";
            const string tableName = "TransactionEntryItem";

            var results = new List<ItemDailySalesRowDto>();
            int total = 0;
            decimal grandQty = 0m, grandAmount = 0m;

            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_SP_ItemsDailySales]";
                cmd.CommandType = CommandType.StoredProcedure;

                AddStringParam((DbCommand)cmd, "Filter", filter);
                AddStringParam((DbCommand)cmd, "ItemFilter", itemFilter);
                AddStringParam((DbCommand)cmd, "CustomerFilter", customerFilter);
                AddStringParam((DbCommand)cmd, "TableName", tableName);
                AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                {
                    int Ord(string n) => OrdOf(reader, n);
                    var ordSaleDate = Ord("DayOfYear");
                    if (ordSaleDate == -1) ordSaleDate = Ord("SaleDate");
                    if (ordSaleDate == -1) ordSaleDate = Ord("StartSaleTime");
                    var ordItem = Ord("ItemName");
                    if (ordItem == -1) ordItem = Ord("Name");
                    var ordBarcode = Ord("BarcodeNumber");
                    var ordDept = Ord("Department");
                    var ordDeptId = Ord("DepartmentID");
                    // Web_SP_ItemsDailySales exposes the master ItemID as `ItemNo`. We read it
                    // here so pivot drill-downs can query transactions for that specific item
                    // without doing a second lookup. ordItemId stays -1 for any SP variant that
                    // doesn't return it (we just leave ItemID null).
                    var ordItemId = Ord("ItemNo");
                    if (ordItemId == -1) ordItemId = Ord("ItemID");
                    var ordQty = Ord("Qty");
                    var ordTotal = Ord("ExtPrice");
                    if (ordTotal == -1) ordTotal = Ord("Total");
                    var ordTRec = Ord("TotalRecords");
                    var ordGQty = Ord("GrandTotalQty");
                    var ordGAmt = Ord("GrandTotalAmount");

                    while (await reader.ReadAsync())
                    {
                        var saleDate = ReadDate(reader, ordSaleDate) ?? from;
                        var qty = ReadDec(reader, ordQty);
                        var totalVal = ReadDec(reader, ordTotal);
                        results.Add(new ItemDailySalesRowDto
                        {
                            SaleDate      = saleDate.Date,
                            ItemName      = ReadStr(reader, ordItem),
                            BarcodeNumber = ReadStr(reader, ordBarcode),
                            Department    = ReadStr(reader, ordDept),
                            DepartmentID  = ordDeptId >= 0 && !reader.IsDBNull(ordDeptId) ? reader.GetGuid(ordDeptId) : (Guid?)null,
                            ItemID        = ordItemId >= 0 && !reader.IsDBNull(ordItemId) ? reader.GetGuid(ordItemId) : (Guid?)null,
                            Qty           = qty,
                            Total         = totalVal,
                            AveragePrice  = qty != 0m ? totalVal / qty : 0m
                        });
                        if (total == 0) total = ReadInt(reader, ordTRec);
                        if (grandQty == 0m) grandQty = ReadDec(reader, ordGQty);
                        if (grandAmount == 0m) grandAmount = ReadDec(reader, ordGAmt);
                    }
                }
            }

            return (results, total, grandQty, grandAmount);
        }

        /// <summary>
        /// Calls [dbo].[SP_ItemsWeeklySales] using a filter string like:
        ///  And EndSaleTime&gt;='2009-01-01' And EndSaleTime&lt;'2014-01-02' And StoreID In('guid')
        /// and maps a subset of columns into ItemWeeklySalesRowDto for the web grid.
        /// </summary>
        private async Task<(List<ItemWeeklySalesRowDto> items, int totalRecords, decimal totalQty, decimal totalAmount)> GetItemWeeklySalesFromSpAsync(DateTime from, DateTime to, Guid? storeId, int pageNumber, int pageSize)
        {
            var ci = CultureInfo.InvariantCulture;
            var fromDateStr = from.Date.ToString("yyyy-MM-dd", ci);
            var toExclusiveStr = to.Date.AddDays(1).ToString("yyyy-MM-dd", ci);
            var effectiveStoreId = (storeId.HasValue && storeId.Value != Guid.Empty) ? storeId.Value : Guid.Empty;

            var filterParts = new List<string>();
            filterParts.Add($" And EndSaleTime>='{fromDateStr}' And EndSaleTime<'{toExclusiveStr}' ");
            if (storeId.HasValue && storeId.Value != Guid.Empty)
                filterParts.Add($" And StoreID In('{storeId.Value}' ) ");

            var filter = string.Join("", filterParts);
            var results = new List<ItemWeeklySalesRowDto>();
            int total = 0;
            decimal grandQty = 0m, grandAmount = 0m;

            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_SP_ItemsWeeklySales]";
                cmd.CommandType = CommandType.StoredProcedure;

                AddStringParam((DbCommand)cmd, "Filter", filter);
                AddGuidParam((DbCommand)cmd, "StoreID", effectiveStoreId);
                AddStringParam((DbCommand)cmd, "ItemFilter", "");
                AddStringParam((DbCommand)cmd, "CustomerFilter", "");
                AddStringParam((DbCommand)cmd, "TableName", "TransactionEntryItem");
                AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                {
                    var ordDept = OrdOf(reader, "Department");
                    var ordItem = OrdOf(reader, "ItemName"); if (ordItem == -1) ordItem = OrdOf(reader, "Name");
                    var ordBarcode = OrdOf(reader, "BarcodeNumber");
                    var ordQty = OrdOf(reader, "Qty");
                    var ordTotal = OrdOf(reader, "ExtPrice"); if (ordTotal == -1) ordTotal = OrdOf(reader, "Total");
                    var ordWeekStart = OrdOf(reader, "WeekNumber"); if (ordWeekStart == -1) ordWeekStart = OrdOf(reader, "WeekStartDate"); if (ordWeekStart == -1) ordWeekStart = OrdOf(reader, "SaleDate");
                    var ordTRec = OrdOf(reader, "TotalRecords");
                    var ordGQty = OrdOf(reader, "GrandTotalQty");
                    var ordGAmt = OrdOf(reader, "GrandTotalAmount");

                    while (await reader.ReadAsync())
                    {
                        var qty = ReadDec(reader, ordQty);
                        var totalVal = ReadDec(reader, ordTotal);
                        results.Add(new ItemWeeklySalesRowDto
                        {
                            WeekStartDate = ReadDate(reader, ordWeekStart) ?? from,
                            ItemName      = ReadStr(reader, ordItem),
                            BarcodeNumber = ReadStr(reader, ordBarcode),
                            Department    = ReadStr(reader, ordDept),
                            Qty           = qty,
                            Total         = totalVal,
                            AveragePrice  = qty != 0m ? totalVal / qty : 0m
                        });
                        if (total == 0) total = ReadInt(reader, ordTRec);
                        if (grandQty == 0m) grandQty = ReadDec(reader, ordGQty);
                        if (grandAmount == 0m) grandAmount = ReadDec(reader, ordGAmt);
                    }
                }
            }

            return (results, total, grandQty, grandAmount);
        }

        /// <summary>
        /// Calls [dbo].[SP_ItemsMonthlySales] using a filter string like:
        ///  And EndSaleTime&gt;='2009-01-01' And EndSaleTime&lt;'2014-01-02' And StoreID In('guid')
        /// and maps a subset of columns into ItemMonthlySalesRowDto for the web grid.
        /// </summary>
        private async Task<(List<ItemMonthlySalesRowDto> items, int totalRecords, decimal totalQty, decimal totalAmount)> GetItemMonthlySalesFromSpAsync(DateTime from, DateTime to, Guid? storeId, int pageNumber, int pageSize)
        {
            var ci = CultureInfo.InvariantCulture;
            var fromDateStr = from.Date.ToString("yyyy-MM-dd", ci);
            var toExclusiveStr = to.Date.AddDays(1).ToString("yyyy-MM-dd", ci);

            var filterParts = new List<string>();
            filterParts.Add($" And EndSaleTime>='{fromDateStr}' And EndSaleTime<'{toExclusiveStr}' ");
            if (storeId.HasValue && storeId.Value != Guid.Empty)
                filterParts.Add($" And StoreID In('{storeId.Value}' ) ");

            var filter = string.Join("", filterParts);
            var results = new List<ItemMonthlySalesRowDto>();
            int total = 0;
            decimal grandQty = 0m, grandAmount = 0m;

            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_SP_ItemsMonthlySales]";
                cmd.CommandType = CommandType.StoredProcedure;

                AddStringParam((DbCommand)cmd, "Filter", filter);
                AddStringParam((DbCommand)cmd, "ItemFilter", "");
                AddStringParam((DbCommand)cmd, "CustomerFilter", "");
                AddStringParam((DbCommand)cmd, "TableName", "TransactionEntryItem");
                AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                {
                    var ordDept = OrdOf(reader, "Department");
                    var ordItem = OrdOf(reader, "ItemName"); if (ordItem == -1) ordItem = OrdOf(reader, "Name");
                    var ordBarcode = OrdOf(reader, "UPC"); if (ordBarcode == -1) ordBarcode = OrdOf(reader, "BarcodeNumber");
                    var ordQty = OrdOf(reader, "Qty");
                    var ordTotal = OrdOf(reader, "ExtPrice"); if (ordTotal == -1) ordTotal = OrdOf(reader, "Total");
                    var ordMonth = OrdOf(reader, "MonthName"); if (ordMonth == -1) ordMonth = OrdOf(reader, "MonthStartDate");
                    var ordTRec = OrdOf(reader, "TotalRecords");
                    var ordGQty = OrdOf(reader, "GrandTotalQty");
                    var ordGAmt = OrdOf(reader, "GrandTotalAmount");

                    while (await reader.ReadAsync())
                    {
                        var monthStart = ReadDate(reader, ordMonth) ?? from;
                        var qty = ReadDec(reader, ordQty);
                        var totalVal = ReadDec(reader, ordTotal);
                        results.Add(new ItemMonthlySalesRowDto
                        {
                            MonthStartDate = monthStart,
                            Year           = monthStart.Year,
                            MonthName      = monthStart.ToString("MMMM", CultureInfo.InvariantCulture),
                            ItemName       = ReadStr(reader, ordItem),
                            BarcodeNumber  = ReadStr(reader, ordBarcode),
                            Department     = ReadStr(reader, ordDept),
                            Qty            = qty,
                            Total          = totalVal,
                            AveragePrice   = qty != 0m ? totalVal / qty : 0m
                        });
                        if (total == 0) total = ReadInt(reader, ordTRec);
                        if (grandQty == 0m) grandQty = ReadDec(reader, ordGQty);
                        if (grandAmount == 0m) grandAmount = ReadDec(reader, ordGAmt);
                    }
                }
            }

            return (results, total, grandQty, grandAmount);
        }

        /// <summary>
        /// Calls [dbo].[SP_DepartmentsDailySales] using a filter string like:
        ///  And EndSaleTime&gt;='2009-01-01' And EndSaleTime&lt;'2014-01-02' And StoreID In('guid')
        /// and maps a subset of columns into DepartmentDailySalesRowDto for the web grid.
        /// </summary>
        private async Task<(List<DepartmentDailySalesRowDto> items, int totalRecords, decimal totalQty, decimal totalAmount)> GetDepartmentDailySalesFromSpAsync(DateTime from, DateTime to, Guid? storeId, int pageNumber, int pageSize)
        {
            var ci = CultureInfo.InvariantCulture;
            var fromDateStr = from.Date.ToString("yyyy-MM-dd", ci);
            var toExclusiveStr = to.Date.AddDays(1).ToString("yyyy-MM-dd", ci);

            var filterParts = new List<string>();
            filterParts.Add($" And EndSaleTime>='{fromDateStr}' And EndSaleTime<'{toExclusiveStr}' ");
            if (storeId.HasValue && storeId.Value != Guid.Empty)
                filterParts.Add($" And StoreID In('{storeId.Value}' ) ");

            var filter = string.Join("", filterParts);
            var results = new List<DepartmentDailySalesRowDto>();
            int total = 0;
            decimal grandQty = 0m, grandAmount = 0m;

            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_SP_DepartmentsDailySales]";
                cmd.CommandType = CommandType.StoredProcedure;

                AddStringParam((DbCommand)cmd, "Filter", filter);
                AddStringParam((DbCommand)cmd, "ItemFilter", "");
                AddStringParam((DbCommand)cmd, "CustomerFilter", "");
                AddStringParam((DbCommand)cmd, "TableName", "TransactionEntryItem");
                AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                {
                    var ordSaleDate = OrdOf(reader, "DayOfYear"); if (ordSaleDate == -1) ordSaleDate = OrdOf(reader, "SaleDate");
                    var ordStoreId = OrdOf(reader, "StoreID");
                    var ordStoreName = OrdOf(reader, "StoreName");
                    var ordDept = OrdOf(reader, "Department");
                    var ordDeptId = OrdOf(reader, "DepartmentID");
                    var ordQty = OrdOf(reader, "Qty");
                    var ordTotal = OrdOf(reader, "ExtPrice"); if (ordTotal == -1) ordTotal = OrdOf(reader, "Total");
                    var ordTRec = OrdOf(reader, "TotalRecords");
                    var ordGQty = OrdOf(reader, "GrandTotalQty");
                    var ordGAmt = OrdOf(reader, "GrandTotalAmount");

                    while (await reader.ReadAsync())
                    {
                        results.Add(new DepartmentDailySalesRowDto
                        {
                            SaleDate     = (ReadDate(reader, ordSaleDate) ?? from).Date,
                            StoreID      = ordStoreId >= 0 && !reader.IsDBNull(ordStoreId) ? reader.GetGuid(ordStoreId) : (Guid?)null,
                            StoreName    = ReadStr(reader, ordStoreName),
                            Department   = ReadStr(reader, ordDept),
                            DepartmentID = ordDeptId >= 0 && !reader.IsDBNull(ordDeptId) ? reader.GetGuid(ordDeptId) : (Guid?)null,
                            Qty          = ReadDec(reader, ordQty),
                            Total        = ReadDec(reader, ordTotal),
                        });
                        if (total == 0) total = ReadInt(reader, ordTRec);
                        if (grandQty == 0m) grandQty = ReadDec(reader, ordGQty);
                        if (grandAmount == 0m) grandAmount = ReadDec(reader, ordGAmt);
                    }
                }
            }

            return (results, total, grandQty, grandAmount);
        }

        /// <summary>
        /// Calls [dbo].[SP_DepartmentWeeklySales] using a filter string like:
        ///  And EndSaleTime&gt;='2009-01-01' And EndSaleTime&lt;'2014-01-02' And StoreID In('guid')
        /// and maps a subset of columns into DepartmentWeeklySalesRowDto for the web grid.
        /// </summary>
        private async Task<(List<DepartmentWeeklySalesRowDto> items, int totalRecords, decimal totalQty, decimal totalAmount)> GetDepartmentWeeklySalesFromSpAsync(DateTime from, DateTime to, Guid? storeId, int pageNumber, int pageSize)
        {
            var ci = CultureInfo.InvariantCulture;
            var fromDateStr = from.Date.ToString("yyyy-MM-dd", ci);
            var toExclusiveStr = to.Date.AddDays(1).ToString("yyyy-MM-dd", ci);
            var effectiveStoreId = (storeId.HasValue && storeId.Value != Guid.Empty) ? storeId.Value : Guid.Empty;

            var filterParts = new List<string>();
            filterParts.Add($" And EndSaleTime>='{fromDateStr}' And EndSaleTime<'{toExclusiveStr}' ");
            if (storeId.HasValue && storeId.Value != Guid.Empty)
                filterParts.Add($" And StoreID In('{storeId.Value}' ) ");

            var filter = string.Join("", filterParts);
            var results = new List<DepartmentWeeklySalesRowDto>();
            int total = 0;
            decimal grandQty = 0m, grandAmount = 0m;

            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_SP_DepartmentWeeklySales]";
                cmd.CommandType = CommandType.StoredProcedure;

                AddStringParam((DbCommand)cmd, "Filter", filter);
                AddStringParam((DbCommand)cmd, "ItemFilter", "");
                AddStringParam((DbCommand)cmd, "CustomerFilter", "");
                AddGuidParam((DbCommand)cmd, "StoreID", effectiveStoreId);
                AddStringParam((DbCommand)cmd, "TableName", "TransactionEntryItem");
                AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                {
                    var ordWeek = OrdOf(reader, "WeekNumber"); if (ordWeek == -1) ordWeek = OrdOf(reader, "SaleDate");
                    var ordStoreId = OrdOf(reader, "StoreID");
                    var ordStoreName = OrdOf(reader, "StoreName");
                    var ordDept = OrdOf(reader, "Department");
                    var ordDeptId = OrdOf(reader, "DepartmentID");
                    var ordQty = OrdOf(reader, "Qty");
                    var ordTotal = OrdOf(reader, "ExtPrice"); if (ordTotal == -1) ordTotal = OrdOf(reader, "Total");
                    var ordTRec = OrdOf(reader, "TotalRecords");
                    var ordGQty = OrdOf(reader, "GrandTotalQty");
                    var ordGAmt = OrdOf(reader, "GrandTotalAmount");

                    while (await reader.ReadAsync())
                    {
                        results.Add(new DepartmentWeeklySalesRowDto
                        {
                            WeekStartDate = (ReadDate(reader, ordWeek) ?? from).Date,
                            StoreID       = ordStoreId >= 0 && !reader.IsDBNull(ordStoreId) ? reader.GetGuid(ordStoreId) : (Guid?)null,
                            StoreName     = ReadStr(reader, ordStoreName),
                            Department    = ReadStr(reader, ordDept),
                            DepartmentID  = ordDeptId >= 0 && !reader.IsDBNull(ordDeptId) ? reader.GetGuid(ordDeptId) : (Guid?)null,
                            Qty           = ReadDec(reader, ordQty),
                            Total         = ReadDec(reader, ordTotal),
                        });
                        if (total == 0) total = ReadInt(reader, ordTRec);
                        if (grandQty == 0m) grandQty = ReadDec(reader, ordGQty);
                        if (grandAmount == 0m) grandAmount = ReadDec(reader, ordGAmt);
                    }
                }
            }

            return (results, total, grandQty, grandAmount);
        }

        /// <summary>
        /// Calls [dbo].[SP_DepartmentMonthlySales] using a filter string like:
        ///  And EndSaleTime&gt;='2009-01-01' And EndSaleTime&lt;'2014-01-02' And StoreID In('guid')
        /// and maps a subset of columns into DepartmentMonthlySalesRowDto for the web grid.
        /// </summary>
        private async Task<(List<DepartmentMonthlySalesRowDto> items, int totalRecords, decimal totalQty, decimal totalAmount)> GetDepartmentMonthlySalesFromSpAsync(DateTime from, DateTime to, Guid? storeId, int pageNumber, int pageSize)
        {
            var ci = CultureInfo.InvariantCulture;
            var fromDateStr = from.Date.ToString("yyyy-MM-dd", ci);
            var toExclusiveStr = to.Date.AddDays(1).ToString("yyyy-MM-dd", ci);

            var filterParts = new List<string>();
            filterParts.Add($" And EndSaleTime>='{fromDateStr}' And EndSaleTime<'{toExclusiveStr}' ");
            if (storeId.HasValue && storeId.Value != Guid.Empty)
                filterParts.Add($" And StoreID In('{storeId.Value}' ) ");

            var filter = string.Join("", filterParts);
            var results = new List<DepartmentMonthlySalesRowDto>();
            int total = 0;
            decimal grandQty = 0m, grandAmount = 0m;

            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_SP_DepartmentMonthlySales]";
                cmd.CommandType = CommandType.StoredProcedure;

                AddStringParam((DbCommand)cmd, "Filter", filter);
                AddStringParam((DbCommand)cmd, "ItemFilter", "");
                AddStringParam((DbCommand)cmd, "CustomerFilter", "");
                AddStringParam((DbCommand)cmd, "TableName", "TransactionEntryItem");
                AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                {
                    var ordMonth = OrdOf(reader, "MonthName"); if (ordMonth == -1) ordMonth = OrdOf(reader, "MonthStartDate");
                    var ordStoreId = OrdOf(reader, "StoreID");
                    var ordStoreName = OrdOf(reader, "StoreName");
                    var ordDept = OrdOf(reader, "Department");
                    var ordDeptId = OrdOf(reader, "DepartmentID");
                    var ordQty = OrdOf(reader, "Qty");
                    var ordTotal = OrdOf(reader, "ExtPrice"); if (ordTotal == -1) ordTotal = OrdOf(reader, "Total");
                    var ordTRec = OrdOf(reader, "TotalRecords");
                    var ordGQty = OrdOf(reader, "GrandTotalQty");
                    var ordGAmt = OrdOf(reader, "GrandTotalAmount");

                    while (await reader.ReadAsync())
                    {
                        var monthDate = (ReadDate(reader, ordMonth) ?? from).Date;
                        results.Add(new DepartmentMonthlySalesRowDto
                        {
                            MonthStartDate = monthDate,
                            Year           = monthDate.Year,
                            MonthName      = monthDate.ToString("MMMM", CultureInfo.InvariantCulture),
                            StoreID        = ordStoreId >= 0 && !reader.IsDBNull(ordStoreId) ? reader.GetGuid(ordStoreId) : (Guid?)null,
                            StoreName      = ReadStr(reader, ordStoreName),
                            Department     = ReadStr(reader, ordDept),
                            DepartmentID   = ordDeptId >= 0 && !reader.IsDBNull(ordDeptId) ? reader.GetGuid(ordDeptId) : (Guid?)null,
                            Qty            = ReadDec(reader, ordQty),
                            Total          = ReadDec(reader, ordTotal),
                        });
                        if (total == 0) total = ReadInt(reader, ordTRec);
                        if (grandQty == 0m) grandQty = ReadDec(reader, ordGQty);
                        if (grandAmount == 0m) grandAmount = ReadDec(reader, ordGAmt);
                    }
                }
            }

            return (results, total, grandQty, grandAmount);
        }

        /// <summary>
        /// Gets Action Summary report: aggregated POS actions by date, cashier, and action within a date range and optional store.
        /// Uses SP_GetActionByDate without filters and applies date/store filtering in-memory.
        /// </summary>
        public async Task<ApiResponse<ActionSummaryResponseDto>> GetActionSummaryReportAsync(ActionSummaryRequestDto request)
        {
            try
            {
                request ??= new ActionSummaryRequestDto();

                var fromDate = (request.FromDate ?? DateTime.Today.AddDays(-30)).Date;
                var toDate   = (request.ToDate ?? DateTime.Today).Date.AddDays(1);

                var filterParts = new List<string>();
                // Desktop parity: when a specific BatchID is supplied the date range is ignored,
                // so the user can pull every action belonging to that batch even if it spans days.
                if (request.BatchId.HasValue && request.BatchId.Value != Guid.Empty)
                {
                    filterParts.Add($" AND Batch.BatchID = '{request.BatchId.Value}' ");
                }
                else
                {
                    filterParts.Add($" AND Actions.ActionDate >= '{fromDate:yyyy-MM-dd}' AND Actions.ActionDate < '{toDate:yyyy-MM-dd}' ");
                }
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    filterParts.Add($" AND Store.StoreID = '{request.StoreId.Value}' ");
                if (request.ActionType.HasValue)
                    filterParts.Add($" AND Actions.ActionType = {request.ActionType.Value} ");
                if (request.RegisterId.HasValue && request.RegisterId.Value != Guid.Empty)
                    filterParts.Add($" AND Actions.RegisterID = '{request.RegisterId.Value}' ");
                if (request.CashierId.HasValue && request.CashierId.Value != Guid.Empty)
                    filterParts.Add($" AND Batch.CashierID = '{request.CashierId.Value}' ");
                if (request.ApproveById.HasValue && request.ApproveById.Value != Guid.Empty)
                    filterParts.Add($" AND Actions.UserID = '{request.ApproveById.Value}' ");
                var filter = string.Join("", filterParts);

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var rows = new List<ActionSummaryRowDto>();
                int totalRecords = 0;
                long totalTimes = 0;

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "[dbo].[Web_SP_GetActionByDate]";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.CommandTimeout = 120;

                    AddParam((DbCommand)cmd, "Filter", filter, DbType.String);
                    AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                    AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                    using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
                    var oStoreId  = OrdOf(reader, "StoreID");
                    var oStore    = OrdOf(reader, "StoreName");
                    var oDate     = OrdOf(reader, "ActionDate");
                    var oAction   = OrdOf(reader, "Action");
                    var oCashier  = OrdOf(reader, "Cashier");
                    var oTimes    = OrdOf(reader, "Times");
                    var oBatchNo  = OrdOf(reader, "BatchNumber");
                    var oBatchId  = OrdOf(reader, "BatchID");
                    var oCashId   = OrdOf(reader, "CashierID");
                    var oActType  = OrdOf(reader, "ActionType");
                    var oTRec     = OrdOf(reader, "TotalRecords");
                    var oGTimes   = OrdOf(reader, "GrandTotalTimes");

                    while (await reader.ReadAsync())
                    {
                        rows.Add(new ActionSummaryRowDto
                        {
                            StoreId     = oStoreId >= 0 && !reader.IsDBNull(oStoreId) ? reader.GetGuid(oStoreId) : (Guid?)null,
                            StoreName   = ReadStr(reader, oStore),
                            ActionDate  = ReadStr(reader, oDate),
                            Action      = ReadStr(reader, oAction),
                            Times       = ReadInt(reader, oTimes),
                            Cashier     = ReadStr(reader, oCashier),
                            BatchNumber = ReadStr(reader, oBatchNo),
                            BatchId     = oBatchId >= 0 && !reader.IsDBNull(oBatchId) ? reader.GetGuid(oBatchId) : (Guid?)null,
                            CashierId   = oCashId  >= 0 && !reader.IsDBNull(oCashId)  ? reader.GetGuid(oCashId)  : (Guid?)null,
                            ActionType  = oActType >= 0 && !reader.IsDBNull(oActType) ? Convert.ToInt32(reader.GetValue(oActType)) : (int?)null
                        });
                        if (totalRecords == 0) totalRecords = ReadInt(reader, oTRec);
                        if (totalTimes == 0)   totalTimes   = oGTimes >= 0 && !reader.IsDBNull(oGTimes) ? Convert.ToInt64(reader.GetValue(oGTimes)) : 0;
                    }
                }

                // Dropdown options are populated only on the first page; subsequent paginated
                // requests skip the round-trips and the UI keeps the values cached from page 1.
                //
                // Desktop parity (RepActionSummary.Init):
                //   LuCashier.DataSource   = DsSecurity.Users         -> ALL active users (Status > -1)
                //   LuUsers.DataSource     = DsSecurity.Users         -> ALL active users (same list)
                //   LuRegisters.DataSource = DsSecurity.Registers     -> ALL registers
                //   LuBatch.DataSource     = FillBatchesBetweenDayes  -> batches in the date window
                //
                // So Cashier + Approve By come from the Users table (Status > -1, matching SP_GetUsersView),
                // Registers from the Registers table, and Batch is scoped to the active filter (which is
                // already date-bounded at the top of this method).
                var cashiers     = new List<string>();
                var actions      = new List<string>();
                var batchNumbers = new List<string>();
                var batchOptions     = new List<ActionLookupOption>();
                var registerOptions  = new List<ActionLookupOption>();
                var cashierOptions   = new List<ActionLookupOption>();
                var approveOptions   = new List<ActionLookupOption>();
                if (request.StartRow == 0)
                {
                    // 1) Distinct strings + batch-id list scoped to the current report filter.
                    if (rows.Count > 0)
                    {
                        var distinctSql = @"
                            SELECT DISTINCT
                                   Batch.BatchID                    AS BatchID,
                                   Batch.BatchNumber                AS BatchNumber,
                                   UPPER(Users.UserName)            AS CashierName,
                                   SystemValues.SystemValueName     AS Action
                            FROM   Actions
                            INNER JOIN Batch        ON Batch.BatchID            = Actions.BatchID
                            LEFT  JOIN Store        ON Store.StoreID            = Batch.StoreID
                            LEFT  JOIN Users        ON Users.UserId             = Batch.CashierID
                            LEFT  JOIN SystemValues ON SystemValues.SystemValueNo = Actions.ActionType
                                                   AND SystemValues.SystemTableNo = 27
                            WHERE  (1 = 1) " + filter;

                        using var cmd2 = conn.CreateCommand();
                        cmd2.CommandText = distinctSql;
                        cmd2.CommandType = CommandType.Text;
                        cmd2.CommandTimeout = 120;

                        var cashierSet  = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        var actionSet   = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        var batchSet    = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        var batchById   = new Dictionary<Guid, string>();

                        using var r2 = await ((DbCommand)cmd2).ExecuteReaderAsync();
                        var oBId = OrdOf(r2, "BatchID");
                        var oBNo = OrdOf(r2, "BatchNumber");
                        var oCNm = OrdOf(r2, "CashierName");
                        var oAct = OrdOf(r2, "Action");
                        while (await r2.ReadAsync())
                        {
                            var batchNo = ReadStr(r2, oBNo).Trim();
                            var cashNm  = ReadStr(r2, oCNm).Trim();
                            var actNm   = ReadStr(r2, oAct).Trim();

                            if (!string.IsNullOrEmpty(cashNm))  cashierSet.Add(cashNm);
                            if (!string.IsNullOrEmpty(actNm))   actionSet.Add(actNm);
                            if (!string.IsNullOrEmpty(batchNo)) batchSet.Add(batchNo);
                            if (oBId >= 0 && !r2.IsDBNull(oBId) && !string.IsNullOrEmpty(batchNo))
                                batchById[r2.GetGuid(oBId)] = batchNo;
                        }

                        cashiers     = cashierSet.OrderBy(s => s, StringComparer.OrdinalIgnoreCase).ToList();
                        actions      = actionSet .OrderBy(s => s, StringComparer.OrdinalIgnoreCase).ToList();
                        batchNumbers = batchSet  .OrderBy(s => s, StringComparer.OrdinalIgnoreCase).ToList();
                        batchOptions = batchById.Select(kv => new ActionLookupOption { Id = kv.Key.ToString(), Name = kv.Value })
                                                .OrderBy(o => o.Name, StringComparer.OrdinalIgnoreCase).ToList();
                    }

                    // 2) ALL active users — desktop binds both Cashier and Approve By to the same
                    //    SP_GetUsersView (Status > -1) list, regardless of the report filter.
                    var users = new List<ActionLookupOption>();
                    using (var cmdU = conn.CreateCommand())
                    {
                        cmdU.CommandText = @"SELECT UserId, UPPER(UserName) AS UserName
                                             FROM   Users
                                             WHERE  Status > -1
                                             ORDER  BY UserName";
                        cmdU.CommandType = CommandType.Text;
                        cmdU.CommandTimeout = 60;
                        using var ru = await ((DbCommand)cmdU).ExecuteReaderAsync();
                        var oUId = OrdOf(ru, "UserId");
                        var oUNm = OrdOf(ru, "UserName");
                        while (await ru.ReadAsync())
                        {
                            if (oUId < 0 || ru.IsDBNull(oUId)) continue;
                            var name = ReadStr(ru, oUNm).Trim();
                            if (string.IsNullOrEmpty(name)) continue;
                            users.Add(new ActionLookupOption { Id = ru.GetGuid(oUId).ToString(), Name = name });
                        }
                    }
                    cashierOptions = users;
                    approveOptions = users; // same source as desktop

                    // 3) ALL registers — desktop binds to DsSecurity.Registers (full table).
                    using (var cmdR = conn.CreateCommand())
                    {
                        cmdR.CommandText = @"SELECT RegisterID, CompName FROM Registers ORDER BY CompName";
                        cmdR.CommandType = CommandType.Text;
                        cmdR.CommandTimeout = 60;
                        using var rr = await ((DbCommand)cmdR).ExecuteReaderAsync();
                        var oRId = OrdOf(rr, "RegisterID");
                        var oRNm = OrdOf(rr, "CompName");
                        while (await rr.ReadAsync())
                        {
                            if (oRId < 0 || rr.IsDBNull(oRId)) continue;
                            var name = ReadStr(rr, oRNm).Trim();
                            if (string.IsNullOrEmpty(name)) continue;
                            registerOptions.Add(new ActionLookupOption { Id = rr.GetGuid(oRId).ToString(), Name = name });
                        }
                    }
                }

                var response = new ActionSummaryResponseDto
                {
                    Data             = rows,
                    TotalRecords     = totalRecords,
                    TotalTimes       = (int)totalTimes,
                    Cashiers         = cashiers,
                    Actions          = actions,
                    BatchNumbers     = batchNumbers,
                    BatchOptions     = batchOptions,
                    RegisterOptions  = registerOptions,
                    CashierOptions   = cashierOptions,
                    ApproveByOptions = approveOptions
                };
                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ActionSummaryResponseDto>($"Failed to generate Action Summary report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Action Details report: detailed POS actions from SP_GetActionDetailsByDate within a date range and optional store.
        /// Calls SP with empty filter and applies date/store filtering in-memory.
        /// </summary>
        public async Task<ApiResponse<ActionDetailsResponseDto>> GetActionDetailsReportAsync(ActionDetailsRequestDto request)
        {
            try
            {
                request ??= new ActionDetailsRequestDto();

                var fromDate = (request.FromDate ?? DateTime.Today.AddDays(-30)).Date;
                var toDate   = (request.ToDate ?? DateTime.Today).Date.AddDays(1);

                var filterParts = new List<string>();
                // Desktop drill-down passes a BatchID; when present we scope by batch (which already
                // implies a date) instead of restricting by transaction time.
                if (request.BatchId.HasValue && request.BatchId.Value != Guid.Empty)
                {
                    filterParts.Add($" AND Batch.BatchID = '{request.BatchId.Value}' ");
                }
                else
                {
                    filterParts.Add($" AND [Transaction].StartSaleTime >= '{fromDate:yyyy-MM-dd}' AND [Transaction].StartSaleTime < '{toDate:yyyy-MM-dd}' ");
                }
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    filterParts.Add($" AND Store.StoreID = '{request.StoreId.Value}' ");
                if (request.CashierId.HasValue && request.CashierId.Value != Guid.Empty)
                    filterParts.Add($" AND Batch.CashierID = '{request.CashierId.Value}' ");
                if (request.ActionType.HasValue)
                    filterParts.Add($" AND Actions.ActionType = {request.ActionType.Value} ");
                if (request.RegisterId.HasValue && request.RegisterId.Value != Guid.Empty)
                    filterParts.Add($" AND Actions.RegisterID = '{request.RegisterId.Value}' ");
                if (request.ApproveById.HasValue && request.ApproveById.Value != Guid.Empty)
                    filterParts.Add($" AND Actions.UserID = '{request.ApproveById.Value}' ");
                var filter = string.Join("", filterParts);

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var rows = new List<ActionDetailsRowDto>();
                int totalRecords = 0;

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "[dbo].[Web_SP_GetActionDetailsByDate]";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.CommandTimeout = 120;

                    AddParam((DbCommand)cmd, "Filter", filter, DbType.String);
                    AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                    AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                    using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
                    var oAction   = OrdOf(reader, "Action");
                    var oDate     = OrdOf(reader, "TranDate");
                    var oTransNo  = OrdOf(reader, "TransactionNo");
                    var oRegister = OrdOf(reader, "Register");
                    var oUserName = OrdOf(reader, "ApproveUserName");
                    var oAmount   = OrdOf(reader, "Amount");
                    var oInfo     = OrdOf(reader, "Info");
                    var oTRec     = OrdOf(reader, "TotalRecords");

                    while (await reader.ReadAsync())
                    {
                        rows.Add(new ActionDetailsRowDto
                        {
                            Action        = ReadStr(reader, oAction),
                            TranDate      = ReadDate(reader, oDate),
                            TransactionNo = ReadStr(reader, oTransNo),
                            Register      = ReadStr(reader, oRegister),
                            ApproveBy     = ReadStr(reader, oUserName),
                            Amount        = oAmount >= 0 && !reader.IsDBNull(oAmount) ? Convert.ToDecimal(reader.GetValue(oAmount)) : (decimal?)null,
                            Info          = ReadStr(reader, oInfo)
                        });
                        if (totalRecords == 0) totalRecords = ReadInt(reader, oTRec);
                    }
                }

                // Dropdown options follow the same rules as Action Summary (desktop parity):
                //   Cashier + Approve By  -> Users table (Status > -1), same list for both
                //   Register              -> Registers table (full list)
                //   Batch                 -> distinct batches in the current filter window
                // First page only — subsequent paginated requests return empty arrays so the UI
                // keeps the page-1 values cached.
                var batchOptions    = new List<ActionLookupOption>();
                var registerOptions = new List<ActionLookupOption>();
                var cashierOptions  = new List<ActionLookupOption>();
                var approveOptions  = new List<ActionLookupOption>();
                if (request.StartRow == 0)
                {
                    // Batches scoped to the current Action Details filter (so the dropdown only
                    // surfaces batches the user could actually drill into right now).
                    if (rows.Count > 0)
                    {
                        var batchSql = @"
                            SELECT DISTINCT Batch.BatchID AS BatchID, Batch.BatchNumber AS BatchNumber
                            FROM   Actions
                            LEFT  JOIN [Transaction] ON [Transaction].TransactionID = Actions.TransactionID
                            LEFT  JOIN Batch         ON Batch.BatchID               = Actions.BatchID
                            LEFT  JOIN Store         ON Store.StoreID               = Batch.StoreID
                            WHERE  (1 = 1) " + filter;

                        using var cmdB = conn.CreateCommand();
                        cmdB.CommandText = batchSql;
                        cmdB.CommandType = CommandType.Text;
                        cmdB.CommandTimeout = 120;
                        using var rb = await ((DbCommand)cmdB).ExecuteReaderAsync();
                        var oBId = OrdOf(rb, "BatchID");
                        var oBNo = OrdOf(rb, "BatchNumber");
                        var seen = new HashSet<Guid>();
                        while (await rb.ReadAsync())
                        {
                            if (oBId < 0 || rb.IsDBNull(oBId)) continue;
                            var id = rb.GetGuid(oBId);
                            if (!seen.Add(id)) continue;
                            var name = ReadStr(rb, oBNo).Trim();
                            if (string.IsNullOrEmpty(name)) continue;
                            batchOptions.Add(new ActionLookupOption { Id = id.ToString(), Name = name });
                        }
                        batchOptions = batchOptions.OrderBy(o => o.Name, StringComparer.OrdinalIgnoreCase).ToList();
                    }

                    // All active users — bound to both Cashier and Approve By (desktop parity).
                    var users = new List<ActionLookupOption>();
                    using (var cmdU = conn.CreateCommand())
                    {
                        cmdU.CommandText = @"SELECT UserId, UPPER(UserName) AS UserName
                                             FROM   Users
                                             WHERE  Status > -1
                                             ORDER  BY UserName";
                        cmdU.CommandType = CommandType.Text;
                        cmdU.CommandTimeout = 60;
                        using var ru = await ((DbCommand)cmdU).ExecuteReaderAsync();
                        var oUId = OrdOf(ru, "UserId");
                        var oUNm = OrdOf(ru, "UserName");
                        while (await ru.ReadAsync())
                        {
                            if (oUId < 0 || ru.IsDBNull(oUId)) continue;
                            var name = ReadStr(ru, oUNm).Trim();
                            if (string.IsNullOrEmpty(name)) continue;
                            users.Add(new ActionLookupOption { Id = ru.GetGuid(oUId).ToString(), Name = name });
                        }
                    }
                    cashierOptions = users;
                    approveOptions = users;

                    // All registers — desktop binds to DsSecurity.Registers (full table).
                    using (var cmdR = conn.CreateCommand())
                    {
                        cmdR.CommandText = @"SELECT RegisterID, CompName FROM Registers ORDER BY CompName";
                        cmdR.CommandType = CommandType.Text;
                        cmdR.CommandTimeout = 60;
                        using var rr = await ((DbCommand)cmdR).ExecuteReaderAsync();
                        var oRId = OrdOf(rr, "RegisterID");
                        var oRNm = OrdOf(rr, "CompName");
                        while (await rr.ReadAsync())
                        {
                            if (oRId < 0 || rr.IsDBNull(oRId)) continue;
                            var name = ReadStr(rr, oRNm).Trim();
                            if (string.IsNullOrEmpty(name)) continue;
                            registerOptions.Add(new ActionLookupOption { Id = rr.GetGuid(oRId).ToString(), Name = name });
                        }
                    }
                }

                return ApiResponseFactory.Success(new ActionDetailsResponseDto
                {
                    Data             = rows,
                    TotalRecords     = totalRecords,
                    BatchOptions     = batchOptions,
                    RegisterOptions  = registerOptions,
                    CashierOptions   = cashierOptions,
                    ApproveByOptions = approveOptions
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ActionDetailsResponseDto>($"Failed to generate Action Details report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Summary report: store/day totals from Get_SummaryReport SP within a date range and optional store.
        /// Do not change this method — it is used by other APIs (e.g. Summary report endpoint). For transaction-level sales summary use GetSalesSummaryByTransactionReportAsync.
        /// </summary>
        public async Task<ApiResponse<SummaryReportResponseDto>> GetSummaryReportAsync(SummaryReportRequestDto request)
        {
            try
            {
                request ??= new SummaryReportRequestDto();
                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;
                if (toDate.Date == toDate && toDate.TimeOfDay == TimeSpan.Zero)
                    toDate = toDate.AddDays(1).AddSeconds(-1);
                Guid? storeId = null;
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    storeId = request.StoreId.Value;

                var loadAllChecks = request.LoadAllChecks ?? true;

                // Customer-tab Filters dialog selections → @CustomerFilter (SP builds a
                // #CustomerSelect and scopes the customer/transaction-grounded totals to
                // those customers; payouts have no customer link and stay unscoped).
                var customerFilter = BuildCustomerRepFilterSql(
                    request.FilterCustomerIds, request.CustomerTypes, request.CustomerGroupIds,
                    request.PriceLevels, request.Zips, request.DiscountIds, request.Taxable);

                var raw = await GetSummaryReportRawFromSpAsync(fromDate, toDate, storeId, loadAllChecks, customerFilter);
                var data = raw.Select(r => new SummaryReportRowDto { Label = r.Label, Value = r.Value }).ToList();

                return ApiResponseFactory.Success(new SummaryReportResponseDto
                {
                    Data = data,
                    TotalRecords = data.Count
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<SummaryReportResponseDto>($"Failed to generate Summary report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Sales Summary By Transaction report (desktop RepSalesProfit.vb). Uses [dbo].[SP_GetSalesProfit] with filter and customerFilter.
        /// </summary>
        public async Task<ApiResponse<SalesSummaryByTransactionResponseDto>> GetSalesSummaryByTransactionReportAsync(SalesSummaryByTransactionRequestDto request)
        {
            try
            {
                request ??= new SalesSummaryByTransactionRequestDto();
                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;
                var fromTime = ParseTime(request.FromTime) ?? TimeSpan.Zero;
                var toTime = ParseTime(request.ToTime) ?? new TimeSpan(23, 59, 59);
                var from = fromDate.Date.Add(fromTime);
                var to = toDate.Date.Add(toTime);
                if (to.Date == to && to.TimeOfDay == TimeSpan.Zero)
                    to = to.AddSeconds(-1);

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var (data, totalRecords) = await GetSalesSummaryByTransactionDataAsync(
                    from,
                    to,
                    storeId,
                    request.CustomerFilter,
                    request.UserFilter,
                    request.OnlyRegister ?? false,
                    pageNumber,
                    pageSize
                ).ConfigureAwait(false);

                return ApiResponseFactory.Success(new SalesSummaryByTransactionResponseDto
                {
                    Data = data,
                    TotalRecords = totalRecords
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<SalesSummaryByTransactionResponseDto>($"Failed to generate Sales Summary By Transaction report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Sales Summary By Item report (desktop clone). Uses [dbo].[SP_GetItemSummary] with date range and store filter only.
        /// </summary>
        public async Task<ApiResponse<SalesSummaryByItemResponseDto>> GetSalesSummaryByItemReportAsync(SalesSummaryByItemRequestDto request)
        {
            try
            {
                request ??= new SalesSummaryByItemRequestDto();
                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;
                var fromTime = ParseTime(request.FromTime) ?? TimeSpan.Zero;
                var toTime = ParseTime(request.ToTime) ?? new TimeSpan(23, 59, 59);
                var from = fromDate.Date.Add(fromTime);
                var to = toDate.Date.Add(toTime);
                if (to.Date == to && to.TimeOfDay == TimeSpan.Zero) to = to.AddSeconds(-1);

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty) storeId = null;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                Guid? departmentId = request.DepartmentId;
                if (departmentId.HasValue && departmentId.Value == Guid.Empty) departmentId = null;

                var (data, totalRecords) = await GetSalesSummaryByItemDataAsync(from, to, storeId, departmentId, pageNumber, pageSize).ConfigureAwait(false);

                // Mirrors desktop RepItemSalesSummary form-load reads:
                //   DBSetUp.Gate.GetOptionValue("CustomField1".."CustomField10", StoreID)
                //   DBSetUp.Gate.GetOptionValue(STR_PartNumberCaption / ManufacturerCaption / StyleNoCaption)
                //   GlobalDataAccess.EncDateRow.StoreType == StoreType.Apparel
                // Only run on the first page — page-2+ requests reuse the cached values on the UI.
                var captions = new Dictionary<string, string>(StringComparer.Ordinal);
                var isApparel = false;
                if (request.StartRow == 0)
                {
                    var optionNames = new[]
                    {
                        "CustomField1","CustomField2","CustomField3","CustomField4","CustomField5",
                        "CustomField6","CustomField7","CustomField8","CustomField9","CustomField10",
                        "PartNumberCaption","ManufacturerCaption","StyleNoCaption","Fashion"
                    };
                    var options = await _dbContext.SetUpValuesViews.AsNoTracking()
                        .Where(o => optionNames.Contains(o.OptionName))
                        .Where(o => !storeId.HasValue || o.StoreID == storeId.Value || o.StoreID == Guid.Empty)
                        .Select(o => new { o.OptionName, o.OptionValue, o.StoreID })
                        .ToListAsync().ConfigureAwait(false);

                    // Prefer the store-scoped row when both a store-specific and Guid.Empty row exist.
                    foreach (var name in optionNames)
                    {
                        var match = options.FirstOrDefault(o => o.OptionName == name && storeId.HasValue && o.StoreID == storeId.Value)
                                 ?? options.FirstOrDefault(o => o.OptionName == name);
                        if (match != null && !string.IsNullOrEmpty(match.OptionValue))
                        {
                            if (name == "Fashion")
                                isApparel = match.OptionValue == "1" || match.OptionValue.Equals("true", StringComparison.OrdinalIgnoreCase);
                            else
                                captions[name] = match.OptionValue;
                        }
                    }
                }

                return ApiResponseFactory.Success(new SalesSummaryByItemResponseDto
                {
                    Data = data,
                    TotalRecords = totalRecords,
                    OptionCaptions = captions,
                    IsApparel = isApparel
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<SalesSummaryByItemResponseDto>($"Failed to generate Sales Summary By Item report: {ex.Message}");
            }
        }

        /// <summary>
        /// Drill-down for Sales Summary By Item — returns per-transaction sales lines for one
        /// item. Mirrors the desktop's RepItemSalesSummary -&gt; RepSalesDetails flow but uses
        /// the simpler [dbo].[SP_GetTransactionEntryItem] @ItemStoreID = ... entry point.
        /// </summary>
        public async Task<ApiResponse<SalesSummaryByItemDetailsResponseDto>> GetSalesSummaryByItemDetailsAsync(SalesSummaryByItemDetailsRequestDto request)
        {
            try
            {
                request ??= new SalesSummaryByItemDetailsRequestDto();
                // Desktop parity: RepItemsSpecialsSummary opens RepSalesDetails for every row,
                // including rows like "[MANUAL ITEM]" whose ItemStoreID is Guid.Empty — the SP
                // simply returns no transactions for those, and the user sees an empty grid.
                // We follow the same convention: accept Guid.Empty + missing values and let the
                // SP do the work; only short-circuit when truly nothing was supplied.
                var itemStoreId = request.ItemStoreId ?? Guid.Empty;
                if (itemStoreId == Guid.Empty)
                {
                    return ApiResponseFactory.Success(new SalesSummaryByItemDetailsResponseDto
                    {
                        Data = new List<SalesSummaryByItemDetailsRowDto>(),
                        TotalRecords = 0,
                        TotalQty = 0,
                        TotalAmount = 0,
                    });
                }

                var spRows = await _dbContext.Procedures.SP_GetTransactionEntryItemAsync(itemStoreId);

                var rows = spRows
                    .Where(r => r.Status > 0) // mirror the desktop's Status > 0 transaction filter
                    .Select(r => new SalesSummaryByItemDetailsRowDto
                    {
                        TransactionNo = r.TransactionNo ?? string.Empty,
                        TransactionType = r.TransactionType,
                        TransactionId = r.TransactionID,
                        StartSaleTime = r.StartSaleTime,
                        ItemStoreId = r.ItemStoreID,
                        Qty = r.Qty,
                        Total = r.Total,
                        Price = r.Price,
                        Status = r.Status
                    })
                    .OrderByDescending(r => r.StartSaleTime)
                    .ToList();

                return ApiResponseFactory.Success(new SalesSummaryByItemDetailsResponseDto
                {
                    Data = rows,
                    TotalRecords = rows.Count,
                    TotalQty = rows.Sum(r => r.Qty ?? 0m),
                    TotalAmount = rows.Sum(r => r.Total ?? 0m)
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<SalesSummaryByItemDetailsResponseDto>($"Failed to load Sales Summary By Item drill-down: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Sales Summary By Department report using [dbo].[SP_GetDepartmentSummary] with date range and store filter only.
        /// </summary>
        public async Task<ApiResponse<SalesSummaryByDepartmentResponseDto>> GetSalesSummaryByDepartmentReportAsync(SalesSummaryByDepartmentRequestDto request)
        {
            try
            {
                request ??= new SalesSummaryByDepartmentRequestDto();
                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;
                var fromTime = ParseTime(request.FromTime) ?? TimeSpan.Zero;
                var toTime = ParseTime(request.ToTime) ?? new TimeSpan(23, 59, 59);
                var from = fromDate.Date.Add(fromTime);
                var to = toDate.Date.Add(toTime);
                if (to.Date == to && to.TimeOfDay == TimeSpan.Zero) to = to.AddSeconds(-1);

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty) storeId = null;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var (data, totalRecords) = await GetSalesSummaryByDepartmentDataAsync(from, to, storeId, pageNumber, pageSize).ConfigureAwait(false);

                return ApiResponseFactory.Success(new SalesSummaryByDepartmentResponseDto
                {
                    Data = data,
                    TotalRecords = totalRecords
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<SalesSummaryByDepartmentResponseDto>($"Failed to generate Sales Summary By Department report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets department rows for Sales Summary By Department from [dbo].[SP_GetDepartmentSummary]. Uses raw reader; SP column order may vary (Department, DepartmentID, StoreName, StoreID, Qty, Total, Cost, Profit).
        /// </summary>
        private async Task<(List<SalesSummaryByDepartmentRowDto> items, int totalRecords)> GetSalesSummaryByDepartmentDataAsync(
            DateTime from,
            DateTime to,
            Guid? storeId,
            int pageNumber,
            int pageSize)
        {
            var ci = CultureInfo.InvariantCulture;
            var fromDateStr = from.Date.ToString("yyyy-MM-dd", ci);
            var toExclusiveStr = to.Date.AddDays(1).ToString("yyyy-MM-dd", ci);

            var filterParts = new List<string>();
            filterParts.Add($" And EndSaleTime>='{fromDateStr}' And EndSaleTime<'{toExclusiveStr}' ");
            if (storeId.HasValue && storeId.Value != Guid.Empty)
                filterParts.Add($" And StoreID In('{storeId.Value}' ) ");

            var filter = string.Join("", filterParts);
            return await GetDepartmentSummaryWithFilterPagedAsync(filter, pageNumber, pageSize).ConfigureAwait(false);
        }

        /// <summary>
        /// Executes [dbo].[Web_SP_GetDepartmentSummary] with the given filter string + pagination, returning rows for one page plus TotalRecords.
        /// </summary>
        private async Task<(List<SalesSummaryByDepartmentRowDto> items, int totalRecords)> GetDepartmentSummaryWithFilterPagedAsync(string filter, int pageNumber, int pageSize)
        {
            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            var results = new List<SalesSummaryByDepartmentRowDto>();
            int total = 0;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_SP_GetDepartmentSummary]";
                cmd.CommandType = CommandType.StoredProcedure;

                AddStringParam((DbCommand)cmd, "Filter", filter);
                AddStringParam((DbCommand)cmd, "ItemFilter", "");
                AddStringParam((DbCommand)cmd, "CustomerFilter", "");
                AddStringParam((DbCommand)cmd, "TableName", "TransactionEntryItem");
                AddBoolParam((DbCommand)cmd, "OldTransaction", false);
                AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                {
                    var oTRec = OrdOf(reader, "TotalRecords");
                    while (await reader.ReadAsync())
                    {
                        results.Add(ReadDepartmentSummaryRowByOrdinal(reader));
                        if (total == 0) total = ReadInt(reader, oTRec);
                    }
                }
            }

            return (results, total);
        }

        /// <summary>Maps SP_GetDepartmentSummary result by column name so binding works regardless of SP column order.</summary>
        private static SalesSummaryByDepartmentRowDto ReadDepartmentSummaryRowByOrdinal(DbDataReader reader)
        {
            return new SalesSummaryByDepartmentRowDto
            {
                DepartmentID = GetReaderGuidByName(reader, "DepartmentID"),
                Department = GetReaderStringByName(reader, "Department"),
                MainDepartment = GetReaderStringByName(reader, "MainDepartment"),
                SubDepartment = GetReaderStringByName(reader, "SubDepartment"),
                SubSubDepartment = GetReaderStringByName(reader, "SubSubDepartment"),
                Qty = GetReaderDecimalByName(reader, "Qty"),
                QtyCase = GetReaderDecimalByName(reader, "QtyCase"),
                ExtCost = GetReaderDecimalByName(reader, "ExtCost"),
                ExtPrice = GetReaderDecimalByName(reader, "ExtPrice"),
                MarginPrice = GetReaderDecimalByName(reader, "MarginPrice"),
                MarkupPrice = GetReaderDecimalByName(reader, "MarkupPrice"),
                Profit = GetReaderDecimalByName(reader, "Profit"),
                TotalAfterDiscount = GetReaderDecimalByName(reader, "TotalAfterDiscount"),
                Discount = GetReaderDecimalByName(reader, "Discount"),
                OnHand = GetReaderDecimalByName(reader, "OnHand"),
                OnOrder = GetReaderDecimalByName(reader, "OnOrder"),
                StoreName = GetReaderStringByName(reader, "StoreName"),
                StoreID = GetReaderGuidByName(reader, "StoreID"),
                SellThru = GetReaderDecimalByName(reader, "SellThru"),
            };
        }

        /// <summary>
        /// Gets Sales Summary By Discount report using [dbo].[SP_GetDiscountSummary] with date range and store filter only.
        /// </summary>
        public async Task<ApiResponse<SalesSummaryByDiscountResponseDto>> GetSalesSummaryByDiscountReportAsync(SalesSummaryByDiscountRequestDto request)
        {
            try
            {
                request ??= new SalesSummaryByDiscountRequestDto();
                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;
                var fromTime = ParseTime(request.FromTime) ?? TimeSpan.Zero;
                var toTime = ParseTime(request.ToTime) ?? new TimeSpan(23, 59, 59);
                var from = fromDate.Date.Add(fromTime);
                var to = toDate.Date.Add(toTime);
                if (to.Date == to && to.TimeOfDay == TimeSpan.Zero) to = to.AddSeconds(-1);

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty) storeId = null;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var activeOnly = request.ActiveOnly == true;
                var (data, totalRecords) = await GetSalesSummaryByDiscountDataAsync(from, to, storeId, activeOnly, pageNumber, pageSize).ConfigureAwait(false);

                return ApiResponseFactory.Success(new SalesSummaryByDiscountResponseDto
                {
                    Data = data,
                    TotalRecords = totalRecords
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<SalesSummaryByDiscountResponseDto>($"Failed to generate Sales Summary By Discount report: {ex.Message}");
            }
        }

        /// <summary>
        /// Drill-down for Sales Summary By Discount — returns each transaction line that used
        /// the supplied discount. Mirrors the desktop's RepDiscountSummary -&gt; RepDiscountDetails
        /// flow which calls `SP_GetTransactionDiscount` with a hand-built filter string of the
        /// form:
        ///   And (dbo.TransactionEntryView.ItemStoreID = '&lt;DiscountID&gt;')
        ///   And EndSaleTime &gt;= '&lt;FromDate&gt;' And EndSaleTime &lt; '&lt;ToDate+1&gt;'
        ///   And StoreID In('&lt;StoreID&gt;')
        /// (The SP's `ItemStoreID` column on TransactionEntryView is the discount-identifier
        /// column — preserving the desktop's exact filter shape.)
        /// </summary>
        public async Task<ApiResponse<SalesSummaryByDiscountDetailsResponseDto>> GetSalesSummaryByDiscountDetailsAsync(SalesSummaryByDiscountDetailsRequestDto request)
        {
            try
            {
                request ??= new SalesSummaryByDiscountDetailsRequestDto();
                if (!request.DiscountId.HasValue)
                {
                    return ApiResponseFactory.BadRequest<SalesSummaryByDiscountDetailsResponseDto>("discountId is required");
                }

                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;
                var ci = CultureInfo.InvariantCulture;
                var fromDateStr = fromDate.Date.ToString("yyyy-MM-dd", ci);
                var toExclusiveStr = toDate.Date.AddDays(1).ToString("yyyy-MM-dd", ci);

                var discountId = request.DiscountId.Value;
                Guid? storeId = (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty) ? request.StoreId : null;

                // Desktop parity: when DiscountId is Guid.Empty we also include nulls.
                var filterParts = new List<string>();
                if (discountId == Guid.Empty)
                    filterParts.Add($" And (dbo.TransactionEntryView.ItemStoreID = '{discountId}' or dbo.TransactionEntryView.ItemStoreID is null) ");
                else
                    filterParts.Add($" And (dbo.TransactionEntryView.ItemStoreID = '{discountId}') ");
                filterParts.Add($" And EndSaleTime >= '{fromDateStr}' And EndSaleTime < '{toExclusiveStr}' ");
                if (storeId.HasValue)
                    filterParts.Add($" And StoreID In('{storeId.Value}') ");

                var filter = string.Join("", filterParts);

                var spRows = await _dbContext.Procedures.SP_GetTransactionDiscountAsync(filter, "");

                var rows = spRows.Select(r => new SalesSummaryByDiscountDetailsRowDto
                {
                    TransactionId       = r.TransactionID,
                    TransactionNo       = r.TransactionNo ?? string.Empty,
                    StartSaleTime       = r.StartSaleTime,
                    CustomerNo          = r.CustomerNo ?? string.Empty,
                    CustomerName        = r.CustomerName ?? string.Empty,
                    TotalBeforeDiscount = r.TotalBeforeDiscount,
                    Discount            = r.Discount,
                    Qty                 = r.Qty,
                    SaleTotal           = r.SaleTotal,
                    SaleTotalWithoutTax = r.SaleTotalWithoutTax,
                    Paid                = r.Paid,
                    StoreId             = r.StoreID
                })
                .OrderByDescending(r => r.StartSaleTime)
                .ToList();

                return ApiResponseFactory.Success(new SalesSummaryByDiscountDetailsResponseDto
                {
                    Data          = rows,
                    TotalRecords  = rows.Count,
                    TotalQty      = rows.Sum(r => r.Qty ?? 0m),
                    TotalDiscount = rows.Sum(r => r.Discount ?? 0m),
                    TotalSale     = rows.Sum(r => r.SaleTotal ?? 0m)
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<SalesSummaryByDiscountDetailsResponseDto>($"Failed to load Sales Summary By Discount drill-down: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets discount rows for Sales Summary By Discount from [dbo].[Web_SP_GetDiscountSummary] with server-side pagination.
        /// </summary>
        private async Task<(List<SalesSummaryByDiscountRowDto> items, int totalRecords)> GetSalesSummaryByDiscountDataAsync(
            DateTime from,
            DateTime to,
            Guid? storeId,
            bool activeOnly,
            int pageNumber,
            int pageSize)
        {
            var ci = CultureInfo.InvariantCulture;
            var fromDateStr = from.Date.ToString("yyyy-MM-dd", ci);
            var toExclusiveStr = to.Date.AddDays(1).ToString("yyyy-MM-dd", ci);

            var filterParts = new List<string>();
            filterParts.Add($" And EndSaleTime>='{fromDateStr}' And EndSaleTime<'{toExclusiveStr}' ");
            if (storeId.HasValue && storeId.Value != Guid.Empty)
                filterParts.Add($" And StoreID In('{storeId.Value}' ) ");
            if (activeOnly)
            {
                // Desktop parity: RepDiscountSummary -> Queries.GetDiscountsSummary appends this exact predicate
                // when "Only Active" is checked. Mirrors the SP's Status='Active' rule so rows whose Discount is
                // not currently effective (StartDate>today or EndDate<today) are dropped, while open-ended
                // discounts (both dates NULL) stay in.
                var todayStr = DateTime.Today.ToString("yyyy-MM-dd", ci);
                filterParts.Add(
                    " AND ((dbo.Discounts.StartDate <= '" + todayStr + "' AND dbo.Discounts.EndDate >= '" + todayStr + "') " +
                    "OR (dbo.Discounts.StartDate is null AND dbo.Discounts.EndDate is null)) ");
            }

            var filter = string.Join("", filterParts);
            var customerFilter = "";

            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            var results = new List<SalesSummaryByDiscountRowDto>();
            int total = 0;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_SP_GetDiscountSummary]";
                cmd.CommandType = CommandType.StoredProcedure;

                AddStringParam((DbCommand)cmd, "Filter", filter);
                AddStringParam((DbCommand)cmd, "CustomerFilter", customerFilter);
                AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                {
                    var oTRec = OrdOf(reader, "TotalRecords");
                    while (await reader.ReadAsync())
                    {
                        results.Add(ReadDiscountSummaryRowByName(reader));
                        if (total == 0) total = ReadInt(reader, oTRec);
                    }
                }
            }

            return (results, total);
        }

        /// <summary>Maps SP_GetDiscountSummary result by column name.</summary>
        private static SalesSummaryByDiscountRowDto ReadDiscountSummaryRowByName(DbDataReader reader)
        {
            return new SalesSummaryByDiscountRowDto
            {
                DiscountID = GetReaderGuidByName(reader, "DiscountID"),
                Name = GetReaderStringByName(reader, "Name"),
                PercentsDiscount = GetReaderDecimalByName(reader, "PercentsDiscount"),
                AmountDiscount = GetReaderDecimalByName(reader, "AmountDiscount"),
                StartDate = GetReaderDateTimeByName(reader, "StartDate"),
                EndDate = GetReaderDateTimeByName(reader, "EndDate"),
                UPCDiscount = GetReaderStringByName(reader, "UPCDiscount"),
                Status = GetReaderStringByName(reader, "Status"),
                CustomersNo = GetReaderInt32ByName(reader, "CustomersNo"),
                TransactionsCount = GetReaderInt32ByName(reader, "TransactionsCount"),
                TotalQty = GetReaderDecimalByName(reader, "TotalQty"),
                TotalBeforeDiscount = GetReaderDecimalByName(reader, "TotalBeforeDiscount"),
                DiscountTotal = GetReaderDecimalByName(reader, "DiscountTotal"),
                SalesTotalWithoutTax = GetReaderDecimalByName(reader, "SalesTotalWithoutTax"),
                SalesTotal = GetReaderDecimalByName(reader, "SalesTotal"),
                StoreID = GetReaderGuidByName(reader, "StoreID"),
                StoreName = GetReaderStringByName(reader, "StoreName"),
            };
        }

        private static DateTime? GetReaderDateTimeByName(DbDataReader reader, string columnName)
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                if (string.Equals(reader.GetName(i), columnName, StringComparison.OrdinalIgnoreCase))
                    return GetReaderDateTime(reader, i);
            }
            return null;
        }

        private static int? GetReaderInt32ByName(DbDataReader reader, string columnName)
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                if (string.Equals(reader.GetName(i), columnName, StringComparison.OrdinalIgnoreCase))
                {
                    if (i < 0 || i >= reader.FieldCount || reader.IsDBNull(i)) return null;
                    try { return reader.GetInt32(i); } catch { return null; }
                }
            }
            return null;
        }

        /// <summary>
        /// Gets Sales Summary By Specials report using [dbo].[Rpt_ItemsInSpecials] with date range and store filter.
        /// </summary>
        public async Task<ApiResponse<SalesSummaryBySpecialsResponseDto>> GetSalesSummaryBySpecialsReportAsync(SalesSummaryBySpecialsRequestDto request)
        {
            try
            {
                request ??= new SalesSummaryBySpecialsRequestDto();
                var fromDate = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var toDate = ParseDate(request.ToDate) ?? DateTime.Today;
                var fromTime = ParseTime(request.FromTime) ?? TimeSpan.Zero;
                var toTime = ParseTime(request.ToTime) ?? new TimeSpan(23, 59, 59);
                var from = fromDate.Date.Add(fromTime);
                var to = toDate.Date.Add(toTime);
                if (to.Date == to && to.TimeOfDay == TimeSpan.Zero)
                    to = to.AddSeconds(-1);

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var (data, totalRecords) = await GetSalesSummaryBySpecialsDataAsync(from, to, storeId, pageNumber, pageSize).ConfigureAwait(false);

                return ApiResponseFactory.Success(new SalesSummaryBySpecialsResponseDto
                {
                    Data = data,
                    TotalRecords = totalRecords
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<SalesSummaryBySpecialsResponseDto>($"Failed to generate Sales Summary By Specials report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets specials rows for Sales Summary By Specials from [dbo].[Web_Rpt_ItemsInSpecials] with server-side pagination.
        /// </summary>
        private async Task<(List<SalesSummaryBySpecialsRowDto> items, int totalRecords)> GetSalesSummaryBySpecialsDataAsync(
            DateTime from,
            DateTime to,
            Guid? storeId,
            int pageNumber,
            int pageSize)
        {
            var ci = CultureInfo.InvariantCulture;
            var fromDateStr = from.Date.ToString("yyyy-MM-dd", ci);
            var toExclusiveStr = to.Date.AddDays(1).ToString("yyyy-MM-dd", ci);

            var filterParts = new List<string>();
            filterParts.Add($" And EndSaleTime>='{fromDateStr}' And EndSaleTime<'{toExclusiveStr}' ");
            if (storeId.HasValue && storeId.Value != Guid.Empty)
                filterParts.Add($" And StoreID In('{storeId.Value}' ) ");

            var filter = string.Join("", filterParts);
            var itemFilter = "";
            var customerFilter = "";

            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            var results = new List<SalesSummaryBySpecialsRowDto>();
            int total = 0;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_Rpt_ItemsInSpecials]";
                cmd.CommandType = CommandType.StoredProcedure;

                AddStringParam((DbCommand)cmd, "Filter", filter);
                AddStringParam((DbCommand)cmd, "ItemFilter", itemFilter);
                AddStringParam((DbCommand)cmd, "CustomerFilter", customerFilter);
                AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                {
                    var oTRec = OrdOf(reader, "TotalRecords");
                    while (await reader.ReadAsync())
                    {
                        results.Add(ReadSpecialsSummaryRowByName(reader));
                        if (total == 0) total = ReadInt(reader, oTRec);
                    }
                }
            }

            return (results, total);
        }

        /// <summary>Maps Rpt_ItemsInSpecials result by column name (various possible column names from SP).</summary>
        private static SalesSummaryBySpecialsRowDto ReadSpecialsSummaryRowByName(DbDataReader reader)
        {
            return new SalesSummaryBySpecialsRowDto
            {
                MainDepartment = GetReaderStringByName(reader, "MainDepartment"),
                SubDepartment = GetReaderStringByName(reader, "SubDepartment"),
                SubSubDepartment = GetReaderStringByName(reader, "SubSubDepartment"),
                Department = GetReaderStringByName(reader, "Department"),
                Name = GetReaderStringByName(reader, "Name") ?? GetReaderStringByName(reader, "ItemName"),
                BarcodeNumber = GetReaderStringByName(reader, "BarcodeNumber"),
                ModalNumber = GetReaderStringByName(reader, "ModalNumber"),
                ItemStoreID = GetReaderGuidByName(reader, "ItemStoreID"),
                ItemID = GetReaderGuidByName(reader, "ItemID"),
                QtyCase = GetReaderDecimalByName(reader, "QtyCase"),
                Qty = GetReaderDecimalByName(reader, "Qty"),
                ExtCost = GetReaderDecimalByName(reader, "ExtCost"),
                ExtSpecialPrice = GetReaderDecimalByName(reader, "ExtSpecialPrice"),
                ExtRegularPrice = GetReaderDecimalByName(reader, "ExtRegularPrice"),
                MarginPrice = GetReaderDecimalByName(reader, "MarginPrice"),
                MarkupPrice = GetReaderDecimalByName(reader, "MarkupPrice"),
                Profit = GetReaderDecimalByName(reader, "Profit"),
                RegularProfit = GetReaderDecimalByName(reader, "RegularProfit"),
                Discount = GetReaderDecimalByName(reader, "Discount"),
                TotalAfterDiscount = GetReaderDecimalByName(reader, "TotalAfterDiscount"),
                StoreID = GetReaderGuidByName(reader, "StoreID"),
                StoreName = GetReaderStringByName(reader, "StoreName"),
                Price = GetReaderDecimalByName(reader, "Price"),
                OnHand = GetReaderDecimalByName(reader, "OnHand"),
                SpecialDeficit = GetReaderDecimalByName(reader, "SpecialDeficit"),
            };
        }

        private static string? GetReaderStringByName(DbDataReader reader, string columnName)
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                if (string.Equals(reader.GetName(i), columnName, StringComparison.OrdinalIgnoreCase))
                    return GetReaderString(reader, i);
            }
            return null;
        }

        private static Guid? GetReaderGuidByName(DbDataReader reader, string columnName)
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                if (string.Equals(reader.GetName(i), columnName, StringComparison.OrdinalIgnoreCase))
                    return GetReaderGuid(reader, i);
            }
            return null;
        }

        private static decimal? GetReaderDecimalByName(DbDataReader reader, string columnName)
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                if (string.Equals(reader.GetName(i), columnName, StringComparison.OrdinalIgnoreCase))
                    return GetReaderDecimal(reader, i);
            }
            return null;
        }

        /// <summary>
        /// Gets Date Comparison report by calling [dbo].[SP_GetDepartmentSummary] twice (one filter per date range), merging results by department, and appending a Total row.
        /// Compares two date ranges at department level: Department Name, Qty 1, Ext Cost 1, Ext Price 1, Qty 2, Ext Cost 2, Ext Price 2.
        /// </summary>
        public async Task<ApiResponse<DateComparisonResponseDto>> GetDateComparisonReportAsync(DateComparisonRequestDto request)
        {
            try
            {
                request ??= new DateComparisonRequestDto();

                var currentFrom = ParseDate(request.FromDate) ?? DateTime.Today.AddDays(-30);
                var currentTo = ParseDate(request.ToDate) ?? DateTime.Today;

                var comparisonFrom = ParseDate(request.ComparisonFromDate);
                var comparisonTo = ParseDate(request.ComparisonToDate);

                if (!comparisonFrom.HasValue || !comparisonTo.HasValue)
                {
                    var spanDays = (currentTo.Date - currentFrom.Date).Days;
                    if (spanDays < 0) spanDays = 0;
                    var compTo = currentFrom.Date.AddDays(-1);
                    var compFrom = compTo.AddDays(-spanDays);
                    comparisonFrom = compFrom;
                    comparisonTo = compTo;
                }

                Guid? storeId = request.StoreId;
                if (storeId.HasValue && storeId.Value == Guid.Empty)
                    storeId = null;

                var ci = CultureInfo.InvariantCulture;
                var from1Str = currentFrom.Date.ToString("yyyy-MM-dd", ci);
                var to1ExclusiveStr = currentTo.Date.AddDays(1).ToString("yyyy-MM-dd", ci);
                var from2Str = comparisonFrom.Value.Date.ToString("yyyy-MM-dd", ci);
                var to2ExclusiveStr = comparisonTo.Value.Date.AddDays(1).ToString("yyyy-MM-dd", ci);

                var filterParts1 = new List<string>();
                filterParts1.Add($" And EndSaleTime>='{from1Str}' And EndSaleTime<'{to1ExclusiveStr}' ");
                if (storeId.HasValue && storeId.Value != Guid.Empty)
                    filterParts1.Add($" And StoreID In('{storeId.Value}' ) ");
                var filter1 = string.Join("", filterParts1);

                var filterParts2 = new List<string>();
                filterParts2.Add($" And EndSaleTime>='{from2Str}' And EndSaleTime<'{to2ExclusiveStr}' ");
                if (storeId.HasValue && storeId.Value != Guid.Empty)
                    filterParts2.Add($" And StoreID In('{storeId.Value}' ) ");
                var filter2 = string.Join("", filterParts2);

                var (data1, _) = await GetDepartmentSummaryWithFilterPagedAsync(filter1, 1, int.MaxValue).ConfigureAwait(false);
                var (data2, _) = await GetDepartmentSummaryWithFilterPagedAsync(filter2, 1, int.MaxValue).ConfigureAwait(false);

                var agg1 = data1
                    .GroupBy(r => r.Department ?? "")
                    .ToDictionary(g => g.Key, g => (Qty: g.Sum(x => x.Qty ?? 0m), ExtCost: g.Sum(x => x.ExtCost ?? 0m), ExtPrice: g.Sum(x => x.ExtPrice ?? 0m)));
                var agg2 = data2
                    .GroupBy(r => r.Department ?? "")
                    .ToDictionary(g => g.Key, g => (Qty: g.Sum(x => x.Qty ?? 0m), ExtCost: g.Sum(x => x.ExtCost ?? 0m), ExtPrice: g.Sum(x => x.ExtPrice ?? 0m)));

                var allDepts = agg1.Keys.Union(agg2.Keys).Where(k => !string.IsNullOrWhiteSpace(k)).OrderBy(k => k).ToList();

                var rows = new List<DateComparisonRowDto>();
                decimal sumQty1 = 0, sumExtCost1 = 0, sumExtPrice1 = 0, sumQty2 = 0, sumExtCost2 = 0, sumExtPrice2 = 0;

                foreach (var dept in allDepts)
                {
                    var p1 = agg1.TryGetValue(dept, out var a1) ? a1 : (Qty: 0m, ExtCost: 0m, ExtPrice: 0m);
                    var p2 = agg2.TryGetValue(dept, out var a2) ? a2 : (Qty: 0m, ExtCost: 0m, ExtPrice: 0m);
                    rows.Add(new DateComparisonRowDto
                    {
                        DepartmentName = dept,
                        Qty1 = p1.Qty,
                        ExtCost1 = p1.ExtCost,
                        ExtPrice1 = p1.ExtPrice,
                        Qty2 = p2.Qty,
                        ExtCost2 = p2.ExtCost,
                        ExtPrice2 = p2.ExtPrice,
                        IsTotalRow = false,
                    });
                    sumQty1 += p1.Qty;
                    sumExtCost1 += p1.ExtCost;
                    sumExtPrice1 += p1.ExtPrice;
                    sumQty2 += p2.Qty;
                    sumExtCost2 += p2.ExtCost;
                    sumExtPrice2 += p2.ExtPrice;
                }

                rows.Add(new DateComparisonRowDto
                {
                    DepartmentName = "Total",
                    Qty1 = sumQty1,
                    ExtCost1 = sumExtCost1,
                    ExtPrice1 = sumExtPrice1,
                    Qty2 = sumQty2,
                    ExtCost2 = sumExtCost2,
                    ExtPrice2 = sumExtPrice2,
                    IsTotalRow = true,
                });

                return ApiResponseFactory.Success(new DateComparisonResponseDto
                {
                    Data = rows,
                    TotalRecords = rows.Count,
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DateComparisonResponseDto>($"Failed to generate Date Comparison report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets item rows for Sales Summary By Item from [dbo].[SP_GetItemSummary].
        /// Uses raw DataReader (by ordinal) because the SP returns two columns named "Groups", which would cause duplicate-key when materializing to entity.
        /// </summary>
        private async Task<(List<SalesSummaryByItemRowDto> items, int totalRecords)> GetSalesSummaryByItemDataAsync(
            DateTime from,
            DateTime to,
            Guid? storeId,
            Guid? departmentId,
            int pageNumber,
            int pageSize)
        {
            var ci = CultureInfo.InvariantCulture;
            var fromDateStr = from.Date.ToString("yyyy-MM-dd", ci);
            var toExclusiveStr = to.Date.AddDays(1).ToString("yyyy-MM-dd", ci);

            var filterParts = new List<string>();
            filterParts.Add($" And EndSaleTime>='{fromDateStr}' And EndSaleTime<'{toExclusiveStr}' ");
            if (storeId.HasValue && storeId.Value != Guid.Empty)
                filterParts.Add($" And StoreID In('{storeId.Value}' ) ");

            var filter = string.Join("", filterParts);

            // Desktop parity: when drilling down from Sales Summary By Department, the desktop
            // calls `BuildDepartmentFilter(Department, "DepartmentID", IncludeSubDepartment)`
            // which produces an `And DepartmentID In(...)` clause that gets appended to
            // `Select DISTINCT ItemStoreID From ItemsRepFilter Where (1=1)`. The SP exposes
            // that hook as @ItemFilter, so we route the department through there.
            var itemFilter = "";
            if (departmentId.HasValue && departmentId.Value != Guid.Empty)
                itemFilter = $" And DepartmentID In('{departmentId.Value}') ";

            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            var results = new List<SalesSummaryByItemRowDto>();
            int total = 0;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_SP_GetItemSummary]";
                cmd.CommandType = CommandType.StoredProcedure;

                AddStringParam((DbCommand)cmd, "Filter", filter);
                AddStringParam((DbCommand)cmd, "ItemFilter", itemFilter);
                AddStringParam((DbCommand)cmd, "CustomerFilter", "");
                AddStringParam((DbCommand)cmd, "TableName", "TransactionEntryItem");
                AddGuidParam((DbCommand)cmd, "ModifierID", null);
                AddBoolParam((DbCommand)cmd, "OldTransaction", false);
                AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                {
                    var oTRec = OrdOf(reader, "TotalRecords");
                    while (await reader.ReadAsync())
                    {
                        results.Add(ReadItemSummaryRowByOrdinal(reader));
                        if (total == 0) total = ReadInt(reader, oTRec);
                    }
                }
            }

            return (results, total);
        }

        /// <summary>
        /// Adds a string SP parameter, sending empty strings as actual empty strings — NOT
        /// DBNull. The Web_SP_* paginated SPs build dynamic SQL by concatenating these params
        /// (e.g. `@FullSql = @ItemSelect + @ItemFilter + @MyIndex + ...`). When `@ItemFilter`
        /// arrives as NULL, the whole concatenation collapses to NULL (CONCAT_NULL_YIELDS_NULL
        /// is ON by default), `EXEC(NULL)` silently does nothing, and the report returns zero
        /// rows. Coercing only `null` (not empty) to DBNull preserves that contract.
        /// </summary>
        private static void AddStringParam(DbCommand cmd, string name, string value)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = value ?? string.Empty;
            p.DbType = DbType.String;
            cmd.Parameters.Add(p);
        }

        private static void AddGuidParam(DbCommand cmd, string name, Guid? value)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = value ?? (object)DBNull.Value;
            p.DbType = DbType.Guid;
            cmd.Parameters.Add(p);
        }

        private static void AddBoolParam(DbCommand cmd, string name, bool value)
        {
            var p = cmd.CreateParameter();
            p.ParameterName = name;
            p.Value = value;
            p.DbType = DbType.Boolean;
            cmd.Parameters.Add(p);
        }

        /// <summary>
        /// Reads one SP_GetItemSummary row using column-name lookup (not fixed ordinals).
        /// Previously hard-coded positions 0..50 — that broke the moment any column was added,
        /// removed, or reordered in the SP. Name-based lookup also handles columns the SP
        /// may not expose (OrdOf returns -1, the GetReader* helpers treat that as null).
        /// </summary>
        private static SalesSummaryByItemRowDto ReadItemSummaryRowByOrdinal(DbDataReader reader)
        {
            int O(string name) => OrdOf(reader, name);
            return new SalesSummaryByItemRowDto
            {
                ItemStoreID        = GetReaderGuid    (reader, O("ItemStoreID")),
                Name               = GetReaderString  (reader, O("Name")),
                Groups             = GetReaderString  (reader, O("Groups")),
                ParentName         = GetReaderString  (reader, O("ParentName")),
                Color              = GetReaderString  (reader, O("Color")),
                Size               = GetReaderString  (reader, O("Size")),
                MainSize           = GetReaderString  (reader, O("MainSize")),
                ModalNumber        = GetReaderString  (reader, O("ModalNumber")),
                BarcodeNumber      = GetReaderString  (reader, O("BarcodeNumber")),
                ItemTypeName       = GetReaderString  (reader, O("ItemTypeName")),
                Department         = GetReaderString  (reader, O("Department")),
                DepartmentID       = GetReaderGuid    (reader, O("DepartmentID")),
                MainDepartment     = GetReaderString  (reader, O("MainDepartment")),
                SubDepartment      = GetReaderString  (reader, O("SubDepartment")),
                SubSubDepartment   = GetReaderString  (reader, O("SubSubDepartment")),
                StyleNo            = GetReaderString  (reader, O("StyleNo")),
                Supplier           = GetReaderString  (reader, O("Supplier")),
                ItemCodeSupplier   = GetReaderString  (reader, O("ItemCodeSupplier")),
                Brand              = GetReaderString  (reader, O("Brand")),
                CustomerCode       = GetReaderString  (reader, O("CustomerCode")),
                Qty                = GetReaderDecimal (reader, O("Qty")),
                QtyCase            = GetReaderDecimal (reader, O("QtyCase")),
                ExtCost            = GetReaderDecimal (reader, O("ExtCost")),
                ExtPrice           = GetReaderDecimal (reader, O("ExtPrice")),
                DiscountPct        = GetReaderDecimal (reader, O("Discount %")),
                MarginPrice        = GetReaderDecimal (reader, O("MarginPrice")),
                MarkupPrice        = GetReaderDecimal (reader, O("MarkupPrice")),
                Profit             = GetReaderDecimal (reader, O("Profit")),
                Discount           = GetReaderDecimal (reader, O("Discount")),
                TotalAfterDiscount = GetReaderDecimal (reader, O("TotalAfterDiscount")),
                StoreName          = GetReaderString  (reader, O("StoreName")),
                StoreID            = GetReaderGuid    (reader, O("StoreID")),
                ItemID             = GetReaderGuid    (reader, O("ItemID")),
                ParentCode         = GetReaderString  (reader, O("ParentCode")),
                Price              = GetReaderDecimal (reader, O("Price")),
                OnHand             = GetReaderDecimal (reader, O("OnHand")),
                OnOrder            = GetReaderDecimal (reader, O("OnOrder")),
                SellThru           = GetReaderDecimal (reader, O("SellThru")),
                LastReceivedDate   = GetReaderDateTime(reader, O("LastReceivedDate")),
                LastReceivedQty    = GetReaderDecimal (reader, O("LastReceivedQty")),
                CustomField1       = GetReaderString  (reader, O("CustomField1")),
                CustomField2       = GetReaderString  (reader, O("CustomField2")),
                CustomField3       = GetReaderString  (reader, O("CustomField3")),
                CustomField4       = GetReaderString  (reader, O("CustomField4")),
                CustomField5       = GetReaderString  (reader, O("CustomField5")),
                CustomField6       = GetReaderString  (reader, O("CustomField6")),
                CustomField7       = GetReaderString  (reader, O("CustomField7")),
                CustomField8       = GetReaderString  (reader, O("CustomField8")),
                CustomField9       = GetReaderString  (reader, O("CustomField9")),
                CustomField10      = GetReaderString  (reader, O("CustomField10")),
            };
        }

        private static string? GetReaderString(DbDataReader reader, int ordinal)
        {
            if (ordinal < 0 || ordinal >= reader.FieldCount || reader.IsDBNull(ordinal)) return null;
            var v = reader.GetValue(ordinal);
            var s = v?.ToString()?.Trim();
            return string.IsNullOrEmpty(s) ? null : s;
        }

        private static Guid? GetReaderGuid(DbDataReader reader, int ordinal)
        {
            if (ordinal < 0 || ordinal >= reader.FieldCount || reader.IsDBNull(ordinal)) return null;
            var v = reader.GetValue(ordinal);
            if (v is Guid g) return g;
            if (v is string s && Guid.TryParse(s, out var parsed)) return parsed;
            return null;
        }

        private static decimal? GetReaderDecimal(DbDataReader reader, int ordinal)
        {
            if (ordinal < 0 || ordinal >= reader.FieldCount || reader.IsDBNull(ordinal)) return null;
            var v = reader.GetValue(ordinal);
            if (v is decimal d) return d;
            if (v != null && decimal.TryParse(v.ToString(), System.Globalization.NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed)) return parsed;
            return null;
        }

        private static DateTime? GetReaderDateTime(DbDataReader reader, int ordinal)
        {
            if (ordinal < 0 || ordinal >= reader.FieldCount || reader.IsDBNull(ordinal)) return null;
            try { return reader.GetDateTime(ordinal); } catch { return null; }
        }

        private static SalesSummaryByItemRowDto MapItemSummaryResultToRow(SP_GetItemSummaryResult r)
        {
            return new SalesSummaryByItemRowDto
            {
                ItemStoreID = r.ItemStoreID,
                Name = r.Name,
                Groups = r.Groups,
                ParentName = r.ParentName,
                Color = r.Color,
                Size = r.Size,
                MainSize = r.MainSize,
                ModalNumber = r.ModalNumber,
                BarcodeNumber = r.BarcodeNumber,
                ItemTypeName = r.ItemTypeName,
                Department = r.Department,
                DepartmentID = r.DepartmentID,
                MainDepartment = r.MainDepartment,
                SubDepartment = r.SubDepartment,
                SubSubDepartment = r.SubSubDepartment,
                StyleNo = r.StyleNo,
                Supplier = r.Supplier,
                ItemCodeSupplier = r.ItemCodeSupplier,
                Brand = r.Brand,
                CustomerCode = r.CustomerCode,
                Qty = r.Qty,
                QtyCase = r.QtyCase,
                ExtCost = r.ExtCost,
                ExtPrice = r.ExtPrice,
                DiscountPct = r.DiscountPct,
                MarginPrice = r.MarginPrice,
                MarkupPrice = r.MarkupPrice,
                Profit = r.Profit,
                Discount = r.Discount,
                TotalAfterDiscount = r.TotalAfterDiscount,
                StoreName = r.StoreName,
                StoreID = r.StoreID,
                ItemID = r.ItemID,
                ParentCode = r.ParentCode,
                Price = r.Price,
                OnHand = r.OnHand,
                OnOrder = r.OnOrder,
                SellThru = r.SellThru,
                LastReceivedDate = r.LastReceivedDate,
                LastReceivedQty = r.LastReceivedQty,
                CustomField1 = r.CustomField1,
                CustomField2 = r.CustomField2,
                CustomField3 = r.CustomField3,
                CustomField4 = r.CustomField4,
                CustomField5 = r.CustomField5,
                CustomField6 = r.CustomField6,
                CustomField7 = r.CustomField7,
                CustomField8 = r.CustomField8,
                CustomField9 = r.CustomField9,
                CustomField10 = r.CustomField10
            };
        }

        /// <summary>
        /// Gets transaction rows for Sales Summary By Transaction from SP_GetSalesProfit only (desktop RepSalesProfit.vb).
        /// </summary>
        private async Task<(List<SalesSummaryByTransactionRowDto> items, int totalRecords)> GetSalesSummaryByTransactionDataAsync(
            DateTime from,
            DateTime to,
            Guid? storeId,
            string? customerFilter,
            string? userFilter,
            bool onlyRegister,
            int pageNumber,
            int pageSize)
        {
            var ci = CultureInfo.InvariantCulture;
            var fromStr = from.ToString("MM/dd/yy HH:mm:ss", ci);
            var toStr = to.ToString("MM/dd/yy HH:mm:ss", ci);

            var filterParts = new List<string>();
            filterParts.Add($" and (Date>='{fromStr}' ) ");
            filterParts.Add($" and (Date<='{toStr}') ");
            if (storeId.HasValue && storeId.Value != Guid.Empty)
                filterParts.Add($" And StoreID In('{storeId.Value}' ) ");
            if (!string.IsNullOrWhiteSpace(userFilter))
            {
                var userGuid = userFilter.Trim().Replace("'", "''");
                if (userGuid.Length > 0)
                    filterParts.Add($" And UserCreated In('{userGuid}' ) ");
            }

            var filter = string.Join("", filterParts);
            var customerFilterStr = string.IsNullOrWhiteSpace(customerFilter)
                ? ""
                : " And CustomerID In('" + customerFilter.Trim().Replace("'", "''") + "' ) ";

            var conn = _dbContext.Database.GetDbConnection();
            if (conn.State != ConnectionState.Open) await conn.OpenAsync();

            var results = new List<SalesSummaryByTransactionRowDto>();
            int total = 0;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_SP_GetSalesProfit]";
                cmd.CommandType = CommandType.StoredProcedure;

                AddStringParam((DbCommand)cmd, "Filter", filter);
                AddStringParam((DbCommand)cmd, "CustomerFilter", customerFilterStr);
                AddBoolParam((DbCommand)cmd, "OldTransaction", false);
                AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                using (var reader = await ((DbCommand)cmd).ExecuteReaderAsync())
                {
                    var oStore   = OrdOf(reader, "StoreName");
                    var oNo      = OrdOf(reader, "TransactionNo");
                    var oCustNo  = OrdOf(reader, "CustomerNo");
                    var oDate    = OrdOf(reader, "Date");
                    var oCustNam = OrdOf(reader, "CustomerName");
                    var oDiscPc  = OrdOf(reader, "DiscountPercent");
                    var oUser    = OrdOf(reader, "User");
                    var oTotal   = OrdOf(reader, "Total");
                    var oSubT    = OrdOf(reader, "SubTotal");
                    var oDiscAm  = OrdOf(reader, "DiscountAmount");
                    var oTax     = OrdOf(reader, "Tax");
                    var oMarkup  = OrdOf(reader, "Markup");
                    var oMargin  = OrdOf(reader, "Margin");
                    var oProfit  = OrdOf(reader, "Profit");
                    var oTRec    = OrdOf(reader, "TotalRecords");
                    // TransactionID is needed by the row double-click drill-down (RepEntryProfit).
                    // OrdOf returns -1 if SalesProfitView doesn't expose it, in which case the row
                    // ships without an id and the frontend simply won't enable drill-down.
                    var oTranId  = OrdOf(reader, "TransactionID");

                    while (await reader.ReadAsync())
                    {
                        var storeName = ReadStr(reader, oStore);
                        results.Add(new SalesSummaryByTransactionRowDto
                        {
                            StoreName        = storeName,
                            No               = ReadStr(reader, oNo),
                            CustomerNo       = ReadStr(reader, oCustNo),
                            Date             = ReadDate(reader, oDate),
                            CustomerName     = ReadStr(reader, oCustNam),
                            DiscountPercent  = oDiscPc  >= 0 && !reader.IsDBNull(oDiscPc) ? Convert.ToDecimal(reader.GetValue(oDiscPc)) : (decimal?)null,
                            User             = ReadStr(reader, oUser),
                            Total            = oTotal   >= 0 && !reader.IsDBNull(oTotal)  ? Convert.ToDecimal(reader.GetValue(oTotal))  : (decimal?)null,
                            SubTotal         = oSubT    >= 0 && !reader.IsDBNull(oSubT)   ? Convert.ToDecimal(reader.GetValue(oSubT))   : (decimal?)null,
                            DiscountAmount   = oDiscAm  >= 0 && !reader.IsDBNull(oDiscAm) ? Convert.ToDecimal(reader.GetValue(oDiscAm)) : (decimal?)null,
                            Tax              = oTax     >= 0 && !reader.IsDBNull(oTax)    ? Convert.ToDecimal(reader.GetValue(oTax))    : (decimal?)null,
                            Markup           = oMarkup  >= 0 && !reader.IsDBNull(oMarkup) ? Convert.ToDecimal(reader.GetValue(oMarkup)) : (decimal?)null,
                            Margin           = oMargin  >= 0 && !reader.IsDBNull(oMargin) ? Convert.ToDecimal(reader.GetValue(oMargin)) : (decimal?)null,
                            Profit           = oProfit  >= 0 && !reader.IsDBNull(oProfit) ? Convert.ToDecimal(reader.GetValue(oProfit)) : (decimal?)null,
                            StoreName2       = storeName,
                            TransactionId    = oTranId  >= 0 && !reader.IsDBNull(oTranId) ? reader.GetGuid(oTranId)                     : (Guid?)null
                        });
                        if (total == 0) total = ReadInt(reader, oTRec);
                    }
                }
            }
            return (results, total);
        }

        /// <summary>
        /// Drill-down for the Sales Summary By Transaction report — returns the per-line
        /// profit breakdown for one transaction. Triggered by the row double-click in the
        /// parent grid; mirrors the desktop's RepSalesProfit -> RepEntryProfit flow
        /// (`FillEntryProfit(TransactionID)` -> `SP_GetEntryProfit`).
        /// </summary>
        public async Task<ApiResponse<SalesSummaryByTransactionDetailsResponseDto>> GetSalesSummaryByTransactionDetailsAsync(SalesSummaryByTransactionDetailsRequestDto request)
        {
            try
            {
                request ??= new SalesSummaryByTransactionDetailsRequestDto();
                if (!request.TransactionId.HasValue || request.TransactionId.Value == Guid.Empty)
                {
                    return ApiResponseFactory.BadRequest<SalesSummaryByTransactionDetailsResponseDto>("transactionId is required");
                }

                var spRows = await _dbContext.Procedures.SP_GetEntryProfitAsync(request.TransactionId.Value);

                var rows = spRows.Select(r => new SalesSummaryByTransactionDetailsRowDto
                {
                    Name               = r.Name ?? string.Empty,
                    UOMPrice           = r.UOMPrice,
                    UOMQty             = r.UOMQty,
                    Total              = r.Total,
                    Cost               = r.Cost,
                    DiscountPerc       = r.DiscountPerc,
                    DiscountAmount     = r.DiscountAmount,
                    TotalAfterDiscount = r.TotalAfterDiscount,
                    Markup             = r.Markup,
                    Margin             = r.Margin,
                    Profit             = r.Profit,
                    DiscountOnTotal    = r.DiscountOnTotal
                }).ToList();

                return ApiResponseFactory.Success(new SalesSummaryByTransactionDetailsResponseDto
                {
                    Data         = rows,
                    TotalRecords = rows.Count,
                    TotalProfit  = rows.Sum(r => r.Profit ?? 0m),
                    TotalCost    = rows.Sum(r => r.Cost ?? 0m),
                    TotalAmount  = rows.Sum(r => r.TotalAfterDiscount ?? 0m)
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<SalesSummaryByTransactionDetailsResponseDto>($"Failed to load Sales Summary By Transaction drill-down: {ex.Message}");
            }
        }

        private static TimeSpan? ParseTime(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            value = value.Trim();
            if (TimeSpan.TryParse(value, out var t)) return t;
            if (DateTime.TryParse(value, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var dt))
                return dt.TimeOfDay;
            return null;
        }

        private async Task<List<(string Label, string Value)>> GetSummaryReportRawFromSpAsync(DateTime fromDate, DateTime toDate, Guid? storeId, bool loadAllChecks, string customerFilter = "")
        {
            var list = new List<(string Label, string Value)>();
            var connection = _dbContext.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
                await connection.OpenAsync();

            using (var cmd = connection.CreateCommand())
            {
                cmd.CommandText = "[dbo].[Web_Get_SummaryReport]";
                cmd.CommandType = CommandType.StoredProcedure;
                var pFrom = cmd.CreateParameter();
                pFrom.ParameterName = "@From";
                pFrom.Value = (object)fromDate ?? DBNull.Value;
                pFrom.DbType = DbType.DateTime;
                cmd.Parameters.Add(pFrom);
                var pTo = cmd.CreateParameter();
                pTo.ParameterName = "@To";
                pTo.Value = (object)toDate ?? DBNull.Value;
                pTo.DbType = DbType.DateTime;
                cmd.Parameters.Add(pTo);
                var pStore = cmd.CreateParameter();
                pStore.ParameterName = "@Store";
                pStore.Value = storeId.HasValue ? (object)storeId.Value : DBNull.Value;
                pStore.DbType = DbType.Guid;
                cmd.Parameters.Add(pStore);
                var pLoadAll = cmd.CreateParameter();
                pLoadAll.ParameterName = "@DisplayChecksIndividually";
                pLoadAll.Value = loadAllChecks;
                pLoadAll.DbType = DbType.Boolean;
                cmd.Parameters.Add(pLoadAll);
                var pCustFilter = cmd.CreateParameter();
                pCustFilter.ParameterName = "@CustomerFilter";
                pCustFilter.Value = (object?)customerFilter ?? string.Empty;
                pCustFilter.DbType = DbType.String;
                cmd.Parameters.Add(pCustFilter);

                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        var label = reader.IsDBNull(0) ? string.Empty : (reader.GetValue(0)?.ToString() ?? string.Empty);
                        var value = reader.IsDBNull(1) ? string.Empty : (reader.GetValue(1)?.ToString() ?? string.Empty);
                        list.Add((label, value));
                    }
                }
            }

            return list;
        }

        private static DateTime? ParseDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            value = value.Trim();
            if (DateTime.TryParse(value, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var d))
                return d;
            return null;
        }

        /// <summary>
        /// Gets On Account Payments report (parent grid). Mirrors the desktop's
        /// RepAcountReceivableSales (Payments mode = Totals view) which calls
        /// [dbo].[Rpt_AcountReceivableTotals] and then filters where AmountPayments > 0.
        /// Returns one row per customer with their period AmountPayments, scoped to the
        /// date range and optional store.
        /// </summary>
        public async Task<ApiResponse<OnAccountPaymentsResponseDto>> GetOnAccountPaymentsReportAsync(OnAccountPaymentsRequestDto request)
        {
            try
            {
                request ??= new OnAccountPaymentsRequestDto();

                var fromDate = request.FromDate ?? DateTime.Today.AddDays(-30);
                var toDate = request.ToDate ?? DateTime.Today;

                if (toDate.Date == toDate && toDate.TimeOfDay == TimeSpan.Zero)
                    toDate = toDate.AddDays(1).AddSeconds(-1);

                Guid? storeId = null;
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    storeId = request.StoreId.Value;

                // Same SP the desktop uses for the parent grid (Rpt_AcountReceivableTotals).
                // The web's prior implementation aggregated Web_Rpt_AcountReceivable in-memory,
                // which uses a stricter Actions.ActionType=17 filter and produced very different
                // numbers from the desktop (e.g. 1 customer / $173 vs the desktop's 11 customers /
                // $835 for the same store + date range).
                var totals = await ReadAccountReceivableTotalsAsync(fromDate, toDate, storeId).ConfigureAwait(false);

                if (request.CustomerId.HasValue && request.CustomerId.Value != Guid.Empty)
                {
                    var cid = request.CustomerId.Value;
                    totals = totals.Where(r => r.CustomerID.HasValue && r.CustomerID.Value == cid).ToList();
                }

                // Desktop parity (RepAcountReceivableSales / Payments mode → "AmountPayments > 0"):
                // drop blank-customer rows and customers with no period payments.
                var grouped = totals
                    .Where(r => !string.IsNullOrWhiteSpace(r.CustomerNo))
                    .Where(r => r.AmountPayments > 0m)
                    .Select(r => new OnAccountPaymentsRowDto
                    {
                        StoreId = r.StoreId,
                        StoreName = r.StoreName,
                        CustomerId = r.CustomerID,
                        CustomerNo = r.CustomerNo,
                        Name = string.IsNullOrEmpty(r.LastName) && string.IsNullOrEmpty(r.FirstName)
                            ? string.Empty
                            : $"{r.LastName} {r.FirstName}".Trim(),
                        LastName = r.LastName,
                        FirstName = r.FirstName,
                        Address = r.Address,
                        Phone = r.Phone,
                        Amount = r.AmountPayments,
                    })
                    .OrderBy(r => r.StoreName)
                    .ThenBy(r => r.CustomerNo)
                    .ToList();

                var response = new OnAccountPaymentsResponseDto
                {
                    Data = grouped,
                    TotalRecords = grouped.Count,
                    TotalAmount = grouped.Sum(r => r.Amount)
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<OnAccountPaymentsResponseDto>($"Failed to generate On Account Payments report: {ex.Message}");
            }
        }

        private static DateTime ApplyTimeToDate(DateTime date, string timeStr)
        {
            if (string.IsNullOrWhiteSpace(timeStr))
                return date.Date;
            var parts = timeStr.Trim().Split(':', StringSplitOptions.RemoveEmptyEntries);
            int h = 0, m = 0, s = 0;
            if (parts.Length > 0) int.TryParse(parts[0], out h);
            if (parts.Length > 1) int.TryParse(parts[1], out m);
            if (parts.Length > 2) int.TryParse(parts[2], out s);
            return date.Date + new TimeSpan(h, m, s);
        }

        /// <summary>
        /// Gets Register Shifts report (desktop Register Shifts) using batch and Z-Out data.
        /// </summary>
        /// <summary>
        /// Gets Register Shifts report using [dbo].[Web_SP_GetRegShifts] — desktop parity (FillRegShiftRep + SP_GetRegShifts).
        /// One SP call returns the full aggregated row (TotalExp/TotalPick/Discrepancy etc.); the previous N+1 implementation
        /// using SP_GetBatchBetweenDayes + per-batch SP_GetRptZOut produced different numbers and is replaced here.
        /// Filter mirrors the desktop string: " and ShiftOpenDate > '...' and ShiftOpenDate < '...' [ and Registers.StoreID = '...' ]".
        /// </summary>
        public async Task<ApiResponse<RegisterShiftReportResponseDto>> GetRegisterShiftReportAsync(RegisterShiftReportRequestDto request)
        {
            try
            {
                request ??= new RegisterShiftReportRequestDto();

                // Mirror desktop FillRegShiftRep: end-date is exclusive (endDate + 1 day).
                var fromDate = request.FromDate ?? DateTime.Today.AddYears(-1);
                var toDate   = (request.ToDate ?? DateTime.Today).Date.AddDays(1);

                // Build the exact filter string the desktop builds. Concatenated as "WHERE ... " + @Filter.
                var ci = CultureInfo.InvariantCulture;
                var filter = $" and ShiftOpenDate > '{fromDate.ToString("yyyy-MM-dd HH:mm:ss", ci)}' and ShiftOpenDate < '{toDate.ToString("yyyy-MM-dd HH:mm:ss", ci)}' ";
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    filter += $" And Registers.StoreID = '{request.StoreId.Value}' ";

                var pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = (request.StartRow / pageSize) + 1;

                var rows = new List<RegisterShiftReportRowDto>();
                int totalRecords = 0;

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "[dbo].[Web_SP_GetRegShifts]";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.CommandTimeout = 120;

                    AddStringParam((DbCommand)cmd, "Filter", filter);
                    AddBoolParam((DbCommand)cmd, "IncludeReconcile", true);
                    AddParam((DbCommand)cmd, "PageNumber", pageNumber, DbType.Int32);
                    AddParam((DbCommand)cmd, "PageSize",   pageSize,   DbType.Int32);

                    using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
                    var oRegShiftId = OrdOf(reader, "RegShiftID");
                    var oShiftNo   = OrdOf(reader, "ShiftNO");
                    var oOpenDate  = OrdOf(reader, "ShiftOpenDate");
                    var oStatus    = OrdOf(reader, "Status");
                    var oCloseDate = OrdOf(reader, "ShiftCloseDate");
                    var oRegNo     = OrdOf(reader, "RegisterNo");
                    var oStoreName = OrdOf(reader, "StoreName");
                    var oCloseBy   = OrdOf(reader, "CloseBy");
                    var oTotalExp  = OrdOf(reader, "TotalExp");
                    var oTotalPick = OrdOf(reader, "TotalPick");
                    var oDiscr     = OrdOf(reader, "Discrepancy");
                    var oTRec      = OrdOf(reader, "TotalRecords");

                    while (await reader.ReadAsync())
                    {
                        rows.Add(new RegisterShiftReportRowDto
                        {
                            RegShiftID    = oRegShiftId >= 0 && !reader.IsDBNull(oRegShiftId) ? reader.GetGuid(oRegShiftId) : (Guid?)null,
                            StoreName     = ReadStr(reader, oStoreName),
                            ShiftNo       = ReadStr(reader, oShiftNo),
                            RegisterNo    = ReadStr(reader, oRegNo),
                            OpenDateTime  = ReadDate(reader, oOpenDate),
                            CloseDateTime = ReadDate(reader, oCloseDate),
                            Status        = ReadStr(reader, oStatus),
                            CloseBy       = ReadStr(reader, oCloseBy),
                            Expected      = ReadDec(reader, oTotalExp),
                            Pick          = ReadDec(reader, oTotalPick),
                            Discrepancy   = ReadDec(reader, oDiscr)
                        });
                        if (totalRecords == 0) totalRecords = ReadInt(reader, oTRec);
                    }
                }

                return ApiResponseFactory.Success(new RegisterShiftReportResponseDto
                {
                    Data = rows,
                    TotalRecords = totalRecords
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<RegisterShiftReportResponseDto>($"Failed to generate Register Shifts report: {ex.Message}");
            }
        }

        /// <summary>
        /// Gets Returned Items report data with pagination and filters.
        /// Mirrors legacy VB logic: uses SP_GetReturnItemsByItem and the same Filter string format.
        /// </summary>
        public ApiResponse<ReturnedItemsResponseDto> GetReturnedItemsReport(ReturnedItemsRequestDto request)
        {
            var allData = new List<ReturnedItemsDto>();
            try
            {
                // Build filter the same way as legacy GetReturnItemFilter:
                //   And dbo.[Transaction].StartSaleTime >= FromDate
                //   And dbo.[Transaction].StartSaleTime < ToDate+1
                //   And StoreID = '<storeId>'
                var filter = string.Empty;
                if (request.FromDate.HasValue)
                {
                    filter += $" And dbo.[Transaction].StartSaleTime>='{request.FromDate.Value:yyyy-MM-dd}'";
                }
                if (request.ToDate.HasValue)
                {
                    var toDateExclusive = request.ToDate.Value.Date.AddDays(1);
                    filter += $" And dbo.[Transaction].StartSaleTime<'{toDateExclusive:yyyy-MM-dd}'";
                }
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                {
                    filter += $" And StoreID = '{request.StoreId.Value}'";
                }
                // Desktop FillReturnByItem always appends this; without it we return more rows than desktop.
                // When no reason filter: only rows where Note is empty OR SystemValues.SystemValueName is null.
                const string reason = "";
                filter += " and  (TransactionEntryView.Note = '" + reason + "' Or ('" + reason + "' ='' and dbo.SystemValues.SystemValueName is null))";
                if (string.IsNullOrWhiteSpace(filter))
                {
                    // Legacy code sends an empty string when no filters are applied
                    filter = string.Empty;
                }

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open)
                    conn.Open();

                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = "[dbo].[Web_SP_GetReturnItemsByItem]";
                    cmd.CommandType = CommandType.StoredProcedure;

                    var pFilter = cmd.CreateParameter();
                    pFilter.ParameterName = "@Filter";
                    pFilter.Value = (object?)filter ?? DBNull.Value;
                    pFilter.DbType = DbType.String;
                    cmd.Parameters.Add(pFilter);

                    var pItem = cmd.CreateParameter();
                    pItem.ParameterName = "@ItemFilter";
                    pItem.Value = "";
                    pItem.DbType = DbType.String;
                    cmd.Parameters.Add(pItem);

                    var pCust = cmd.CreateParameter();
                    pCust.ParameterName = "@CustomerFilter";
                    pCust.Value = "";
                    pCust.DbType = DbType.String;
                    cmd.Parameters.Add(pCust);

                    AddParam((DbCommand)cmd, "PageNumber", 1, DbType.Int32);
                    AddParam((DbCommand)cmd, "PageSize",   int.MaxValue, DbType.Int32);

                    var storeIds = new List<Guid>();
                    using (var reader = cmd.ExecuteReader())
                    {
                        while (reader.Read())
                        {
                            var dto = ReadReturnItemRow(reader);
                            if (dto != null)
                            {
                                allData.Add(dto);
                                if (dto.StoreId.HasValue)
                                    storeIds.Add(dto.StoreId.Value);
                            }
                        }
                    }

                    // Deduplicate: SP can return duplicate rows (e.g. from JOINs); keep one per logical row
                    var seen = new HashSet<string>(StringComparer.Ordinal);
                    var deduped = new List<ReturnedItemsDto>();
                    foreach (var d in allData)
                    {
                        var key = $"{d.TransactionId}|{d.StoreId}|{d.ItemCode}|{d.Date?.ToString("O")}|{d.QuantityReturned}|{d.Amount}";
                        if (seen.Add(key))
                        {
                            d.Id = Guid.NewGuid();
                            deduped.Add(d);
                        }
                    }
                    allData = deduped;

                    // Club (aggregate) values by Item (Name) and UPC: one row per Store + Name + UPC with summed Qty and Amount
                    var grouped = allData
                        .GroupBy(d => new { d.StoreId, Name = d.Name ?? "", Upc = d.Upc ?? d.ItemCode ?? "" })
                        .Select(g =>
                        {
                            var first = g.First();
                            return new ReturnedItemsDto
                            {
                                Id = Guid.NewGuid(),
                                StoreId = first.StoreId,
                                StoreName = first.StoreName,
                                Name = first.Name,
                                Upc = first.Upc,
                                ItemCode = first.ItemCode,
                                ModelNumber = first.ModelNumber,
                                ReturnReason = first.ReturnReason,
                                SupplierName = first.SupplierName,
                                Department = first.Department,
                                StyleNo = first.StyleNo,
                                QuantityReturned = g.Sum(x => x.QuantityReturned ?? 0),
                                Amount = g.Sum(x => x.Amount ?? 0),
                                Date = first.Date,
                                TransactionNo = first.TransactionNo,
                                TransactionId = first.TransactionId,
                                Description = first.Description,
                                CustomerName = first.CustomerName,
                            };
                        })
                        .ToList();
                    allData = grouped;

                    // Reader must be closed before using the same connection (e.g. StoreViews)
                    if (storeIds.Count > 0)
                    {
                        var distinctIds = storeIds.Distinct().ToList();
                        // Project to ONLY StoreID/StoreName — materializing the full
                        // entity makes EF SELECT StoreInt, which fails on tenants whose
                        // StoreView lacks that column.
                        var storeNames = _dbContext.StoreViews
                            .Where(s => distinctIds.Contains(s.StoreID))
                            .Select(s => new { s.StoreID, s.StoreName })
                            .ToDictionary(s => s.StoreID, s => s.StoreName ?? "");

                        foreach (var d in allData)
                        {
                            if (d.StoreId.HasValue && storeNames.TryGetValue(d.StoreId.Value, out var name))
                                d.StoreName = name;
                        }
                    }
                }

                var totalRecords = allData.Count;
                var pageSize = request.EndRow - request.StartRow;
                if (pageSize <= 0) pageSize = 100;
                var data = allData.Skip(request.StartRow).Take(pageSize).ToList();
                return ApiResponseFactory.Success(new ReturnedItemsResponseDto { Data = data, TotalRecords = totalRecords });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ReturnedItemsResponseDto>($"Returned Items report: {ex.Message}");
            }
        }

        private static ReturnedItemsDto? ReadReturnItemRow(System.Data.Common.DbDataReader reader)
        {
            try
            {
                var getStrByName = (string name) =>
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? "" : reader.GetValue(i)?.ToString() ?? "";
                    return "";
                };
                var getDateByName = (string name) =>
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? (DateTime?)null : reader.GetDateTime(i);
                    return (DateTime?)null;
                };
                var getDecByName = (string name) =>
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                        {
                            if (reader.IsDBNull(i)) return (decimal?)null;
                            var v = reader.GetValue(i);
                            if (v is decimal d) return d;
                            if (v != null && decimal.TryParse(v.ToString(), out var d2)) return d2;
                            return (decimal?)null;
                        }
                    return (decimal?)null;
                };
                var getGuidByName = (string name) =>
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? (Guid?)null : reader.GetGuid(i);
                    return (Guid?)null;
                };

                return new ReturnedItemsDto
                {
                    // Desktop‑visible columns (desktop grid binds UPC to ItemCode from SP_GetReturnItemsByItem)
                    Name = getStrByName("Name"),
                    Upc = getStrByName("ItemCode") ?? getStrByName("UPC"),
                    ModelNumber = getStrByName("ModalNumber") ?? getStrByName("ModelNumber"),
                    ReturnReason = getStrByName("ReturnReason"),
                    SupplierName = getStrByName("SuppName") ?? getStrByName("SupplierName"),
                    QuantityReturned = getDecByName("QuantityReturned") ?? getDecByName("Qty"),
                    Amount = getDecByName("Amount") ?? getDecByName("Total"),
                    Department = getStrByName("Department") ?? getStrByName("DepName"),
                    StyleNo = getStrByName("StyleNo") ?? getStrByName("Style"),

                    // Supporting fields
                    TransactionId = getGuidByName("TransactionID"),
                    TransactionNo = getStrByName("TransactionNo"),
                    StoreName = getStrByName("StoreName"),
                    StoreId = getGuidByName("StoreID"),
                    Date = getDateByName("ReturnDate") ?? getDateByName("Date"),
                    ItemCode = getStrByName("ItemCode"),
                    Description = getStrByName("Description"),
                    CustomerName = getStrByName("CustomerName")
                };
            }
            catch { return null; }
        }

        /// <summary>
        /// Builds an IN filter fragment matching VB BuildINFilter (Queries.vb): " And ColumnName In('v1','v2' ) "
        /// (space before closing paren to match desktop).
        /// </summary>
        private static string BuildPriceChangeInFilter(string columnName, IList<string> values)
        {
            if (values == null || values.Count == 0) return "";
            var quoted = values.Where(v => !string.IsNullOrEmpty(v)).Select(v => "'" + v.Replace("'", "''") + "'").ToList();
            if (quoted.Count == 0) return "";
            return " And " + columnName + " In(" + string.Join(",", quoted) + " ) ";
        }

        /// <summary>
        /// Reads one row from the second result set of SP_GetPriceChange into PriceChangeHistoryDto.
        /// Uses column names from the SP (e.g. BarcodeNumber or Barcode).
        /// </summary>
        private static PriceChangeHistoryDto? ReadPriceChangeHistoryRow(System.Data.Common.DbDataReader reader)
        {
            try
            {
                string getStr(string name)
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? "" : reader.GetValue(i)?.ToString() ?? "";
                    return "";
                }
                DateTime? getDate(string name)
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? (DateTime?)null : reader.GetDateTime(i);
                    return null;
                }
                decimal? getDec(string name)
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                        {
                            if (reader.IsDBNull(i)) return null;
                            var v = reader.GetValue(i);
                            if (v is decimal d) return d;
                            if (v != null && decimal.TryParse(v.ToString(), out var d2)) return d2;
                            return null;
                        }
                    return null;
                }
                Guid? getGuid(string name)
                {
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            return reader.IsDBNull(i) ? (Guid?)null : reader.GetGuid(i);
                    return null;
                }

                var itemId = getGuid("ItemID");
                if (!itemId.HasValue) return null;

                return new PriceChangeHistoryDto
                {
                    ItemStoreID = getGuid("ItemStoreID"),
                    ItemID = itemId.Value,
                    PriceLevel = getStr("PriceLevel"),
                    OldPrice = getDec("OldPrice"),
                    NewPrice = getDec("NewPrice"),
                    ChangeDate = getDate("ChangeDate"),
                    SaleDate = getStr("SaleDate"),
                    SaleType = getStr("SaleType"),
                    SP_Price = getStr("SP_Price"),
                    Department = getStr("Department"),
                    Name = getStr("Name"),
                    ModalNumber = getStr("ModalNumber"),
                    BarcodeNumber = getStr("BarcodeNumber").Length > 0 ? getStr("BarcodeNumber") : getStr("Barcode"),
                    Brand = getStr("Brand"),
                    UserName = getStr("UserName")
                };
            }
            catch { return null; }
        }

        /// <summary>
        /// Gets Items (inventory) report with pagination and store/department/search filters.
        /// Uses ItemsMainAndStoreGrid view and maps to ItemsReportDto.
        /// </summary>
        public ApiResponse<ItemsReportResponseDto> GetItemsReport(ItemsReportRequestDto request)
        {
            try
            {
                var query = _unitOfWork.ItemsMainAndStoreGrids.GetAll().AsQueryable();

                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    query = query.Where(x => x.StoreNo == request.StoreId.Value);

                if (request.DepartmentId.HasValue && request.DepartmentId.Value != Guid.Empty)
                    query = query.Where(x => x.DepartmentID == request.DepartmentId.Value);

                // Exclude items with null or empty department
                query = query.Where(x => x.Department != null && x.Department.Trim() != "");

                if (!string.IsNullOrWhiteSpace(request.SearchText))
                {
                    var term = request.SearchText.Trim().ToLower();
                    query = query.Where(x =>
                        (x.ModalNumber != null && x.ModalNumber.ToLower().Contains(term)) ||
                        (x.BarcodeNumber != null && x.BarcodeNumber.ToLower().Contains(term)) ||
                        (x.Name != null && x.Name.ToLower().Contains(term)) ||
                        (x.Description != null && x.Description.ToLower().Contains(term)));
                }

                var filteredCount = query.Count();

                var sortColumn = request.SortColumn ?? "ModalNumber";
                var sortDirection = (request.SortDirection ?? "asc").ToLowerInvariant() == "desc" ? "desc" : "asc";
                var sortColumnMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    { "itemNo", "ModalNumber" },
                    { "barcode", "BarcodeNumber" },
                    { "description", "Description" },
                    { "departmentName", "Department" },
                    { "itemGroupName", "Groups" },
                    { "cost", "Cost" },
                    { "retailPrice", "Price" },
                    { "qtyOnHand", "OnHand" },
                    { "reorderPoint", "ReorderPoint" },
                    { "isActive", "Status" },
                    { "itemTypeName", "ItemTypeName" },
                    { "storeName", "StoreName" },
                    { "dateCreated", "DateCreated" }
                };
                if (sortColumnMap.TryGetValue(sortColumn, out var entityCol))
                    sortColumn = entityCol;

                query = SortHelper.ApplySorting(query, sortColumn, sortDirection);

                var start = request.StartRow;
                var take = Math.Max(0, request.EndRow - request.StartRow);
                var page = query.Skip(start).Take(take).ToList();

                var data = page.Select(x => new ItemsReportDto
                {
                    ItemStoreId = x.ItemStoreID,
                    ItemId = x.ItemID,
                    ItemNo = x.ModalNumber ?? x.CustomerCode ?? x.ItemStoreID.ToString(),
                    Barcode = x.BarcodeNumber ?? "",
                    Description = x.Description ?? x.Name ?? "",
                    DepartmentName = x.Department ?? "",
                    DepartmentId = x.DepartmentID,
                    ItemGroupName = x.Groups ?? "",
                    ItemGroupId = null,
                    ManufacturerName = x.Brand ?? "",
                    ManufacturerId = null,
                    VendorName = x.SupplierName ?? "",
                    VendorId = null,
                    Cost = x.Cost ?? 0,
                    RetailPrice = x.Price,
                    QtyOnHand = x.OnHand,
                    ReorderPoint = x.ReorderPoint,
                    IsActive = (x.Status ?? x.MainStatus ?? 0) != 0,
                    ItemTypeName = x.ItemTypeName ?? "",
                    UomName = "",
                    StoreName = x.StoreName ?? "",
                    StoreId = x.StoreNo,
                    DateCreated = x.DateCreated
                }).ToList();

                var response = new ItemsReportResponseDto
                {
                    Data = data,
                    TotalRecords = filteredCount,
                    TotalQtyOnHand = data.Sum(x => x.QtyOnHand),
                    TotalRetailValue = data.Sum(x => x.RetailPrice * x.QtyOnHand),
                    TotalCostValue = data.Sum(x => x.Cost * x.QtyOnHand),
                    ActiveItemCount = data.Count(x => x.IsActive),
                    InactiveItemCount = data.Count(x => !x.IsActive)
                };

                return ApiResponseFactory.Success(response, "Items report fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemsReportResponseDto>("Error fetching items report.", new List<string> { ex.Message });
            }
        }

        /// <summary>
        /// Gets Department Inventory report: one row per store+department with aggregated item count and values.
        /// </summary>
        public ApiResponse<DepartmentInventoryResponseDto> GetDepartmentInventoryReport(DepartmentInventoryRequestDto request)
        {
            try
            {
                var query = _unitOfWork.ItemsMainAndStoreGrids.GetAll().AsQueryable();

                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    query = query.Where(x => x.StoreNo == request.StoreId.Value);

                if (request.DepartmentId.HasValue && request.DepartmentId.Value != Guid.Empty)
                    query = query.Where(x => x.DepartmentID == request.DepartmentId.Value);

                var grouped = query
                    .GroupBy(x => new { x.StoreNo, x.StoreName, x.DepartmentID, DepartmentName = x.Department ?? "" })
                    .Select(g => new DepartmentInventoryDto
                    {
                        StoreId = g.Key.StoreNo,
                        StoreName = g.Key.StoreName ?? "",
                        DepartmentId = g.Key.DepartmentID,
                        DepartmentName = g.Key.DepartmentName,
                        ItemCount = g.Count(),
                        TotalQtyOnHand = g.Sum(x => x.OnHand),
                        TotalRetailValue = g.Sum(x => x.Price * x.OnHand),
                        TotalCostValue = g.Sum(x => (x.Cost ?? 0) * x.OnHand)
                    })
                    .OrderBy(x => x.StoreName)
                    .ThenBy(x => x.DepartmentName)
                    .ToList();

                var totalRecords = grouped.Count;
                var start = request.StartRow;
                var take = Math.Max(0, request.EndRow - request.StartRow);
                var page = grouped.Skip(start).Take(take).ToList();

                var response = new DepartmentInventoryResponseDto
                {
                    Data = page,
                    TotalRecords = totalRecords,
                    GrandTotalQtyOnHand = grouped.Sum(x => x.TotalQtyOnHand),
                    GrandTotalRetailValue = grouped.Sum(x => x.TotalRetailValue),
                    GrandTotalCostValue = grouped.Sum(x => x.TotalCostValue)
                };

                return ApiResponseFactory.Success(response, "Department inventory report fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DepartmentInventoryResponseDto>("Error fetching department inventory report.", new List<string> { ex.Message });
            }
        }

        /// <summary>
        /// Gets Item Inventory Summary report: one row per item with aggregated totals (excludes null/empty department).
        /// </summary>
        public ApiResponse<ItemInventorySummaryResponseDto> GetItemInventorySummaryReport(ItemInventorySummaryRequestDto request)
        {
            try
            {
                var query = _unitOfWork.ItemsMainAndStoreGrids.GetAll().AsQueryable();

                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    query = query.Where(x => x.StoreNo == request.StoreId.Value);

                if (request.DepartmentId.HasValue && request.DepartmentId.Value != Guid.Empty)
                    query = query.Where(x => x.DepartmentID == request.DepartmentId.Value);

                query = query.Where(x => x.Department != null && x.Department.Trim() != "");

                // Materialize filtered data first to avoid EF translation issues with GroupBy + First()
                var list = query.ToList();

                var grouped = list
                    .GroupBy(x => x.ItemID)
                    .Select(g =>
                    {
                        var first = g.First();
                        return new ItemInventorySummaryDto
                        {
                            ItemId = g.Key,
                            ItemNo = first.ModalNumber ?? first.CustomerCode ?? g.Key.ToString(),
                            ItemName = first.Description ?? first.Name ?? "",
                            DepartmentName = first.Department ?? "",
                            ItemCount = g.Count(),
                            TotalQtyOnHand = g.Sum(x => x.OnHand),
                            TotalRetailValue = g.Sum(x => x.Price * x.OnHand),
                            TotalCostValue = g.Sum(x => (x.Cost ?? 0) * x.OnHand)
                        };
                    })
                    .OrderBy(x => x.ItemName)
                    .ThenBy(x => x.ItemNo)
                    .ToList();

                var totalRecords = grouped.Count;
                var start = request.StartRow;
                var take = Math.Max(0, request.EndRow - request.StartRow);
                var page = grouped.Skip(start).Take(take).ToList();

                var response = new ItemInventorySummaryResponseDto
                {
                    Data = page,
                    TotalRecords = totalRecords,
                    GrandTotalQtyOnHand = grouped.Sum(x => x.TotalQtyOnHand),
                    GrandTotalRetailValue = grouped.Sum(x => x.TotalRetailValue),
                    GrandTotalCostValue = grouped.Sum(x => x.TotalCostValue)
                };

                return ApiResponseFactory.Success(response, "Item inventory summary report fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemInventorySummaryResponseDto>("Error fetching item inventory summary report.", new List<string> { ex.Message });
            }
        }

        /// <summary>
        /// Gets Departments Valuation report (same logic as desktop): calls SP_GetDepartments when available;
        /// falls back to LINQ on ItemMainAndStoreGrid view when the SP is missing or fails.
        /// </summary>
        public async Task<ApiResponse<DepartmentsValuationResponseDto>> GetDepartmentsValuationReportAsync(DepartmentsValuationRequestDto request)
        {
            try
            {
                List<DepartmentsValuationRowDto> data;
                try
                {
                    var list = await _dbContext.Procedures.Sp_GetDepartmentsAsync(
                        request.StoreId,
                        request.AsOfDate);

                    data = list.Select(r => new DepartmentsValuationRowDto
                    {
                        MainDepartment = r.MainDepartment ?? "",
                        SubDepartment = r.SubDepartment ?? "",
                        SubSubDepartment = r.SubSubDepartment ?? "",
                        DepartmentStoreID = r.DepartmentStoreID,
                        Name = r.Name ?? "",
                        OnHand = r.OnHand ?? 0,
                        OnOrder = r.OnOrder ?? 0,
                        OnSaleOrder = 0,
                        Cost = r.Cost ?? 0,
                        AVGCost = r.AVGCost ?? 0,
                        Price = r.Price ?? 0,
                        StoreName = r.StoreName ?? "",
                        StoreID = r.StoreID
                    }).ToList();
                }
                catch
                {
                    // Fallback: build from ItemMainAndStoreGrid view when SP is missing or fails (e.g. SP_GetDepartments not in tenant DB)
                    data = GetDepartmentsValuationFromView(request);
                }

                var response = new DepartmentsValuationResponseDto
                {
                    Data = data,
                    TotalRecords = data.Count,
                    GrandTotalOnHand = data.Sum(x => x.OnHand),
                    GrandTotalOnOrder = data.Sum(x => x.OnOrder),
                    GrandTotalOnSaleOrder = data.Sum(x => x.OnSaleOrder),
                    GrandTotalCost = data.Sum(x => x.Cost),
                    GrandTotalAVGCost = data.Sum(x => x.AVGCost),
                    GrandTotalPrice = data.Sum(x => x.Price)
                };

                return ApiResponseFactory.Success(response, "Departments valuation report fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<DepartmentsValuationResponseDto>("Error fetching departments valuation report.", new List<string> { ex.Message });
            }
        }

        /// <summary>
        /// Gets Price Change History report using Web_SP_GetPriceChange with server-side pagination.
        /// Date range bounded; ItemStoreID, store, user, department filters are pushed into @Filter SQL.
        /// AG-Grid column FilterModel / SortColumn are intentionally ignored here — the SP paginates the
        /// raw result set with a fixed ChangeDate DESC sort. To restore column-level filter/sort, push
        /// those predicates into the @Filter string instead of filtering after pagination.
        /// </summary>
        public async Task<ApiResponse<PriceChangeHistoryResponseDto>> GetPriceChangeHistoryReportAsync(PriceChangeHistoryRequestDto request)
        {
            try
            {
                request ??= new PriceChangeHistoryRequestDto();

                var isItemLevel = request.ItemStoreID.HasValue && request.ItemStoreID.Value != Guid.Empty;
                const int maxDays = 366;
                const int maxDaysItemLevel = 7300;
                var toDate = request.ToDate ?? DateTime.Today;
                var fromDate = request.FromDate ?? toDate.AddDays(-31);
                if (fromDate > toDate)
                    fromDate = toDate.AddDays(-31);
                var rangeDays = (toDate.Date - fromDate.Date).Days;
                var effectiveMaxDays = isItemLevel ? maxDaysItemLevel : maxDays;
                if (rangeDays > effectiveMaxDays)
                    fromDate = toDate.AddDays(-effectiveMaxDays);

                var filter = " AND [Date]>='" + fromDate.ToString("yyyy-MM-dd") + "'";
                filter += " And [Date]<'" + toDate.Date.AddDays(1).ToString("yyyy-MM-dd") + "'";
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    filter += BuildPriceChangeInFilter("StoreNo", new[] { request.StoreId.Value.ToString() });
                if (request.UserIds != null && request.UserIds.Count > 0)
                    filter += BuildPriceChangeInFilter("UserID", request.UserIds.Select(id => id.ToString()).ToList());

                var departmentIdsForFilter = request.DepartmentIds != null && request.DepartmentIds.Count > 0
                    ? new List<Guid>(request.DepartmentIds)
                    : new List<Guid>();
                if (request.IncludeSubDepartments && departmentIdsForFilter.Count > 0)
                {
                    var expanded = new List<Guid>();
                    foreach (var deptId in departmentIdsForFilter)
                    {
                        expanded.Add(deptId);
                        var subs = await _dbContext.Procedures.SP_GetSubDepartmentsAsync(deptId);
                        if (subs != null)
                            foreach (var row in subs)
                                if (row.MAINID.HasValue) expanded.Add(row.MAINID.Value);
                    }
                    departmentIdsForFilter = expanded.Distinct().ToList();
                }
                if (departmentIdsForFilter.Count > 0)
                    filter += BuildPriceChangeInFilter("DepartmentID", departmentIdsForFilter.Select(id => id.ToString()).ToList());

                // Item-level filter pushed into SP @Filter so server-side paging stays correct.
                if (isItemLevel)
                    filter += " And PriceChangeHistory.ItemStoreID = '" + request.ItemStoreID!.Value + "'";

                const string itemFilter = " And 1=1 ";

                // Server-side pagination: prefer explicit PageNumber/PageSize from request,
                // otherwise derive from AG-Grid StartRow/EndRow.
                var pageSize = request.PageSize.GetValueOrDefault();
                if (pageSize <= 0) pageSize = request.EndRow > request.StartRow ? request.EndRow - request.StartRow : 50;
                var pageNumber = request.PageNumber.GetValueOrDefault();
                if (pageNumber <= 0) pageNumber = (request.StartRow / pageSize) + 1;

                var data = new List<PriceChangeHistoryDto>();
                int totalRecords = 0;

                var previousTimeout = _dbContext.Database.GetCommandTimeout();
                _dbContext.Database.SetCommandTimeout(120);
                try
                {
                    var conn = _dbContext.Database.GetDbConnection();
                    if (conn.State != ConnectionState.Open)
                        await conn.OpenAsync();

                    using var cmd = conn.CreateCommand();
                    cmd.CommandText = "[dbo].[Web_SP_GetPriceChange]";
                    cmd.CommandType = CommandType.StoredProcedure;
                    cmd.CommandTimeout = 120;

                    var pFilter = cmd.CreateParameter();
                    pFilter.ParameterName = "Filter";
                    pFilter.Value = (object?)filter ?? DBNull.Value;
                    pFilter.DbType = DbType.String;
                    cmd.Parameters.Add(pFilter);

                    var pItemFilter = cmd.CreateParameter();
                    pItemFilter.ParameterName = "ItemFilter";
                    pItemFilter.Value = itemFilter;
                    pItemFilter.DbType = DbType.String;
                    cmd.Parameters.Add(pItemFilter);

                    var pPageNumber = cmd.CreateParameter();
                    pPageNumber.ParameterName = "PageNumber";
                    pPageNumber.Value = pageNumber;
                    pPageNumber.DbType = DbType.Int32;
                    cmd.Parameters.Add(pPageNumber);

                    var pPageSize = cmd.CreateParameter();
                    pPageSize.ParameterName = "PageSize";
                    pPageSize.Value = pageSize;
                    pPageSize.DbType = DbType.Int32;
                    cmd.Parameters.Add(pPageSize);

                    using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();

                    var totalOrdinal = -1;
                    for (var i = 0; i < reader.FieldCount; i++)
                        if (string.Equals(reader.GetName(i), "TotalRecords", StringComparison.OrdinalIgnoreCase))
                        { totalOrdinal = i; break; }

                    while (await reader.ReadAsync())
                    {
                        var dto = ReadPriceChangeHistoryRow(reader);
                        if (dto != null) data.Add(dto);
                        if (totalRecords == 0 && totalOrdinal >= 0 && !reader.IsDBNull(totalOrdinal))
                            totalRecords = Convert.ToInt32(reader.GetValue(totalOrdinal));
                    }
                }
                finally
                {
                    _dbContext.Database.SetCommandTimeout(previousTimeout);
                }

                var response = new PriceChangeHistoryResponseDto
                {
                    Data = data,
                    TotalRecords = totalRecords
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PriceChangeHistoryResponseDto>($"Failed to generate Price Change History report: {ex.Message}");
            }
        }

        /// <summary>
        /// Builds Departments Valuation data from ItemMainAndStoreGrid view (fallback when SP_GetDepartments is not available).
        /// Optimized: grouping and aggregation run in the database; only aggregated rows are materialized.
        /// </summary>
        private List<DepartmentsValuationRowDto> GetDepartmentsValuationFromView(DepartmentsValuationRequestDto request)
        {
            var query = _dbContext.ItemMainAndStoreGrids.AsNoTracking().AsQueryable();

            if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                query = query.Where(x => x.StoreNo == request.StoreId.Value);

            query = query.Where(x => x.Department != null && x.Department.Trim() != "");

            // Run GroupBy + aggregates in DB; project to anonymous type to avoid complex expressions in SQL
            var aggregated = query
                .GroupBy(x => new
                {
                    x.StoreNo,
                    StoreName = x.StoreName ?? "",
                    DepartmentID = x.DepartmentID,
                    DepartmentName = x.Department ?? "",
                    MainDepartment = x.MainDepartment ?? "",
                    SubDepartment = x.SubDepartment ?? "",
                    SubSubDepartment = x.SubSubDepartment ?? ""
                })
                .Select(g => new
                {
                    g.Key,
                    OnHand = g.Sum(x => x.OnHand),
                    OnOrder = g.Sum(x => x.OnOrder),
                    CostSum = g.Sum(x => (x.Cost ?? 0) * x.OnHand),
                    AvgCostWeighted = g.Sum(x => (x.AVGCost ?? 0) * x.OnHand),
                    PriceSum = g.Sum(x => x.Price * x.OnHand)
                })
                .OrderBy(x => x.Key.MainDepartment).ThenBy(x => x.Key.SubDepartment).ThenBy(x => x.Key.SubSubDepartment).ThenBy(x => x.Key.DepartmentName).ThenBy(x => x.Key.StoreName)
                .ToList();

            // Lightweight in-memory projection (weighted avg for AVGCost)
            return aggregated.Select(a => new DepartmentsValuationRowDto
            {
                MainDepartment = a.Key.MainDepartment,
                SubDepartment = a.Key.SubDepartment,
                SubSubDepartment = a.Key.SubSubDepartment,
                DepartmentStoreID = a.Key.DepartmentID,
                Name = a.Key.DepartmentName,
                OnHand = a.OnHand,
                OnOrder = a.OnOrder,
                OnSaleOrder = 0,
                Cost = a.CostSum,
                AVGCost = a.OnHand > 0 ? a.AvgCostWeighted / a.OnHand : 0,
                Price = a.PriceSum,
                StoreName = a.Key.StoreName,
                StoreID = a.Key.StoreNo
            }).ToList();
        }

        /// <summary>
        /// Items in Partial Receive report - Sp_rptOpenPartialPO. Filter format matches desktop RepPartialPO GetFilter.
        /// </summary>
        public async Task<ApiResponse<ItemsInPartialReceiveResponseDto>> GetItemsInPartialReceiveReportAsync(ItemsInPartialReceiveRequestDto request)
        {
            try
            {
                var parts = new List<string>();

                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    parts.Add($"PurchaseOrdersView.StoreNo ='{request.StoreId.Value}'");

                if (request.FromDate.HasValue)
                    parts.Add($"dbo.GetDay(PurchaseOrderDate)>='{request.FromDate.Value:yyyy-MM-dd}'");
                if (request.ToDate.HasValue)
                    parts.Add($"dbo.GetDay(PurchaseOrderDate)<='{request.ToDate.Value:yyyy-MM-dd}'");

                if (!string.IsNullOrWhiteSpace(request.DepartmentIds))
                {
                    var ids = request.DepartmentIds.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim())
                        .Where(x => Guid.TryParse(x, out _))
                        .Select(x => $"'{x}'")
                        .ToList();
                    if (ids.Count > 0)
                        parts.Add($"DepartmentID IN({string.Join(",", ids)})");
                }

                if (!string.IsNullOrWhiteSpace(request.SupplierIds))
                {
                    var ids = request.SupplierIds.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim())
                        .Where(x => Guid.TryParse(x, out _))
                        .Select(x => $"'{x}'")
                        .ToList();
                    if (ids.Count > 0)
                        parts.Add($"ItemStoreID in(SELECT ItemStoreNo FROM ItemSupply where SupplierNo in({string.Join(",", ids)}))");
                }

                if (!string.IsNullOrWhiteSpace(request.BrandNames))
                {
                    var names = request.BrandNames.Split(new[] { '|' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim().Replace("'", "''"))
                        .Where(x => x.Length > 0)
                        .Select(x => $"'{x}'")
                        .ToList();
                    if (names.Count > 0)
                        parts.Add($"Brand IN({string.Join(",", names)})");
                }

                var filter = parts.Count > 0 ? " AND " + string.Join(" AND ", parts) : "";

                List<ItemsInPartialReceiveRowDto> data;
                try
                {
                    var conn = _dbContext.Database.GetDbConnection();
                    if (conn.State != ConnectionState.Open)
                        await conn.OpenAsync();

                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText = "[dbo].[Web_Sp_rptOpenPartialPO]";
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.CommandTimeout = 120;

                        var pFilter = cmd.CreateParameter();
                        pFilter.ParameterName = "@Filter";
                        pFilter.Value = filter ?? "";
                        pFilter.DbType = DbType.String;
                        pFilter.Size = -1;
                        cmd.Parameters.Add(pFilter);

                        AddParam((DbCommand)cmd, "PageNumber", 1, DbType.Int32);
                        AddParam((DbCommand)cmd, "PageSize",   int.MaxValue, DbType.Int32);

                        data = new List<ItemsInPartialReceiveRowDto>();
                        using (var reader = await ((System.Data.Common.DbCommand)cmd).ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                var dto = ReadItemsInPartialReceiveRow(reader);
                                if (dto != null)
                                    data.Add(dto);
                            }
                            if (data.Count == 0 && await reader.NextResultAsync())
                            {
                                while (await reader.ReadAsync())
                                {
                                    var dto = ReadItemsInPartialReceiveRow(reader);
                                    if (dto != null)
                                        data.Add(dto);
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException($"Sp_rptOpenPartialPO failed: {ex.Message}", ex);
                }

                var response = new ItemsInPartialReceiveResponseDto
                {
                    Data = data,
                    TotalRecords = data.Count
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemsInPartialReceiveResponseDto>($"Failed to generate Items in Partial Receive report: {ex.Message}");
            }
        }

        /// <summary>
        /// Get column index by name (case-insensitive), or try alternate names. Returns -1 if not found.
        /// </summary>
        private static int GetColumnIndex(System.Data.Common.DbDataReader reader, params string[] names)
        {
            for (var i = 0; i < reader.FieldCount; i++)
            {
                var name = reader.GetName(i);
                foreach (var n in names)
                {
                    if (string.Equals(name, n, StringComparison.OrdinalIgnoreCase))
                        return i;
                }
            }
            return -1;
        }

        private static ItemsInPartialReceiveRowDto? ReadItemsInPartialReceiveRow(System.Data.Common.DbDataReader reader)
        {
            try
            {
                static string S(System.Data.Common.DbDataReader r, params string[] cols)
                {
                    var i = GetColumnIndex(r, cols);
                    if (i < 0) return "";
                    return r.IsDBNull(i) ? "" : r.GetString(i);
                }
                static decimal? N(System.Data.Common.DbDataReader r, params string[] cols)
                {
                    var i = GetColumnIndex(r, cols);
                    if (i < 0) return null;
                    if (r.IsDBNull(i)) return null;
                    var v = r.GetValue(i);
                    if (v == null) return null;
                    if (v is decimal d) return d;
                    if (v is double dbl) return (decimal)dbl;
                    if (v is int n) return n;
                    if (v is long l) return l;
                    if (v is float f) return (decimal)f;
                    return decimal.TryParse(v.ToString(), out var parsed) ? parsed : null;
                }
                static Guid? G(System.Data.Common.DbDataReader r, params string[] cols)
                {
                    var i = GetColumnIndex(r, cols);
                    if (i < 0) return null;
                    if (r.IsDBNull(i)) return null;
                    var val = r.GetValue(i);
                    if (val is Guid g) return g;
                    if (val is string s && Guid.TryParse(s, out var parsed)) return parsed;
                    return null;
                }
                static DateTime? D(System.Data.Common.DbDataReader r, params string[] cols)
                {
                    var i = GetColumnIndex(r, cols);
                    if (i < 0) return null;
                    if (r.IsDBNull(i)) return null;
                    var v = r.GetValue(i);
                    if (v == null) return null;
                    if (v is DateTime dt) return dt;
                    return DateTime.TryParse(v.ToString(), out var parsed) ? parsed : (DateTime?)null;
                }

                return new ItemsInPartialReceiveRowDto
                {
                    StoreName = S(reader, "StoreName"),
                    StoreID = G(reader, "StoreID", "StoreNo"),
                    PurchaseOrderDate = D(reader, "PurchaseOrderDate"),
                    PoNo = S(reader, "PoNo"),
                    SupplierNo = S(reader, "SupplierNo"),
                    SupplierName = S(reader, "SupplierName"),
                    UPC = S(reader, "UPC"),
                    QtyOrdered = N(reader, "QtyOrdered"),
                    ReceivedQty = N(reader, "ReceivedQty"),
                    ModalNumber = S(reader, "ModalNumber"),
                    ItemName = S(reader, "ItemName", "Name"),
                    Department = S(reader, "Department"),
                    ItemStoreID = G(reader, "ItemStoreID", "ItemStoreNo"),
                    ItemID = G(reader, "ItemID"),
                    Brand = S(reader, "Brand"),
                    TotalCost = N(reader, "TotalCost"),
                    TotalPrice = N(reader, "TotalPrice"),
                    Groups = S(reader, "Groups")
                };
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Receive Inventory Value report - Sp_rptRecicveValue. Filter format matches desktop RptReceiveValue GetFilter.
        /// </summary>
        public async Task<ApiResponse<ReceiveInventoryValueResponseDto>> GetReceiveInventoryValueReportAsync(ReceiveInventoryValueRequestDto request)
        {
            try
            {
                var parts = new List<string>();

                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    parts.Add($"ReceiveOrder.StoreID ='{request.StoreId.Value}'");

                if (request.FromDate.HasValue)
                    parts.Add($"dbo.GetDay(ReceiveOrderDate)>='{request.FromDate.Value:yyyy-MM-dd}'");
                if (request.ToDate.HasValue)
                    parts.Add($"dbo.GetDay(ReceiveOrderDate)<='{request.ToDate.Value:yyyy-MM-dd}'");

                if (!string.IsNullOrWhiteSpace(request.DepartmentIds))
                {
                    var ids = request.DepartmentIds.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim())
                        .Where(x => Guid.TryParse(x, out _))
                        .Select(x => $"'{x}'")
                        .ToList();
                    if (ids.Count > 0)
                        parts.Add($"DepartmentID IN({string.Join(",", ids)})");
                }

                if (!string.IsNullOrWhiteSpace(request.SupplierIds))
                {
                    var ids = request.SupplierIds.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim())
                        .Where(x => Guid.TryParse(x, out _))
                        .Select(x => $"'{x}'")
                        .ToList();
                    if (ids.Count > 0)
                        parts.Add($"ItemMainAndStoreView.ItemStoreID in(SELECT ItemStoreNo FROM ItemSupply where SupplierNo in({string.Join(",", ids)}))");
                }

                if (!string.IsNullOrWhiteSpace(request.BrandNames))
                {
                    var names = request.BrandNames.Split(new[] { '|' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim().Replace("'", "''"))
                        .Where(x => x.Length > 0)
                        .Select(x => $"'{x}'")
                        .ToList();
                    if (names.Count > 0)
                        parts.Add($"Brand IN({string.Join(",", names)})");
                }

                var filter = parts.Count > 0 ? " AND " + string.Join(" AND ", parts) : "";

                List<ReceiveInventoryValueRowDto> data;
                try
                {
                    var conn = _dbContext.Database.GetDbConnection();
                    if (conn.State != ConnectionState.Open)
                        await conn.OpenAsync();

                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText = "[dbo].[Web_Sp_rptRecicveValue]";
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.CommandTimeout = 120;

                        var pFilter = cmd.CreateParameter();
                        pFilter.ParameterName = "@Filter";
                        pFilter.Value = filter ?? "";
                        pFilter.DbType = DbType.String;
                        pFilter.Size = -1;
                        cmd.Parameters.Add(pFilter);

                        AddParam((DbCommand)cmd, "PageNumber", 1, DbType.Int32);
                        AddParam((DbCommand)cmd, "PageSize",   int.MaxValue, DbType.Int32);

                        data = new List<ReceiveInventoryValueRowDto>();
                        using (var reader = await ((System.Data.Common.DbCommand)cmd).ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                var dto = ReadReceiveInventoryValueRow(reader);
                                if (dto != null)
                                    data.Add(dto);
                            }
                            if (data.Count == 0 && await reader.NextResultAsync())
                            {
                                while (await reader.ReadAsync())
                                {
                                    var dto = ReadReceiveInventoryValueRow(reader);
                                    if (dto != null)
                                        data.Add(dto);
                                }
                            }
                            while (await reader.NextResultAsync())
                            {
                                while (await reader.ReadAsync()) { }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException($"Sp_rptRecicveValue failed: {ex.Message}", ex);
                }

                var response = new ReceiveInventoryValueResponseDto
                {
                    Data = data,
                    TotalRecords = data.Count
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ReceiveInventoryValueResponseDto>(
                    $"Failed to generate Receive Inventory Value report: {ex.Message}");
            }
        }

        private static ReceiveInventoryValueRowDto? ReadReceiveInventoryValueRow(System.Data.Common.DbDataReader reader)
        {
            try
            {
                static string S(System.Data.Common.DbDataReader r, params string[] cols)
                {
                    var i = GetColumnIndex(r, cols);
                    if (i < 0) return "";
                    return r.IsDBNull(i) ? "" : r.GetValue(i)?.ToString() ?? "";
                }
                static decimal? N(System.Data.Common.DbDataReader r, params string[] cols)
                {
                    var i = GetColumnIndex(r, cols);
                    if (i < 0) return null;
                    if (r.IsDBNull(i)) return null;
                    var v = r.GetValue(i);
                    if (v == null) return null;
                    if (v is decimal d) return d;
                    if (v is double dbl) return (decimal)dbl;
                    if (v is int n) return n;
                    if (v is long l) return l;
                    if (v is float f) return (decimal)f;
                    return decimal.TryParse(v.ToString(), out var parsed) ? parsed : null;
                }

                return new ReceiveInventoryValueRowDto
                {
                    MainDepartment = S(reader, "MainDepartment"),
                    SubDepartment = S(reader, "SubDepartment"),
                    SubSubDepartment = S(reader, "SubSubDepartment"),
                    Department = S(reader, "Department"),
                    Qty = N(reader, "Qty"),
                    Cost = N(reader, "Cost"),
                    Price = N(reader, "Price"),
                    StoreName = S(reader, "StoreName")
                };
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Items on Receive Order report - Sp_PO_Receive_Report.
        /// </summary>
        public async Task<ApiResponse<ItemsOnReceiveOrderResponseDto>> GetItemsOnReceiveOrderReportAsync(ItemsOnReceiveOrderRequestDto request)
        {
            try
            {
                var parts = new List<string>();

                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    parts.Add($"ReceiveOrder.StoreID ='{request.StoreId.Value}'");

                if (request.FromDate.HasValue)
                    parts.Add($"dbo.GetDay(ReceiveOrderDate)>='{request.FromDate.Value:yyyy-MM-dd}'");
                if (request.ToDate.HasValue)
                    parts.Add($"dbo.GetDay(ReceiveOrderDate)<='{request.ToDate.Value:yyyy-MM-dd}'");

                if (!string.IsNullOrWhiteSpace(request.DepartmentFilter))
                {
                    // DepartmentFilter may be a raw SQL fragment or comma-separated GUIDs
                    var ids = request.DepartmentFilter.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim())
                        .Where(x => Guid.TryParse(x, out _))
                        .Select(x => $"'{x}'")
                        .ToList();
                    if (ids.Count > 0)
                        parts.Add($"DepartmentID IN({string.Join(",", ids)})");
                }

                if (!string.IsNullOrWhiteSpace(request.SupplierIds))
                {
                    var ids = request.SupplierIds.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                        .Select(x => x.Trim())
                        .Where(x => Guid.TryParse(x, out _))
                        .Select(x => $"'{x}'")
                        .ToList();
                    if (ids.Count > 0)
                        parts.Add($"ItemMainAndStoreView.ItemStoreID in(SELECT ItemStoreNo FROM ItemSupply where SupplierNo in({string.Join(",", ids)}))");
                }

                var filter = parts.Count > 0 ? " AND " + string.Join(" AND ", parts) : "";

                List<ItemsOnReceiveOrderRowDto> data;
                try
                {
                    var conn = _dbContext.Database.GetDbConnection();
                    if (conn.State != ConnectionState.Open)
                        await conn.OpenAsync();

                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText = "[dbo].[Web_Sp_PO_Receive_Report]";
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.CommandTimeout = 120;

                        var pFilter = cmd.CreateParameter();
                        pFilter.ParameterName = "@Filter";
                        pFilter.Value = filter ?? "";
                        pFilter.DbType = DbType.String;
                        pFilter.Size = -1;
                        cmd.Parameters.Add(pFilter);

                        AddParam((DbCommand)cmd, "PageNumber", 1, DbType.Int32);
                        AddParam((DbCommand)cmd, "PageSize",   int.MaxValue, DbType.Int32);

                        data = new List<ItemsOnReceiveOrderRowDto>();
                        using (var reader = await ((System.Data.Common.DbCommand)cmd).ExecuteReaderAsync())
                        {
                            while (await reader.ReadAsync())
                            {
                                var dto = ReadItemsOnReceiveOrderRow(reader);
                                if (dto != null)
                                    data.Add(dto);
                            }
                            if (data.Count == 0 && await reader.NextResultAsync())
                            {
                                while (await reader.ReadAsync())
                                {
                                    var dto = ReadItemsOnReceiveOrderRow(reader);
                                    if (dto != null)
                                        data.Add(dto);
                                }
                            }
                            while (await reader.NextResultAsync())
                            {
                                while (await reader.ReadAsync()) { }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException($"Sp_PO_Receive_Report failed: {ex.Message}", ex);
                }

                var response = new ItemsOnReceiveOrderResponseDto
                {
                    Data = data,
                    TotalRecords = data.Count
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemsOnReceiveOrderResponseDto>(
                    $"Failed to generate Items on Receive Order report: {ex.Message}");
            }
        }

        private static ItemsOnReceiveOrderRowDto? ReadItemsOnReceiveOrderRow(System.Data.Common.DbDataReader reader)
        {
            try
            {
                static string S(System.Data.Common.DbDataReader r, string col)
                {
                    try
                    {
                        var i = r.GetOrdinal(col);
                        return r.IsDBNull(i) ? "" : r.GetValue(i)?.ToString() ?? "";
                    }
                    catch { return ""; }
                }
                static decimal? N(System.Data.Common.DbDataReader r, string col)
                {
                    try
                    {
                        var i = r.GetOrdinal(col);
                        if (r.IsDBNull(i)) return null;
                        var v = r.GetValue(i);
                        if (v is decimal d) return d;
                        return decimal.TryParse(v?.ToString(), out var d2) ? d2 : (decimal?)null;
                    }
                    catch { return null; }
                }
                static Guid? G(System.Data.Common.DbDataReader r, string col)
                {
                    try
                    {
                        var i = r.GetOrdinal(col);
                        return r.IsDBNull(i) ? (Guid?)null : r.GetGuid(i);
                    }
                    catch { return null; }
                }

                return new ItemsOnReceiveOrderRowDto
                {
                    StoreName = S(reader, "StoreName"),
                    ItemStoreID = G(reader, "ItemStoreID"),
                    BarcodeNumber = S(reader, "BarcodeNumber"),
                    ModalNumber = S(reader, "ModalNumber"),
                    Name = S(reader, "Name"),
                    ManufacturerName = S(reader, "ManufacturerName"),
                    Department = S(reader, "Department"),
                    OnHand = N(reader, "OnHand"),
                    Supplier = S(reader, "Supplier"),
                    Cost = N(reader, "Cost"),
                    Price = N(reader, "Price"),
                    QtyReceived = N(reader, "QtyReceived"),
                    ReceivedValue = N(reader, "ReceivedValue"),
                    ReceivedSellingPrice = N(reader, "ReceivedSellingPrice"),
                    MainDepartment = S(reader, "MainDepartment"),
                    SubDepartment = S(reader, "SubDepartment"),
                    SubSubDepartment = S(reader, "SubSubDepartment"),
                    CustomField1 = S(reader, "CustomField1"),
                    CustomField2 = S(reader, "CustomField2"),
                    CustomField3 = S(reader, "CustomField3"),
                    CustomField4 = S(reader, "CustomField4"),
                    CustomField5 = S(reader, "CustomField5"),
                    CustomField6 = S(reader, "CustomField6"),
                    CustomField7 = S(reader, "CustomField7"),
                    CustomField8 = S(reader, "CustomField8"),
                    CustomField9 = S(reader, "CustomField9"),
                    CustomField10 = S(reader, "CustomField10")
                };
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// Gets sales history for a specific item using SP_GetSalesHistory.
        /// </summary>
        public async Task<ApiResponse<ItemSalesHistoryResponseDto>> GetItemSalesHistoryAsync(ItemSalesHistoryRequestDto request)
        {
            try
            {
                if (request == null || request.ItemStoreID == Guid.Empty)
                    return ApiResponseFactory.BadRequest<ItemSalesHistoryResponseDto>("ItemStoreID is required.");

                var toDate = request.ToDate ?? DateTime.Today;
                var fromDate = request.FromDate ?? toDate;

                // Build date filter — SP expects full WHERE clause (same as VB.NET desktop app pattern)
                // Column is StartSaleTime, format: " WHERE (StartSaleTime >='yyyy-MM-dd') and (StartSaleTime <'yyyy-MM-dd')"
                var filter = "  WHERE (StartSaleTime >='" + fromDate.ToString("yyyy-MM-dd") + "') and (StartSaleTime <'" + toDate.Date.AddDays(1).ToString("yyyy-MM-dd") + "')";

                var allData = new List<ItemSalesHistoryDto>();
                int totalRecords = 0;
                var previousTimeout = _dbContext.Database.GetCommandTimeout();
                _dbContext.Database.SetCommandTimeout(120);
                try
                {
                    var conn = _dbContext.Database.GetDbConnection();
                    if (conn.State != ConnectionState.Open)
                        await conn.OpenAsync();

                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText = "[dbo].[Web_SP_GetSalesHistory]";
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.CommandTimeout = 120;

                        var pFilter = cmd.CreateParameter();
                        pFilter.ParameterName = "Filter";
                        pFilter.Value = (object?)filter ?? DBNull.Value;
                        pFilter.DbType = DbType.String;
                        cmd.Parameters.Add(pFilter);

                        // IsPOS = false for non-POS sales history (SP fixed to use correct columns)
                        var pIsPOS = cmd.CreateParameter();
                        pIsPOS.ParameterName = "IsPOS";
                        pIsPOS.Value = false;
                        pIsPOS.DbType = DbType.Boolean;
                        cmd.Parameters.Add(pIsPOS);

                        var pItemStoreID = cmd.CreateParameter();
                        pItemStoreID.ParameterName = "ItemStoreID";
                        pItemStoreID.Value = request.ItemStoreID;
                        pItemStoreID.DbType = DbType.Guid;
                        cmd.Parameters.Add(pItemStoreID);

                        // MainStore must be false (not null) — same as VB.NET desktop pattern.
                        var pMainStore = cmd.CreateParameter();
                        pMainStore.ParameterName = "MainStore";
                        pMainStore.Value = false;
                        pMainStore.DbType = DbType.Boolean;
                        cmd.Parameters.Add(pMainStore);

                        // Stores parameter - empty structured table with required column schema
                        var storesTable = new DataTable();
                        storesTable.Columns.Add("Value", typeof(Guid));
                        var pStores = new Microsoft.Data.SqlClient.SqlParameter
                        {
                            ParameterName = "Stores",
                            SqlDbType = SqlDbType.Structured,
                            TypeName = "[dbo].[Guid_list_tbltype]",
                            Value = storesTable
                        };
                        cmd.Parameters.Add(pStores);

                        // Web_SP_GetSalesHistory always paginates; pass requested page or fetch-all (PageSize=int.MaxValue) for back-compat.
                        var usePagination = request.PageNumber.HasValue && request.PageSize.HasValue
                                            && request.PageNumber.Value > 0 && request.PageSize.Value > 0;
                        var effectivePageNumber = usePagination ? request.PageNumber!.Value : 1;
                        var effectivePageSize   = usePagination ? request.PageSize!.Value   : int.MaxValue;

                        AddParam((DbCommand)cmd, "PageNumber", effectivePageNumber, DbType.Int32);
                        AddParam((DbCommand)cmd, "PageSize",   effectivePageSize,   DbType.Int32);

                        using (var reader = await ((System.Data.Common.DbCommand)cmd).ExecuteReaderAsync())
                        {
                            // Web_SP_GetSalesHistory returns single result set; TotalRecords is a column on every row.
                            var oTotalRec = OrdOf(reader, "TotalRecords");
                            while (await reader.ReadAsync())
                            {
                                var dto = ReadSalesHistoryRow(reader);
                                if (dto != null)
                                    allData.Add(dto);
                                if (totalRecords == 0 && oTotalRec >= 0 && !reader.IsDBNull(oTotalRec))
                                    totalRecords = Convert.ToInt32(reader.GetValue(oTotalRec));
                            }
                            if (!usePagination)
                                totalRecords = allData.Count;
                        }
                    }
                }
                finally
                {
                    _dbContext.Database.SetCommandTimeout(previousTimeout);
                }

                var totalAmount = allData.Where(d => d.Total.HasValue).Sum(d => d.Total!.Value);

                return ApiResponseFactory.Success(new ItemSalesHistoryResponseDto
                {
                    Data = allData,
                    TotalRecords = totalRecords,
                    TotalAmount = totalAmount
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemSalesHistoryResponseDto>(
                    $"Error getting sales history: {ex.Message}");
            }
        }

        /// <summary>
        /// Reads one row from SP_GetSalesHistory result set into ItemSalesHistoryDto.
        /// Uses dynamic column name resolution to handle different SP versions.
        /// </summary>
        private static ItemSalesHistoryDto? ReadSalesHistoryRow(System.Data.Common.DbDataReader reader)
        {
            try
            {
                string? getStr(params string[] names)
                {
                    foreach (var name in names)
                        for (var i = 0; i < reader.FieldCount; i++)
                            if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                                return reader.IsDBNull(i) ? null : reader.GetValue(i)?.ToString();
                    return null;
                }
                DateTime? getDate(params string[] names)
                {
                    foreach (var name in names)
                        for (var i = 0; i < reader.FieldCount; i++)
                            if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                                return reader.IsDBNull(i) ? (DateTime?)null : reader.GetDateTime(i);
                    return null;
                }
                decimal? getDec(params string[] names)
                {
                    foreach (var name in names)
                        for (var i = 0; i < reader.FieldCount; i++)
                            if (string.Equals(reader.GetName(i), name, StringComparison.OrdinalIgnoreCase))
                            {
                                if (reader.IsDBNull(i)) return null;
                                var v = reader.GetValue(i);
                                if (v is decimal d) return d;
                                if (v != null && decimal.TryParse(v.ToString(), out var d2)) return d2;
                                return null;
                            }
                    return null;
                }

                return new ItemSalesHistoryDto
                {
                    TransactionNo = getStr("TransactionNo", "TransactionNumber", "Transaction", "TransNo"),
                    Date = getDate("Date", "SaleDate", "TransDate"),
                    SaleTime = getDate("SaleTime", "StartSaleTime", "Time"),
                    QtyCaseQty = getDec("QtyCaseQty", "QtyCas", "QtyCase", "CaseQty"),
                    Price = getDec("Price", "SalePrice", "UnitPrice"),
                    Qty = getDec("Qty", "Quantity", "PcQty"),
                    Total = getDec("Total", "Amount", "TotalAmount", "LineTotal"),
                    StoreName = getStr("StoreName", "Store", "StoreNumber"),
                    CustomerNo = getStr("CustomerNo", "CustomerNumber", "CustNo"),
                    Type = getStr("Type", "SaleType", "TransType"),
                    CustomerName = getStr("CustomerName", "CustName", "Customer"),
                    Qty2 = getDec("Qty2", "Qty-2", "Quantity2")
                };
            }
            catch { return null; }
        }

        /// <summary>
        /// Gets date scope presets from the DateScope table.
        /// </summary>
        public async Task<ApiResponse<List<DateScopeDto>>> GetDateScopesAsync()
        {
            try
            {
                var scopes = await _dbContext.DateScopes
                    .Where(s => s.Status == 1)
                    .OrderBy(s => s.SortOrder)
                    .Select(s => new DateScopeDto
                    {
                        ScopeID = s.ScopeID,
                        Description = s.Description ?? "",
                        FromDate = s.FromDate,
                        ToDate = s.ToDate,
                        SortOrder = s.SortOrder
                    })
                    .ToListAsync();

                return ApiResponseFactory.Success(scopes);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<DateScopeDto>>(
                    $"Error getting date scopes: {ex.Message}");
            }
        }

        private class FilterCondition
        {
            public string Col { get; set; } = string.Empty;
            public string Type { get; set; } = string.Empty;
            public string Value { get; set; } = string.Empty;
            public string OperatorType { get; set; } = "and";
        }

        // =============================================================================================
        // Reconcile Batch (desktop BatchReconciles) + Total Tenders for Shift (desktop RepTendersShift)
        // =============================================================================================

        public async Task<ApiResponse<ReconcileBatchInitResponseDto>> InitReconcileBatchAsync(ReconcileBatchInitRequestDto request)
        {
            try
            {
                request ??= new ReconcileBatchInitRequestDto();
                if (request.RegShiftID == Guid.Empty)
                    return ApiResponseFactory.BadRequest<ReconcileBatchInitResponseDto>("RegShiftID is required.");

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                // 1) Seed BatchRec rows for this shift (idempotent — desktop calls this on every Start()).
                using (var seed = conn.CreateCommand())
                {
                    seed.CommandText = "[dbo].[SP_AddBatchToRec]";
                    seed.CommandType = CommandType.StoredProcedure;
                    AddParam((DbCommand)seed, "BatchID", request.RegShiftID, DbType.Guid);
                    await ((DbCommand)seed).ExecuteNonQueryAsync();
                }

                // 2) Read shift header (ShiftNO, Status, OpeningAmount).
                var resp = new ReconcileBatchInitResponseDto { RegShiftID = request.RegShiftID };
                using (var hdr = conn.CreateCommand())
                {
                    hdr.CommandText = @"SELECT ShiftNO,
                                               CASE WHEN Status = 1 THEN 'OPEN'
                                                    WHEN Status = 3 THEN 'RECONCILE'
                                                    ELSE 'CLOSE' END AS Status,
                                               OpeningAmount
                                        FROM RegShift WHERE RegShiftID = @id";
                    hdr.CommandType = CommandType.Text;
                    AddParam((DbCommand)hdr, "id", request.RegShiftID, DbType.Guid);
                    using var hr = await ((DbCommand)hdr).ExecuteReaderAsync();
                    if (await hr.ReadAsync())
                    {
                        resp.ShiftNo       = ReadStr(hr, 0);
                        resp.Status        = ReadStr(hr, 1);
                        resp.OpeningAmount = hr.IsDBNull(2) ? (decimal?)null : Convert.ToDecimal(hr.GetValue(2));
                    }
                }

                // 3) Load BatchRec rows. CASH expected = ExpectedAmount + OpeningAmount (desktop LoadGrid).
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"SELECT br.BatchRecID, br.TenderID, br.TenderName,
                                               br.ExpectedAmount, br.ExpectedCount,
                                               br.PickUpAmount, br.PickUpCount, br.Note
                                        FROM BatchRec br
                                        WHERE br.BatchID = @id
                                        ORDER BY ISNULL(br.SortOrder, 999999), br.BatchRecID";
                    cmd.CommandType = CommandType.Text;
                    AddParam((DbCommand)cmd, "id", request.RegShiftID, DbType.Guid);

                    using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var tenderName  = ReadStr(reader, 2);
                        var expected    = reader.IsDBNull(3) ? (decimal?)null : Convert.ToDecimal(reader.GetValue(3));
                        var expCount    = reader.IsDBNull(4) ? (int?)null     : Convert.ToInt32(reader.GetValue(4));
                        var pickAmount  = reader.IsDBNull(5) ? (decimal?)null : Convert.ToDecimal(reader.GetValue(5));
                        var pickCount   = reader.IsDBNull(6) ? (int?)null     : Convert.ToInt32(reader.GetValue(6));
                        var isCash      = string.Equals(tenderName, "CASH", StringComparison.OrdinalIgnoreCase);
                        var effExpected = isCash ? (expected ?? 0m) + (resp.OpeningAmount ?? 0m) : expected;

                        resp.Rows.Add(new ReconcileBatchRowDto
                        {
                            BatchRecID     = Convert.ToInt32(reader.GetValue(0)),
                            TenderID       = Convert.ToInt32(reader.GetValue(1)),
                            TenderName     = tenderName,
                            ExpectedAmount = effExpected,
                            ExpectedCount  = expCount,
                            PickUpAmount   = pickAmount,
                            PickUpCount    = pickCount,
                            OverShort      = (effExpected ?? 0m) - (pickAmount ?? 0m),
                            Note           = ReadStr(reader, 7)
                        });
                    }
                }

                return ApiResponseFactory.Success(resp);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ReconcileBatchInitResponseDto>($"Failed to initialize reconcile: {ex.Message}");
            }
        }

        public async Task<ApiResponse<ReconcileBatchSaveResponseDto>> SaveReconcileBatchAsync(ReconcileBatchSaveRequestDto request)
        {
            try
            {
                request ??= new ReconcileBatchSaveRequestDto();
                if (request.RegShiftID == Guid.Empty)
                    return ApiResponseFactory.BadRequest<ReconcileBatchSaveResponseDto>("RegShiftID is required.");

                var rows = request.Rows ?? new List<ReconcileBatchSaveRowDto>();
                int updated = 0;

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                // Update each BatchRec row individually. The list is small (one row per tender) so a
                // per-row update is acceptable; if needed we can switch to a TVP-based bulk update later.
                using (var tx = await ((DbConnection)conn).BeginTransactionAsync())
                {
                    foreach (var r in rows)
                    {
                        using var cmd = conn.CreateCommand();
                        cmd.Transaction = tx;
                        cmd.CommandText = @"UPDATE BatchRec
                                            SET PickUpAmount = @amt,
                                                PickUpCount  = @cnt,
                                                Note         = @note
                                            WHERE BatchRecID = @id AND BatchID = @shift";
                        cmd.CommandType = CommandType.Text;
                        AddParam((DbCommand)cmd, "amt",   (object?)r.PickUpAmount ?? DBNull.Value, DbType.Decimal);
                        AddParam((DbCommand)cmd, "cnt",   (object?)r.PickUpCount  ?? DBNull.Value, DbType.Int32);
                        AddParam((DbCommand)cmd, "note",  (object?)r.Note         ?? DBNull.Value, DbType.String);
                        AddParam((DbCommand)cmd, "id",    r.BatchRecID,           DbType.Int32);
                        AddParam((DbCommand)cmd, "shift", request.RegShiftID,     DbType.Guid);
                        updated += await ((DbCommand)cmd).ExecuteNonQueryAsync();
                    }

                    // Mark shift as RECONCILE (Status = 3).
                    using (var setStatus = conn.CreateCommand())
                    {
                        setStatus.Transaction = tx;
                        setStatus.CommandText = "UPDATE RegShift SET Status = 3 WHERE RegShiftID = @id";
                        setStatus.CommandType = CommandType.Text;
                        AddParam((DbCommand)setStatus, "id", request.RegShiftID, DbType.Guid);
                        await ((DbCommand)setStatus).ExecuteNonQueryAsync();
                    }

                    await tx.CommitAsync();
                }

                return ApiResponseFactory.Success(new ReconcileBatchSaveResponseDto
                {
                    RegShiftID  = request.RegShiftID,
                    UpdatedRows = updated,
                    NewStatus   = "RECONCILE"
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ReconcileBatchSaveResponseDto>($"Failed to save reconcile: {ex.Message}");
            }
        }

        public async Task<ApiResponse<TotalTendersForShiftResponseDto>> GetTotalTendersForShiftAsync(TotalTendersForShiftRequestDto request)
        {
            try
            {
                request ??= new TotalTendersForShiftRequestDto();
                if (request.RegShiftID == Guid.Empty)
                    return ApiResponseFactory.BadRequest<TotalTendersForShiftResponseDto>("RegShiftID is required.");

                var resp = new TotalTendersForShiftResponseDto { RegShiftID = request.RegShiftID };

                var conn = _dbContext.Database.GetDbConnection();
                if (conn.State != ConnectionState.Open) await conn.OpenAsync();

                // Header
                using (var hdr = conn.CreateCommand())
                {
                    hdr.CommandText = "SELECT ShiftNO FROM RegShift WHERE RegShiftID = @id";
                    hdr.CommandType = CommandType.Text;
                    AddParam((DbCommand)hdr, "id", request.RegShiftID, DbType.Guid);
                    var v = await ((DbCommand)hdr).ExecuteScalarAsync();
                    resp.ShiftNo = v?.ToString() ?? string.Empty;
                }

                // Transactional rows for the shift — one row per TenderEntry. Matches desktop
                // RepTendersShift columns: Tender / Transaction No / Date / Amount (with split Time + No on the UI).
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = @"
                        SELECT t.TenderID,
                               t.TenderName,
                               tr.TransactionID,
                               tr.TransactionNo,
                               tr.StartSaleTime AS [Date],
                               te.Amount,
                               SV.SystemValueName AS CreditType
                        FROM TenderEntry te
                        INNER JOIN [Transaction] tr ON te.TransactionID = tr.TransactionID
                        INNER JOIN Tender         t ON te.TenderID = t.TenderID
                        LEFT  JOIN SystemValues SV ON CAST(SV.SystemValueNo AS NVARCHAR) = te.Common3
                                                    AND SV.SystemTableNo = 5
                                                    AND te.TenderID = 3
                        WHERE tr.RegShiftID = @id
                          AND tr.Status > 0
                          AND te.Status > 0
                        ORDER BY tr.StartSaleTime DESC, t.TenderName";
                    cmd.CommandType = CommandType.Text;
                    AddParam((DbCommand)cmd, "id", request.RegShiftID, DbType.Guid);

                    using var reader = await ((DbCommand)cmd).ExecuteReaderAsync();
                    while (await reader.ReadAsync())
                    {
                        var row = new TotalTendersForShiftRowDto
                        {
                            TenderID      = Convert.ToInt32(reader.GetValue(0)),
                            TenderName    = ReadStr(reader, 1),
                            TransactionID = reader.IsDBNull(2) ? (Guid?)null : reader.GetGuid(2),
                            TransactionNo = ReadStr(reader, 3),
                            Date          = reader.IsDBNull(4) ? (DateTime?)null : reader.GetDateTime(4),
                            Amount        = reader.IsDBNull(5) ? 0m : Convert.ToDecimal(reader.GetValue(5)),
                            CreditType    = ReadStr(reader, 6)
                        };
                        resp.Rows.Add(row);
                        resp.GrandTotalAmount += row.Amount;
                    }
                    resp.GrandTotalCount = resp.Rows.Count;
                }

                return ApiResponseFactory.Success(resp);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<TotalTendersForShiftResponseDto>($"Failed to load tender totals for shift: {ex.Message}");
            }
        }
    }
}
