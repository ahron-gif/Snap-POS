using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Supplier;
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
    public class SupplierService : ISupplierService
    {
        private readonly TenantDBContext _dbContext;

        public SupplierService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        public ApiResponse<List<SupplierLookupDto>> GetSuppliersLookupAsync()
        {
            try
            {
                var suppliers = _dbContext.Suppliers
                    .Where(x => x.Status == null || x.Status != 2)
                    .OrderBy(x => x.Name)
                    .Select(x => new SupplierLookupDto
                    {
                        SupplierID = x.SupplierID,
                        SupplierNo = x.SupplierNo,
                        Name = x.Name ?? ""
                    })
                    .ToList();

                return ApiResponseFactory.Success(suppliers, "Supplier lookup data fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<SupplierLookupDto>>(
                    "Error fetching supplier lookup data.",
                    new List<string> { ex.Message });
            }
        }

        public ApiResponse<PaginationResponseDTO<SupplierGridDto>> GetAllSuppliersGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.SupplierViews
                    .Where(x => x.Status != 2) // Exclude deleted suppliers
                    .Select(x => new SupplierGridDto
                    {
                        SupplierID = x.SupplierID,
                        SupplierNo = x.SupplierNo,
                        Name = x.Name,
                        DefaultCredit = x.DefaultCredit,
                        WebSite = x.WebSite,
                        EmailAddress = x.EmailAddress,
                        MainAddress = x.MainAddress,
                        ContactName = x.ContactName,
                        BarterID = x.BarterID,
                        WarehouseID = x.WarehouseID,
                        Status = x.Status,
                        DateCreated = x.DateCreated,
                        UserCreated = x.UserCreated,
                        DateModified = x.DateModified,
                        UserModified = x.UserModified,
                        AccountNo = x.AccountNo,
                        Note = x.Note,
                        Address1 = x.Address1,
                        Address2 = x.Address2,
                        City = x.City,
                        State = x.State,
                        Zip = x.Zip,
                        PhoneNumber1 = x.PhoneNumber1,
                        Ext1 = x.Ext1,
                        PhoneNumber2 = x.PhoneNumber2,
                        PhoneNumber3 = x.PhoneNumber3,
                        MinMarkup = x.MinMarkup,
                        BuyerID = x.BuyerID,
                        ListPrice = x.ListPrice,
                        Department = x.Department,
                        Import = x.Import,
                        SupplierNote = x.SupplierNote
                    })
                    .AsQueryable();

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = _dbContext.SupplierViews.Where(x => x.Status != 2).Count();
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "Name", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<SupplierGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Suppliers retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<SupplierGridDto>>(
                    "Error fetching suppliers.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<SupplierGridDto>> GetSupplierByIdAsync(Guid supplierId)
        {
            try
            {
                var supplier = await _dbContext.SupplierViews
                    .Where(x => x.SupplierID == supplierId && x.Status != 2)
                    .Select(x => new SupplierGridDto
                    {
                        SupplierID = x.SupplierID,
                        SupplierNo = x.SupplierNo,
                        Name = x.Name,
                        DefaultCredit = x.DefaultCredit,
                        WebSite = x.WebSite,
                        EmailAddress = x.EmailAddress,
                        MainAddress = x.MainAddress,
                        ContactName = x.ContactName,
                        BarterID = x.BarterID,
                        WarehouseID = x.WarehouseID,
                        Status = x.Status,
                        DateCreated = x.DateCreated,
                        UserCreated = x.UserCreated,
                        DateModified = x.DateModified,
                        UserModified = x.UserModified,
                        AccountNo = x.AccountNo,
                        Note = x.Note,
                        Address1 = x.Address1,
                        Address2 = x.Address2,
                        City = x.City,
                        State = x.State,
                        Zip = x.Zip,
                        PhoneNumber1 = x.PhoneNumber1,
                        Ext1 = x.Ext1,
                        PhoneNumber2 = x.PhoneNumber2,
                        PhoneNumber3 = x.PhoneNumber3,
                        MinMarkup = x.MinMarkup,
                        BuyerID = x.BuyerID,
                        ListPrice = x.ListPrice,
                        Department = x.Department,
                        Import = x.Import,
                        SupplierNote = x.SupplierNote
                    })
                    .FirstOrDefaultAsync();

                if (supplier == null)
                {
                    return ApiResponseFactory.NotFound<SupplierGridDto>("Supplier not found.");
                }

                return ApiResponseFactory.Success(supplier, "Supplier retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<SupplierGridDto>(
                    "Error fetching supplier.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> ToggleSupplierStatusAsync(Guid supplierId, Guid modifierId)
        {
            try
            {
                var supplier = await _dbContext.Suppliers.FirstOrDefaultAsync(x => x.SupplierID == supplierId);
                if (supplier == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Supplier not found.");
                }

                // Toggle between active (0) and inactive (1)
                supplier.Status = supplier.Status == 0 ? (short)1 : (short)0;
                supplier.DateModified = DateTime.UtcNow;
                supplier.UserModified = modifierId;

                await _dbContext.SaveChangesAsync();

                var statusText = supplier.Status == 0 ? "active" : "inactive";
                return ApiResponseFactory.Success(true, $"Supplier marked as {statusText} successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error toggling supplier status.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> DeleteSupplierAsync(Guid supplierId, Guid modifierId)
        {
            try
            {
                var supplier = await _dbContext.Suppliers.FirstOrDefaultAsync(x => x.SupplierID == supplierId);
                if (supplier == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Supplier not found.");
                }

                // Soft delete by setting status to 2
                supplier.Status = 2;
                supplier.DateModified = DateTime.UtcNow;
                supplier.UserModified = modifierId;

                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Supplier deleted successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error deleting supplier.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<Guid>> CreateSupplierAsync(CreateSupplierDto dto, Guid creatorId)
        {
            try
            {
                var supplier = new Supplier
                {
                    SupplierID = Guid.NewGuid(),
                    SupplierNo = dto.SupplierNo,
                    Name = dto.Name,
                    DefaultCredit = dto.DefaultCredit,
                    WebSite = dto.WebSite,
                    EmailAddress = dto.EmailAddress,
                    ContactName = dto.ContactName,
                    BarterID = dto.BarterID,
                    WarehouseID = dto.WarehouseID,
                    AccountNo = dto.AccountNo,
                    Note = dto.Note,
                    MinMarkup = dto.MinMarkup,
                    BuyerID = dto.BuyerID,
                    ListPrice = dto.ListPrice,
                    Department = dto.Department,
                    Import = dto.Import,
                    Status = 0,
                    DateCreated = DateTime.UtcNow,
                    UserCreated = creatorId
                };

                _dbContext.Suppliers.Add(supplier);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(supplier.SupplierID, "Supplier created successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<Guid>(
                    "Error creating supplier.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> UpdateSupplierAsync(Guid supplierId, UpdateSupplierDto dto, Guid modifierId)
        {
            try
            {
                var supplier = await _dbContext.Suppliers.FirstOrDefaultAsync(x => x.SupplierID == supplierId);
                if (supplier == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Supplier not found.");
                }

                supplier.SupplierNo = dto.SupplierNo;
                supplier.Name = dto.Name;
                supplier.DefaultCredit = dto.DefaultCredit;
                supplier.WebSite = dto.WebSite;
                supplier.EmailAddress = dto.EmailAddress;
                supplier.ContactName = dto.ContactName;
                supplier.BarterID = dto.BarterID;
                supplier.WarehouseID = dto.WarehouseID;
                supplier.AccountNo = dto.AccountNo;
                supplier.Note = dto.Note;
                supplier.MinMarkup = dto.MinMarkup;
                supplier.BuyerID = dto.BuyerID;
                supplier.ListPrice = dto.ListPrice;
                supplier.Department = dto.Department;
                supplier.Import = dto.Import;
                supplier.DateModified = DateTime.UtcNow;
                supplier.UserModified = modifierId;

                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Supplier updated successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error updating supplier.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<List<SupplierNoteDto>>> GetSupplierNotesAsync(Guid supplierId)
        {
            try
            {
                var notes = await _dbContext.SupplierNotesViews
                    .Where(x => x.SupplierID == supplierId && x.Status != 2)
                    .Select(x => new SupplierNoteDto
                    {
                        NoteID = x.NoteID,
                        SupplierID = x.SupplierID,
                        TypeOfNote = x.TypeOfNote,
                        NoteValue = x.NoteValue,
                        Status = x.Status,
                        DateCreated = x.DateCreated,
                        UserCreated = x.UserCreated,
                        DateModified = x.DateModified,
                        UserModified = x.UserModified
                    })
                    .OrderByDescending(x => x.DateCreated)
                    .ToListAsync();

                return ApiResponseFactory.Success(notes, "Supplier notes retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<SupplierNoteDto>>(
                    "Error fetching supplier notes.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<Guid>> AddSupplierNoteAsync(Guid supplierId, CreateSupplierNoteDto dto, Guid creatorId)
        {
            try
            {
                var note = new SupplierNote
                {
                    NoteID = Guid.NewGuid(),
                    SupplierID = supplierId,
                    TypeOfNote = dto.TypeOfNote,
                    NoteValue = dto.NoteValue,
                    Status = 0,
                    DateCreated = DateTime.UtcNow,
                    UserCreated = creatorId
                };

                _dbContext.SupplierNotes.Add(note);
                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(note.NoteID, "Note added successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<Guid>(
                    "Error adding supplier note.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> DeleteSupplierNoteAsync(Guid supplierId, Guid noteId, Guid modifierId)
        {
            try
            {
                var note = await _dbContext.SupplierNotes
                    .FirstOrDefaultAsync(x => x.NoteID == noteId && x.SupplierID == supplierId);

                if (note == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Note not found.");
                }

                // Soft delete
                note.Status = 2;
                note.DateModified = DateTime.UtcNow;
                note.UserModified = modifierId;

                await _dbContext.SaveChangesAsync();

                return ApiResponseFactory.Success(true, "Note deleted successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error deleting supplier note.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<List<SupplierItemDto>>> GetSupplierItemsAsync(Guid supplierId, bool includeInactive = false)
        {
            try
            {
                var query = _dbContext.ItemListForSupplierViews
                    .Where(x => x.SupplierNo == supplierId);

                if (!includeInactive)
                {
                    query = query.Where(x => x.Status == 0);
                }

                var items = await query
                    .Select(x => new SupplierItemDto
                    {
                        ItemID = x.ItemID,
                        Name = x.Name,
                        UPC = x.UPC,
                        Cost = x.Cost,
                        MinQty = x.Min_Qty,
                        MainSupplier = x.Main_Supplier,
                        Status = x.Status
                    })
                    .OrderBy(x => x.Name)
                    .ToListAsync();

                return ApiResponseFactory.Success(items, "Supplier items retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<SupplierItemDto>>(
                    "Error fetching supplier items.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<SupplierHistoryDto>> GetSupplierHistoryAsync(Guid supplierId)
        {
            try
            {
                // This would typically calculate from purchase orders, receipts, and payment tables
                // For now, returning placeholder data - actual implementation would require
                // joining with PO, Receipt, and Payment tables
                var history = new SupplierHistoryDto
                {
                    OpenPO = 0,
                    LastReceive = null,
                    OpenBalance = 0,
                    MTD = 0,
                    PTD = 0,
                    YTD = 0
                };

                return ApiResponseFactory.Success(history, "Supplier history retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<SupplierHistoryDto>(
                    "Error fetching supplier history.",
                    new List<string> { ex.Message });
            }
        }
    }
}
