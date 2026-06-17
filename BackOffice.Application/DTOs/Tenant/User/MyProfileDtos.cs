using System;

namespace BackOffice.Application.DTOs.Tenant.User
{
    /// <summary>
    /// Read model for the logged-in user's own profile (the /profile page).
    /// The caller is always resolved from the JWT — never from a client-supplied
    /// id — so this only ever describes "me".
    /// </summary>
    public class MyProfileDto
    {
        public Guid TenantUserId { get; set; }
        public int MainUserId { get; set; }

        /// <summary>Read-only — username can never be changed via self-service.</summary>
        public string UserName { get; set; } = string.Empty;

        public string? Email { get; set; }
        public string? Phone { get; set; }

        /// <summary>Raw S3 key as stored on WebAppUsers.ProfileImage (NULL when unset).</summary>
        public string? ProfileImagePath { get; set; }

        /// <summary>
        /// Short-lived pre-signed S3 URL the browser can load directly. Populated
        /// by the controller (which owns the S3 service); NULL when no image.
        /// </summary>
        public string? ProfileImageUrl { get; set; }
    }

    /// <summary>
    /// Self-service profile update payload. Email + phone only — username is
    /// intentionally absent and the password has its own dedicated, current-
    /// password-verified endpoint. Each field is optional: a null/blank value
    /// leaves the existing value untouched.
    /// </summary>
    public class UpdateMyProfileDto
    {
        public string? Email { get; set; }
        public string? Phone { get; set; }
    }

    /// <summary>
    /// Self-service password change. The caller must prove ownership with their
    /// current password before the new one is accepted.
    /// </summary>
    public class ChangePasswordDto
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
        public string ConfirmPassword { get; set; } = string.Empty;
    }
}
