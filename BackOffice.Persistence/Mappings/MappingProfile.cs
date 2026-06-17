

using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Main.RoleManagement;
using BackOffice.Application.DTOs.Mian.Customer;
using BackOffice.Application.DTOs.Mian.User;
using BackOffice.Application.DTOs.Tenant.Customer;
using BackOffice.Application.DTOs.Tenant.Item;
using BackOffice.Application.DTOs.Tenant.PhoneOrder;
using BackOffice.Application.DTOs.Tenant.RoleManagement;
using BackOffice.Application.DTOs.Tenant.User;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Entities.Tenant;



namespace Ctore.Persistence.BO.Mappings
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            CreateMap<Template, TemplateDto>().ReverseMap();
            CreateMap<WebUsersStore, UsersStoreDto>().ReverseMap();
            CreateMap<WebUser, UserDto>().ReverseMap();

            CreateMap<WebAppUser, AppUserDto>().ReverseMap();
            CreateMap<ItemMainAndStoreGrid, ItemMainAndStoreGridDto>()
                .ForMember(dest => dest.PatternId, opt => opt.Ignore())
                .ReverseMap();

            CreateMap<CustomerView, CustomerViewDto>().ReverseMap();
            CreateMap<PhoneOrderView, PhoneOrderViewDto>().ReverseMap();
            CreateMap<BackOffice.Domain.Entities.Main.Customer, TennatDto>().ReverseMap();
            CreateMap<BackOffice.Domain.Entities.Main.Customer, TennatLookupDto>().ReverseMap();

            // Item mappings for Create operations
            CreateMap<CreateItemDto, ItemMain>()
                .ForMember(dest => dest.ItemID, opt => opt.Ignore())
                .ForMember(dest => dest.Status, opt => opt.Ignore())
                .ForMember(dest => dest.DateCreated, opt => opt.Ignore())
                .ForMember(dest => dest.DateModified, opt => opt.Ignore())
                .ForMember(dest => dest.UserCreated, opt => opt.Ignore())
                .ForMember(dest => dest.UserModified, opt => opt.Ignore())
                .ForMember(dest => dest.Meaasure, opt => opt.MapFrom(src => src.Measure));

            CreateMap<CreateItemDto, ItemStore>()
                .ForMember(dest => dest.ItemStoreID, opt => opt.Ignore())
                .ForMember(dest => dest.ItemNo, opt => opt.Ignore())
                .ForMember(dest => dest.Status, opt => opt.Ignore())
                .ForMember(dest => dest.DateCreated, opt => opt.Ignore())
                .ForMember(dest => dest.DateModified, opt => opt.Ignore())
                .ForMember(dest => dest.UserCreated, opt => opt.Ignore())
                .ForMember(dest => dest.UserModified, opt => opt.Ignore());

            CreateMap<CreateItemSupplyDto, ItemSupply>()
                .ForMember(dest => dest.ItemSupplyID, opt => opt.Ignore())
                .ForMember(dest => dest.ItemStoreNo, opt => opt.Ignore())
                .ForMember(dest => dest.Status, opt => opt.Ignore())
                .ForMember(dest => dest.DateCreated, opt => opt.Ignore())
                .ForMember(dest => dest.DateModified, opt => opt.Ignore())
                .ForMember(dest => dest.UserCreated, opt => opt.Ignore())
                .ForMember(dest => dest.UserModified, opt => opt.Ignore());

            CreateMap<CreateItemToGroupDto, ItemToGroup>()
                .ForMember(dest => dest.ItemToGroupID, opt => opt.Ignore())
                .ForMember(dest => dest.ItemStoreID, opt => opt.Ignore())
                .ForMember(dest => dest.Status, opt => opt.Ignore())
                .ForMember(dest => dest.DateModified, opt => opt.Ignore());

            CreateMap<CreateItemAliasDto, ItemAlias>()
                .ForMember(dest => dest.AliasId, opt => opt.Ignore())
                .ForMember(dest => dest.ItemNo, opt => opt.Ignore())
                .ForMember(dest => dest.Status, opt => opt.Ignore())
                .ForMember(dest => dest.DateCreated, opt => opt.Ignore())
                .ForMember(dest => dest.DateModified, opt => opt.Ignore())
                .ForMember(dest => dest.UserCreated, opt => opt.Ignore())
                .ForMember(dest => dest.UserModified, opt => opt.Ignore());

            CreateMap<ScreenAction, ScreenActionDto>().ReverseMap();
            CreateMap<CreateScreenActionDto, ScreenAction>()
                .ForMember(dest => dest.ScreenActionId, opt => opt.Ignore())
                .ForMember(dest => dest.IsActive, opt => opt.Ignore())
                .ForMember(dest => dest.DateCreated, opt => opt.Ignore())
                .ForMember(dest => dest.DateModified, opt => opt.Ignore());

            CreateMap<GlobalRole, GlobalRoleGridDto>();
            CreateMap<GlobalRole, GlobalRoleDetailDto>();
            CreateMap<CreateGlobalRoleDto, GlobalRole>()
                .ForMember(dest => dest.GlobalRoleId, opt => opt.Ignore())
                .ForMember(dest => dest.IsActive, opt => opt.Ignore())
                .ForMember(dest => dest.DateCreated, opt => opt.Ignore())
                .ForMember(dest => dest.DateModified, opt => opt.Ignore())
                .ForMember(dest => dest.CreatedBy, opt => opt.Ignore());

            CreateMap<CreateUserDto, WebUser>()
                .ForMember(dest => dest.UserId, opt => opt.Ignore())
                .ForMember(dest => dest.Status, opt => opt.Ignore())
                .ForMember(dest => dest.DateCreated, opt => opt.Ignore())
                .ForMember(dest => dest.DateModified, opt => opt.Ignore())
                .ForMember(dest => dest.UserCreated, opt => opt.Ignore())
                .ForMember(dest => dest.UserModified, opt => opt.Ignore());

            CreateMap<CreateUserDto, WebAppUser>()
                .ForMember(dest => dest.UserId, opt => opt.Ignore())
                .ForMember(dest => dest.LocalUserId, opt => opt.Ignore())
                .ForMember(dest => dest.CustomerId, opt => opt.Ignore())
                .ForMember(dest => dest.DateCreated, opt => opt.Ignore())
                .ForMember(dest => dest.DateModified, opt => opt.Ignore())
                .ForMember(dest => dest.InviteStatus, opt => opt.Ignore())
                .ForMember(dest => dest.LoginType, opt => opt.Ignore())
                .ForMember(dest => dest.Status, opt => opt.Ignore())
                .ForMember(dest => dest.UserCreated, opt => opt.Ignore())
                .ForMember(dest => dest.UserModified, opt => opt.Ignore())
                .ForMember(dest => dest.ScanID, opt => opt.Ignore())
                .ForMember(dest => dest.IsLogIn, opt => opt.Ignore())
                .ForMember(dest => dest.Phone, opt => opt.MapFrom(src => src.HomePhoneNumber));

            CreateMap<WebUser, UserDetailDto>()
                .ForMember(dest => dest.TenantUserId, opt => opt.MapFrom(src => src.UserId))
                .ForMember(dest => dest.MainUserId, opt => opt.Ignore())
                .ForMember(dest => dest.CustomerId, opt => opt.Ignore())
                .ForMember(dest => dest.Phone, opt => opt.Ignore());

        }
    }
}
