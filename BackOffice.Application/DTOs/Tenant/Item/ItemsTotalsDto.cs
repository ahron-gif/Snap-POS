using System.Text.Json.Serialization;

namespace BackOffice.Application.DTOs.Tenant.Item
{
    /// <summary>
    /// Aggregate totals across every row matching the current Item List filter
    /// — NOT just the loaded subset that infinite scroll has pulled in so far.
    /// Powers the summary cards on the top of the Item List page so the user
    /// always sees catalog-level numbers instead of "totals so far loaded".
    ///
    /// Computed server-side via SUM/AVG/COUNT against the same filtered query
    /// that GetAllItemsMainAndStoreGridAsync uses for the grid rows. Returned
    /// from GET /api/Items/Totals with the same query params as GetAllItems.
    /// </summary>
    public class ItemsTotalsDto
    {
        /// <summary>Total number of rows matching the filter.</summary>
        [JsonPropertyName("totalCount")]
        public int TotalCount { get; set; }

        /// <summary>Sum of Price across all matching rows.</summary>
        [JsonPropertyName("priceSum")]
        public decimal PriceSum { get; set; }

        /// <summary>Sum of Cost across all matching rows (NULL costs treated as 0).</summary>
        [JsonPropertyName("costSum")]
        public decimal CostSum { get; set; }

        /// <summary>Average of Pc_Cost across all matching rows (NULL costs treated as 0).</summary>
        [JsonPropertyName("avgPcCost")]
        public decimal AvgPcCost { get; set; }

        /// <summary>
        /// On-hand value: SUM(Pc_Cost * OnHand) across all matching rows.
        /// Reflects total inventory value at piece cost.
        /// </summary>
        [JsonPropertyName("onHandValue")]
        public decimal OnHandValue { get; set; }
    }
}
