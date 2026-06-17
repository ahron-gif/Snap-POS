using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace BackOffice.Application.DTOs
{
    public class PaginationGridDto
    {
        public int StartRow { get; set; }
        public int EndRow { get; set; }
        public string? SortColumn { get; set; }
        public string? SortDirection { get; set; }
        public string? Filters { get; set; }

        public string? CustomGridSearchText { get; set; }
        public string? CustomGridSearchColumns { get; set; }
        public Dictionary<string, PaginationGridFilterDto>? FilterModel { get; set; } = new();
        public List<PaginationGridSortingDto>? SortModel { get; set; } = new();

        /// <summary>
        /// Optional store ID filter - filters items by specific store
        /// </summary>
        [JsonProperty("storeId")]
        public Guid? StoreId { get; set; }

        [JsonProperty("customerId")]
        public int? CustomerId { get; set; }

        // Quick filter flags for Items grid
        [JsonProperty("saleItems")]
        public bool? SaleItems { get; set; }

        [JsonProperty("showInactive")]
        public bool? ShowInactive { get; set; }

        [JsonProperty("lowStock")]
        public bool? LowStock { get; set; }

        [JsonProperty("missingBarcode")]
        public bool? MissingBarcode { get; set; }

        [JsonProperty("zeroCost")]
        public bool? ZeroCost { get; set; }
    }

    public class PaginationGridFilterDto
    {
        public string Col { get; set; }
        public string Type { get; set; }  // e.g., "contains", "equals"
        public string Value { get; set; }
        public string OperatorType { get; set; }
    }

    public class PaginationGridSortingDto
    {
        public string ColId { get; set; }
        public string Sort { get; set; }  // "asc" or "desc"
    }
}
