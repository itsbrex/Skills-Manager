import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  getAuthProfileSnapshot,
  setAuthProfileSnapshot,
  subscribeAuthProfile,
} from "./authProfileStore.ts";

const sampleProfile = {
  user_id: "u1",
  provider: "github",
  username: "octo",
  email: "octo@example.com",
  avatar_url: null,
};

beforeEach(() => {
  setAuthProfileSnapshot(null);
});

test("authProfile store notifies subscribers on change", () => {
  const seen: Array<typeof sampleProfile | null> = [];
  const unsubscribe = subscribeAuthProfile((profile) => {
    seen.push(profile as typeof sampleProfile | null);
  });

  setAuthProfileSnapshot(sampleProfile);
  assert.deepEqual(getAuthProfileSnapshot(), sampleProfile);
  assert.deepEqual(seen[seen.length - 1], sampleProfile);

  setAuthProfileSnapshot(null);
  assert.equal(getAuthProfileSnapshot(), null);
  assert.deepEqual(seen[seen.length - 1], null);

  unsubscribe();
});

test("subscribeAuthProfile emits current snapshot immediately", () => {
  setAuthProfileSnapshot(sampleProfile);
  const seen: Array<typeof sampleProfile | null> = [];
  const unsubscribe = subscribeAuthProfile((profile) => {
    seen.push(profile as typeof sampleProfile | null);
  });
  assert.deepEqual(seen[0], sampleProfile);
  unsubscribe();
});
