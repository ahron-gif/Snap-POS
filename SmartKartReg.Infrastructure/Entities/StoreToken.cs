using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class StoreToken
{
    public int Id { get; set; }

    public Guid Token { get; set; }

    public Guid RegistrationId { get; set; }

    public string StoreApp { get; set; } = null!;

    public DateTime? DateCreated { get; set; }

    public bool Active { get; set; }

    public DateTime? DateModified { get; set; }

    public string? CreatedBy { get; set; }

    public string? ModifiedBy { get; set; }

    public virtual ICollection<TokenPermission> TokenPermissions { get; set; } = new List<TokenPermission>();

    public virtual ICollection<TokenStoreAccess> TokenStoreAccesses { get; set; } = new List<TokenStoreAccess>();
}
