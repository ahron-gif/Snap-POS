using System;

namespace BackOffice.Application.DTOs.Tenant.Item
{
    /// <summary>
    /// One row of the Matrix tab grid — a single variant SKU under a
    /// Matrix Parent item. Mirrors the columns the desktop's FrmMatrix
    /// shows: Item Name, Barcode, Price, Pc Cost, Cost, Color, Size,
    /// On Hand, Model Number, Link No, Style Number — plus the
    /// per-store identifiers (ItemID + ItemStoreID) needed to round-trip
    /// edits back through PATCH.
    /// </summary>
    public class MatrixChildDto
    {
        public Guid ItemID { get; set; }
        public Guid? ItemStoreID { get; set; }
        public string? Name { get; set; }
        public string? Barcode { get; set; }
        public decimal? Cost { get; set; }
        /// <summary>Per-piece cost. NetCost when present, else Cost / CaseQty.</summary>
        public decimal? PcCost { get; set; }
        public decimal? Price { get; set; }
        public decimal? SpecialCost { get; set; }
        /// <summary>Matrix1 — typically the colour axis.</summary>
        public string? Color { get; set; }
        /// <summary>Matrix2 — typically the size axis.</summary>
        public string? Size { get; set; }
        public decimal? OnHand { get; set; }
        /// <summary>ItemMain.ModalNumber.</summary>
        public string? ModelNumber { get; set; }
        public Guid? LinkNo { get; set; }
        public string? StyleNumber { get; set; }
        /// <summary>Computed: (Price - Cost) * 100 / Price. Null if Price is 0.</summary>
        public decimal? Margin { get; set; }
        /// <summary>Computed: (Price - Cost) * 100 / Cost. Null if Cost is 0.</summary>
        public decimal? Markup { get; set; }
    }

    /// <summary>
    /// Patch one matrix-child row. Every field is nullable so the
    /// caller can send just the columns they edited (PATCH semantics).
    /// </summary>
    public class MatrixChildPatchDto
    {
        public string? Name { get; set; }
        public string? Barcode { get; set; }
        public string? ModelNumber { get; set; }
        public string? StyleNumber { get; set; }
        public string? Color { get; set; }
        public string? Size { get; set; }
        public decimal? Cost { get; set; }
        public decimal? SpecialCost { get; set; }
        public decimal? Price { get; set; }
    }

    /// <summary>
    /// Bulk-apply a single Cost across every child in this parent's
    /// matrix for the given store. Mirrors the desktop "Update Cost"
    /// button: writes Cost + SpecialCost + EstimatedCost to every row.
    /// </summary>
    public class MatrixBulkCostDto
    {
        public Guid StoreId { get; set; }
        public decimal Cost { get; set; }
    }

    /// <summary>
    /// Bulk-apply a Price across every child. Three modes mirror the
    /// desktop's three input paths (margin %, markup %, absolute):
    ///   margin   → Price = Cost / (1 - Value/100)    (Value &lt; 100)
    ///   markup   → Price = Cost * (1 + Value/100)
    ///   absolute → Price = Value
    /// </summary>
    public class MatrixBulkPriceDto
    {
        public Guid StoreId { get; set; }
        /// <summary>"margin", "markup", or "absolute".</summary>
        public string Mode { get; set; } = "absolute";
        public decimal Value { get; set; }
    }

    /// <summary>
    /// Create one new matrix child under the given parent. Inherits
    /// most attributes from the parent (name template, department,
    /// tax/discount flags, starting cost/price) — the user fills in
    /// colour/size after.
    /// </summary>
    public class MatrixChildCreateDto
    {
        public Guid StoreId { get; set; }
        public string? Color { get; set; }
        public string? Size { get; set; }
    }
}
