using BackOffice.Common;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace BackOffice.Persistence.Helpers;

public static class MailKitSender
{
    public static async Task SendAsync(SmtpSettings smtp, MimeMessage message, CancellationToken ct = default)
    {
        using var client = new SmtpClient();
        var secureOption = smtp.UseSsl
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTls;

        await client.ConnectAsync(smtp.Host, smtp.Port, secureOption, ct);
        await client.AuthenticateAsync(smtp.Username ?? smtp.FromEmail, smtp.Password, ct);
        await client.SendAsync(message, ct);
        await client.DisconnectAsync(true, ct);
    }
}
