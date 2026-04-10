import test from "node:test";
import assert from "node:assert/strict";
import { buildSkillsHeaderActionLayout } from "./headerActionLayout.ts";

test("buildSkillsHeaderActionLayout keeps project bindings between batch and create actions in normal mode", () => {
  assert.deepEqual(buildSkillsHeaderActionLayout(false), {
    primaryActionIds: ["batch-manage", "project-bindings"],
    secondaryActionIds: ["create-skill"],
  });
});

test("buildSkillsHeaderActionLayout keeps project bindings adjacent to batch actions in batch mode", () => {
  assert.deepEqual(buildSkillsHeaderActionLayout(true), {
    primaryActionIds: ["batch-manage", "batch-configure", "project-bindings"],
    secondaryActionIds: ["create-skill"],
  });
});
