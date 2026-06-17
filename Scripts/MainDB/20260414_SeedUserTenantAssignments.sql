INSERT INTO UserTenantAssignments (UserId, CustomerId, AssignedBy, AssignedAt)
SELECT DISTINCT u.UserId, u.CustomerId, u.UserId, GETDATE()
FROM AppUsers u
INNER JOIN Customers c ON c.CustomerId = u.CustomerId
WHERE u.CustomerId IS NOT NULL
  AND u.CustomerId > 0
  AND NOT EXISTS (
      SELECT 1 FROM UserTenantAssignments uta
      WHERE uta.UserId = u.UserId AND uta.CustomerId = u.CustomerId
  );
