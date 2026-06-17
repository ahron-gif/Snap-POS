using BackOffice.Application.DTOs;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.Helpers
{
    public static class QueryHelper
    {
        //public static IQueryable<T> ApplyFilters<T>(IQueryable<T> query, List<PaginationGridFilterDto> filters)
        //{
        //    var parameter = Expression.Parameter(typeof(T), "x");

        //    Expression? finalExpression = null;

        //    foreach (var filter in filters)
        //    {
        //        if (string.IsNullOrWhiteSpace(filter.Col) || string.IsNullOrWhiteSpace(filter.Value))
        //            continue;

        //        var property = Expression.PropertyOrField(parameter, filter.Col);
        //        var toStringCall = Expression.Call(property, "ToString", null, null);

        //        var method = typeof(DbFunctionsExtensions).GetMethod(
        //            nameof(DbFunctionsExtensions.Like),
        //            new[] { typeof(DbFunctions), typeof(string), typeof(string) });

        //        var dbFunc = Expression.Property(null, typeof(EF), nameof(EF.Functions));

        //        Expression valueExpr = Expression.Constant(filter.Value);
        //        if (filter.Type == "contains" || filter.Type == "notContains")
        //            valueExpr = Expression.Constant($"%{filter.Value}%");

        //        var likeCall = Expression.Call(method!, dbFunc, toStringCall, valueExpr);

        //        Expression predicate = filter.Type == "notContains" ? Expression.Not(likeCall) : (Expression)likeCall;

        //        // Combine with OR or AND depending on filter.Operator
        //        if (finalExpression == null)
        //        {
        //            finalExpression = predicate;
        //        }
        //        else
        //        {
        //            finalExpression = filter.OperatorType?.ToLower() == "or"
        //                ? Expression.OrElse(finalExpression, predicate)
        //                : Expression.AndAlso(finalExpression, predicate);
        //        }
        //    }

        //    if (finalExpression != null)
        //    {
        //        var lambda = Expression.Lambda<Func<T, bool>>(finalExpression, parameter);
        //        query = query.Where(lambda);
        //    }

        //    return query;
        //}

        public static IQueryable<T> ApplyFilters<T>(IQueryable<T> query, List<PaginationGridFilterDto> filters, string? customSearchText, string? customSearchColumns)
        {
            var parameter = Expression.Parameter(typeof(T), "x");

            Expression? finalExpression = null;

            // Resolve a search column to an Expression that EF Core can translate to SQL inside
            // `EF.Functions.Like(<expr>, '%text%')`.
            //
            // The naive approach is `column.ToString()` for every type — but that breaks in
            // EF Core 6+: `string.ToString()` has no SQL translation, and `.ToString()` over
            // a CASE expression (e.g. the `DiscountTypeName` ternary projection) also fails.
            // Picking the operand based on the property's CLR type keeps the LIKE on a value
            // EF can map cleanly:
            //   • string / string?         → use the property directly (LIKE works natively).
            //   • int, Guid, decimal, etc. → SqlFunctions.StringConvert isn't always available,
            //                                so fall back to `.ToString()` (works for value types
            //                                whose translation EF still supports), but this is
            //                                only reached when the caller asks to search a
            //                                non-string column — usually they shouldn't.
            // Property may also be a computed expression (projection ternary) whose static
            // type the C# compiler still reports as `string` — that path is covered by the
            // first branch.
            static Expression BuildLikeOperand(Expression property)
            {
                if (property.Type == typeof(string)) return property;
                // Compose `(property == null ? null : property.ToString())` would be safer but
                // EF emits NULL handling on its own; bare `.ToString()` matches the original
                // behavior for value types where it used to work.
                return Expression.Call(property, "ToString", null, null);
            }

            // Apply CustomGridSearchText and CustomGridSearchColumns filter
            if (!string.IsNullOrEmpty(customSearchText) && !string.IsNullOrEmpty(customSearchColumns))
            {
                var columns = customSearchColumns.Split(',').Select(col => col.Trim()).ToList();
                Expression? customSearchExpression = null;

                foreach (var column in columns)
                {
                    var property = Expression.PropertyOrField(parameter, column);
                    var operand = BuildLikeOperand(property);

                    var method = typeof(DbFunctionsExtensions).GetMethod(
                        nameof(DbFunctionsExtensions.Like),
                        new[] { typeof(DbFunctions), typeof(string), typeof(string) });

                    var dbFunc = Expression.Property(null, typeof(EF), nameof(EF.Functions));

                    var valueExpr = Expression.Constant($"%{customSearchText}%");

                    var likeCall = Expression.Call(method!, dbFunc, operand, valueExpr);
                    customSearchExpression = customSearchExpression == null ? likeCall : Expression.OrElse(customSearchExpression, likeCall);
                }

                if (customSearchExpression != null)
                {
                    if (finalExpression == null)
                    {
                        finalExpression = customSearchExpression;
                    }
                    else
                    {
                        finalExpression = Expression.AndAlso(finalExpression, customSearchExpression);
                    }
                }
            }

            // Apply other filters as you did previously
            foreach (var filter in filters)
            {
                if (string.IsNullOrWhiteSpace(filter.Col) || string.IsNullOrWhiteSpace(filter.Value))
                    continue;

                var property = Expression.PropertyOrField(parameter, filter.Col);
                var operand = BuildLikeOperand(property);

                var method = typeof(DbFunctionsExtensions).GetMethod(
                    nameof(DbFunctionsExtensions.Like),
                    new[] { typeof(DbFunctions), typeof(string), typeof(string) });

                var dbFunc = Expression.Property(null, typeof(EF), nameof(EF.Functions));

                Expression valueExpr = Expression.Constant(filter.Value);
                if (filter.Type == "contains" || filter.Type == "notContains")
                    valueExpr = Expression.Constant($"%{filter.Value}%");

                var likeCall = Expression.Call(method!, dbFunc, operand, valueExpr);

                Expression predicate = filter.Type == "notContains" ? Expression.Not(likeCall) : (Expression)likeCall;

                // Combine with OR or AND depending on filter.Operator
                if (finalExpression == null)
                {
                    finalExpression = predicate;
                }
                else
                {
                    finalExpression = filter.OperatorType?.ToLower() == "or"
                        ? Expression.OrElse(finalExpression, predicate)
                        : Expression.AndAlso(finalExpression, predicate);
                }
            }

            if (finalExpression != null)
            {
                var lambda = Expression.Lambda<Func<T, bool>>(finalExpression, parameter);
                query = query.Where(lambda);
            }

            return query;
        }



    }

}
