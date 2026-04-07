import test from "node:test";
import assert from "node:assert/strict";
import { buildSkillsHeaderActionLayout } from "./headerActionLayout.ts";

test("buildSkillsHeaderActionLayout keeps create action separate in normal mode", () => {
  assert.deepEqual(buildSkillsHeaderActionLayout(false), {
    primaryActionIds: ["batch-manage"],
    secondaryActionIds: ["create-skill"],
  });
});

test("buildSkillsHeaderActionLayout keeps batch actions adjacent in batch mode", () => {
  assert.deepEqual(buildSkillsHeaderActionLayout(true), {
    primaryActionIds: ["batch-manage", "batch-configure"],
    secondaryActionIds: ["create-skill"],
  });
});
