namespace BackOffice.Application.DTOs.Main.Billing
{
    /// <summary>
    /// Per-day transaction record returned by /api/Usage/MyTransactions.
    /// Frontend renders one row per record under the Transactions summary cards.
    /// </summary>
    public class TransactionRecordDto
    {
        public DateTime RecordedDate { get; set; }
        public int Count { get; set; }
        public int FreeUnits { get; set; }
        public int BillableUnits { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal LineTotal { get; set; }
        public int? AppId { get; set; }
        public string? AppName { get; set; }
    }

    public class UsageSnapshotDto
    {
        public string MetricType { get; set; } = null!;
        public int? AppId { get; set; }
        public string? AppName { get; set; }
        public int CurrentCount { get; set; }
        public int Limit { get; set; }
        public decimal PercentUsed { get; set; }
    }

    public class ApiUsageSnapshotDto
    {
        public int ApiDefinitionId { get; set; }
        public string ApiName { get; set; } = null!;
        public int TotalCalls { get; set; }
        public int FreeTier { get; set; }
        public int BillableCalls { get; set; }
        public decimal Rate { get; set; }
        public decimal Cost { get; set; }
    }

    public class CustomerUsageDashboardDto
    {
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = null!;
        public string PlanName { get; set; } = null!;
        public List<UsageSnapshotDto> DeviceUsage { get; set; } = new();
        public List<ApiUsageSnapshotDto> ApiUsage { get; set; } = new();
        public int TransactionCount { get; set; }
        public int TransactionFreeTier { get; set; }
        public int TransactionBillable { get; set; }
        public decimal TransactionRate { get; set; }
        public decimal TransactionCost { get; set; }
    }

    public class RecordUsageDto
    {
        public int CustomerId { get; set; }
        public int? AppId { get; set; }
        public string MetricType { get; set; } = null!;
        public int Count { get; set; }
    }

    public class RecordApiCallDto
    {
        public int CustomerId { get; set; }
        public int ApiDefinitionId { get; set; }
        public int CallCount { get; set; }
    }

    // Sent by each per-device app (POS / Back Office / Shipscan / Price Checker)
    // on startup and as a periodic heartbeat. CustomerId is resolved from auth claims.
    public class RegisterDeviceDto
    {
        public int AppId { get; set; }
        public string AdvancedUId { get; set; } = null!;
        public string? DeviceName { get; set; }
    }

    public class RegisterDeviceResultDto
    {
        public bool Allowed { get; set; }
        public string? Reason { get; set; }
        public int SlotsTotal { get; set; }
        public int SlotsUsed { get; set; }
        public int? DeviceId { get; set; }
        public int? LicenseId { get; set; }
        public bool IsNewDevice { get; set; }
    }

    public class DeviceLimitDto
    {
        public int AppId { get; set; }
        public int SlotsTotal { get; set; }
        public int SlotsUsed { get; set; }
        public bool CanRegisterNew { get; set; }
        public int InactiveDays { get; set; }
    }

    // Result of the per-user Web App seat check (called from AuthController.Login).
    public class WebAppSeatCheckDto
    {
        public bool Allowed { get; set; }
        public string? Reason { get; set; }
        public int SlotsTotal { get; set; }
        public int SlotsUsed { get; set; }
        public bool IsAlreadySeated { get; set; }
    }

    public class WebAppUserLimitDto
    {
        public bool Allowed { get; set; }
        public string? Reason { get; set; }
        public int SlotsTotal { get; set; }
        public int UsersUsed { get; set; }
    }
}
