using Amazon;
using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using BackOffice.Application.Configuration;
using BackOffice.Application.Interfaces.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services
{
    /// <summary>
    /// AWS S3 storage service implementation with customer-specific bucket support
    /// Bucket naming follows pattern: bo-{customerId}-{customerName}
    /// </summary>
    public class S3StorageService : IS3StorageService
    {
        private readonly AwsS3Settings _settings;
        private readonly ILogger<S3StorageService> _logger;
        private readonly IAmazonS3 _s3Client;
        private readonly ITenantInfo _tenantInfo;

        public S3StorageService(
            IOptions<AwsS3Settings> settings,
            ILogger<S3StorageService> logger,
            ITenantInfo tenantInfo)
        {
            _settings = settings.Value;
            _logger = logger;
            _tenantInfo = tenantInfo;

            var config = new AmazonS3Config
            {
                RegionEndpoint = RegionEndpoint.GetBySystemName(_settings.Region)
            };

            _s3Client = new AmazonS3Client(_settings.AccessKey, _settings.SecretKey, config);
        }

        /// <summary>
        /// Gets the bucket name for the current customer
        /// Format: bo-{customerId}-{customerName} (lowercase, no special chars)
        /// Falls back to configured bucket name if no customer context
        /// </summary>
        private string GetBucketName()
        {
            var customerId = _tenantInfo.GetCustomerId();
            var customerName = _tenantInfo.GetCustomerName();

            if (customerId.HasValue && !string.IsNullOrEmpty(customerName))
            {
                // Format bucket name like the VB.NET code: BO-{CustomerId}-{CustomerName}
                var sanitizedName = SanitizeBucketName(customerName);
                return $"bo-{customerId}-{sanitizedName}".ToLower();
            }

            // Fall back to configured bucket name
            return _settings.BucketName;
        }

        /// <summary>
        /// Sanitizes a string to be valid for S3 bucket names
        /// </summary>
        private static string SanitizeBucketName(string name)
        {
            if (string.IsNullOrEmpty(name))
                return string.Empty;

            // Replace underscores and spaces with hyphens
            var sanitized = name.Replace("_", "-").Replace(" ", "-");

            // Remove any other special characters (keep only alphanumeric and hyphens)
            sanitized = Regex.Replace(sanitized, @"[^a-zA-Z0-9\-]", "");

            // Remove consecutive hyphens
            sanitized = Regex.Replace(sanitized, @"-+", "-");

            // Trim leading/trailing hyphens
            sanitized = sanitized.Trim('-');

            return sanitized;
        }

        /// <summary>
        /// Creates the bucket if it doesn't exist
        /// </summary>
        private async Task CreateBucketIfNotExistsAsync()
        {
            var bucketName = GetBucketName();

            try
            {
                var response = await _s3Client.ListBucketsAsync();
                var exists = response.Buckets.Any(b => b.BucketName == bucketName);

                if (!exists)
                {
                    var request = new PutBucketRequest { BucketName = bucketName };
                    await _s3Client.PutBucketAsync(request);
                    _logger.LogInformation("Created new S3 bucket: {BucketName}", bucketName);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not create/verify bucket {BucketName}. It may already exist or permissions may be restricted.", bucketName);
            }
        }

        public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType)
        {
            try
            {
                await CreateBucketIfNotExistsAsync();

                var bucketName = GetBucketName();
                var key = GetS3Key(fileName);

                var uploadRequest = new TransferUtilityUploadRequest
                {
                    InputStream = fileStream,
                    Key = key,
                    BucketName = bucketName,
                    ContentType = contentType,
                    CannedACL = S3CannedACL.Private
                };

                var transferUtility = new TransferUtility(_s3Client);
                await transferUtility.UploadAsync(uploadRequest);

                _logger.LogInformation("File uploaded successfully to S3: {Bucket}/{Key}", bucketName, key);

                return key;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading file to S3: {FileName}", fileName);
                throw;
            }
        }

        public async Task<string> UploadFileAsync(byte[] fileBytes, string fileName, string contentType)
        {
            using var stream = new MemoryStream(fileBytes);
            return await UploadFileAsync(stream, fileName, contentType);
        }

        public async Task<byte[]> DownloadFileAsync(string fileName)
        {
            try
            {
                var bucketName = GetBucketName();
                var key = GetS3Key(fileName);

                var request = new GetObjectRequest
                {
                    BucketName = bucketName,
                    Key = key
                };

                using var response = await _s3Client.GetObjectAsync(request);
                using var memoryStream = new MemoryStream();
                await response.ResponseStream.CopyToAsync(memoryStream);

                _logger.LogInformation("File downloaded successfully from S3: {Bucket}/{Key}", bucketName, key);

                return memoryStream.ToArray();
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
            {
                _logger.LogWarning("File not found in S3: {FileName}", fileName);
                return Array.Empty<byte>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error downloading file from S3: {FileName}", fileName);
                throw;
            }
        }

        public async Task<bool> DeleteFileAsync(string fileName)
        {
            try
            {
                var bucketName = GetBucketName();
                var key = GetS3Key(fileName);

                var request = new DeleteObjectRequest
                {
                    BucketName = bucketName,
                    Key = key
                };

                await _s3Client.DeleteObjectAsync(request);

                _logger.LogInformation("File deleted successfully from S3: {Bucket}/{Key}", bucketName, key);

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting file from S3: {FileName}", fileName);
                return false;
            }
        }

        public string GetFileUrl(string fileName)
        {
            var bucketName = GetBucketName();
            var key = GetS3Key(fileName);
            return $"https://{bucketName}.s3.{_settings.Region}.amazonaws.com/{key}";
        }

        public string GetPreSignedUrl(string fileName, int expirationMinutes = 60)
        {
            try
            {
                var bucketName = GetBucketName();
                var key = GetS3Key(fileName);

                var request = new GetPreSignedUrlRequest
                {
                    BucketName = bucketName,
                    Key = key,
                    Expires = DateTime.UtcNow.AddMinutes(expirationMinutes),
                    Verb = HttpVerb.GET
                };

                var url = _s3Client.GetPreSignedURL(request);
                _logger.LogDebug("Generated pre-signed URL for {Bucket}/{Key}, expires in {Minutes} minutes", bucketName, key, expirationMinutes);

                return url;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating pre-signed URL for: {FileName}", fileName);
                // Fall back to regular URL (may not work for private buckets)
                return GetFileUrl(fileName);
            }
        }

        public async Task<bool> FileExistsAsync(string fileName)
        {
            try
            {
                var bucketName = GetBucketName();
                var key = GetS3Key(fileName);

                var request = new GetObjectMetadataRequest
                {
                    BucketName = bucketName,
                    Key = key
                };

                await _s3Client.GetObjectMetadataAsync(request);
                return true;
            }
            catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
            {
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking file existence in S3: {FileName}", fileName);
                throw;
            }
        }

        private string GetS3Key(string fileName)
        {
            if (string.IsNullOrEmpty(_settings.BaseFolder))
            {
                return fileName;
            }

            // Check if the filename already contains the base folder prefix to avoid duplication
            if (fileName.StartsWith($"{_settings.BaseFolder}/", StringComparison.OrdinalIgnoreCase))
            {
                return fileName;
            }

            return $"{_settings.BaseFolder}/{fileName}";
        }
    }
}
