"use client";

/**
 * Owns session state, permissions, and sign-out for the application.
 * Staff access follows the backend's role rule, not the mutable `is_staff` flag.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import type { CurrentUser, TokenResponse } from "@/lib/api/types";

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
  acceptTokens: (tokens: TokenResponse) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  invalidateSession: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const ALL_ROLES = [
  "OWNER",
  "SERVICE_ADVISOR",
  "TECHNICIAN",
  "PARTS_STAFF",
  "CUSTOMER",
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>(() =>
    // No stored token means anonymous; a stored token must be verified with the API.
    typeof window !== "undefined" && !hasStoredSession()
      ? "anonymous"
      : "loading",
  );
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  // Invalidates any profile request started before a logout or password reset.
  const sessionEpoch = useRef(0);

  const loadProfile = useCallback(async () => {
    const epoch = sessionEpoch.current;
    const [me, bundle] = await Promise.all([
      authApi.me(),
      authApi.permissions(),
    ]);
    if (epoch !== sessionEpoch.current || !hasStoredSession()) {
      throw new Error("Session changed while loading the profile");
    }
    setUser(me);
    setRoles(bundle.roles ?? []);
    setPermissions(bundle.permissions ?? []);
    setStatus("authenticated");
  }, []);

  const reset = useCallback(() => {
    sessionEpoch.current += 1;
    clearTokens();
    setUser(null);
    setPermissions([]);
    setRoles([]);
    setStatus("anonymous");
  }, []);

  // Verify a stored token with the API before restoring the session. A request
  // that completes after reset must not resurrect the session it was checking.
  useEffect(() => {
    if (!hasStoredSession()) return;
    let cancelled = false;
    const epoch = sessionEpoch.current;

    Promise.all([authApi.me(), authApi.permissions()]).then(
      ([me, bundle]) => {
        if (cancelled || epoch !== sessionEpoch.current) return;
        if (!hasStoredSession()) {
          reset();
          return;
        }
        setUser(me);
        setRoles(bundle.roles ?? []);
        setPermissions(bundle.permissions ?? []);
        setStatus("authenticated");
      },
      () => {
        if (!cancelled && epoch === sessionEpoch.current) reset();
      },
    );

    return () => {
      cancelled = true;
    };
  }, [reset]);

  const acceptTokens = useCallback(
    async (tokens: TokenResponse) => {
      sessionEpoch.current += 1;
      const generation = sessionEpoch.current;
      setTokens(tokens.access_token, tokens.refresh_token);
      try {
        await loadProfile();
        if (generation !== sessionEpoch.current) {
          throw new Error("Session changed while sign-in was completing.");
        }
      } catch (error) {
        // Never leave unusable tokens behind if profile/permission loading fails.
        if (generation === sessionEpoch.current) reset();
        throw error;
      }
    },
    [loadProfile, reset],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      await acceptTokens(await authApi.login(email, password));
    },
    [acceptTokens],
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
      canAny: (...needed) =>
        needed.some((permission) => permissions.includes(permission)),
      hasRole: (role) => roles.includes(role),
      login,
      acceptTokens,
      logout,
      reload: loadProfile,
      invalidateSession: reset,
    };
  }, [
    status,
    user,
    permissions,
    roles,
    login,
    acceptTokens,
    logout,
    loadProfile,
    reset,
  ]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context)
    throw new Error("useSession must be used inside <AuthProvider>");
  return context;
}
