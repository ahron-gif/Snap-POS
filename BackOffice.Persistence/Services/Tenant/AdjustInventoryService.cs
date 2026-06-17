using AutoMapper;
using BackOffice.Application.DTOs.Tenant.AdjustInventory;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Tenant
{
    public class AdjustInventoryService : IAdjustInventoryService
    {
        private readonly IUnitOfWorkTenant _unitOfWork;
        private readonly IMapper _mapper;
        private readonly TenantDBContext _dbContext;

        public AdjustInventoryService(IUnitOfWorkTenant unitOfWork, IMapper mapper, TenantDBContext dbContext)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
            _dbContext = dbContext;
        }

        public async Task<ApiResponse<GetItemsForAdjustResponseDto>> GetItemsForAdjustAsync(GetItemsForAdjustRequestDto request)
        {
            try
            {
                var spResults = await _dbContext.Procedures.SP_GetItemsForAdjustAsync(
                    request.CountedOnly,
                    request.DiscrepancyOnly,
                    request.StoreId,
                    request.ClearCount,
                    request.ReverseQty);

                // Map SP results to DTOs
                var allItems = spResults.Select(r => new AdjustInventoryItemDto
                {
                    ItemID = r.ItemID,
                    CustomerCode = r.CustomerCode,
                    ItemStoreID = r.ItemStoreID,
                    Price = r.Price,
                    Cost = r.Cost,
                    Name = r.Name,
                    BarcodeNumber = r.BarcodeNumber,
                    ModalNumber = r.ModalNumber,
                    CurrentOnHand = r.CurrentOnHand,
                    OnHand = r.OnHand,
                    CountDate = r.CountDate,
                    LastCount = r.LastCount,
                    Department = r.Department
                }).ToList();

                // Apply search filter if provided
                if (!string.IsNullOrWhiteSpace(request.SearchText))
                {
                    var search = request.SearchText.Trim().ToLower();
                    allItems = allItems.Where(i =>
                        (i.Name != null && i.Name.ToLower().Contains(search)) ||
                        (i.BarcodeNumber != null && i.BarcodeNumber.ToLower().Contains(search)) ||
                        (i.ModalNumber != null && i.ModalNumber.ToLower().Contains(search)) ||
                        (i.CustomerCode != null && i.CustomerCode.ToLower().Contains(search)) ||
                        (i.Department != null && i.Department.ToLower().Contains(search))
                    ).ToList();
                }

                var totalCount = allItems.Count;
                var totalPages = (int)Math.Ceiling((double)totalCount / request.PageSize);

                // Apply pagination
                var pagedItems = allItems
                    .Skip((request.PageNumber - 1) * request.PageSize)
                    .Take(request.PageSize)
                    .ToList();

                var response = new GetItemsForAdjustResponseDto
                {
                    Items = pagedItems,
                    TotalCount = totalCount,
                    PageNumber = request.PageNumber,
                    PageSize = request.PageSize,
                    TotalPages = totalPages
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<GetItemsForAdjustResponseDto>(
                    $"Error loading items for adjust: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> SaveAdjustmentsAsync(SaveAdjustmentsRequestDto request, Guid userId)
        {
            try
            {
                if (request.Adjustments == null || !request.Adjustments.Any())
                {
                    return ApiResponseFactory.BadRequest<bool>("No adjustments to save.");
                }

                foreach (var adj in request.Adjustments)
                {
                    await _dbContext.Procedures.SP_AdjustInventoryInsertAsync(
                        adjustInventoryId: Guid.NewGuid(),
                        itemStoreNo: adj.ItemStoreNo,
                        qty: adj.Qty,
                        oldQty: adj.OldQty,
                        adjustType: adj.AdjustType,
                        adjustReason: adj.AdjustReason,
                        accountNo: adj.AccountNo,
                        cost: adj.Cost,
                        status: 1,
                        adjustDate: DateTime.UtcNow,
                        modifierID: userId);
                }

                // Update OnHand quantities across all items
                if (request.UpdateOnHand)
                {
                    await _dbContext.Procedures.UpdateOnlyOnhandAsync();
                }

                return ApiResponseFactory.Success(true, "Adjustments saved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error saving adjustments: {ex.Message}");
            }
        }

        public async Task<ApiResponse<bool>> ResetPhysicalCountAsync(Guid storeId)
        {
            try
            {
                await _dbContext.Procedures.SP_GetItemsForAdjustAsync(
                    countedOnly: false,
                    discrepancyOnly: false,
                    storeID: storeId,
                    clearCount: true,
                    reverseQty: false);

                return ApiResponseFactory.Success(true, "Physical count reset successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    $"Error resetting physical count: {ex.Message}");
            }
        }

        public async Task<ApiResponse<QuickReportResponseDto>> GetQuickReportAsync(QuickReportRequestDto request)
        {
            try
            {
                // Create an empty DataTable for the stores parameter (Guid_list_tbltype)
                var storesTable = new DataTable();
                storesTable.Columns.Add("Value", typeof(Guid));

                var endDate = request.EndDate.Date.AddDays(1); // Add 1 day to include the full end date

                var spResults = await _dbContext.Procedures.SP_GetQuickReportAsync(
                    itemStoreID: request.ItemStoreID,
                    startDate: request.StartDate,
                    endDate: endDate,
                    itemID: request.ItemID,
                    stores: storesTable);

                // The single-store branch of SP_GetQuickReport doesn't return the
                // store name, so resolve it once for this ItemStore (all rows share
                // the same store). No SP change needed.
                var storeName = await _dbContext.NewItemMainAndStoreGrids
                    .Where(g => g.ItemStoreID == request.ItemStoreID)
                    .Select(g => g.StoreName)
                    .FirstOrDefaultAsync();

                // Opening on-hand = balance AS OF the start date (the point the
                // running count starts from). Reuses the existing legacy SP.
                var openingOnHand = await GetItemOnHandByDateAsync(request.ItemStoreID, request.StartDate);

                // Map + order chronologically so the running balance reads top-down.
                var items = spResults
                    .Select(r => new QuickReportItemDto
                    {
                        ID = r.ID,
                        Type = r.Type,
                        Date = r.Date,
                        Qty = r.Qty,
                        // Case rows carry their quantity in Cs Qty; piece rows in Qty.
                        CsQty = string.Equals(r.UOM, "Case", StringComparison.OrdinalIgnoreCase) ? r.Qty : (decimal?)null,
                        UOM = r.UOM,
                        User = r.Usr,
                        StoreName = storeName
                    })
                    .OrderBy(i => i.Date ?? DateTime.MinValue)
                    .ToList();

                // Running on-hand balance: start at the opening balance and apply
                // each movement in chronological order. The last row == closing.
                var running = openingOnHand;
                foreach (var item in items)
                {
                    running += item.Qty ?? 0m;
                    item.RunningBalance = running;
                }

                var total = items.Where(i => i.Qty.HasValue).Sum(i => i.Qty!.Value);
                var closingOnHand = openingOnHand + total;

                var response = new QuickReportResponseDto
                {
                    Items = items,
                    OpeningOnHand = openingOnHand,
                    ClosingOnHand = closingOnHand,
                    Total = total,
                    OnHand = openingOnHand // back-compat alias
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<QuickReportResponseDto>(
                    $"Error loading quick report: {ex.Message}");
            }
        }

        /// <summary>
        /// On-hand quantity for an ItemStore AS OF a date, via the existing legacy
        /// scalar SP (SP_GetItemOnHandByDate) — the same one the desktop back office
        /// uses. Called through ADO.NET because the SP returns an unnamed scalar
        /// (its EF-scaffolded result type has no columns). No SP change required.
        /// </summary>
        private async Task<decimal> GetItemOnHandByDateAsync(Guid itemStoreId, DateTime upToDate)
        {
            var conn = _dbContext.Database.GetDbConnection();
            var shouldClose = conn.State != ConnectionState.Open;
            if (shouldClose) await conn.OpenAsync();
            try
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "dbo.SP_GetItemOnHandByDate";
                cmd.CommandType = CommandType.StoredProcedure;

                // NOTE: the legacy SP names this parameter @ItemID but it actually
                // expects the ItemStoreID (matches the desktop's GetItemOnHandByDate).
                var pItem = cmd.CreateParameter();
                pItem.ParameterName = "@ItemID";
                pItem.Value = itemStoreId;
                cmd.Parameters.Add(pItem);

                var pDate = cmd.CreateParameter();
                pDate.ParameterName = "@UpToDate";
                pDate.Value = upToDate;
                cmd.Parameters.Add(pDate);

                var result = await cmd.ExecuteScalarAsync();
                return (result == null || result == DBNull.Value) ? 0m : Convert.ToDecimal(result);
            }
            catch
            {
                // Non-fatal: fall back to 0 so the report still renders.
                return 0m;
            }
            finally
            {
                if (shouldClose) await conn.CloseAsync();
            }
        }

        public async Task<ApiResponse<InventoryByStoreResponseDto>> GetInventoryByStoreAsync(Guid itemId)
        {
            try
            {
                var items = await _dbContext.NewItemMainAndStoreGrids
                    .Where(i => i.ItemID == itemId)
                    .Select(i => new InventoryByStoreItemDto
                    {
                        StoreName = i.StoreName,
                        OnHand = i.OnHand,
                        OnOrder = i.OnOrder,
                        OnTransfer = i.OnTransferOrder
                    })
                    .OrderBy(i => i.StoreName)
                    .ToListAsync();

                var response = new InventoryByStoreResponseDto
                {
                    Items = items
                };

                return ApiResponseFactory.Success(response);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<InventoryByStoreResponseDto>(
                    $"Error loading inventory by store: {ex.Message}");
            }
        }
    }
}
