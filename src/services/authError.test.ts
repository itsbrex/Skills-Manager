import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuthErrorMessage } from "./authError.ts";

const t = (key: string) =>
  ({
    "auth.loginFailed": "登录失败，请重试",
    "auth.googleLoginUnavailable": "Google 登录当前不可用，请先使用 GitHub 登录",
    "auth.githubLoginUnavailable": "GitHub 登录当前不可用，请稍后重试",
  }[key] ?? key);

test("buildAuthErrorMessage maps google start 500 to a provider-specific message", () => {
  assert.equal(
    buildAuthErrorMessage(t, new Error("Auth start failed: HTTP 500"), {
      provider: "google",
      stage: "start",
    }),
    "Google 登录当前不可用，请先使用 GitHub 登录",
  );
});

test("buildAuthErrorMessage preserves expired state errors", () => {
  assert.equal(
    buildAuthErrorMessage(t, "登录状态已过期，请重试", {
      provider: "github",
      stage: "exchange",
    }),
    "登录状态已过期，请重试",
  );
});

test("buildAuthErrorMessage falls back to generic message with detail", () => {
  assert.equal(
    buildAuthErrorMessage(t, "Failed to exchange auth code: timeout", {
      provider: "github",
      stage: "exchange",
    }),
    "登录失败，请重试：Failed to exchange auth code: timeout",
  );
});
