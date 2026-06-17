using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class VwCustomerStatus
{
    public int Id { get; set; }

    public string Description { get; set; } = null!;
}
