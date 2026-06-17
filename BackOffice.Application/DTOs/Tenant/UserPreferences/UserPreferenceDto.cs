using System;
using System.Text.Json.Serialization;

namespace BackOffice.Application.DTOs.Tenant.UserPreferences
{
    /// <summary>
    /// DTO for saving a user preference
    /// </summary>
    public class SaveUserPreferenceDto
    {
        /// <summary>
        /// Unique preference key (e.g., "lastSession", "workspaceState")
        /// </summary>
        [JsonPropertyName("preferenceKey")]
        public string PreferenceKey { get; set; } = null!;

        /// <summary>
        /// JSON string containing the preference value
        /// </summary>
        [JsonPropertyName("preferenceValue")]
        public string PreferenceValue { get; set; } = null!;
    }

    /// <summary>
    /// DTO for returning a user preference
    /// </summary>
    public class UserPreferenceResponseDto
    {
        /// <summary>
        /// Preference key
        /// </summary>
        [JsonPropertyName("preferenceKey")]
        public string PreferenceKey { get; set; } = null!;

        /// <summary>
        /// JSON string containing the preference value
        /// </summary>
        [JsonPropertyName("preferenceValue")]
        public string PreferenceValue { get; set; } = null!;

        /// <summary>
        /// When the preference was last modified
        /// </summary>
        [JsonPropertyName("lastModified")]
        public DateTime LastModified { get; set; }
    }
}
