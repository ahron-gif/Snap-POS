using AutoMapper;
using BackOffice.Application.DTOs;
using BackOffice.Application.DTOs.Mian.User;
using BackOffice.Application.Helpers;
using BackOffice.Application.Interfaces.Repositories;
using BackOffice.Application.Interfaces.Repositories.Tenant;
using BackOffice.Application.Interfaces.Services;
using BackOffice.Application.Interfaces.Services.Main;
using BackOffice.Common;
using BackOffice.Common.Functions;
using BackOffice.Infrastructure.DBContext.Main;
using BackOffice.Domain.Entities.Main;
using BackOffice.Domain.Entities.Tenant;
using BackOffice.Persistence.Helpers;
using BackOffice.Persistence.Repositories;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Dynamic.Core;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace BackOffice.Persistence.Services.Main
{
    public class WebAppUserService : IWebAppUserService
    {
        private readonly IUnitOfWorkMain _unitOfWork;
        private readonly IMapper _mapper;
        private readonly IConfiguration _configuration;
        private readonly MainDBContext _mainDb;
        private readonly ILogger<WebAppUserService> _logger;
        private readonly ISmtpSettingsResolver _smtpResolver;
        public WebAppUserService(IUnitOfWorkMain unitOfWork, IMapper mapper, IConfiguration configuration, MainDBContext mainDb, ILogger<WebAppUserService> logger, ISmtpSettingsResolver smtpResolver)
        {
            _unitOfWork = unitOfWork;
            _mapper = mapper;
            _configuration = configuration;
            _mainDb = mainDb;
            _logger = logger;
            _smtpResolver = smtpResolver;
        }

        public async Task<WebAppUser?> GetByIdAsync(int userId)
        {
            return await _unitOfWork.WebAppUsers
                .GetAll()
                .FirstOrDefaultAsync(x => x.UserId == userId);
        }

        public async Task<WebAppUser?> AuthenticateAsync(string userName, string password)
        {
            var appUser = await _unitOfWork.WebAppUsers
                .GetAll()
                .FirstOrDefaultAsync(x => x.Email == userName || x.UserName == userName);

            if (appUser == null)
                return null;

            bool passwordValid = false;

            // Try BCrypt hash verification first
            if (!string.IsNullOrEmpty(appUser.PasswordHash))
            {
                passwordValid = PasswordHelper.VerifyPassword(password, appUser.PasswordHash);
            }
            else
            {
                // Fallback: legacy plaintext comparison for users not yet migrated
                passwordValid = appUser.Password == password;

                // Lazy migration: hash the password now so future logins use BCrypt
                if (passwordValid && !string.IsNullOrEmpty(password))
                {
                    appUser.PasswordHash = PasswordHelper.HashPassword(password);
                }
            }

            if (!passwordValid)
            {
                _logger.LogWarning("Failed login attempt for user: {UserName}", userName);
                return null;
            }

            // Update LoginType for email/password login
            appUser.LoginType = "Email";
            appUser.LastLoginDate = DateTime.UtcNow;
            _unitOfWork.WebAppUsers.Update(appUser);
            await _unitOfWork.SaveChangesAsync();

            _logger.LogInformation("Successful login for user: {UserId}", appUser.UserId);
            return appUser;
        }

        public ApiResponse<PaginationResponseDTO<AppUserDto>> GetAllAsync(PaginationGridDto paginationGridDto)
        {
            try
            {
                List<PaginationGridFilterDto> filters = new List<PaginationGridFilterDto>();

                if (!string.IsNullOrEmpty(paginationGridDto.Filters) && CommonFunctions.IsValidJson<List<PaginationGridFilterDto>>(paginationGridDto.Filters))
                {
                    filters = JsonConvert.DeserializeObject<List<PaginationGridFilterDto>>(paginationGridDto.Filters);
                }

                var query = _unitOfWork.WebAppUsers.GetAll().AsQueryable();

                if (paginationGridDto.CustomerId.HasValue && paginationGridDto.CustomerId.Value > 0)
                {
                    var customerId = paginationGridDto.CustomerId.Value;
                    var assignedUserIds = _mainDb.UserTenantAssignments
                        .Where(a => a.CustomerId == customerId)
                        .Select(a => a.UserId);
                    query = query.Where(u => assignedUserIds.Contains(u.UserId));
                }

                var baseQuery = query;

                query = QueryHelper.ApplyFilters(query, filters, paginationGridDto.CustomGridSearchText, paginationGridDto.CustomGridSearchColumns);

                var filteredQuery = query;
                var totalRecords = baseQuery.Count();
                var filteredRecords = filteredQuery.Count();  // Get filtered record count

                query = SortHelper.ApplySorting(query, paginationGridDto.SortColumn, paginationGridDto.SortDirection);

                var paginatedData = query
                    .Skip(paginationGridDto.StartRow)
                    .Take(paginationGridDto.EndRow - paginationGridDto.StartRow)
                    .ToList();

                var data = _mapper.Map<List<AppUserDto>>(paginatedData);

                var response = new PaginationResponseDTO<AppUserDto>
                {
                    TotalRecords = totalRecords,              // Total records (without filters)
                    RecordsFiltered = filteredRecords,        // Total records after applying filters
                    CurrentPage = (int)Math.Ceiling((double)paginationGridDto.EndRow / paginationGridDto.StartRow), // Calculate current page
                    PageSize = paginationGridDto.EndRow - paginationGridDto.StartRow,    // Page size for pagination
                    Data = data
                };

                return ApiResponseFactory.Success(response, "User list fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<PaginationResponseDTO<AppUserDto>>(
                    "Error fetching users.",
                    new List<string> { ex.Message });
            }
        }


        public async Task<ApiResponse<object>> SendInviteAsync(int userId, string inviteLink)
        {
            try
            {
                var user = await _unitOfWork.WebAppUsers.GetAll().FirstOrDefaultAsync(x => x.UserId == userId);

                if (user == null)
                {
                    return new ApiResponse<object>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.NotFoundError,
                        Message = "User not found.",
                        Errors = null
                    };
                }

                var emailSent = await SendInvitationEmail(user?.CustomerId, user?.Email, inviteLink);

                if (!emailSent)
                {
                    return new ApiResponse<object>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.InternalServerError,
                        Message = "Failed to send invitation email.",
                        Errors = new List<string> { "Email sending failed without an exception." }
                    };
                }

                user.InviteStatus = 1;
                await _unitOfWork.SaveChangesAsync();

                return new ApiResponse<object>
                {
                    IsSuccess = true,
                    StatusCode = ResponseCode.Success,
                    Message = "Invitation sent successfully.",
                    Errors = null
                };
            }
            catch (Exception ex)
            {
                return new ApiResponse<object>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.InternalServerError,
                    Message = "Exception during email sending.",
                    Errors = new List<string>
            {
                ex.Message,
                ex.InnerException?.Message ?? "No inner exception"
            }
                };
            }
        }



        public async Task<ApiResponse<object>> ApproveInviteAsync(int userId)
        {
            var user = await _unitOfWork.WebAppUsers.GetAll().FirstOrDefaultAsync(x => x.UserId == userId);

            if (user == null)
            {
                return new ApiResponse<object>
                {
                    IsSuccess = false,
                    StatusCode = ResponseCode.NotFoundError,
                    Message = "User not found.",
                    Errors = null
                };
            }

            user.InviteStatus = 2;
            await _unitOfWork.SaveChangesAsync();

            return new ApiResponse<object>
            {
                IsSuccess = true,
                StatusCode = ResponseCode.Success,
                Message = "Invitation approved successfully.",
                Errors = null
            };
        }

        private async Task<bool> SendInvitationEmail(int? customerId, string userEmail, string inviteLink)
        {
            try
            {
                var smtpSettings = await _smtpResolver.ResolveAsync(customerId, storeId: null);

                var emailMessage = new MimeMessage();
                emailMessage.From.Add(new MailboxAddress(smtpSettings.FromName ?? "RDT System", smtpSettings.FromEmail));
                emailMessage.To.Add(new MailboxAddress("", userEmail));
                emailMessage.Subject = "You're Invited to Join RDT System";

                var bodyBuilder = new BodyBuilder
                {
                    HtmlBody = $@"
            <!DOCTYPE html>
            <html lang='en'>
            <head>
                <meta charset='UTF-8'>
                <title>Invitation to RDT</title>
            </head>
            <body style='font-family: Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 0;'>
                <table align='center' cellpadding='0' cellspacing='0' width='100%' style='background-color: #f5f7fa; padding: 20px;'>
                    <tr>
                        <td>
                            <table align='center' cellpadding='0' cellspacing='0' width='600' style='background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);'>
                                <tr>
                                    <td style='background-color: #1e1e60; padding: 40px 30px; text-align: center;'>
                                        <h1 style='color: #ffffff; margin: 0; font-size: 24px;'>You're Invited to Join RDT System</h1>
                                    </td>
                                </tr>
                                <tr>
                                    <td style='padding: 30px; color: #333333; font-size: 16px;'>
                                        <p>Hello,</p>
                                        <p>You've been invited to join the <strong>RDT System</strong>.</p>
                                        <p>Click the button below to approve your invitation:</p>
                                        <div style='text-align: center; margin: 30px 0;'>
                                            <a href='{inviteLink}' style='background-color: #4a5cff; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;'>Approve Invitation</a>
                                        </div>
                                        <p>If the button doesn't work, copy and paste the following link into your browser:</p>
                                        <p style='word-break: break-all;'><a href='{inviteLink}' style='color: #1e1e60;'>{inviteLink}</a></p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style='background-color: #f1f1f1; text-align: center; padding: 20px; color: #999999; font-size: 13px;'>
                                        &copy; {DateTime.Now.Year} RDT System. All rights reserved.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>"
                };

                emailMessage.Body = bodyBuilder.ToMessageBody();

                await MailKitSender.SendAsync(smtpSettings, emailMessage);

                return true;
            }
            catch (Exception ex)
            {
                throw new Exception($"SMTP Send Error: {ex.Message}", ex);
            }
        }

        public async Task<bool> ModifyUserEmailAsync(ModifyUserEmailDto dto)
        {
            var user = await _unitOfWork.WebAppUsers
                .GetAll()
                .FirstOrDefaultAsync(x => x.UserId == dto.UserId);

            if (user == null)
                throw new Exception("User not found.");

            user.Email = dto.NewEmail;
            user.DateModified = DateTime.UtcNow;

            _unitOfWork.WebAppUsers.Update(user);
            await _unitOfWork.SaveChangesAsync();

            return true;
        }

        public async Task<WebAppUser?> FindOrCreateGoogleUserAsync(string email, string name)
        {
            // Check if user already exists by email
            var existingUser = await _unitOfWork.WebAppUsers
                .GetAll()
                .FirstOrDefaultAsync(x => x.Email == email);

            if (existingUser != null)
            {
                // Update LoginType and last login date
                existingUser.LoginType = "Google";
                existingUser.LastLoginDate = DateTime.UtcNow;
                existingUser.DateModified = DateTime.UtcNow;
                _unitOfWork.WebAppUsers.Update(existingUser);
                await _unitOfWork.SaveChangesAsync();
                return existingUser;
            }

            // Create a new user for Google login
            var newUser = new WebAppUser
            {
                UserName = name,
                Email = email,
                Password = "",
                PasswordHash = "",
                LoginType = "Google",
                LocalUserId = Guid.NewGuid(),
                DateCreated = DateTime.UtcNow,
                LastLoginDate = DateTime.UtcNow,
                InviteStatus = 2
            };

            await _unitOfWork.WebAppUsers.AddAsync(newUser);
            await _unitOfWork.SaveChangesAsync();

            return newUser;
        }

        public async Task<ApiResponse<List<UserLookupDto>>> GetDistinctUsersAsync()
        {
            try
            {
                var allUsers = await _unitOfWork.WebAppUsers
                    .GetAll()
                    .AsNoTracking()
                    .Where(u => u.Email != null && u.Email != "")
                    .OrderBy(u => u.UserId)
                    .Select(u => new UserLookupDto
                    {
                        UserId = u.UserId,
                        UserName = u.UserName,
                        Email = u.Email,
                        LocalUserId = u.LocalUserId
                    })
                    .ToListAsync();

                var distinctUsers = allUsers
                    .GroupBy(u => u.Email, StringComparer.OrdinalIgnoreCase)
                    .Select(g => g.First())
                    .OrderBy(u => u.UserName)
                    .ToList();

                return ApiResponseFactory.Success(distinctUsers, "Distinct users fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<UserLookupDto>>(
                    "Error fetching users.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<List<UserLookupDto>>> GetUsersByCustomerIdAsync(int customerId)
        {
            try
            {
                var assignedUserIds = _mainDb.UserTenantAssignments
                    .Where(a => a.CustomerId == customerId)
                    .Select(a => a.UserId);

                var users = await _unitOfWork.WebAppUsers
                    .GetAll()
                    .Where(u => assignedUserIds.Contains(u.UserId) || u.CustomerId == customerId)
                    .Select(u => new UserLookupDto
                    {
                        UserId = u.UserId,
                        UserName = u.UserName,
                        Email = u.Email,
                        LocalUserId = u.LocalUserId
                    })
                    .ToListAsync();

                var distinctUsers = users
                    .GroupBy(u => u.UserId)
                    .Select(g => g.First())
                    .OrderBy(u => u.UserName)
                    .ToList();

                return ApiResponseFactory.Success(distinctUsers, "Users fetched successfully.");
            }
            catch (Exception ex)
            {
                return ApiResponseFactory.InternalError<List<UserLookupDto>>(
                    "Error fetching users.",
                    new List<string> { ex.Message });
            }
        }

        public async Task<ApiResponse<object>> ForgotPasswordAsync(string email)
        {
            try
            {
                _logger.LogInformation("Password reset requested for email: {Email}", email);

                var user = await _unitOfWork.WebAppUsers
                    .GetAll()
                    .FirstOrDefaultAsync(x => x.Email == email);

                // Always return success to avoid revealing whether email exists
                if (user == null)
                {
                    _logger.LogWarning("Password reset requested for non-existent email: {Email}", email);
                    return ApiResponseFactory.Success<object>(null, "If an account with that email exists, a password reset link has been sent.");
                }

                // Generate secure token
                var rawToken = PasswordHelper.GenerateSecureToken();
                var tokenHash = PasswordHelper.ComputeSha256Hash(rawToken);
                var expiryMinutes = int.Parse(_configuration["SecuritySettings:TokenExpiryMinutes"] ?? "30");

                // Store hashed token in DB
                var resetToken = new PasswordResetToken
                {
                    UserId = user.UserId,
                    TokenHash = tokenHash,
                    CreatedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes),
                    IsUsed = false
                };

                await _mainDb.PasswordResetTokens.AddAsync(resetToken);
                await _mainDb.SaveChangesAsync();

                // Build reset link
                var frontendUrl = _configuration["AppSetting:FrontendAppUrl"]?.TrimEnd('/');
                var resetLink = $"{frontendUrl}/reset-password?token={rawToken}";

                // Send email — resolve SMTP per the user's tenant
                await SendPasswordResetEmail(user.CustomerId, user.Email!, resetLink, expiryMinutes);

                _logger.LogInformation("Password reset email sent for UserId: {UserId}", user.UserId);
                return ApiResponseFactory.Success<object>(null, "If an account with that email exists, a password reset link has been sent.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing forgot password for email: {Email}", email);
                return ApiResponseFactory.InternalError<object>("Failed to process password reset request.");
            }
        }

        public async Task<ApiResponse<object>> ResetPasswordAsync(string token, string newPassword)
        {
            try
            {
                var tokenHash = PasswordHelper.ComputeSha256Hash(token);

                var resetToken = await _mainDb.PasswordResetTokens
                    .FirstOrDefaultAsync(t => t.TokenHash == tokenHash && !t.IsUsed && t.ExpiresAt > DateTime.UtcNow);

                if (resetToken == null)
                {
                    _logger.LogWarning("Invalid or expired password reset token used");
                    return new ApiResponse<object>
                    {
                        IsSuccess = false,
                        StatusCode = ResponseCode.BadRequestError,
                        Message = "Invalid or expired reset link. Please request a new password reset.",
                        Errors = null
                    };
                }

                var user = await _unitOfWork.WebAppUsers
                    .GetAll()
                    .FirstOrDefaultAsync(x => x.UserId == resetToken.UserId);

                if (user == null)
                {
                    return ApiResponseFactory.NotFound<object>("User not found.");
                }

                // Update both Password (plaintext) and PasswordHash (BCrypt)
                user.Password = newPassword;
                user.PasswordHash = PasswordHelper.HashPassword(newPassword);
                user.DateModified = DateTime.UtcNow;
                _unitOfWork.WebAppUsers.Update(user);
                await _unitOfWork.SaveChangesAsync();

                // Mark token as used
                resetToken.IsUsed = true;
                await _mainDb.SaveChangesAsync();

                _logger.LogInformation("Password reset successful for UserId: {UserId}", user.UserId);
                return ApiResponseFactory.Success<object>(null, "Password has been reset successfully. You can now log in with your new password.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting password");
                return ApiResponseFactory.InternalError<object>("Failed to reset password.");
            }
        }

        private async System.Threading.Tasks.Task SendPasswordResetEmail(int? customerId, string userEmail, string resetLink, int expiryMinutes)
        {
            var smtpSettings = await _smtpResolver.ResolveAsync(customerId, storeId: null);

            var emailMessage = new MimeMessage();
            emailMessage.From.Add(new MailboxAddress(smtpSettings.FromName ?? "RDT System", smtpSettings.FromEmail));
            emailMessage.To.Add(new MailboxAddress("", userEmail));
            emailMessage.Subject = "Reset Your Password - RDT System";

            var bodyBuilder = new BodyBuilder
            {
                HtmlBody = $@"
            <!DOCTYPE html>
            <html lang='en'>
            <head>
                <meta charset='UTF-8'>
                <title>Reset Your Password</title>
            </head>
            <body style='font-family: Arial, sans-serif; background-color: #f5f7fa; margin: 0; padding: 0;'>
                <table align='center' cellpadding='0' cellspacing='0' width='100%' style='background-color: #f5f7fa; padding: 20px;'>
                    <tr>
                        <td>
                            <table align='center' cellpadding='0' cellspacing='0' width='600' style='background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);'>
                                <tr>
                                    <td style='background-color: #1e1e60; padding: 40px 30px; text-align: center;'>
                                        <h1 style='color: #ffffff; margin: 0; font-size: 24px;'>Reset Your Password</h1>
                                    </td>
                                </tr>
                                <tr>
                                    <td style='padding: 30px; color: #333333; font-size: 16px;'>
                                        <p>Hello,</p>
                                        <p>We received a request to reset your password for your <strong>RDT System</strong> account.</p>
                                        <p>Click the button below to set a new password:</p>
                                        <div style='text-align: center; margin: 30px 0;'>
                                            <a href='{resetLink}' style='background-color: #4a5cff; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;'>Reset Password</a>
                                        </div>
                                        <p>If the button doesn't work, copy and paste the following link into your browser:</p>
                                        <p style='word-break: break-all;'><a href='{resetLink}' style='color: #1e1e60;'>{resetLink}</a></p>
                                        <hr style='border: none; border-top: 1px solid #eee; margin: 25px 0;' />
                                        <p style='color: #999999; font-size: 14px;'>This link will expire in <strong>{expiryMinutes} minutes</strong>.</p>
                                        <p style='color: #999999; font-size: 14px;'>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style='background-color: #f1f1f1; text-align: center; padding: 20px; color: #999999; font-size: 13px;'>
                                        &copy; {DateTime.Now.Year} RDT System. All rights reserved.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>"
            };

            emailMessage.Body = bodyBuilder.ToMessageBody();

            await MailKitSender.SendAsync(smtpSettings, emailMessage);
        }
    }
}
