#nullable enable
using System;

namespace BackOffice.Domain.Attributes;

[AttributeUsage(AttributeTargets.Class, Inherited = true, AllowMultiple = false)]
public sealed class NotAuditedAttribute : Attribute
{
}
