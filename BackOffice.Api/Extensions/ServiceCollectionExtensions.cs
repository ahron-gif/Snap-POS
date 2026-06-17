using BackOffice.Application.Interfaces.Repositories;
using Ctore.Persistence.BO.Mappings;
using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.Extensions.DependencyInjection;
using BackOffice.Persistence.Services;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Persistence.Repositories;
using BackOffice.Persistence.Repositories.Main;
using BackOffice.Persistence.Services.Main;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Application.Interfaces.Services.Print;
using BackOffice.Application.Services.Print;
using BackOffice.Persistence.Services.Print;
using BackOffice.Api.Services;
using BackOffice.Persistence.Services.Tenant;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Application.Configuration;
using BackOffice.Application.Integrations.RdtConnectorApi;
using BackOffice.Application.Interfaces.Services.SmartKartReg;
using BackOffice.Persistence.Services.SmartKartReg;
using BackOffice.Api.Integrations.RdtConnectorApi;
using Microsoft.Extensions.Configuration;
using BackOffice.Api.Services;
using BackOffice.Application.Interfaces.Services.Security;
using BackOffice.Infrastructure.Services.Security;


namespace BackOffice.Api.Extensions
{
    public static class ServiceCollectionExtensions
    {
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            #region Back OfficeServices and Repositories
            services.AddAutoMapper(cfg => cfg.AddMaps(typeof(MappingProfile).Assembly));



            #region "Mian" Repositories
            // WEB-152: tenant DB password encryption. Key is loaded once at startup
            // (fails fast if Security:PasswordEncryption:Key is missing/invalid),
            // so a single instance is safe to share across requests.
            services.AddSingleton<IPasswordCipher, AesPasswordCipher>();

            // Legacy AES cipher used only for the per-tenant EncData blob
            // (FrmStartWz license setup). All constants are hardcoded to match
            // the desktop BackOffice byte-for-byte, so this is stateless and
            // safe as a singleton.
            services.AddSingleton<ILegacyEncCipher, LegacyEncCipher>();

            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IUnitOfWorkMain, UnitOfWorkMain>();
            services.AddScoped<IWebAppUserService, WebAppUserService>();
            services.AddScoped<ICustomersMainService, CustomersMainService>();
            services.AddScoped<ISessionService, SessionService>();
            services.AddScoped<ISessionCacheService, SessionCacheService>();
            services.AddScoped<IGlobalRoleService, GlobalRoleService>();
            services.AddScoped<IRolePermissionChecker, RolePermissionChecker>();

            // --- New RBAC Services (Phase 1) ---
            services.AddScoped<IPlanService, PlanService>();
            services.AddScoped<IPermissionRegistryService, PermissionRegistryService>();
            services.AddScoped<ITenantPermissionService, TenantPermissionService>();

            // --- Billing & Subscription Services ---
            services.AddScoped<IUsageTrackingService, UsageTrackingService>();
            services.AddScoped<ISubscriptionService, SubscriptionService>();
            services.AddScoped<ICustomerAppLicenseService, CustomerAppLicenseService>();
            services.AddScoped<IBillingService, BillingService>();
            services.AddScoped<IBillingConfigService, BillingConfigService>();
            services.AddScoped<IApiDefinitionService, ApiDefinitionService>();
            services.AddScoped<ICustomerCreditService, CustomerCreditService>();
            services.AddScoped<IPlanPricingService, PlanPricingService>();
            services.AddScoped<IStripeCheckoutService, StripeCheckoutService>();
            services.AddScoped<IStripeCatalogService, StripeCatalogService>();
            services.AddScoped<IStripeAdminService, StripeAdminService>();
            services.AddScoped<IAddOnService, AddOnService>();

            // --- RBAC Phase 3: Authorization Engine ---
            services.AddScoped<IEffectivePermissionBuilder, EffectivePermissionBuilder>();

            // --- User-Tenant Assignment ---
            services.AddSingleton<ITenantDbContextFactory, TenantDbContextFactory>();
            services.AddScoped<IUserTenantAssignmentService, UserTenantAssignmentService>();

            // --- License (per-tenant FrmStartWz blob) ---
            services.AddScoped<ILicenseService, LicenseService>();

            // --- Tenant Setup (read-only flags projected from EncData) ---
            // Sits in front of LicenseService with a 30-min IMemoryCache so
            // hot-path screens (Item form, Matrix form, etc.) don't trigger
            // an AES decrypt per request just to check StoreType.
            services.AddScoped<ITenantSetupService, TenantSetupService>();

            // --- MFA Service ---
            services.AddScoped<IMfaService, MfaService>();

            // --- SMTP Settings Resolver + Admin ---
            services.AddScoped<ISmtpSettingsResolver, SmtpSettingsResolver>();
            services.AddScoped<ISmtpAdminService, SmtpAdminService>();

            // --- Environment Access Service ---
            services.AddScoped<IEnvironmentAccessService, EnvironmentAccessService>();
            #endregion

