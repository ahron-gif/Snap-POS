using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Logs;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class RequestResponseLogService : IRequestResponseLogService
    {
        private readonly TenantDBContext _dbContext;

        public RequestResponseLogService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        public ApiResponse<PaginationResponseDTO<RequestLogGridDto>> GetAllRequestLogsGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.RCA_RequestLogs
                    .Select(x => new RequestLogGridDto
                    {
                        RequestId = x.RequestId,
                        RequestData = x.RequestData,
                        CreatedAt = x.CreatedAt,
                        MethodName = x.MethodName,
                        ControllerName = x.ControllerName,
                        RegistrationID = x.RegistrationID,
                        Token = x.Token,
                        HasResponse = _dbContext.RCA_ResponseLogs.Any(r => r.RequestId == x.RequestId)
                    })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.RCA_RequestLogs.Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "CreatedAt", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<RequestLogGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Request logs retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<RequestLogGridDto>>(
                    "Error fetching request logs.",
                    new List<string> { ex.Message });
            }
        }

        public ApiResponse<PaginationResponseDTO<ResponseLogGridDto>> GetAllResponseLogsGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.RCA_ResponseLogs
                    .Select(x => new ResponseLogGridDto
                    {
                        ResponseId = x.ResponseId,
                        RequestId = x.RequestId,
                        RequestData = x.RequestData,
                        CreatedAt = x.CreatedAt,
                        MethodName = x.MethodName,
                        ControllerName = x.ControllerName,
                        RegistrationID = x.RegistrationID,
                        Token = x.Token
                    })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.RCA_ResponseLogs.Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "CreatedAt", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<ResponseLogGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Response logs retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ResponseLogGridDto>>(
                    "Error fetching response logs.",
                    new List<string> { ex.Message });
            }
        }

        public ApiResponse<PaginationResponseDTO<RequestResponseLogDto>> GetAllRequestResponseLogsGrid(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = from req in _dbContext.RCA_RequestLogs
                            join resp in _dbContext.RCA_ResponseLogs on req.RequestId equals resp.RequestId into respGroup
                            from resp in respGroup.DefaultIfEmpty()
                            select new RequestResponseLogDto
                            {
                                RequestId = req.RequestId,
                                RequestData = req.RequestData,
                                RequestCreatedAt = req.CreatedAt,
                                MethodName = req.MethodName,
                                ControllerName = req.ControllerName,
                                RegistrationID = req.RegistrationID,
                                Token = req.Token,
                                ResponseId = resp != null ? resp.ResponseId : (int?)null,
                                ResponseData = resp != null ? resp.RequestData : null,
                                ResponseCreatedAt = resp != null ? resp.CreatedAt : null
                            };

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.RCA_RequestLogs.Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "RequestCreatedAt", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<RequestResponseLogDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Request/Response logs retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<RequestResponseLogDto>>(
                    "Error fetching request/response logs.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<RequestLogDetailDto>> GetRequestLogByIdAsync(int requestId)
        {
            try
            {
                var requestLog = await _dbContext.RCA_RequestLogs
                    .Where(x => x.RequestId == requestId)
                    .Select(x => new RequestLogDetailDto
                    {
                        RequestId = x.RequestId,
                        RequestData = x.RequestData,
                        CreatedAt = x.CreatedAt,
                        MethodName = x.MethodName,
                        ControllerName = x.ControllerName,
                        RegistrationID = x.RegistrationID,
                        Token = x.Token
                    })
                    .FirstOrDefaultAsync();

                if (requestLog == null)
                {
                    return new ApiResponse<RequestLogDetailDto>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Request log not found",
                        Response = null
                    };
                }

                // Get linked response
                var responseLog = await _dbContext.RCA_ResponseLogs
                    .Where(x => x.RequestId == requestId)
                    .Select(x => new ResponseLogGridDto
                    {
                        ResponseId = x.ResponseId,
                        RequestId = x.RequestId,
                        RequestData = x.RequestData,
                        CreatedAt = x.CreatedAt,
                        MethodName = x.MethodName,
                        ControllerName = x.ControllerName,
                        RegistrationID = x.RegistrationID,
                        Token = x.Token
                    })
                    .FirstOrDefaultAsync();

                requestLog.Response = responseLog;

                return new ApiResponse<RequestLogDetailDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Request log retrieved successfully",
                    Response = requestLog
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<RequestLogDetailDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching request log: {ex.Message}",
                    Response = null
                };
            }
        }

        public async Task<ApiResponse<ResponseLogGridDto>> GetResponseByRequestIdAsync(int requestId)
        {
            try
            {
                var responseLog = await _dbContext.RCA_ResponseLogs
                    .Where(x => x.RequestId == requestId)
                    .Select(x => new ResponseLogGridDto
                    {
                        ResponseId = x.ResponseId,
                        RequestId = x.RequestId,
                        RequestData = x.RequestData,
                        CreatedAt = x.CreatedAt,
                        MethodName = x.MethodName,
                        ControllerName = x.ControllerName,
                        RegistrationID = x.RegistrationID,
                        Token = x.Token
                    })
                    .FirstOrDefaultAsync();

                if (responseLog == null)
                {
                    return new ApiResponse<ResponseLogGridDto>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Response log not found for this request",
                        Response = null
                    };
                }

                return new ApiResponse<ResponseLogGridDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Response log retrieved successfully",
                    Response = responseLog
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<ResponseLogGridDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching response log: {ex.Message}",
                    Response = null
                };
            }
        }

        public async Task<ApiResponse<List<string>>> GetDistinctControllerNamesAsync()
        {
            try
            {
                var controllers = await _dbContext.RCA_RequestLogs
                    .Where(x => !string.IsNullOrEmpty(x.ControllerName))
                    .Select(x => x.ControllerName!)
                    .Distinct()
                    .OrderBy(x => x)
                    .ToListAsync();

                return new ApiResponse<List<string>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Controller names retrieved successfully",
                    Response = controllers
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<string>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching controller names: {ex.Message}",
                    Response = new List<string>()
                };
            }
        }

        public async Task<ApiResponse<List<string>>> GetDistinctMethodNamesAsync(string? controllerName = null)
        {
            try
            {
                var query = _dbContext.RCA_RequestLogs
                    .Where(x => !string.IsNullOrEmpty(x.MethodName));

                if (!string.IsNullOrEmpty(controllerName))
                {
                    query = query.Where(x => x.ControllerName == controllerName);
                }

                var methods = await query
                    .Select(x => x.MethodName!)
                    .Distinct()
                    .OrderBy(x => x)
                    .ToListAsync();

                return new ApiResponse<List<string>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Method names retrieved successfully",
                    Response = methods
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<string>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching method names: {ex.Message}",
                    Response = new List<string>()
                };
            }
        }
    }
}
