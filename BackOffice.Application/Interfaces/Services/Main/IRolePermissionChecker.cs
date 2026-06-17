namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface IRolePermissionChecker
    {
        Task<bool> UserHasPermissionAsync(int userId, int? customerId, string modulePageUrl, string actionKey);
        Task<bool> CustomerHasModuleAccessAsync(int customerId, string modulePageUrl);
        void InvalidateUserCache(int userId);
        void InvalidateCustomerCache(int customerId);
    }
}
