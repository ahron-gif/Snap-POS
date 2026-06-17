namespace BackOffice.Application.DTOs.Tenant.Supplier
{
    public class CreateSupplierDto
    {
        public string? SupplierNo { get; set; }
        public string? Name { get; set; }
        public Guid? DefaultCredit { get; set; }
        public string? WebSite { get; set; }
        public string? EmailAddress { get; set; }
        public string? ContactName { get; set; }
        public Guid? BarterID { get; set; }
        public Guid? WarehouseID { get; set; }
        public string? AccountNo { get; set; }
        public string? Note { get; set; }
        public string? Address1 { get; set; }
        public string? Address2 { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? Zip { get; set; }
        public string? PhoneNumber1 { get; set; }
        public string? Ext1 { get; set; }
        public string? PhoneNumber2 { get; set; }
        public string? PhoneNumber3 { get; set; }
        public decimal MinMarkup { get; set; }
        public Guid? BuyerID { get; set; }
        public decimal? ListPrice { get; set; }
        public Guid? Department { get; set; }
        public short? Import { get; set; }
    }

    public class UpdateSupplierDto : CreateSupplierDto
    {
        public Guid SupplierID { get; set; }
    }
}
