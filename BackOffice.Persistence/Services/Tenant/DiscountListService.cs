using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Discount;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;

namespace BackOffice.Persistence.Services.Tenant
{
    public class DiscountListService : IDiscountListService
    {
        private readonly TenantDBContext _dbContext;

        public DiscountListService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Gets all discounts from Discounts table with pagination, filtering, and sorting support
        /// </summary>
        public ApiResponse<PaginationResponseDTO<DiscountGridDto>> GetAllDiscountsGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                // Base query from Discounts table — exclude deleted records (Status == -1)
                var query = (from d in _dbContext.Discounts
                             where d.Status != -1
                             select new DiscountGridDto
                             {
                                 DiscountID = d.DiscountID,
                                 Name = d.Name,
                                 StartDate = d.StartDate,
                                 EndDate = d.EndDate,
                                 PercentsDiscount = d.PercentsDiscount,
                                 AmountDiscount = d.AmountDiscount,
                                 DiscountType = d.DiscountType,
                                 DiscountTypeName =
                                     d.DiscountType == 0 ? "Regular" :
                                     d.DiscountType == 1 ? "Bogo" :
                                     d.DiscountType == 2 ? "Brand" :
                                     d.DiscountType == 3 ? "Group" : "Other",
                                 UPCDiscount = d.UPCDiscount,
                                 Status = d.Status,
                                 DateCreated = d.DateCreated,
                                 DateModified = d.DateModified
                             })
                             .AsQueryable();

