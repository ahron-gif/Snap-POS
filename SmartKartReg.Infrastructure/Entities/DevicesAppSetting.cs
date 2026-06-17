using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class DevicesAppSetting
{
    public string SettingId { get; set; } = null!;

    public string DeviceId { get; set; } = null!;

    public string? ApplicationName { get; set; }

    public string? RegisterationId { get; set; }

    public string? StoreId { get; set; }

    public DateTime? DateCreated { get; set; }

    public DateTime? DateModified { get; set; }
}
