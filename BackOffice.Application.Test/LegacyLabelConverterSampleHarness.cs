using System.Text;
using BackOffice.Application.Services.Tenant.LabelImport;
using Xunit;
using Xunit.Abstractions;

namespace BackOffice.Application.Test
{
    /// <summary>
    /// Local validation harness (NOT a CI unit test): runs the legacy label converter over the
    /// real <c>PrintLabelLayout</c> samples exported from the Develop_SelfCheckout tenant and
    /// writes the converted DesignJson + a human-readable report next to the samples.
    /// Skips automatically if the sample folder is not present.
    /// </summary>
    public class LegacyLabelConverterSampleHarness
    {
        private const string SamplesDir = @"D:\Upwork\RDT\Both\_legacy_label_samples";
        private readonly ITestOutputHelper _out;

        public LegacyLabelConverterSampleHarness(ITestOutputHelper output) => _out = output;

        [Fact]
        public void Convert_All_Real_Samples()
        {
            if (!Directory.Exists(SamplesDir))
            {
                _out.WriteLine($"SKIP: samples dir not found: {SamplesDir}");
                return;
            }

            var outDir = Path.Combine(SamplesDir, "_converted");
            Directory.CreateDirectory(outDir);

            var converter = new LegacyLabelLayoutConverter();
            var report = new StringBuilder();
            report.AppendLine("Legacy label conversion report");
            report.AppendLine("================================");

            var files = Directory.GetFiles(SamplesDir, "*.txt").OrderBy(f => f).ToList();
            int ok = 0, withElements = 0;

            foreach (var file in files)
            {
                var name = Path.GetFileNameWithoutExtension(file);
                var content = File.ReadAllText(file);
                var r = converter.Convert(content, name, null);

                File.WriteAllText(Path.Combine(outDir, name + ".design.json"), r.DesignJson);

                if (!r.Failed) ok++;
                if (r.ElementCount > 0) withElements++;

                report.AppendLine();
                report.AppendLine($"### {name}");
                report.AppendLine($"  size      : {r.LabelWidth}\" x {r.LabelHeight}\"  | cols={r.ColumnsPerPage} rows={r.RowsPerPage} | paper={r.PaperSize} type={r.LabelType}");
                report.AppendLine($"  margins   : L={r.MarginLeft} T={r.MarginTop} hGap={r.HorizontalGap}");
                report.AppendLine($"  elements  : {r.ElementCount}  ({string.Join(", ", r.Elements.GroupBy(e => e.Type).Select(g => $"{g.Key}:{g.Count()}"))})");
                if (r.Warnings.Count > 0)
                    foreach (var w in r.Warnings) report.AppendLine($"  warn      : {w}");
            }

            report.Insert(0, $"Converted {ok}/{files.Count} layouts ({withElements} with >=1 element)\n\n");
            var reportPath = Path.Combine(outDir, "_report.txt");
            File.WriteAllText(reportPath, report.ToString());

            _out.WriteLine(report.ToString());
            _out.WriteLine($"Outputs written to: {outDir}");

            Assert.True(files.Count > 0, "No sample files found.");
            Assert.True(withElements >= files.Count - 1, $"Only {withElements}/{files.Count} layouts produced elements.");
        }
    }
}
