import { useState, useEffect } from 'react';
import { getAuthToken } from '../utils/authToken';

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

const roleHierarchy: Record<Role, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4
};

export function usePermissions(businessId: string) {
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, we might get this from context or a dedicated endpoint.
    // For now, assume we fetch the current user's role in this business.
    const fetchRole = async () => {
      try {
        const token = getAuthToken();
        if (!token) return;
        
        // Example mock fetch logic, assuming the backend could return current user's role
        // For demonstration, we default to 'OWNER' if not found, or maybe read from local storage
        const storedRole = localStorage.getItem(`role_${businessId}`) as Role;
        if (storedRole) {
          setRole(storedRole);
        } else {
          setRole('OWNER'); // Fallback for testing/owner
        }
      } catch (err) {
        console.error('Failed to fetch role:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRole();
  }, [businessId]);

  const hasPermission = (minRole: Role) => {
    if (!role) return false;
    return roleHierarchy[role] >= roleHierarchy[minRole];
  };

  return { role, hasPermission, loading };
}
