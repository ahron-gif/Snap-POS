using BackOffice.Infrastructure.DBContext.Tenant;
using BackOffice.Persistence.Services.Tenant;
using Microsoft.EntityFrameworkCore;
using Xunit;
using Xunit.Abstractions;

namespace BackOffice.Application.Test
{
    /// <summary>
    /// Live, READ-ONLY check that <see cref="LegacyLabelImportService"/> reads the tenant's
    /// PrintLabelLayout rows and converts them end-to-end (EF + converter glue) against the
    /// Develop_SelfCheckout database. Writes nothing. Skips if the DB is unreachable.
    /// </summary>
    public class LegacyLabelImportServiceLiveTest
    {
        private const string ConnectionString =
            "Server=rdt-cloud.database.windows.net;Database=Develop_SelfCheckout;User ID=rdt;Password=Datasoft963;Encrypt=True;TrustServerCertificate=True;Connection Timeout=60";

        private readonly ITestOutputHelper _out;
        public LegacyLabelImportServiceLiveTest(ITestOutputHelper output) => _out = output;

        [Fact]
        public async Task GetLegacyLayouts_Reads_And_Converts_From_Live_Tenant_Db()
        {
            var options = new DbContextOptionsBuilder<TenantDBContext>()
                .UseSqlServer(ConnectionString)
                .Options;

            await using var ctx = new TenantDBContext(options);

            try
            {
                if (!await ctx.Database.CanConnectAsync())
                {
                    _out.WriteLine("SKIP: cannot connect to Develop_SelfCheckout.");
                    return;
                }
            }
            catch (Exception ex)
            {
                _out.WriteLine($"SKIP: connection failed: {ex.Message}");
                return;
            }

            var service = new LegacyLabelImportService(ctx);
            var result = await service.GetLegacyLayoutsAsync();

            Assert.True(result.IsSuccess, result.Message);
            Assert.NotNull(result.Response);

            _out.WriteLine($"Legacy layouts found: {result.Response!.Count}");
            foreach (var p in result.Response)
            {
                _out.WriteLine(
                    $"  {p.LayoutName,-24} type={p.LabelType} {p.LabelWidth}\"x{p.LabelHeight}\" " +
                    $"cols={p.ColumnsPerPage} elems={p.ElementCount} alreadyImported={p.AlreadyImported} " +
                    $"warnings={p.Warnings.Count} failed={p.Failed}");
            }

            // Every row should at least convert to *something* (or be explicitly flagged failed).
            Assert.All(result.Response, p => Assert.True(p.ElementCount > 0 || p.Failed));
        }
    }
}
