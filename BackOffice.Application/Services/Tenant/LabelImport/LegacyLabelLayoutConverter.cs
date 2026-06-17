using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using BackOffice.Application.DTOs.Tenant.LabelTemplate;

namespace BackOffice.Application.Services.Tenant.LabelImport
{
    /// <summary>
    /// Converts a legacy desktop <c>PrintLabelLayout.LayoutContent</c> value (a DevExpress
    /// XtraReports CodeDOM / C# source serialization of <c>RptItemLabels</c>) into the web
    /// Label Designer <c>DesignJson</c> format (<see cref="LabelDesignDto"/>) plus the
    /// surrounding template geometry (size, columns, margins).
    ///
    /// The legacy format looks like:
    /// <code>
    /// /// &lt;XRTypeInfo&gt; ... &lt;/XRTypeInfo&gt;
    /// namespace XtraReportSerialization {
    ///   public class RptItemLabels : DevExpress.XtraReports.UI.XtraReport {
    ///     private void InitializeComponent() {
    ///       this.label1 = new DevExpress.XtraReports.UI.XRLabel();
    ///       this.label1.LocationFloat = new DevExpress.Utils.PointFloat(3F, 7F);
    ///       this.label1.SizeF = new System.Drawing.SizeF(83F, 23F);
    ///       this.label1.DataBindings.AddRange(new ...XRBinding[]{ new ...XRBinding("Text", null, "ItemsLabels.Name") });
    ///       ...
    ///     } } }
    /// </code>
    ///
    /// Coordinates/sizes are in DevExpress report units of 1/100 inch. The web canvas uses
    /// pixels at 96 DPI for element coordinates and inches for the label dimensions, so
    /// <c>px = units * 0.96</c> and <c>inches = units / 100</c>. Fonts are in points and the
    /// web renders <c>fontSize</c> as CSS pixels, so <c>px = pt * 96/72</c>.
    /// </summary>
    public class LegacyLabelLayoutConverter
    {
        // 1/100 inch -> px @ 96 DPI
        private const double UnitToPx = 0.96;
        // points -> px @ 96 DPI
        private const double PointToPx = 96.0 / 72.0;

        /// <summary>
        /// Maps legacy <c>ItemsLabels.&lt;Field&gt;</c> bindings (and bare <c>[Token]</c> text)
        /// to the web data-field tokens declared in the Label Designer.
        /// A value of <c>null</c> means "no faithful web token" — the field is emitted as static
        /// text and reported as a warning (per the approximate-and-flag policy).
        /// </summary>
        private static readonly Dictionary<string, string?> FieldMap = new(StringComparer.OrdinalIgnoreCase)
        {
            // Direct, faithful maps
            ["Name"] = "[Description]",
            ["ItemName"] = "[Description]",
            ["Description"] = "[Description]",
            ["BarcodeNumber"] = "[BarcodeNumber]",
            ["Price"] = "[Price]",
            ["Brand"] = "[ManufacturerName]",
            ["Department"] = "[DepartmentName]",
            ["Size"] = "[Size]",
            ["ExtraInfo"] = "[ExtraInfo]",
            ["ItemCode"] = "[SKU]",
            ["UPCA"] = "[BarcodeNumber]",

            // Approximations (flagged)
            ["DisplayPrice"] = "[Price]",
            ["DisplayPriceReg"] = "[Price]",
            ["DisplaySpecial"] = "[PriceA]",
            ["ExtraInfo2"] = "[ExtraInfo]",
            ["ParentCode"] = "[ModelNo]",

            // No web equivalent -> static text (flagged)
            ["PlusTax"] = null,
            ["SaleEnds"] = null,
            ["SaleBegins"] = null,
            ["Meaasure"] = null,
            ["Measure"] = null,
            ["DisplayMeaasure"] = null,
            ["DisplayMeasure"] = null,
        };

        /// <summary>Legacy fields mapped only by approximation (reported, but still bound).</summary>
        private static readonly HashSet<string> ApproximatedFields = new(StringComparer.OrdinalIgnoreCase)
        {
            "DisplayPrice", "DisplayPriceReg", "DisplaySpecial", "ExtraInfo2", "ParentCode"
        };

