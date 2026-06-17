using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Common
{
    public enum ResponseCode
    {
        Success = 200,
        BadRequestError = 400,
        UnauthorizedError = 401,
        ForbiddenError = 403,
        NotFoundError = 404,
        RequestTimeoutError = 408,
        ConflictError = 409,
        InternalServerError = 500,
        BadGatewayError = 502
    }
}
