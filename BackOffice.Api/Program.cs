using BackOffice.Api.Authorization;
using BackOffice.Api.Extensions;
using BackOffice.Api.Middlewares;
using BackOffice.Api.Services;
using BackOffice.Application.Configuration;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Infrastructure.DBContext.Tenant;
using BackOffice.Infrastructure.Interceptors;
using Microsoft.AspNetCore.Authorization;
using SmartKartReg.Infrastructure.DBContext;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi.Models;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Load user-secrets explicitly so Stripe keys are available regardless of
// ASPNETCORE_ENVIRONMENT (default WebApplication only loads them in Development).
builder.Configuration.AddUserSecrets<Program>(optional: true);

// Configure Serilog for logging
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .WriteTo.File("Logs/log.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container (camelCase so frontend grid field names like "changeDate" match API response).
//
// Switched from the legacy CamelCasePropertyNamesContractResolver to DefaultContractResolver +
// CamelCaseNamingStrategy. The legacy resolver camel-cases BOTH property names AND
// Dictionary<string,T> KEYS — so a row's Cells dict keyed by department name "TEST 2" was
// being serialized as "test 2", and the frontend lookup `row.cells["TEST 2"]` returned
// undefined. The newer naming strategy defaults to `ProcessDictionaryKeys = false`, which
// preserves dictionary keys verbatim while still camel-casing C# property names. Property-
// name behavior is unchanged for every other endpoint.
builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ContractResolver = new Newtonsoft.Json.Serialization.DefaultContractResolver
        {
            NamingStrategy = new Newtonsoft.Json.Serialization.CamelCaseNamingStrategy
            {
                ProcessDictionaryKeys = false,
                OverrideSpecifiedNames = true, // keep camel-casing properties whose names weren't explicitly set
            },
        };
    });

// Configure JWT options and bind them from appsettings.json
builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));

// Configure SecuritySettings (MFA encryption key, token expiry, etc.)
builder.Services.Configure<SecuritySettings>(builder.Configuration.GetSection(SecuritySettings.SectionName));

// Configure Stripe settings (keys live in user-secrets / env vars, not appsettings).
builder.Services.Configure<StripeSettings>(builder.Configuration.GetSection(StripeSettings.SectionName));

// Register current environment settings from appsettings
var envIdStr = (builder.Configuration["CurrentEnvironmentId"] ?? "").Trim();
Guid.TryParse(envIdStr, out var currentEnvId);
builder.Services.AddSingleton(new EnvironmentSettings { CurrentEnvironmentId = currentEnvId });

// Register audit interceptor
builder.Services.AddScoped<AuditSaveChangesInterceptor>();

// Register DbContexts
builder.Services.AddDbContext<MainDBContext>(
    (serviceProvider, options) =>
    {
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            b => b.MigrationsAssembly("BackOffice.Infrastructure.Migrations")
        );
        options.AddInterceptors(serviceProvider.GetRequiredService<AuditSaveChangesInterceptor>());
    }
);

// Register TenantDBContext
builder.Services.AddDbContext<TenantDBContext>(
    (serviceProvider, options) =>
    {
        var defaultConnectionString = builder.Configuration.GetConnectionString("DefaultConnection");

        options.UseSqlServer(defaultConnectionString, sqlOptions =>
        {
            sqlOptions.MigrationsAssembly("BackOffice.Infrastructure.Migrations");
            sqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorNumbersToAdd: null
            );
        });
        options.AddInterceptors(serviceProvider.GetRequiredService<AuditSaveChangesInterceptor>());
    }
    //ServiceLifetime.Transient,   // DbContext lifetime
    //ServiceLifetime.Transient    // DbContextOptions lifetime
);



// Register RegistrationDbContext (SmartKartRegistration database)
builder.Services.AddDbContext<RegistrationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("RegistrationConn")
    )
);


// Register custom services like JWT Authentication, FluentValidation, etc.

builder.Services.AddMemoryCache();
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddApplicationServices();
builder.Services.AddS3Services(builder.Configuration);
builder.Services.AddChatbotServices(builder.Configuration);
builder.Services.AddFluentValidationServices();
builder.Services.AddScoped<ITenantProvider, TenantProvider>();
builder.Services.AddHostedService<SessionCleanupService>();
builder.Services.AddHostedService<BillingBackgroundService>();
builder.Services.AddHostedService<UsageSnapshotService>();
builder.Services.AddHostedService<MfaCleanupService>();

// Register RDT Connector API client for cross-service cache invalidation
builder.Services.AddRdtConnectorApiClient(builder.Configuration);

// Register token-based permission authorization
builder.Services.AddSingleton<IAuthorizationPolicyProvider, TokenPermissionPolicyProvider>();
builder.Services.AddScoped<IAuthorizationHandler, TokenPermissionHandler>();

// Configure Swagger for API documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    // Use full type name to avoid schema-id collisions between namespaces
    c.CustomSchemaIds(type => type.FullName?.Replace("+", "."));

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()       // Allow all origins
              .AllowAnyHeader()      // Allow all headers
              .AllowAnyMethod();     // Allow all HTTP methods
    });
});

var app = builder.Build();

// ─── Middleware order matters! ───────────────────────────────────────────
// CORS must be FIRST so that even 401/500 responses include the
// Access-Control-Allow-Origin header. Without this, the browser blocks
// error responses and the frontend can't read the status code.
app.UseCors("AllowAll");

app.UseHttpsRedirection();

// Use Swagger in development or production
if (app.Environment.IsDevelopment() || app.Environment.IsProduction())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Authentication MUST come before any middleware that reads context.User
// (TenantConnectionMiddleware, SessionValidationMiddleware both read claims).
app.UseAuthentication();

// Error handler wraps everything below — catches unhandled exceptions.
app.UseMiddleware<ErrorHandlingMiddleware>();

// Tenant + session middlewares need context.User populated by UseAuthentication.
app.UseMiddleware<TenantConnectionMiddleware>();
app.UseMiddleware<SessionValidationMiddleware>();

// Environment access check — runs after session is validated.
// Denies requests from users who lack web access or the current environment mapping.
app.UseMiddleware<EnvironmentAccessMiddleware>();

app.UseAuthorization();

// Map controllers
app.MapControllers();

// Run the application
app.Run();
