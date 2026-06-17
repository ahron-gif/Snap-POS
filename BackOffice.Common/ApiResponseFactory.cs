using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Common
{
    public static class ApiResponseFactory
    {
        public static ApiResponse<T> Success<T>(T data, string message = "OK")
        {
            return new ApiResponse<T>
            {
                IsSuccess = true,
                StatusCode = ResponseCode.Success,
                Message = message,
                Response = data
            };
        }
        public static ApiResponse<T> BadRequest<T>(string message, List<string> errors = null)
            => CreateFailure<T>(ResponseCode.BadRequestError, message, errors);
        public static ApiResponse<T> Unauthorized<T>(string message = "Unauthorized")
            => CreateFailure<T>(ResponseCode.UnauthorizedError, message);
        public static ApiResponse<T> Forbidden<T>(string message = "Forbidden")
            => CreateFailure<T>(ResponseCode.ForbiddenError, message);
        public static ApiResponse<T> NotFound<T>(string message = "Not Found")
            => CreateFailure<T>(ResponseCode.NotFoundError, message);
        public static ApiResponse<T> Timeout<T>(string message = "Request Timeout")
            => CreateFailure<T>(ResponseCode.RequestTimeoutError, message);
        public static ApiResponse<T> InternalError<T>(string message = "Internal Server Error", List<string> errors = null)
            => CreateFailure<T>(ResponseCode.InternalServerError, message, errors);
        public static ApiResponse<T> BadGateway<T>(string message = "Bad Gateway")
            => CreateFailure<T>(ResponseCode.BadGatewayError, message);
        public static ApiResponse<T> ValidationError<T>(string message, Dictionary<string, List<string>> errors)
    => CreateFailure<T>(ResponseCode.BadRequestError, message, errors);
        public static object Failure(string title, string message)
        {
            return new
            {
                isSuccess = false,
                title,
                message
            };
        }
        public static ApiResponse<T> NotFoundWithTrue<T>(string message = "Not Found")
        {
            return new ApiResponse<T>
            {
                IsSuccess = true,
                StatusCode = ResponseCode.NotFoundError,
                Message = message,
                Errors = null
            };
        }

        private static ApiResponse<T> CreateFailure<T>(ResponseCode statusCode, string message, object errors = null)
        {
            return new ApiResponse<T>
            {
                IsSuccess = false,
                StatusCode = statusCode,
                Message = message,
                Errors = errors
            };
        }
    }
}
