using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.PurchaseOrder;
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
    public class PurchaseOrderService : IPurchaseOrderService
    {
        private readonly TenantDBContext _dbContext;

        public PurchaseOrderService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        public ApiResponse<PaginationResponseDTO<PurchaseOrderGridDto>> GetAllPurchaseOrdersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();
                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.PurchaseOrdersViews
                    .Select(x => new PurchaseOrderGridDto
                    {
                        PurchaseOrderId = x.PurchaseOrderId,
                        PoNo = x.PoNo,
                        GrandTotal = x.GrandTotal,
                        PurchaseOrderDate = x.PurchaseOrderDate,
                        ReqDate = x.ReqDate,
                        ExpirationDate = x.ExpirationDate,
                        Reorder = x.Reorder,
                        Note = x.Note,
                        VendorPONo = x.VendorPONo,
                        OpenItemsCount = x.OpenItemsCount,
                        StoreName = x.StoreName,
                        User = x.User,
                        Supplier = x.Supplier,
                        Supplier_No = x.Supplier_No,
                        POStatus = x.POStatus,
                        EmailAddress = x.EmailAddress,
                        Sent = x.Sent,
                        ClassID = x.ClassID,
                        MinMarkup = x.MinMarkup,
                        ListPrice = x.ListPrice,
                        Import = x.Import,
                        Approved = x.Approved,
                        StoreNo = x.StoreNo,
                        Status = x.Status
                    })
                    .AsQueryable();

                if (paginationGridDto.StoreId.HasValue)
                {
                    query = query.Where(x => x.StoreNo == paginationGridDto.StoreId.Value);
                }

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);
                var filteredQuery = query;

                int totalRecords;
                if (paginationGridDto.StoreId.HasValue)
                {
                    totalRecords = _dbContext.PurchaseOrdersViews.Count(x => x.StoreNo == paginationGridDto.StoreId.Value);
                }
                else
                {
                    totalRecords = _dbContext.PurchaseOrdersViews.Count();
                }
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "PurchaseOrderDate", paginationGridDto.SortDirection ?? "desc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<PurchaseOrderGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Purchase orders fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<PurchaseOrderGridDto>>(
                    "Error fetching purchase orders.", new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<PurchaseOrderDetailDto>> GetPurchaseOrderByIdAsync(Guid id)
        {
            try
            {
                var po = await _dbContext.PurchaseOrders
                    .Include(p => p.PurchaseOrderEntries)
                    .FirstOrDefaultAsync(p => p.PurchaseOrderId == id && p.Status != -1);

                if (po == null)
                    return ApiResponseFactory.NotFound<PurchaseOrderDetailDto>("Purchase order not found.");

                var supplier = await _dbContext.Suppliers
                    .Where(s => s.SupplierID == po.SupplierNo)
                    .Select(s => new { s.Name })
                    .FirstOrDefaultAsync();

                var store = po.StoreNo.HasValue
                    ? await _dbContext.Stores.Where(s => s.StoreID == po.StoreNo).Select(s => new { s.StoreName }).FirstOrDefaultAsync()
                    : null;

                var itemIds = po.PurchaseOrderEntries.Where(e => e.ItemNo.HasValue && e.Status != -1).Select(e => e.ItemNo!.Value).ToList();
                var items = await _dbContext.Items.Where(i => itemIds.Contains(i.ItemID)).Select(i => new { i.ItemID, i.Description1, i.ItemNo }).ToListAsync();

                var dto = new PurchaseOrderDetailDto
                {
                    PurchaseOrderId = po.PurchaseOrderId, SupplierNo = po.SupplierNo, SupplierName = supplier?.Name,
                    StoreNo = po.StoreNo, StoreName = store?.StoreName, PoNo = po.PoNo,
                    PersonOrderdId = po.PersonOrderdId, GrandTotal = po.GrandTotal,
                    ShipVia = po.ShipVia, ShipTo = po.ShipTo, TrackNo = po.TrackNo, TermsNo = po.TermsNo,
                    PurchaseOrderDate = po.PurchaseOrderDate, ReqDate = po.ReqDate, ExpirationDate = po.ExpirationDate,
                    Shipdrop = po.Shipdrop, POStatus = po.POStatus, Note = po.Note, Reorder = po.Reorder,
                    Status = po.Status, TermsID = po.TermsID, BuyerID = po.BuyerID, BillToStoreID = po.BillToStoreID,
                    VendorPONo = po.VendorPONo, DepartmentID = po.DepartmentID, SeasonID = po.SeasonID,
                    ClassID = po.ClassID, MinMarkup = po.MinMarkup, ListPrice = po.ListPrice, Import = po.Import,
                    Sent = po.Sent, Approved = po.Approved, DateCreated = po.DateCreated, DateModified = po.DateModified,
                    Entries = po.PurchaseOrderEntries.Where(e => e.Status != -1).OrderBy(e => e.SortOrder)
                        .Select(e => new PurchaseOrderEntryDto
                        {
                            PurchaseOrderEntryId = e.PurchaseOrderEntryId, ItemNo = e.ItemNo,
                            ItemName = items.FirstOrDefault(i => i.ItemID == e.ItemNo)?.Description1,
                            ItemNumber = items.FirstOrDefault(i => i.ItemID == e.ItemNo)?.ItemNo,
                            QtyOrdered = e.QtyOrdered, PricePerUnit = e.PricePerUnit,
                            UOMQty = e.UOMQty, UOMType = e.UOMType, ExtPrice = e.ExtPrice,
                            IsSpecialPrice = e.IsSpecialPrice, Note = e.Note, SortOrder = e.SortOrder,
                            CostBeforeDis = e.CostBeforeDis, EstimateCost = e.EstimateCost,
                            NetCost = e.NetCost, SpecialCost = e.SpecialCost,
                            Discount = e.Discount, DiscountType = e.DiscountType
                        }).ToList()
                };

                return ApiResponseFactory.Success(dto, "Purchase order fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PurchaseOrderDetailDto>("Error fetching purchase order.", new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<PurchaseOrderDetailDto>> CreatePurchaseOrderAsync(CreatePurchaseOrderDto dto, Guid creatorId)
        {
            try
            {
                var po = new PurchaseOrder
                {
                    PurchaseOrderId = Guid.NewGuid(), SupplierNo = dto.SupplierNo, StoreNo = dto.StoreNo,
                    PoNo = dto.PoNo, PersonOrderdId = dto.PersonOrderdId ?? creatorId,
                    ShipVia = dto.ShipVia, ShipTo = dto.ShipTo, TrackNo = dto.TrackNo, TermsNo = dto.TermsNo,
                    PurchaseOrderDate = dto.PurchaseOrderDate ?? DateTime.UtcNow,
                    ReqDate = dto.ReqDate, ExpirationDate = dto.ExpirationDate,
                    Shipdrop = dto.Shipdrop, POStatus = dto.POStatus ?? 0, Note = dto.Note,
                    Reorder = dto.Reorder ?? false, Status = 1,
                    DateCreated = DateTime.UtcNow, UserCreated = creatorId,
                    TermsID = dto.TermsID, BuyerID = dto.BuyerID, BillToStoreID = dto.BillToStoreID,
                    VendorPONo = dto.VendorPONo, DepartmentID = dto.DepartmentID,
                    SeasonID = dto.SeasonID, ClassID = dto.ClassID,
                    MinMarkup = dto.MinMarkup, ListPrice = dto.ListPrice, Import = dto.Import,
                    Sent = false, Approved = false
                };

                decimal grandTotal = 0;
                if (dto.Entries != null && dto.Entries.Any())
                {
                    int sortOrder = 1;
                    foreach (var entry in dto.Entries)
                    {
                        var poEntry = new PurchaseOrderEntry
                        {
                            PurchaseOrderEntryId = Guid.NewGuid(), PurchaseOrderNo = po.PurchaseOrderId,
                            ItemNo = entry.ItemNo, QtyOrdered = entry.QtyOrdered, PricePerUnit = entry.PricePerUnit,
                            UOMQty = entry.UOMQty, UOMType = entry.UOMType,
                            ExtPrice = entry.ExtPrice ?? (entry.QtyOrdered ?? 0) * (entry.PricePerUnit ?? 0),
                            IsSpecialPrice = entry.IsSpecialPrice, Note = entry.Note,
                            SortOrder = entry.SortOrder ?? sortOrder++, Status = 1,
                            DateCreated = DateTime.UtcNow, UserCreated = creatorId,
                            CostBeforeDis = entry.CostBeforeDis, EstimateCost = entry.EstimateCost,
                            NetCost = entry.NetCost, SpecialCost = entry.SpecialCost,
                            Discount = entry.Discount, DiscountType = entry.DiscountType
                        };
                        grandTotal += poEntry.ExtPrice ?? 0;
                        po.PurchaseOrderEntries.Add(poEntry);
                    }
                }
                po.GrandTotal = grandTotal;

                _dbContext.PurchaseOrders.Add(po);
                await _dbContext.SaveChangesAsync();
                return await GetPurchaseOrderByIdAsync(po.PurchaseOrderId);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PurchaseOrderDetailDto>("Error creating purchase order.", new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<PurchaseOrderDetailDto>> UpdatePurchaseOrderAsync(Guid id, UpdatePurchaseOrderDto dto, Guid modifierId)
        {
            try
            {
                var po = await _dbContext.PurchaseOrders.Include(p => p.PurchaseOrderEntries)
                    .FirstOrDefaultAsync(p => p.PurchaseOrderId == id && p.Status != -1);

                if (po == null)
                    return ApiResponseFactory.NotFound<PurchaseOrderDetailDto>("Purchase order not found.");

                po.SupplierNo = dto.SupplierNo; po.StoreNo = dto.StoreNo; po.PoNo = dto.PoNo;
                po.PersonOrderdId = dto.PersonOrderdId; po.ShipVia = dto.ShipVia; po.ShipTo = dto.ShipTo;
                po.TrackNo = dto.TrackNo; po.TermsNo = dto.TermsNo;
                po.PurchaseOrderDate = dto.PurchaseOrderDate; po.ReqDate = dto.ReqDate;
                po.ExpirationDate = dto.ExpirationDate; po.Shipdrop = dto.Shipdrop;
                po.POStatus = dto.POStatus; po.Note = dto.Note; po.Reorder = dto.Reorder;
                po.TermsID = dto.TermsID; po.BuyerID = dto.BuyerID; po.BillToStoreID = dto.BillToStoreID;
                po.VendorPONo = dto.VendorPONo; po.DepartmentID = dto.DepartmentID;
                po.SeasonID = dto.SeasonID; po.ClassID = dto.ClassID;
                po.MinMarkup = dto.MinMarkup; po.ListPrice = dto.ListPrice; po.Import = dto.Import;
                po.DateModified = DateTime.UtcNow; po.UserModified = modifierId;

                foreach (var existingEntry in po.PurchaseOrderEntries)
                {
                    existingEntry.Status = -1;
                    existingEntry.DateModified = DateTime.UtcNow;
                    existingEntry.UserModified = modifierId;
                }

                decimal grandTotal = 0;
                if (dto.Entries != null && dto.Entries.Any())
                {
                    int sortOrder = 1;
                    foreach (var entry in dto.Entries)
                    {
                        var poEntry = new PurchaseOrderEntry
                        {
                            PurchaseOrderEntryId = Guid.NewGuid(), PurchaseOrderNo = po.PurchaseOrderId,
                            ItemNo = entry.ItemNo, QtyOrdered = entry.QtyOrdered, PricePerUnit = entry.PricePerUnit,
                            UOMQty = entry.UOMQty, UOMType = entry.UOMType,
                            ExtPrice = entry.ExtPrice ?? (entry.QtyOrdered ?? 0) * (entry.PricePerUnit ?? 0),
                            IsSpecialPrice = entry.IsSpecialPrice, Note = entry.Note,
                            SortOrder = entry.SortOrder ?? sortOrder++, Status = 1,
                            DateCreated = DateTime.UtcNow, UserCreated = modifierId,
                            CostBeforeDis = entry.CostBeforeDis, EstimateCost = entry.EstimateCost,
                            NetCost = entry.NetCost, SpecialCost = entry.SpecialCost,
                            Discount = entry.Discount, DiscountType = entry.DiscountType
                        };
                        grandTotal += poEntry.ExtPrice ?? 0;
                        po.PurchaseOrderEntries.Add(poEntry);
                    }
                }
                po.GrandTotal = grandTotal;

                await _dbContext.SaveChangesAsync();
                return await GetPurchaseOrderByIdAsync(po.PurchaseOrderId);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PurchaseOrderDetailDto>("Error updating purchase order.", new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> DeletePurchaseOrderAsync(Guid id, Guid modifierId)
        {
            try
            {
                var po = await _dbContext.PurchaseOrders.FirstOrDefaultAsync(p => p.PurchaseOrderId == id && p.Status != -1);
                if (po == null)
                    return ApiResponseFactory.NotFound<bool>("Purchase order not found.");

                po.Status = -1; po.DateModified = DateTime.UtcNow; po.UserModified = modifierId;
                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Purchase order deleted successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>("Error deleting purchase order.", new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> ApprovePurchaseOrderAsync(Guid id, Guid modifierId)
        {
            try
            {
                var po = await _dbContext.PurchaseOrders.FirstOrDefaultAsync(p => p.PurchaseOrderId == id && p.Status != -1);
                if (po == null)
                    return ApiResponseFactory.NotFound<bool>("Purchase order not found.");

                po.Approved = true; po.POStatus = 1; po.DateModified = DateTime.UtcNow; po.UserModified = modifierId;
                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Purchase order approved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>("Error approving purchase order.", new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> SendPurchaseOrderAsync(Guid id, Guid modifierId)
        {
            try
            {
                var po = await _dbContext.PurchaseOrders.FirstOrDefaultAsync(p => p.PurchaseOrderId == id && p.Status != -1);
                if (po == null)
                    return ApiResponseFactory.NotFound<bool>("Purchase order not found.");

                po.Sent = true; po.POStatus = 2; po.DateModified = DateTime.UtcNow; po.UserModified = modifierId;
                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, "Purchase order marked as sent.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>("Error sending purchase order.", new List<string> { ex.Message });
            }
        }
    }
}
