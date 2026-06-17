namespace BackOffice.Application.DTOs.Mian.License
{
    /// <summary>
    /// Mirrors every field the legacy WinForms FrmStartWz (the desktop
    /// "RDT Systems Installation Setup" screen) reads from / writes to the
    /// per-tenant encrypted EncData blob. All fields are nullable so that a
    /// missing element in the legacy XML (xs:element minOccurs="0") round-
    /// trips correctly — read leaves it null, save omits it.
    /// </summary>
    public class LicenseDto
    {
        // ─── Identity / branding ──────────────────────────────────────────
        public string? CompanyName { get; set; }
        public string? NewCompanyName { get; set; }
        public string? ApplicationName { get; set; }

        // NOTE: DataSoftUser / DataSoftPassword are intentionally NOT exposed
        // here. They're the master super-user credentials for the legacy
        // desktop BackOffice and leaking them through a SuperAdmin GET would
        // let any role-holder lift the password and log in as the all-powerful
        // `datasoft` user. The service preserves whatever's in the encrypted
        // XML on save (the read-then-overlay flow leaves fields the DTO
        // doesn't carry untouched), so omitting them here is both the safest
        // and the simplest contract.

        // ─── App info ─────────────────────────────────────────────────────
        public short? AppType { get; set; }
        public int? VersionType { get; set; }

        public DateTime? ExpDate { get; set; }
        public DateTime? BeginDate { get; set; }
        public int? Days { get; set; }
        public bool? Expired { get; set; }

        public int? ComputersNo { get; set; }
        public int? BOCompNo { get; set; }
        public int? StoresNo { get; set; }
        public int? PocketPCsNo { get; set; }

        /// <summary>0=Food, 1=Books, 2=Apparel, 3=Regular (DataSoft.StoreType enum).</summary>
        public int? StoreType { get; set; }

        // ─── Module flags (Allow Modules group in FrmStartWz) ────────────
        public bool? Multiplelocation { get; set; }
        public bool? AccountPayable { get; set; }
        public bool? ApproveCost { get; set; }
        public bool? ReorderWizard { get; set; }
        public bool? RestockingWizard { get; set; }
        public bool? PurchaseOrder { get; set; }
        public bool? SaleOrder { get; set; }

        /// <summary>
        /// Stored as xs:string in the legacy XSD even though the desktop UI is
        /// a checkbox. Keeping as string to preserve any legacy data; new
        /// values write the bool's "True"/"False".
        /// </summary>
        public string? Resellers { get; set; }
        public bool? Web { get; set; }
        public bool? PhoneOrder { get; set; }
        public bool? Email { get; set; }
        public bool? PocketPC { get; set; }

        /// <summary>Same string-typed-bool caveat as Resellers.</summary>
        public string? DailyProfitReport { get; set; }
        public bool? Loyalty { get; set; }
        public string? ScanReceiveOrder { get; set; }

        // ─── Per-store information ────────────────────────────────────────
        public List<StoreInfoDto> Stores { get; set; } = new();
    }
}
