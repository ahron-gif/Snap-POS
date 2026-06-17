using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Mian.Customer;
using BackOffice.Application.DTOs.Tenant.Customer;
using BackOffice.Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface ICustomerService
    {
        ApiResponse<PaginationResponseDTO<CustomerViewDto>> GetAllCustomersGridAsync(PaginationGridDto pagination);
        public ApiResponse<List<TennatLookupDto>> GetAllTenantsAsync();

        /// <summary>
        /// Gets all customers for lookup dropdown (ID and Name only)
        /// </summary>
        ApiResponse<List<CustomerLookupDto>> GetAllCustomersLookupAsync();
    }
}