        public LegacyLabelConversionResult Convert(string? layoutContent, string? layoutName, int? printerType)
        {
            var result = new LegacyLabelConversionResult
            {
                Name = string.IsNullOrWhiteSpace(layoutName) ? "Imported Label" : layoutName!.Trim(),
                PrinterType = printerType
            };

            if (string.IsNullOrWhiteSpace(layoutContent))
            {
                result.Failed = true;
                result.Warnings.Add("LayoutContent is empty.");
                return result;
            }

            string body;
            try
            {
                body = ExtractInitializeComponentBody(layoutContent);
            }
            catch (Exception ex)
            {
                result.Failed = true;
                result.Warnings.Add($"Could not locate InitializeComponent() body: {ex.Message}");
                return result;
            }

            var statements = SplitStatements(body);

            var generators = new Dictionary<string, string>(StringComparer.Ordinal); // var -> symbology type name
            var controls = new Dictionary<string, Ctrl>(StringComparer.Ordinal);
            var parentOf = new Dictionary<string, string>(StringComparer.Ordinal);

            var report = new ReportInfo();

            foreach (var raw in statements)
            {
                var s = Normalize(raw);
                if (s.Length == 0) continue;

                ParseStatement(s, generators, controls, parentOf, report, result);
            }

            // Resolve barcode symbology variable -> type
            foreach (var c in controls.Values)
            {
                if (c.Kind == "XRBarCode" && c.SymbologyVar != null &&
                    generators.TryGetValue(c.SymbologyVar, out var gen))
                {
                    c.SymbologyType = gen;
                }
            }

            BuildTemplateGeometry(report, result);
            BuildElements(controls, parentOf, report, result);

            var design = new LabelDesignDto { Elements = result.Elements, ShowBorder = false };
            result.Design = design;
            result.DesignJson = JsonSerializer.Serialize(design, JsonOpts);

            if (result.Elements.Count == 0)
                result.Warnings.Add("No printable elements were produced from this layout.");

            return result;
        }

        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
        };

        // ---- Statement parsing -------------------------------------------------

