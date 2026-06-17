using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Mian.Customer;
using BackOffice.Application.DTOs.Tenant.Customer;
using BackOffice.Application.DTOs.Tenant.Vendor;
using BackOffice.Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IVendorService
    {
        ApiResponse<PaginationResponseDTO<CustomerViewDto>> GetAllVendorsGridAsync(PaginationGridDto pagination);

        /// <summary>
        /// Gets all vendors for lookup dropdown (ID and Name only)
        /// </summary>
        ApiResponse<List<VendorLookupDto>> GetAllVendorsLookupAsync();
    }
}
