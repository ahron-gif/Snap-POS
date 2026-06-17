using AutoMapper;
using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Infrastructure.DBContext.Main;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Repositories.Main
{

    public class MainBaseRepository<TEntity> : IBaseRepository<TEntity> where TEntity : class
    {
        protected readonly MainDBContext Context;

        protected DbSet<TEntity> Table;

        protected readonly IMapper Mapper;

        public MainBaseRepository(MainDBContext dbContext, IMapper mapper)
        {
            Context = dbContext;
            Table = Context.Set<TEntity>();
            Mapper = mapper;
        }

        public virtual IQueryable<TEntity> GetAll()
        {
            return Table;
        }

        public virtual IQueryable<TEntity> GetAll(Expression<Func<TEntity, bool>> predicate)
        {
            return Table.Where(predicate);
        }

        public virtual List<TEntity> GetAllList()
        {
            return GetAll().ToList();
        }

        public virtual List<TEntity> GetAllList(Expression<Func<TEntity, bool>> predicate)
        {
            return GetAll().Where(predicate).ToList();
        }

        public virtual async Task<List<TEntity>> GetAllListAsync()
        {
            return await GetAll().ToListAsync();
        }

        public virtual async Task<List<TEntity>> GetAllListAsync(Expression<Func<TEntity, bool>> predicate)
        {
            return await GetAll().Where(predicate).ToListAsync();
        }

        public virtual TEntity? FirstOrDefault(Expression<Func<TEntity, bool>> predicate)
        {
            return GetAll().FirstOrDefault(predicate);
        }

        public virtual async Task<TEntity?> FirstOrDefaultAsync(Expression<Func<TEntity, bool>> predicate)
        {
            return await GetAll().FirstOrDefaultAsync(predicate);
        }

        public virtual void Add(TEntity entity)
        {
            Table.Add(entity);
        }

        public virtual async Task AddAsync(TEntity entity)
        {
            await Table.AddAsync(entity);
        }

        public virtual void AddRange(List<TEntity> entities)
        {
            Table.AddRange(entities);
        }

        public virtual async Task AddRangeAsync(List<TEntity> entities)
        {
            await Table.AddRangeAsync(entities);
        }

        public virtual void Update(TEntity entity)
        {
            AttachIfNot(entity);
            Context.Entry(entity).State = EntityState.Modified;
        }

        public virtual Task UpdateAsync(TEntity entity)
        {
            Update(entity);
            return Task.CompletedTask;
        }

        public virtual void Remove(TEntity entity)
        {
            AttachIfNot(entity);
            Table.Remove(entity);
        }

        public virtual Task DeleteAsync(TEntity entity)
        {
            Remove(entity);
            return Task.CompletedTask;
        }

        public virtual void Delete(Expression<Func<TEntity, bool>> predicate)
        {
            var entitiesToDelete = GetAllList(predicate);
            foreach (TEntity entity in entitiesToDelete)
            {
                Remove(entity);
            }
        }

        public void DeleteRange(List<TEntity> entities)
        {
            if (entities.Any())
                Table.RemoveRange(entities);
        }

        public virtual async Task DeleteAsync(Expression<Func<TEntity, bool>> predicate)
        {
            foreach (TEntity item in await GetAllListAsync(predicate).ConfigureAwait(continueOnCapturedContext: false))
            {
                await DeleteAsync(item).ConfigureAwait(continueOnCapturedContext: false);
            }
        }

        public virtual int Count()
        {
            return GetAll().Count();
        }

        public virtual async Task<int> CountAsync()
        {
            return await GetAll().CountAsync();
        }

        public virtual int Count(Expression<Func<TEntity, bool>> predicate)
        {
            return GetAll().Count(predicate);
        }

        public virtual async Task<int> CountAsync(Expression<Func<TEntity, bool>> predicate)
        {
            return await GetAll().CountAsync(predicate);
        }

        public virtual long LongCount()
        {
            return GetAll().LongCount();
        }

        public virtual async Task<long> LongCountAsync()
        {
            return await GetAll().LongCountAsync();
        }

        public virtual long LongCount(Expression<Func<TEntity, bool>> predicate)
        {
            return GetAll().LongCount(predicate);
        }

        public virtual async Task<long> LongCountAsync(Expression<Func<TEntity, bool>> predicate)
        {
            return await GetAll().LongCountAsync(predicate);
        }

        protected virtual void AttachIfNot(TEntity entity)
        {
            if (!Table.Local.Contains(entity))
            {
                Table.Attach(entity);
            }
        }

        public void Detach(TEntity entity)
        {
            Context.Entry(entity).State = EntityState.Detached;
        }

        public int SaveChanges()
        {
            return Context.SaveChanges();
        }

        public async Task<int> SaveChangesAsync()
        {
            return await Context.SaveChangesAsync();
        }
        public virtual bool Exists(Expression<Func<TEntity, bool>> predicate)
        {
            return Table.Any(predicate);
        }

    }
}
