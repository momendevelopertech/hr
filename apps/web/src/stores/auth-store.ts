import { create } from 'zustand';

export type UserProfile = {
    id: string;
    email: string;
    fullName: string;
    fullNameAr?: string;
    role: 'SUPER_ADMIN' | 'HR_ADMIN' | 'MANAGER' | 'EMPLOYEE';
    mustChangePass?: boolean;
    department?: { id: string; name: string; nameAr?: string } | null;
    profileImage?: string | null;
    employeeNumber?: string;
};

type AuthState = {
    user: UserProfile | null;
    loading: boolean;
    setUser: (user: UserProfile | null) => void;
    setLoading: (loading: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    setUser: (user) => set({ user }),
    setLoading: (loading) => set({ loading }),
}));
