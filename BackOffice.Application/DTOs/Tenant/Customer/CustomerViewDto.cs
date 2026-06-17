using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Application.DTOs.Tenant.Customer
{
    public class CustomerViewDto
    {
        public Guid CustomerID { get; set; }

        public string? CustomerNo { get; set; }

        public string FirstName { get; set; } = null!;

        public string LastName { get; set; } = null!;

        public Guid? ClubID { get; set; }

        public Guid? MainAddressID { get; set; }

        public Guid? SalesPersonID { get; set; }

        public long? SortOrder { get; set; }

        public DateTime? BirthDay { get; set; }

        public int? CustomerType { get; set; }

        public Guid? DefaultStore { get; set; }

        public string? DefaultStoreName { get; set; }

        public Guid? TaxID { get; set; }

        public decimal? Over0 { get; set; }

        public decimal? Over30 { get; set; }

        public decimal? Over60 { get; set; }

        public decimal? Over90 { get; set; }

        public decimal? Over120 { get; set; }

        public decimal? Credit { get; set; }

        public decimal? CreditLevel1 { get; set; }

        public decimal? CreditLevel2 { get; set; }

        public decimal? CreditLevel3 { get; set; }

        public decimal? CreditOnDelivery { get; set; }

        public int? TermDays { get; set; }

        public decimal? TermDiscount { get; set; }

        public int? CreditCardID { get; set; }

        public string? CreditCardNO { get; set; }

        public string? CSV { get; set; }

        public DateTime? CCExpDate { get; set; }

        public string? DriverLicenseNo { get; set; }

        public string? SState { get; set; }

        public string? SocialSecurytyNO { get; set; }

        public string? Password { get; set; }

        public bool? Statment { get; set; }

        public bool? CheckAccept { get; set; }

        public bool? EnforceCreditLimit { get; set; }

        public bool? EnforceCheckSign { get; set; }

        public bool? OnMailingList { get; set; }

        public string? FaxNumber { get; set; }

        public string? Contact1 { get; set; }

        public string? Contact2 { get; set; }

        public Guid? DiscountID { get; set; }

        public string? AccountNo { get; set; }

        public short? Status { get; set; }

        public decimal BalanceDoe { get; set; }

        public decimal? StartBalance { get; set; }

        public DateTime? StartBalanceDate { get; set; }

        public int? PriceLevelID { get; set; }

        public Guid? DefaultTerms { get; set; }

        public bool? TaxExempt { get; set; }

        public string? FoodStampNo { get; set; }

        public string? FoodStampCode { get; set; }

        public bool? EnforceSignOnAccount { get; set; }

        public bool? RequireCardForSale { get; set; }

        public decimal? Current { get; set; }

        public bool? LockAccount { get; set; }

        public int? LockOutDays { get; set; }

        public string? CreditNameOn { get; set; }

        public string? CreditZip { get; set; }

        public DateTime? DateCreated { get; set; }

        public Guid? UserCreated { get; set; }

        public DateTime? DateModified { get; set; }

        public Guid? UserModified { get; set; }

        public string Name { get; set; } = null!;

        public string AllMainDetails { get; set; } = null!;

        public string? Address { get; set; }

        public string? Address2 { get; set; }

        public string? Phone { get; set; }

        public string? Cell { get; set; }

        public string? CityStateAndZip { get; set; }

        public string? Zones { get; set; }

        public string? InActiveReason { get; set; }

        public bool? AssignCreditLevel { get; set; }

        public Guid? ResellerID { get; set; }

        public int? SOTerms { get; set; }

        public string? Discount { get; set; }

        public string? Email_old { get; set; }

        public short? LoyaltyMembertype { get; set; }

        public string? Email { get; set; }

        public bool? NoBalance { get; set; }

        public string? TaxNumber { get; set; }

        public DateTime? ExpDiscount { get; set; }

        public decimal Points { get; set; }

        public int? DayOfMounth { get; set; }

        public int? RegularPaymentType { get; set; }

        public string? StoreOpen { get; set; }

        public Guid? StoreCreated { get; set; }

        public string? HouseNo { get; set; }

        public string? StreetName { get; set; }

        public DateTime? LastVisit { get; set; }

        public DateTime? LastDateCleared { get; set; }

        public decimal? LastPayment { get; set; }

        public DateTime? LastPaymentDate { get; set; }

        public string? City { get; set; }

        public string? State { get; set; }

        public string? Zip { get; set; }

        public string? note { get; set; }

        public string? GroupName { get; set; }

        public int? CountSales { get; set; }

        public decimal? SumSales { get; set; }

        public DateTime? LastSaleDate { get; set; }
    }
}
