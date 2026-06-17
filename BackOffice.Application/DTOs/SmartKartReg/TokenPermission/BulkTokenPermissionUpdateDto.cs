using System.ComponentModel.DataAnnotations;

namespace BackOffice.Application.DTOs.SmartKartReg.TokenPermission
{
    /// <summary>
    /// DTO for bulk updating token permission assignments (allow/deny)
    /// </summary>
    public class BulkTokenPermissionUpdateDto
    {
        [Required]
        public List<TokenPermissionItemDto> Permissions { get; set; } = new();
    }

    /// <summary>
    /// Individual permission assignment within a bulk update
    /// </summary>
    public class TokenPermissionItemDto
    {
        [Required]
        public int PermissionId { get; set; }

        public bool IsAllowed { get; set; } = true;
    }
}
