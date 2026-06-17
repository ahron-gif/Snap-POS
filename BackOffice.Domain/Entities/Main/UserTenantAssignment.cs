#nullable enable
using System;

namespace BackOffice.Domain.Entities.Main;
public partial class UserTenantAssignment
{
    public int Id { get; set; } 
    public int UserId { get; set; }
    public int CustomerId { get; set; }
    public int AssignedBy { get; set; }
    public DateTime AssignedAt { get; set; }
  
    public virtual WebAppUser User { get; set; } = null!;
    public virtual Customer Customer { get; set; } = null!;
}
