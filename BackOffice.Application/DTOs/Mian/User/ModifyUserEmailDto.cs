using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs.Mian.User
{
    public class ModifyUserEmailDto
    {
        public int UserId { get; set; }
        public string NewEmail { get; set; }
    }
}
