using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class License
{
    public Guid LicenseId { get; set; }

    public Guid? RegistrationId { get; set; }

    public Guid? ComputerId { get; set; }

    public string? Type { get; set; }

    public DateTime? LastTimeLogin { get; set; }

    public int LicNo { get; set; }

    public string? MacId { get; set; }

    public string? ComputerName { get; set; }

    public string? Description { get; set; }
}
