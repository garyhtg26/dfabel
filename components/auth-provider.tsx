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
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { clientAuth, clientReady } from "@/lib/firebase/client";
import { accountName, type AuthScope } from "@/lib/auth-ui";
import { isPhoneLogin, phoneLoginEmail } from "@/lib/phone-auth";
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
  loginPhone: (identifier: string, password: string) => Promise<void>;
  registerPhone: (
    name: string,
    phone: string,
    password: string,
  ) => Promise<void>;
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
  loginPhone: async () => {},
  registerPhone: async () => {},
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
      verified:
        !!current?.emailVerified ||
        (scope === "customer" &&
          isPhoneLogin(
            current?.email,
            result?.signInProvider,
            result?.claims.dfable_phone_account,
          )),
      provider: result?.signInProvider || "",
      name: accountName(current),
      revision: prev.revision + 1,
    }));
  }, [scope]);
  const refresh = useCallback(async () => {
    const current = clientReady ? clientAuth(scope).currentUser : null;
    if (!current) return false;
    await reload(current);
    const token = await current.getIdTokenResult(true);
    await sync();
    return (
      current.emailVerified ||
      (scope === "customer" &&
        isPhoneLogin(
          current.email,
          token.signInProvider,
          token.claims.dfable_phone_account,
        ))
    );
  }, [scope, sync]);
  useEffect(() => {
    if (!clientReady) {
      setSession({ ...initial, loading: false });
      return;
    }
    let disposed = false;
    const unsubscribe = onIdTokenChanged(clientAuth(scope), () => {
      void sync().catch(() => {
        if (!disposed) setSession({ ...initial, loading: false });
      });
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
      if (current) {
        const token = await current.getIdTokenResult();
        const eligible =
          current.emailVerified ||
          (scope === "customer" &&
            isPhoneLogin(
              current.email,
              token.signInProvider,
              token.claims.dfable_phone_account,
            ));
        if (eligible) headers.set("Authorization", `Bearer ${token.token}`);
      }
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
          provider.setCustomParameters({ prompt: "select_account" });
          await signInWithPopup(clientAuth(scope), provider);
          await sync();
        },
        loginEmail: async (email, password) => {
          await signInWithEmailAndPassword(clientAuth(scope), email, password);
          await sync();
        },
        loginPhone: async (identifier, password) => {
          if (scope !== "customer") throw Error("Customer login only");
          const email = identifier.includes("@")
            ? identifier.trim()
            : phoneLoginEmail(identifier);
          if (!email)
            throw Object.assign(new Error("Nomor WhatsApp tidak valid."), {
              code: "auth/invalid-phone-number",
            });
          await signInWithEmailAndPassword(clientAuth(scope), email, password);
          await sync();
        },
        registerPhone: async (name, phone, password) => {
          if (scope !== "customer") throw Error("Customer signup only");
          const email = phoneLoginEmail(phone);
          if (!email)
            throw Object.assign(new Error("Nomor WhatsApp tidak valid."), {
              code: "auth/invalid-phone-number",
            });
          const response = await fetch("/api/auth/phone/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone, password }),
          });
          if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw Object.assign(
              new Error(result.error || "Pendaftaran belum berhasil."),
              {
                code:
                  response.status === 409
                    ? "auth/phone-already-exists"
                    : response.status === 429
                      ? "auth/too-many-requests"
                      : "auth/phone-register-failed",
              },
            );
          }
          await signInWithEmailAndPassword(clientAuth(scope), email, password);
          await sync();
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
