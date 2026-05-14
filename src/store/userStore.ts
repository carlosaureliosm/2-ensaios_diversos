import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { UserMetadata } from '@/types/user';

type UserState = {
  userName: string;
  userEmail: string;
  userCargo: string;
  userCrea: string;
  userAssinatura: string;
  initials: string;
  loaded: boolean;
  fetchUser: () => Promise<void>;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const useUserStore = create<UserState>((set) => ({
  userName: '',
  userEmail: '',
  userCargo: '',
  userCrea: '',
  userAssinatura: '',
  initials: '',
  loaded: false,
  fetchUser: async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const m = (user.user_metadata ?? {}) as UserMetadata;
    const name = m.full_name ?? user.email ?? '';
    set({
      userName: name,
      userEmail: user.email ?? '',
      userCargo: m.cargo ?? '',
      userCrea: m.crea ?? '',
      userAssinatura: m.assinatura_url ?? '',
      initials: getInitials(name),
      loaded: true,
    });
  },
}));
