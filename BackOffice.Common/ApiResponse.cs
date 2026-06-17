using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Common
{
    public class ApiResponse<T>
    {
        public bool IsSuccess { get; set; }
        public ResponseCode StatusCode { get; set; }
        public string Message { get; set; }
        public T Response { get; set; }
        public object Errors { get; set; }
        public ApiResponse()
        {
            Errors = null;
        }
    }
}
