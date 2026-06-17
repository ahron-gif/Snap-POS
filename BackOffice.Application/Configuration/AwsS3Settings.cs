namespace BackOffice.Application.Configuration
{
    /// <summary>
    /// Configuration settings for AWS S3
    /// </summary>
    public class AwsS3Settings
    {
        public const string SectionName = "AwsS3Settings";

        public string AccessKey { get; set; } = string.Empty;
        public string SecretKey { get; set; } = string.Empty;
        public string BucketName { get; set; } = string.Empty;
        public string Region { get; set; } = "us-east-1";
        public string BaseFolder { get; set; } = "Images";
    }
}
