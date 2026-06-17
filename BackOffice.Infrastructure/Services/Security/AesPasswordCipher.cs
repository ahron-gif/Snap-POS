using System.Security.Cryptography;
using System.Text;
using BackOffice.Application.Interfaces.Services.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BackOffice.Infrastructure.Services.Security
{
    /// <summary>
    /// AES-256-GCM implementation of <see cref="IPasswordCipher"/>.
    ///
    /// Output format (base64 of):
    ///     [ 12-byte nonce ][ ciphertext ][ 16-byte GCM tag ]
    ///
    /// The encryption key is a base64-encoded 32-byte (256-bit) value read at
    /// startup from configuration <c>Security:PasswordEncryption:Key</c>. The
    /// service fails fast if the key is missing or the wrong length so a
    /// misconfigured deploy can't silently fall back to weak crypto.
    /// </summary>
    public sealed class AesPasswordCipher : IPasswordCipher
    {
        private const int NonceSize = 12;          // AES-GCM standard nonce size
        private const int TagSize = 16;            // 128-bit auth tag
        private const int KeySize = 32;            // 256-bit key

        private readonly byte[] _key;

        public AesPasswordCipher(IConfiguration configuration, ILogger<AesPasswordCipher> logger)
        {
            var rawKey = configuration["Security:PasswordEncryption:Key"];
            if (string.IsNullOrWhiteSpace(rawKey))
            {
                throw new InvalidOperationException(
                    "Security:PasswordEncryption:Key is not configured. " +
                    "Provide a base64-encoded 32-byte AES key via appsettings, user-secrets, or environment variable " +
                    "(Security__PasswordEncryption__Key).");
            }

            byte[] key;
            try
            {
                key = Convert.FromBase64String(rawKey);
            }
            catch (FormatException ex)
            {
                throw new InvalidOperationException(
                    "Security:PasswordEncryption:Key is not valid base64. " +
                    "Generate a key with: openssl rand -base64 32  (or PowerShell: [Convert]::ToBase64String((1..32 | %{ Get-Random -Maximum 256 })))", ex);
            }

            if (key.Length != KeySize)
            {
                throw new InvalidOperationException(
                    $"Security:PasswordEncryption:Key must decode to {KeySize} bytes (got {key.Length}). " +
                    "Use a 256-bit AES key.");
            }

            _key = key;
            logger.LogInformation("AesPasswordCipher initialized with a {Bytes}-byte key.", _key.Length);
        }

        public string Encrypt(string plaintext)
        {
            if (plaintext is null) throw new ArgumentNullException(nameof(plaintext));

            var plaintextBytes = Encoding.UTF8.GetBytes(plaintext);
            var nonce = RandomNumberGenerator.GetBytes(NonceSize);
            var ciphertext = new byte[plaintextBytes.Length];
            var tag = new byte[TagSize];

            using (var aes = new AesGcm(_key, TagSize))
            {
                aes.Encrypt(nonce, plaintextBytes, ciphertext, tag);
            }

            // Pack: nonce || ciphertext || tag
            var output = new byte[NonceSize + ciphertext.Length + TagSize];
            Buffer.BlockCopy(nonce, 0, output, 0, NonceSize);
            Buffer.BlockCopy(ciphertext, 0, output, NonceSize, ciphertext.Length);
            Buffer.BlockCopy(tag, 0, output, NonceSize + ciphertext.Length, TagSize);

            return Convert.ToBase64String(output);
        }

        public string Decrypt(string ciphertext)
        {
            if (ciphertext is null) throw new ArgumentNullException(nameof(ciphertext));
            if (ciphertext.Length == 0) throw new ArgumentException("Ciphertext is empty.", nameof(ciphertext));

            byte[] blob;
            try
            {
                blob = Convert.FromBase64String(ciphertext);
            }
            catch (FormatException ex)
            {
                throw new CryptographicException("Ciphertext is not valid base64.", ex);
            }

            if (blob.Length < NonceSize + TagSize)
            {
                throw new CryptographicException("Ciphertext is too short to contain nonce and tag.");
            }

            var cipherLen = blob.Length - NonceSize - TagSize;
            var nonce = new byte[NonceSize];
            var encrypted = new byte[cipherLen];
            var tag = new byte[TagSize];
            Buffer.BlockCopy(blob, 0, nonce, 0, NonceSize);
            Buffer.BlockCopy(blob, NonceSize, encrypted, 0, cipherLen);
            Buffer.BlockCopy(blob, NonceSize + cipherLen, tag, 0, TagSize);

            var plaintext = new byte[cipherLen];
            using (var aes = new AesGcm(_key, TagSize))
            {
                aes.Decrypt(nonce, encrypted, tag, plaintext);
            }

            return Encoding.UTF8.GetString(plaintext);
        }
    }
}
