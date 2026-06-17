namespace BackOffice.Application.DTOs.Tenant.GroupImport
{
    /// <summary>
    /// Preview of a single legacy desktop <c>Groups</c> row (a user security group) and what it
    /// would convert into as an RBAC tenant role. Returned by the "list legacy groups" endpoint.
    /// </summary>
    public class LegacyGroupPreviewDto
    {
        public Guid GroupId { get; set; }
        public string GroupName { get; set; } = string.Empty;

        /// <summary>Derived role Code (uppercase, alphanumeric) — the idempotency/match key.</summary>
        public string Code { get; set; } = string.Empty;

        public bool IsSystem { get; set; }
        public short? Status { get; set; }
        public bool IsActive { get; set; }

        /// <summary>True if the group cannot be imported (e.g. blank name).</summary>
        public bool Failed { get; set; }

        /// <summary>True if a tenant role with the same Code already exists.</summary>
        public bool AlreadyImported { get; set; }

        public List<string> Warnings { get; set; } = new();
    }

    /// <summary>Request to import a set of legacy groups into the tenant's RBAC roles.</summary>
    public class LegacyGroupImportRequestDto
    {
        /// <summary>Group IDs to import. Null/empty imports all convertible groups.</summary>
        public List<Guid>? GroupIds { get; set; }

        /// <summary>
        /// When true, a group whose Code matches an existing role updates that role's name/active
        /// flag; when false (default) it is skipped (no duplicate created).
        /// </summary>
        public bool OverwriteExisting { get; set; }
    }

    /// <summary>Per-group outcome of an import run.</summary>
    public class LegacyGroupImportItemDto
    {
        public Guid GroupId { get; set; }
        public string GroupName { get; set; } = string.Empty;

        /// <summary>"imported", "updated", "skipped-exists", or "failed".</summary>
        public string Outcome { get; set; } = string.Empty;
        public int? RoleId { get; set; }
        public List<string> Warnings { get; set; } = new();
    }

    /// <summary>Aggregate result of an import run.</summary>
    public class LegacyGroupImportResultDto
    {
        public int Total { get; set; }
        public int Imported { get; set; }
        public int Updated { get; set; }
        public int Skipped { get; set; }
        public int Failed { get; set; }
        public List<LegacyGroupImportItemDto> Items { get; set; } = new();
    }
}
