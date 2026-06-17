using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace BackOffice.Application.DTOs.Tenant.GridSettings
{
    /// <summary>
    /// DTO for individual column settings
    /// </summary>
    public class ColumnSettingDto
    {
        /// <summary>
        /// Column field name
        /// </summary>
        [JsonPropertyName("field")]
        public string Field { get; set; } = null!;

        /// <summary>
        /// Whether the column is visible
        /// </summary>
        [JsonPropertyName("visible")]
        public bool Visible { get; set; } = true;

        /// <summary>
        /// Column width in pixels
        /// </summary>
        [JsonPropertyName("width")]
        public int Width { get; set; } = 95;

        /// <summary>
        /// Aggregate type for the column footer (sum, min, max, count, average, none)
        /// </summary>
        [JsonPropertyName("aggregateType")]
        public string? AggregateType { get; set; }
    }

    /// <summary>
    /// DTO for saving grid settings
    /// </summary>
    public class SaveGridSettingsDto
    {
        /// <summary>
        /// Unique identifier for the grid
        /// </summary>
        [JsonPropertyName("gridId")]
        public string GridId { get; set; } = null!;

        /// <summary>
        /// Column settings to save
        /// </summary>
        [JsonPropertyName("columns")]
        public List<ColumnSettingDto> Columns { get; set; } = new();
    }

    /// <summary>
    /// DTO for returning grid settings
    /// </summary>
    public class GridSettingsResponseDto
    {
        /// <summary>
        /// Unique identifier for the grid
        /// </summary>
        [JsonPropertyName("gridId")]
        public string GridId { get; set; } = null!;

        /// <summary>
        /// Column settings
        /// </summary>
        [JsonPropertyName("columns")]
        public List<ColumnSettingDto> Columns { get; set; } = new();

        /// <summary>
        /// When the settings were last modified
        /// </summary>
        [JsonPropertyName("lastModified")]
        public DateTime LastModified { get; set; }
    }
}
