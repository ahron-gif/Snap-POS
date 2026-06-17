using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Authorization
{
    /// <summary>
    /// Declarative attribute to require a specific permission key on a controller action or class.
    /// Uses the PermissionAuthorizationFilter to enforce.
    ///
    /// Usage:
    ///   [RequirePermission("sales.invoice.create")]
    ///   public async Task&lt;IActionResult&gt; CreateInvoice(...) { ... }
    /// </summary>
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
    public class RequirePermissionAttribute : TypeFilterAttribute
    {
        public RequirePermissionAttribute(string permissionKey)
            : base(typeof(PermissionAuthorizationFilter))
        {
            Arguments = new object[] { permissionKey };
        }
    }
}
