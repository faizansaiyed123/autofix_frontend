"use client";

/**
 * Session state for the whole application.
 *
 * One provider, mounted once at the root, owns three things: who is signed in,
 * which permissions that person holds, and the act of signing out. Everything
 * else — protected routes, the navigation, every conditional button — reads from
 * here rather than decoding the token itself, so there is one answer to "may this
 * user do this" in the application.
 *
 * **Staffness is decided by roles, not by `User.is_staff`.** The backend's
 * `require_staff` gate is `any role != CUSTOMER`, and it is deliberately not the
 * `is_staff` column: that column is writable through the users API, so a flag a
 * caller can set is not something to hang "who may read the shop's books" on. A
 * technician created without the box ticked would be locked out of their own
 * shop. The UI mirrors the server's rule rather than a friendlier-looking one.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { authApi } from "@/lib/api/auth";
import {
  clearTokens,
  hasStoredSession,
  onForcedLogout,
  setTokens,
} from "@/lib/api/client";
import type { CurrentUser } from "@/lib/api/types";

export type SessionStatus = "loading" | "authenticated" | "anonymous";

export interface SessionValue {
  status: SessionStatus;
  user: CurrentUser | null;
  permissions: string[];
  roles: string[];
  isCustomer: boolean;
  isStaff: boolean;
  can: (permission: string) => boolean;
  canAny: (...permissions: string[]) => boolean;
  hasRole: (role: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

const ALL_ROLES = ["OWNER", "SERVICE_ADVISOR", "TECHNICIAN", "PARTS_STAFF", "CUSTOMER"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>(() =>
    // "Is anybody signed in?" is answerable synchronously: if there is no stored
    // token there is nothing to restore. A stored token is only a claim, so that
    // case still starts as loading and has to be verified against the server.
    typeof window !== "undefined" && !hasStoredSession() ? "anonymous" : "loading",
  );
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const loadProfile = useCallback(async () => {
    const [me, bundle] = await Promise.all([authApi.me(), authApi.permissions()]);
    setUser(me);
    setRoles(bundle.roles ?? []);
    setPermissions(bundle.permissions ?? []);
    setStatus("authenticated");
  }, []);

  const reset = useCallback(() => {
    clearTokens();
    setUser(null);
    setPermissions([]);
    setRoles([]);
    setStatus("anonymous");
  }, []);

  // Restore a session on first paint. A stored token is only a claim; it is
  // verified against the server before the UI treats it as a session, so a stale
  // or tampered token lands on the login page rather than on a broken dashboard.
  // With no stored token there is nothing to do — the initial state is already
  // `anonymous` — so this effect only ever runs for a session worth verifying.
  //
  // The state updates live in the `then` callbacks rather than in the effect
  // body: the body subscribes to an answer that has not arrived yet, which is
  // what an effect is for.
  useEffect(() => {
    if (!hasStoredSession()) return;
    let cancelled = false;

    Promise.all([authApi.me(), authApi.permissions()]).then(
      ([me, bundle]) => {
        if (cancelled) return;
        setUser(me);
        setRoles(bundle.roles ?? []);
        setPermissions(bundle.permissions ?? []);
        setStatus("authenticated");
      },
      () => {
        if (!cancelled) reset();
      },
    );

    return () => {
      cancelled = true;
    };
  }, [reset]);

  // A refresh token that no longer works ends the session exactly once, wherever
  // it is noticed.
  useEffect(() => onForcedLogout(reset), [reset]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await authApi.login(email, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      await loadProfile();
    },
    [loadProfile],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // A sign-out that fails to reach the server still ends the session here:
      // the tokens are dropped either way, and the audit entry is the server's
      // to write, not this screen's to block on.
    }
    reset();
    router.push("/login");
  }, [reset, router]);

  const value = useMemo<SessionValue>(() => {
    const isCustomer = roles.includes("CUSTOMER");
    const recognised = roles.filter((role) => ALL_ROLES.includes(role));
    return {
      status,
      user,
      permissions,
      roles,
      // An unrecognised role is treated as non-customer rather than as a grant:
      // a typo in a role name must never widen access.
      isCustomer,
      isStaff: recognised.length > 0 && !isCustomer,
      can: (permission) => permissions.includes(permission),
      canAny: (...needed) => needed.some((permission) => permissions.includes(permission)),
      hasRole: (role) => roles.includes(role),
      login,
      logout,
      reload: loadProfile,
    };
  }, [status, user, permissions, roles, login, logout, loadProfile]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside <AuthProvider>");
  return context;
}