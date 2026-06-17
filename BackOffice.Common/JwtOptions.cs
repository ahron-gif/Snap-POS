using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Common
{
    public class JwtOptions
    {
        public string IssuerSigningKey { get; set; }
        public string ValidIssuer { get; set; }
        public string ValidAudience { get; set; }
        public int AccessTokenExpireDays { get; set; }
        public int RefreshTokenExpireDays { get; set; }
        public string AccessTokenName { get; set; }
        public string RefreshTokenName { get; set; }
    }
}
