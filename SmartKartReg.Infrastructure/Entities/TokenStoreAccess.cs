using System;
using System.Collections.Generic;

namespace SmartKartReg.Infrastructure.Entities;

public partial class TokenStoreAccess
{
    public int Id { get; set; }

    public int TokenId { get; set; }

    public Guid StoreId { get; set; }

    public DateTime? DateCreated { get; set; }

    public DateTime? DateModified { get; set; }

    public string? CreatedBy { get; set; }

    public string? ModifiedBy { get; set; }

    public virtual StoreToken Token { get; set; } = null!;
}
