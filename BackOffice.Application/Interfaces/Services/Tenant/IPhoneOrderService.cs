using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.PhoneOrder;
using BackOffice.Common;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface IPhoneOrderService
    {
        ApiResponse<PaginationResponseDTO<PhoneOrderViewDto>> GetAllPhoneOrdersGridAsync(PaginationGridDto pagination);
    }
}
