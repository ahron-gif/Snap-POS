namespace BackOffice.Application.DTOs.Tenant.LabelTemplate
{
    /// <summary>
    /// Label types for categorizing templates
    /// </summary>
    public enum LabelType : short
    {
        ItemLabel = 1,
        ShelfTag = 2,
        PriceLabel = 3,
        BarcodeLabel = 4,
        Custom = 5
    }

    /// <summary>
    /// Paper size options
    /// </summary>
    public enum PaperSize : short
    {
        Letter = 1,
        A4 = 2,
        Custom = 3
    }

    /// <summary>
    /// DTO for listing label templates
    /// </summary>
    public class LabelTemplateListDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public short LabelType { get; set; }
        public string LabelTypeName => GetLabelTypeName(LabelType);
        public decimal LabelWidth { get; set; }
        public decimal LabelHeight { get; set; }
        public int ColumnsPerPage { get; set; }
        public int RowsPerPage { get; set; }
        public bool IsDefault { get; set; }
        public DateTime DateModified { get; set; }

        private static string GetLabelTypeName(short labelType) => labelType switch
        {
            1 => "Item Label",
            2 => "Shelf Tag",
            3 => "Price Label",
            4 => "Barcode Label",
            5 => "Custom",
            _ => "Unknown"
        };
    }

    /// <summary>
    /// DTO for full label template details (including design JSON)
    /// </summary>
    public class LabelTemplateDto
    {
        public int Id { get; set; }
        public Guid? StoreId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public short LabelType { get; set; }
        public short PaperSize { get; set; }
        public decimal LabelWidth { get; set; }
        public decimal LabelHeight { get; set; }
        public int ColumnsPerPage { get; set; }
        public int RowsPerPage { get; set; }
        public decimal MarginLeft { get; set; }
        public decimal MarginTop { get; set; }
        public decimal HorizontalGap { get; set; }
        public decimal VerticalGap { get; set; }
        public string DesignJson { get; set; } = "{}";
        public bool IsDefault { get; set; }
        public DateTime DateCreated { get; set; }
        public DateTime DateModified { get; set; }
    }

    /// <summary>
    /// DTO for creating a new label template
    /// </summary>
    public class LabelTemplateCreateDto
    {
        public Guid? StoreId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public short LabelType { get; set; } = (short)DTOs.Tenant.LabelTemplate.LabelType.ItemLabel;
        public short PaperSize { get; set; } = (short)DTOs.Tenant.LabelTemplate.PaperSize.Letter;
        public decimal LabelWidth { get; set; } = 2.625m;  // Avery 5160 default
        public decimal LabelHeight { get; set; } = 1m;     // Avery 5160 default
        public int ColumnsPerPage { get; set; } = 3;       // Avery 5160 default
        public int RowsPerPage { get; set; } = 10;         // Avery 5160 default
        public decimal MarginLeft { get; set; } = 0.1875m; // Avery 5160 default
        public decimal MarginTop { get; set; } = 0.5m;     // Avery 5160 default
        public decimal HorizontalGap { get; set; } = 0.125m;
        public decimal VerticalGap { get; set; } = 0m;
        public string DesignJson { get; set; } = "{}";
        public bool IsDefault { get; set; }
    }

    /// <summary>
    /// DTO for updating an existing label template
    /// </summary>
    public class LabelTemplateUpdateDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public short LabelType { get; set; }
        public short PaperSize { get; set; }
        public decimal LabelWidth { get; set; }
        public decimal LabelHeight { get; set; }
        public int ColumnsPerPage { get; set; }
        public int RowsPerPage { get; set; }
        public decimal MarginLeft { get; set; }
        public decimal MarginTop { get; set; }
        public decimal HorizontalGap { get; set; }
        public decimal VerticalGap { get; set; }
        public string DesignJson { get; set; } = "{}";
        public bool IsDefault { get; set; }
    }

    /// <summary>
    /// DTO for label element in the design JSON
    /// </summary>
    public class LabelElementDto
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty; // "barcode", "text", "image", "rectangle", "line"
        public double X { get; set; }
        public double Y { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public double Rotation { get; set; }
        public LabelElementPropertiesDto Properties { get; set; } = new();
    }

    /// <summary>
    /// Properties for label elements
    /// </summary>
    public class LabelElementPropertiesDto
    {
        // Text properties
        public string? Text { get; set; }
        public string? FontFamily { get; set; }
        public double? FontSize { get; set; }
        public bool? Bold { get; set; }
        public bool? Italic { get; set; }
        public string? TextAlign { get; set; }
        public string? Color { get; set; }

        // Barcode properties
        public string? BarcodeType { get; set; } // "CODE128", "EAN13", "UPC", "QR", etc.
        public string? BarcodeValue { get; set; }
        public bool? ShowText { get; set; }
        public double? BarcodeHeight { get; set; }

        // Data binding - field name from item data
        public string? DataField { get; set; } // "[Description]", "[BarcodeNumber]", "[Price]", etc.

        // Shape properties
        public string? FillColor { get; set; }
        public string? StrokeColor { get; set; }
        public double? StrokeWidth { get; set; }

        // Image properties
        public string? ImageUrl { get; set; }
        public bool? UseItemImage { get; set; }
    }

    /// <summary>
    /// DTO for the complete label design
    /// </summary>
    public class LabelDesignDto
    {
        public List<LabelElementDto> Elements { get; set; } = new();
        public string? BackgroundColor { get; set; }
        public bool ShowBorder { get; set; }
        public string? BorderColor { get; set; }
    }

    /// <summary>
    /// DTO for print request
    /// </summary>
    public class LabelPrintRequestDto
    {
        public int TemplateId { get; set; }
        public List<Guid> ItemStoreIds { get; set; } = new();
        public int CopiesPerItem { get; set; } = 1;
        public int StartPosition { get; set; } = 1; // Which label position to start on (1-based)
    }

    /// <summary>
    /// DTO for print preview data
    /// </summary>
    public class LabelPrintPreviewDto
    {
        public LabelTemplateDto Template { get; set; } = new();
        public List<LabelDataDto> Items { get; set; } = new();
    }

    /// <summary>
    /// DTO for item data to be printed on labels
    /// </summary>
    public class LabelDataDto
    {
        public Guid ItemStoreId { get; set; }
        public string BarcodeNumber { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Measure { get; set; }
        public decimal Price { get; set; }
        public decimal? PriceA { get; set; }
        public decimal? PriceB { get; set; }
        public decimal? Cost { get; set; }
        public string? Size { get; set; }
        public string? ModelNo { get; set; }
        public string? StyleNo { get; set; }
        public string? ExtraInfo { get; set; }
        public string? DepartmentName { get; set; }
        public string? ManufacturerName { get; set; }
        public string? ImageUrl { get; set; }
    }
}
