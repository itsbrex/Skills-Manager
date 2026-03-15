import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCloudSyncIntervalOptions } from "./cloudSyncSettingsOptions.ts";

test("buildCloudSyncIntervalOptions preserves order", () => {
  const options = buildCloudSyncIntervalOptions([5, 10, 30]);
  assert.deepEqual(options, [5, 10, 30]);
});
