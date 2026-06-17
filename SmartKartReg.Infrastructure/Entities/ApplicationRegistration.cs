using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class ApplicationRegistration
{
    public Guid Id { get; set; }

    public Guid AppId { get; set; }

    public Guid? RegistrationId { get; set; }

    public string? Apiurl { get; set; }
}
