import type { AuthMeResponse } from "../types/index.ts";

type AuthProfileListener = (profile: AuthMeResponse | null) => void;

let currentProfile: AuthMeResponse | null = null;
const listeners = new Set<AuthProfileListener>();

export function getAuthProfileSnapshot(): AuthMeResponse | null {
  return currentProfile;
}

export function setAuthProfileSnapshot(profile: AuthMeResponse | null): void {
  currentProfile = profile;
  listeners.forEach((listener) => listener(currentProfile));
}

export function subscribeAuthProfile(listener: AuthProfileListener): () => void {
  listeners.add(listener);
  listener(currentProfile);
  return () => {
    listeners.delete(listener);
  };
}
