using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

#nullable enable

namespace BackOffice.Domain.Entities.Tenant
{
    public class SP_GetItemsWithInventoryPagedResult
    {
        public Guid StoreID { get; set; }
        public int StoreInt { get; set; }
        [StringLength(50)]
        public string? StoreName { get; set; }
        [Column("Cost", TypeName = "money")]
        public decimal? Cost { get; set; }
        [Column("Price", TypeName = "money")]
        public decimal? Price { get; set; }
        [Column("OnHand", TypeName = "decimal(19,3)")]
        public decimal? OnHand { get; set; }
        [Column("OnOrder", TypeName = "decimal(19,3)")]
        public decimal? OnOrder { get; set; }
        [Column("OnTransferOrder", TypeName = "decimal(19,3)")]
        public decimal? OnTransferOrder { get; set; }
        public Guid StoreNo { get; set; }
        public Guid ItemNo { get; set; }
        [StringLength(250)]
        public string Name { get; set; } = default!;
        [StringLength(50)]
        public string BarcodeNumber { get; set; } = default!;
        [StringLength(50)]
        public string ModalNumber { get; set; } = default!;
        public Guid ItemStoreID { get; set; }
        public int TotalCount { get; set; }
    }
}
