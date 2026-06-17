import React, { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { profileService, type MyProfile } from '../services/profileService';

/**
 * Holds the logged-in user's own profile (email, phone, username, and the
 * pre-signed avatar URL) so the profile page, the header dropdown and the
 * sidebar user-card all render from one source. The profile page calls
 * `refreshProfile()` after a successful save/upload so the avatar updates
 * everywhere at once.
 */
interface ProfileContextType {
  profile: MyProfile | null;
  loading: boolean;
  /** Re-fetch from the server (also refreshes the short-lived avatar URL). */
  refreshProfile: () => Promise<void>;
  /** Patch the in-memory profile without a round-trip (e.g. right after a save). */
  patchProfile: (changes: Partial<MyProfile>) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = (): ProfileContextType => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
};

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!isAuthenticated) {
      setProfile(null);
      return;
    }
    setLoading(true);
    try {
      const result = await profileService.getMyProfile();
      if (result.success && result.data) {
        setProfile(result.data);
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const patchProfile = useCallback((changes: Partial<MyProfile>) => {
    setProfile((prev) => (prev ? { ...prev, ...changes } : prev));
  }, []);

  // Load once authenticated; clear on logout.
  useEffect(() => {
    if (isAuthenticated) {
      refreshProfile();
    } else {
      setProfile(null);
    }
  }, [isAuthenticated, refreshProfile]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refreshProfile, patchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};