        private void ParseStatement(
            string s,
            Dictionary<string, string> generators,
            Dictionary<string, Ctrl> controls,
            Dictionary<string, string> parentOf,
            ReportInfo report,
            LegacyLabelConversionResult result)
        {
            Match m;

            // Barcode generator declaration: "DevExpress.XtraPrinting.BarCode.Code128Generator code128Generator1 = new ...Code128Generator()"
            m = Regex.Match(s, @"BarCode\.(\w+Generator)\s+(\w+)\s*=\s*new\s+DevExpress\.XtraPrinting\.BarCode\.(\w+Generator)\(");
            if (m.Success) { generators[m.Groups[2].Value] = m.Groups[3].Value; return; }

            // Control declaration: "this.label1 = new DevExpress.XtraReports.UI.XRLabel()"
            m = Regex.Match(s, @"^this\.(\w+)\s*=\s*new\s+DevExpress\.XtraReports\.UI\.(\w+)\(\)$");
            if (m.Success)
            {
                var name = m.Groups[1].Value;
                if (!controls.ContainsKey(name)) controls[name] = new Ctrl { Name = name, Kind = m.Groups[2].Value };
                return;
            }

            // Containment: "this.panel1.Controls.AddRange(new ...XRControl[] { this.a, this.b })"
            m = Regex.Match(s, @"^this\.(\w+)\.Controls\.AddRange\(new DevExpress\.XtraReports\.UI\.XRControl\[\]\s*\{(.+)\}\)$");
            if (m.Success)
            {
                var parent = m.Groups[1].Value;
                foreach (Match cm in Regex.Matches(m.Groups[2].Value, @"this\.(\w+)"))
                    parentOf[cm.Groups[1].Value] = parent;
                return;
            }

            // Report-level geometry
            if ((m = Regex.Match(s, @"^this\.PageWidth\s*=\s*(\d+)$")).Success) { report.PageWidth = int.Parse(m.Groups[1].Value); return; }
            if ((m = Regex.Match(s, @"^this\.PageHeight\s*=\s*(\d+)$")).Success) { report.PageHeight = int.Parse(m.Groups[1].Value); return; }
            if ((m = Regex.Match(s, @"^this\.Landscape\s*=\s*(true|false)$")).Success) { report.Landscape = m.Groups[1].Value == "true"; return; }
            if ((m = Regex.Match(s, @"^this\.Margins\s*=\s*new System\.Drawing\.Printing\.Margins\((\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)$")).Success)
            { report.MarginLeft = int.Parse(m.Groups[1].Value); report.MarginRight = int.Parse(m.Groups[2].Value); report.MarginTop = int.Parse(m.Groups[3].Value); report.MarginBottom = int.Parse(m.Groups[4].Value); return; }
            if ((m = Regex.Match(s, @"^this\.Detail\.HeightF\s*=\s*([\d.eE+-]+)F?$")).Success) { report.DetailHeight = ParseF(m.Groups[1].Value); return; }
            if ((m = Regex.Match(s, @"MultiColumn\.ColumnCount\s*=\s*(\d+)")).Success) { report.ColumnCount = int.Parse(m.Groups[1].Value); return; }
            if ((m = Regex.Match(s, @"MultiColumn\.ColumnWidth\s*=\s*([\d.eE+-]+)F?")).Success) { report.ColumnWidth = ParseF(m.Groups[1].Value); return; }
            if ((m = Regex.Match(s, @"MultiColumn\.ColumnSpacing\s*=\s*([\d.eE+-]+)F?")).Success) { report.ColumnSpacing = ParseF(m.Groups[1].Value); return; }

            // Per-control properties: "this.<name>.<...>"
            m = Regex.Match(s, @"^this\.(\w+)\.(\w+)");
            if (!m.Success) return;
            var ctrlName = m.Groups[1].Value;
            if (!controls.TryGetValue(ctrlName, out var c)) return; // not a control (band etc.)

            if ((m = Regex.Match(s, @"\.LocationFloat\s*=\s*new DevExpress\.Utils\.PointFloat\(([\d.eE+-]+)F?,\s*([\d.eE+-]+)F?\)")).Success)
            { c.X = ParseF(m.Groups[1].Value); c.Y = ParseF(m.Groups[2].Value); c.HasLocation = true; return; }

            if ((m = Regex.Match(s, @"\.SizeF\s*=\s*new System\.Drawing\.SizeF\(([\d.eE+-]+)F?,\s*([\d.eE+-]+)F?\)")).Success)
            { c.W = ParseF(m.Groups[1].Value); c.H = ParseF(m.Groups[2].Value); c.HasSize = true; return; }

            if ((m = Regex.Match(s, @"\.Font\s*=\s*new System\.Drawing\.Font\(""([^""]+)"",\s*([\d.]+)F?(.*)$")).Success)
            {
                c.FontFamily = m.Groups[1].Value;
                c.FontSizePt = ParseF(m.Groups[2].Value);
                var rest = m.Groups[3].Value;
                c.Bold = rest.Contains("FontStyle.Bold");
                c.Italic = rest.Contains("FontStyle.Italic");
                return;
            }

            if ((m = Regex.Match(s, @"XRBinding\(""Text"",\s*null,\s*""([^""]+)""(?:,\s*""([^""]+)"")?\)")).Success)
            { c.BindingField = m.Groups[1].Value; c.BindingFormat = m.Groups[2].Success ? m.Groups[2].Value : null; return; }

            if ((m = Regex.Match(s, @"\.Text\s*=\s*""(.*)""$")).Success) { c.Text = m.Groups[1].Value; return; }

            if ((m = Regex.Match(s, @"\.TextAlignment\s*=\s*DevExpress\.XtraPrinting\.TextAlignment\.(\w+)$")).Success) { c.TextAlignment = m.Groups[1].Value; return; }

            if ((m = Regex.Match(s, @"\.Symbology\s*=\s*(\w+)$")).Success) { c.SymbologyVar = m.Groups[1].Value; return; }

            if ((m = Regex.Match(s, @"\.ShowText\s*=\s*(true|false)$")).Success) { c.ShowText = m.Groups[1].Value == "true"; return; }

            if ((m = Regex.Match(s, @"\.Angle\s*=\s*([\d.]+)F?$")).Success) { c.Angle = ParseF(m.Groups[1].Value); return; }

            if ((m = Regex.Match(s, @"\.ForeColor\s*=\s*(.+)$")).Success) { c.Color = ParseColor(m.Groups[1].Value); return; }
        }

        // ---- Geometry ----------------------------------------------------------

