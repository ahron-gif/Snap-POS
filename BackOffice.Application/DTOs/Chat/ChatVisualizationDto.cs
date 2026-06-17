using System.Collections.Generic;

namespace BackOffice.Application.DTOs.Chat
{
    public class ChatVisualizationDto
    {
        public string Type { get; set; } = "bar";
        public string? Title { get; set; }
        public string? XAxisLabel { get; set; }
        public string? YAxisLabel { get; set; }
        public List<string> Categories { get; set; } = new();
        public List<ChatChartSeriesDto> Series { get; set; } = new();
        public bool Horizontal { get; set; }
    }

    public class ChatChartSeriesDto
    {
        public string Name { get; set; } = string.Empty;
        public List<decimal> Data { get; set; } = new();
    }
}
