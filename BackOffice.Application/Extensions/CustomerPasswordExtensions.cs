using BackOffice.Application.Interfaces.Services.Security;
using BackOffice.Domain.Entities.Main;

namespace BackOffice.Application.Extensions
{
    /// <summary>
    /// Resolve the effective plaintext DB password for a tenant Customer.
    ///
    /// The new BackOffice-Web app stores the password encrypted in
    /// <see cref="Customer.DBPasswordSecure"/>. Legacy customers (created by the
    /// old BackOffice and never re-saved here) still have only the plaintext
    /// <see cref="Customer.DBPass"/>. Connection-string code calls this helper
    /// so it doesn't have to branch by itself.
    /// </summary>
    public static class CustomerPasswordExtensions
    {
        public static string ResolveDBPassword(this Customer customer, IPasswordCipher cipher)
        {
            if (customer is null) throw new ArgumentNullException(nameof(customer));
            if (cipher is null) throw new ArgumentNullException(nameof(cipher));

            if (!string.IsNullOrEmpty(customer.DBPasswordSecure))
            {
                return cipher.Decrypt(customer.DBPasswordSecure);
            }
            return customer.DBPass;
        }
    }
}
