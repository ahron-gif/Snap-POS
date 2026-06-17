using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs
{
    public class UsersStoreDto
    {
        public Guid UserStoreID { get; set; }
        public Guid? UserID { get; set; }
        public bool? OnLine { get; set; }
        public Guid? StoreID { get; set; }
        public bool? IsDefault { get; set; }
        public Guid? GroupID { get; set; }
        public bool? Manager { get; set; }
        public DateTime? LogonDate { get; set; }
        public short? Status { get; set; }
        public DateTime? DateCreated { get; set; }
        public DateTime? DateModified { get; set; }
        public UserDto User { get; set; }
    }
}
