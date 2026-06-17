using System.Security.Cryptography;
using System.Text;
using BackOffice.Application.Interfaces.Services.Security;

namespace BackOffice.Infrastructure.Services.Security
{
    /// <summary>
    /// Implementation of <see cref="ILegacyEncCipher"/> that mirrors the legacy
    /// VB.NET <c>Crypto</c> class in <c>Cloud_BackOffice/Dlls/DataBase/DataBaseHandler/Encrypt.vb</c>
    /// byte-for-byte. The constants here MUST stay identical to the legacy
    /// values — any change breaks round-trip with the desktop BackOffice and
    /// makes existing EncData rows undecryptable from either side.
    ///
    /// Algorithm:
    ///   - AES-256 (was RijndaelManaged with default 128-bit block = AES)
    ///   - CBC mode, PKCS7 padding
    ///   - Key derived via <see cref="PasswordDeriveBytes"/> (.NET's legacy
    ///     PBKDF1-with-extension; do NOT swap for Rfc2898DeriveBytes — outputs
    ///     differ)
    ///   - passPhrase / salt / hash / iterations / IV are hardcoded
    ///   - Plaintext is UTF-8, ciphertext is Base64
    /// </summary>
    public sealed class LegacyEncCipher : ILegacyEncCipher
    {
        // ─── Hardcoded constants — MUST match Encrypt.vb ──────────────────────
        private const string PassPhrase = "QPa5pr@7h";
        private const string SaltValue = "u@39tMr&t";
        private const string HashAlgorithm = "SHA1";
        private const int PasswordIterations = 2;
        private const string InitVector = "@3J2c3D4e5F6g6Y9"; // 16 ASCII bytes
        private const int KeySize = 256;                       // bits

        public string Encrypt(string plainText)
        {
            if (plainText is null) throw new ArgumentNullException(nameof(plainText));

            var initVectorBytes = Encoding.ASCII.GetBytes(InitVector);
            var saltValueBytes = Encoding.ASCII.GetBytes(SaltValue);
            var plainTextBytes = Encoding.UTF8.GetBytes(plainText);

            var keyBytes = DeriveKey(saltValueBytes);

            using var aes = Aes.Create();
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;
            aes.KeySize = KeySize;
            aes.BlockSize = 128; // RijndaelManaged default = AES block size

            using var encryptor = aes.CreateEncryptor(keyBytes, initVectorBytes);
            using var memoryStream = new MemoryStream();
            using (var cryptoStream = new CryptoStream(memoryStream, encryptor, CryptoStreamMode.Write))
            {
                cryptoStream.Write(plainTextBytes, 0, plainTextBytes.Length);
                cryptoStream.FlushFinalBlock();
            }
            return Convert.ToBase64String(memoryStream.ToArray());
        }

        public string Decrypt(string cipherText)
        {
            if (cipherText is null) throw new ArgumentNullException(nameof(cipherText));
            if (cipherText.Length == 0) throw new ArgumentException("Ciphertext is empty.", nameof(cipherText));

            var initVectorBytes = Encoding.ASCII.GetBytes(InitVector);
            var saltValueBytes = Encoding.ASCII.GetBytes(SaltValue);
            var cipherTextBytes = Convert.FromBase64String(cipherText);

            var keyBytes = DeriveKey(saltValueBytes);

            using var aes = Aes.Create();
            aes.Mode = CipherMode.CBC;
            aes.Padding = PaddingMode.PKCS7;
            aes.KeySize = KeySize;
            aes.BlockSize = 128;

            using var decryptor = aes.CreateDecryptor(keyBytes, initVectorBytes);
            using var memoryStream = new MemoryStream(cipherTextBytes);
            using var cryptoStream = new CryptoStream(memoryStream, decryptor, CryptoStreamMode.Read);

            // IMPORTANT: a single Stream.Read on a CryptoStream may return
            // fewer bytes than requested even when more plaintext is
            // available — the legacy VB code (Encrypt.vb) got away with one
            // Read because its RijndaelManaged delivered everything in one
            // chunk, but modern Aes does not promise that. CopyTo drains
            // the stream completely.
            using var plaintextStream = new MemoryStream();
            cryptoStream.CopyTo(plaintextStream);
            return Encoding.UTF8.GetString(plaintextStream.ToArray());
        }

        /// <summary>
        /// Derives the AES-256 key using .NET's legacy
        /// <see cref="PasswordDeriveBytes"/>. Suppress SYSLIB0041 because we
        /// MUST stay byte-compatible with the desktop app — modern KDFs would
        /// produce a different key and break interop.
        /// </summary>
        private static byte[] DeriveKey(byte[] saltBytes)
        {
#pragma warning disable SYSLIB0041 // PasswordDeriveBytes is obsolete; legacy compat required
            using var password = new PasswordDeriveBytes(
                PassPhrase, saltBytes, HashAlgorithm, PasswordIterations);
            return password.GetBytes(KeySize / 8);
#pragma warning restore SYSLIB0041
        }
    }
}
