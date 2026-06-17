using AutoMapper;
using BackOffice.Api.Controllers;
using BackOffice.Api.Services;
using BackOffice.Application.DTOs.Mian.User;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Application.Interfaces.Services.Tenant;
using BackOffice.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using System.Security.Claims;
using Xunit;

namespace BackOffice.Application.Test.Controllers
{
    public class UserControllerTests
    {
        private readonly Mock<IWebAppUserService> _mockAppUserService;
        private readonly Mock<IWebUserManagementService> _mockUserManagementService;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<ITenantProvider> _mockTenantProvider;
        private readonly Mock<IS3StorageService> _mockS3StorageService;
        private readonly UserController _controller;

        public UserControllerTests()
        {
            _mockAppUserService = new Mock<IWebAppUserService>();
            _mockUserManagementService = new Mock<IWebUserManagementService>();
            _mockMapper = new Mock<IMapper>();
            _mockTenantProvider = new Mock<ITenantProvider>();
            _mockS3StorageService = new Mock<IS3StorageService>();
            _controller = new UserController(
                _mockAppUserService.Object,
                _mockUserManagementService.Object,
                _mockMapper.Object,
                _mockTenantProvider.Object,
                _mockS3StorageService.Object);

            var claims = new List<Claim>
            {
                new Claim("CustomerId", "1"),
                new Claim(ClaimTypes.NameIdentifier, "1")
            };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            var principal = new ClaimsPrincipal(identity);
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
        }

        #region GetDistinctUsers

        [Fact]
        public async Task GetDistinctUsers_ShouldReturnOk_WhenUsersExist()
        {
            var users = new List<UserLookupDto>
            {
                new() { UserId = 1, UserName = "JacobJu", Email = "jacob@rdtsystems.com", LocalUserId = Guid.NewGuid() },
                new() { UserId = 5, UserName = "JohnDoe", Email = "john@example.com", LocalUserId = Guid.NewGuid() }
            };
            var response = ApiResponseFactory.Success(users, "Distinct users fetched successfully.");
            _mockAppUserService.Setup(s => s.GetDistinctUsersAsync()).ReturnsAsync(response);

            var result = await _controller.GetDistinctUsers();

            var okResult = Assert.IsType<OkObjectResult>(result);
            var apiResponse = Assert.IsType<ApiResponse<List<UserLookupDto>>>(okResult.Value);
            Assert.True(apiResponse.IsSuccess);
            Assert.Equal(2, apiResponse.Response.Count);
        }

        [Fact]
        public async Task GetDistinctUsers_ShouldReturnDistinctEmails_WhenDuplicatesExist()
        {
            var users = new List<UserLookupDto>
            {
                new() { UserId = 1, UserName = "JacobJu", Email = "jacob@rdtsystems.com", LocalUserId = Guid.NewGuid() }
            };
            var response = ApiResponseFactory.Success(users, "Distinct users fetched successfully.");
            _mockAppUserService.Setup(s => s.GetDistinctUsersAsync()).ReturnsAsync(response);

            var result = await _controller.GetDistinctUsers();

            var okResult = Assert.IsType<OkObjectResult>(result);
            var apiResponse = Assert.IsType<ApiResponse<List<UserLookupDto>>>(okResult.Value);
            Assert.Single(apiResponse.Response);
            Assert.Equal("jacob@rdtsystems.com", apiResponse.Response[0].Email);
        }

        [Fact]
        public async Task GetDistinctUsers_ShouldReturnEmptyList_WhenNoUsersExist()
        {
            var response = ApiResponseFactory.Success(new List<UserLookupDto>(), "Distinct users fetched successfully.");
            _mockAppUserService.Setup(s => s.GetDistinctUsersAsync()).ReturnsAsync(response);

            var result = await _controller.GetDistinctUsers();

            var okResult = Assert.IsType<OkObjectResult>(result);
            var apiResponse = Assert.IsType<ApiResponse<List<UserLookupDto>>>(okResult.Value);
            Assert.True(apiResponse.IsSuccess);
            Assert.Empty(apiResponse.Response);
        }

        [Fact]
        public async Task GetDistinctUsers_ShouldReturnError_WhenServiceFails()
        {
            var response = ApiResponseFactory.InternalError<List<UserLookupDto>>(
                "Error fetching users.", new List<string> { "Database error" });
            _mockAppUserService.Setup(s => s.GetDistinctUsersAsync()).ReturnsAsync(response);

            var result = await _controller.GetDistinctUsers();

            var okResult = Assert.IsType<OkObjectResult>(result);
            var apiResponse = Assert.IsType<ApiResponse<List<UserLookupDto>>>(okResult.Value);
            Assert.False(apiResponse.IsSuccess);
        }

        #endregion
    }
}
