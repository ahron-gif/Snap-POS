using System.ComponentModel.DataAnnotations.Schema;

namespace BackOffice.Domain.Entities.Tenant
{
    /// <summary>
    /// Partial for SP_GetSalesProfit result — columns match the SP result set (Sales Summary By Transaction).
    /// Result set order: TransactionID, TransactionNo, RegisterTransaction, Date, CustomerNo, CustomerName, User,
    /// SubTotal, Discount %, Discount $, Tax, Total, Cost, Markup, Margin, Profit, CustomerID, StoreID, BatchID, Status, DateCreated, UserCreated, StoreName.
    /// </summary>
    public partial class SP_GetSalesProfitResult
    {
        public Guid? TransactionID { get; set; }
        public string? TransactionNo { get; set; }
        public bool? RegisterTransaction { get; set; }
        public DateTime? Date { get; set; }
        public string? CustomerNo { get; set; }
        public string? CustomerName { get; set; }
        public string? User { get; set; }
        public decimal? SubTotal { get; set; }

        [Column("Discount %")]
        public decimal? DiscountPercent { get; set; }

        [Column("Discount $")]
        public decimal? DiscountAmount { get; set; }

        public decimal? Tax { get; set; }
        public decimal? Total { get; set; }
        public decimal? Cost { get; set; }
        public decimal? Markup { get; set; }
        public decimal? Margin { get; set; }
        public decimal? Profit { get; set; }
        public Guid? CustomerID { get; set; }
        public Guid? StoreID { get; set; }
        public Guid? BatchID { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public Guid? UserCreated { get; set; }
        public string? StoreName { get; set; }
    }
}
