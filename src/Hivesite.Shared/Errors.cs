namespace Hivesite.Shared;

/// <summary>A failure a service raises. <see cref="ApiExceptionHandler"/> turns it into an <see cref="ApiError"/>.</summary>
public abstract class AppException(int status, string code, string message, string? field = null) : Exception(message)
{
    public int Status { get; } = status;

    public string Code { get; } = code;

    public string? Field { get; } = field;
}

/// <summary>404: the resource does not exist, or belongs to someone else.</summary>
public sealed class NotFoundException(string code, string message) : AppException(404, code, message);

/// <summary>400: the request breaks a rule, such as a taken slug or a count limit.</summary>
public sealed class BusinessRuleException(string code, string message, string? field = null) : AppException(400, code, message, field);
