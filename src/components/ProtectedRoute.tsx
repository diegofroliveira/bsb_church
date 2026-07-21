import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';

interface ProtectedRouteProps {
  requiredPermission?: string;
  requiredModule?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  requiredPermission,
  requiredModule,
}) => {
  const { user, isLoading } = useAuth();
  const organization = useOrganization();
  const location = useLocation();

  if (isLoading || (user && organization.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission && !organization.can(requiredPermission)) {
    return <Navigate to="/" replace state={{ denied: true }} />;
  }

  if (requiredModule && !organization.hasModule(requiredModule)) {
    return <Navigate to="/" replace state={{ denied: true }} />;
  }

  return <Outlet />;
};
