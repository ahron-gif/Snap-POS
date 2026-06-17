using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.Interfaces.Repositories
{
    public interface IBaseRepositoryMain<TEntity>
       where TEntity : class
    {
        //
        // Summary:
        //     Used to get a IQueryable that is used to retrieve entities from entire table. This method exposes all the methods of entity framework availble on a DbSet<TEntity>.
        //
        // Returns:
        //     IQueryable to be used to select entities from database
        IQueryable<TEntity> GetAll();

        //
        // Summary:
        //     Used to get a IQueryable that is used to retrieve entities from entire table. This method exposes all the methods of entity framework availble on a DbSet<TEntity>.
        //
        // Parameters:
        //   predicate:
        //     A condition to filter entities
        //
        // Returns:
        //     IQueryable to be used to select entities from database
        IQueryable<TEntity> GetAll(Expression<Func<TEntity, bool>> predicate);

        //
        // Summary:
        //     Used to get all entities.
        //
        // Returns:
        //     List of all entities
        List<TEntity> GetAllList();

        //
        // Summary:
        //     Used to get all entities.
        //
        // Returns:
        //     List of all entities
        Task<List<TEntity>> GetAllListAsync();

        //
        // Summary:
        //     Used to get all entities based on given predicate.
        //
        // Parameters:
        //   predicate:
        //     A condition to filter entities
        //
        // Returns:
        //     List of all entities
        List<TEntity> GetAllList(Expression<Func<TEntity, bool>> predicate);

        //
        // Summary:
        //     Used to get all entities based on given predicate.
        //
        // Parameters:
        //   predicate:
        //     A condition to filter entities
        //
        // Returns:
        //     List of all entities
        Task<List<TEntity>> GetAllListAsync(Expression<Func<TEntity, bool>> predicate);

        //
        // Summary:
        //     Gets an entity with given given predicate or null if not found.
        //
        // Parameters:
        //   predicate:
        //     Predicate to filter entities
        TEntity? FirstOrDefault(Expression<Func<TEntity, bool>> predicate);

        //
        // Summary:
        //     Gets an entity with given given predicate or null if not found.
        //
        // Parameters:
        //   predicate:
        //     Predicate to filter entities
        Task<TEntity?> FirstOrDefaultAsync(Expression<Func<TEntity, bool>> predicate);

        //
        // Summary:
        //     Inserts a new entity.
        //
        // Parameters:
        //   entity:
        //     Inserted entity
        void Add(TEntity entity);

        //
        // Summary:
        //     Inserts a new entity.
        //
        // Parameters:
        //   entity:
        //     Inserted entity
        Task AddAsync(TEntity entity);

        //
        // Summary:
        //     Inserts a range of entities.
        //
        void AddRange(List<TEntity> entities);

        //
        // Summary:
        //     Inserts a range entities.
        //
        Task AddRangeAsync(List<TEntity> entities);

        //
        // Summary:
        //     Updates an existing entity.
        //
        // Parameters:
        //   entity:
        //     Entity
        void Update(TEntity entity);

        //
        // Summary:
        //     Updates an existing entity.
        //
        // Parameters:
        //   entity:
        //     Entity
        Task UpdateAsync(TEntity entity);

        //
        // Summary:
        //     Deletes an entity.
        //
        // Parameters:
        //   entity:
        //     Entity to be deleted
        void Remove(TEntity entity);

        //
        // Summary:
        //     Deletes an entity.
        //
        // Parameters:
        //   entity:
        //     Entity to be deleted
        Task DeleteAsync(TEntity entity);

        //
        // Summary:
        //     Deletes many entities by function. Notice that: All entities fits to given predicate
        //     are retrieved and deleted. This may cause major performance problems if there
        //     are too many entities with given predicate.
        //
        // Parameters:
        //   predicate:
        //     A condition to filter entities
        void Delete(Expression<Func<TEntity, bool>> predicate);

        //
        // Summary:
        //     Deletes many entities by function. Notice that: All entities fits to given predicate
        //     are retrieved and deleted. This may cause major performance problems if there
        //     are too many entities with given predicate.
        //
        // Parameters:
        //   predicate:
        //     A condition to filter entities
        Task DeleteAsync(Expression<Func<TEntity, bool>> predicate);

        //
        // Summary:
        //     Gets count of all entities in this repository.
        //
        // Returns:
        //     Count of entities
        void DeleteRange(List<TEntity> entities);

        int Count();

        //
        // Summary:
        //     Gets count of all entities in this repository.
        //
        // Returns:
        //     Count of entities
        Task<int> CountAsync();

        //
        // Summary:
        //     Gets count of all entities in this repository based on given predicate.
        //
        // Parameters:
        //   predicate:
        //     A method to filter count
        //
        // Returns:
        //     Count of entities
        int Count(Expression<Func<TEntity, bool>> predicate);

        //
        // Summary:
        //     Gets count of all entities in this repository based on given predicate.
        //
        // Parameters:
        //   predicate:
        //     A method to filter count
        //
        // Returns:
        //     Count of entities
        Task<int> CountAsync(Expression<Func<TEntity, bool>> predicate);

        //
        // Summary:
        //     Gets count of all entities in this repository (use if expected return value is
        //     greater than System.Int32.MaxValue.
        //
        // Returns:
        //     Count of entities
        long LongCount();

        //
        // Summary:
        //     Gets count of all entities in this repository (use if expected return value is
        //     greater than System.Int32.MaxValue.
        //
        // Returns:
        //     Count of entities
        Task<long> LongCountAsync();

        //
        // Summary:
        //     Gets count of all entities in this repository based on given predicate (use this
        //     overload if expected return value is greater than System.Int32.MaxValue).
        //
        // Parameters:
        //   predicate:
        //     A method to filter count
        //
        // Returns:
        //     Count of entities
        long LongCount(Expression<Func<TEntity, bool>> predicate);

        //
        // Summary:
        //     Gets count of all entities in this repository based on given predicate (use this
        //     overload if expected return value is greater than System.Int32.MaxValue).
        //
        // Parameters:
        //   predicate:
        //     A method to filter count
        //
        // Returns:
        //     Count of entities
        Task<long> LongCountAsync(Expression<Func<TEntity, bool>> predicate);

        void Detach(TEntity entity);

        int SaveChanges();

        Task<int> SaveChangesAsync();
        bool Exists(Expression<Func<TEntity, bool>> predicate);
    }

}