        private void BuildTemplateGeometry(ReportInfo r, LegacyLabelConversionResult result)
        {
            int pageW = r.PageWidth ?? 0;
            int pageH = r.PageHeight ?? 0;
            int cols = Math.Max(1, r.ColumnCount ?? 1);

            // Per-label width (units of 1/100")
            double labelWidthUnits;
            if (r.ColumnWidth is > 0) labelWidthUnits = r.ColumnWidth.Value;
            else if (cols > 1 && pageW > 0)
            {
                var printable = pageW - r.MarginLeft - r.MarginRight - (cols - 1) * (r.ColumnSpacing ?? 0);
                labelWidthUnits = printable > 0 ? printable / cols : (double)pageW / cols;
            }
            else labelWidthUnits = pageW;

            double labelHeightUnits = r.DetailHeight > 0 ? r.DetailHeight : pageH;

            result.LabelWidth = Round2((decimal)(labelWidthUnits / 100.0));
            result.LabelHeight = Round2((decimal)(labelHeightUnits / 100.0));
            result.ColumnsPerPage = cols;

            int rows = 1;
            if (labelHeightUnits > 0 && pageH > 0)
            {
                var printableH = pageH - r.MarginTop - r.MarginBottom;
                rows = Math.Max(1, (int)Math.Floor(printableH / labelHeightUnits));
            }
            result.RowsPerPage = rows;

            result.MarginLeft = Round2((decimal)(r.MarginLeft / 100.0));
            result.MarginTop = Round2((decimal)(r.MarginTop / 100.0));
            result.HorizontalGap = Round2((decimal)((r.ColumnSpacing ?? 0) / 100.0));
            result.VerticalGap = 0;

            bool isLetter = (pageW == 850 && pageH == 1100) || (pageW == 1100 && pageH == 850);
            result.PaperSize = (short)(isLetter ? PaperSize.Letter : PaperSize.Custom);

            // Label type heuristic (printerType meaning is tenant-specific; refine once confirmed)
            var name = result.Name.ToLowerInvariant();
            short type = (short)LabelType.ItemLabel;
            if (name.Contains("shelf")) type = (short)LabelType.ShelfTag;
            else if (name.Contains("sign") || name.Contains("price")) type = (short)LabelType.PriceLabel;
            else if (name.Contains("tag")) type = (short)LabelType.ShelfTag;
            result.LabelType = type;

            if (pageW == 0 || pageH == 0)
                result.Warnings.Add("Page size missing; label dimensions may be inaccurate.");
        }

        private void BuildElements(
            Dictionary<string, Ctrl> controls,
            Dictionary<string, string> parentOf,
            ReportInfo report,
            LegacyLabelConversionResult result)
        {
            int idSeq = 0;
            int imageCount = 0, itfCount = 0, panelBorderSkipped = 0;

            foreach (var c in controls.Values)
            {
                // Containers are flattened away; their children are emitted with absolute coords.
                if (c.Kind == "XRPanel") continue;

                // Skip report bands (Detail/TopMargin/BottomMargin/PageHeader/...): not drawable elements.
                if (c.Kind.EndsWith("Band", StringComparison.Ordinal)) continue;

                var (ax, ay) = Absolute(c, controls, parentOf);

                double x = Round(ax * UnitToPx);
                double y = Round(ay * UnitToPx);
                double w = Round(c.W * UnitToPx);
                double h = Round(c.H * UnitToPx);

                var el = new LabelElementDto
                {
                    X = x, Y = y, Width = w, Height = h,
                    Rotation = c.Angle.HasValue ? -(double)c.Angle.Value : 0,
                    Properties = new LabelElementPropertiesDto()
                };

                switch (c.Kind)
                {
                    case "XRLabel":
                        el.Type = "text";
                        FillText(el, c, result);
                        break;
                    case "XRBarCode":
                        el.Type = "barcode";
                        if (FillBarcode(el, c, result)) itfCount++;
                        break;
                    case "XRPictureBox":
                        el.Type = "image";
                        el.Properties.UseItemImage = false;
                        el.Properties.ImageUrl = "";
                        imageCount++;
                        break;
                    case "XRLine":
                        el.Type = "line";
                        el.Properties.StrokeColor = c.Color ?? "#000000";
                        el.Properties.StrokeWidth = 1;
                        break;
                    case "XRShape":
                        el.Type = "rectangle";
                        el.Properties.StrokeColor = c.Color ?? "#000000";
                        el.Properties.StrokeWidth = 1;
                        el.Properties.FillColor = "transparent";
                        break;
                    default:
                        continue; // unknown control type -> skip
                }

                el.Id = $"el_{++idSeq}";
                result.Elements.Add(el);
            }

            if (imageCount > 0)
                result.Warnings.Add($"{imageCount} image element(s) imported as empty placeholders (embedded image bytes not extracted yet) — re-add the image in the designer.");
            if (itfCount > 0)
                result.Warnings.Add($"{itfCount} Interleaved2of5 (ITF) barcode(s) converted to CODE128 (web has no ITF renderer).");
            if (panelBorderSkipped > 0)
                result.Warnings.Add($"{panelBorderSkipped} panel border(s) were not reproduced.");
        }

