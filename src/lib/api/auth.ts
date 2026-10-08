import { api } from "@/lib/api/client";
import type { CurrentUser, PermissionBundle, TokenResponse } from "@/lib/api/types";

export const authApi = {
  /** Anonymous: a signed-out caller has no token to send. */
  login: (email: string, password: string) =>
    api.post<TokenResponse>("/auth/login", { email, password }, undefined),

  logout: () => api.post<{ message: string }>("/auth/logout"),

  me: () => api.get<CurrentUser>("/auth/me"),

  permissions: () => api.get<PermissionBundle>("/auth/permissions"),

  requestPasswordReset: (email: string) =>
    api.post<{ message: string }>("/auth/password-reset/request", { email }),

  confirmPasswordReset: (token: string, newPassword: string) =>
    api.post<{ message: string }>("/auth/password-reset/confirm", {
      token,
      new_password: newPassword,
    }),
};