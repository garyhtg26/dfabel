"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { clientAuth, clientReady } from "@/lib/firebase/client";
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  configured: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  request: (url: string, init?: RequestInit) => Promise<Response>;
}>({
  user: null,
  loading: true,
  configured: false,
  login: async () => {},
  logout: async () => {},
  request: fetch,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!clientReady) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(clientAuth(), (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);
  async function request(url: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const current = clientReady ? clientAuth().currentUser : null;
    if (current)
      headers.set("Authorization", `Bearer ${await current.getIdToken()}`);
    return fetch(url, { ...init, headers });
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        configured: clientReady,
        login: async () => {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          await signInWithPopup(clientAuth(), provider);
        },
        logout: async () => {
          await signOut(clientAuth());
        },
        request,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
