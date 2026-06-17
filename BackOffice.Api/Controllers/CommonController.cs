using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Mian.User;
using BackOffice.Application.Interfaces.Services;
using Microsoft.AspNetCore.Mvc;
using System.Net;
using System.Net.Mail;
using System.Threading.Tasks;

namespace BackOffice.Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CommonController : ControllerBase
    {
        private readonly IWebAppUserService _appUserService;
        private readonly IMapper _mapper;
        private readonly IConfiguration _configuration;

        public CommonController(IWebAppUserService appUserService, IMapper mapper, IConfiguration configuration)
        {
            _appUserService = appUserService;
            _mapper = mapper;
            _configuration = configuration;
        }

        [HttpPost("SendInvite")]
        public async Task<IActionResult> SendInvite([FromBody] SendInviteDto request)

        {
            var frontendAppUrl = _configuration["AppSetting:FrontendAppUrl"];
            var inviteLink = $"{frontendAppUrl}/api/Common/ApproveInvite?userId={request.UserId}";
            var response = await _appUserService.SendInviteAsync(request.UserId, inviteLink);

            return Ok(response);
        }

        [HttpGet("ApproveInvite")]
        public async Task<IActionResult> ApproveInvite([FromQuery] int userId)
        {
            var frontendAppUrl = _configuration["AppSetting:FrontendAppUrl"];
            var response = await _appUserService.ApproveInviteAsync(userId);

            if (response.IsSuccess)
            {
                return Redirect(frontendAppUrl);
            }

            return Redirect($"{frontendAppUrl}/error");
        }

    }


}
