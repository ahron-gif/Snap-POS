using System.Runtime.InteropServices;

namespace BackOffice.PrintAgent.Services;

public class RawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string? pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string? pDataType;
    }

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, EntryPoint = "OpenPrinterW", SetLastError = true)]
    private static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet = CharSet.Unicode, EntryPoint = "StartDocPrinterW", SetLastError = true)]
    private static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] ref DOCINFOW di);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError = true)]
    private static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static void SendBytes(string printerName, byte[] data, string jobName)
    {
        if (!OpenPrinter(printerName, out var hPrinter, IntPtr.Zero))
        {
            throw new InvalidOperationException($"OpenPrinter failed for '{printerName}' (Win32 error {Marshal.GetLastWin32Error()})");
        }

        var unmanagedBuffer = IntPtr.Zero;
        try
        {
            var doc = new DOCINFOW
            {
                pDocName = jobName,
                pDataType = "RAW"
            };

            if (!StartDocPrinter(hPrinter, 1, ref doc))
            {
                throw new InvalidOperationException($"StartDocPrinter failed (Win32 error {Marshal.GetLastWin32Error()})");
            }

            if (!StartPagePrinter(hPrinter))
            {
                EndDocPrinter(hPrinter);
                throw new InvalidOperationException($"StartPagePrinter failed (Win32 error {Marshal.GetLastWin32Error()})");
            }

            unmanagedBuffer = Marshal.AllocCoTaskMem(data.Length);
            Marshal.Copy(data, 0, unmanagedBuffer, data.Length);

            if (!WritePrinter(hPrinter, unmanagedBuffer, data.Length, out _))
            {
                throw new InvalidOperationException($"WritePrinter failed (Win32 error {Marshal.GetLastWin32Error()})");
            }

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
        }
        finally
        {
            if (unmanagedBuffer != IntPtr.Zero) Marshal.FreeCoTaskMem(unmanagedBuffer);
            ClosePrinter(hPrinter);
        }
    }
}
