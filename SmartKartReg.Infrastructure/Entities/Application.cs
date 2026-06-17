using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class Application
{
    public Guid AppId { get; set; }

    public string AppName { get; set; } = null!;
}
