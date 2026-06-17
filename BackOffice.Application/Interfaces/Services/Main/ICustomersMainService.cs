using BackOffice.Domain.Entities.Main;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Main
{
    public interface ICustomersMainService
    {
        Task<List<Customer>?> GetAllCustomers(); 
        Task<Customer?> GetCustomerById(int? CustomerId); 
    }
}
