import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMissingSkills } from "../cloudSyncUtils.ts";

test("computeMissingSkills returns skills that are missing locally", () => {
  const missing = computeMissingSkills(
    [{ id: "s1" }, { id: "s2" }],
    [{ id: "s1" }],
  );
  assert.deepEqual(
    missing.map((skill) => skill.id),
    ["s2"],
  );
});
