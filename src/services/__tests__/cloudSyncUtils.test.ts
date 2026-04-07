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

test("computeMissingSkills distinguishes scoped instances when instance ids are available", () => {
  const missing = computeMissingSkills(
    [
      { id: "shared-skill", instance_id: "global:shared-skill" },
      { id: "shared-skill", instance_id: "project:project-alpha:shared-skill" },
    ],
    [{ id: "shared-skill", instance_id: "global:shared-skill" }],
  );

  assert.deepEqual(
    missing.map((skill) => skill.instance_id),
    ["project:project-alpha:shared-skill"],
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

test("buildMissingSkillRestores skips project-scoped skills until scoped restore is supported", () => {
  const restores = buildMissingSkillRestores(
    [
      {
        id: "shared-skill",
        instance_id: "project:project-alpha:shared-skill",
        scope: "project",
        project_id: "project-alpha",
        name: "Shared Skill",
        source: "marketplace",
        version: "1.0",
        marketplace: {
          repo_url: "https://github.com/acme/repo",
          skill_path: ".claude/skills/shared-skill",
        },
      },
    ],
    [],
  );

  assert.deepEqual(restores, []);
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

test("isNonBlockingRestoreError identifies restore failures", async () => {
  const { isNonBlockingRestoreError } = await import("../cloudSyncUtils.ts");
  assert.equal(
    isNonBlockingRestoreError("Restore failed: superpowers: Vault download failed: HTTP 502"),
    true,
  );
  assert.equal(isNonBlockingRestoreError("network failed"), false);
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

test("mergeCloudSyncPreferences keeps local telemetry consent when cloud payload is unknown", async () => {
  const { mergeCloudSyncPreferences } = await import("../cloudSyncUtils.ts");
  assert.equal(typeof mergeCloudSyncPreferences, "function");

  const defaults = {
    theme: "system",
    font_family: "system",
    language: "en",
    auto_sync: true,
    sync_on_save: true,
    cloud_sync_auto: true,
    cloud_sync_interval_minutes: 10,
    default_editor: "builtin",
    tab_size: 2,
    show_sync_notifications: true,
    remove_links_when_disabling_tool: false,
    vault_backup_consent: "unknown",
    telemetry_consent: "unknown",
    github_token: null,
  } as const;

  const local = {
    ...defaults,
    theme: "light",
    telemetry_consent: "granted",
  };

  const remote = {
    ...defaults,
    theme: "dark",
    telemetry_consent: "unknown",
  };

  assert.deepEqual(
    mergeCloudSyncPreferences(local, remote, defaults),
    {
      ...defaults,
      ...local,
      ...remote,
      telemetry_consent: "granted",
    },
  );
});

test("planCloudSyncRun uses push only when startup sync sees unsynced local changes", async () => {
  const { planCloudSyncRun } = await import("../cloudSyncUtils.ts");
  assert.equal(typeof planCloudSyncRun, "function");
  assert.equal(
    planCloudSyncRun({
      trigger: "startup",
      hasLocalChanges: true,
    }),
    "push_only",
  );
});

test("planCloudSyncRun uses push only when manual sync sees unsynced local changes", async () => {
  const { planCloudSyncRun } = await import("../cloudSyncUtils.ts");
  assert.equal(typeof planCloudSyncRun, "function");
  assert.equal(
    planCloudSyncRun({
      trigger: "manual",
      hasLocalChanges: true,
    }),
    "push_only",
  );
});

test("planCloudSyncRun keeps startup sync as pull only when local state is clean", async () => {
  const { planCloudSyncRun } = await import("../cloudSyncUtils.ts");
  assert.equal(typeof planCloudSyncRun, "function");
  assert.equal(
    planCloudSyncRun({
      trigger: "startup",
      hasLocalChanges: false,
    }),
    "pull_only",
  );
});

test("planCloudSyncRun keeps auto sync as pull then push when local state is clean", async () => {
  const { planCloudSyncRun } = await import("../cloudSyncUtils.ts");
  assert.equal(typeof planCloudSyncRun, "function");
  assert.equal(
    planCloudSyncRun({
      trigger: "auto",
      hasLocalChanges: false,
    }),
    "pull_then_push",
  );
});
