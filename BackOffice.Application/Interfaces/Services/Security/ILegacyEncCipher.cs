namespace BackOffice.Application.Interfaces.Services.Security
{
    /// <summary>
    /// Byte-for-byte port of the legacy VB6/WinForms <c>Crypto.DsEncrypt</c> /
    /// <c>Crypto.DsDecrypt</c> used by the desktop BackOffice (<c>Encrypt.vb</c>)
    /// to read and write the encrypted XML blob in the per-tenant
    /// <c>EncData.EncData</c> column.
    ///
    /// The algorithm is fixed (AES-256 CBC with PKCS7 padding, key derived via
    /// <see cref="System.Security.Cryptography.PasswordDeriveBytes"/> from a
    /// hardcoded passphrase + salt, hardcoded 16-byte ASCII IV) so that ciphertext
    /// produced by the new web app remains interoperable with the desktop app
    /// and vice versa. Do <b>not</b> use this for anything except the legacy
    /// EncData blob — for new at-rest secrets use <see cref="IPasswordCipher"/>
    /// (AES-GCM with a configured key).
    /// </summary>
    public interface ILegacyEncCipher
    {
        /// <summary>
        /// Encrypts UTF-8 plaintext and returns Base64 ciphertext that the
        /// legacy desktop BackOffice can decrypt with <c>Crypto.DsDecrypt</c>.
        /// </summary>
        string Encrypt(string plainText);

        /// <summary>
        /// Decrypts Base64 ciphertext produced by the legacy desktop
        /// BackOffice's <c>Crypto.DsEncrypt</c>. Returns UTF-8 plaintext.
        /// </summary>
        string Decrypt(string cipherText);
    }
}
