using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Item;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Tenant
{
    public class ItemService : IItemService
    {
        private readonly IUnitOfWorkTenant _unitOfWork;
        private readonly IMapper _mapper;
        private readonly TenantDBContext _dbContext;

        public ItemService(IUnitOfWorkTenant unitOfWork, IMapper mapper, TenantDBContext dbContext)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
            _dbContext = dbContext;
        }

        #region Add Item

        /// <summary>
        /// Creates a new item with all related entities (ItemMain, ItemStore, ItemSupply, ItemToGroup, ItemAlias)
        /// Based on FrmItemsNew.Save() logic from VB.NET application
        /// </summary>
        public async Task<ApiResponse<CreateItemResponseDto>> AddItemAsync(CreateItemDto dto, Guid userId)
        {
            try
            {
                // Validation
                if (string.IsNullOrWhiteSpace(dto.Name))
                {
                    return ApiResponseFactory.BadRequest<CreateItemResponseDto>("Name is required.");
                }

                if (string.IsNullOrWhiteSpace(dto.BarcodeNumber))
                {
                    return ApiResponseFactory.BadRequest<CreateItemResponseDto>("Barcode number is required.");
                }

                // Check if barcode exists (exclude current item if updating)
                if (await _unitOfWork.ItemMains.BarcodeExistsAsync(dto.BarcodeNumber, dto.ItemId))
                {
                    return ApiResponseFactory.BadRequest<CreateItemResponseDto>($"Barcode '{dto.BarcodeNumber}' already exists.");
                }

                // Check if model number exists (if provided, exclude current item if updating)
                if (!string.IsNullOrWhiteSpace(dto.ModalNumber))
                {
                    if (await _unitOfWork.ItemMains.ModelNumberExistsAsync(dto.ModalNumber, dto.ItemId))
                    {
                        return ApiResponseFactory.BadRequest<CreateItemResponseDto>($"Model number '{dto.ModalNumber}' already exists.");
                    }
                }

                // Validate StoreNo
                if (dto.StoreNo == Guid.Empty)
                {
                    return ApiResponseFactory.BadRequest<CreateItemResponseDto>("Store ID is required.");
                }

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var now = DateTime.Now;

                    // Create ItemMain
                    var itemMain = new ItemMain
                    {
                        ItemID = Guid.NewGuid(),
                        Name = dto.Name,
                        Description = dto.Description,
                        ModalNumber = dto.ModalNumber,
                        BarcodeNumber = dto.BarcodeNumber,
                        CaseBarcodeNumber = dto.CaseBarcodeNumber,
                        CaseBarCode = dto.CaseCode, // CaseBarCode = short case code ("21"), separate from CaseBarcodeNumber (full UPC)
                        CaseQty = dto.CaseQty ?? 0,
                        CaseDescription = dto.CaseDescription,
                        BarcodeType = dto.BarcodeType ?? 0, // 0 = Standard
                        ItemType = dto.ItemType ?? 0, // 0 = Standard
                        IsTemplate = dto.IsTemplate ?? false,
                        IsSerial = dto.IsSerial ?? false,
                        ManufacturerID = dto.ManufacturerID,
                        ManufacturerPartNo = dto.ManufacturerPartNo,
                        PriceByCase = dto.PriceByCase ?? false,
                        CostByCase = dto.CostByCase ?? false,
                        Size = dto.Size,
                        Units = dto.Units,
                        Meaasure = dto.Measure,
                        ExtraInfo = dto.ExtraInfo,
                        ExtraInfo2 = dto.ExtraInfo2,
                        CustomerCode = dto.CustomerCode,
                        NoScanMsg = dto.NoScanMsg,
                        StyleNo = dto.StyleNo,
                        CustomInteger1 = dto.CustomInteger1,
                        CustomField1 = dto.CustomField1,
                        CustomField2 = dto.CustomField2,
                        CustomField3 = dto.CustomField3,
                        CustomField4 = dto.CustomField4,
                        CustomField5 = dto.CustomField5,
                        CustomField6 = dto.CustomField6,
                        CustomField7 = dto.CustomField7,
                        CustomField8 = dto.CustomField8,
                        CustomField9 = dto.CustomField9,
                        CustomField10 = dto.CustomField10,
                        SeasonID = dto.SeasonID,
                        Matrix1 = dto.Matrix1,
                        Matrix2 = dto.Matrix2,
                        Matrix3 = dto.Matrix3,
                        Matrix4 = dto.Matrix4,
                        Matrix5 = dto.Matrix5,
                        Matrix6 = dto.Matrix6,
                        ParentID = dto.ParentID,
                        LinkNo = dto.LinkNo,
                        PkgCode = dto.PkgCode,
                        AddToApp = dto.AddToApp,
                        ExtName = dto.Pattern,
                        Status = 1, // Active
                        DateCreated = now,
                        UserCreated = userId,
                        DateModified = now,
                        UserModified = userId
                    };

                    await _unitOfWork.ItemMains.AddAsync(itemMain);

                    // Create ItemStore
                    var itemStore = new ItemStore
                    {
                        ItemStoreID = Guid.NewGuid(),
                        ItemNo = itemMain.ItemID,
                        StoreNo = dto.StoreNo,
                        DepartmentID = dto.DepartmentID,
                        IsDiscount = dto.IsDiscount ?? true,
                        IsTaxable = dto.IsTaxable ?? true,
                        TaxID = dto.TaxID,
                        IsFoodStampable = dto.IsFoodStampable ?? false,
                        IsWIC = dto.IsWIC ?? false,
                        Cost = dto.Cost ?? 0,
                        ListPrice = dto.ListPrice,
                        Price = dto.Price ?? 0,
                        PriceA = dto.PriceA,
                        PriceB = dto.PriceB,
                        PriceC = dto.PriceC,
                        PriceD = dto.PriceD,
                        ExtraCharge1 = dto.ExtraCharge1,
                        ExtraCharge2 = dto.ExtraCharge2,
                        ExtraCharge3 = dto.ExtraCharge3,
                        CogsAccount = dto.CogsAccount,
                        IncomeAccount = dto.IncomeAccount,
                        ProfitCalculation = dto.ProfitCalculation,
                        CommissionQty = dto.CommissionQty,
                        CommissionType = dto.CommissionType,
                        PrefSaleBy = dto.PrefSaleBy,
                        PrefOrderBy = dto.PrefOrderBy,
                        OnHand = dto.OnHand ?? 0,
                        OnOrder = dto.OnOrder ?? 0,
                        OnTransferOrder = dto.OnTransferOrder ?? 0,
                        ReorderPoint = dto.ReorderPoint ?? 0,
                        RestockLevel = dto.RestockLevel,
                        BinLocation = dto.BinLocation,
                        DaysForReturn = dto.DaysForReturn,
                        SaleType = dto.SaleType,
                        SalePrice = dto.SalePrice,
                        SaleStartDate = dto.SaleStartDate,
                        SaleEndDate = dto.SaleEndDate,
                        SaleMin = dto.SaleMin,
                        SaleMax = dto.SaleMax,
                        MinForSale = dto.MinForSale,
                        SpecialBuy = dto.SpecialBuy,
                        SpecialPrice = dto.SpecialPrice,
                        SpecialBuyFromDate = dto.SpecialBuyFromDate,
                        SpecialBuyToDate = dto.SpecialBuyToDate,
                        MixAndMatchID = dto.MixAndMatchID,
                        AssignDate = dto.AssignDate,
                        CasePrice = dto.CasePrice,
                        CaseSpecial = dto.CaseSpecial,
                        PkgPrice = dto.PkgPrice,
                        PkgQty = dto.PkgQty,
                        IsCaseDiscount = dto.IsCaseDiscount,
                        IsPkgDiscount = dto.IsPkgDiscount,
                        Tare = dto.Tare,
                        NewPrice = dto.NewPrice,
                        NewPriceDate = dto.NewPriceDate,
                        SellOnWeb = dto.SellOnWeb,
                        WebCasePrice = dto.WebCasePrice,
                        WebPrice = dto.WebPrice,
                        Status = 1, // Active
                        DateCreated = now,
                        UserCreated = userId,
                        DateModified = now,
                        UserModified = userId,
                        MTDQty = 0,
                        MTDDollar = 0,
                        PTDQty = 0,
                        PTDDollar = 0,
                        YTDQty = 0,
                        YTDDollar = 0
                    };

                    await _unitOfWork.ItemStores.AddAsync(itemStore);

                    // Create ItemSupply records (suppliers)
                    if (dto.ItemSupplies != null && dto.ItemSupplies.Any())
                    {
                        short sortOrder = 1;
                        foreach (var supplyDto in dto.ItemSupplies)
                        {
                            var itemSupply = new ItemSupply
                            {
                                ItemSupplyID = Guid.NewGuid(),
                                ItemStoreNo = itemStore.ItemStoreID,
                                SupplierNo = supplyDto.SupplierNo,
                                TotalCost = supplyDto.TotalCost,
                                GrossCost = supplyDto.GrossCost,
                                MinimumQty = supplyDto.MinimumQty,
                                QtyPerCase = supplyDto.QtyPerCase,
                                IsOrderedOnlyInCase = supplyDto.IsOrderedOnlyInCase ?? false,
                                AverageDeliveryDelay = supplyDto.AverageDeliveryDelay,
                                ItemCode = supplyDto.ItemCode,
                                IsMainSupplier = supplyDto.IsMainSupplier,
                                SortOrder = supplyDto.SortOrder ?? sortOrder,
                                CaseQty = supplyDto.CaseQty,
                                SalePrice = supplyDto.SalePrice,
                                AssignDate = supplyDto.AssignDate,
                                FromDate = supplyDto.FromDate,
                                ToDate = supplyDto.ToDate,
                                OnSpecialReq = supplyDto.OnSpecialReq,
                                MinQty = supplyDto.MinQty,
                                MaxQty = supplyDto.MaxQty,
                                UOMType = supplyDto.UOMType,
                                ColorName = supplyDto.ColorName,
                                Status = 1,
                                DateCreated = now,
                                UserCreated = userId,
                                DateModified = now,
                                UserModified = userId
                            };

                            // Set MainSupplierID on ItemStore if this is the main supplier
                            if (supplyDto.IsMainSupplier)
                            {
                                itemStore.MainSupplierID = itemSupply.ItemSupplyID;
                            }

                            await _unitOfWork.ItemSupplies.AddAsync(itemSupply);
                            sortOrder++;
                        }
                    }

                    // Create ItemToGroup records (groups)
                    if (dto.ItemToGroups != null && dto.ItemToGroups.Any())
                    {
                        foreach (var groupDto in dto.ItemToGroups)
                        {
                            var itemToGroup = new ItemToGroup
                            {
                                ItemToGroupID = Guid.NewGuid(),
                                ItemStoreID = itemStore.ItemStoreID,
                                ItemGroupID = groupDto.ItemGroupID,
                                Status = 1,
                                DateModified = now
                            };

                            await _unitOfWork.ItemToGroups.AddAsync(itemToGroup);
                        }
                    }

                    // Create ItemAlias records (alternative barcodes)
                    if (dto.ItemAliases != null && dto.ItemAliases.Any())
                    {
                        foreach (var aliasDto in dto.ItemAliases)
                        {
                            if (!string.IsNullOrWhiteSpace(aliasDto.BarcodeNumber))
                            {
                                // Check if alias barcode exists
                                if (await _unitOfWork.ItemAliases.BarcodeExistsAsync(aliasDto.BarcodeNumber))
                                {
                                    return ApiResponseFactory.BadRequest<CreateItemResponseDto>(
                                        $"Alias barcode '{aliasDto.BarcodeNumber}' already exists.");
                                }

                                var itemAlias = new ItemAlias
                                {
                                    AliasId = Guid.NewGuid(),
                                    ItemNo = itemMain.ItemID,
                                    BarcodeNumber = aliasDto.BarcodeNumber,
                                    Status = 1,
                                    DateCreated = now,
                                    UserCreated = userId,
                                    DateModified = now,
                                    UserModified = userId
                                };

                                await _unitOfWork.ItemAliases.AddAsync(itemAlias);
                            }
                        }
                    }

                    // Save all changes
                    await _unitOfWork.SaveChangesAsync();

                    // Return response
                    var response = new CreateItemResponseDto
                    {
                        ItemID = itemMain.ItemID,
                        ItemStoreID = itemStore.ItemStoreID,
                        BarcodeNumber = itemMain.BarcodeNumber,
                        Name = itemMain.Name,
                        DateCreated = now
                    };

                    return ApiResponseFactory.Success(response, "Item created successfully.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<CreateItemResponseDto>(
                    "Error creating item.",
                    new List<string> { ex.Message, ex.InnerException?.Message ?? "" });
            }
        }

        #endregion

        #region Update Item

        /// <summary>
        /// Updates an existing item with all related entities (ItemMain, ItemStore, ItemSupply, ItemToGroup, ItemAlias)
        /// </summary>
        public async Task<ApiResponse<CreateItemResponseDto>> UpdateItemAsync(CreateItemDto dto, Guid userId)
        {
            try
            {
                // Basic validation (no database access)
                if (!dto.ItemId.HasValue || dto.ItemId.Value == Guid.Empty)
                {
                    return ApiResponseFactory.BadRequest<CreateItemResponseDto>("Item ID is required for update.");
                }

                if (string.IsNullOrWhiteSpace(dto.Name))
                {
                    return ApiResponseFactory.BadRequest<CreateItemResponseDto>("Name is required.");
                }

                if (string.IsNullOrWhiteSpace(dto.BarcodeNumber))
                {
                    return ApiResponseFactory.BadRequest<CreateItemResponseDto>("Barcode number is required.");
                }

                // Execute all database operations within the execution strategy
                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    // Check if barcode exists (exclude current item)
                    if (await _unitOfWork.ItemMains.BarcodeExistsAsync(dto.BarcodeNumber, dto.ItemId))
                    {
                        return ApiResponseFactory.BadRequest<CreateItemResponseDto>($"Barcode '{dto.BarcodeNumber}' already exists.");
                    }

                    // Check if model number exists (if provided, exclude current item)
                    if (!string.IsNullOrWhiteSpace(dto.ModalNumber))
                    {
                        if (await _unitOfWork.ItemMains.ModelNumberExistsAsync(dto.ModalNumber, dto.ItemId))
                        {
                            return ApiResponseFactory.BadRequest<CreateItemResponseDto>($"Model number '{dto.ModalNumber}' already exists.");
                        }
                    }

                    // Get existing ItemMain
                    var itemMain = await _unitOfWork.ItemMains.FirstOrDefaultAsync(i => i.ItemID == dto.ItemId.Value);
                    if (itemMain == null)
                    {
                        return ApiResponseFactory.NotFound<CreateItemResponseDto>("Item not found.");
                    }

                    // Get existing ItemStore
                    var itemStore = await _unitOfWork.ItemStores.FirstOrDefaultAsync(i => i.ItemNo == dto.ItemId.Value && i.StoreNo == dto.StoreNo);
                    if (itemStore == null)
                    {
                        return ApiResponseFactory.NotFound<CreateItemResponseDto>("Item store record not found.");
                    }

                    var now = DateTime.Now;
                    
                    // Update ItemMain properties
                    itemMain.Name = dto.Name;
                    itemMain.Description = dto.Description;
                    itemMain.ModalNumber = dto.ModalNumber;
                    itemMain.BarcodeNumber = dto.BarcodeNumber;
                    itemMain.CaseBarcodeNumber = dto.CaseBarcodeNumber;
                    itemMain.CaseBarCode = dto.CaseCode; // CaseBarCode = short case code ("21"), separate from CaseBarcodeNumber (full UPC)
                    itemMain.CaseQty = dto.CaseQty ?? 0;
                    itemMain.CaseDescription = dto.CaseDescription;
                    itemMain.BarcodeType = dto.BarcodeType ?? 0;
                    itemMain.ItemType = dto.ItemType ?? 0;
                    itemMain.IsTemplate = dto.IsTemplate ?? false;
                    itemMain.IsSerial = dto.IsSerial ?? false;
                    itemMain.ManufacturerID = dto.ManufacturerID;
                    itemMain.ManufacturerPartNo = dto.ManufacturerPartNo;
                    itemMain.PriceByCase = dto.PriceByCase ?? false;
                    itemMain.CostByCase = dto.CostByCase ?? false;
                    itemMain.Size = dto.Size;
                    itemMain.Units = dto.Units;
                    itemMain.Meaasure = dto.Measure;
                    itemMain.ExtraInfo = dto.ExtraInfo;
                    itemMain.ExtraInfo2 = dto.ExtraInfo2;
                    itemMain.CustomerCode = dto.CustomerCode;
                    itemMain.NoScanMsg = dto.NoScanMsg;
                    itemMain.StyleNo = dto.StyleNo;
                    itemMain.CustomInteger1 = dto.CustomInteger1;
                    itemMain.CustomField1 = dto.CustomField1;
                    itemMain.CustomField2 = dto.CustomField2;
                    itemMain.CustomField3 = dto.CustomField3;
                    itemMain.CustomField4 = dto.CustomField4;
                    itemMain.CustomField5 = dto.CustomField5;
                    itemMain.CustomField6 = dto.CustomField6;
                    itemMain.CustomField7 = dto.CustomField7;
                    itemMain.CustomField8 = dto.CustomField8;
                    itemMain.CustomField9 = dto.CustomField9;
                    itemMain.CustomField10 = dto.CustomField10;
                    itemMain.SeasonID = dto.SeasonID;
                    itemMain.Matrix1 = dto.Matrix1;
                    itemMain.Matrix2 = dto.Matrix2;
                    itemMain.Matrix3 = dto.Matrix3;
                    itemMain.Matrix4 = dto.Matrix4;
                    itemMain.Matrix5 = dto.Matrix5;
                    itemMain.Matrix6 = dto.Matrix6;
                    itemMain.ParentID = dto.ParentID;
                    itemMain.LinkNo = dto.LinkNo;
                    itemMain.PkgCode = dto.PkgCode;
                    itemMain.AddToApp = dto.AddToApp;
                    itemMain.ExtName = dto.Pattern;
                    itemMain.DateModified = now;
                    itemMain.UserModified = userId;

                    // No need to call Update() - EF Core tracks changes automatically since entity was fetched from context

                    // Update ItemStore properties
                    itemStore.DepartmentID = dto.DepartmentID;
                    itemStore.IsDiscount = dto.IsDiscount ?? true;
                    itemStore.IsTaxable = dto.IsTaxable ?? true;
                    itemStore.TaxID = dto.TaxID;
                    itemStore.IsFoodStampable = dto.IsFoodStampable ?? false;
                    itemStore.IsWIC = dto.IsWIC ?? false;
                    itemStore.Cost = dto.Cost ?? 0;
                    itemStore.ListPrice = dto.ListPrice;
                    itemStore.Price = dto.Price ?? 0;
                    itemStore.PriceA = dto.PriceA;
                    itemStore.PriceB = dto.PriceB;
                    itemStore.PriceC = dto.PriceC;
                    itemStore.PriceD = dto.PriceD;
                    itemStore.ExtraCharge1 = dto.ExtraCharge1;
                    itemStore.ExtraCharge2 = dto.ExtraCharge2;
                    itemStore.ExtraCharge3 = dto.ExtraCharge3;
                    itemStore.CogsAccount = dto.CogsAccount;
                    itemStore.IncomeAccount = dto.IncomeAccount;
                    itemStore.ProfitCalculation = dto.ProfitCalculation;
                    itemStore.CommissionQty = dto.CommissionQty;
                    itemStore.CommissionType = dto.CommissionType;
                    itemStore.PrefSaleBy = dto.PrefSaleBy;
                    itemStore.PrefOrderBy = dto.PrefOrderBy;
                    itemStore.OnHand = dto.OnHand ?? itemStore.OnHand;
                    itemStore.OnOrder = dto.OnOrder ?? itemStore.OnOrder;
                    itemStore.OnTransferOrder = dto.OnTransferOrder ?? itemStore.OnTransferOrder;
                    itemStore.ReorderPoint = dto.ReorderPoint ?? 0;
                    itemStore.RestockLevel = dto.RestockLevel;
                    itemStore.BinLocation = dto.BinLocation;
                    itemStore.DaysForReturn = dto.DaysForReturn;
                    itemStore.SaleType = dto.SaleType;
                    itemStore.SalePrice = dto.SalePrice;
                    itemStore.SaleStartDate = dto.SaleStartDate;
                    itemStore.SaleEndDate = dto.SaleEndDate;
                    itemStore.SaleMin = dto.SaleMin;
                    itemStore.SaleMax = dto.SaleMax;
                    itemStore.MinForSale = dto.MinForSale;
                    itemStore.SpecialBuy = dto.SpecialBuy;
                    itemStore.SpecialPrice = dto.SpecialPrice;
                    itemStore.SpecialBuyFromDate = dto.SpecialBuyFromDate;
                    itemStore.SpecialBuyToDate = dto.SpecialBuyToDate;
                    itemStore.MixAndMatchID = dto.MixAndMatchID;
                    itemStore.AssignDate = dto.AssignDate;
                    itemStore.CasePrice = dto.CasePrice;
                    itemStore.CaseSpecial = dto.CaseSpecial;
                    itemStore.PkgPrice = dto.PkgPrice;
                    itemStore.PkgQty = dto.PkgQty;
                    itemStore.IsCaseDiscount = dto.IsCaseDiscount;
                    itemStore.IsPkgDiscount = dto.IsPkgDiscount;
                    itemStore.Tare = dto.Tare;
                    itemStore.NewPrice = dto.NewPrice;
                    itemStore.NewPriceDate = dto.NewPriceDate;
                    itemStore.SellOnWeb = dto.SellOnWeb;
                    itemStore.WebCasePrice = dto.WebCasePrice;
                    itemStore.WebPrice = dto.WebPrice;
                    itemStore.DateModified = now;
                    itemStore.UserModified = userId;

                    // No need to call Update() - EF Core tracks changes automatically since entity was fetched from context

                    // Update ItemSupply records - delete existing and recreate
                    var existingSupplies = _unitOfWork.ItemSupplies.GetAll()
                        .Where(s => s.ItemStoreNo == itemStore.ItemStoreID).ToList();
                    if (existingSupplies.Any())
                    {
                        _unitOfWork.ItemSupplies.DeleteRange(existingSupplies);
                    }

                    if (dto.ItemSupplies != null && dto.ItemSupplies.Any())
                    {
                        short sortOrder = 1;
                        foreach (var supplyDto in dto.ItemSupplies)
                        {
                            var itemSupply = new ItemSupply
                            {
                                ItemSupplyID = Guid.NewGuid(),
                                ItemStoreNo = itemStore.ItemStoreID,
                                SupplierNo = supplyDto.SupplierNo,
                                TotalCost = supplyDto.TotalCost,
                                GrossCost = supplyDto.GrossCost,
                                MinimumQty = supplyDto.MinimumQty,
                                QtyPerCase = supplyDto.QtyPerCase,
                                IsOrderedOnlyInCase = supplyDto.IsOrderedOnlyInCase ?? false,
                                AverageDeliveryDelay = supplyDto.AverageDeliveryDelay,
                                ItemCode = supplyDto.ItemCode,
                                IsMainSupplier = supplyDto.IsMainSupplier,
                                SortOrder = supplyDto.SortOrder ?? sortOrder,
                                CaseQty = supplyDto.CaseQty,
                                SalePrice = supplyDto.SalePrice,
                                AssignDate = supplyDto.AssignDate,
                                FromDate = supplyDto.FromDate,
                                ToDate = supplyDto.ToDate,
                                OnSpecialReq = supplyDto.OnSpecialReq,
                                MinQty = supplyDto.MinQty,
                                MaxQty = supplyDto.MaxQty,
                                UOMType = supplyDto.UOMType,
                                ColorName = supplyDto.ColorName,
                                Status = 1,
                                DateCreated = now,
                                UserCreated = userId,
                                DateModified = now,
                                UserModified = userId
                            };

                            if (supplyDto.IsMainSupplier)
                            {
                                itemStore.MainSupplierID = itemSupply.ItemSupplyID;
                            }

                            await _unitOfWork.ItemSupplies.AddAsync(itemSupply);
                            sortOrder++;
                        }
                    }
                    else
                    {
                        itemStore.MainSupplierID = null;
                    }

                    // Update ItemToGroup records - delete existing and recreate
                    var existingGroups = _unitOfWork.ItemToGroups.GetAll()
                        .Where(g => g.ItemStoreID == itemStore.ItemStoreID).ToList();
                    if (existingGroups.Any())
                    {
                        _unitOfWork.ItemToGroups.DeleteRange(existingGroups);
                    }

                    if (dto.ItemToGroups != null && dto.ItemToGroups.Any())
                    {
                        foreach (var groupDto in dto.ItemToGroups)
                        {
                            var itemToGroup = new ItemToGroup
                            {
                                ItemToGroupID = Guid.NewGuid(),
                                ItemStoreID = itemStore.ItemStoreID,
                                ItemGroupID = groupDto.ItemGroupID,
                                Status = 1,
                                DateModified = now
                            };

                            await _unitOfWork.ItemToGroups.AddAsync(itemToGroup);
                        }
                    }

                    // Update ItemAlias records - delete existing and recreate
                    var existingAliases = _unitOfWork.ItemAliases.GetAll()
                        .Where(a => a.ItemNo == itemMain.ItemID).ToList();
                    if (existingAliases.Any())
                    {
                        _unitOfWork.ItemAliases.DeleteRange(existingAliases);
                    }

                    if (dto.ItemAliases != null && dto.ItemAliases.Any())
                    {
                        foreach (var aliasDto in dto.ItemAliases)
                        {
                            if (!string.IsNullOrWhiteSpace(aliasDto.BarcodeNumber))
                            {
                                // Check if alias barcode exists — exclude the current item's own aliases
                                // (they were marked for deletion but not yet committed to DB)
                                if (await _unitOfWork.ItemAliases.BarcodeExistsAsync(aliasDto.BarcodeNumber, null, itemMain.ItemID))
                                {
                                    throw new InvalidOperationException($"Alias barcode '{aliasDto.BarcodeNumber}' already exists.");
                                }

                                var itemAlias = new ItemAlias
                                {
                                    AliasId = Guid.NewGuid(),
                                    ItemNo = itemMain.ItemID,
                                    BarcodeNumber = aliasDto.BarcodeNumber,
                                    Status = 1,
                                    DateCreated = now,
                                    UserCreated = userId,
                                    DateModified = now,
                                    UserModified = userId
                                };

                                await _unitOfWork.ItemAliases.AddAsync(itemAlias);
                            }
                        }
                    }

                    // Save all changes
                    await _unitOfWork.SaveChangesAsync();

                    // Return response
                    var response = new CreateItemResponseDto
                    {
                        ItemID = itemMain.ItemID,
                        ItemStoreID = itemStore.ItemStoreID,
                        BarcodeNumber = itemMain.BarcodeNumber,
                        Name = itemMain.Name,
                        DateCreated = itemMain.DateCreated ?? now
                    };

                    return ApiResponseFactory.Success(response, "Item updated successfully.");
                });
            }
            catch (InvalidOperationException ex)
            {
                // Handle validation errors thrown from within the transaction
                return ApiResponseFactory.BadRequest<CreateItemResponseDto>(ex.Message);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<CreateItemResponseDto>(
                    "Error updating item.",
                    new List<string> { ex.Message, ex.InnerException?.Message ?? "" });
            }
        }

        #endregion

        #region Get Item

        public async Task<ApiResponse<ItemMainAndStoreGridDto?>> GetItemByIdAsync(Guid itemStoreId)
        {
            try
            {
                var item = await _unitOfWork.ItemsMainAndStoreGrids.FirstOrDefaultAsync(i => i.ItemStoreID == itemStoreId);

                if (item == null)
                {
                    return ApiResponseFactory.NotFound<ItemMainAndStoreGridDto?>("Item not found.");
                }

                var dto = _mapper.Map<ItemMainAndStoreGridDto>(item);

                // Fetch fields from ItemMain that are not in the view
                var itemMain = await _unitOfWork.ItemMains.FirstOrDefaultAsync(i => i.ItemID == item.ItemID);
                if (itemMain != null)
                {
                    dto.AddToApp = itemMain.AddToApp;
                    dto.ExtraInfo = itemMain.ExtraInfo;
                    dto.ExtraInfo2 = itemMain.ExtraInfo2;
                    dto.ManufacturerID = itemMain.ManufacturerID;
                    dto.Units = itemMain.Units;
                    dto.Meaasure = itemMain.Meaasure;
                    dto.PatternId = itemMain.ExtName;
                }

                // Fetch fields from ItemStore that are not in the view
                var itemStore = await _unitOfWork.ItemStores.FirstOrDefaultAsync(s => s.ItemStoreID == item.ItemStoreID);
                if (itemStore != null)
                {
                    dto.ExtraCharge1 = itemStore.ExtraCharge1;
                    dto.ExtraCharge2 = itemStore.ExtraCharge2;
                    dto.ExtraCharge3 = itemStore.ExtraCharge3;
                    dto.SaleType = itemStore.SaleType;
                    dto.SalePrice = itemStore.SalePrice;
                    dto.SaleStartDate = itemStore.SaleStartDate;
                    dto.SaleEndDate = itemStore.SaleEndDate;
                    dto.SaleMin = itemStore.SaleMin;
                    dto.SaleMax = itemStore.SaleMax;
                    dto.MinForSale = itemStore.MinForSale;
                    dto.SpecialBuy = itemStore.SpecialBuy;
                    dto.SpecialPrice = itemStore.SpecialPrice;
                    dto.Tare = itemStore.Tare;
                    dto.TaxID = itemStore.TaxID;
                    dto.PkgPrice = itemStore.PkgPrice;
                    dto.PkgQty = itemStore.PkgQty;
                    dto.IsCaseDiscount = itemStore.IsCaseDiscount;
                    dto.IsPkgDiscount = itemStore.IsPkgDiscount;
                    dto.MixAndMatchID = itemStore.MixAndMatchID;
                    dto.AssignDate = itemStore.AssignDate;
                    dto.CaseSpecial = itemStore.CaseSpecial;
                    dto.SpecialCost = itemStore.SpecialCost;
                    // Round-trip fields the form has no UI for.
                    dto.PriceA = itemStore.PriceA;
                    dto.PriceB = itemStore.PriceB;
                    dto.PriceC = itemStore.PriceC;
                    dto.PriceD = itemStore.PriceD;
                    dto.CogsAccount = itemStore.CogsAccount;
                    dto.IncomeAccount = itemStore.IncomeAccount;
                    dto.SpecialBuyFromDate = itemStore.SpecialBuyFromDate;
                    dto.SpecialBuyToDate = itemStore.SpecialBuyToDate;
                    dto.CommissionQty = itemStore.CommissionQty;
                    dto.ProfitCalculation = itemStore.ProfitCalculation;
                    dto.CommissionType = itemStore.CommissionType;
                    // Future pricing from ItemStore - populate if view didn't provide values
                    if (string.IsNullOrEmpty(dto.Future_SP_Price) && itemStore.NewPrice.HasValue && itemStore.NewPrice.Value > 0)
                    {
                        dto.Future_SP_Price = itemStore.NewPrice.Value.ToString("0.00");
                    }
                    if (!dto.Future_SP_From.HasValue && itemStore.NewPriceDate.HasValue)
                    {
                        dto.Future_SP_From = itemStore.NewPriceDate.Value;
                    }

                    // Ensure web fields are populated from ItemStore if view returns null
                    if (dto.SellOnWeb == null) dto.SellOnWeb = itemStore.SellOnWeb;
                    if (dto.WebPrice == null) dto.WebPrice = itemStore.WebPrice;
                    if (dto.WebCasePrice == null) dto.WebCasePrice = itemStore.WebCasePrice;

                    // Pricing "last modified" info
                    dto.LastPriceChange = itemStore.DateModified;
                    if (itemStore.UserModified.HasValue)
                    {
                        var modUser = await _dbContext.Set<WebUser>().FirstOrDefaultAsync(u => u.UserId == itemStore.UserModified.Value);
                        dto.LastModifiedByUser = modUser?.UserName;
                    }
                }

                // Fetch manufacturer name if ManufacturerID is set
                if (dto.ManufacturerID.HasValue)
                {
                    var manufacturer = await _dbContext.Set<Manufacturer>().FirstOrDefaultAsync(m => m.ManufacturerID == dto.ManufacturerID.Value);
                    if (manufacturer != null)
                    {
                        dto.ManufacturerName = manufacturer.ManufacturerName;
                    }
                }

                // Fetch item suppliers (vendors)
                var itemSupplies = await _unitOfWork.ItemSupplies.GetByItemStoreIdAsync(item.ItemStoreID);
                if (itemSupplies != null && itemSupplies.Count > 0)
                {
                    // Get supplier names since navigation properties are not loaded
                    var supplierIds = itemSupplies.Where(s => s.SupplierNo.HasValue).Select(s => s.SupplierNo!.Value).Distinct().ToList();
                    var suppliers = await _dbContext.Set<Supplier>().Where(s => supplierIds.Contains(s.SupplierID)).ToDictionaryAsync(s => s.SupplierID, s => s.Name);

                    dto.ItemSupplies = itemSupplies.Select(s => new ItemSupplyDto
                    {
                        SupplierNo = s.SupplierNo,
                        TotalCost = s.TotalCost,
                        GrossCost = s.GrossCost,
                        QtyPerCase = s.QtyPerCase,
                        IsMainSupplier = s.IsMainSupplier,
                        ItemCode = s.ItemCode,
                        AverageDeliveryDelay = s.AverageDeliveryDelay,
                        SupplierName = s.SupplierNo.HasValue && suppliers.ContainsKey(s.SupplierNo.Value) ? suppliers[s.SupplierNo.Value] : null
                    }).ToList();
                }

                // Fetch item groups (repository already filters Status > 0)
                var itemToGroups = await _unitOfWork.ItemToGroups.GetByItemStoreIdAsync(item.ItemStoreID);
                if (itemToGroups != null && itemToGroups.Count > 0)
                {
                    dto.ItemToGroups = itemToGroups.Select(g => new ItemToGroupDto
                    {
                        ItemGroupID = g.ItemGroupID
                    }).ToList();
                }

                return ApiResponseFactory.Success<ItemMainAndStoreGridDto?>(dto, "Item retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemMainAndStoreGridDto?>(
                    "Error retrieving item.",
                    new List<string> { ex.Message });
            }
        }

        #endregion

        #region Barcode Exists

        public async Task<ApiResponse<bool>> BarcodeExistsAsync(string barcodeNumber, Guid? excludeItemId = null)
        {
            try
            {
                var exists = await _unitOfWork.ItemMains.BarcodeExistsAsync(barcodeNumber, excludeItemId);
                return ApiResponseFactory.Success(exists, exists ? "Barcode exists." : "Barcode is available.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error checking barcode.",
                    new List<string> { ex.Message });
            }
        }

        #endregion

        #region Model Number Exists

        public async Task<ApiResponse<bool>> ModelNumberExistsAsync(string modalNumber, Guid? excludeItemId = null)
        {
            try
            {
                var exists = await _unitOfWork.ItemMains.ModelNumberExistsAsync(modalNumber, excludeItemId);
                return ApiResponseFactory.Success(exists, exists ? "Model number already exists." : "Model number is available.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error checking model number.",
                    new List<string> { ex.Message });
            }
        }

        #endregion

        #region Item Name Exists

        public async Task<ApiResponse<bool>> ItemNameExistsAsync(string name, Guid? excludeItemId = null)
        {
            try
            {
                var query = _dbContext.ItemMains
                    .Where(i => i.Name == name && i.Status > 0);

                if (excludeItemId.HasValue)
                {
                    query = query.Where(i => i.ItemID != excludeItemId.Value);
                }

                var exists = await query.AnyAsync();
                return ApiResponseFactory.Success(exists, exists ? "Item name already exists." : "Item name is available.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error checking item name.",
                    new List<string> { ex.Message });
            }
        }

        #endregion

        #region Alias Barcode Exists

        public async Task<ApiResponse<bool>> AliasBarcodeExistsAsync(string barcodeNumber, Guid? excludeAliasId = null, Guid? excludeItemId = null)
        {
            try
            {
                // Check in ItemAlias table
                var aliasQuery = _dbContext.ItemAliases
                    .Where(a => a.BarcodeNumber == barcodeNumber && a.Status > 0);

                if (excludeAliasId.HasValue)
                {
                    aliasQuery = aliasQuery.Where(a => a.AliasId != excludeAliasId.Value);
                }

                // Exclude aliases belonging to the current item (so editing an item's own aliases doesn't trigger false positives)
                if (excludeItemId.HasValue)
                {
                    aliasQuery = aliasQuery.Where(a => a.ItemNo != excludeItemId.Value);
                }

                var aliasExists = await aliasQuery.AnyAsync();

                // Also check in ItemMain table (can't use a main barcode as an alias)
                // But exclude the current item's own barcode
                var mainQuery = _dbContext.ItemMains
                    .Where(i => i.BarcodeNumber == barcodeNumber && i.Status > 0);

                if (excludeItemId.HasValue)
                {
                    mainQuery = mainQuery.Where(i => i.ItemID != excludeItemId.Value);
                }

                var mainExists = await mainQuery.AnyAsync();

                var exists = aliasExists || mainExists;
                return ApiResponseFactory.Success(exists, exists ? "Barcode already exists." : "Barcode is available for alias.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error checking alias barcode.",
                    new List<string> { ex.Message });
            }
        }

        #endregion

        #region Generate Item Code


        public async Task<ApiResponse<string>> GenerateItemCodeAsync(string codeType, Guid? storeId = null)
        {
            try
            {
                var key = (codeType ?? string.Empty).Trim().ToLowerInvariant();
                string tableName;
                int seed;
                switch (key)
                {
                    case "upc":
                    case "barcode":
                    case "case":
                    case "pkg":
                    case "package":
                        tableName = "ItemsMain"; seed = 10001; break;
                    case "model":
                    case "modal":
                    case "style":
                        tableName = "ItemModal"; seed = 1001; break;
                    default:
                        return ApiResponseFactory.BadRequest<string>(
                            $"Unknown code type '{codeType}'. Expected one of: upc, case, pkg, model, style.");
                }

                const int maxAttempts = 100;
                for (int attempt = 0; attempt < maxAttempts; attempt++)
                {

                    var result = await _dbContext.Procedures.SP_GetNewNumberAsync(null, tableName, seed);
                    var nextNumber = result?.FirstOrDefault()?.NewNumber;
                    if (!nextNumber.HasValue)
                    {
                        return ApiResponseFactory.InternalError<string>(
                            "SP_GetNewNumber returned no value.",
                            new List<string>());
                    }

                    var code = nextNumber.Value.ToString();
                    var existsMessage = await CodeExistsAsync(code, Guid.Empty);
                    if (string.IsNullOrEmpty(existsMessage))
                    {
                        return ApiResponseFactory.Success(code, "Code generated.");
                    }
                }

                return ApiResponseFactory.InternalError<string>(
                    "Could not generate a unique code after multiple attempts.",
                    new List<string>());
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<string>(
                    "Error generating item code.",
                    new List<string> { ex.Message });
            }
        }

        private async Task<string> CodeExistsAsync(string code, Guid itemId)
        {
            var connection = _dbContext.Database.GetDbConnection();
            var wasClosed = connection.State == ConnectionState.Closed;
            try
            {
                if (wasClosed) await connection.OpenAsync();
                using var cmd = connection.CreateCommand();
                cmd.CommandType = CommandType.StoredProcedure;
                cmd.CommandText = "dbo.SP_Code_Exists";

                var pItem = cmd.CreateParameter();
                pItem.ParameterName = "@ItemID";
                pItem.DbType = DbType.Guid;
                pItem.Value = itemId;
                cmd.Parameters.Add(pItem);

                var pCode = cmd.CreateParameter();
                pCode.ParameterName = "@Code";
                pCode.DbType = DbType.String;
                pCode.Size = 50;
                pCode.Value = code ?? (object)DBNull.Value;
                cmd.Parameters.Add(pCode);

                var scalar = await cmd.ExecuteScalarAsync();
                return scalar?.ToString() ?? string.Empty;
            }
            finally
            {
                if (wasClosed && connection.State == ConnectionState.Open)
                {
                    await connection.CloseAsync();
                }
            }
        }

        #endregion

        #region Department Defaults

        public async Task<ApiResponse<Application.DTOs.Tenant.Lookup.DepartmentDefaultsDto?>> GetDepartmentDefaultsAsync(Guid departmentStoreId)
        {
            try
            {
                var dept = await _dbContext.DepartmentStores
                    .Where(d => d.DepartmentStoreID == departmentStoreId)
                    .Select(d => new Application.DTOs.Tenant.Lookup.DepartmentDefaultsDto
                    {
                        DepartmentStoreID = d.DepartmentStoreID,
                        Name = d.Name ?? "",
                        DefaultMarkup = d.DefaultMarkup,
                        RoundUp = d.RoundUp,
                        RoundValue = d.RoundValue,
                        DefaultTaxNo = d.DefaultTaxNo,
                        IsDefaultTaxInclude = d.IsDefaultTaxInclude,
                        IsDefaultFoodStampable = d.IsDefaultFoodStampable,
                        IsDefaultDiscountable = d.IsDefaultDiscountable,
                        DefaultCogsAccount = d.DefaultCogsAccount,
                        DefaultIncomeAccount = d.DefaultIncomeAccount,
                    })
                    .FirstOrDefaultAsync();

                if (dept == null)
                {
                    return ApiResponseFactory.NotFound<Application.DTOs.Tenant.Lookup.DepartmentDefaultsDto?>("Department not found.");
                }

                return ApiResponseFactory.Success<Application.DTOs.Tenant.Lookup.DepartmentDefaultsDto?>(dept, "Department defaults loaded.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<Application.DTOs.Tenant.Lookup.DepartmentDefaultsDto?>(
                    "Error loading department defaults.",
                    new List<string> { ex.Message });
            }
        }

        #endregion

        #region Get All Items

        public ApiResponse<PaginationResponseDTO<ItemMainAndStoreGridDto>> GetAllItemsMainAndStoreGridAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _unitOfWork.ItemsMainAndStoreGrids.GetAll().AsQueryable();

                // Filter by StoreId if provided
                if (paginationGridDto.StoreId.HasValue)
                {
                    query = query.Where(x => x.StoreNo == paginationGridDto.StoreId.Value);
                }

                // Default: show only active items (Status > 0 AND MainStatus > 0)
                // Show Inactive: include inactive items too (Status > -1 AND MainStatus > -1), excludes deleted
                if (paginationGridDto.ShowInactive == true)
                {
                    query = query.Where(x => x.Status > -1 && x.MainStatus > -1);
                }
                else
                {
                    query = query.Where(x => x.Status > 0 && x.MainStatus > 0);
                }

                // Quick filter: Sale Items - items with SP_Price or Future_SP_Price set
                //
                // Performance: the natural predicate
                //   (x.SP_Price != null && x.SP_Price != "") ||
                //   (x.Future_SP_Price != null && x.Future_SP_Price != "")
                // alone forces dbo.ItemMainAndStoreGrid (a 12-table view) to
                // materialize every catalog row, then evaluate two CASE expressions,
                // then OR them. On production data we measured ~144 s / 5.5M logical
                // reads to return 26 rows because nested loops re-probed
                // ItemMain/ItemStore/ItemToGroup tens of thousands of times.
                //
                // Reading the view's definition shows where the two columns come
                // from:
                //   [SP Price]        -- CASE on dbo.ItemStore.SaleType + related cols
                //   [Future SP Price] -- CASE on dbo.ItemSpecial.SaleType + related cols
                //
                // So we pre-filter ItemStoreID to the union of the two candidate sets
                // (rows with a current sale on ItemStore, plus rows with a future
                // sale row on ItemSpecial). That's tiny — backed by:
                //   IX_ItemStore_OnSale       (Scripts/TenantDB/20260529_*)
                //   IX_ItemSpecial_ActiveSale (Scripts/TenantDB/20260528_*)
                // The original OR predicate is kept after the pre-filter so the view's
                // CASE logic still gets the final say — pre-filter only seeds the
                // candidate set, the view decides the final inclusion.
                if (paginationGridDto.SaleItems == true)
                {
                    var currentSaleIds = _dbContext.ItemStores
                        .Where(s => s.SaleType != null && s.SaleType > 0)
                        .Select(s => s.ItemStoreID);

                    var futureSaleIds = _dbContext.ItemSpecials
                        .Where(s => s.ItemStoreID != null
                                 && s.Status > -1
                                 && s.SaleType != null && s.SaleType > 0)
                        .Select(s => s.ItemStoreID!.Value);

                    var onSaleCandidateIds = currentSaleIds.Union(futureSaleIds);

                    query = query.Where(x => onSaleCandidateIds.Contains(x.ItemStoreID));

                    query = query.Where(x =>
                        (x.SP_Price != null && x.SP_Price != "") ||
                        (x.Future_SP_Price != null && x.Future_SP_Price != ""));
                }

                // Quick filter: Low / Negative Stock - items with on-hand <= 0 or below reorder point
                if (paginationGridDto.LowStock == true)
                {
                    query = query.Where(x => x.OnHand <= 0 || x.OnHand <= x.ReorderPoint);
                }

                // Quick filter: Missing Barcode - items with no barcode
                if (paginationGridDto.MissingBarcode == true)
                {
                    query = query.Where(x => x.BarcodeNumber == null || x.BarcodeNumber == "");
                }

                // Quick filter: Zero Cost - items where cost is 0 or null
                if (paginationGridDto.ZeroCost == true)
                {
                    query = query.Where(x => x.Cost == null || x.Cost == 0);
                }

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;  // Save the filtered query for counting

                // Calculate total records - apply same store and status filters for accurate count
                int totalRecords;
                var totalQuery = _unitOfWork.ItemsMainAndStoreGrids.GetAll().AsQueryable();
                if (paginationGridDto.StoreId.HasValue)
                {
                    totalQuery = totalQuery.Where(x => x.StoreNo == paginationGridDto.StoreId.Value);
                }
                if (paginationGridDto.ShowInactive == true)
                {
                    totalQuery = totalQuery.Where(x => x.Status > -1 && x.MainStatus > -1);
                }
                else
                {
                    totalQuery = totalQuery.Where(x => x.Status > 0 && x.MainStatus > 0);
                }
                totalRecords = totalQuery.Count();
                var filteredRecords = filteredQuery.Count();  // Get filtered record count

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn, paginationGridDto.SortDirection);

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var data = _mapper.Map<List<ItemMainAndStoreGridDto>>(paginatedData);

                // Enrich with IsDisableOnPO from ItemMain (not in the SQL view)
                var itemIds = data.Select(d => d.ItemID).Distinct().ToList();
                if (itemIds.Any())
                {
                    var disableOnPOMap = _dbContext.ItemMains
                        .Where(im => itemIds.Contains(im.ItemID))
                        .Select(im => new { im.ItemID, im.IsDisableOnPO })
                        .ToDictionary(x => x.ItemID, x => x.IsDisableOnPO);

                    foreach (var item in data)
                    {
                        if (disableOnPOMap.TryGetValue(item.ItemID, out var isDisabled))
                        {
                            item.IsDisableOnPO = isDisabled;
                        }
                    }
                }

                var response = new PaginationResponseDTO<ItemMainAndStoreGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,              // Total records (without filters)
                    RecordsFiltered = filteredRecords,        // Total records after applying filters
                    CurrentPage = (int)Math.Ceiling((double)paginationGridDto.EndRow / paginationGridDto.StartRow), // Calculate current page
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,    // Page size for pagination
                    Data = data
                };

                return ApiResponseFactory.Success(response, "Item list fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ItemMainAndStoreGridDto>>(
                    "Error fetching items.",
                    new List<string> { ex.Message });
            }
        }

        /// <summary>
        /// Server-side aggregation for the Item List summary cards. Applies the
        /// SAME filter set GetAllItemsMainAndStoreGridAsync uses (store, status,
        /// quick filters, free-text search + column filters from <c>Filters</c>)
        /// and returns count + sums + averages across every matching row.
        ///
        /// Without this the summary cards on the page sum only the rows that
        /// infinite scroll has loaded so far, so the numbers grow as the user
        /// scrolls — confusing and unrelated to "total catalog value".
        /// </summary>
        public ApiResponse<ItemsTotalsDto> GetItemsTotalsAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                // Re-build the same filtered query GetAllItemsMainAndStoreGridAsync
                // constructs (minus paging + sort). Kept inline rather than
                // factored into a shared helper to minimize the diff against
                // the existing list method — if either drifts, both need to
                // be updated together.
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();
                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _unitOfWork.ItemsMainAndStoreGrids.GetAll().AsQueryable();

                if (paginationGridDto.StoreId.HasValue)
                {
                    query = query.Where(x => x.StoreNo == paginationGridDto.StoreId.Value);
                }

                if (paginationGridDto.ShowInactive == true)
                {
                    query = query.Where(x => x.Status > -1 && x.MainStatus > -1);
                }
                else
                {
                    query = query.Where(x => x.Status > 0 && x.MainStatus > 0);
                }

                // Same pre-filter as GetAllItemsMainAndStoreGridAsync. See that
                // method for the full explanation of why this pattern is needed.
                if (paginationGridDto.SaleItems == true)
                {
                    var currentSaleIds = _dbContext.ItemStores
                        .Where(s => s.SaleType != null && s.SaleType > 0)
                        .Select(s => s.ItemStoreID);

                    var futureSaleIds = _dbContext.ItemSpecials
                        .Where(s => s.ItemStoreID != null
                                 && s.Status > -1
                                 && s.SaleType != null && s.SaleType > 0)
                        .Select(s => s.ItemStoreID!.Value);

                    var onSaleCandidateIds = currentSaleIds.Union(futureSaleIds);

                    query = query.Where(x => onSaleCandidateIds.Contains(x.ItemStoreID));

                    query = query.Where(x =>
                        (x.SP_Price != null && x.SP_Price != "") ||
                        (x.Future_SP_Price != null && x.Future_SP_Price != ""));
                }

                if (paginationGridDto.LowStock == true)
                {
                    query = query.Where(x => x.OnHand <= 0 || x.OnHand <= x.ReorderPoint);
                }

                if (paginationGridDto.MissingBarcode == true)
                {
                    query = query.Where(x => x.BarcodeNumber == null || x.BarcodeNumber == "");
                }

                if (paginationGridDto.ZeroCost == true)
                {
                    query = query.Where(x => x.Cost == null || x.Cost == 0);
                }

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                // Aggregate in a single query — pushes work to SQL Server,
                // avoids loading every row's payload into memory just to sum
                // a few columns. Decimal? columns are coalesced to 0 to
                // mirror the previous client-side behavior (NULLs counted
                // as zero contributions).
                var totals = query
                    .GroupBy(_ => 1)
                    .Select(g => new ItemsTotalsDto
                    {
                        TotalCount = g.Count(),
                        PriceSum = g.Sum(x => x.Price),
                        CostSum = g.Sum(x => x.Cost ?? 0m),
                        AvgPcCost = g.Average(x => x.Pc_Cost ?? 0m),
                        OnHandValue = g.Sum(x => (x.Pc_Cost ?? 0m) * x.OnHand)
                    })
                    .FirstOrDefault() ?? new ItemsTotalsDto();

                return ApiResponseFactory.Success(totals, "Item totals computed successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemsTotalsDto>(
                    "Error computing item totals.",
                    new List<string> { ex.Message });
            }
        }

        public ApiResponse<PaginationResponseDTO<ItemQuickListGridDto>> GetAllItemsQuickListAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _dbContext.ItemsQuickListViews
                    .Select(x => new ItemQuickListGridDto
                    {
                        ItemStoreID = x.ItemStoreID,
                        ItemID = x.ItemID,
                        Department = x.Deparment,
                        Name = x.Name,
                        ModelNo = x.ModelNo,
                        UPC = x.UPC,
                        Supplier = x.Supplier,
                        StoreNo = x.StoreNo,
                        Price = x.Price,
                        OnHand = x.OnHand
                    })
                    .AsQueryable();

                // Filter by StoreId if provided
                if (paginationGridDto.StoreId.HasValue)
                {
                    query = query.Where(x => x.StoreNo == paginationGridDto.StoreId.Value);
                }

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;

                // Calculate total records
                int totalRecords;
                if (paginationGridDto.StoreId.HasValue)
                {
                    totalRecords = _dbContext.ItemsQuickListViews
                        .Count(x => x.StoreNo == paginationGridDto.StoreId.Value);
                }
                else
                {
                    totalRecords = _dbContext.ItemsQuickListViews.Count();
                }
                var filteredRecords = filteredQuery.Count();

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn ?? "Name", paginationGridDto.SortDirection ?? "asc");

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var response = new PaginationResponseDTO<ItemQuickListGridDto>
                {
                    Filters = paginationGridDto.Filters,
                    TotalRecords = totalRecords,
                    RecordsFiltered = filteredRecords,
                    CurrentPage = paginationGridDto.StartRow > 0 ? (int)Math.Ceiling((double)paginationGridDto.EndRow / (paginationGridDto.EndRow - paginationGridDto.StartRow)) : 1,
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,
                    Data = paginatedData
                };

                return ApiResponseFactory.Success(response, "Items quick list fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<ItemQuickListGridDto>>(
                    "Error fetching items quick list.",
                    new List<string> { ex.Message });
            }
        }

        #endregion

        #region Image Methods

        public async Task<ApiResult<bool>> UpdateItemImageAsync(Guid itemId, string? imagePath, int imageSlot)
        {
            try
            {
                var item = await _unitOfWork.ItemMains.FirstOrDefaultAsync(i => i.ItemID == itemId);
                if (item == null)
                {
                    return new ApiResult<bool> { IsSuccess = false, Message = "Item not found." };
                }

                switch (imageSlot)
                {
                    case 1:
                        item.PicturePath = imagePath;
                        break;
                    case 2:
                        item.PicturePath2 = imagePath;
                        break;
                    case 3:
                        item.PicturePath3 = imagePath;
                        break;
                    default:
                        return new ApiResult<bool> { IsSuccess = false, Message = "Invalid image slot." };
                }

                item.DateModified = DateTime.Now;
                // No need to call Update() - EF Core tracks changes automatically since entity was fetched from context
                await _unitOfWork.SaveChangesAsync();

                return new ApiResult<bool> { IsSuccess = true, Response = true, Message = "Image path updated successfully." };
            }
            catch (Exception ex)
            {
                return new ApiResult<bool> { IsSuccess = false, Message = $"Error updating image: {ex.Message}" };
            }
        }

        public async Task<ApiResult<string?>> GetItemImagePathAsync(Guid itemId, int imageSlot)
        {
            try
            {
                var item = await _unitOfWork.ItemMains.FirstOrDefaultAsync(i => i.ItemID == itemId);
                if (item == null)
                {
                    return new ApiResult<string?> { IsSuccess = false, Message = "Item not found." };
                }

                string? path = imageSlot switch
                {
                    1 => item.PicturePath,
                    2 => item.PicturePath2,
                    3 => item.PicturePath3,
                    _ => null
                };

                return new ApiResult<string?> { IsSuccess = true, Response = path };
            }
            catch (Exception ex)
            {
                return new ApiResult<string?> { IsSuccess = false, Message = $"Error getting image path: {ex.Message}" };
            }
        }

        #endregion

        #region Items With Inventory Report

        /// <summary>
        /// Gets items with inventory data across all stores (pivoted by store) with pagination
        /// Calls SP_GetItemsWithInventory stored procedure and pivots the data
        /// </summary>
        public async Task<ApiResponse<ItemsWithInventoryReportDto>> GetItemsWithInventoryAsync(
            ItemsWithInventoryRequestDto request,
            Guid? localUserId,
            bool isSuperAdmin)
        {
            try
            {
                var pageNumber = request.PageNumber < 1 ? 1 : request.PageNumber;
                var pageSize = request.PageSize < 1 ? 100 : request.PageSize;

                ItemsWithInventoryReportDto EmptyPage(string message)
                    => new ItemsWithInventoryReportDto
                    {
                        Stores = new List<StoreColumnDto>(),
                        Items = new List<ItemWithInventoryDto>(),
                        TotalCount = 0,
                        PageNumber = pageNumber,
                        PageSize = pageSize,
                        TotalPages = 0
                    };

                List<Guid>? allowedStoreIds = null;
                if (!isSuperAdmin)
                {
                    if (localUserId == null || localUserId == Guid.Empty)
                    {
                        return ApiResponseFactory.Success(EmptyPage("No assigned stores for current user."), "No assigned stores for current user.");
                    }

                    allowedStoreIds = await _dbContext.WebUsersStores
                        .Where(us => us.UserID == localUserId && us.StoreID != null)
                        .Select(us => us.StoreID!.Value)
                        .Distinct()
                        .ToListAsync();

                    if (allowedStoreIds.Count == 0)
                    {
                        return ApiResponseFactory.Success(EmptyPage("No assigned stores for current user."), "No assigned stores for current user.");
                    }
                }

                if (request.StoreId.HasValue)
                {
                    if (allowedStoreIds != null && !allowedStoreIds.Contains(request.StoreId.Value))
                    {
                        return ApiResponseFactory.Success(EmptyPage("Requested store is not assigned to current user."), "Requested store is not assigned to current user.");
                    }
                    allowedStoreIds = new List<Guid> { request.StoreId.Value };
                }

                var storeIdsParam = allowedStoreIds == null
                    ? null
                    : string.Join(",", allowedStoreIds);

                var storeColumnsQuery = _dbContext.Stores.AsQueryable();
                if (allowedStoreIds != null)
                {
                    var storeFilter = allowedStoreIds;
                    storeColumnsQuery = storeColumnsQuery.Where(s => storeFilter.Contains(s.StoreID));
                }
                var storeColumns = await storeColumnsQuery
                    .OrderBy(s => s.StoreInt)
                    .Select(s => new StoreColumnDto
                    {
                        StoreID = s.StoreID,
                        StoreName = s.StoreName ?? string.Empty,
                        StoreInt = s.StoreInt
                    })
                    .ToListAsync();

                var rows = await _dbContext.Procedures.SP_GetItemsWithInventoryLongAsync(
                    storeIdsParam,
                    request.SearchText,
                    pageNumber,
                    pageSize);

                if (rows == null || rows.Count == 0)
                {
                    return ApiResponseFactory.Success(new ItemsWithInventoryReportDto
                    {
                        Stores = storeColumns,
                        Items = new List<ItemWithInventoryDto>(),
                        TotalCount = 0,
                        PageNumber = pageNumber,
                        PageSize = pageSize,
                        TotalPages = 0
                    }, "No items found.");
                }

                var totalCount = rows[0].TotalCount;

                var pagedItems = rows
                    .GroupBy(r => new { r.ItemNo, r.BarcodeNumber, r.Name, r.ModalNumber })
                    .Select(g => new ItemWithInventoryDto
                    {
                        ItemNo = g.Key.ItemNo,
                        ItemStoreID = g.First().ItemStoreID,
                        BarcodeNumber = g.Key.BarcodeNumber ?? string.Empty,
                        Name = g.Key.Name ?? string.Empty,
                        ModalNumber = g.Key.ModalNumber ?? string.Empty,
                        // Key the per-store map by StoreID (lower-cased GUID) instead of
                        // StoreName: GUIDs are immune to the whitespace/casing/duplicate-
                        // name problems that silently broke the previous name-keyed dict.
                        // The frontend looks up via store.storeID from the stable column
                        // list built off the Stores table.
                        StoreData = g
                            .GroupBy(r => r.StoreID)
                            .ToDictionary(
                                sg => sg.Key.ToString(),
                                sg =>
                                {
                                    var r = sg.First();
                                    return new StoreInventoryDto
                                    {
                                        StoreID = r.StoreID,
                                        StoreName = r.StoreName ?? string.Empty,
                                        StoreInt = r.StoreInt,
                                        Cost = r.Cost,
                                        Price = r.Price,
                                        OnHand = r.OnHand,
                                        OnOrder = r.OnOrder,
                                        OnTransfer = r.OnTransferOrder
                                    };
                                }
                            )
                    })
                    .OrderBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(i => i.BarcodeNumber, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

                var response = new ItemsWithInventoryReportDto
                {
                    Stores = storeColumns,
                    Items = pagedItems,
                    TotalCount = totalCount,
                    PageNumber = pageNumber,
                    PageSize = pageSize,
                    TotalPages = totalPages
                };

                return ApiResponseFactory.Success(response, "Items with inventory retrieved successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<ItemsWithInventoryReportDto>(
                    "Error fetching items with inventory.",
                    new List<string> { ex.Message, ex.InnerException?.Message ?? "" });
            }
        }

        #endregion

        #region Toggle Item Status

        public async Task<ApiResponse<bool>> ToggleItemStatusAsync(Guid itemStoreId, Guid modifierId)
        {
            try
            {
                var itemStore = await _dbContext.ItemStores.FirstOrDefaultAsync(x => x.ItemStoreID == itemStoreId);
                if (itemStore == null)
                {
                    return ApiResponseFactory.NotFound<bool>("Item not found.");
                }

                // Toggle between active (0) and inactive (1)
                itemStore.Status = itemStore.Status == 0 ? (short)1 : (short)0;
                itemStore.DateModified = DateTime.UtcNow;
                itemStore.UserModified = modifierId;

                await _dbContext.SaveChangesAsync();

                var statusText = itemStore.Status == 0 ? "active" : "inactive";
                return ApiResponseFactory.Success(true, $"Item marked as {statusText} successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error toggling item status.",
                    new List<string> { ex.Message });
            }
        }

        #endregion

        #region Bulk Operations

        public async Task<ApiResponse<bool>> BulkActivateAsync(List<Guid> itemStoreIds, Guid modifierId)
        {
            try
            {
                var items = await _dbContext.ItemStores
                    .Where(x => itemStoreIds.Contains(x.ItemStoreID))
                    .ToListAsync();

                if (!items.Any())
                    return ApiResponseFactory.NotFound<bool>("No items found.");

                foreach (var item in items)
                {
                    item.Status = 1; // Active
                    item.DateModified = DateTime.UtcNow;
                    item.UserModified = modifierId;
                }

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, $"{items.Count} items activated successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error activating items.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> BulkDeactivateAsync(List<Guid> itemStoreIds, Guid modifierId)
        {
            try
            {
                var items = await _dbContext.ItemStores
                    .Where(x => itemStoreIds.Contains(x.ItemStoreID))
                    .ToListAsync();

                if (!items.Any())
                    return ApiResponseFactory.NotFound<bool>("No items found.");

                foreach (var item in items)
                {
                    item.Status = 0; // Inactive
                    item.DateModified = DateTime.UtcNow;
                    item.UserModified = modifierId;
                }

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, $"{items.Count} items deactivated successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error deactivating items.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> BulkTogglePhoneOrderAsync(List<Guid> itemStoreIds, Guid modifierId)
        {
            try
            {
                // Get the ItemMain IDs from ItemStore IDs
                var itemStores = await _dbContext.ItemStores
                    .Where(x => itemStoreIds.Contains(x.ItemStoreID))
                    .Select(x => x.ItemNo)
                    .Distinct()
                    .ToListAsync();

                if (!itemStores.Any())
                    return ApiResponseFactory.NotFound<bool>("No items found.");

                var itemMains = await _dbContext.ItemMains
                    .Where(x => itemStores.Contains(x.ItemID))
                    .ToListAsync();

                var alreadyDisabled = 0;
                var newlyDisabled = 0;
                foreach (var item in itemMains)
                {
                    if (item.IsDisableOnPO == true)
                    {
                        alreadyDisabled++;
                        continue;
                    }
                    item.IsDisableOnPO = true;
                    item.DateModified = DateTime.UtcNow;
                    item.UserModified = modifierId;
                    newlyDisabled++;
                }

                await _dbContext.SaveChangesAsync();

                var message = $"{newlyDisabled} items disabled for phone orders.";
                if (alreadyDisabled > 0)
                    message += $" {alreadyDisabled} were already disabled.";
                return ApiResponseFactory.Success(true, message);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error toggling phone order status.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> BulkEnablePhoneOrderAsync(List<Guid> itemStoreIds, Guid modifierId)
        {
            try
            {
                var itemStores = await _dbContext.ItemStores
                    .Where(x => itemStoreIds.Contains(x.ItemStoreID))
                    .Select(x => x.ItemNo)
                    .Distinct()
                    .ToListAsync();

                if (!itemStores.Any())
                    return ApiResponseFactory.NotFound<bool>("No items found.");

                var itemMains = await _dbContext.ItemMains
                    .Where(x => itemStores.Contains(x.ItemID))
                    .ToListAsync();

                var alreadyEnabled = 0;
                var newlyEnabled = 0;
                foreach (var item in itemMains)
                {
                    if (item.IsDisableOnPO != true)
                    {
                        alreadyEnabled++;
                        continue;
                    }
                    item.IsDisableOnPO = false;
                    item.DateModified = DateTime.UtcNow;
                    item.UserModified = modifierId;
                    newlyEnabled++;
                }

                await _dbContext.SaveChangesAsync();

                var message = $"{newlyEnabled} items enabled for phone orders.";
                if (alreadyEnabled > 0)
                    message += $" {alreadyEnabled} were already enabled.";
                return ApiResponseFactory.Success(true, message);
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error enabling items for phone orders.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> BulkDeleteAsync(List<Guid> itemStoreIds, Guid modifierId)
        {
            try
            {
                var items = await _dbContext.ItemStores
                    .Where(x => itemStoreIds.Contains(x.ItemStoreID))
                    .ToListAsync();

                if (!items.Any())
                    return ApiResponseFactory.NotFound<bool>("No items found.");

                foreach (var item in items)
                {
                    item.Status = -1; // Deleted (mark as deleted, not physical delete)
                    item.DateModified = DateTime.UtcNow;
                    item.UserModified = modifierId;
                }

                await _dbContext.SaveChangesAsync();
                return ApiResponseFactory.Success(true, $"{items.Count} items deleted successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error deleting items.",
                    new List<string> { ex.Message });
            }
        }

        #endregion

        #region Matrix Children
        //
        // Port of the legacy desktop FrmMatrix.vb. A "matrix parent"
        // item (ItemType = MatrixParent = 2) has child variants whose
        // ItemMain.LinkNo points to the parent's ItemID. Each child
        // also has its own per-store ItemStore row holding price/cost/
        // on-hand. All matrix ops are store-scoped because pricing is
        // store-specific in this schema.
        //
        // The desktop uses ItemType enum values 1=MatrixChild, 2=Matrix
        // (parent). The web form uses string "2" = parent, "3" = child
        // — see DEFAULT_ITEM_TYPE_OPTIONS in ItemFormPage.tsx. We pass
        // through whatever number is stored in DB; the web form maps it
        // back. Filter is by LinkNo, not by ItemType, so the enum
        // mismatch doesn't bite here.

        private const short StatusActive = 1;
        private const short StatusDeleted = 0;
        // Mirrors legacy GlobalTypes.vb ItemType enum:
        //   Standard = 0 | MatrixChild = 1 | Matrix = 2 | Service = 3
        //   TagAlong = 7 | Weight = 10
        // The desktop POS + reports filter by these exact integers,
        // so new matrix children written from the web MUST use them.
        private const int ItemTypeMatrixChild = 1;

        /// <summary>
        /// Computes the per-piece cost the desktop's "Pc Cost" column
        /// shows: prefer the stored NetCost (which the desktop sets
        /// when CaseQty changes), else fall back to Cost/CaseQty.
        /// </summary>
        private static decimal? ComputePcCost(decimal? cost, decimal? netCost, int? caseQty)
        {
            if (netCost.HasValue && netCost.Value > 0) return netCost;
            if (caseQty.HasValue && caseQty.Value > 0 && cost.HasValue)
                return Math.Round(cost.Value / caseQty.Value, 4);
            return cost;
        }

        private static (decimal? margin, decimal? markup) ComputeMarginMarkup(decimal? cost, decimal? price)
        {
            decimal? margin = null, markup = null;
            if (price.HasValue && price.Value != 0m && cost.HasValue)
                margin = Math.Round((price.Value - cost.Value) * 100m / price.Value, 2);
            if (cost.HasValue && cost.Value != 0m && price.HasValue)
                markup = Math.Round((price.Value - cost.Value) * 100m / cost.Value, 2);
            return (margin, markup);
        }

        private static MatrixChildDto MapToMatrixChild(ItemMain main, ItemStore? store)
        {
            var pcCost = ComputePcCost(store?.Cost, store?.NetCost, main.CaseQty);
            var (margin, markup) = ComputeMarginMarkup(store?.Cost, store?.Price);
            return new MatrixChildDto
            {
                ItemID       = main.ItemID,
                ItemStoreID  = store?.ItemStoreID,
                Name         = main.Name,
                Barcode      = main.BarcodeNumber,
                Cost         = store?.Cost,
                PcCost       = pcCost,
                Price        = store?.Price,
                SpecialCost  = store?.SpecialCost,
                Color        = main.Matrix1,
                Size         = main.Matrix2,
                OnHand       = store?.OnHand,
                ModelNumber  = main.ModalNumber,
                LinkNo       = main.LinkNo,
                StyleNumber  = main.StyleNo,
                Margin       = margin,
                Markup       = markup,
            };
        }

        public async Task<ApiResponse<List<MatrixChildDto>>> GetMatrixChildrenAsync(Guid parentItemId, Guid storeId)
        {
            try
            {
                if (parentItemId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<List<MatrixChildDto>>("parentItemId is required.");
                if (storeId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<List<MatrixChildDto>>("storeId is required.");

                // Left-join children to ItemStore for this store. Children
                // without an ItemStore row in the chosen store still show
                // up (with null cost/price/on-hand) so the user can spot
                // missing per-store data and edit it in place.
                var children = await (
                    from m in _unitOfWork.ItemMains.GetAll()
                    where m.LinkNo == parentItemId && (m.Status ?? 0) > 0
                    join s in _unitOfWork.ItemStores.GetAll().Where(x => x.StoreNo == storeId && (x.Status ?? 0) > 0)
                        on m.ItemID equals s.ItemNo into stores
                    from store in stores.DefaultIfEmpty()
                    orderby m.Matrix1, m.Matrix2, m.Name
                    select new { Main = m, Store = store }
                ).AsNoTracking().ToListAsync();

                var dtos = children.Select(c => MapToMatrixChild(c.Main, c.Store)).ToList();
                return ApiResponseFactory.Success(dtos, $"{dtos.Count} matrix children loaded.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<MatrixChildDto>>(
                    "Error loading matrix children.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<MatrixChildDto>> UpdateMatrixChildAsync(Guid itemStoreId, MatrixChildPatchDto patch, Guid userId)
        {
            try
            {
                if (itemStoreId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<MatrixChildDto>("itemStoreId is required.");
                if (patch == null)
                    return ApiResponseFactory.BadRequest<MatrixChildDto>("Patch body is required.");

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var store = await _unitOfWork.ItemStores.FirstOrDefaultAsync(s => s.ItemStoreID == itemStoreId);
                    if (store == null)
                        return ApiResponseFactory.NotFound<MatrixChildDto>("Matrix child store row not found.");

                    var main = await _unitOfWork.ItemMains.FirstOrDefaultAsync(m => m.ItemID == store.ItemNo);
                    if (main == null)
                        return ApiResponseFactory.NotFound<MatrixChildDto>("Matrix child item row not found.");

                    var now = DateTime.UtcNow;

                    // --- ItemMain edits (identifiers + matrix axes) ---
                    if (patch.Name != null)        main.Name = patch.Name;
                    if (patch.Barcode != null)     main.BarcodeNumber = patch.Barcode;
                    if (patch.ModelNumber != null) main.ModalNumber = patch.ModelNumber;
                    if (patch.StyleNumber != null) main.StyleNo = patch.StyleNumber;
                    if (patch.Color != null)       main.Matrix1 = patch.Color;
                    if (patch.Size != null)        main.Matrix2 = patch.Size;
                    main.DateModified = now;
                    main.UserModified = userId;

                    // --- ItemStore edits (per-store pricing) ---
                    if (patch.Cost.HasValue)        store.Cost = patch.Cost;
                    if (patch.SpecialCost.HasValue) store.SpecialCost = patch.SpecialCost;
                    if (patch.Price.HasValue)       store.Price = patch.Price;
                    // Refresh NetCost when cost changed so the Pc Cost
                    // column updates without a full save round trip.
                    if (patch.Cost.HasValue)
                    {
                        store.NetCost = ComputePcCost(patch.Cost, null, main.CaseQty);
                    }
                    store.DateModified = now;
                    store.UserModified = userId;

                    await _unitOfWork.SaveChangesAsync();

                    return ApiResponseFactory.Success(MapToMatrixChild(main, store), "Matrix child updated.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<MatrixChildDto>(
                    "Error updating matrix child.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<int>> BulkUpdateMatrixCostAsync(Guid parentItemId, MatrixBulkCostDto dto, Guid userId)
        {
            try
            {
                if (parentItemId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<int>("parentItemId is required.");
                if (dto == null || dto.StoreId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<int>("storeId is required.");

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    // Load only the ItemStore rows we need to mutate.
                    // ItemMain is needed for the CaseQty -> NetCost
                    // recompute, fetched into a dict so we don't N+1.
                    var children = await (
                        from m in _unitOfWork.ItemMains.GetAll()
                        where m.LinkNo == parentItemId && (m.Status ?? 0) > 0
                        join s in _unitOfWork.ItemStores.GetAll().Where(x => x.StoreNo == dto.StoreId && (x.Status ?? 0) > 0)
                            on m.ItemID equals s.ItemNo
                        select new { Main = m, Store = s }
                    ).ToListAsync();

                    var now = DateTime.UtcNow;
                    foreach (var c in children)
                    {
                        // Mirror desktop UpdateCost(): same value to all
                        // three cost columns so downstream reports stay
                        // consistent regardless of which one they pick.
                        c.Store.Cost = dto.Cost;
                        c.Store.SpecialCost = dto.Cost;
                        c.Store.EstimatedCost = dto.Cost;
                        c.Store.NetCost = ComputePcCost(dto.Cost, null, c.Main.CaseQty);
                        c.Store.DateModified = now;
                        c.Store.UserModified = userId;
                    }

                    await _unitOfWork.SaveChangesAsync();
                    return ApiResponseFactory.Success(children.Count, $"Cost updated on {children.Count} children.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<int>(
                    "Error bulk-updating matrix cost.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<int>> BulkUpdateMatrixPriceAsync(Guid parentItemId, MatrixBulkPriceDto dto, Guid userId)
        {
            try
            {
                if (parentItemId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<int>("parentItemId is required.");
                if (dto == null || dto.StoreId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<int>("storeId is required.");

                var mode = (dto.Mode ?? "absolute").Trim().ToLowerInvariant();
                if (mode != "absolute" && mode != "margin" && mode != "markup")
                    return ApiResponseFactory.BadRequest<int>("Mode must be 'absolute', 'margin', or 'markup'.");
                if (mode == "margin" && dto.Value >= 100m)
                    return ApiResponseFactory.BadRequest<int>("Margin must be less than 100%.");

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var stores = await (
                        from m in _unitOfWork.ItemMains.GetAll()
                        where m.LinkNo == parentItemId && (m.Status ?? 0) > 0
                        join s in _unitOfWork.ItemStores.GetAll().Where(x => x.StoreNo == dto.StoreId && (x.Status ?? 0) > 0)
                            on m.ItemID equals s.ItemNo
                        select s
                    ).ToListAsync();

                    var now = DateTime.UtcNow;
                    foreach (var s in stores)
                    {
                        var cost = s.Cost ?? 0m;
                        decimal price;
                        switch (mode)
                        {
                            case "absolute": price = dto.Value; break;
                            case "markup":   price = Math.Round(cost * (1m + dto.Value / 100m), 2); break;
                            case "margin":   price = Math.Round(cost / (1m - dto.Value / 100m), 2); break;
                            default:         price = dto.Value; break;
                        }
                        s.Price = price;
                        s.DateModified = now;
                        s.UserModified = userId;
                    }

                    await _unitOfWork.SaveChangesAsync();
                    return ApiResponseFactory.Success(stores.Count, $"Price updated on {stores.Count} children.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<int>(
                    "Error bulk-updating matrix price.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> SoftDeleteMatrixChildAsync(Guid itemStoreId, string? reason, Guid userId)
        {
            try
            {
                if (itemStoreId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<bool>("itemStoreId is required.");

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var store = await _unitOfWork.ItemStores.FirstOrDefaultAsync(s => s.ItemStoreID == itemStoreId);
                    if (store == null)
                        return ApiResponseFactory.NotFound<bool>("Matrix child store row not found.");

                    var main = await _unitOfWork.ItemMains.FirstOrDefaultAsync(m => m.ItemID == store.ItemNo);

                    var now = DateTime.UtcNow;
                    store.Status = StatusDeleted;
                    store.VoidReason = reason ?? "Removed from matrix";
                    store.DateModified = now;
                    store.UserModified = userId;

                    // Flip ItemMain too so the child stops showing up
                    // in any item-list query that filters by Status.
                    if (main != null)
                    {
                        main.Status = StatusDeleted;
                        main.DateModified = now;
                        main.UserModified = userId;
                    }

                    await _unitOfWork.SaveChangesAsync();
                    return ApiResponseFactory.Success(true, "Matrix child removed.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error deleting matrix child.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<MatrixChildDto>> AddMatrixChildAsync(Guid parentItemId, MatrixChildCreateDto dto, Guid userId)
        {
            try
            {
                if (parentItemId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<MatrixChildDto>("parentItemId is required.");
                if (dto == null || dto.StoreId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<MatrixChildDto>("storeId is required.");

                // Look up parent + parent's store row up-front so the
                // child inherits defaults (mirrors FrmMatrix.MakeNewChild).
                var parentMain = await _unitOfWork.ItemMains.FirstOrDefaultAsync(m => m.ItemID == parentItemId);
                if (parentMain == null)
                    return ApiResponseFactory.NotFound<MatrixChildDto>("Matrix parent not found.");

                var parentStore = await _unitOfWork.ItemStores
                    .FirstOrDefaultAsync(s => s.ItemNo == parentItemId && s.StoreNo == dto.StoreId);

                // Generate Barcode + Model via the existing helper that
                // already wraps SP_GetNewNumber + uniqueness retry.
                var barcodeResp = await GenerateItemCodeAsync("upc", dto.StoreId);
                if (!barcodeResp.IsSuccess || string.IsNullOrWhiteSpace(barcodeResp.Response))
                    return ApiResponseFactory.InternalError<MatrixChildDto>(
                        $"Failed to generate barcode for new matrix child: {barcodeResp.Message}",
                        new List<string>());

                var modelResp = await GenerateItemCodeAsync("model", dto.StoreId);
                if (!modelResp.IsSuccess || string.IsNullOrWhiteSpace(modelResp.Response))
                    return ApiResponseFactory.InternalError<MatrixChildDto>(
                        $"Failed to generate model number for new matrix child: {modelResp.Message}",
                        new List<string>());

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var now = DateTime.UtcNow;
                    var newItemId = Guid.NewGuid();

                    // Build a friendly name: "<Parent Name> - <Color>/<Size>".
                    // Falls back gracefully when one axis is empty.
                    var axes = new[] { dto.Color, dto.Size }.Where(s => !string.IsNullOrWhiteSpace(s)).ToArray();
                    var suffix = axes.Length > 0 ? " - " + string.Join("/", axes) : "";
                    var childName = (parentMain.Name ?? "Matrix Child") + suffix;

                    var childMain = new ItemMain
                    {
                        ItemID = newItemId,
                        Name = childName,
                        Description = parentMain.Description,
                        ModalNumber = modelResp.Response,
                        BarcodeNumber = barcodeResp.Response,
                        BarcodeType = parentMain.BarcodeType,
                        ItemType = ItemTypeMatrixChild,
                        LinkNo = parentItemId,
                        MatrixTableNo = parentMain.MatrixTableNo,
                        Matrix1 = dto.Color,
                        Matrix2 = dto.Size,
                        StyleNo = parentMain.StyleNo,
                        ManufacturerID = parentMain.ManufacturerID,
                        ManufacturerPartNo = parentMain.ManufacturerPartNo,
                        Size = parentMain.Size,
                        Units = parentMain.Units,
                        Meaasure = parentMain.Meaasure,
                        Quantization = parentMain.Quantization,
                        Unit = parentMain.Unit,
                        CaseQty = parentMain.CaseQty,
                        CaseDescription = parentMain.CaseDescription,
                        Status = StatusActive,
                        DateCreated = now,
                        UserCreated = userId,
                        DateModified = now,
                        UserModified = userId,
                    };
                    await _unitOfWork.ItemMains.AddAsync(childMain);

                    var childStore = new ItemStore
                    {
                        ItemStoreID = Guid.NewGuid(),
                        ItemNo = newItemId,
                        StoreNo = dto.StoreId,
                        DepartmentID = parentStore?.DepartmentID,
                        IsDiscount = parentStore?.IsDiscount ?? true,
                        IsTaxable = parentStore?.IsTaxable ?? true,
                        TaxID = parentStore?.TaxID,
                        IsFoodStampable = parentStore?.IsFoodStampable ?? false,
                        IsWIC = parentStore?.IsWIC ?? false,
                        Cost = parentStore?.Cost ?? 0m,
                        Price = parentStore?.Price ?? 0m,
                        SpecialCost = parentStore?.SpecialCost,
                        EstimatedCost = parentStore?.EstimatedCost,
                        NetCost = parentStore?.NetCost,
                        OnHand = 0m,
                        ProfitCalculation = parentStore?.ProfitCalculation ?? 0,
                        CommissionType = parentStore?.CommissionType ?? 0,
                        Status = StatusActive,
                        DateCreated = now,
                        UserCreated = userId,
                        DateModified = now,
                        UserModified = userId,
                    };
                    await _unitOfWork.ItemStores.AddAsync(childStore);

                    await _unitOfWork.SaveChangesAsync();

                    return ApiResponseFactory.Success(MapToMatrixChild(childMain, childStore), "Matrix child added.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<MatrixChildDto>(
                    "Error adding matrix child.",
                    new List<string> { ex.Message });
            }
        }

        #endregion

        #region Matrix Templates (Phase 2)
        //
        // Port of legacy desktop FrmMatrix template management.
        // Templates are stored as MatrixTable + 2 MatrixColumn rows
        // (canonical names "Color" + "Size") + N MatrixValue rows
        // per column. The desktop UI hardcodes the Color/Size pair
        // (MatrixClass.MatrixColorColumn / MatrixSizeColumn) and
        // we mirror that here — no arbitrary axis names supported.
        //
        // Soft delete: templates use Status = -1 (matching the
        // TemplatesList filter `Where Status > -1`). Values use
        // hard DELETE because the desktop's deleteMatrixValue does
        // the same.

        private const string AxisColor = "Color";
        private const string AxisSize  = "Size";
        // Desktop AdjustType enum value: Other = 3. Matches the
        // FrmMatrix.SaveOnHand call site so reports group these
        // entries the same way the desktop's would.
        private const int AdjustTypeOther = 3;

        private static MatrixValueDto MapMatrixValue(MatrixValue v) => new()
        {
            MatrixValueID  = v.MatrixValueID,
            MatrixColumnID = v.MatrixColumnNo,
            DisplayValue   = v.DisplayValue,
            Code           = v.Code,
            SortValue      = v.SortValue,
        };

        private async Task<MatrixTemplateDto?> LoadTemplateDtoAsync(Guid templateId)
        {
            var table = await _dbContext.MatrixTables
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.MatrixTableID == templateId);
            if (table == null) return null;

            var columns = await _dbContext.MatrixColumns
                .AsNoTracking()
                .Where(c => c.MatrixNo == templateId && (c.Status ?? 0) > -1)
                .ToListAsync();

            var colorCol = columns.FirstOrDefault(c => c.ColumnName == AxisColor);
            var sizeCol  = columns.FirstOrDefault(c => c.ColumnName == AxisSize);

            var colorValues = colorCol == null
                ? new List<MatrixValueDto>()
                : await _dbContext.MatrixValues
                    .AsNoTracking()
                    .Where(v => v.MatrixColumnNo == colorCol.MatrixColumnID && (v.Status ?? 0) > -1)
                    .OrderBy(v => v.SortValue).ThenBy(v => v.DisplayValue)
                    .Select(v => MapMatrixValue(v))
                    .ToListAsync();

            var sizeValues = sizeCol == null
                ? new List<MatrixValueDto>()
                : await _dbContext.MatrixValues
                    .AsNoTracking()
                    .Where(v => v.MatrixColumnNo == sizeCol.MatrixColumnID && (v.Status ?? 0) > -1)
                    .OrderBy(v => v.SortValue).ThenBy(v => v.DisplayValue)
                    .Select(v => MapMatrixValue(v))
                    .ToListAsync();

            return new MatrixTemplateDto
            {
                MatrixTableID      = table.MatrixTableID,
                MatrixName         = table.MatrixName,
                MatrixDescription  = table.MatrixDescription,
                ColorColumnID      = colorCol?.MatrixColumnID,
                SizeColumnID       = sizeCol?.MatrixColumnID,
                Colors             = colorValues,
                Sizes              = sizeValues,
            };
        }

        public async Task<ApiResponse<List<MatrixTemplateDto>>> GetMatrixTemplatesAsync()
        {
            try
            {
                // Three flat queries — fixed cost regardless of template count
                // (was N+1 in the first cut: 1 templates + 3 per template for
                // columns + colour values + size values). With three batched
                // round-trips and in-memory assembly the whole call is O(1)
                // SQL trips, and the rows-per-query stay tiny because the
                // template / column / value tables are small reference data.

                // 1) Active templates that have at least one Color or Size
                //    column. Mirror desktop TemplatesList filter.
                var templates = await (
                    from t in _dbContext.MatrixTables.AsNoTracking()
                    where (t.Status ?? 0) > -1
                    where t.MatrixColumns.Any(c => c.ColumnName == AxisColor || c.ColumnName == AxisSize)
                    orderby t.MatrixName
                    select t
                ).ToListAsync();

                if (templates.Count == 0)
                    return ApiResponseFactory.Success(new List<MatrixTemplateDto>(), "0 templates.");

                var templateIds = templates.Select(t => t.MatrixTableID).ToList();

                // 2) All active columns under those templates in one query.
                var columns = await _dbContext.MatrixColumns
                    .AsNoTracking()
                    .Where(c => templateIds.Contains(c.MatrixNo) && (c.Status ?? 0) > -1)
                    .ToListAsync();

                // 3) All active values under those columns in one query.
                var columnIds = columns.Select(c => c.MatrixColumnID).ToList();
                var values = columnIds.Count == 0
                    ? new List<MatrixValue>()
                    : await _dbContext.MatrixValues
                        .AsNoTracking()
                        .Where(v => columnIds.Contains(v.MatrixColumnNo) && (v.Status ?? 0) > -1)
                        .OrderBy(v => v.SortValue).ThenBy(v => v.DisplayValue)
                        .ToListAsync();

                // Pre-group for O(1) per-template assembly below.
                var columnsByTemplate = columns
                    .GroupBy(c => c.MatrixNo)
                    .ToDictionary(g => g.Key, g => g.ToList());
                var valuesByColumn = values
                    .GroupBy(v => v.MatrixColumnNo)
                    .ToDictionary(g => g.Key, g => g.ToList());

                var dtos = templates.Select(t =>
                {
                    columnsByTemplate.TryGetValue(t.MatrixTableID, out var tColumns);
                    tColumns ??= new List<MatrixColumn>();
                    var colorCol = tColumns.FirstOrDefault(c => c.ColumnName == AxisColor);
                    var sizeCol  = tColumns.FirstOrDefault(c => c.ColumnName == AxisSize);

                    List<MatrixValueDto> Project(MatrixColumn? col)
                    {
                        if (col == null) return new List<MatrixValueDto>();
                        return valuesByColumn.TryGetValue(col.MatrixColumnID, out var rows)
                            ? rows.Select(MapMatrixValue).ToList()
                            : new List<MatrixValueDto>();
                    }

                    return new MatrixTemplateDto
                    {
                        MatrixTableID     = t.MatrixTableID,
                        MatrixName        = t.MatrixName,
                        MatrixDescription = t.MatrixDescription,
                        ColorColumnID     = colorCol?.MatrixColumnID,
                        SizeColumnID      = sizeCol?.MatrixColumnID,
                        Colors            = Project(colorCol),
                        Sizes             = Project(sizeCol),
                    };
                }).ToList();

                return ApiResponseFactory.Success(dtos, $"{dtos.Count} templates.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<MatrixTemplateDto>>(
                    "Error loading matrix templates.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<MatrixTemplateDto>> GetMatrixTemplateAsync(Guid templateId)
        {
            try
            {
                var dto = await LoadTemplateDtoAsync(templateId);
                return dto == null
                    ? ApiResponseFactory.NotFound<MatrixTemplateDto>("Template not found.")
                    : ApiResponseFactory.Success(dto, "OK");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<MatrixTemplateDto>(
                    "Error loading matrix template.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<MatrixTemplateDto>> CreateMatrixTemplateAsync(MatrixTemplateCreateDto dto, Guid userId)
        {
            try
            {
                if (dto == null || string.IsNullOrWhiteSpace(dto.Name))
                    return ApiResponseFactory.BadRequest<MatrixTemplateDto>("Template name is required.");

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var now = DateTime.UtcNow;
                    var templateId = Guid.NewGuid();

                    var table = new MatrixTable
                    {
                        MatrixTableID     = templateId,
                        MatrixName        = dto.Name.Trim(),
                        MatrixDescription = dto.Description?.Trim(),
                        Status            = StatusActive,
                        DateCreated       = now,
                        UserCreated       = userId,
                        DateModified      = now,
                        UserModified      = userId,
                    };
                    _dbContext.MatrixTables.Add(table);

                    // Two canonical columns. The desktop hardcodes the
                    // pair (Color = SortOrder 1, Size = SortOrder 2);
                    // anything outside that convention won't appear
                    // in the desktop's pickers.
                    _dbContext.MatrixColumns.Add(new MatrixColumn
                    {
                        MatrixColumnID = Guid.NewGuid(),
                        MatrixNo       = templateId,
                        ColumnName     = AxisColor,
                        SortOrder      = 1,
                        Status         = StatusActive,
                    });
                    _dbContext.MatrixColumns.Add(new MatrixColumn
                    {
                        MatrixColumnID = Guid.NewGuid(),
                        MatrixNo       = templateId,
                        ColumnName     = AxisSize,
                        SortOrder      = 2,
                        Status         = StatusActive,
                    });

                    await _dbContext.SaveChangesAsync();

                    var result = await LoadTemplateDtoAsync(templateId);
                    return result == null
                        ? ApiResponseFactory.InternalError<MatrixTemplateDto>("Template created but failed to reload.", new List<string>())
                        : ApiResponseFactory.Success(result, "Template created.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<MatrixTemplateDto>(
                    "Error creating matrix template.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<MatrixTemplateDto>> UpdateMatrixTemplateAsync(Guid templateId, MatrixTemplateUpdateDto dto, Guid userId)
        {
            try
            {
                if (templateId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<MatrixTemplateDto>("templateId is required.");
                if (dto == null)
                    return ApiResponseFactory.BadRequest<MatrixTemplateDto>("Body is required.");

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var table = await _dbContext.MatrixTables.FirstOrDefaultAsync(t => t.MatrixTableID == templateId);
                    if (table == null)
                        return ApiResponseFactory.NotFound<MatrixTemplateDto>("Template not found.");

                    if (dto.Name != null)        table.MatrixName = dto.Name.Trim();
                    if (dto.Description != null) table.MatrixDescription = dto.Description.Trim();
                    table.DateModified = DateTime.UtcNow;
                    table.UserModified = userId;

                    await _dbContext.SaveChangesAsync();

                    var result = await LoadTemplateDtoAsync(templateId);
                    return ApiResponseFactory.Success(result!, "Template updated.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<MatrixTemplateDto>(
                    "Error updating matrix template.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> DeleteMatrixTemplateAsync(Guid templateId, Guid userId)
        {
            try
            {
                if (templateId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<bool>("templateId is required.");

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var table = await _dbContext.MatrixTables.FirstOrDefaultAsync(t => t.MatrixTableID == templateId);
                    if (table == null)
                        return ApiResponseFactory.NotFound<bool>("Template not found.");

                    // Soft delete only — existing items keep their
                    // MatrixTableNo so historical traceability stays
                    // intact even after the template is "removed".
                    table.Status = -1;
                    table.DateModified = DateTime.UtcNow;
                    table.UserModified = userId;

                    await _dbContext.SaveChangesAsync();
                    return ApiResponseFactory.Success(true, "Template removed.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error deleting matrix template.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<MatrixValueDto>> AddMatrixValueAsync(Guid templateId, MatrixValueCreateDto dto, Guid userId)
        {
            try
            {
                if (templateId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<MatrixValueDto>("templateId is required.");
                if (dto == null || string.IsNullOrWhiteSpace(dto.DisplayValue))
                    return ApiResponseFactory.BadRequest<MatrixValueDto>("displayValue is required.");

                var axis = (dto.Axis ?? "color").Trim().ToLowerInvariant();
                var canonical = axis == "size" ? AxisSize : AxisColor;

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var column = await _dbContext.MatrixColumns
                        .FirstOrDefaultAsync(c => c.MatrixNo == templateId && c.ColumnName == canonical);
                    if (column == null)
                        return ApiResponseFactory.NotFound<MatrixValueDto>($"Template has no '{canonical}' column.");

                    // Avoid silent duplicates — if the same display
                    // value already exists on this column, return it
                    // instead of inserting again.
                    var display = dto.DisplayValue.Trim();
                    var existing = await _dbContext.MatrixValues
                        .FirstOrDefaultAsync(v => v.MatrixColumnNo == column.MatrixColumnID && v.DisplayValue == display);
                    if (existing != null)
                        return ApiResponseFactory.Success(MapMatrixValue(existing), "Value already existed.");

                    var newValue = new MatrixValue
                    {
                        MatrixValueID  = Guid.NewGuid(),
                        MatrixColumnNo = column.MatrixColumnID,
                        DisplayValue   = display,
                        Code           = dto.Code,
                        SortValue      = dto.SortValue,
                        Status         = StatusActive,
                    };
                    _dbContext.MatrixValues.Add(newValue);

                    // Optional promotion to the global MatrixColors
                    // lookup. Mirrors desktop UseFashionChanges flag.
                    // Only meaningful for colour values, but we honour
                    // the flag regardless so callers can opt in.
                    if (dto.PromoteToGlobal && canonical == AxisColor)
                    {
                        var existsGlobal = await _dbContext.MatrixColors
                            .AnyAsync(c => c.DisplayValue == display);
                        if (!existsGlobal)
                        {
                            _dbContext.MatrixColors.Add(new MatrixColor
                            {
                                DisplayValue = display,
                                Code         = dto.Code,
                                SortValue    = dto.SortValue,
                                Status       = StatusActive,
                            });
                        }
                    }

                    await _dbContext.SaveChangesAsync();
                    return ApiResponseFactory.Success(MapMatrixValue(newValue), "Value added.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<MatrixValueDto>(
                    "Error adding matrix value.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<bool>> DeleteMatrixValueAsync(Guid matrixValueId, bool cascadeChildren, Guid userId)
        {
            try
            {
                if (matrixValueId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<bool>("matrixValueId is required.");

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var value = await _dbContext.MatrixValues
                        .FirstOrDefaultAsync(v => v.MatrixValueID == matrixValueId);
                    if (value == null)
                        return ApiResponseFactory.NotFound<bool>("Matrix value not found.");

                    var column = await _dbContext.MatrixColumns
                        .AsNoTracking()
                        .FirstOrDefaultAsync(c => c.MatrixColumnID == value.MatrixColumnNo);
                    var isColor = column?.ColumnName == AxisColor;
                    var displayValue = value.DisplayValue;
                    var templateId = column?.MatrixNo ?? Guid.Empty;

                    if (cascadeChildren && templateId != Guid.Empty)
                    {
                        // Soft-delete any child ItemMain/ItemStore that
                        // references this value via Matrix1 (Color) or
                        // Matrix2 (Size) AND lives under this template.
                        // Mirrors desktop deleteMatrixValueItems SQL.
                        var now = DateTime.UtcNow;
                        var query = _unitOfWork.ItemMains.GetAll()
                            .Where(m => m.MatrixTableNo == templateId && (m.Status ?? 0) > 0);
                        query = isColor
                            ? query.Where(m => m.Matrix1 == displayValue)
                            : query.Where(m => m.Matrix2 == displayValue);
                        var affectedMains = await query.ToListAsync();
                        var affectedIds = affectedMains.Select(m => m.ItemID).ToList();

                        foreach (var m in affectedMains)
                        {
                            m.Status = StatusDeleted;
                            m.DateModified = now;
                            m.UserModified = userId;
                        }

                        var affectedStores = await _unitOfWork.ItemStores.GetAll()
                            .Where(s => affectedIds.Contains(s.ItemNo) && (s.Status ?? 0) > 0)
                            .ToListAsync();
                        foreach (var s in affectedStores)
                        {
                            s.Status = StatusDeleted;
                            s.VoidReason = $"Matrix value '{displayValue}' removed";
                            s.DateModified = now;
                            s.UserModified = userId;
                        }
                    }

                    // Hard delete the value itself, matching desktop.
                    _dbContext.MatrixValues.Remove(value);
                    await _dbContext.SaveChangesAsync();
                    return ApiResponseFactory.Success(true, cascadeChildren
                        ? "Value removed; affected children deactivated."
                        : "Value removed.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<bool>(
                    "Error deleting matrix value.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<List<MatrixColorDto>>> GetGlobalMatrixColorsAsync()
        {
            try
            {
                var rows = await _dbContext.MatrixColors
                    .AsNoTracking()
                    .Where(c => (c.Status ?? 0) > -1)
                    .OrderBy(c => c.SortValue).ThenBy(c => c.DisplayValue)
                    .Select(c => new MatrixColorDto
                    {
                        DisplayValue = c.DisplayValue,
                        Code         = c.Code,
                        SortValue    = c.SortValue,
                    })
                    .ToListAsync();
                return ApiResponseFactory.Success(rows, $"{rows.Count} colours.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<MatrixColorDto>>(
                    "Error loading global colours.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<MatrixGenerateResultDto>> GenerateMatrixChildrenAsync(Guid parentItemId, MatrixChildGenerateDto dto, Guid userId)
        {
            try
            {
                if (parentItemId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<MatrixGenerateResultDto>("parentItemId is required.");
                if (dto == null || dto.StoreId == Guid.Empty)
                    return ApiResponseFactory.BadRequest<MatrixGenerateResultDto>("storeId is required.");

                // Normalise + de-dup picked values. An empty axis stays
                // as a single-empty-string list so the cross-product
                // still produces children when the user only cares
                // about one axis.
                var colors = (dto.Colors ?? new List<string>())
                    .Select(c => c?.Trim() ?? string.Empty)
                    .Distinct()
                    .ToList();
                var sizes = (dto.Sizes ?? new List<string>())
                    .Select(s => s?.Trim() ?? string.Empty)
                    .Distinct()
                    .ToList();
                if (colors.Count == 0) colors.Add(string.Empty);
                if (sizes.Count == 0) sizes.Add(string.Empty);
                if (colors.All(string.IsNullOrEmpty) && sizes.All(string.IsNullOrEmpty))
                    return ApiResponseFactory.BadRequest<MatrixGenerateResultDto>(
                        "Pick at least one colour or size value.");

                var parent = await _unitOfWork.ItemMains.FirstOrDefaultAsync(m => m.ItemID == parentItemId);
                if (parent == null)
                    return ApiResponseFactory.NotFound<MatrixGenerateResultDto>("Parent item not found.");

                var parentStore = await _unitOfWork.ItemStores
                    .FirstOrDefaultAsync(s => s.ItemNo == parentItemId && s.StoreNo == dto.StoreId);

                // Existing combos — skip them so re-running the generator
                // for new values doesn't create duplicates.
                var existingCombos = await (
                    from m in _unitOfWork.ItemMains.GetAll()
                    where m.LinkNo == parentItemId && (m.Status ?? 0) > 0
                    select new { C = m.Matrix1 ?? string.Empty, S = m.Matrix2 ?? string.Empty }
                ).ToListAsync();
                var existingSet = new HashSet<string>(
                    existingCombos.Select(x => $"{x.C}||{x.S}"));

                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var now = DateTime.UtcNow;
                    int created = 0, skipped = 0;

                    // Optionally pin the template on the parent so the
                    // grid remembers which template's values to offer
                    // next time the generator opens.
                    if (dto.AssignTemplateId.HasValue && dto.AssignTemplateId.Value != Guid.Empty)
                    {
                        parent.MatrixTableNo = dto.AssignTemplateId;
                        parent.DateModified = now;
                        parent.UserModified = userId;
                    }

                    foreach (var color in colors)
                    {
                        foreach (var size in sizes)
                        {
                            if (existingSet.Contains($"{color}||{size}"))
                            {
                                skipped++;
                                continue;
                            }

                            // Generate barcode + model per child. We
                            // call GenerateItemCodeAsync inside the
                            // loop because each call increments
                            // SP_GetNewNumber atomically — a single
                            // pre-batched range would risk collisions
                            // with concurrent item creates.
                            var barcodeResp = await GenerateItemCodeAsync("upc", dto.StoreId);
                            if (!barcodeResp.IsSuccess || string.IsNullOrWhiteSpace(barcodeResp.Response))
                                return ApiResponseFactory.InternalError<MatrixGenerateResultDto>(
                                    $"Failed to generate barcode: {barcodeResp.Message}",
                                    new List<string>());
                            var modelResp = await GenerateItemCodeAsync("model", dto.StoreId);
                            if (!modelResp.IsSuccess || string.IsNullOrWhiteSpace(modelResp.Response))
                                return ApiResponseFactory.InternalError<MatrixGenerateResultDto>(
                                    $"Failed to generate model number: {modelResp.Message}",
                                    new List<string>());

                            var axes = new[] { color, size }.Where(s => !string.IsNullOrWhiteSpace(s)).ToArray();
                            var suffix = axes.Length > 0 ? " - " + string.Join("/", axes) : "";

                            var newId = Guid.NewGuid();
                            _dbContext.ItemMains.Add(new ItemMain
                            {
                                ItemID = newId,
                                Name = (parent.Name ?? "Matrix Child") + suffix,
                                Description = parent.Description,
                                ModalNumber = modelResp.Response,
                                BarcodeNumber = barcodeResp.Response,
                                BarcodeType = parent.BarcodeType,
                                ItemType = ItemTypeMatrixChild,
                                LinkNo = parentItemId,
                                MatrixTableNo = dto.AssignTemplateId ?? parent.MatrixTableNo,
                                Matrix1 = string.IsNullOrEmpty(color) ? null : color,
                                Matrix2 = string.IsNullOrEmpty(size) ? null : size,
                                StyleNo = parent.StyleNo,
                                ManufacturerID = parent.ManufacturerID,
                                ManufacturerPartNo = parent.ManufacturerPartNo,
                                Size = parent.Size,
                                Units = parent.Units,
                                Meaasure = parent.Meaasure,
                                Quantization = parent.Quantization,
                                Unit = parent.Unit,
                                CaseQty = parent.CaseQty,
                                CaseDescription = parent.CaseDescription,
                                Status = StatusActive,
                                DateCreated = now,
                                UserCreated = userId,
                                DateModified = now,
                                UserModified = userId,
                            });

                            _dbContext.ItemStores.Add(new ItemStore
                            {
                                ItemStoreID = Guid.NewGuid(),
                                ItemNo = newId,
                                StoreNo = dto.StoreId,
                                DepartmentID = parentStore?.DepartmentID,
                                IsDiscount = parentStore?.IsDiscount ?? true,
                                IsTaxable = parentStore?.IsTaxable ?? true,
                                TaxID = parentStore?.TaxID,
                                IsFoodStampable = parentStore?.IsFoodStampable ?? false,
                                IsWIC = parentStore?.IsWIC ?? false,
                                Cost = parentStore?.Cost ?? 0m,
                                Price = parentStore?.Price ?? 0m,
                                SpecialCost = parentStore?.SpecialCost,
                                EstimatedCost = parentStore?.EstimatedCost,
                                NetCost = parentStore?.NetCost,
                                OnHand = 0m,
                                ProfitCalculation = parentStore?.ProfitCalculation ?? 0,
                                CommissionType = parentStore?.CommissionType ?? 0,
                                Status = StatusActive,
                                DateCreated = now,
                                UserCreated = userId,
                                DateModified = now,
                                UserModified = userId,
                            });

                            existingSet.Add($"{color}||{size}");
                            created++;
                        }
                    }

                    if (created > 0 || dto.AssignTemplateId.HasValue)
                        await _dbContext.SaveChangesAsync();

                    return ApiResponseFactory.Success(
                        new MatrixGenerateResultDto { Created = created, Skipped = skipped },
                        $"{created} children created, {skipped} skipped (already existed).");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<MatrixGenerateResultDto>(
                    "Error generating matrix children.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<int>> AdjustMatrixChildOnHandAsync(MatrixOnHandAdjustBatchDto dto, Guid userId)
        {
            try
            {
                if (dto == null || dto.Rows == null || dto.Rows.Count == 0)
                    return ApiResponseFactory.BadRequest<int>("At least one row is required.");
                var reason = (dto.Reason ?? string.Empty).Trim();
                if (string.IsNullOrEmpty(reason))
                    return ApiResponseFactory.BadRequest<int>("Reason is required for on-hand adjustments.");

                var ids = dto.Rows.Select(r => r.ItemStoreId).Distinct().ToList();
                return await _unitOfWork.ExecuteInTransactionAsync(async () =>
                {
                    var stores = await _unitOfWork.ItemStores.GetAll()
                        .Where(s => ids.Contains(s.ItemStoreID))
                        .ToListAsync();

                    var now = DateTime.UtcNow;
                    int touched = 0;
                    foreach (var row in dto.Rows)
                    {
                        var store = stores.FirstOrDefault(s => s.ItemStoreID == row.ItemStoreId);
                        if (store == null) continue;

                        var oldOnHand = store.OnHand ?? 0m;
                        var newOnHand = row.NewOnHand;
                        if (oldOnHand == newOnHand) continue;

                        store.OnHand = newOnHand;
                        store.DateModified = now;
                        store.UserModified = userId;

                        // One AdjustInventory entry per changed row so
                        // reports / audit trail can reconstruct the
                        // delta history. AdjustType matches desktop's
                        // AdjustType.Other (3).
                        _dbContext.AdjustInventories.Add(new AdjustInventory
                        {
                            AdjustInventoryId = Guid.NewGuid(),
                            ItemStoreNo       = row.ItemStoreId,
                            AdjustType        = AdjustTypeOther,
                            Qty               = newOnHand - oldOnHand,
                            OldQty            = oldOnHand,
                            AdjustReason      = reason,
                            Cost              = store.Cost,
                            Status            = StatusActive,
                            DateCreated       = now,
                            UserCreated       = userId,
                            DateModified      = now,
                            UserModified      = userId,
                        });
                        touched++;
                    }

                    if (touched > 0) await _dbContext.SaveChangesAsync();
                    return ApiResponseFactory.Success(touched, $"{touched} on-hand entries adjusted.");
                });
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<int>(
                    "Error adjusting on-hand.",
                    new List<string> { ex.Message });
            }
        }

        #endregion
    }
}
