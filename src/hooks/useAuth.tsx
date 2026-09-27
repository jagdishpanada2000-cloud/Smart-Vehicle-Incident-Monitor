import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
const Auth = createContext<{ session: Session | null; loading: boolean }>({
  session: null,
  loading: true,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, value) => {
      setSession(value);
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return <Auth.Provider value={{ session, loading }}>{children}</Auth.Provider>;
}
export const useAuth = () => useContext(Auth);
