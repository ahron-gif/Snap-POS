using System;
using System.IO;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services
{
    /// <summary>
    /// Interface for AWS S3 storage operations
    /// </summary>
    public interface IS3StorageService
    {
        /// <summary>
        /// Uploads a file to S3
        /// </summary>
        /// <param name="fileStream">File stream to upload</param>
        /// <param name="fileName">Name of the file (will be placed in the configured base folder)</param>
        /// <param name="contentType">MIME content type of the file</param>
        /// <returns>The S3 URL/path of the uploaded file</returns>
        Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType);

        /// <summary>
        /// Uploads a file from byte array to S3
        /// </summary>
        /// <param name="fileBytes">File bytes to upload</param>
        /// <param name="fileName">Name of the file</param>
        /// <param name="contentType">MIME content type of the file</param>
        /// <returns>The S3 URL/path of the uploaded file</returns>
        Task<string> UploadFileAsync(byte[] fileBytes, string fileName, string contentType);

        /// <summary>
        /// Downloads a file from S3
        /// </summary>
        /// <param name="fileName">Name of the file to download</param>
        /// <returns>File bytes</returns>
        Task<byte[]> DownloadFileAsync(string fileName);

        /// <summary>
        /// Deletes a file from S3
        /// </summary>
        /// <param name="fileName">Name of the file to delete</param>
        /// <returns>True if deleted successfully</returns>
        Task<bool> DeleteFileAsync(string fileName);

        /// <summary>
        /// Gets the public URL for a file (for public buckets only)
        /// </summary>
        /// <param name="fileName">Name of the file</param>
        /// <returns>Public URL of the file</returns>
        string GetFileUrl(string fileName);

        /// <summary>
        /// Gets a pre-signed URL for a file (for private buckets)
        /// </summary>
        /// <param name="fileName">Name of the file</param>
        /// <param name="expirationMinutes">Number of minutes until the URL expires (default: 60)</param>
        /// <returns>Pre-signed URL that provides temporary access to the file</returns>
        string GetPreSignedUrl(string fileName, int expirationMinutes = 60);

        /// <summary>
        /// Checks if a file exists in S3
        /// </summary>
        /// <param name="fileName">Name of the file</param>
        /// <returns>True if file exists</returns>
        Task<bool> FileExistsAsync(string fileName);
    }
}
