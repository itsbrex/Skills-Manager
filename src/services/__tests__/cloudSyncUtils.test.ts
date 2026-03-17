import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMissingSkillRestores,
  computeMissingSkills,
  runVaultBackupThenPush,
} from "../cloudSyncUtils.ts";

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

test("buildMissingSkillRestores falls back to vault for local/imported skills", () => {
  const restores = buildMissingSkillRestores(
    [
      {
        id: "s-local",
        name: "Local Skill",
        source: "local",
        version: "1.0",
      },
      {
        id: "s-imported",
        name: "Imported Skill",
        source: "imported",
        version: "1.0",
      },
    ],
    [],
  );

  assert.deepEqual(
    restores.map((item) => item.type),
    ["vault", "vault"],
  );
});

test("runVaultBackupThenPush runs backup before push", async () => {
  const order: string[] = [];
  const result = await runVaultBackupThenPush(
    async () => {
      order.push("backup");
      return { uploaded: 0, skipped: 0, failed: [] };
    },
    async () => {
      order.push("push");
      return { status: "synced", revision: 1 };
    },
  );

  assert.deepEqual(order, ["backup", "push"]);
  assert.deepEqual(result, { status: "synced", revision: 1 });
});

test("runVaultBackupThenPush stops on backup failure", async () => {
  let pushed = false;
  await assert.rejects(
    () =>
      runVaultBackupThenPush(
        async () => {
          throw new Error("backup failed");
        },
        async () => {
          pushed = true;
          return { status: "synced", revision: 1 };
        },
      ),
    /backup failed/,
  );
  assert.equal(pushed, false);
});
