import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, Profile } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[AUTH] Inicializando contexto de autenticação...');

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[AUTH] Erro ao obter sessão:', error);
        setLoading(false);
        return;
      }

      console.log('[AUTH] Sessão carregada:', session ? 'Usuário autenticado' : 'Sem usuário');
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('[AUTH] Exceção ao obter sessão:', err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (() => {
        console.log('[AUTH] Mudança de estado:', _event, session ? 'com usuário' : 'sem usuário');
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    console.log('[AUTH] Carregando perfil para usuário:', userId);
    try {
      const cachedProfile = localStorage.getItem(`profile-${userId}`);
      if (cachedProfile) {
        console.log('[AUTH] Perfil em cache encontrado');
        try {
          setProfile(JSON.parse(cachedProfile));
          setLoading(false);
        } catch (e) {
          console.error('[AUTH] Erro ao parsear cache:', e);
          localStorage.removeItem(`profile-${userId}`);
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AUTH] Erro ao buscar perfil:', error);
        throw error;
      }

      if (data) {
        console.log('[AUTH] Perfil carregado do servidor:', data.role);
        setProfile(data);
        try {
          localStorage.setItem(`profile-${userId}`, JSON.stringify(data));
        } catch (e) {
          console.warn('[AUTH] Erro ao salvar no localStorage:', e);
        }
      } else {
        console.warn('[AUTH] Nenhum perfil encontrado para o usuário');
      }
    } catch (error) {
      console.error('[AUTH] Erro ao carregar perfil:', error);
      const cachedProfile = localStorage.getItem(`profile-${userId}`);
      if (cachedProfile && !profile) {
        try {
          setProfile(JSON.parse(cachedProfile));
          console.log('[AUTH] Usando perfil do cache após erro');
        } catch (e) {
          console.error('[AUTH] Erro ao usar cache como fallback:', e);
        }
      }
    } finally {
      setLoading(false);
      console.log('[AUTH] Carregamento de perfil finalizado');
    }
  };

  const signIn = async (email: string, password: string) => {
    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        return;
      } catch (error: any) {
        lastError = error;
        console.error(`SignIn attempt ${attempt} failed:`, error);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    throw lastError;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
