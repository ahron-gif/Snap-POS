using System.Threading.RateLimiting;
using BackOffice.PrintAgent;
using BackOffice.PrintAgent.Endpoints;
using BackOffice.PrintAgent.Security;
using BackOffice.PrintAgent.Services;
using BackOffice.PrintAgent.Updates;
using Microsoft.AspNetCore.RateLimiting;
using Serilog;
using Serilog.Events;

var contentRoot = AppContext.BaseDirectory;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = contentRoot
});

builder.Host.UseWindowsService(options =>
{
    options.ServiceName = "BackOfficePrintAgent";
});

builder.Services.Configure<PrintAgentSettings>(builder.Configuration.GetSection("Agent"));
var settings = builder.Configuration.GetSection("Agent").Get<PrintAgentSettings>() ?? new PrintAgentSettings();

var logFile = Environment.ExpandEnvironmentVariables(settings.LogPath);
var logDir = Path.GetDirectoryName(logFile);
if (!string.IsNullOrEmpty(logDir)) Directory.CreateDirectory(logDir);

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.File(logFile, rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14)
    .WriteTo.EventLog("BackOfficePrintAgent", manageEventSource: false, restrictedToMinimumLevel: LogEventLevel.Warning)
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddSingleton<CertificateProvider>();
builder.Services.AddSingleton<IPairingService, PairingService>();
builder.Services.AddSingleton<IPrinterEnumerator, PrinterEnumerator>();
builder.Services.AddSingleton<PdfPrinter>();
builder.Services.AddSingleton<IPrintJobService, PrintJobService>();
builder.Services.AddSingleton<IJobJwtValidator, JobJwtValidator>();
builder.Services.AddSingleton<UpdateService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("agent-allowed", policy =>
    {
        var explicitOrigins = settings.AllowedOrigins?.ToArray() ?? Array.Empty<string>();
        policy
            .SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrEmpty(origin)) return false;
                if (explicitOrigins.Any(o => string.Equals(o, origin, StringComparison.OrdinalIgnoreCase)))
                    return true;
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
                var host = uri.Host;
                return string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
                    || host == "127.0.0.1"
                    || host == "[::1]";
            })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddRateLimiter(opt =>
{
    opt.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    opt.AddPolicy("agent-default", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = settings.RateLimit.PermitLimit,
                Window = TimeSpan.FromSeconds(settings.RateLimit.WindowSeconds),
                QueueLimit = 0
            }));
    opt.AddPolicy("agent-print", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anon",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = Math.Max(10, settings.RateLimit.PermitLimit / 2),
                Window = TimeSpan.FromSeconds(settings.RateLimit.WindowSeconds),
                QueueLimit = 0
            }));
});

builder.WebHost.ConfigureKestrel((ctx, options) =>
{
    var s = ctx.Configuration.GetSection("Agent").Get<PrintAgentSettings>() ?? new PrintAgentSettings();
    var certProvider = new CertificateProvider(
        Microsoft.Extensions.Options.Options.Create(s),
        new Microsoft.Extensions.Logging.Abstractions.NullLogger<CertificateProvider>());
    var cert = certProvider.LoadOrCreate();

    options.ListenLocalhost(s.HttpsPort, listen =>
    {
        listen.UseHttps(cert);
    });
});

var app = builder.Build();

app.UseSerilogRequestLogging();

app.Use(async (context, next) =>
{
    var isPreflight = HttpMethods.IsOptions(context.Request.Method);

    // Set Private Network / Local Network Access headers on every response, not just preflights.
    // Chrome 117+ checks PNA on preflights; Chrome 138+ checks LNA. Some builds also inspect
    // the actual response. Setting unconditionally is safe — these headers only matter when the
    // caller is in a different IP address space, and harmless otherwise.
    context.Response.OnStarting(() =>
    {
        context.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
        context.Response.Headers["Access-Control-Allow-Local-Network-Access"] = "true";
        return Task.CompletedTask;
    });

    if (isPreflight)
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        context.Response.Headers["Access-Control-Allow-Private-Network"] = "true";
        context.Response.Headers["Access-Control-Allow-Local-Network-Access"] = "true";
    }

    await next();
});

app.UseCors("agent-allowed");
app.UseRateLimiter();

app.MapPrintAgentEndpoints();

Log.Information("BackOffice Print Agent v{Version} listening on https://localhost:{Port}",
    settings.Version, settings.HttpsPort);

try
{
    await app.RunAsync();
}
finally
{
    Log.CloseAndFlush();
}
