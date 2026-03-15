import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMissingSkillRestores, computeMissingSkills } from "../cloudSyncUtils.ts";

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

test("buildMissingSkillRestores returns restore plan for missing skills", () => {
  const restores = buildMissingSkillRestores(
    [
      {
        id: "s1",
        name: "Skill 1",
        source: "marketplace",
        version: "1.0",
        marketplace: { repo_url: "https://github.com/acme/repo", skill_path: ".claude/skills/s1" },
      },
      {
        id: "s2",
        name: "Skill 2",
        source: "vault",
        version: "1.0",
        vault: { skill_id: "s2" },
      },
    ],
    [{ id: "s3" }],
  );

  assert.deepEqual(
    restores.map((item) => item.type),
    ["marketplace", "vault"],
  );
});
