using System;
using Newtonsoft.Json;

namespace BackOffice.Application.Converters
{
    /// <summary>
    /// Ensures null or empty string in JSON binds to null for Guid? (so "All Stores" / null storeId works).
    /// </summary>
    public class NullableGuidJsonConverter : JsonConverter<Guid?>
    {
        public override void WriteJson(JsonWriter writer, Guid? value, JsonSerializer serializer)
        {
            if (value.HasValue && value.Value != Guid.Empty)
                writer.WriteValue(value.Value);
            else
                writer.WriteNull();
        }

        public override Guid? ReadJson(JsonReader reader, Type objectType, Guid? existingValue, bool hasExistingValue, JsonSerializer serializer)
        {
            if (reader.TokenType == JsonToken.Null || reader.TokenType == JsonToken.Undefined)
                return null;

            if (reader.TokenType == JsonToken.String)
            {
                var s = reader.Value?.ToString();
                if (string.IsNullOrWhiteSpace(s))
                    return null;
                if (Guid.TryParse(s, out var g) && g != Guid.Empty)
                    return g;
                return null;
            }

            if (reader.TokenType == JsonToken.PropertyName)
                return null;

            try
            {
                var token = reader.Value;
                if (token == null)
                    return null;
                if (token is Guid guid && guid != Guid.Empty)
                    return guid;
                if (Guid.TryParse(token.ToString(), out var parsed) && parsed != Guid.Empty)
                    return parsed;
            }
            catch
            {
                // ignore
            }

            return null;
        }
    }
}
