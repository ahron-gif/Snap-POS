using System.Data.Common;
using Microsoft.EntityFrameworkCore.Storage;


namespace BackOffice.Application.Interfaces.Repositories.Tenant
{
    public interface IUnitOfWorkTenant : IDisposable
    {
        #region Public Repositories
        //IUserRepository Users { get; }
        // Active repository used by web flows (WebUser entity / [WebUsers] table).
        // The legacy IUserRepository / Users property was removed when the legacy
        // User repo was disabled (see IUserRepository.cs).
        IWebUserRepository WebUsers { get; }
        IItemsMainAndStoreGridRepository ItemsMainAndStoreGrids { get; }
        ICustomerViewRepository CustomerViews { get; }
        IPhoneOrderViewRepository PhoneOrderViews { get; }

        // Item repositories
        IItemMainRepository ItemMains { get; }
        IItemStoreRepository ItemStores { get; }
        IItemSupplyRepository ItemSupplies { get; }
        IItemToGroupRepository ItemToGroups { get; }
        IItemAliasRepository ItemAliases { get; }

        #endregion

        #region Public Methods

        int SaveChanges();
        Task<int> SaveChangesAsync();
        IDbContextTransaction BeginTransaction();
        Task<IDbContextTransaction> BeginTransactionAsync();
        IDbContextTransaction? UseTransaction(DbTransaction transaction);
        Task<IDbContextTransaction?> UseTransactionAsync(DbTransaction transaction);
        void CommitTransaction();
        Task CommitTransactionAsync();
        void RollbackTransaction();
        Task RollbackTransactionAsync();
        bool CanConnect();
        Task<bool> CanConnectAsync();
        void Save();
        DbConnection GetDbConnection();

        /// <summary>
        /// Executes the given operation within an execution strategy that handles transient failures
        /// </summary>
        Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation);

        #endregion
    }
}
