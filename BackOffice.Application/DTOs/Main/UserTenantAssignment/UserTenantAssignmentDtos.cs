namespace BackOffice.Application.DTOs.Main.UserTenantAssignment;

public class UserTenantAssignmentDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = null!;
    public string? Email { get; set; }
    public DateTime AssignedAt { get; set; }
}

public class AssignTenantsToUserDto
{
    public int UserId { get; set; }
    public List<int> CustomerIds { get; set; } = new();
}

public class TenantLookupDto
{
    public int CustomerId { get; set; }
    public string CustomerName { get; set; } = null!;
    public string? Email { get; set; }
    public bool IsAssigned { get; set; }
}
