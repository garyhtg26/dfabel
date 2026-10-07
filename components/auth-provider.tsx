"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  signInWithPopup,
  signOut,
  setPersistence,
  browserSessionPersistence,
  type User,
} from "firebase/auth";
import { clientAuth, clientReady } from "@/lib/firebase/client";
import { accountName, type AuthScope } from "@/lib/auth-ui";
type Session = {
  user: User | null;
  loading: boolean;
  verified: boolean;
  provider: string;
  name: string;
  revision: number;
};
type AuthContextValue = Session & {
  scope: AuthScope;
  configured: boolean;
  login: () => Promise<void>;
  loginEmail: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  verifyEmail: () => Promise<void>;
  refresh: () => Promise<boolean>;
  logout: () => Promise<void>;
  request: (url: string, init?: RequestInit) => Promise<Response>;
};
const initial: Session = {
  user: null,
  loading: true,
  verified: false,
  provider: "",
  name: "",
  revision: 0,
};
const AuthContext = createContext<AuthContextValue>({
  ...initial,
  scope: "customer",
  configured: false,
  login: async () => {},
  loginEmail: async () => {},
  register: async () => {},
  resetPassword: async () => {},
  verifyEmail: async () => {},
  refresh: async () => false,
  logout: async () => {},
  request: fetch,
});
export function AuthProvider({
  children,
  scope = "customer",
}: {
  children: ReactNode;
  scope?: AuthScope;
}) {
  const [session, setSession] = useState<Session>(initial);
  const sync = useCallback(async () => {
    const current = clientReady ? clientAuth(scope).currentUser : null;
    const result = current ? await current.getIdTokenResult() : null;
    if (clientReady && clientAuth(scope).currentUser !== current) return;
    setSession((prev) => ({
      user: current,
      loading: false,
      verified: !!current?.emailVerified,
      provider: result?.signInProvider || "",
      name: accountName(current),
      revision: prev.revision + 1,
    }));
  }, [scope]);
  const refresh = useCallback(async () => {
    const current = clientReady ? clientAuth(scope).currentUser : null;
    if (!current) return false;
    await reload(current);
    await current.getIdToken(true);
    await sync();
    return current.emailVerified;
  }, [scope, sync]);
  useEffect(() => {
    if (!clientReady) {
      setSession({ ...initial, loading: false });
      return;
    }
    let disposed = false;
    let unsubscribe = () => {};
    void setPersistence(clientAuth(scope), browserSessionPersistence)
      .then(() => {
        if (disposed) return;
        unsubscribe = onIdTokenChanged(clientAuth(scope), () => {
          void sync().catch(() => setSession({ ...initial, loading: false }));
        });
      })
      .catch(() => {
        if (!disposed) setSession({ ...initial, loading: false });
      });
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [scope, sync]);
  useEffect(() => {
    if (!session.user || session.verified) return;
    let checking = false;
    const check = () => {
      if (document.visibilityState !== "visible" || checking) return;
      checking = true;
      void refresh()
        .catch(() => {})
        .finally(() => {
          checking = false;
        });
    };
    const interval = setInterval(check, 6000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [session.user?.uid, session.verified, refresh]);
  const actionSettings = () => ({
    url: `${window.location.origin}/auth/verified?scope=${scope}`,
    handleCodeInApp: false,
  });
  const request = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      headers.set("X-DFable-Surface", scope);
      const current = clientReady ? clientAuth(scope).currentUser : null;
      if (current?.emailVerified)
        headers.set("Authorization", `Bearer ${await current.getIdToken()}`);
      return fetch(url, { ...init, headers });
    },
    [scope],
  );
  return (
    <AuthContext.Provider
      value={{
        ...session,
        scope,
        configured: clientReady,
        request,
        refresh,
        login: async () => {
          if (scope !== "customer") throw Error("Dashboard requires password");
          const provider = new GoogleAuthProvider();
          await setPersistence(clientAuth(scope), browserSessionPersistence);
          provider.setCustomParameters({ prompt: "select_account" });
          await signInWithPopup(clientAuth(scope), provider);
          await sync();
        },
        loginEmail: async (email, password) => {
          await setPersistence(clientAuth(scope), browserSessionPersistence);
          await signInWithEmailAndPassword(clientAuth(scope), email, password);
          await sync();
        },
        register: async (name, email, password) => {
          if (scope !== "customer") throw Error("Customer signup only");
          await setPersistence(clientAuth(scope), browserSessionPersistence);
          const result = await createUserWithEmailAndPassword(
            clientAuth(scope),
            email,
            password,
          );
          await updateProfile(result.user, { displayName: name });
          await sync();
          await sendEmailVerification(result.user, actionSettings());
        },
        resetPassword: async (email) => {
          await sendPasswordResetEmail(
            clientAuth(scope),
            email,
            actionSettings(),
          );
        },
        verifyEmail: async () => {
          const user = clientAuth(scope).currentUser;
          if (user) await sendEmailVerification(user, actionSettings());
        },
        logout: async () => {
          await signOut(clientAuth(scope));
          await sync();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
