using System;
using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Tenant.Item
{
    // -------------------------------------------------------------------
    // Matrix template + value DTOs — port of legacy desktop FrmMatrix's
    // template management. Templates are hardcoded as a (Color, Size)
    // pair in the desktop (see MatrixClass.MatrixColorColumn /
    // MatrixSizeColumn), so we mirror that here: each template returns
    // its colour values + size values as two flat lists, never an
    // arbitrary column dictionary.
    // -------------------------------------------------------------------

    /// <summary>
    /// One picker value within a template axis (e.g. "Red" in the
    /// Colour axis, "M" in the Size axis).
    /// </summary>
    public class MatrixValueDto
    {
        public Guid MatrixValueID { get; set; }
        public Guid MatrixColumnID { get; set; }
        public string DisplayValue { get; set; } = string.Empty;
        public string? Code { get; set; }
        public int? SortValue { get; set; }
    }

    /// <summary>
    /// Full template detail — used by the picker + the template editor.
    /// </summary>
    public class MatrixTemplateDto
    {
        public Guid MatrixTableID { get; set; }
        public string? MatrixName { get; set; }
        public string? MatrixDescription { get; set; }
        public Guid? ColorColumnID { get; set; }
        public Guid? SizeColumnID { get; set; }
        public List<MatrixValueDto> Colors { get; set; } = new();
        public List<MatrixValueDto> Sizes { get; set; } = new();
    }

    public class MatrixTemplateCreateDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public class MatrixTemplateUpdateDto
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
    }

    /// <summary>"color" or "size" — which axis the new value belongs to.</summary>
    public class MatrixValueCreateDto
    {
        public string Axis { get; set; } = "color";
        public string DisplayValue { get; set; } = string.Empty;
        public string? Code { get; set; }
        public int? SortValue { get; set; }
        /// <summary>
        /// When true, also INSERT into the global MatrixColors lookup
        /// so this colour shows up in other templates' pickers too.
        /// Mirrors the desktop's UseFashionChanges flag.
        /// </summary>
        public bool PromoteToGlobal { get; set; }
    }

    /// <summary>
    /// Bulk-generate matrix children for a parent from picked colour
    /// and size values. Server skips combos that already exist as
    /// active children (so the user can re-open the generator and
    /// pick more values without creating duplicates).
    /// </summary>
    public class MatrixChildGenerateDto
    {
        public Guid StoreId { get; set; }
        /// <summary>
        /// Optional. If set, the parent ItemMain.MatrixTableNo is
        /// updated so subsequent generations remember the template.
        /// </summary>
        public Guid? AssignTemplateId { get; set; }
        /// <summary>
        /// Plain colour names to spread across rows. Empty list means
        /// "no colour axis" — still generates if Sizes has values.
        /// </summary>
        public List<string> Colors { get; set; } = new();
        /// <summary>Plain size names to spread across columns.</summary>
        public List<string> Sizes { get; set; } = new();
    }

    /// <summary>Result row from a bulk generate call.</summary>
    public class MatrixGenerateResultDto
    {
        public int Created { get; set; }
        public int Skipped { get; set; }
    }

    /// <summary>
    /// One row in a batch on-hand adjustment. The server writes the
    /// new OnHand to ItemStore AND inserts one AdjustInventory row
    /// per row with delta = newOnHand - oldOnHand. Mirrors desktop
    /// FrmMatrix.SaveOnHand. AdjustType is fixed at 3 ("Other") to
    /// match the desktop's enum.
    /// </summary>
    public class MatrixOnHandAdjustRowDto
    {
        public Guid ItemStoreId { get; set; }
        public decimal NewOnHand { get; set; }
    }

    public class MatrixOnHandAdjustBatchDto
    {
        public List<MatrixOnHandAdjustRowDto> Rows { get; set; } = new();
        public string Reason { get; set; } = string.Empty;
    }

    /// <summary>Global colour lookup row (DBO.MatrixColors).</summary>
    public class MatrixColorDto
    {
        public string DisplayValue { get; set; } = string.Empty;
        public string? Code { get; set; }
        public int? SortValue { get; set; }
    }
}