            #region "Tenant" Repositories
            services.AddScoped<IUnitOfWorkTenant, UnitOfWorkTenant>();
            services.AddScoped<IWebUserService, WebUserService>();
            services.AddScoped<IItemService, ItemService>();
            services.AddScoped<ICustomerService, CustomerService>();
            services.AddScoped<IVendorService, VendorService>();
            services.AddScoped<IPhoneOrderService, PhoneOrderService>();
            services.AddScoped<ISystemLookupService, SystemLookupService>();
            services.AddScoped<IDepartmentService, DepartmentService>();
            services.AddScoped<IItemGroupService, ItemGroupService>();
            services.AddScoped<IManufacturerService, ManufacturerService>();
            services.AddScoped<IGridSettingsService, GridSettingsService>();
            services.AddScoped<IGridColumnAccessService, GridColumnAccessService>();
            services.AddScoped<IUserPreferenceService, UserPreferenceService>();
            services.AddScoped<IDashboardService, DashboardService>();
            services.AddScoped<IReportService, ReportService>();
            services.AddScoped<ILabelTemplateService, LabelTemplateService>();
            services.AddScoped<ILegacyLabelImportService, LegacyLabelImportService>();
            services.AddScoped<ILegacyGroupImportService, LegacyGroupImportService>();
            services.AddScoped<IRequestResponseLogService, RequestResponseLogService>();
            services.AddScoped<ISupplierService, SupplierService>();
            services.AddScoped<IAdjustInventoryService, AdjustInventoryService>();
            services.AddScoped<IPurchaseOrderService, PurchaseOrderService>();
            services.AddScoped<IReceiveOrderService, ReceiveOrderService>();
            services.AddScoped<IPaymentService, PaymentService>();
            services.AddScoped<IReturnToVendorService, ReturnToVendorService>();
            services.AddScoped<IGenOrderService, GenOrderService>();
            services.AddScoped<IItemOnPhoneOrderService, ItemOnPhoneOrderService>();
            services.AddScoped<IItemDetailsOnPhoneOrderService, ItemDetailsOnPhoneOrderService>();
            services.AddScoped<IReplacedItemService, ReplacedItemService>();
            services.AddScoped<IReceivePaymentService, ReceivePaymentService>();
            services.AddScoped<ITransactionListService, TransactionListService>();
            services.AddScoped<IRegisterListService, RegisterListService>();
            services.AddScoped<IDiscountListService, DiscountListService>();
            services.AddScoped<IRequestTransferListService, RequestTransferListService>();
            services.AddScoped<ITransferItemsListService, TransferItemsListService>();
            services.AddScoped<IReceiveTransferListService, ReceiveTransferListService>();
            services.AddScoped<IStoreListService, StoreListService>();
            services.AddScoped<IComputerListService, ComputerListService>();
            services.AddScoped<ICustomDateScopeService, CustomDateScopeService>();
            // --- RBAC Phase 2: Tenant RBAC Service ---
            services.AddScoped<ITenantRbacService, TenantRbacService>();

            // --- Audit Log Service ---
            services.AddScoped<IAuditLogService, AuditLogService>();

            // --- User Management (dual-DB CRUD) ---
            services.AddScoped<IWebUserManagementService, WebUserManagementService>();

            // --- Print Agent ---
            services.AddSingleton<IPrintAgentPairingStore, InMemoryPrintAgentPairingStore>();
            services.AddScoped<IPrintAgentService, PrintAgentService>();
            services.AddSingleton<IPrintAgentInstallerService>(sp =>
                new PrintAgentInstallerService(
                    sp.GetRequiredService<IConfiguration>(),
                    sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<PrintAgentInstallerService>>(),
                    sp.GetRequiredService<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>().ContentRootPath));

            #endregion

            #region "SmartKartReg" Services
            services.AddScoped<IPermissionService, PermissionService>();
            services.AddScoped<IStoreTokenService, StoreTokenService>();
            services.AddScoped<ITokenPermissionService, TokenPermissionService>();
            services.AddScoped<IRegistrationService, RegistrationService>();
            services.AddScoped<IApplicationService, ApplicationService>();
            services.AddScoped<IAppRegistrationService, AppRegistrationService>();
            #endregion

            #endregion

            return services;
        }

        public static IServiceCollection AddS3Services(this IServiceCollection services, IConfiguration configuration)
        {
            services.Configure<AwsS3Settings>(configuration.GetSection(AwsS3Settings.SectionName));
            services.AddScoped<ITenantInfo, TenantInfoAdapter>();
            services.AddScoped<IS3StorageService, S3StorageService>();
            return services;
        }

        public static IServiceCollection AddFluentValidationServices(this IServiceCollection services)
        {
            services.AddValidatorsFromAssemblyContaining<BackOffice.Application.Validators.User.CreateUserDtoValidator>();
            services.AddFluentValidationAutoValidation();

            return services;
        }

        public static IServiceCollection AddRdtConnectorApiClient(this IServiceCollection services, IConfiguration configuration)
        {
            services.AddHttpClient<IRdtConnectorApiClient, RdtConnectorApiClient>();
            return services;
        }
    }
}
