#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

/// <summary>
/// Global, cross-tenant default column configuration for a grid. Lives in the
/// MAIN (master) database — NOT in any tenant DB — because it is the baseline
/// applied to every tenant that has not saved its own configuration for the
/// grid.
///
/// Read-time precedence (see GridColumnAccessService.GetEffectiveForUserAsync):
///   user override (tenant DB) → tenant default (tenant DB) → THIS global
///   default (main DB) → the page's natural column defaults.
///
/// A row is keyed by (GridId, Field). There is no UserId or CustomerId here —
/// the config is shared by all tenants.
/// </summary>
public class DefaultGridColumnAccess
{
    /// <summary>
    /// Primary key.
    /// </summary>
    public int Id { get; set; }

    /// <summary>
    /// Grid identifier — matches the gridId registered in the frontend
    /// GRID_REGISTRY (e.g. "items-list-grid").
    /// </summary>
    public string GridId { get; set; } = null!;

    /// <summary>
    /// Column field name — matches the `field` on the grid's column definition.
    /// </summary>
    public string Field { get; set; } = null!;

    /// <summary>
    /// True if the column is visible by default; false strips it from the grid
    /// for tenants that inherit this default.
    /// </summary>
    public bool AllowedToView { get; set; } = true;

    /// <summary>
    /// Optional default display-label override. Null = use the column's built-in
    /// header name.
    /// </summary>
    public string? DisplayName { get; set; }

    /// <summary>
    /// Optional default column position. Lower numbers appear first. Null = use
    /// the column's natural position.
    /// </summary>
    public int? SortOrder { get; set; }

    /// <summary>
    /// Optional default pixel width. Null = use the column's natural width.
    /// </summary>
    public int? Width { get; set; }

    /// <summary>
    /// Optional default footer aggregate type ("sum"/"avg"/"count"/"min"/"max").
    /// Null = no aggregation.
    /// </summary>
    public string? AggregateType { get; set; }

    /// <summary>
    /// When this default row was first created.
    /// </summary>
    public DateTime DateCreated { get; set; }

    /// <summary>
    /// When this default row was last modified.
    /// </summary>
    public DateTime DateModified { get; set; }

    /// <summary>
    /// UserId of the Super Admin who last saved this default (nullable).
    /// </summary>
    public Guid? ModifiedBy { get; set; }
}
