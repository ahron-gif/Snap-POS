using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class StoreTokensView
{
    public int Id { get; set; }

    public string StoreName { get; set; } = null!;

    public string StoreApp { get; set; } = null!;

    public Guid Token { get; set; }

    public Guid RegistrationId { get; set; }

    public DateTime? DateCreated { get; set; }

    public string DataBaseName { get; set; } = null!;

    public bool Active { get; set; }
}
