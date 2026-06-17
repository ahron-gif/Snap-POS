#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;

public partial class CustomerGlobalRole
{
    public int CustomerGlobalRoleId { get; set; }

    public int CustomerId { get; set; }

    public int GlobalRoleId { get; set; }

    public DateTime DateAssigned { get; set; }

    public int? AssignedBy { get; set; }

    public virtual Customer Customer { get; set; } = null!;

    public virtual GlobalRole GlobalRole { get; set; } = null!;
}
