namespace BackOffice.Application.DTOs.Tenant.LabelTemplate
{
    /// <summary>
    /// Preview of a single legacy <c>PrintLabelLayout</c> row and what it would convert into.
    /// Returned by the "list legacy layouts" endpoint so the Super Admin can review before importing.
    /// </summary>
    public class LegacyLayoutPreviewDto
    {
        public Guid PrintLabelLayoutId { get; set; }
        public string LayoutName { get; set; } = string.Empty;
        public int? PrinterType { get; set; }
        public int? Status { get; set; }

        /// <summary>True if conversion failed entirely (no usable design produced).</summary>
        public bool Failed { get; set; }

        /// <summary>True if a (non-deleted) LabelTemplate with the same name already exists.</summary>
        public bool AlreadyImported { get; set; }

        // Converted preview (so the UI can render the resulting label without importing)
        public short LabelType { get; set; }
        public short PaperSize { get; set; }
        public decimal LabelWidth { get; set; }
        public decimal LabelHeight { get; set; }
        public int ColumnsPerPage { get; set; }
        public int RowsPerPage { get; set; }
        public int ElementCount { get; set; }
        public string DesignJson { get; set; } = "{\"elements\":[]}";

        /// <summary>Non-fatal conversion notes (approximated fields, ITF fallback, image placeholders, …).</summary>
        public List<string> Warnings { get; set; } = new();
    }

    /// <summary>Request to import a set of legacy layouts into the tenant's LabelTemplates.</summary>
    public class LegacyLabelImportRequestDto
    {
        /// <summary>
        /// Legacy PrintLabelLayout IDs to import. When null/empty, all convertible layouts are imported.
        /// </summary>
        public List<Guid>? LayoutIds { get; set; }

        /// <summary>
        /// When true, a converted layout whose name matches an existing template overwrites that
        /// template's design; when false (default) it is skipped.
        /// </summary>
        public bool OverwriteExisting { get; set; }
    }

    /// <summary>Per-layout outcome of an import run.</summary>
    public class LegacyLabelImportItemDto
    {
        public Guid PrintLabelLayoutId { get; set; }
        public string LayoutName { get; set; } = string.Empty;

        /// <summary>"imported", "updated", "skipped-exists", or "failed".</summary>
        public string Outcome { get; set; } = string.Empty;
        public int? TemplateId { get; set; }
        public List<string> Warnings { get; set; } = new();
    }

    /// <summary>Aggregate result of an import run.</summary>
    public class LegacyLabelImportResultDto
    {
        public int Total { get; set; }
        public int Imported { get; set; }
        public int Updated { get; set; }
        public int Skipped { get; set; }
        public int Failed { get; set; }
        public List<LegacyLabelImportItemDto> Items { get; set; } = new();
    }
}
