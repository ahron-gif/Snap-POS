using AutoMapper;
using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Infrastructure.DBContext.Tenant;
using BackOffice.Persistence.Repositories.Tenant;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Data.Common;


namespace BackOffice.Persistence.Repositories
{
    public class UnitOfWorkTenant : IUnitOfWorkTenant, IDisposable
    {
        #region Constructor

        private readonly TenantDBContext _dbContext;
        private readonly IMapper _mapper;
        


        public UnitOfWorkTenant(TenantDBContext dbContext, IMapper mapper)
        {
            _dbContext = dbContext;
            _mapper = mapper;
        }

        #endregion

        #region Private Repositories

        private IWebUserRepository _webUsers;
        private IItemsMainAndStoreGridRepository _itemsMainAndStoreGrids;
        private ICustomerViewRepository _customerview;
        private IPhoneOrderViewRepository _phoneOrderViews;

        // Item repositories
        private IItemMainRepository _itemMains;
        private IItemStoreRepository _itemStores;
        private IItemSupplyRepository _itemSupplies;
        private IItemToGroupRepository _itemToGroups;
        private IItemAliasRepository _itemAliases;

        #endregion

        #region Public Methods

        // Active repository used by web flows (WebUser entity / [WebUsers] table).
        public IWebUserRepository WebUsers => _webUsers ??= new WebUserRepository(_dbContext, _mapper);
        public IItemsMainAndStoreGridRepository ItemsMainAndStoreGrids => _itemsMainAndStoreGrids ??= new ItemsMainAndStoreGridRepository(_dbContext, _mapper);
        public ICustomerViewRepository CustomerViews => _customerview ??= new CustomerViewRepository (_dbContext, _mapper);

        public IPhoneOrderViewRepository PhoneOrderViews => _phoneOrderViews ??= new PhoneOrderViewRepository(_dbContext, _mapper);

        // Item repositories
        public IItemMainRepository ItemMains => _itemMains ??= new ItemMainRepository(_dbContext, _mapper);
        public IItemStoreRepository ItemStores => _itemStores ??= new ItemStoreRepository(_dbContext, _mapper);
        public IItemSupplyRepository ItemSupplies => _itemSupplies ??= new ItemSupplyRepository(_dbContext, _mapper);
        public IItemToGroupRepository ItemToGroups => _itemToGroups ??= new ItemToGroupRepository(_dbContext, _mapper);
        public IItemAliasRepository ItemAliases => _itemAliases ??= new ItemAliasRepository(_dbContext, _mapper);

        public int SaveChanges() => _dbContext.SaveChanges();

        public async Task<int> SaveChangesAsync() => await _dbContext.SaveChangesAsync();

        public IDbContextTransaction BeginTransaction() => _dbContext.Database.BeginTransaction();

        public async Task<IDbContextTransaction> BeginTransactionAsync() => await _dbContext.Database.BeginTransactionAsync();

        public IDbContextTransaction? UseTransaction(DbTransaction transaction) => _dbContext.Database.UseTransaction(transaction);

        public async Task<IDbContextTransaction?> UseTransactionAsync(DbTransaction transaction) => await _dbContext.Database.UseTransactionAsync(transaction);

        public void CommitTransaction() => _dbContext.Database.CommitTransaction();

        public async System.Threading.Tasks.Task CommitTransactionAsync() => await _dbContext.Database.CommitTransactionAsync();

        public void RollbackTransaction() => _dbContext.Database.RollbackTransaction();

        public async System.Threading.Tasks.Task RollbackTransactionAsync() => await _dbContext.Database.RollbackTransactionAsync();

        public bool CanConnect() => _dbContext.Database.CanConnect();

        public async Task<bool> CanConnectAsync() => await _dbContext.Database.CanConnectAsync();

        public void Save() => _dbContext.SaveChanges();

        public void Dispose() => _dbContext?.Dispose();
        public DbConnection GetDbConnection()
        {
            return _dbContext.Database.GetDbConnection();
        }

        /// <summary>
        /// Executes the given operation within an execution strategy that handles transient failures
        /// </summary>
        public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> operation)
        {
            var strategy = _dbContext.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                using var transaction = await _dbContext.Database.BeginTransactionAsync();
                try
                {
                    var result = await operation();
                    await transaction.CommitAsync();
                    return result;
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            });
        }

        #endregion
    }


}