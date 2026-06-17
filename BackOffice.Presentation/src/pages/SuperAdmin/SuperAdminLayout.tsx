import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../../context/AuthContext';

/**
 * Layout wrapper for all /super-admin/* routes.
 * Redirects non-super-admin users to the dashboard.
 */
const SuperAdminLayout: React.FC = () => {
  const { isSuperAdmin, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col">
      <Outlet />
    </div>
  );
};

export default SuperAdminLayout;
