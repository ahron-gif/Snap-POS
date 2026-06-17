#nullable enable
using System;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// Stores label template designs for printing item labels, shelf tags, etc.
/// Templates are stored as JSON containing canvas elements (barcode, text, images, etc.)
/// </summary>
public class LabelTemplate
{
    /// <summary>
    /// Primary key
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// Store ID - templates can be specific to a store or null for all stores
    /// </summary>
    public Guid? StoreId { get; set; }

    /// <summary>
    /// Template name (e.g., "Avery 5160", "Shelf Tag 2x4", "Price Label Small")
    /// </summary>
    public string Name { get; set; } = null!;

    /// <summary>
    /// Template description
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Label type: 1=Item Label, 2=Shelf Tag, 3=Price Label, 4=Barcode Label, 5=Custom
    /// </summary>
    public short LabelType { get; set; }

    /// <summary>
    /// Paper size: 1=Letter, 2=A4, 3=Custom
    /// </summary>
    public short PaperSize { get; set; }

    /// <summary>
    /// Label width in inches
    /// </summary>
    public decimal LabelWidth { get; set; }

    /// <summary>
    /// Label height in inches
    /// </summary>
    public decimal LabelHeight { get; set; }

    /// <summary>
    /// Number of columns (labels per row)
    /// </summary>
    public int ColumnsPerPage { get; set; }

    /// <summary>
    /// Number of rows (labels per column)
    /// </summary>
    public int RowsPerPage { get; set; }

    /// <summary>
    /// Left margin in inches
    /// </summary>
    public decimal MarginLeft { get; set; }

    /// <summary>
    /// Top margin in inches
    /// </summary>
    public decimal MarginTop { get; set; }

    /// <summary>
    /// Horizontal spacing between labels in inches
    /// </summary>
    public decimal HorizontalGap { get; set; }

    /// <summary>
    /// Vertical spacing between labels in inches
    /// </summary>
    public decimal VerticalGap { get; set; }

    /// <summary>
    /// JSON string containing the label design elements (barcodes, text fields, shapes, images)
    /// </summary>
    public string DesignJson { get; set; } = null!;

    /// <summary>
    /// Whether this is the default template for its label type
    /// </summary>
    public bool IsDefault { get; set; }

    /// <summary>
    /// Whether template is active (soft delete: -1=deleted, 0=active)
    /// </summary>
    public short Status { get; set; }

    /// <summary>
    /// User who created the template
    /// </summary>
    public Guid? UserCreated { get; set; }

    /// <summary>
    /// Date when template was created
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// User who last modified the template
    /// </summary>
    public Guid? UserModified { get; set; }

    /// <summary>
    /// Date when template was last modified
    /// </summary>
    public DateTime DateModified { get; set; }
}
