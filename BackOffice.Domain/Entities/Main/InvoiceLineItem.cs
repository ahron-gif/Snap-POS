#nullable enable

namespace BackOffice.Domain.Entities.Main;

public partial class InvoiceLineItem
{
    public int Id { get; set; }

    public int InvoiceId { get; set; }

    public string Description { get; set; } = null!;

    public int? AppId { get; set; }

    public int? ApiDefinitionId { get; set; }

    /// <summary>
    /// "device_license" | "api_calls" | "transaction" | "smartkart_pay" | "plan_base"
    /// </summary>
    public string Category { get; set; } = null!;

    public string? PricingModel { get; set; }

    public int Quantity { get; set; }

    public int FreeUnits { get; set; }

    // Decimal because device-days proration produces fractional device-equivalents.
    public decimal BillableUnits { get; set; }

    public decimal UnitPrice { get; set; }

    public decimal LineTotal { get; set; }

    public virtual Invoice Invoice { get; set; } = null!;
}
