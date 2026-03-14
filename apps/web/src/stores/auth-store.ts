import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type UserProfile = {
    id: string;
    email: string;
    username?: string;
    fullName: string;
    fullNameAr?: string;
    role: 'SUPER_ADMIN' | 'HR_ADMIN' | 'MANAGER' | 'BRANCH_SECRETARY' | 'SUPPORT' | 'EMPLOYEE';
    governorate?: 'CAIRO' | 'ALEXANDRIA' | null;
    branchId?: number | null;
    mustChangePass?: boolean;
    department?: { id: string; name: string; nameAr?: string } | null;
    profileImage?: string | null;
    employeeNumber?: string;
    jobTitle?: string | null;
    jobTitleAr?: string | null;
};

type AuthState = {
    user: UserProfile | null;
    loading: boolean;
    bootstrapped: boolean;
    setUser: (user: UserProfile | null) => void;
    setLoading: (loading: boolean) => void;
    setBootstrapped: (bootstrapped: boolean) => void;
};

const initialState = {
    user: null,
    loading: true,
    bootstrapped: false,
};

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            ...initialState,
            setUser: (user) => set({ user }),
            setLoading: (loading) => set({ loading }),
            setBootstrapped: (bootstrapped) => set({ bootstrapped }),
        }),
        {
            name: 'sphinx-auth',
            storage: typeof window !== 'undefined' ? createJSONStorage(() => localStorage) : undefined,
            partialize: (state) => ({ user: state.user }),
            onRehydrateStorage: () => (state) => {
                if (!state) return;
                state.setBootstrapped(!!state.user);
                state.setLoading(false);
            },
        },
    ),
);