        private void FillText(LabelElementDto el, Ctrl c, LegacyLabelConversionResult result)
        {
            var p = el.Properties;
            p.FontFamily = c.FontFamily ?? "Arial";
            p.FontSize = c.FontSizePt.HasValue ? Round(c.FontSizePt.Value * PointToPx) : 12;
            if (c.Bold) p.Bold = true;
            if (c.Italic) p.Italic = true;
            p.Color = c.Color ?? "#000000";
            p.TextAlign = MapAlign(c.TextAlignment);

            // Prefer an explicit data binding; otherwise detect a [Token] inside the literal Text.
            string? field = c.BindingField != null ? StripPrefix(c.BindingField) : null;
            if (field == null && c.Text != null)
            {
                var tm = Regex.Match(c.Text, @"\[(?:ItemsLabels\.)?(\w+)\]");
                if (tm.Success) field = tm.Groups[1].Value;
            }

            if (field != null)
            {
                if (FieldMap.TryGetValue(field, out var token) && token != null)
                {
                    p.DataField = token;
                    p.Text = token;
                    if (ApproximatedFields.Contains(field))
                        result.Warnings.Add($"Field '{field}' approximated as '{token}'.");
                }
                else
                {
                    // No faithful token: keep as static placeholder text and flag.
                    p.Text = $"[{field}]";
                    result.Warnings.Add($"Field '{field}' has no web equivalent; imported as static text '[{field}]'.");
                }
            }
            else
            {
                p.Text = c.Text ?? "";
            }
        }

        /// <returns>true if an ITF fallback substitution happened</returns>
        private bool FillBarcode(LabelElementDto el, Ctrl c, LegacyLabelConversionResult result)
        {
            var p = el.Properties;
            bool itf = false;
            p.BarcodeType = c.SymbologyType switch
            {
                "Code128Generator" => "CODE128",
                "UPCAGenerator" => "UPC",
                "EAN13Generator" => "EAN13",
                "Code39Generator" => "CODE39",
                "Code39ExtendedGenerator" => "CODE39",
                "QRCodeGenerator" => "QR",
                "Interleaved2of5Generator" => MarkItf(ref itf),
                _ => "CODE128"
            };
            p.ShowText = c.ShowText ?? true;
            p.BarcodeHeight = el.Height > 0 ? Round(el.Height * 0.8) : 35;

            string? field = c.BindingField != null ? StripPrefix(c.BindingField) : "BarcodeNumber";
            var token = field != null && FieldMap.TryGetValue(field, out var t) ? t : "[BarcodeNumber]";
            p.DataField = token ?? "[BarcodeNumber]";
            p.BarcodeValue = string.IsNullOrEmpty(c.Text) ? "1234567890" : c.Text;
            return itf;
        }

        private static string MarkItf(ref bool itf) { itf = true; return "CODE128"; }

        private static (double x, double y) Absolute(Ctrl c, Dictionary<string, Ctrl> controls, Dictionary<string, string> parentOf)
        {
            double x = c.X, y = c.Y;
            var cur = c.Name;
            var guard = 0;
            while (parentOf.TryGetValue(cur, out var parent) && guard++ < 50)
            {
                if (controls.TryGetValue(parent, out var pc)) { x += pc.X; y += pc.Y; }
                cur = parent;
            }
            return (x, y);
        }

        // ---- Helpers -----------------------------------------------------------

