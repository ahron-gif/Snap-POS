using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class ApplicationsMenu
{
    public Guid Id { get; set; }

    public Guid AppId { get; set; }

    public Guid? RegistrationId { get; set; }

    public string? MenuName { get; set; }

    public string? MenuTitle { get; set; }

    public string? MenuIcon { get; set; }

    public int? SequenceNumber { get; set; }

    public string? Description { get; set; }

    public bool? IsAllowed { get; set; }

    public bool? IsDefault { get; set; }

    public bool? IsActive { get; set; }
}
