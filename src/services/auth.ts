// Stub implementations - Auth feature removed for open source
// These functions do nothing but prevent compilation errors

export const startGithubAuth = async () => ({
  success: false,
  error: "Authentication unavailable in Community Edition"
});

export const exchangeGithubAuth = async () => ({
  success: false
});

export const startGoogleAuth = async () => ({
  success: false,
  error: "Authentication unavailable in Community Edition"
});

export const exchangeGoogleAuth = async () => ({
  success: false
});

export const clearPendingAuthProvider = () => {};

export const setPendingAuthProvider = () => {};

export const takePendingAuthProvider = () => null;

export const normalizeAuthUrl = (url: string) => url;

export const isExpectedAuthUrl = () => false;

export type AuthProvider = "github" | "google";