        private static string ExtractInitializeComponentBody(string content)
        {
            var start = content.IndexOf("InitializeComponent()", StringComparison.Ordinal);
            if (start < 0) throw new InvalidOperationException("InitializeComponent not found.");
            var brace = content.IndexOf('{', start);
            if (brace < 0) throw new InvalidOperationException("InitializeComponent body not found.");
            var end = content.IndexOf("EndInit();", brace, StringComparison.Ordinal);
            if (end < 0) end = content.Length;
            return content.Substring(brace + 1, end - brace - 1);
        }

        private static IEnumerable<string> SplitStatements(string body) =>
            body.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        private static string Normalize(string s)
        {
            // Strip // comment lines, then collapse all whitespace to single spaces.
            var noComments = Regex.Replace(s, @"^\s*//.*$", "", RegexOptions.Multiline);
            return Regex.Replace(noComments, @"\s+", " ").Trim();
        }

        private static double ParseF(string v) =>
            double.Parse(v.TrimEnd('F', 'f'), NumberStyles.Float, CultureInfo.InvariantCulture);

        private static string? StripPrefix(string field)
        {
            var idx = field.IndexOf('.');
            var f = idx >= 0 ? field[(idx + 1)..] : field;
            return f.Replace(" ", ""); // e.g. "SP Price" -> "SPPrice"
        }

        private static string MapAlign(string? alignment)
        {
            if (alignment == null) return "left";
            if (alignment.Contains("Right")) return "right";
            if (alignment.Contains("Center")) return "center";
            return "left";
        }

        private static string ParseColor(string expr)
        {
            var argb = Regex.Match(expr, @"FromArgb\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*\)");
            if (argb.Success)
                return $"#{int.Parse(argb.Groups[2].Value):X2}{int.Parse(argb.Groups[3].Value):X2}{int.Parse(argb.Groups[4].Value):X2}";
            var rgb = Regex.Match(expr, @"FromArgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)");
            if (rgb.Success)
                return $"#{int.Parse(rgb.Groups[1].Value):X2}{int.Parse(rgb.Groups[2].Value):X2}{int.Parse(rgb.Groups[3].Value):X2}";
            var named = Regex.Match(expr, @"Color\.(\w+)");
            return named.Success ? named.Groups[1].Value.ToLowerInvariant() : "#000000";
        }

        private static double Round(double v) => Math.Round(v, 2);
        private static decimal Round2(decimal v) => Math.Round(v, 4);

        // ---- Working types -----------------------------------------------------

        private class Ctrl
        {
            public string Name = "";
            public string Kind = "";
            public double X, Y, W, H;
            public bool HasLocation, HasSize;
            public string? FontFamily;
            public double? FontSizePt;
            public bool Bold, Italic;
            public string? Text;
            public string? BindingField;
            public string? BindingFormat;
            public string? TextAlignment;
            public string? Color;
            public string? SymbologyVar;
            public string? SymbologyType;
            public bool? ShowText;
            public double? Angle;
        }

        private class ReportInfo
        {
            public int? PageWidth, PageHeight;
            public bool Landscape;
            public int MarginLeft, MarginRight, MarginTop, MarginBottom;
            public double DetailHeight;
            public int? ColumnCount;
            public double? ColumnWidth, ColumnSpacing;
        }
    }

    /// <summary>Outcome of converting a single legacy layout.</summary>
    public class LegacyLabelConversionResult
    {
        public string Name { get; set; } = "";
        public int? PrinterType { get; set; }
        public bool Failed { get; set; }

        public short LabelType { get; set; }
        public short PaperSize { get; set; }
        public decimal LabelWidth { get; set; }
        public decimal LabelHeight { get; set; }
        public int ColumnsPerPage { get; set; } = 1;
        public int RowsPerPage { get; set; } = 1;
        public decimal MarginLeft { get; set; }
        public decimal MarginTop { get; set; }
        public decimal HorizontalGap { get; set; }
        public decimal VerticalGap { get; set; }

        public List<LabelElementDto> Elements { get; set; } = new();
        public LabelDesignDto? Design { get; set; }
        public string DesignJson { get; set; } = "{\"elements\":[]}";

        public List<string> Warnings { get; set; } = new();
        public int ElementCount => Elements.Count;
    }
}
