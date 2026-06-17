#nullable enable
using System;

namespace BackOffice.Domain.Entities.Tenant;

/// <summary>
/// Stores Super-Admin-defined per-user column visibility restrictions for a grid.
///
/// A row with AllowedToView = false means the specified user is NOT permitted to
/// see that column on the specified grid — the column is completely removed
/// from their UI (not merely hidden by default).
///
/// Absence of a row for a (UserId, GridId, Field) combination is treated as
/// "allowed" (default-visible). Rows are only inserted when a Super Admin
/// explicitly toggles access.
/// </summary>
public class UserGridColumnAccess
{
    /// <summary>
    /// Primary key
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// User ID (from Users table) whose column access is being governed
    /// </summary>
    public Guid UserId { get; set; }

    /// <summary>
    /// Unique identifier for the grid (e.g., "items-list-grid", "customers-list-grid").
    /// Must match the gridId registered in the frontend GRID_REGISTRY.
    /// </summary>
    public string GridId { get; set; } = null!;

    /// <summary>
    /// Column field name (matches the `field` on the grid's Column definition).
    /// </summary>
    public string Field { get; set; } = null!;

    /// <summary>
    /// True if the user is allowed to see this column; false if it should be
    /// stripped from their grid entirely.
    /// </summary>
    public bool AllowedToView { get; set; } = true;

    /// <summary>
    /// Optional Super-Admin-defined override for the column's display label.
    /// When non-null, the grid renders this text in place of the default
    /// header name. Null means "use the column's built-in header name".
    ///
    /// Applied with the same precedence as AllowedToView: a user-specific
    /// row's DisplayName wins over the tenant-default row's DisplayName.
    /// </summary>
    public string? DisplayName { get; set; }

    /// <summary>
    /// Optional Super-Admin-defined position for this column when rendered in
    /// the grid. Lower numbers appear first. Null means "use the column's
    /// natural position as defined in the column defs".
    ///
    /// Follows the same precedence as AllowedToView and DisplayName: a user-
    /// specific row's SortOrder wins over the tenant-default row's SortOrder.
    /// Columns without any rule keep their declared position (stable sort).
    /// </summary>
    public int? SortOrder { get; set; }

    /// <summary>
    /// Optional pixel width for this column. NULL means "use the column's
    /// natural width from the column definitions". Follows the same merge
    /// precedence as the other override fields: user-row value wins over
    /// tenant-default value.
    ///
    /// Added when grid visibility/width/aggregate storage was unified onto
    /// this table (migration 20260526_AlterUserGridColumnAccess_AddWidthAndAggregate).
    /// </summary>
    public int? Width { get; set; }

    /// <summary>
    /// Optional aggregate type rendered in the footer for this column
    /// (e.g. "sum", "avg", "count", "min", "max"). NULL means no aggregation.
    /// Follows the same merge precedence as the other override fields.
    ///
    /// Added alongside Width by migration 20260526_AlterUserGridColumnAccess_AddWidthAndAggregate.
    /// </summary>
    public string? AggregateType { get; set; }

    /// <summary>
    /// Date when this access rule was first created
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// Date when this access rule was last modified
    /// </summary>
    public DateTime DateModified { get; set; }

    /// <summary>
    /// UserId of the Super Admin who last saved this rule (nullable for
    /// backwards-compatibility with legacy data).
    /// </summary>
    public Guid? ModifiedBy { get; set; }
}
