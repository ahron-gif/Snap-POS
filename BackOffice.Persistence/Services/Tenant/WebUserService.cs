using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Common;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Persistence.Repositories;
using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using BackOffice.Domain.Entities.Tenant;

namespace BackOffice.Persistence.Services
{
    public class WebUserService : IWebUserService
    {
        private readonly IUnitOfWorkTenant _unitOfWork;
        private readonly IMapper _mapper;
      
        public WebUserService(IUnitOfWorkTenant unitOfWork, IMapper mapper)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
        }

        public Task<WebUser?> AuthenticateAsync(string userName, string password)
        {
            throw new NotImplementedException();
        }

        public Task<WebUser> CreateAsync(WebUser user)
        {
            throw new NotImplementedException();
        }

        public Task<bool> DeleteAsync(Guid userId)
        {
            throw new NotImplementedException();
        }

        //public Task<IEnumerable<User>> GetAllAsync()
        //{
        //    throw new NotImplementedException();
        //}

        public Task<WebUser?> GetByIdAsync(Guid userId)
        {
            throw new NotImplementedException();
        }

        public Task<WebUser?> GetByUserNameAsync(string userName)
        {
            throw new NotImplementedException();
        }

        //public async Task<SyncResponseDto> GetUserBidAsync(SyncRequestDto request)
        //{
        //    using var trx = await _unitOfWorkBO.BeginTransactionAsync();
        //    var syncTime = DateTime.UtcNow;

        //    var syncLog = new SyncLog
        //    {
        //        EntityName = request.Entity,
        //        Direction = request.Direction,
        //        SyncTime = syncTime,
        //        Success = false,
        //        Message = ""
        //    };

        //    try
        //    {
        //        var config = await _unitOfWorkBO.SyncEntityConfigurations
        //            .FirstOrDefaultAsync(x => x.EntityName == request.Entity && x.IsEnabled && x.Direction == request.Direction);

        //        if (config == null)
        //        {
        //            syncLog.Message = "Sync not allowed for this entity.";
        //            await _unitOfWorkBO.SyncLogs.AddAsync(syncLog);
        //            await _unitOfWorkBO.SaveChangesAsync();

        //            return new SyncResponseDto
        //            {
        //                Success = false,
        //                Message = syncLog.Message,
        //                SyncTime = syncTime
        //            };
        //        }

        //        await ProcessEntityAsync(request.Entity, request.Data);

        //        config.LastSyncedAt = syncTime;
        //        syncLog.Success = true;
        //        syncLog.Message = "Full sync completed successfully.";

        //        await _unitOfWorkBO.SyncLogs.AddAsync(syncLog);
        //        await _unitOfWorkBO.SaveChangesAsync();
        //        await trx.CommitAsync();

        //        return new SyncResponseDto
        //        {
        //            Success = true,
        //            Message = syncLog.Message,
        //            SyncTime = syncTime
        //        };
        //    }
        //    catch (Exception ex)
        //    {
        //        await trx.RollbackAsync();

        //        syncLog.Message = "Full sync failed: " + ex.Message;
        //        await _unitOfWorkBO.SyncLogs.AddAsync(syncLog);
        //        await _unitOfWorkBO.SaveChangesAsync();

        //        return new SyncResponseDto
        //        {
        //            Success = false,
        //            Message = syncLog.Message,
        //            SyncTime = syncTime
        //        };
        //    }
        //}

        public Task<WebUser?> UpdateAsync(WebUser user)
        {
            throw new NotImplementedException();
        }

        public ApiResponse<PaginationResponseDTO<UserDto>> GetAllAsync(PaginationDTO pagination)
        {
            try
            {
                var query = _unitOfWork.WebUsers
                    .GetAll()
                    //.Where(x => !x.IsDeleted && x.TenantId == tenantId)
                    .AsQueryable();

                //if (!string.IsNullOrWhiteSpace(pagination.SearchValue))
                //{
                //    var search = pagination.SearchValue.ToLower();
                //    query = query.Where(x => x.CompanyName.ToLower().Contains(search));
                //}

                var totalRecords = query.Count();
                List<WebUser> users;
                if (pagination.PageSize == null || pagination.PageSize == 0)
                {
                    users = query.OrderByDescending(x => x.DateCreated).ToList();
                }
                else
                {
                    users = query
                        .OrderByDescending(x => x.DateCreated)
                        .Skip((pagination.PageNumber - 1) * pagination.PageSize)
                        .Take(pagination.PageSize)
                        .ToList();
                }
                var data = _mapper.Map<List<UserDto>>(users);
                var response = new PaginationResponseDTO<UserDto>
                {
                    TotalRecords = totalRecords,
                    RecordsFiltered = totalRecords,
                    Data = data
                };
                return ApiResponseFactory.Success(response, "Company list fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<UserDto>>(
                    "Error fetching companies.",
                    new List<string> { ex.Message });
            }
        }

    }
}
