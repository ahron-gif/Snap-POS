using System;
using System.Globalization;
using System.Text.Json;

namespace BackOffice.Persistence.Services.Chat.Tools
{
    internal static class ChatDateRange
    {
        internal readonly struct Resolved
        {
            public DateTime FromDate { get; init; }
            public DateTime ToDate { get; init; }
            public DateTime EndExclusive { get; init; }
            public string Label { get; init; }
            public int TotalDays { get; init; }
        }

        internal static bool TryResolve(
            JsonElement args,
            int defaultDays,
            int minDays,
            int maxDays,
            out Resolved range,
            out string? error)
        {
            string? fromStr = null;
            string? toStr = null;
            int days = defaultDays;

            if (args.ValueKind == JsonValueKind.Object)
            {
                if (args.TryGetProperty("fromDate", out var fd)) fromStr = fd.GetString();
                if (args.TryGetProperty("toDate", out var td)) toStr = td.GetString();
                if (args.TryGetProperty("days", out var dEl) && dEl.ValueKind == JsonValueKind.Number)
                    days = dEl.GetInt32();
            }

            DateTime fromDate;
            DateTime toDate;
            string label;

            if (!string.IsNullOrWhiteSpace(fromStr))
            {
                if (!TryParseDate(fromStr, out fromDate))
                {
                    range = default;
                    error = "'fromDate' must be YYYY-MM-DD.";
                    return false;
                }

                if (string.IsNullOrWhiteSpace(toStr) || toStr.Equals("today", StringComparison.OrdinalIgnoreCase))
                {
                    toDate = DateTime.UtcNow.Date;
                }
                else if (!TryParseDate(toStr, out toDate))
                {
                    range = default;
                    error = "'toDate' must be YYYY-MM-DD or 'today'.";
                    return false;
                }

                if (toDate < fromDate)
                {
                    range = default;
                    error = "'toDate' must be >= 'fromDate'.";
                    return false;
                }

                label = $"{fromDate:yyyy-MM-dd} to {toDate:yyyy-MM-dd}";
            }
            else
            {
                if (days < minDays) days = minDays;
                if (days > maxDays) days = maxDays;
                fromDate = DateTime.UtcNow.AddDays(-days).Date;
                toDate = DateTime.UtcNow.Date;
                label = $"last {days} days";
            }

            range = new Resolved
            {
                FromDate = fromDate,
                ToDate = toDate,
                EndExclusive = toDate.AddDays(1),
                Label = label,
                TotalDays = (int)(toDate - fromDate).TotalDays + 1
            };
            error = null;
            return true;
        }

        internal static bool TryParseDate(string? s, out DateTime date)
        {
            date = default;
            if (string.IsNullOrWhiteSpace(s)) return false;
            var formats = new[] { "yyyy-MM-dd", "yyyy/MM/dd", "MM/dd/yyyy", "M/d/yyyy", "d/M/yyyy", "yyyy-MM" };
            if (DateTime.TryParseExact(s.Trim(), formats, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out date))
            {
                date = date.Date;
                return true;
            }
            if (DateTime.TryParse(s, CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out date))
            {
                date = date.Date;
                return true;
            }
            return false;
        }

        internal const string DateRangeSchemaFragment = @"
            ""days"": { ""type"": ""integer"", ""description"": ""Look-back window back from today. Ignored if fromDate is supplied."" },
            ""fromDate"": { ""type"": ""string"", ""description"": ""Optional start date YYYY-MM-DD. When provided, overrides 'days'."" },
            ""toDate"":   { ""type"": ""string"", ""description"": ""Optional end date YYYY-MM-DD. Pass 'today' or omit for current date."" }";
    }
}
