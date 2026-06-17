using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Common
{
    /// <summary>
    /// A simplified API result class for returning simple operation results
    /// </summary>
    public class ApiResult<T>
    {
        public bool IsSuccess { get; set; }
        public string Message { get; set; } = string.Empty;
        public T? Response { get; set; }
    }
}
