namespace BackOffice.Application.Interfaces.Services.Security
{
    /// <summary>
    /// Symmetric cipher for short, sensitive strings (e.g., tenant DB passwords).
    /// Implementation uses AES-GCM with a key loaded from configuration.
    /// </summary>
    public interface IPasswordCipher
    {
        /// <summary>
        /// Encrypts the given plaintext. Returns a base64 string of the form
        /// <c>IV (12 bytes) || ciphertext || GCM tag (16 bytes)</c>.
        /// </summary>
        string Encrypt(string plaintext);

        /// <summary>
        /// Decrypts a string previously produced by <see cref="Encrypt"/>. Throws
        /// if the ciphertext is corrupt, truncated, or was encrypted with a
        /// different key.
        /// </summary>
        string Decrypt(string ciphertext);
    }
}
