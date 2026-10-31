import { api, request } from "@/lib/api/client";
import type {
  CurrentUser,
  PermissionBundle,
  TokenResponse,
} from "@/lib/api/types";

export const authApi = {
  login: (email: string, password: string) =>
    request<TokenResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
      anonymous: true,
    }),

  register: (input: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    phone?: string;
  }) =>
    request<{ message: string }>("/auth/register", {
      method: "POST",
      body: input,
      anonymous: true,
    }),

  verifyEmail: (token: string) =>
    request<TokenResponse>("/auth/verify-email", {
      method: "POST",
      body: { token },
      anonymous: true,
    }),

  resendVerification: (email: string) =>
    request<{ message: string }>("/auth/verification/resend", {
      method: "POST",
      body: { email },
      anonymous: true,
    }),

  logout: () => api.post<{ message: string }>("/auth/logout"),

  me: () => api.get<CurrentUser>("/auth/me"),

  permissions: () => api.get<PermissionBundle>("/auth/permissions"),

  requestPasswordReset: (email: string) =>
    request<{ message: string }>("/auth/password-reset/request", {
      method: "POST",
      body: { email },
      anonymous: true,
    }),

  confirmPasswordReset: (token: string, newPassword: string) =>
    request<{ message: string }>("/auth/password-reset/confirm", {
      method: "POST",
      body: { token, new_password: newPassword },
      anonymous: true,
    }),
};
