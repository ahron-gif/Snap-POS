using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class StoreAppsView
{
    public Guid? RegistrationId { get; set; }

    public string StoreName { get; set; } = null!;

    public string DataBaseName { get; set; } = null!;

    public Guid IdfromAppReg { get; set; }

    public string IdfromDevAppReg { get; set; } = null!;

    public string? ApplicationName { get; set; }
}
