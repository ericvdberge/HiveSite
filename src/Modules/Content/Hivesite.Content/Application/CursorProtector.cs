using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;

namespace Hivesite.Content.Application;

/// <summary>
/// Signs and encrypts list cursors so a client cannot forge or edit one. Every list in the module uses it.
/// Keys come from ASP.NET Core Data Protection, so the host's key ring decides how long a cursor lives.
/// </summary>
internal sealed class CursorProtector(IDataProtectionProvider provider)
{
    private const string Prefix = "c_";
    private readonly IDataProtector protector = provider.CreateProtector("Hivesite.Content.Cursor.v1");

    public string Protect(string payload) => Prefix + protector.Protect(payload);

    /// <summary>False for anything this protector did not issue: wrong prefix, bad encoding, tampered, or from another key.</summary>
    public bool TryUnprotect(string cursor, out string payload)
    {
        payload = string.Empty;
        if (!cursor.StartsWith(Prefix, StringComparison.Ordinal))
        {
            return false;
        }
        try
        {
            payload = protector.Unprotect(cursor[Prefix.Length..]);
            return true;
        }
        catch (CryptographicException)
        {
            return false;
        }
    }
}
