import { invoke } from "@tauri-apps/api/core";
import type { AuthMeResponse, AuthStartResult } from "@/types";

export async function startGithubAuth(): Promise<AuthStartResult> {
  return invoke<AuthStartResult>("start_github_auth", {
    debug: import.meta.env.DEV,
  });
}

export async function startGoogleAuth(): Promise<AuthStartResult> {
  return invoke<AuthStartResult>("start_google_auth", {
    debug: import.meta.env.DEV,
  });
}

export async function exchangeGithubAuth(
  loginCode: string,
  state: string,
): Promise<AuthMeResponse> {
  return invoke<AuthMeResponse>("exchange_github_auth", {
    loginCode,
    state,
  });
}

export async function exchangeGoogleAuth(
  loginCode: string,
  state: string,
): Promise<AuthMeResponse> {
  return invoke<AuthMeResponse>("exchange_google_auth", {
    loginCode,
    state,
  });
}

export async function getAuthProfile(): Promise<AuthMeResponse | null> {
  return invoke<AuthMeResponse | null>("get_auth_profile");
}

export async function logoutAuth(): Promise<void> {
  await invoke("logout_auth");
}
