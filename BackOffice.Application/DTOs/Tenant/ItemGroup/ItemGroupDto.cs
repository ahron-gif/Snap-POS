namespace BackOffice.Application.DTOs.Tenant.ItemGroup
{
    /// <summary>
    /// DTO for ItemGroup grid display (tree view)
    /// </summary>
    public class ItemGroupGridDto
    {
        public Guid ItemGroupID { get; set; }
        public string Name { get; set; } = string.Empty;
        public Guid? ParentID { get; set; }
        public string? ParentName { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
    }

    /// <summary>
    /// DTO for creating a new ItemGroup
    /// </summary>
    public class CreateItemGroupDto
    {
        public string Name { get; set; } = string.Empty;
        public Guid? ParentID { get; set; }
    }

    /// <summary>
    /// DTO for updating an ItemGroup
    /// </summary>
    public class UpdateItemGroupDto
    {
        public Guid ItemGroupID { get; set; }
        public string Name { get; set; } = string.Empty;
        public Guid? ParentID { get; set; }
    }

    /// <summary>
    /// DTO for full ItemGroup details (view/edit form)
    /// </summary>
    public class ItemGroupDetailDto
    {
        public Guid ItemGroupID { get; set; }
        public string Name { get; set; } = string.Empty;
        public Guid? ParentID { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public Guid? UserCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public Guid? UserModified { get; set; }
    }
}
