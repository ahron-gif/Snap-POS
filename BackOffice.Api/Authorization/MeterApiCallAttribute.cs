using Microsoft.AspNetCore.Mvc;

namespace BackOffice.Api.Authorization
{
    /// <summary>
    /// Records one API-call usage row for the calling customer when the action
    /// completes successfully. The <paramref name="apiCode"/> must match a
    /// <c>dbo.ApiDefinitions.Code</c> value (e.g. <c>CUSTOMER_SYNC</c>,
    /// <c>ITEM_SYNC</c>, <c>PHONE_ORDER</c>).
    ///
    /// Usage:
    ///   [MeterApiCall("CUSTOMER_SYNC")]
    ///   public async Task&lt;IActionResult&gt; SyncCustomers(...) { ... }
    ///
    /// Behaviour:
    ///   * Action runs first; the recording happens AFTER the result is produced
    ///     and only when status code is 2xx. Failed calls are not billed.
    ///   * CustomerId is resolved from the JWT claim "CustomerId". If absent
    ///     (e.g. super-admin / unauthenticated), the call is not metered.
    ///   * Recording errors are logged but never block the response — billing
    ///     loss is preferable to user-facing failures.
    /// </summary>
    [AttributeUsage(AttributeTargets.Method | AttributeTargets.Class)]
    public class MeterApiCallAttribute : TypeFilterAttribute
    {
        public MeterApiCallAttribute(string apiCode, int callCount = 1)
            : base(typeof(MeterApiCallFilter))
        {
            Arguments = new object[] { apiCode, callCount };
        }
    }
}
