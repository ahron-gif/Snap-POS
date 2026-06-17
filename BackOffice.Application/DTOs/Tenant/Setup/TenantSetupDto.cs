namespace BackOffice.Application.DTOs.Tenant.Setup
{
    /// <summary>
    /// Tenant-wide read-only configuration the React frontend needs to drive
    /// show/hide behavior (Item form, Matrix form, etc.). All fields come
    /// from the per-tenant encrypted EncData blob — same source the desktop
    /// reads at login into <c>GlobalDataAccess.EncDateRow</c>.
    ///
    /// This DTO deliberately exposes ONLY non-sensitive flags. The master
    /// DataSoft credentials and other internals stay server-side. If a new
    /// field is needed, add it here AND in <c>TenantSetupService</c>.
    /// </summary>
    public class TenantSetupDto
    {
        /// <summary>0 = Food, 1 = Books, 2 = Apparel, 3 = Regular.</summary>
        public int? StoreType { get; set; }
        public bool? Multiplelocation { get; set; }
        public bool? AccountPayable { get; set; }
        public bool? Loyalty { get; set; }
        public bool? PurchaseOrder { get; set; }
        public bool? SaleOrder { get; set; }
        public bool? PhoneOrder { get; set; }
        public bool? Web { get; set; }
        public bool? Email { get; set; }
        public bool? PocketPC { get; set; }
        public bool? ApproveCost { get; set; }
        public bool? ReorderWizard { get; set; }
        public bool? RestockingWizard { get; set; }
    }
}
