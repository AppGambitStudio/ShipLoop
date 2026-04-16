"use client";

import { api } from "./api";

/**
 * Check auth state and config. Returns the route to redirect to.
 * - No token → /login
 * - Token but no config → /onboard
 * - Token + config → null (stay on current page)
 */
export async function getAuthRedirect(currentPath: string): Promise<string | null> {
  const token = typeof window !== "undefined" ? localStorage.getItem("shiploop_token") : null;

  if (!token) {
    return currentPath === "/login" ? null : "/login";
  }

  // Already on login page with a token — go to dump or onboard
  if (currentPath === "/login") {
    try {
      const config = await api.config.get();
      return config ? "/dump" : "/onboard";
    } catch {
      return "/onboard";
    }
  }

  // On onboard page — only redirect away if config exists
  if (currentPath === "/onboard") {
    try {
      const config = await api.config.get();
      return config ? "/dump" : null;
    } catch {
      return null;
    }
  }

  // On protected pages (dump, queue) — check config
  if (currentPath === "/dump" || currentPath === "/queue") {
    try {
      const config = await api.config.get();
      if (!config) return "/onboard";
    } catch {
      // Token might be invalid
      localStorage.removeItem("shiploop_token");
      return "/login";
    }
  }

  return null;
}

export function isLoggedIn(): boolean {
  return typeof window !== "undefined" && !!localStorage.getItem("shiploop_token");
}

export function logout() {
  localStorage.removeItem("shiploop_token");
  window.location.href = "/login";
}
