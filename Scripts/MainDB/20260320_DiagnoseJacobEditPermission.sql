/*
================================================================================
Diagnostic Script: Why can jacob@rdtsystems.com NOT edit items?
================================================================================
Permission key: inventory.item_list.edit

The 3-layer permission model:
  Effective = TenantCeiling  INTERSECT  (RolePerms  MERGED WITH  UserOverrides)

If ANY layer is missing the permission, the user cannot edit.
Run each section in order against the appropriate database.
================================================================================
*/

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 1: RUN AGAINST MASTER DATABASE (RDTCloud / MainDB)    ║
-- ╚══════════════════════════════════════════════════════════════════╝

PRINT '================================================================';
PRINT '  LAYER 0 — Find the user & their tenants';
PRINT '================================================================';

-- 1A. Find the user
SELECT
    u.UserId,
    u.Email,
    u.FirstName,
    u.LastName,
    u.CustomerId        AS TenantId,
    u.IsActive,
    u.EmailConfirmed
FROM dbo.AppUsers u
WHERE u.Email = 'jacob@rdtsystems.com';

-- 1B. All tenants this user is linked to (via CustomerId or any tenant-user mapping)
SELECT
    u.UserId,
    u.Email,
    u.CustomerId  AS PrimaryTenantId,
    c.CompanyName AS TenantName
FROM dbo.AppUsers u
LEFT JOIN dbo.Customers c ON c.CustomerId = u.CustomerId
WHERE u.Email = 'jacob@rdtsystems.com';

PRINT '';
PRINT '================================================================';
PRINT '  LAYER 1 — Tenant Ceiling: Is the permission allowed?';
PRINT '================================================================';

-- 1C. Check if the "inventory" MODULE is enabled for the user's tenant(s)
SELECT
    tam.TenantId,
    m.Code        AS ModuleCode,
    m.Name        AS ModuleName,
    tam.IsEnabled,
    c.CompanyName AS TenantName
FROM dbo.TenantAllowedModules tam
INNER JOIN dbo.Modules m ON m.ModuleId = tam.ModuleId
LEFT JOIN dbo.Customers c ON c.CustomerId = tam.TenantId
WHERE m.Code = 'inventory'
  AND tam.TenantId IN (
      SELECT u.CustomerId FROM dbo.AppUsers u WHERE u.Email = 'jacob@rdtsystems.com'
  );

-- 1D. Check if "inventory.item_list.edit" is in the tenant ceiling
SELECT
    tap.TenantId,
    p.PermissionKey,
    p.Name          AS PermissionName,
    tap.IsAllowed,
    c.CompanyName   AS TenantName
FROM dbo.TenantAllowedPermissions tap
INNER JOIN dbo.Permissions p ON p.Id = tap.PermissionId
LEFT JOIN dbo.Customers c ON c.CustomerId = tap.TenantId
WHERE p.PermissionKey = 'inventory.item_list.edit'
  AND tap.TenantId IN (
      SELECT u.CustomerId FROM dbo.AppUsers u WHERE u.Email = 'jacob@rdtsystems.com'
  );

-- 1E. If the above returns NOTHING, check if the permission even exists in the master table
SELECT
    p.Id            AS PermissionId,
    p.PermissionKey,
    p.Name,
    p.IsActive,
    s.Code          AS ScreenCode,
    m.Code          AS ModuleCode
FROM dbo.Permissions p
INNER JOIN dbo.Screens s ON s.Id = p.ScreenId
INNER JOIN dbo.Modules m ON m.ModuleId = p.ModuleId
WHERE p.PermissionKey = 'inventory.item_list.edit';