                // Apply QueryHelper filters (handles grid column filters and custom search text)
                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records (exclude deleted)
                int totalRecords = _dbContext.Discounts.Count(d => d.Status != -1);

                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "Name", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<DiscountGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Discounts fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<DiscountGridDto>>(
                    "Error fetching discounts.",
                    new List<string> { ex.Message });
            }
        }

        /// <summary>
        /// Get discount by ID for view/edit form — includes related items, departments, brands, stores, tenders
        /// </summary>
        public async Task<ApiResponse<DiscountDetailDto>> GetDiscountByIdAsync(Guid discountId)
        {
            try
            {
                var discount = await _dbContext.Discounts
                    .Where(d => d.DiscountID == discountId)
                    .Select(d => new DiscountDetailDto
                    {
                        DiscountID = d.DiscountID,
                        Name = d.Name,
                        StartDate = d.StartDate,
                        EndDate = d.EndDate,
                        PercentsDiscount = d.PercentsDiscount,
                        AmountDiscount = d.AmountDiscount,
                        MinTotalSale = d.MinTotalSale,
                        UPCDiscount = d.UPCDiscount,
                        Status = d.Status,
                        DateCreated = d.DateCreated,
                        DateModified = d.DateModified,
                        ClearBalance = d.ClearBalance,
                        ClearDays = d.ClearDays,
                        ReqPaswrd = d.ReqPaswrd,
                        DiscountForCC = d.DiscountForCC,
                        DiscountItems = d.DiscountItems,
                        PercentsDiscountWithCC = d.PercentsDiscountWithCC,
                        SalesItem = d.SalesItem,
                        MinTotalSale2 = d.MinTotalSale2,
                        PercentsDiscount2 = d.PercentsDiscount2,
                        AmountDiscount2 = d.AmountDiscount2,
                        MinTotalSale3 = d.MinTotalSale3,
                        PercentsDiscount3 = d.PercentsDiscount3,
                        AmountDiscount3 = d.AmountDiscount3,
                        DiscountType = d.DiscountType,
                        IncludeGiftCard = d.IncludeGiftCard,
                        DiscountItem = d.DiscountItem,
                        DiscountDepartment = d.DiscountDepartment,
                        DiscountBrand = d.DiscountBrand,
                        DiscountStore = d.DiscountStore,
                        BogoQty = d.BogoQty,
                        BogoAmount = d.BogoAmount,
                        BogoType = d.BogoType,
                        SelectedItem = d.SelectedItem,
                        MaxAmount = d.MaxAmount,
                        AutoAssign = d.AutoAssign,
                    })
                    .FirstOrDefaultAsync();

                if (discount == null)
                {
                    return new ApiResponse<DiscountDetailDto>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Discount not found",
                        Response = null
                    };
                }

                // Load related selections from junction tables
                discount.SelectedItemIds = await _dbContext.DiscountItems
                    .Where(di => di.DiscountID == discountId && di.Status != -1)
                    .Where(di => di.ItemID != null)
                    .Select(di => di.ItemID!.Value)
                    .ToListAsync();

                discount.SelectedDepartmentIds = await _dbContext.DiscountDepartments
                    .Where(dd => dd.DiscountID == discountId && dd.Status != -1)
                    .Where(dd => dd.DepartmentID != null)
                    .Select(dd => dd.DepartmentID!.Value)
                    .ToListAsync();

                discount.SelectedBrandIds = await _dbContext.DiscountBrands
                    .Where(db => db.DiscountID == discountId && db.Status != -1)
                    .Where(db => db.BrandID != null)
                    .Select(db => db.BrandID!.Value)
                    .ToListAsync();

                discount.SelectedStoreIds = await _dbContext.DiscountStores
                    .Where(ds => ds.DiscountID == discountId && ds.Status != -1)
                    .Where(ds => ds.StoreID != null)
                    .Select(ds => ds.StoreID!.Value)
                    .ToListAsync();

                // Tenders are stored in TenderToDiscount — the same table the
                // desktop back office reads/writes — keyed by the integer
                // Tender.TenderID (NOT the unused, Guid-keyed DiscountTender table).
                discount.SelectedTenderIds = await _dbContext.TenderToDiscounts
                    .Where(td => td.DiscountID == discountId && td.Status != -1)
                    .Where(td => td.TenderID != null)
                    .Select(td => td.TenderID!.Value)
                    .ToListAsync();

                return new ApiResponse<DiscountDetailDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Discount retrieved successfully",
                    Response = discount
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<DiscountDetailDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching discount: {ex.Message}",
                    Response = null
                };
            }
        }

        /// <summary>
        /// Create a new discount with related selections
        /// </summary>
        public async Task<ApiResponse<Guid>> CreateDiscountAsync(CreateDiscountDto dto, Guid modifierId)
        {
            try
            { 
                var newId = Guid.NewGuid();
                var now = DateTime.UtcNow;

                var discount = new Discount
                {
                    DiscountID = newId,
                    Name = dto.Name,
                    UPCDiscount = dto.UPCDiscount,
                    StartDate = dto.StartDate,
                    EndDate = dto.EndDate,
                    ReqPaswrd = dto.ReqPaswrd,
                    SalesItem = dto.SalesItem,
                    DiscountItems = dto.DiscountItems,
                    IncludeGiftCard = dto.IncludeGiftCard,
                    SelectedItem = dto.SelectedItem,
                    AutoAssign = dto.AutoAssign,
                    ClearDays = dto.ClearDays,
                    MaxAmount = dto.MaxAmount,
                    MinTotalSale = dto.MinTotalSale,
                    AmountDiscount = dto.AmountDiscount,
                    PercentsDiscount = dto.PercentsDiscount,
                    MinTotalSale2 = dto.MinTotalSale2,
                    AmountDiscount2 = dto.AmountDiscount2,
                    PercentsDiscount2 = dto.PercentsDiscount2,
                    MinTotalSale3 = dto.MinTotalSale3,
                    AmountDiscount3 = dto.AmountDiscount3,
                    PercentsDiscount3 = dto.PercentsDiscount3,
                    DiscountItem = dto.DiscountItem,
                    DiscountDepartment = dto.DiscountDepartment,
                    DiscountBrand = dto.DiscountBrand,
                    DiscountStore = dto.DiscountStore,
                    DiscountType = dto.DiscountType ?? 0,
                    Status = 0,
                    DateCreated = now,
                    DateModified = now,
                    UserCreated = modifierId,
                    UserModified = modifierId,
                };

                _dbContext.Discounts.Add(discount);

                // Save related items
                if (dto.SelectedItemIds != null && dto.SelectedItemIds.Count > 0 && (dto.DiscountItem ?? 0) > 0)
                {
                    foreach (var itemId in dto.SelectedItemIds)
                    {
                        _dbContext.DiscountItems.Add(new DiscountItem
                        {
                            ItemDiscountID = Guid.NewGuid(),
                            DiscountID = newId,
                            ItemID = itemId,
                            Status = 0,
                            DateCreated = now,
                            UserCreated = modifierId,
                        });
                    }
                }

                // Save related departments
                if (dto.SelectedDepartmentIds != null && dto.SelectedDepartmentIds.Count > 0 && (dto.DiscountDepartment ?? 0) > 0)
                {
                    foreach (var deptId in dto.SelectedDepartmentIds)
                    {
                        _dbContext.DiscountDepartments.Add(new DiscountDepartment
                        {
                            DiscountDepartmentID = Guid.NewGuid(),
                            DiscountID = newId,
                            DepartmentID = deptId,
                            Status = 0,
                            DateCreated = now,
                            UserCreated = modifierId,
                        });
                    }
                }

                // Save related brands
                if (dto.SelectedBrandIds != null && dto.SelectedBrandIds.Count > 0 && (dto.DiscountBrand ?? 0) > 0)
                {
                    foreach (var brandId in dto.SelectedBrandIds)
                    {
                        _dbContext.DiscountBrands.Add(new DiscountBrand
                        {
                            DiscountBrandID = Guid.NewGuid(),
                            DiscountID = newId,
                            BrandID = brandId,
                            Status = 0,
                            DateCreated = now,
                            UserCreated = modifierId,
                        });
                    }
                }

                // Save related stores
                if (dto.SelectedStoreIds != null && dto.SelectedStoreIds.Count > 0 && (dto.DiscountStore ?? 0) > 0)
                {
                    foreach (var storeId in dto.SelectedStoreIds)
                    {
                        _dbContext.DiscountStores.Add(new DiscountStore
                        {
                            DiscountStoreID = Guid.NewGuid(),
                            DiscountID = newId,
                            StoreID = storeId,
                            Status = 0,
                            DateCreated = now,
                            UserCreated = modifierId,
                        });
                    }
                }

                // Save related tenders into TenderToDiscount (same table + integer
                // Tender.TenderID the desktop back office uses). Status = 1 matches
                // the active-row convention already present in that table.
                if (dto.SelectedTenderIds != null && dto.SelectedTenderIds.Count > 0)
                {
                    foreach (var tenderId in dto.SelectedTenderIds)
                    {
                        _dbContext.TenderToDiscounts.Add(new TenderToDiscount
                        {
                            TenderToDiscountID = Guid.NewGuid(),
                            DiscountID = newId,
                            TenderID = tenderId,
                            Status = 1,
                            DateCreated = now,
                            UserCreated = modifierId,
                        });
                    }
                }

                await _dbContext.SaveChangesAsync();

                return new ApiResponse<Guid>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Discount created successfully",
                    Response = newId
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<Guid>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error creating discount: {ex.Message}",
                    Response = Guid.Empty
                };
            }
        }

        /// <summary>
        /// Update an existing discount with related selections
        /// </summary>
        public async Task<ApiResponse<bool>> UpdateDiscountAsync(UpdateDiscountDto dto, Guid modifierId)
        {
            try
            {
                var discount = await _dbContext.Discounts.FindAsync(dto.DiscountID);
                if (discount == null)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Discount not found",
                        Response = false
                    };
                }

                var now = DateTime.UtcNow;

                // Update main discount fields
                discount.Name = dto.Name;
                discount.UPCDiscount = dto.UPCDiscount;
                discount.StartDate = dto.StartDate;
                discount.EndDate = dto.EndDate;
                discount.ReqPaswrd = dto.ReqPaswrd;
                discount.SalesItem = dto.SalesItem;
                discount.DiscountItems = dto.DiscountItems;
                discount.IncludeGiftCard = dto.IncludeGiftCard;
                discount.SelectedItem = dto.SelectedItem;
                discount.AutoAssign = dto.AutoAssign;
                discount.ClearDays = dto.ClearDays;
                discount.MaxAmount = dto.MaxAmount;
                discount.MinTotalSale = dto.MinTotalSale;
                discount.AmountDiscount = dto.AmountDiscount;
                discount.PercentsDiscount = dto.PercentsDiscount;
                discount.MinTotalSale2 = dto.MinTotalSale2;
                discount.AmountDiscount2 = dto.AmountDiscount2;
                discount.PercentsDiscount2 = dto.PercentsDiscount2;
                discount.MinTotalSale3 = dto.MinTotalSale3;
                discount.AmountDiscount3 = dto.AmountDiscount3;
                discount.PercentsDiscount3 = dto.PercentsDiscount3;
                discount.DiscountItem = dto.DiscountItem;
                discount.DiscountDepartment = dto.DiscountDepartment;
                discount.DiscountBrand = dto.DiscountBrand;
                discount.DiscountStore = dto.DiscountStore;
                discount.DiscountType = dto.DiscountType ?? discount.DiscountType;
                discount.DateModified = now;
                discount.UserModified = modifierId;

                // ── Update related items: remove old, add new ──

                // Items
                var existingItems = await _dbContext.DiscountItems
                    .Where(di => di.DiscountID == dto.DiscountID)
                    .ToListAsync();
                _dbContext.DiscountItems.RemoveRange(existingItems);

                if (dto.SelectedItemIds != null && dto.SelectedItemIds.Count > 0 && (dto.DiscountItem ?? 0) > 0)
                {
                    foreach (var itemId in dto.SelectedItemIds)
                    {
                        _dbContext.DiscountItems.Add(new DiscountItem
                        {
                            ItemDiscountID = Guid.NewGuid(),
                            DiscountID = dto.DiscountID,
                            ItemID = itemId,
                            Status = 0,
                            DateCreated = now,
                            UserCreated = modifierId,
                        });
                    }
                }

                // Departments
                var existingDepts = await _dbContext.DiscountDepartments
                    .Where(dd => dd.DiscountID == dto.DiscountID)
                    .ToListAsync();
                _dbContext.DiscountDepartments.RemoveRange(existingDepts);

                if (dto.SelectedDepartmentIds != null && dto.SelectedDepartmentIds.Count > 0 && (dto.DiscountDepartment ?? 0) > 0)
                {
                    foreach (var deptId in dto.SelectedDepartmentIds)
                    {
                        _dbContext.DiscountDepartments.Add(new DiscountDepartment
                        {
                            DiscountDepartmentID = Guid.NewGuid(),
                            DiscountID = dto.DiscountID,
                            DepartmentID = deptId,
                            Status = 0,
                            DateCreated = now,
                            UserCreated = modifierId,
                        });
                    }
                }

                // Brands
                var existingBrands = await _dbContext.DiscountBrands
                    .Where(db => db.DiscountID == dto.DiscountID)
                    .ToListAsync();
                _dbContext.DiscountBrands.RemoveRange(existingBrands);

                if (dto.SelectedBrandIds != null && dto.SelectedBrandIds.Count > 0 && (dto.DiscountBrand ?? 0) > 0)
                {
                    foreach (var brandId in dto.SelectedBrandIds)
                    {
                        _dbContext.DiscountBrands.Add(new DiscountBrand
                        {
                            DiscountBrandID = Guid.NewGuid(),
                            DiscountID = dto.DiscountID,
                            BrandID = brandId,
                            Status = 0,
                            DateCreated = now,
                            UserCreated = modifierId,
                        });
                    }
                }

                // Stores
                var existingStores = await _dbContext.DiscountStores
                    .Where(ds => ds.DiscountID == dto.DiscountID)
                    .ToListAsync();
                _dbContext.DiscountStores.RemoveRange(existingStores);

                if (dto.SelectedStoreIds != null && dto.SelectedStoreIds.Count > 0 && (dto.DiscountStore ?? 0) > 0)
                {
                    foreach (var storeId in dto.SelectedStoreIds)
                    {
                        _dbContext.DiscountStores.Add(new DiscountStore
                        {
                            DiscountStoreID = Guid.NewGuid(),
                            DiscountID = dto.DiscountID,
                            StoreID = storeId,
                            Status = 0,
                            DateCreated = now,
                            UserCreated = modifierId,
                        });
                    }
                }

                // Tenders — stored in TenderToDiscount (same table + integer
                // Tender.TenderID the desktop back office uses). Replace the set.
                var existingTenders = await _dbContext.TenderToDiscounts
                    .Where(td => td.DiscountID == dto.DiscountID)
                    .ToListAsync();
                _dbContext.TenderToDiscounts.RemoveRange(existingTenders);

                if (dto.SelectedTenderIds != null && dto.SelectedTenderIds.Count > 0)
                {
                    foreach (var tenderId in dto.SelectedTenderIds)
                    {
                        _dbContext.TenderToDiscounts.Add(new TenderToDiscount
                        {
                            TenderToDiscountID = Guid.NewGuid(),
                            DiscountID = dto.DiscountID,
                            TenderID = tenderId,
                            Status = 1,
                            DateCreated = now,
                            UserCreated = modifierId,
                        });
                    }
                }

                await _dbContext.SaveChangesAsync();

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Discount updated successfully",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error updating discount: {ex.Message}",
                    Response = false
                };
            }
        }

        /// <summary>
        /// Check if a discount can be deleted
        /// </summary>
        public async Task<ApiResponse<bool>> CanDeleteDiscountAsync(Guid discountId)
        {
            try
            {
                var discount = await _dbContext.Discounts
                    .FirstOrDefaultAsync(d => d.DiscountID == discountId);

                if (discount == null)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = true,
                        StatusCode = ResponseCode.Success,
                        Message = "Discount not found",
                        Response = false
                    };
                }

                // Already deleted
                if (discount.Status == -1)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = true,
                        StatusCode = ResponseCode.Success,
                        Message = "Discount is already deleted",
                        Response = false
                    };
                }

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Discount can be deleted",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error checking if discount can be deleted: {ex.Message}",
                    Response = false
                };
            }
        }

        /// <summary>
        /// Delete a discount and its related data
        /// </summary>
        public async Task<ApiResponse<bool>> DeleteDiscountAsync(Guid discountId, Guid modifierId)
        {
            try
            {
                // Use stored procedure if available, otherwise soft delete
                var discount = await _dbContext.Discounts.FindAsync(discountId);
                if (discount == null)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Discount not found",
                        Response = false
                    };
                }

                // Try using stored procedure for delete
                try
                {
                    await _dbContext.Procedures.SP_DiscountsDeleteAsync(
                        discountID: discountId,
                        modifierID: modifierId
                    );
                }
                catch
                {
                    // Fallback: soft delete the discount and related records
                    discount.Status = -1; // Deleted
                    discount.DateModified = DateTime.UtcNow;
                    discount.UserModified = modifierId;

                    // Also soft-delete related records
                    var relatedItems = await _dbContext.DiscountItems.Where(di => di.DiscountID == discountId).ToListAsync();
                    foreach (var item in relatedItems) { item.Status = -1; item.DateModified = DateTime.UtcNow; item.UserModified = modifierId; }

                    var relatedDepts = await _dbContext.DiscountDepartments.Where(dd => dd.DiscountID == discountId).ToListAsync();
                    foreach (var dept in relatedDepts) { dept.Status = -1; dept.DateModified = DateTime.UtcNow; dept.UserModified = modifierId; }

                    var relatedBrands = await _dbContext.DiscountBrands.Where(db => db.DiscountID == discountId).ToListAsync();
                    foreach (var brand in relatedBrands) { brand.Status = -1; brand.DateModified = DateTime.UtcNow; brand.UserModified = modifierId; }

                    var relatedStores = await _dbContext.DiscountStores.Where(ds => ds.DiscountID == discountId).ToListAsync();
                    foreach (var store in relatedStores) { store.Status = -1; store.DateModified = DateTime.UtcNow; store.UserModified = modifierId; }

                    var relatedTenders = await _dbContext.TenderToDiscounts.Where(td => td.DiscountID == discountId).ToListAsync();
                    foreach (var tender in relatedTenders) { tender.Status = -1; tender.DateModified = DateTime.UtcNow; tender.UserModified = modifierId; }

                    await _dbContext.SaveChangesAsync();
                }

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Discount deleted successfully",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error deleting discount: {ex.Message}",
                    Response = false
                };
            }
        }
    }
}
