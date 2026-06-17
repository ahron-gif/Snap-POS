#nullable enable
using System;

namespace BackOffice.Domain.Entities.Tenant;

public partial class CustomDateScope
{
    public Guid CustomDateScopeID { get; set; }

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public DateTime FromDate { get; set; }

    public DateTime ToDate { get; set; }

    public string? SortColumn { get; set; }

    public string? SortDirection { get; set; }

    /// <summary>
    /// Manual list position for the saved scope (1-based). Maintained as a
    /// contiguous sequence among active rows: create assigns max+1, update
    /// shifts neighbours, delete compacts. See CustomDateScopeService.
    /// Added by migration 20260501_Add_CustomDateScope_SortOrder.sql.
    /// </summary>
    public int SortOrder { get; set; }

    public bool IsActive { get; set; }

    public Guid? CreatedBy { get; set; }

    public DateTime CreatedAt { get; set; }

    public Guid? ModifiedBy { get; set; }

    public DateTime? ModifiedAt { get; set; }
}
