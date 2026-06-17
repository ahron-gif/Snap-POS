using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class SkVersion
{
    public int VersionId { get; set; }

    public string? VersionName { get; set; }

    public string? VersionLink { get; set; }

    public DateTime? DateCreated { get; set; }

    public string? Foldername { get; set; }
}
