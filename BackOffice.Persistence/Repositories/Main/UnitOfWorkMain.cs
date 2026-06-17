using AutoMapper;
using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Application.Interfaces.Repositories.Main;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Data.Common;


namespace BackOffice.Persistence.Repositories.Main
{
    public class UnitOfWorkMain : IUnitOfWorkMain, IDisposable
    {
        #region Constructor

        private readonly MainDBContext _dbContext;
        private readonly IMapper _mapper;
        


        public UnitOfWorkMain(MainDBContext dbContext, IMapper mapper)
        {
            _dbContext = dbContext;
            _mapper = mapper;
        }

        #endregion

        #region Private Repositories

        private IWebAppUserRepository _webAppUsers;
        public ICustomersMainRepository _customers;
        private IScreenActionRepository _screenActions;
        private IGlobalRoleRepository _globalRoles;
        private IGlobalRoleScreenActionRepository _globalRoleScreenActions;
        private ICustomerGlobalRoleRepository _customerGlobalRoles;
        private IAppUserGlobalRoleRepository _appUserGlobalRoles;

        #endregion

        #region Public Methods

        // Active repository used by web flows (WebAppUser entity / [WebAppUsers] table).
        public IWebAppUserRepository WebAppUsers => _webAppUsers ??= new WebAppUserRepository(_dbContext, _mapper);
        public ICustomersMainRepository Customers => _customers ??= new CustomersMainRepository(_dbContext, _mapper);
        public IScreenActionRepository ScreenActions => _screenActions ??= new ScreenActionRepository(_dbContext, _mapper);
        public IGlobalRoleRepository GlobalRoles => _globalRoles ??= new GlobalRoleRepository(_dbContext, _mapper);
        public IGlobalRoleScreenActionRepository GlobalRoleScreenActions => _globalRoleScreenActions ??= new GlobalRoleScreenActionRepository(_dbContext, _mapper);
        public ICustomerGlobalRoleRepository CustomerGlobalRoles => _customerGlobalRoles ??= new CustomerGlobalRoleRepository(_dbContext, _mapper);
        public IAppUserGlobalRoleRepository AppUserGlobalRoles => _appUserGlobalRoles ??= new AppUserGlobalRoleRepository(_dbContext, _mapper);
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

        #endregion
    }


}