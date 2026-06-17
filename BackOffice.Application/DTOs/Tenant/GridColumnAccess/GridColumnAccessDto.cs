using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace BackOffice.Application.DTOs.Tenant.GridColumnAccess
{
    /// <summary>
    /// DTO for a single column-access rule (used in request and response bodies).
    /// </summary>
    public class ColumnAccessItemDto
    {
        /// <summary>
        /// Column field name (matches the ServerGrid Column.field on the frontend).
        /// </summary>
        [JsonPropertyName("field")]
        public string Field { get; set; } = null!;

        /// <summary>
        /// true = user is allowed to see the column; false = column is stripped.
        /// </summary>
        [JsonPropertyName("allowedToView")]
        public bool AllowedToView { get; set; } = true;

        /// <summary>
        /// Optional display-label override. When non-null/non-empty the grid
        /// renders this text in place of the column's default header name.
        /// Null or empty means "use the default header".
        /// </summary>
        [JsonPropertyName("displayName")]
        public string? DisplayName { get; set; }

        /// <summary>
        /// Optional position override. Lower numbers render first. Null means
        /// "use the natural position from the column definitions".
        /// </summary>
        [JsonPropertyName("sortOrder")]
        public int? SortOrder { get; set; }

        /// <summary>
        /// Optional pixel width override. Null means "use the natural width".
        /// </summary>
        [JsonPropertyName("width")]
        public int? Width { get; set; }

        /// <summary>
        /// Optional footer aggregate type (e.g. "sum", "avg"). Null means
        /// no aggregate is rendered for this column.
        /// </summary>
        [JsonPropertyName("aggregateType")]
        public string? AggregateType { get; set; }

        /// <summary>
        /// True when the TENANT DEFAULT row explicitly restricts this column
        /// (Super Admin set AllowedToView = false at the tenant level). The
        /// frontend uses this to strip the column entirely — not even the
        /// in-grid column chooser shows it.
        ///
        /// Distinguishes "Super Admin revoked access" from "the user toggled
        /// this off in their own chooser". The latter also produces
        /// AllowedToView = false in the merged response, but should keep the
        /// column listed in the chooser so the user can re-check it. Without
        /// this flag the frontend can't tell those two cases apart.
        ///
        /// Set only by GetEffectiveForUserAsync — write-side endpoints
        /// (Save / Get raw) ignore this field on the way in.
        /// </summary>
        [JsonPropertyName("isTenantRestricted")]
        public bool IsTenantRestricted { get; set; }
    }

    /// <summary>
    /// DTO for saving (upserting) the full column-access set for a user + grid.
    /// The server replaces all existing rules for the pair with this set.
    /// </summary>
    public class SaveGridColumnAccessDto
    {
        /// <summary>
        /// Target user whose access is being modified.
        /// </summary>
        [JsonPropertyName("userId")]
        public Guid UserId { get; set; }

        /// <summary>
        /// Grid identifier (must match a gridId registered in the frontend GRID_REGISTRY).
        /// </summary>
        [JsonPropertyName("gridId")]
        public string GridId { get; set; } = null!;

        /// <summary>
        /// Full column-access set. Any column not present in this list is treated
        /// as "allowed" (no row is persisted for it).
        /// </summary>
        [JsonPropertyName("columns")]
        public List<ColumnAccessItemDto> Columns { get; set; } = new();
    }

    /// <summary>
    /// DTO returned when fetching a user's column access for a grid.
    /// </summary>
    public class GridColumnAccessResponseDto
    {
        /// <summary>
        /// User the rules belong to.
        /// </summary>
        [JsonPropertyName("userId")]
        public Guid UserId { get; set; }

        /// <summary>
        /// Grid identifier.
        /// </summary>
        [JsonPropertyName("gridId")]
        public string GridId { get; set; } = null!;

        /// <summary>
        /// Column-access rules. Only columns with explicit rules are returned —
        /// anything not listed is "allowed" by default.
        /// </summary>
        [JsonPropertyName("columns")]
        public List<ColumnAccessItemDto> Columns { get; set; } = new();

        /// <summary>
        /// When the most-recent rule in this set was last modified.
        /// Null if no rules have ever been saved.
        /// </summary>
        [JsonPropertyName("lastModified")]
        public DateTime? LastModified { get; set; }

        /// <summary>
        /// UserId of the Super Admin who last saved any rule in this set.
        /// Null if no rules have ever been saved.
        /// </summary>
        [JsonPropertyName("modifiedBy")]
        public Guid? ModifiedBy { get; set; }
    }
}
