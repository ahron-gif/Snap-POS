namespace BackOffice.Common;

public static class SmtpOptionIds
{
    public const int OutgoingMailServer = 123;
    public const int OutgoingMailPort = 125;
    public const int UseSsl = 126;
    public const int EmailAddress = 127;
    public const int EmailPassword = 128;
    public const int StoreEmail = 834;

    public static readonly int[] All =
    {
        OutgoingMailServer,
        OutgoingMailPort,
        UseSsl,
        EmailAddress,
        EmailPassword,
        StoreEmail
    };
}