-- 1F. Show ALL inventory.item_list permissions in the ceiling for this tenant
--     (to see if .view works but .edit doesn't)
SELECT
    tap.TenantId,
    p.PermissionKey,
    tap.IsAllowed,
    c.CompanyName AS TenantName
FROM dbo.TenantAllowedPermissions tap
INNER JOIN dbo.Permissions p ON p.Id = tap.PermissionId
LEFT JOIN dbo.Customers c ON c.CustomerId = tap.TenantId
WHERE p.PermissionKey LIKE 'inventory.item_list.%'
  AND tap.TenantId IN (
      SELECT u.CustomerId FROM dbo.AppUsers u WHERE u.Email = 'jacob@rdtsystems.com'
  )
ORDER BY p.PermissionKey;


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 2: RUN AGAINST TENANT DATABASE                        ║
-- ║  (Switch to the tenant DB for jacob's CustomerId/TenantId)     ║
-- ╚══════════════════════════════════════════════════════════════════╝

PRINT '';
PRINT '================================================================';
PRINT '  LAYER 2 — Role Permissions: Does the role grant edit?';
PRINT '================================================================';

-- 2A. Find jacob's UserId (use the value from Section 1A)
--     Replace @JacobUserId with the actual UserId from query 1A
DECLARE @JacobUserId INT;
-- SET @JacobUserId = ???;  -- <-- PASTE UserId from query 1A here

-- For convenience, try to resolve from MainDB link or use a known value:
-- If running cross-db, uncomment:
-- SELECT @JacobUserId = UserId FROM [RDTCloud].dbo.AppUsers WHERE Email = 'jacob@rdtsystems.com';

-- 2B. What roles does jacob have?
SELECT
    ur.Id,
    ur.UserId,
    ur.RoleId,
    r.Name          AS RoleName,
    r.Code          AS RoleCode,
    r.IsSystemRole,
    r.IsActive      AS RoleIsActive,
    ur.AssignedAt
FROM dbo.RbacTenantUserRoles ur
INNER JOIN dbo.RbacTenantRoles r ON r.Id = ur.RoleId
WHERE ur.UserId = @JacobUserId;

-- 2C. Do any of jacob's roles grant "inventory.item_list.edit"?
SELECT
    r.Name          AS RoleName,
    rp.PermissionKey,
    rp.IsGranted
FROM dbo.RbacTenantUserRoles ur
INNER JOIN dbo.RbacTenantRoles r ON r.Id = ur.RoleId
INNER JOIN dbo.RbacTenantRolePermissions rp ON rp.RoleId = r.Id
WHERE ur.UserId = @JacobUserId
  AND rp.PermissionKey = 'inventory.item_list.edit';

-- 2D. Show ALL inventory.item_list permissions across jacob's roles
--     (to compare .view vs .edit vs .create etc.)
SELECT
    r.Name          AS RoleName,
    rp.PermissionKey,
    rp.IsGranted
FROM dbo.RbacTenantUserRoles ur
INNER JOIN dbo.RbacTenantRoles r ON r.Id = ur.RoleId
INNER JOIN dbo.RbacTenantRolePermissions rp ON rp.RoleId = r.Id
WHERE ur.UserId = @JacobUserId
  AND rp.PermissionKey LIKE 'inventory.item_list.%'
ORDER BY rp.PermissionKey;

PRINT '';
PRINT '================================================================';
PRINT '  LAYER 3 — User Overrides: Is edit explicitly revoked?';
PRINT '================================================================';

-- 2E. Check if there's an override that REVOKES the edit permission
SELECT
    o.Id,
    o.UserId,
    o.PermissionKey,
    o.IsGranted,
    o.ExpiresAt,
    o.Reason,
    o.GrantedByUserId,
    o.CreatedAt,
    CASE
        WHEN o.IsGranted = 0 THEN '** REVOKED **'
        WHEN o.ExpiresAt IS NOT NULL AND o.ExpiresAt < SYSUTCDATETIME() THEN '** EXPIRED **'
        ELSE 'GRANTED'
    END AS OverrideStatus
FROM dbo.RbacTenantUserPermOverrides o
WHERE o.UserId = @JacobUserId
  AND o.PermissionKey LIKE 'inventory.item_list.%'
ORDER BY o.PermissionKey;

-- 2F. Show ALL overrides for jacob (to catch any broad revocations)
SELECT
    o.Id,
    o.PermissionKey,
    o.IsGranted,
    o.ExpiresAt,
    o.Reason,
    CASE
        WHEN o.IsGranted = 0 THEN '** REVOKED **'
        WHEN o.ExpiresAt IS NOT NULL AND o.ExpiresAt < SYSUTCDATETIME() THEN '** EXPIRED **'
        ELSE 'GRANTED'
    END AS OverrideStatus
FROM dbo.RbacTenantUserPermOverrides o
WHERE o.UserId = @JacobUserId
ORDER BY o.PermissionKey;


-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  SECTION 3: SIMULATE THE EFFECTIVE PERMISSION CALCULATION       ║
-- ║  (Run against Tenant DB — combines all 3 layers)                ║
-- ╚══════════════════════════════════════════════════════════════════╝

PRINT '';
PRINT '================================================================';
PRINT '  FINAL — Simulated effective permission check';
PRINT '================================================================';

-- 3A. All role-granted inventory.item_list perms for jacob
--     MINUS any overrides that revoke them
--     (The result must also be in the tenant ceiling to be effective)
;WITH RolePerms AS (
    SELECT DISTINCT rp.PermissionKey
    FROM dbo.RbacTenantUserRoles ur
    INNER JOIN dbo.RbacTenantRolePermissions rp ON rp.RoleId = ur.RoleId
    WHERE ur.UserId = @JacobUserId
      AND rp.IsGranted = 1
      AND rp.PermissionKey LIKE 'inventory.item_list.%'
),
OverrideGrants AS (
    SELECT PermissionKey
    FROM dbo.RbacTenantUserPermOverrides
    WHERE UserId = @JacobUserId
      AND IsGranted = 1
      AND (ExpiresAt IS NULL OR ExpiresAt > SYSUTCDATETIME())
      AND PermissionKey LIKE 'inventory.item_list.%'
),
OverrideRevokes AS (
    SELECT PermissionKey
    FROM dbo.RbacTenantUserPermOverrides
    WHERE UserId = @JacobUserId
      AND IsGranted = 0
      AND (ExpiresAt IS NULL OR ExpiresAt > SYSUTCDATETIME())
      AND PermissionKey LIKE 'inventory.item_list.%'
),
MergedPerms AS (
    -- Role perms + override grants - override revokes
    SELECT PermissionKey FROM RolePerms
    UNION
    SELECT PermissionKey FROM OverrideGrants
    EXCEPT
    SELECT PermissionKey FROM OverrideRevokes
)
SELECT
    mp.PermissionKey,
    CASE WHEN mp.PermissionKey IS NOT NULL THEN 'YES' ELSE 'NO' END AS InMergedPerms,
    '(still needs to pass tenant ceiling check in MainDB)' AS Note
FROM MergedPerms mp
ORDER BY mp.PermissionKey;

/*
================================================================================
  DIAGNOSIS CHECKLIST — check results in this order:
================================================================================

  1. Query 1A: Is jacob active? (IsActive = 1, EmailConfirmed = 1)
     -> If inactive, that's the issue.

  2. Query 1C: Is the "inventory" module ENABLED for the tenant?
     -> If missing or IsEnabled = 0, the entire module is blocked.

  3. Query 1D: Is "inventory.item_list.edit" in the tenant ceiling?
     -> If missing or IsAllowed = 0, no user in this tenant can edit items.
     -> FIX: Add it to TenantAllowedPermissions or run SeedTenantCeilingPermissions.sql

  4. Query 1F: Compare ceiling — does .view exist but .edit is missing?
     -> If so, the ceiling was partially seeded.

  5. Query 2B: Does jacob have any roles assigned?
     -> If NO roles, jacob has ZERO role-based permissions.
     -> FIX: Assign a role via Tenant Admin > User Roles.

  6. Query 2C: Does jacob's role include "inventory.item_list.edit"?
     -> If NO, the role doesn't grant edit.
     -> FIX: Add the permission to the role, or assign a role that has it.

  7. Query 2D: Compare role perms — .view granted but .edit missing?
     -> Confirms a partial role configuration.

  8. Query 2E: Is there an override that REVOKES edit?
     -> If IsGranted = 0, an admin explicitly revoked edit for jacob.
     -> Check ExpiresAt — might be expired but still present.

  9. Query 3A: Final merged permissions — is .edit in the result?
     -> If YES here but the app still denies, the issue is in the ceiling (Layer 1).
     -> If NO here, the issue is in roles or overrides (Layers 2/3).

  MOST COMMON CAUSES:
  - Tenant ceiling missing the .edit permission (Layer 1)
  - Role only has .view but not .edit (Layer 2)
  - User has no roles assigned at all (Layer 2)
  - Explicit override revoking .edit (Layer 3)
================================================================================
*/
