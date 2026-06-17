using AutoMapper;
using BackOffice.Api.Controllers;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Tenant.Item;
using BackOffice.Application.DTOs.Tenant.Lookup;
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
    public class ItemsControllerTests
    {
        private readonly Mock<IItemService> _mockItemService;
        private readonly Mock<IMapper> _mockMapper;
        private readonly Mock<IS3StorageService> _mockS3Service;
        private readonly ItemsController _controller;
        private readonly Guid _testUserId = Guid.NewGuid();

        public ItemsControllerTests()
        {
            _mockItemService = new Mock<IItemService>();
            _mockMapper = new Mock<IMapper>();
            _mockS3Service = new Mock<IS3StorageService>();
            _controller = new ItemsController(_mockItemService.Object, _mockMapper.Object, _mockS3Service.Object);
            SetupUserClaims();
        }

        private void SetupUserClaims()
        {
            var claims = new List<Claim> { new Claim("LocalUserId", _testUserId.ToString()) };
            var identity = new ClaimsIdentity(claims, "TestAuth");
            var principal = new ClaimsPrincipal(identity);
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };
        }

        private void SetupUserWithoutClaims()
        {
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity()) }
            };
        }

        #region GetAll

        [Fact]
        public async Task GetAll_ShouldReturnOk_WithPaginatedItems()
        {
            var pagination = new PaginationGridDto { StartRow = 0, EndRow = 20 };
            var response = new ApiResponse<PaginationResponseDTO<ItemMainAndStoreGridDto>>
            {
                IsSuccess = true,
                Response = new PaginationResponseDTO<ItemMainAndStoreGridDto>
                {
                    TotalRecords = 1,
                    Data = new List<ItemMainAndStoreGridDto> { new() { ItemID = Guid.NewGuid(), Name = "Test" } }
                }
            };
            _mockItemService.Setup(s => s.GetAllItemsMainAndStoreGridAsync(pagination)).Returns(response);

            var result = await _controller.GetAll(pagination);

            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.NotNull(okResult.Value);
        }

        [Fact]
        public async Task GetAll_ShouldReturnOk_WhenNoItemsExist()
        {
            var pagination = new PaginationGridDto { StartRow = 0, EndRow = 20 };
            var response = new ApiResponse<PaginationResponseDTO<ItemMainAndStoreGridDto>>
            {
                IsSuccess = true,
                Response = new PaginationResponseDTO<ItemMainAndStoreGridDto>
                {
                    TotalRecords = 0,
                    Data = new List<ItemMainAndStoreGridDto>()
                }
            };
            _mockItemService.Setup(s => s.GetAllItemsMainAndStoreGridAsync(pagination)).Returns(response);

            var result = await _controller.GetAll(pagination);

            Assert.IsType<OkObjectResult>(result);
        }

        #endregion

        #region GetItemsQuickList

        [Fact]
        public void GetItemsQuickList_ShouldReturnOk()
        {
            var pagination = new PaginationGridDto { StartRow = 0, EndRow = 50 };
            var response = new ApiResponse<PaginationResponseDTO<ItemQuickListGridDto>>
            {
                IsSuccess = true,
                Response = new PaginationResponseDTO<ItemQuickListGridDto> { Data = new() }
            };
            _mockItemService.Setup(s => s.GetAllItemsQuickListAsync(pagination)).Returns(response);

            var result = _controller.GetItemsQuickList(pagination);

            Assert.IsType<OkObjectResult>(result);
        }

        #endregion

        #region AddItem

        [Fact]
        public async Task AddItem_ShouldReturnOk_WhenItemCreatedSuccessfully()
        {
            var dto = new CreateItemDto { Name = "New Item", BarcodeNumber = "123456", StoreNo = Guid.NewGuid() };
            var response = new ApiResponse<CreateItemResponseDto>
            {
                IsSuccess = true,
                Response = new CreateItemResponseDto { ItemID = Guid.NewGuid(), Name = "New Item" }
            };
            _mockItemService.Setup(s => s.AddItemAsync(dto, _testUserId)).ReturnsAsync(response);

            var result = await _controller.AddItem(dto);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var apiResponse = Assert.IsType<ApiResponse<CreateItemResponseDto>>(okResult.Value);
            Assert.True(apiResponse.IsSuccess);
            Assert.Equal("New Item", apiResponse.Response.Name);
        }

        [Fact]
        public async Task AddItem_ShouldReturnBadRequest_WhenServiceFails()
        {
            var dto = new CreateItemDto { Name = "Fail Item", BarcodeNumber = "999", StoreNo = Guid.NewGuid() };
            var response = new ApiResponse<CreateItemResponseDto>
            {
                IsSuccess = false,
                Message = "Barcode already exists"
            };
            _mockItemService.Setup(s => s.AddItemAsync(dto, _testUserId)).ReturnsAsync(response);

            var result = await _controller.AddItem(dto);

            var badResult = Assert.IsType<BadRequestObjectResult>(result);
            var apiResponse = Assert.IsType<ApiResponse<CreateItemResponseDto>>(badResult.Value);
            Assert.False(apiResponse.IsSuccess);
        }

        [Fact]
        public async Task AddItem_ShouldReturnBadRequest_WhenModelStateIsInvalid()
        {
            _controller.ModelState.AddModelError("Name", "Name is required");
            var dto = new CreateItemDto();

            var result = await _controller.AddItem(dto);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task AddItem_ShouldUseEmptyGuid_WhenNoLocalUserIdClaim()
        {
            SetupUserWithoutClaims();
            var dto = new CreateItemDto { Name = "Item", BarcodeNumber = "111", StoreNo = Guid.NewGuid() };
            var response = new ApiResponse<CreateItemResponseDto>
            {
                IsSuccess = true,
                Response = new CreateItemResponseDto { ItemID = Guid.NewGuid() }
            };
            _mockItemService.Setup(s => s.AddItemAsync(dto, Guid.Empty)).ReturnsAsync(response);

            var result = await _controller.AddItem(dto);

            Assert.IsType<OkObjectResult>(result);
            _mockItemService.Verify(s => s.AddItemAsync(dto, Guid.Empty), Times.Once);
        }

        #endregion

        #region UpdateItem

        [Fact]
        public async Task UpdateItem_ShouldReturnOk_WhenUpdateSucceeds()
        {
            var dto = new CreateItemDto { ItemId = Guid.NewGuid(), Name = "Updated", BarcodeNumber = "123", StoreNo = Guid.NewGuid() };
            var response = new ApiResponse<CreateItemResponseDto>
            {
                IsSuccess = true,
                Response = new CreateItemResponseDto { ItemID = dto.ItemId.Value }
            };
            _mockItemService.Setup(s => s.UpdateItemAsync(dto, _testUserId)).ReturnsAsync(response);

            var result = await _controller.UpdateItem(dto);

            Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task UpdateItem_ShouldReturnBadRequest_WhenServiceFails()
        {
            var dto = new CreateItemDto { ItemId = Guid.NewGuid(), Name = "Fail", BarcodeNumber = "123", StoreNo = Guid.NewGuid() };
            var response = new ApiResponse<CreateItemResponseDto> { IsSuccess = false, Message = "Item not found" };
            _mockItemService.Setup(s => s.UpdateItemAsync(dto, _testUserId)).ReturnsAsync(response);

            var result = await _controller.UpdateItem(dto);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task UpdateItem_ShouldReturnBadRequest_WhenModelStateIsInvalid()
        {
            _controller.ModelState.AddModelError("BarcodeNumber", "Required");
            var dto = new CreateItemDto();

            var result = await _controller.UpdateItem(dto);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        #endregion

        #region GetItem

        [Fact]
        public async Task GetItem_ShouldReturnOk_WhenItemExists()
        {
            var itemStoreId = Guid.NewGuid();
            var response = new ApiResponse<ItemMainAndStoreGridDto?>
            {
                IsSuccess = true,
                Response = new ItemMainAndStoreGridDto { ItemID = Guid.NewGuid(), Name = "Found Item" }
            };
            _mockItemService.Setup(s => s.GetItemByIdAsync(itemStoreId)).ReturnsAsync(response);

            var result = await _controller.GetItem(itemStoreId);

            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.NotNull(okResult.Value);
        }

        [Fact]
        public async Task GetItem_ShouldReturnNotFound_WhenItemDoesNotExist()
        {
            var itemStoreId = Guid.NewGuid();
            var response = new ApiResponse<ItemMainAndStoreGridDto?> { IsSuccess = false, Message = "Not found" };
            _mockItemService.Setup(s => s.GetItemByIdAsync(itemStoreId)).ReturnsAsync(response);

            var result = await _controller.GetItem(itemStoreId);

            Assert.IsType<NotFoundObjectResult>(result);
        }

        #endregion

        #region BarcodeExists

        [Fact]
        public async Task BarcodeExists_ShouldReturnOk_WhenBarcodeIsProvided()
        {
            var response = new ApiResponse<bool> { IsSuccess = true, Response = true };
            _mockItemService.Setup(s => s.BarcodeExistsAsync("12345", null)).ReturnsAsync(response);

            var result = await _controller.BarcodeExists("12345");

            var okResult = Assert.IsType<OkObjectResult>(result);
            var apiResponse = Assert.IsType<ApiResponse<bool>>(okResult.Value);
            Assert.True(apiResponse.Response);
        }

        [Fact]
        public async Task BarcodeExists_ShouldReturnOk_WhenBarcodeDoesNotExist()
        {
            var response = new ApiResponse<bool> { IsSuccess = true, Response = false };
            _mockItemService.Setup(s => s.BarcodeExistsAsync("99999", null)).ReturnsAsync(response);

            var result = await _controller.BarcodeExists("99999");

            var okResult = Assert.IsType<OkObjectResult>(result);
            var apiResponse = Assert.IsType<ApiResponse<bool>>(okResult.Value);
            Assert.False(apiResponse.Response);
        }

        [Fact]
        public async Task BarcodeExists_ShouldReturnBadRequest_WhenBarcodeIsEmpty()
        {
            var result = await _controller.BarcodeExists("");

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task BarcodeExists_ShouldReturnBadRequest_WhenBarcodeIsWhitespace()
        {
            var result = await _controller.BarcodeExists("   ");

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task BarcodeExists_ShouldPassExcludeItemId_WhenProvided()
        {
            var excludeId = Guid.NewGuid();
            var response = new ApiResponse<bool> { IsSuccess = true, Response = false };
            _mockItemService.Setup(s => s.BarcodeExistsAsync("12345", excludeId)).ReturnsAsync(response);

            var result = await _controller.BarcodeExists("12345", excludeId);

            _mockItemService.Verify(s => s.BarcodeExistsAsync("12345", excludeId), Times.Once);
        }

        #endregion

        #region ModelNumberExists

        [Fact]
        public async Task ModelNumberExists_ShouldReturnOk_WhenModelNumberProvided()
        {
            var response = new ApiResponse<bool> { IsSuccess = true, Response = true };
            _mockItemService.Setup(s => s.ModelNumberExistsAsync("MOD-1", null)).ReturnsAsync(response);

            var result = await _controller.ModelNumberExists("MOD-1");

            Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task ModelNumberExists_ShouldReturnBadRequest_WhenEmpty()
        {
            var result = await _controller.ModelNumberExists("");

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task ModelNumberExists_ShouldReturnBadRequest_WhenWhitespace()
        {
            var result = await _controller.ModelNumberExists("   ");

            Assert.IsType<BadRequestObjectResult>(result);
        }

        #endregion

        #region ItemNameExists

        [Fact]
        public async Task ItemNameExists_ShouldReturnOk_WhenNameProvided()
        {
            var response = new ApiResponse<bool> { IsSuccess = true, Response = false };
            _mockItemService.Setup(s => s.ItemNameExistsAsync("Test Item", null)).ReturnsAsync(response);

            var result = await _controller.ItemNameExists("Test Item");

            Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task ItemNameExists_ShouldReturnBadRequest_WhenNameIsEmpty()
        {
            var result = await _controller.ItemNameExists("");

            Assert.IsType<BadRequestObjectResult>(result);
        }

        #endregion

        #region AliasBarcodeExists

        [Fact]
        public async Task AliasBarcodeExists_ShouldReturnOk_WhenBarcodeProvided()
        {
            var response = new ApiResponse<bool> { IsSuccess = true, Response = false };
            _mockItemService.Setup(s => s.AliasBarcodeExistsAsync("111", null, null)).ReturnsAsync(response);

            var result = await _controller.AliasBarcodeExists("111");

            Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task AliasBarcodeExists_ShouldReturnBadRequest_WhenBarcodeIsEmpty()
        {
            var result = await _controller.AliasBarcodeExists("");

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task AliasBarcodeExists_ShouldPassExcludeIds_WhenProvided()
        {
            var excludeAliasId = Guid.NewGuid();
            var excludeItemId = Guid.NewGuid();
            var response = new ApiResponse<bool> { IsSuccess = true, Response = false };
            _mockItemService.Setup(s => s.AliasBarcodeExistsAsync("111", excludeAliasId, excludeItemId)).ReturnsAsync(response);

            await _controller.AliasBarcodeExists("111", excludeAliasId, excludeItemId);

            _mockItemService.Verify(s => s.AliasBarcodeExistsAsync("111", excludeAliasId, excludeItemId), Times.Once);
        }

        #endregion

        #region GetDepartmentDefaults

        [Fact]
        public async Task GetDepartmentDefaults_ShouldReturnOk_WhenFound()
        {
            var deptStoreId = Guid.NewGuid();
            var response = new ApiResponse<DepartmentDefaultsDto?>
            {
                IsSuccess = true,
                Response = new DepartmentDefaultsDto { DepartmentStoreID = deptStoreId, Name = "Grocery", DefaultMarkup = 25 }
            };
            _mockItemService.Setup(s => s.GetDepartmentDefaultsAsync(deptStoreId)).ReturnsAsync(response);

            var result = await _controller.GetDepartmentDefaults(deptStoreId);

            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.NotNull(okResult.Value);
        }

        [Fact]
        public async Task GetDepartmentDefaults_ShouldReturnNotFound_WhenNotFound()
        {
            var deptStoreId = Guid.NewGuid();
            var response = new ApiResponse<DepartmentDefaultsDto?> { IsSuccess = false, Message = "Department not found" };
            _mockItemService.Setup(s => s.GetDepartmentDefaultsAsync(deptStoreId)).ReturnsAsync(response);

            var result = await _controller.GetDepartmentDefaults(deptStoreId);

            Assert.IsType<NotFoundObjectResult>(result);
        }

        #endregion

        #region UploadImage

        [Fact]
        public async Task UploadImage_ShouldReturnBadRequest_WhenNoFile()
        {
            var result = await _controller.UploadImage(null!);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task UploadImage_ShouldReturnBadRequest_WhenFileIsEmpty()
        {
            var file = new Mock<IFormFile>();
            file.Setup(f => f.Length).Returns(0);

            var result = await _controller.UploadImage(file.Object);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task UploadImage_ShouldReturnBadRequest_WhenInvalidFileType()
        {
            var file = CreateMockFile("test.txt", "text/plain", 1024);

            var result = await _controller.UploadImage(file);

            var badResult = Assert.IsType<BadRequestObjectResult>(result);
            var apiResult = Assert.IsType<ApiResult<object>>(badResult.Value);
            Assert.Contains("Invalid file type", apiResult.Message);
        }

        [Fact]
        public async Task UploadImage_ShouldReturnBadRequest_WhenFileExceeds5MB()
        {
            var file = CreateMockFile("image.jpg", "image/jpeg", 6 * 1024 * 1024);

            var result = await _controller.UploadImage(file);

            var badResult = Assert.IsType<BadRequestObjectResult>(result);
            var apiResult = Assert.IsType<ApiResult<object>>(badResult.Value);
            Assert.Contains("5MB", apiResult.Message);
        }

        [Fact]
        public async Task UploadImage_ShouldReturnBadRequest_WhenImageSlotInvalid()
        {
            var file = CreateMockFile("image.jpg", "image/jpeg", 1024);

            var result = await _controller.UploadImage(file, imageSlot: 4);

            var badResult = Assert.IsType<BadRequestObjectResult>(result);
            var apiResult = Assert.IsType<ApiResult<object>>(badResult.Value);
            Assert.Contains("1, 2, or 3", apiResult.Message);
        }

        [Fact]
        public async Task UploadImage_ShouldReturnBadRequest_WhenImageSlotIsZero()
        {
            var file = CreateMockFile("image.png", "image/png", 1024);

            var result = await _controller.UploadImage(file, imageSlot: 0);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task UploadImage_ShouldReturnOk_WhenValidFileWithoutItemId()
        {
            var file = CreateMockFile("image.jpg", "image/jpeg", 1024);
            _mockS3Service.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), "image/jpeg"))
                .ReturnsAsync("s3://bucket/image.jpg");
            _mockS3Service.Setup(s => s.GetPreSignedUrl(It.IsAny<string>(), 60))
                .Returns("https://presigned-url.com/image.jpg");

            var result = await _controller.UploadImage(file);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var apiResult = Assert.IsType<ApiResult<object>>(okResult.Value);
            Assert.True(apiResult.IsSuccess);
        }

        [Fact]
        public async Task UploadImage_ShouldUpdateItemImage_WhenItemIdProvided()
        {
            var itemId = Guid.NewGuid();
            var file = CreateMockFile("image.png", "image/png", 2048);
            _mockS3Service.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), "image/png"))
                .ReturnsAsync("s3://path");
            _mockS3Service.Setup(s => s.GetPreSignedUrl(It.IsAny<string>(), 60))
                .Returns("https://url");
            _mockItemService.Setup(s => s.UpdateItemImageAsync(itemId, "s3://path", 1))
                .ReturnsAsync(new ApiResult<bool> { IsSuccess = true });

            var result = await _controller.UploadImage(file, itemId, 1);

            Assert.IsType<OkObjectResult>(result);
            _mockItemService.Verify(s => s.UpdateItemImageAsync(itemId, "s3://path", 1), Times.Once);
        }

        [Fact]
        public async Task UploadImage_ShouldReturnOkWithWarning_WhenS3SucceedsButItemUpdateFails()
        {
            var itemId = Guid.NewGuid();
            var file = CreateMockFile("image.jpg", "image/jpeg", 1024);
            _mockS3Service.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), "image/jpeg"))
                .ReturnsAsync("s3://path");
            _mockS3Service.Setup(s => s.GetPreSignedUrl(It.IsAny<string>(), 60))
                .Returns("https://url");
            _mockItemService.Setup(s => s.UpdateItemImageAsync(itemId, "s3://path", 1))
                .ReturnsAsync(new ApiResult<bool> { IsSuccess = false });

            var result = await _controller.UploadImage(file, itemId, 1);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var apiResult = Assert.IsType<ApiResult<object>>(okResult.Value);
            Assert.True(apiResult.IsSuccess);
            Assert.Contains("could not link", apiResult.Message);
        }

        [Fact]
        public async Task UploadImage_ShouldAcceptAllValidImageTypes()
        {
            var validTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };

            foreach (var contentType in validTypes)
            {
                var file = CreateMockFile($"test.{contentType.Split('/')[1]}", contentType, 1024);
                _mockS3Service.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), contentType))
                    .ReturnsAsync("s3://path");
                _mockS3Service.Setup(s => s.GetPreSignedUrl(It.IsAny<string>(), 60))
                    .Returns("https://url");

                var result = await _controller.UploadImage(file);

                Assert.IsType<OkObjectResult>(result);
            }
        }

        [Fact]
        public async Task UploadImage_ShouldReturn500_WhenS3Throws()
        {
            var file = CreateMockFile("image.jpg", "image/jpeg", 1024);
            _mockS3Service.Setup(s => s.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), "image/jpeg"))
                .ThrowsAsync(new Exception("S3 failure"));

            var result = await _controller.UploadImage(file);

            var statusResult = Assert.IsType<ObjectResult>(result);
            Assert.Equal(500, statusResult.StatusCode);
        }

        #endregion

        #region GetImageUrl

        [Fact]
        public async Task GetImageUrl_ShouldReturnOk_WhenImageExists()
        {
            var itemId = Guid.NewGuid();
            _mockItemService.Setup(s => s.GetItemImagePathAsync(itemId, 1))
                .ReturnsAsync(new ApiResult<string?> { IsSuccess = true, Response = "s3://image.jpg" });
            _mockS3Service.Setup(s => s.GetPreSignedUrl("s3://image.jpg", 60))
                .Returns("https://presigned.url");

            var result = await _controller.GetImageUrl(itemId);

            Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task GetImageUrl_ShouldReturnNotFound_WhenNoImage()
        {
            var itemId = Guid.NewGuid();
            _mockItemService.Setup(s => s.GetItemImagePathAsync(itemId, 1))
                .ReturnsAsync(new ApiResult<string?> { IsSuccess = false });

            var result = await _controller.GetImageUrl(itemId);

            Assert.IsType<NotFoundObjectResult>(result);
        }

        [Fact]
        public async Task GetImageUrl_ShouldReturnNotFound_WhenPathIsEmpty()
        {
            var itemId = Guid.NewGuid();
            _mockItemService.Setup(s => s.GetItemImagePathAsync(itemId, 1))
                .ReturnsAsync(new ApiResult<string?> { IsSuccess = true, Response = "" });

            var result = await _controller.GetImageUrl(itemId);

            Assert.IsType<NotFoundObjectResult>(result);
        }

        [Fact]
        public async Task GetImageUrl_ShouldReturnBadRequest_WhenSlotInvalid()
        {
            var result = await _controller.GetImageUrl(Guid.NewGuid(), imageSlot: 5);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        #endregion

        #region DeleteImage

        [Fact]
        public async Task DeleteImage_ShouldReturnOk_WhenDeleteSucceeds()
        {
            var itemId = Guid.NewGuid();
            _mockItemService.Setup(s => s.GetItemImagePathAsync(itemId, 1))
                .ReturnsAsync(new ApiResult<string?> { IsSuccess = true, Response = "s3://path" });
            _mockS3Service.Setup(s => s.DeleteFileAsync("s3://path")).ReturnsAsync(true);
            _mockItemService.Setup(s => s.UpdateItemImageAsync(itemId, null, 1))
                .ReturnsAsync(new ApiResult<bool> { IsSuccess = true });

            var result = await _controller.DeleteImage(itemId);

            var okResult = Assert.IsType<OkObjectResult>(result);
            var apiResult = Assert.IsType<ApiResult<object>>(okResult.Value);
            Assert.True(apiResult.IsSuccess);
        }

        [Fact]
        public async Task DeleteImage_ShouldReturnNotFound_WhenNoImageToDelete()
        {
            var itemId = Guid.NewGuid();
            _mockItemService.Setup(s => s.GetItemImagePathAsync(itemId, 1))
                .ReturnsAsync(new ApiResult<string?> { IsSuccess = false });

            var result = await _controller.DeleteImage(itemId);

            Assert.IsType<NotFoundObjectResult>(result);
        }

        [Fact]
        public async Task DeleteImage_ShouldReturn500_WhenS3DeleteFails()
        {
            var itemId = Guid.NewGuid();
            _mockItemService.Setup(s => s.GetItemImagePathAsync(itemId, 1))
                .ReturnsAsync(new ApiResult<string?> { IsSuccess = true, Response = "s3://path" });
            _mockS3Service.Setup(s => s.DeleteFileAsync("s3://path")).ReturnsAsync(false);

            var result = await _controller.DeleteImage(itemId);

            var statusResult = Assert.IsType<ObjectResult>(result);
            Assert.Equal(500, statusResult.StatusCode);
        }

        [Fact]
        public async Task DeleteImage_ShouldReturn500_WhenDbUpdateFails()
        {
            var itemId = Guid.NewGuid();
            _mockItemService.Setup(s => s.GetItemImagePathAsync(itemId, 1))
                .ReturnsAsync(new ApiResult<string?> { IsSuccess = true, Response = "s3://path" });
            _mockS3Service.Setup(s => s.DeleteFileAsync("s3://path")).ReturnsAsync(true);
            _mockItemService.Setup(s => s.UpdateItemImageAsync(itemId, null, 1))
                .ReturnsAsync(new ApiResult<bool> { IsSuccess = false });

            var result = await _controller.DeleteImage(itemId);

            var statusResult = Assert.IsType<ObjectResult>(result);
            Assert.Equal(500, statusResult.StatusCode);
        }

        [Fact]
        public async Task DeleteImage_ShouldReturnBadRequest_WhenSlotInvalid()
        {
            var result = await _controller.DeleteImage(Guid.NewGuid(), imageSlot: 0);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        #endregion

        #region GetItemsWithInventory

        [Fact]
        public async Task GetItemsWithInventory_ShouldReturnOk_WhenSuccessful()
        {
            var response = new ApiResponse<ItemsWithInventoryReportDto>
            {
                IsSuccess = true,
                Response = new ItemsWithInventoryReportDto { TotalCount = 5, Items = new() }
            };
            _mockItemService.Setup(s => s.GetItemsWithInventoryAsync(
                    It.IsAny<ItemsWithInventoryRequestDto>(), It.IsAny<Guid?>(), It.IsAny<bool>()))
                .ReturnsAsync(response);

            var result = await _controller.GetItemsWithInventory();

            Assert.IsType<OkObjectResult>(result);
        }

        [Fact]
        public async Task GetItemsWithInventory_ShouldReturnBadRequest_WhenServiceFails()
        {
            var response = new ApiResponse<ItemsWithInventoryReportDto>
            {
                IsSuccess = false,
                Message = "Error"
            };
            _mockItemService.Setup(s => s.GetItemsWithInventoryAsync(
                    It.IsAny<ItemsWithInventoryRequestDto>(), It.IsAny<Guid?>(), It.IsAny<bool>()))
                .ReturnsAsync(response);

            var result = await _controller.GetItemsWithInventory();

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task GetItemsWithInventory_ShouldPassFilterParameters()
        {
            var storeId = Guid.NewGuid();
            var response = new ApiResponse<ItemsWithInventoryReportDto>
            {
                IsSuccess = true,
                Response = new ItemsWithInventoryReportDto()
            };
            _mockItemService.Setup(s => s.GetItemsWithInventoryAsync(
                It.Is<ItemsWithInventoryRequestDto>(r =>
                    r.StoreId == storeId && r.PageNumber == 2 && r.PageSize == 50 && r.SearchText == "test"),
                It.IsAny<Guid?>(),
                It.IsAny<bool>()
            )).ReturnsAsync(response);

            var result = await _controller.GetItemsWithInventory(storeId, 2, 50, "test");

            Assert.IsType<OkObjectResult>(result);
        }

        #endregion

        #region ToggleItemStatus

        [Fact]
        public async Task ToggleItemStatus_ShouldReturnOk_WhenSuccessful()
        {
            var itemStoreId = Guid.NewGuid();
            var response = new ApiResponse<bool> { IsSuccess = true, Response = true, Message = "Deactivated" };
            _mockItemService.Setup(s => s.ToggleItemStatusAsync(itemStoreId, _testUserId)).ReturnsAsync(response);

            var result = await _controller.ToggleItemStatus(itemStoreId);

            var okResult = Assert.IsType<OkObjectResult>(result);
            Assert.NotNull(okResult.Value);
        }

        [Fact]
        public async Task ToggleItemStatus_ShouldReturnBadRequest_WhenFails()
        {
            var itemStoreId = Guid.NewGuid();
            var response = new ApiResponse<bool> { IsSuccess = false, Message = "Item not found" };
            _mockItemService.Setup(s => s.ToggleItemStatusAsync(itemStoreId, _testUserId)).ReturnsAsync(response);

            var result = await _controller.ToggleItemStatus(itemStoreId);

            Assert.IsType<BadRequestObjectResult>(result);
        }

        [Fact]
        public async Task ToggleItemStatus_ShouldUseEmptyGuid_WhenNoUserClaim()
        {
            SetupUserWithoutClaims();
            var itemStoreId = Guid.NewGuid();
            var response = new ApiResponse<bool> { IsSuccess = true };
            _mockItemService.Setup(s => s.ToggleItemStatusAsync(itemStoreId, Guid.Empty)).ReturnsAsync(response);

            var result = await _controller.ToggleItemStatus(itemStoreId);

            _mockItemService.Verify(s => s.ToggleItemStatusAsync(itemStoreId, Guid.Empty), Times.Once);
        }

        #endregion

        #region Helpers

        private static IFormFile CreateMockFile(string fileName, string contentType, long length)
        {
            var stream = new MemoryStream(new byte[length]);
            var file = new Mock<IFormFile>();
            file.Setup(f => f.FileName).Returns(fileName);
            file.Setup(f => f.ContentType).Returns(contentType);
            file.Setup(f => f.Length).Returns(length);
            file.Setup(f => f.OpenReadStream()).Returns(stream);
            return file.Object;
        }

        #endregion
    }
}
