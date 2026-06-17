using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs
{
    public class TemplateDto
    {
        public int ID { get; set; }
        public string Templete { get; set; }
        public byte[] Images { get; set; }
        public Guid? UserID { get; set; }
        public UserDto User { get; set; }
    }
}
