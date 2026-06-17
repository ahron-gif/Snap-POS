#nullable enable
using System;

namespace BackOffice.Application.DTOs.Tenant.Reports
{
    /// <summary>
    /// Read DTO for grid + list-of-active queries.
    /// </summary>
    public class CustomDateScopeDto
    {
        public Guid CustomDateScopeID { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        // SortColumn / SortDirection are kept on the entity but no longer
        // user-facing — the new manual-ordering model uses SortOrder.
        // Surfaced in the read DTO until consumers fully migrate.
        public string? SortColumn { get; set; }
        public string? SortDirection { get; set; }
        /// <summary>1-based manual list position. Backed by dbo.CustomDateScope.SortOrder.</summary>
        public int SortOrder { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ModifiedAt { get; set; }
    }

    public class CreateCustomDateScopeDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime FromDate { get; set; }
        public DateTime ToDate { get; set; }
        // Server assigns SortOrder = max+1 on create. Clients can't set it
        // here (would just be ignored). Use the Update DTO to reorder.
        public bool IsActive { get; set; } = true;
    }

    public class UpdateCustomDateScopeDto : CreateCustomDateScopeDto
    {
        public Guid CustomDateScopeID { get; set; }
        /// <summary>
        /// Optional. When set and different from the entity's current SortOrder,
        /// the service shifts neighbouring rows to maintain a contiguous 1..N
        /// ordering. When null/missing, the existing position is preserved.
        /// </summary>
        public int? SortOrder { get; set; }
    }
}
