#nullable enable
using System;
using System.Collections.Generic;

namespace BackOffice.Domain.Entities.Main;

public partial class Screen
{
    public int Id { get; set; }

    public int ModuleId { get; set; }

    public string Code { get; set; } = null!;

    public string Name { get; set; } = null!;

    public string? Route { get; set; }

    public string? Icon { get; set; }

    public int SortOrder { get; set; }

    public bool IsActive { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual Module Module { get; set; } = null!;

    public virtual ICollection<Permission> Permissions { get; set; } = new List<Permission>();
}
