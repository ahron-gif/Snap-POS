using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DiagnosticsController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<DiagnosticsController> _logger;

        public DiagnosticsController(
            IConfiguration configuration,
            IWebHostEnvironment environment,
            ILogger<DiagnosticsController> logger)
        {
            _configuration = configuration;
            _environment = environment;
            _logger = logger;
        }

        [HttpGet("DbInfo")]
        public IActionResult GetDbInfo()
        {
            var defaultConn = _configuration.GetConnectionString("DefaultConnection");
            var registrationConn = _configuration.GetConnectionString("RegistrationConn");

            var result = new
            {
                Environment = _environment.EnvironmentName,
                AspNetCoreEnvironment = System.Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                CurrentEnvironmentId = _configuration["CurrentEnvironmentId"],
                DefaultConnection = ParseConnection(defaultConn),
                RegistrationConnection = ParseConnection(registrationConn)
            };

            //_logger.LogInformation(
            //    "DbInfo requested. Env={Env}, DefaultDb={Db}, Server={Server}",
            //    "DbInfob requstesz
            //    _environment.EnvironmentName,
            //    (result.DefaultConnection as dynamic)?.Database,
            //    (result.DefaultConnection as dynamic)?.Server);

            return Ok(result);
        }

        private static object? ParseConnection(string? connectionString)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                return null;

            try
            {
                var builder = new SqlConnectionStringBuilder(connectionString);
                return new
                {
                    Server = builder.DataSource,
                    Database = builder.InitialCatalog,
                    User = builder.UserID,
                    TrustServerCertificate = builder.TrustServerCertificate
                };
            }
            catch
            {
                return new { Error = "Unable to parse connection string" };
            }
        }
    }
}
