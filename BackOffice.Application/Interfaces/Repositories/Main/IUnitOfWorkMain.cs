using System.Data.Common;
using BackOffice.Application.Interfaces.Repositories.Main;
using Microsoft.EntityFrameworkCore.Storage;


namespace BackOffice.Application.Interfaces.Repositories.Tenant
{
    public interface IUnitOfWorkMain : IDisposable
    {
        #region Public Repositories
        //IAppUserRepository AppUsers { get; }
        // Active repository used by web flows (WebAppUser entity / [WebAppUsers] table).
        // The legacy IAppUserRepository / AppUsers property was removed when the
        // legacy AppUser repo was disabled (see IAppUserRepository.cs).
        IWebAppUserRepository WebAppUsers { get; }
        ICustomersMainRepository Customers { get; }
        IScreenActionRepository ScreenActions { get; }
        IGlobalRoleRepository GlobalRoles { get; }
        IGlobalRoleScreenActionRepository GlobalRoleScreenActions { get; }
        ICustomerGlobalRoleRepository CustomerGlobalRoles { get; }
        IAppUserGlobalRoleRepository AppUserGlobalRoles { get; }

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

        #endregion
    }
}
