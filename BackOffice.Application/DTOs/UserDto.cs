using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs
{
    public class UserDto
    {
        public Guid UserId { get; set; }
        public string UserName { get; set; }
        public string UserFName { get; set; }
        public string UserLName { get; set; }
        public string Address { get; set; }
        public string HomePhoneNumber { get; set; }
        public string WorkPhoneNumber { get; set; }
        public string Fax { get; set; }
        public string Email { get; set; }
        public string ZipCode { get; set; }
        public bool? IsSuperAdmin { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public string ScanID { get; set; }
        public bool? IsLogIn { get; set; }

        // Optional: You can include collections or related entities if needed
        public ICollection<TemplateDto> Templates { get; set; } = new List<TemplateDto>();
        public UsersStoreDto UsersStore { get; set; }
    }
}
