using BackOffice.Domain.Enums;

namespace BackOffice.Application.DTOs.Main.PermissionManagement
{
    public class PlanDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string Code { get; set; } = null!;
        public int MaxUsers { get; set; }
        public BillingCycle BillingCycle { get; set; }
        public decimal Price { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public List<int> ModuleIds { get; set; } = new();
    }

    public class CreatePlanDto
    {
        public string Name { get; set; } = null!;
        public string Code { get; set; } = null!;
        public int MaxUsers { get; set; }
        public BillingCycle BillingCycle { get; set; }
        public decimal Price { get; set; }
        public List<int> ModuleIds { get; set; } = new();
    }

    public class UpdatePlanDto : CreatePlanDto
    {
        public int Id { get; set; }
        public bool IsActive { get; set; }
    }
}
