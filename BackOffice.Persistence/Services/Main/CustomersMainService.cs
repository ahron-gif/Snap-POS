using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Domain.Entities.Main;
using BackOffice.Persistence.Repositories;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Main
{
    public class CustomersMainService : ICustomersMainService
    {
        private readonly IUnitOfWorkMain _unitOfWork;
        private readonly IMapper _mapper;

        public CustomersMainService(IUnitOfWorkMain unitOfWork, IMapper mapper)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
        }

        public  Task<List<Customer>?> GetAllCustomers()
        {
            return  _unitOfWork.Customers
            .GetAll()
            .ToListAsync();
        }

        public Task<Customer?> GetCustomerById(int? CustomerId)
        {
            return _unitOfWork.Customers
                .FirstOrDefaultAsync(c => c.CustomerId == CustomerId);
        }
    }
}
