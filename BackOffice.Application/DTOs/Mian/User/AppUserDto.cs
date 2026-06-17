using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs.Mian.User
{
    public  class AppUserDto
    {
        public int UserId { get; set; }

        public string UserName { get; set; } = null!;

        public string Password { get; set; } = null!;

        public string? APIToken { get; set; }

        public string? Email { get; set; }

        public DateTime? LastLoginDate { get; set; }

        public Guid LocalUserId { get; set; }

        public DateTime DateCreated { get; set; }

        public DateTime? DateModified { get; set; }

        public int? SystemUserCreated { get; set; }

        public int? CustomerId { get; set; }

        public string? Phone { get; set; }

        public string? UserFName { get; set; }

        public string? UserLName { get; set; }

        public string? Address { get; set; }

        public string? WorkPhoneNumber { get; set; }

        public string? Fax { get; set; }

        public string? ZipCode { get; set; }

        public bool? IsSuperAdmin { get; set; }

        public short? Status { get; set; }
    }

    /// <summary>
    /// Lightweight DTO for user lookup/dropdown selection
    /// </summary>
    public class UserLookupDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = null!;
        public string? Email { get; set; }
        public Guid LocalUserId { get; set; }
    }
}
