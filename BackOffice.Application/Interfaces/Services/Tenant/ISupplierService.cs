using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Supplier;
using BackOffice.Common;

namespace BackOffice.Application.Interfaces.Services.Tenant
{
    public interface ISupplierService
    {
        /// <summary>
        /// Get all suppliers for lookup dropdown (SupplierID, Name, SupplierNo), same as desktop SP_GetSupplierView / SuppliersGate.SupplierDS
        /// </summary>
        ApiResponse<List<SupplierLookupDto>> GetSuppliersLookupAsync();

        /// <summary>
        /// Get all suppliers with pagination, filtering, and sorting support
        /// </summary>
        ApiResponse<PaginationResponseDTO<SupplierGridDto>> GetAllSuppliersGridAsync(PaginationGridDto paginationGridDto);

        /// <summary>
        /// Get supplier by ID
        /// </summary>
        Task<ApiResponse<SupplierGridDto>> GetSupplierByIdAsync(Guid supplierId);

        /// <summary>
        /// Create a new supplier
        /// </summary>
        Task<ApiResponse<Guid>> CreateSupplierAsync(CreateSupplierDto dto, Guid creatorId);

        /// <summary>
        /// Update an existing supplier
        /// </summary>
        Task<ApiResponse<bool>> UpdateSupplierAsync(Guid supplierId, UpdateSupplierDto dto, Guid modifierId);

        /// <summary>
        /// Toggle supplier status (active/inactive)
        /// </summary>
        Task<ApiResponse<bool>> ToggleSupplierStatusAsync(Guid supplierId, Guid modifierId);

        /// <summary>
        /// Delete a supplier (soft delete by setting status)
        /// </summary>
        Task<ApiResponse<bool>> DeleteSupplierAsync(Guid supplierId, Guid modifierId);

        /// <summary>
        /// Get supplier notes
        /// </summary>
        Task<ApiResponse<List<SupplierNoteDto>>> GetSupplierNotesAsync(Guid supplierId);

        /// <summary>
        /// Add a note to a supplier
        /// </summary>
        Task<ApiResponse<Guid>> AddSupplierNoteAsync(Guid supplierId, CreateSupplierNoteDto dto, Guid creatorId);

        /// <summary>
        /// Delete a supplier note
        /// </summary>
        Task<ApiResponse<bool>> DeleteSupplierNoteAsync(Guid supplierId, Guid noteId, Guid modifierId);

        /// <summary>
        /// Get supplier items
        /// </summary>
        Task<ApiResponse<List<SupplierItemDto>>> GetSupplierItemsAsync(Guid supplierId, bool includeInactive = false);

        /// <summary>
        /// Get supplier history (Open PO, balances, MTD, PTD, YTD)
        /// </summary>
        Task<ApiResponse<SupplierHistoryDto>> GetSupplierHistoryAsync(Guid supplierId);
    }
}
