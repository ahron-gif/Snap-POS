using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Lookup;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Tenant
{
    public class SystemLookupService : ISystemLookupService
    {
        private readonly TenantDBContext _dbContext;

        // Table names for system lookup (matching legacy VB.NET SystemTablesDataSet)
        private const string TABLE_ITEM_TYPE = "ItemType";
        private const string TABLE_BARCODE_TYPE = "BarcodeType";
        private const string TABLE_UOM_TYPE = "UOMType";
        private const string TABLE_MEASURE = "Measure";
        private const string TABLE_ADJUST_TYPE = "AdjustType";
        private const string TABLE_CUSTOMER_TYPE = "CustomerType";
        private const string TABLE_PRICES = "Prices";

        public SystemLookupService(TenantDBContext dbContext)
        {
            _dbContext = dbContext;
        }

        /// <summary>
        /// Get all item types for dropdown using SP_GetSystemTable stored procedure
        /// </summary>
        public async Task<ApiResponse<List<ItemTypeLookupDto>>> GetItemTypesAsync()
        {
            try
            {
                var results = await _dbContext.Procedures.SP_GetSystemTableAsync(
                    tableName: TABLE_ITEM_TYPE,
                    language: false // English
                );

                var itemTypes = results
                    .OrderBy(x => x.SortOrder ?? x.SystemValueNo)
                    .Select(x => new ItemTypeLookupDto
                    {
                        Value = x.SystemValueNo,
                        Label = x.SystemValueName ?? string.Empty,
                        SortOrder = x.SortOrder
                    })
                    .ToList();

                return new ApiResponse<List<ItemTypeLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Item types retrieved successfully",
                    Response = itemTypes
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<ItemTypeLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching item types: {ex.Message}",
                    Response = new List<ItemTypeLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get all barcode types for dropdown using SP_GetSystemTable stored procedure
        /// </summary>
        public async Task<ApiResponse<List<BarcodeTypeLookupDto>>> GetBarcodeTypesAsync()
        {
            try
            {
                var results = await _dbContext.Procedures.SP_GetSystemTableAsync(
                    tableName: TABLE_BARCODE_TYPE,
                    language: false // English
                );

                var barcodeTypes = results
                    .OrderBy(x => x.SortOrder ?? x.SystemValueNo)
                    .Select(x => new BarcodeTypeLookupDto
                    {
                        Value = x.SystemValueNo,
                        Label = x.SystemValueName ?? string.Empty,
                        SortOrder = x.SortOrder
                    })
                    .ToList();

                return new ApiResponse<List<BarcodeTypeLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Barcode types retrieved successfully",
                    Response = barcodeTypes
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<BarcodeTypeLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching barcode types: {ex.Message}",
                    Response = new List<BarcodeTypeLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get all UOM types for dropdown using SP_GetSystemTable stored procedure
        /// </summary>
        public async Task<ApiResponse<List<UOMTypeLookupDto>>> GetUOMTypesAsync()
        {
            try
            {
                var results = await _dbContext.Procedures.SP_GetSystemTableAsync(
                    tableName: TABLE_UOM_TYPE,
                    language: false // English
                );

                var uomTypes = results
                    .OrderBy(x => x.SortOrder ?? x.SystemValueNo)
                    .Select(x => new UOMTypeLookupDto
                    {
                        Value = x.SystemValueNo,
                        Label = x.SystemValueName ?? string.Empty,
                        SortOrder = x.SortOrder
                    })
                    .ToList();

                return new ApiResponse<List<UOMTypeLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "UOM types retrieved successfully",
                    Response = uomTypes
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<UOMTypeLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching UOM types: {ex.Message}",
                    Response = new List<UOMTypeLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get all measure types for dropdown using SP_GetSystemTable stored procedure
        /// </summary>
        public async Task<ApiResponse<List<MeasureLookupDto>>> GetMeasureTypesAsync()
        {
            try
            {
                var results = await _dbContext.Procedures.SP_GetSystemTableAsync(
                    tableName: TABLE_MEASURE,
                    language: false // English
                );

                var measureTypes = results
                    .OrderBy(x => x.SortOrder ?? x.SystemValueNo)
                    .Select(x => new MeasureLookupDto
                    {
                        Value = x.SystemValueNo,
                        Label = x.SystemValueName ?? string.Empty,
                        SortOrder = x.SortOrder
                    })
                    .ToList();

                return new ApiResponse<List<MeasureLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Measure types retrieved successfully",
                    Response = measureTypes
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<MeasureLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching measure types: {ex.Message}",
                    Response = new List<MeasureLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get all departments for dropdown (hierarchical tree structure)
        /// Matches legacy VB.NET InitDepartment() which uses DepartmentStoreView
        /// </summary>
        public async Task<ApiResponse<List<DepartmentLookupDto>>> GetDepartmentsAsync()
        {
            try
            {
                var departments = await _dbContext.DepartmentStoreViews
                    .Where(x => x.Status != 2) // Exclude inactive/deleted
                    .OrderBy(x => x.Name)
                    .Select(x => new DepartmentLookupDto
                    {
                        DepartmentStoreID = x.DepartmentStoreID,
                        Name = x.Name ?? string.Empty,
                        ParentDepartmentID = x.ParentDepartmentID
                    })
                    .ToListAsync();

                return new ApiResponse<List<DepartmentLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Departments retrieved successfully",
                    Response = departments
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<DepartmentLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching departments: {ex.Message}",
                    Response = new List<DepartmentLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get all items lookup values by type for dropdowns
        /// ValueType: 0=Pattern, 1-10=CustomField1-10, 11=Manufacturer
        /// Matches legacy VB.NET DvPattern, DvCustomField1-10 DataViews
        /// </summary>
        public async Task<ApiResponse<List<ItemsLookupValueDto>>> GetItemsLookupValuesAsync(short? valueType = null)
        {
            try
            {
                var query = _dbContext.ItemsLookupValuesViews
                    .Where(x => x.Status != 2); // Exclude deleted

                if (valueType.HasValue)
                {
                    query = query.Where(x => x.ValueType == valueType.Value);
                }

                var lookupValues = await query
                    .OrderBy(x => x.ValueName)
                    .Select(x => new ItemsLookupValueDto
                    {
                        ValueID = x.ValueID,
                        ValueName = x.ValueName ?? string.Empty,
                        ValueType = x.ValueType
                    })
                    .ToListAsync();

                return new ApiResponse<List<ItemsLookupValueDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Items lookup values retrieved successfully",
                    Response = lookupValues
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<ItemsLookupValueDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching items lookup values: {ex.Message}",
                    Response = new List<ItemsLookupValueDto>()
                };
            }
        }

        /// <summary>
        /// Get all extra charge items for dropdown (Extra Charge 1, 2, 3)
        /// Uses SP_GetExtraChargeItems stored procedure
        /// Matches legacy VB.NET GetExtraChargeItems method
        /// </summary>
        public async Task<ApiResponse<List<ExtraChargeItemLookupDto>>> GetExtraChargeItemsAsync(Guid storeId)
        {
            try
            {
                var results = await _dbContext.Procedures.SP_GetExtraChargeItemsAsync(storeId);

                var extraChargeItems = results
                    .OrderBy(x => x.Name)
                    .Select(x => new ExtraChargeItemLookupDto
                    {
                        ItemStoreID = x.ItemStoreID,
                        Name = x.Name ?? string.Empty,
                        BarcodeNumber = x.BarcodeNumber ?? string.Empty,
                        Price = x.Price
                    })
                    .ToList();

                return new ApiResponse<List<ExtraChargeItemLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Extra charge items retrieved successfully",
                    Response = extraChargeItems
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<ExtraChargeItemLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching extra charge items: {ex.Message}",
                    Response = new List<ExtraChargeItemLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get all stores for dropdown (calls SP_GetStoresByWebUser, the Web-prefixed
        /// clone of SP_GetStoresByUser that reads from [WebUsersView] / [WebUsersStore]
        /// instead of the legacy [UsersView]).
        ///
        /// Executed via Database.SqlQueryRaw so we can target the new SP without
        /// editing the EF-generated TenantDBContextProcedures wrapper. The result
        /// shape (StoreID, StoreName) matches SP_GetStoresByUserResult, so that
        /// generated DTO is reused unchanged.
        /// </summary>
        public async Task<ApiResponse<List<StoreLookupDto>>> GetStoresByUserAsync(Guid userId, Guid? storeId = null)
        {
            try
            {
                var userIdParam  = new SqlParameter("@UserID",  userId);
                var storeIdParam = new SqlParameter("@StoreID",
                    storeId.HasValue ? (object)storeId.Value : DBNull.Value);

                var results = await _dbContext.Database
                    .SqlQueryRaw<SP_GetStoresByUserResult>(
                        "EXEC [dbo].[SP_GetStoresByWebUser] @UserID, @StoreID",
                        userIdParam, storeIdParam)
                    .ToListAsync();

                var stores = results
                    .OrderBy(x => x.StoreName)
                    .Select(x => new StoreLookupDto
                    {
                        StoreID = x.StoreID,
                        StoreName = x.StoreName ?? string.Empty
                    })
                    .ToList();

                return new ApiResponse<List<StoreLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Stores retrieved successfully",
                    Response = stores
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<StoreLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching stores: {ex.Message}",
                    Response = new List<StoreLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get all app items for App Button dropdown
        /// Uses SP_GetAppItems stored procedure
        /// </summary>
        public async Task<ApiResponse<List<AppItemLookupDto>>> GetAppItemsAsync()
        {
            try
            {
                var results = await _dbContext.Procedures.SP_GetAppItemsAsync();

                var appItems = results
                    .OrderBy(x => x.AppName)
                    .Select(x => new AppItemLookupDto
                    {
                        Id = x.Id,
                        AppName = x.AppName ?? string.Empty
                    })
                    .ToList();

                return new ApiResponse<List<AppItemLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "App items retrieved successfully",
                    Response = appItems
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<AppItemLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching app items: {ex.Message}",
                    Response = new List<AppItemLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get all tax rates for dropdown (Tax table: TaxID, TaxName)
        /// </summary>
        public async Task<ApiResponse<List<TaxLookupDto>>> GetTaxesAsync()
        {
            try
            {
                var taxes = await _dbContext.Set<Tax>()
                    .Where(t => t.Status != 2) // Exclude deleted
                    .OrderBy(t => t.TaxName)
                    .Select(t => new TaxLookupDto
                    {
                        TaxID = t.TaxID,
                        TaxName = t.TaxName ?? string.Empty
                    })
                    .ToListAsync();

                return new ApiResponse<List<TaxLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Taxes retrieved successfully",
                    Response = taxes
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<TaxLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching taxes: {ex.Message}",
                    Response = new List<TaxLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get phone notes by type for dropdown
        /// Used for Shift presets (Type=0), Driver Notes, etc.
        /// Query: SELECT * FROM PhoneNote WHERE Type = @type AND Status > -1
        /// </summary>
        public async Task<ApiResponse<List<PhoneNoteLookupDto>>> GetPhoneNotesByTypeAsync(short type)
        {
            try
            {
                var phoneNotes = await _dbContext.PhoneNotes
                    .Where(x => x.Type == type && x.Status > -1)
                    .OrderBy(x => x.Sort)
                    .ThenBy(x => x.Value)
                    .Select(x => new PhoneNoteLookupDto
                    {
                        PhoneNoteIDVal = x.PhoneNoteIDVal,
                        Value = x.Value ?? string.Empty,
                        Type = x.Type,
                        Sort = x.Sort
                    })
                    .ToListAsync();

                return new ApiResponse<List<PhoneNoteLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Phone notes retrieved successfully",
                    Response = phoneNotes
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<PhoneNoteLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching phone notes: {ex.Message}",
                    Response = new List<PhoneNoteLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get distinct zones (CCRT) from CustomerAddresses for dropdown
        /// Query: SELECT DISTINCT CCRT FROM CustomerAddresses WHERE CCRT IS NOT NULL AND CCRT <> ''
        /// </summary>
        public async Task<ApiResponse<List<ZoneLookupDto>>> GetZonesAsync()
        {
            try
            {
                var zones = await _dbContext.CustomerAddresses
                    .Where(x => x.CCRT != null && x.CCRT != "")
                    .Select(x => x.CCRT!)
                    .Distinct()
                    .OrderBy(x => x)
                    .Select(zone => new ZoneLookupDto
                    {
                        Zone = zone
                    })
                    .ToListAsync();

                return new ApiResponse<List<ZoneLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Zones retrieved successfully",
                    Response = zones
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<ZoneLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching zones: {ex.Message}",
                    Response = new List<ZoneLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get tenders for phone order dropdown
        /// Query: SELECT * FROM Tender WHERE ShowOnPhoneOrder = 1 AND Status > -1
        /// </summary>
        public async Task<ApiResponse<List<TenderLookupDto>>> GetTendersForPhoneOrderAsync()
        {
            try
            {
                var tenders = await _dbContext.Tenders
                    .Where(x => x.ShowOnPhoneOrder == true && x.Status > -1)
                    .OrderBy(x => x.SortOrder)
                    .ThenBy(x => x.TenderName)
                    .Select(x => new TenderLookupDto
                    {
                        TenderID = x.TenderID,
                        TenderName = x.TenderName ?? string.Empty,
                        SortOrder = x.SortOrder
                    })
                    .ToListAsync();

                return new ApiResponse<List<TenderLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Tenders retrieved successfully",
                    Response = tenders
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<TenderLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching tenders: {ex.Message}",
                    Response = new List<TenderLookupDto>()
                };
            }
        }

        /// <summary>
        /// Save phone notes batch (adds new, updates existing, deletes removed)
        /// </summary>
        public async Task<ApiResponse<List<PhoneNoteLookupDto>>> SavePhoneNotesBatchAsync(PhoneNoteBatchSaveDto dto)
        {
            try
            {
                // Get existing notes of this type
                var existingNotes = await _dbContext.PhoneNotes
                    .Where(x => x.Type == dto.Type && x.Status > -1)
                    .ToListAsync();

                var existingIds = existingNotes.Select(x => x.PhoneNoteIDVal).ToHashSet();
                var incomingIds = dto.Notes.Where(x => x.PhoneNoteIDVal.HasValue && x.PhoneNoteIDVal > 0)
                                           .Select(x => x.PhoneNoteIDVal!.Value).ToHashSet();

                // Delete notes that are no longer in the list (soft delete by setting Status = -1)
                foreach (var note in existingNotes)
                {
                    if (!incomingIds.Contains(note.PhoneNoteIDVal))
                    {
                        note.Status = -1;
                    }
                }

                // Update existing and add new
                foreach (var noteDto in dto.Notes)
                {
                    if (noteDto.PhoneNoteIDVal.HasValue && noteDto.PhoneNoteIDVal > 0)
                    {
                        // Update existing
                        var existing = existingNotes.FirstOrDefault(x => x.PhoneNoteIDVal == noteDto.PhoneNoteIDVal);
                        if (existing != null)
                        {
                            existing.Value = noteDto.Value;
                            existing.Sort = noteDto.Sort;
                            existing.Status = 0;
                        }
                    }
                    else
                    {
                        // Add new
                        var newNote = new BackOffice.Domain.Entities.Tenant.PhoneNote
                        {
                            Value = noteDto.Value,
                            Type = dto.Type,
                            Sort = noteDto.Sort,
                            Status = 0
                        };
                        _dbContext.PhoneNotes.Add(newNote);
                    }
                }

                await _dbContext.SaveChangesAsync();

                // Return updated list
                var updatedNotes = await _dbContext.PhoneNotes
                    .Where(x => x.Type == dto.Type && x.Status > -1)
                    .OrderBy(x => x.Sort)
                    .ThenBy(x => x.Value)
                    .Select(x => new PhoneNoteLookupDto
                    {
                        PhoneNoteIDVal = x.PhoneNoteIDVal,
                        Value = x.Value ?? string.Empty,
                        Type = x.Type,
                        Sort = x.Sort
                    })
                    .ToListAsync();

                return new ApiResponse<List<PhoneNoteLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Phone notes saved successfully",
                    Response = updatedNotes
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<PhoneNoteLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error saving phone notes: {ex.Message}",
                    Response = new List<PhoneNoteLookupDto>()
                };
            }
        }

        /// <summary>
        /// Add a single phone note
        /// </summary>
        public async Task<ApiResponse<PhoneNoteLookupDto>> AddPhoneNoteAsync(PhoneNoteCreateUpdateDto dto)
        {
            try
            {
                var newNote = new BackOffice.Domain.Entities.Tenant.PhoneNote
                {
                    Value = dto.Value,
                    Type = dto.Type,
                    Sort = dto.Sort,
                    Status = 0
                };

                _dbContext.PhoneNotes.Add(newNote);
                await _dbContext.SaveChangesAsync();

                return new ApiResponse<PhoneNoteLookupDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Phone note added successfully",
                    Response = new PhoneNoteLookupDto
                    {
                        PhoneNoteIDVal = newNote.PhoneNoteIDVal,
                        Value = newNote.Value ?? string.Empty,
                        Type = newNote.Type,
                        Sort = newNote.Sort
                    }
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<PhoneNoteLookupDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error adding phone note: {ex.Message}",
                    Response = null
                };
            }
        }

        /// <summary>
        /// Update a single phone note
        /// </summary>
        public async Task<ApiResponse<PhoneNoteLookupDto>> UpdatePhoneNoteAsync(int id, PhoneNoteCreateUpdateDto dto)
        {
            try
            {
                var note = await _dbContext.PhoneNotes.FindAsync(id);
                if (note == null)
                {
                    return new ApiResponse<PhoneNoteLookupDto>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Phone note not found",
                        Response = null
                    };
                }

                note.Value = dto.Value;
                note.Sort = dto.Sort;

                await _dbContext.SaveChangesAsync();

                return new ApiResponse<PhoneNoteLookupDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Phone note updated successfully",
                    Response = new PhoneNoteLookupDto
                    {
                        PhoneNoteIDVal = note.PhoneNoteIDVal,
                        Value = note.Value ?? string.Empty,
                        Type = note.Type,
                        Sort = note.Sort
                    }
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<PhoneNoteLookupDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error updating phone note: {ex.Message}",
                    Response = null
                };
            }
        }

        /// <summary>
        /// Delete a single phone note (soft delete)
        /// </summary>
        public async Task<ApiResponse<bool>> DeletePhoneNoteAsync(int id)
        {
            try
            {
                var note = await _dbContext.PhoneNotes.FindAsync(id);
                if (note == null)
                {
                    return new ApiResponse<bool>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "Phone note not found",
                        Response = false
                    };
                }

                note.Status = -1; // Soft delete

                await _dbContext.SaveChangesAsync();

                return new ApiResponse<bool>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Phone note deleted successfully",
                    Response = true
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<bool>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error deleting phone note: {ex.Message}",
                    Response = false
                };
            }
        }

        /// <summary>
        /// Get users for Pick By dropdown in Phone Order form
        /// Query: SELECT * FROM UsersView WHERE Status > -1 AND (StoreID = @storeId OR IsSuperAdmin = 1 OR IsDefault = 0)
        /// </summary>
        public async Task<ApiResponse<List<UserLookupDto>>> GetUsersForPickByAsync(Guid storeId)
        {
            try
            {
                var users = await _dbContext.WebUsersViews
                    .Where(x => x.Status > -1 && (x.StoreID == storeId || x.IsSuperAdmin == true || x.IsDefault == false))
                    .OrderBy(x => x.UserFName)
                    .ThenBy(x => x.UserLName)
                    .Select(x => new UserLookupDto
                    {
                        UserId = x.UserId,
                        UserName = x.UserName ?? string.Empty,
                        DisplayName = ((x.UserFName ?? "") + " " + (x.UserLName ?? "")).Trim()
                    })
                    .ToListAsync();

                return new ApiResponse<List<UserLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Users retrieved successfully",
                    Response = users
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<UserLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching users: {ex.Message}",
                    Response = new List<UserLookupDto>()
                };
            }
        }

        /// <summary>
        /// Get all active Mix & Match configurations for dropdown
        /// </summary>
        public async Task<ApiResponse<List<MixAndMatchLookupDto>>> GetMixAndMatchesAsync()
        {
            try
            {
                var results = await _dbContext.Procedures.SP_MixAndMatchAsync(
                    dateModified: null,
                    activeOnly: true
                );

                var mixAndMatches = results
                    .OrderBy(x => x.Name)
                    .Select(x => new MixAndMatchLookupDto
                    {
                        MixAndMatchID = x.MixAndMatchID,
                        Name = x.Name ?? string.Empty,
                        Qty = x.Qty,
                        Amount = x.Amount,
                        AssignDate = x.AssignDate,
                        StartDate = x.StartDate,
                        EndDate = x.EndDate,
                        MinTotalSale = x.MinTotalSale
                    })
                    .ToList();

                return new ApiResponse<List<MixAndMatchLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Mix & Match configurations retrieved successfully",
                    Response = mixAndMatches
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<MixAndMatchLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching mix & match configurations: {ex.Message}",
                    Response = new List<MixAndMatchLookupDto>()
                };
            }
        }

        /// <summary>
        /// Create a new Mix & Match configuration
        /// </summary>
        public async Task<ApiResponse<MixAndMatchLookupDto>> CreateMixAndMatchAsync(CreateMixAndMatchDto dto, Guid userId)
        {
            try
            {
                var newId = Guid.NewGuid();

                await _dbContext.Procedures.SP_MixAndMatchInsertAsync(
                    mixAndMatchID: newId,
                    name: dto.Name,
                    qty: dto.Qty,
                    amount: dto.Amount,
                    assignDate: dto.AssignDate,
                    startDate: dto.StartDate,
                    endDate: dto.EndDate,
                    minTotalSale: dto.MinTotalSale,
                    status: 1, // Active
                    modifierID: userId
                );

                var created = new MixAndMatchLookupDto
                {
                    MixAndMatchID = newId,
                    Name = dto.Name,
                    Qty = dto.Qty,
                    Amount = dto.Amount,
                    AssignDate = dto.AssignDate,
                    StartDate = dto.StartDate,
                    EndDate = dto.EndDate,
                    MinTotalSale = dto.MinTotalSale
                };

                return new ApiResponse<MixAndMatchLookupDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Mix & Match created successfully",
                    Response = created
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<MixAndMatchLookupDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error creating mix & match: {ex.Message}",
                    Response = null
                };
            }
        }

        public async Task<ApiResponse<List<GroupLookupDto>>> GetGroupsAsync()
        {
            try
            {
                var groups = await _dbContext.Groups
                    .Where(x => x.Status > -1)
                    .OrderBy(x => x.GroupName)
                    .Select(x => new GroupLookupDto
                    {
                        GroupID = x.GroupID,
                        GroupName = x.GroupName
                    })
                    .ToListAsync();

                return new ApiResponse<List<GroupLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Groups retrieved successfully",
                    Response = groups
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<GroupLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching groups: {ex.Message}",
                    Response = new List<GroupLookupDto>()
                };
            }
        }

        /// <summary>
        /// ITEM groups — the ItemGroup table that ItemToGroup references. Used by the
        /// discount Import Items "Group" filter (the desktop ImportItem dropdown bound
        /// to ItemsDS.ItemGroup). Distinct from GetGroupsAsync (employee/security Groups).
        /// </summary>
        public async Task<ApiResponse<List<GroupLookupDto>>> GetItemGroupsLookupAsync()
        {
            try
            {
                var groups = await _dbContext.ItemGroups
                    .Where(x => (x.Status == null || x.Status > -1) && x.ItemGroupName != null && x.ItemGroupName != "")
                    .OrderBy(x => x.ItemGroupName)
                    .Select(x => new GroupLookupDto
                    {
                        GroupID = x.ItemGroupID,
                        GroupName = x.ItemGroupName ?? string.Empty
                    })
                    .ToListAsync();

                return new ApiResponse<List<GroupLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Item groups retrieved successfully",
                    Response = groups
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<GroupLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching item groups: {ex.Message}",
                    Response = new List<GroupLookupDto>()
                };
            }
        }

        /// <summary>
        /// Customer Group lookup for the Customer-tab "Group" filter. Sourced from
        /// the CustomerGroup table (FrmFiltersReport's LuCustomerGroup =
        /// DsCustomer.CustomerGroup). Deliberately separate from GetGroupsAsync,
        /// which returns security/permission groups used by the User form.
        /// </summary>
        public async Task<ApiResponse<List<GroupLookupDto>>> GetCustomerGroupsAsync()
        {
            try
            {
                var groups = await _dbContext.CustomerGroups.AsNoTracking()
                    .Where(x => x.Status == null || x.Status > -1)
                    .OrderBy(x => x.CustomerGroupName)
                    .Select(x => new GroupLookupDto
                    {
                        GroupID = x.CustomerGroupID,
                        GroupName = x.CustomerGroupName ?? string.Empty
                    })
                    .ToListAsync();

                return new ApiResponse<List<GroupLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Customer groups retrieved successfully",
                    Response = groups
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<GroupLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching customer groups: {ex.Message}",
                    Response = new List<GroupLookupDto>()
                };
            }
        }

        public async Task<ApiResponse<List<StoreLookupDto>>> GetAllStoresAsync()
        {
            try
            {
                var stores = await _dbContext.Stores
                    .Where(x => x.Status > -1)
                    .OrderBy(x => x.StoreName)
                    .Select(x => new StoreLookupDto
                    {
                        StoreID = x.StoreID,
                        StoreName = x.StoreName ?? string.Empty
                    })
                    .ToListAsync();

                return new ApiResponse<List<StoreLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Stores retrieved successfully",
                    Response = stores
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<StoreLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching stores: {ex.Message}",
                    Response = new List<StoreLookupDto>()
                };
            }
        }
        /// <summary>
        /// Get all adjust types for dropdown using SP_GetSystemTable stored procedure.
        /// Excludes "Start On Hand" type (matching legacy VB.NET behavior where StartOnHand is filtered out).
        /// </summary>
        public async Task<ApiResponse<List<AdjustTypeLookupDto>>> GetAdjustTypesAsync()
        {
            try
            {
                var results = await _dbContext.Procedures.SP_GetSystemTableAsync(
                    tableName: TABLE_ADJUST_TYPE,
                    language: false
                );

                var adjustTypes = results
                    .Where(x => !string.Equals(x.SystemValueName, "Start On Hand", StringComparison.OrdinalIgnoreCase))
                    .OrderBy(x => x.SortOrder ?? x.SystemValueNo)
                    .Select(x => new AdjustTypeLookupDto
                    {
                        Value = x.SystemValueNo,
                        Label = x.SystemValueName ?? string.Empty,
                        SortOrder = x.SortOrder
                    })
                    .ToList();

                return new ApiResponse<List<AdjustTypeLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Adjust types retrieved successfully",
                    Response = adjustTypes
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<AdjustTypeLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching adjust types: {ex.Message}",
                    Response = new List<AdjustTypeLookupDto>()
                };
            }
        }

        /// <summary>
        /// Create a new Items Lookup Value (Pattern, Custom Field)
        /// </summary>
        public async Task<ApiResponse<ItemsLookupValueDto>> CreateItemsLookupValueAsync(CreateItemsLookupValueDto dto, Guid userId)
        {
            try
            {
                var newId = Guid.NewGuid();

                await _dbContext.Procedures.SP_ItemsLookupValuesInsertAsync(
                    valueType: dto.ValueType,
                    valueID: newId,
                    valueName: dto.ValueName,
                    status: 1, // Active
                    modifierID: userId
                );

                var created = new ItemsLookupValueDto
                {
                    ValueID = newId,
                    ValueName = dto.ValueName,
                    ValueType = dto.ValueType
                };

                return new ApiResponse<ItemsLookupValueDto>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Lookup value created successfully",
                    Response = created
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<ItemsLookupValueDto>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error creating lookup value: {ex.Message}",
                    Response = null
                };
            }
        }

        // ─── Advanced Filters modal lookups ──────────────────────────────────
        // Power the multi-tab Filters dialog shown on report pages. Each
        // returns a small list shape ({value/id, label}) suitable for a
        // SearchableSelect on the frontend.

        /// <inheritdoc/>
        public async Task<ApiResponse<List<CustomerTypeLookupDto>>> GetCustomerTypesAsync()
        {
            try
            {
                // Source the exact values the desktop BackOffice shows: the
                // "CustomerType" system table (SystemValueNo / SystemValueName),
                // read through SP_GetSystemTable — identical to FrmFiltersReport's
                // LuCustomerType (DBSystem.SystemDS.CustomerType). No hardcoding so
                // tenant-specific customer types come through verbatim.
                var results = await _dbContext.Procedures.SP_GetSystemTableAsync(
                    tableName: TABLE_CUSTOMER_TYPE,
                    language: false
                );

                var types = results
                    .OrderBy(x => x.SortOrder ?? x.SystemValueNo)
                    .Select(x => new CustomerTypeLookupDto
                    {
                        Value = x.SystemValueNo,
                        Label = x.SystemValueName ?? string.Empty
                    })
                    .ToList();

                return new ApiResponse<List<CustomerTypeLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Customer types retrieved successfully",
                    Response = types
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<CustomerTypeLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching customer types: {ex.Message}",
                    Response = new List<CustomerTypeLookupDto>()
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<List<PriceLevelLookupDto>>> GetPriceLevelsAsync()
        {
            try
            {
                // Source the exact values the desktop BackOffice shows: the
                // "Prices" system table (SystemValueNo / SystemValueName =
                // Price A / Price B / …), read through SP_GetSystemTable —
                // identical to FrmFiltersReport's LuPriceLevel
                // (DBSystem.SystemDS.Prices). SystemValueNo lines up with
                // Customer.PriceLevelID, so no synthesized "Level {n}" labels.
                var results = await _dbContext.Procedures.SP_GetSystemTableAsync(
                    tableName: TABLE_PRICES,
                    language: false
                );

                var result = results
                    .OrderBy(x => x.SortOrder ?? x.SystemValueNo)
                    .Select(x => new PriceLevelLookupDto
                    {
                        Value = x.SystemValueNo,
                        Label = x.SystemValueName ?? string.Empty
                    })
                    .ToList();

                return new ApiResponse<List<PriceLevelLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Price levels retrieved successfully",
                    Response = result
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<PriceLevelLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching price levels: {ex.Message}",
                    Response = new List<PriceLevelLookupDto>()
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<List<ZipLookupDto>>> GetCustomerZipsAsync()
        {
            try
            {
                // Match the desktop BackOffice: the Zip dropdown is sourced from
                // the master ZipCodes reference table (FrmFiltersReport's LuZip =
                // DsSupplier.ZipCodes), NOT from customer records. Distinct,
                // non-empty, ordered by zip — loads the full table like the
                // desktop does so the option list matches exactly.
                var zips = await _dbContext.ZipCodes.AsNoTracking()
                    .Where(z => z.ZipCode1 != null && z.ZipCode1 != "")
                    .Select(z => z.ZipCode1!)
                    .Distinct()
                    .OrderBy(z => z)
                    .ToListAsync();

                var result = zips
                    .Select(z => new ZipLookupDto { Zip = z.Trim() })
                    .Where(d => d.Zip.Length > 0)
                    .DistinctBy(d => d.Zip)
                    .ToList();

                return new ApiResponse<List<ZipLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Customer zips retrieved successfully",
                    Response = result
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<ZipLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching customer zips: {ex.Message}",
                    Response = new List<ZipLookupDto>()
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<List<DiscountLookupDto>>> GetDiscountsLookupAsync()
        {
            try
            {
                var discounts = await _dbContext.Discounts.AsNoTracking()
                    .Where(d => d.Name != null && d.Name != "")
                    .OrderBy(d => d.Name)
                    .Select(d => new DiscountLookupDto
                    {
                        DiscountID = d.DiscountID,
                        Name = d.Name!
                    })
                    .ToListAsync();

                return new ApiResponse<List<DiscountLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Discounts retrieved successfully",
                    Response = discounts
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<DiscountLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching discounts: {ex.Message}",
                    Response = new List<DiscountLookupDto>()
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<List<BrandLookupDto>>> GetBrandsAsync()
        {
            try
            {
                // Brand isn't on ItemMain directly — it lives on the
                // ItemMainAndStoreGrid view which projects the joined value.
                // Return the distinct populated values sorted, capped at 1000
                // to avoid pathological payloads on tenants with dirty data.
                var brands = await _dbContext.Set<ItemMainAndStoreGrid>().AsNoTracking()
                    .Where(i => i.Brand != null && i.Brand != "")
                    .Select(i => i.Brand!)
                    .Distinct()
                    .OrderBy(b => b)
                    .Take(1000)
                    .ToListAsync();

                var result = brands
                    .Select(b => new BrandLookupDto { Brand = b.Trim() })
                    .Where(d => d.Brand.Length > 0)
                    .DistinctBy(d => d.Brand)
                    .ToList();

                return new ApiResponse<List<BrandLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Brands retrieved successfully",
                    Response = result
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<BrandLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching brands: {ex.Message}",
                    Response = new List<BrandLookupDto>()
                };
            }
        }

        /// <inheritdoc/>
        /// <summary>
        /// Distinct active items (one row per ItemMain) for the discount / report item
        /// pickers — paginated + searched server-side. Mirrors the desktop discount form,
        /// which binds to the distinct ItemMain list (NOT the per-store ItemsQuickListView),
        /// so there are no per-store duplicates to dedupe and paging is exact. Falls back to
        /// Model No / UPC on the client when Name is null.
        /// </summary>
        public async Task<ApiResponse<PaginationResponseDTO<ItemFilterLookupDto>>> SearchItemsPagedAsync(string? search, int startRow, int endRow)
        {
            try
            {
                var query = _dbContext.ItemMains.AsNoTracking().Where(i => i.Status > 0);

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.Trim();
                    query = query.Where(i =>
                        (i.Name != null && EF.Functions.Like(i.Name, $"%{s}%")) ||
                        (i.BarcodeNumber != null && EF.Functions.Like(i.BarcodeNumber, $"%{s}%")) ||
                        (i.ModalNumber != null && EF.Functions.Like(i.ModalNumber, $"%{s}%")));
                }

                var total = await query.CountAsync();

                var take = endRow > startRow ? endRow - startRow : 20;
                if (take <= 0 || take > 500) take = 20;
                var skip = startRow < 0 ? 0 : startRow;

                var items = await query
                    .OrderBy(i => i.Name)
                    .Skip(skip)
                    .Take(take)
                    .Select(i => new ItemFilterLookupDto
                    {
                        ItemID = i.ItemID,
                        Name = i.Name ?? "",
                        Barcode = i.BarcodeNumber,
                        ModelNo = i.ModalNumber,
                        Department = null
                    })
                    .ToListAsync();

                return new ApiResponse<PaginationResponseDTO<ItemFilterLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Items retrieved successfully",
                    Response = new PaginationResponseDTO<ItemFilterLookupDto>
                    {
                        Data = items,
                        TotalRecords = total,
                        RecordsFiltered = total,
                    }
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<PaginationResponseDTO<ItemFilterLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching items: {ex.Message}",
                    Response = new PaginationResponseDTO<ItemFilterLookupDto> { Data = new List<ItemFilterLookupDto>(), TotalRecords = 0 }
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<List<ItemFilterLookupDto>>> GetItemsByIdsAsync(IReadOnlyList<Guid> ids)
        {
            try
            {
                // Distinct, capped — selection is capped at 500 on the client; 2000
                // gives headroom without risking a huge IN clause.
                var distinctIds = (ids ?? Array.Empty<Guid>())
                    .Where(id => id != Guid.Empty)
                    .Distinct()
                    .Take(2000)
                    .ToList();

                if (distinctIds.Count == 0)
                {
                    return new ApiResponse<List<ItemFilterLookupDto>>
                    {
                        IsSuccess = true,
                        StatusCode = ResponseCode.Success,
                        Message = "No ids supplied",
                        Response = new List<ItemFilterLookupDto>()
                    };
                }

                var items = await _dbContext.ItemMains
                    .AsNoTracking()
                    .Where(i => distinctIds.Contains(i.ItemID))
                    .OrderBy(i => i.Name)
                    .Select(i => new ItemFilterLookupDto
                    {
                        ItemID = i.ItemID,
                        Name = i.Name ?? "",
                        Barcode = i.BarcodeNumber,
                        ModelNo = i.ModalNumber,
                        Department = null
                    })
                    .ToListAsync();

                return new ApiResponse<List<ItemFilterLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Items retrieved successfully",
                    Response = items
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<ItemFilterLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching items by ids: {ex.Message}",
                    Response = new List<ItemFilterLookupDto>()
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<List<DiscountImportItemDto>>> GetDiscountImportItemsAsync(DiscountImportItemsRequestDto request)
        {
            try
            {
                request ??= new DiscountImportItemsRequestDto();

                var q = _dbContext.ItemMainAndStoreViews
                    .AsNoTracking()
                    .Where(v => v.MainStatus > 0);

                // One row per item: scope to a store when given (matches the desktop's
                // current-store Fill). When omitted, results are deduped by item below.
                if (request.StoreId.HasValue && request.StoreId.Value != Guid.Empty)
                    q = q.Where(v => v.StoreNo == request.StoreId.Value);

                if (request.DepartmentIds is { Count: > 0 })
                    q = q.Where(v => v.DepartmentID != null && request.DepartmentIds.Contains(v.DepartmentID.Value));

                if (request.ManufacturerIds is { Count: > 0 })
                    q = q.Where(v => v.ManufacturerID != null && request.ManufacturerIds.Contains(v.ManufacturerID.Value));

                if (request.ItemTypes is { Count: > 0 })
                    q = q.Where(v => v.ItemType != null && request.ItemTypes.Contains(v.ItemType.Value));

                // Supplier filter — ItemStoreID in the supplier's items (legacy ItemSupply join).
                if (request.SupplierIds is { Count: > 0 })
                {
                    var supplierItemStoreIds = _dbContext.ItemSupplies
                        .Where(s => s.SupplierNo != null && request.SupplierIds.Contains(s.SupplierNo.Value))
                        .Select(s => s.ItemStoreNo);
                    q = q.Where(v => supplierItemStoreIds.Contains(v.ItemStoreID));
                }

                // Group filter — ItemStoreID in the active ItemToGroup rows.
                if (request.GroupIds is { Count: > 0 })
                {
                    var groupItemStoreIds = _dbContext.ItemToGroups
                        .Where(g => g.Status > 0 && g.ItemGroupID != null && request.GroupIds.Contains(g.ItemGroupID.Value))
                        .Select(g => g.ItemStoreID);
                    q = q.Where(v => groupItemStoreIds.Contains(v.ItemStoreID));
                }

                if (!string.IsNullOrWhiteSpace(request.Search))
                {
                    var s = request.Search.Trim();
                    q = q.Where(v =>
                        (v.Name != null && EF.Functions.Like(v.Name, $"%{s}%")) ||
                        (v.BarcodeNumber != null && EF.Functions.Like(v.BarcodeNumber, $"%{s}%")) ||
                        (v.ModalNumber != null && EF.Functions.Like(v.ModalNumber, $"%{s}%")));
                }

                var max = request.MaxRows is > 0 and <= 5000 ? request.MaxRows!.Value : 2000;

                var rows = await q
                    .OrderBy(v => v.Name)
                    .Take(max)
                    .Select(v => new DiscountImportItemDto
                    {
                        ItemId = v.ItemID,
                        ItemStoreId = v.ItemStoreID,
                        Barcode = v.BarcodeNumber,
                        Name = v.Name,
                        ModelNo = v.ModalNumber,
                        ItemType = v.ItemTypeName,
                        Price = v.Price,
                        Size = v.Size,
                        Brand = v.Brand,
                        Department = v.Department
                    })
                    .ToListAsync();

                // No store scope → collapse the per-store duplicates to one row per item.
                if (!(request.StoreId.HasValue && request.StoreId.Value != Guid.Empty))
                {
                    rows = rows
                        .GroupBy(r => r.ItemId)
                        .Select(g => g.First())
                        .ToList();
                }

                return new ApiResponse<List<DiscountImportItemDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Items retrieved successfully",
                    Response = rows
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<DiscountImportItemDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error fetching import items: {ex.Message}",
                    Response = new List<DiscountImportItemDto>()
                };
            }
        }

        /// <inheritdoc/>
        public async Task<ApiResponse<List<ItemFilterLookupDto>>> SearchItemsAsync(string? search, int take = 50)
        {
            try
            {
                if (take <= 0 || take > 200) take = 50;
                // Status > 0 = active items only (matches the grid's default
                // filter). ModalNumber is the legacy column name for what
                // the UI calls "Model Number".
                var query = _dbContext.ItemMains.AsNoTracking()
                    .Where(i => i.Status > 0);

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.Trim();
                    query = query.Where(i =>
                        (i.Name != null && EF.Functions.Like(i.Name, $"%{s}%")) ||
                        (i.BarcodeNumber != null && EF.Functions.Like(i.BarcodeNumber, $"%{s}%")) ||
                        (i.ModalNumber != null && EF.Functions.Like(i.ModalNumber, $"%{s}%")));
                }

                var items = await query
                    .OrderBy(i => i.Name)
                    .Take(take)
                    .Select(i => new ItemFilterLookupDto
                    {
                        ItemID = i.ItemID,
                        Name = i.Name ?? "",
                        Barcode = i.BarcodeNumber,
                        // Department lookup deferred — keep null here so the
                        // payload stays cheap; the filter's display label
                        // doesn't currently need it.
                        Department = null
                    })
                    .ToListAsync();

                return new ApiResponse<List<ItemFilterLookupDto>>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Items retrieved successfully",
                    Response = items
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<List<ItemFilterLookupDto>>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = $"Error searching items: {ex.Message}",
                    Response = new List<ItemFilterLookupDto>()
                };
            }
        }
    }
}
