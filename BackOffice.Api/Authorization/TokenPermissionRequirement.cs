using Microsoft.AspNetCore.Authorization;

namespace BackOffice.Api.Authorization
{
    /// <summary>
    /// Authorization requirement that checks token-based permissions from SmartKartRegistration DB.
    /// If a token exists in DB and has an entry with IsAllowed = false, block the request for that permission.
    /// If a token exists and permissions are allowed, allow the request.
    /// If a token is NOT found in DB, do NOT block the request (pass-through).
    /// </summary>
    public class TokenPermissionRequirement : IAuthorizationRequirement
    {
        public string PermissionKey { get; }

        public TokenPermissionRequirement(string permissionKey)
        {
            PermissionKey = permissionKey;
        }
    }
}
