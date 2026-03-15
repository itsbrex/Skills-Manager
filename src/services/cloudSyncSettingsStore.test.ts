import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  getCloudSyncSettingsSnapshot,
  setCloudSyncSettingsSnapshot,
  subscribeCloudSyncSettings,
} from "./cloudSyncSettingsStore.ts";

beforeEach(() => {
  setCloudSyncSettingsSnapshot({ auto: true, intervalMinutes: 10 });
});

test("cloud sync settings store notifies subscribers", () => {
  const seen: Array<{ auto: boolean; intervalMinutes: number }> = [];
  const unsubscribe = subscribeCloudSyncSettings((settings) => {
    seen.push(settings);
  });
  setCloudSyncSettingsSnapshot({ auto: false, intervalMinutes: 30 });
  assert.deepEqual(seen[seen.length - 1], { auto: false, intervalMinutes: 30 });
  unsubscribe();
});

test("subscribeCloudSyncSettings emits current snapshot immediately", () => {
  const seen: Array<{ auto: boolean; intervalMinutes: number }> = [];
  const unsubscribe = subscribeCloudSyncSettings((settings) => {
    seen.push(settings);
  });
  assert.deepEqual(seen[0], { auto: true, intervalMinutes: 10 });
  unsubscribe();
});
