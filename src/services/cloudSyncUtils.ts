export function computeMissingSkills<T extends { id: string }>(
  remote: T[],
  local: { id: string }[],
): T[] {
  const localIds = new Set(local.map((skill) => skill.id));
  return remote.filter((skill) => !localIds.has(skill.id));
}

type ConsentValue = "unknown" | "granted" | "denied";

export type CloudSyncPreferencesLike = {
  theme: string;
  font_family: string;
  language: string;
  auto_sync: boolean;
  sync_on_save: boolean;
  cloud_sync_auto: boolean;
  cloud_sync_interval_minutes: number;
  default_editor: string;
  tab_size: number;
  show_sync_notifications: boolean;
  remove_links_when_disabling_tool: boolean;
  vault_backup_consent: ConsentValue;
  telemetry_consent: ConsentValue;
  github_token?: string | null;
};

export function mergeCloudSyncPreferences<T extends CloudSyncPreferencesLike>(
  local: T | null | undefined,
  remote: Partial<T> | null | undefined,
  defaults: T,
): T {
  const merged = {
    ...defaults,
    ...(local ?? {}),
    ...(remote ?? {}),
  } as T;

  // Telemetry consent is a device-local privacy choice and should not be
  // overridden by older or remote cloud payloads.
  merged.telemetry_consent = (local?.telemetry_consent ??
    defaults.telemetry_consent) as T["telemetry_consent"];

  return merged;
}

export type MissingSkillRestore =
  | { type: "marketplace"; skill: CloudSyncSkillLike }
  | { type: "vault"; skill: CloudSyncSkillLike };

export function isNonBlockingRestoreError(message: string): boolean {
  return message.startsWith("Restore failed:");
}

type CloudSyncSkillLike = {
  id: string;
  name: string;
  source: string;
  marketplace?: {
    marketplace_source_id?: string | null;
    marketplace_skill_id?: string | null;
    marketplace_skill_slug?: string | null;
    repo_url?: string | null;
    skill_path?: string | null;
    remote_revision?: string | null;
  } | null;
  vault?: {
    skill_id?: string | null;
  } | null;
};

export function buildMissingSkillRestores(
  remote: CloudSyncSkillLike[],
  local: { id: string }[],
): MissingSkillRestore[] {
  const missing = computeMissingSkills(remote, local);
  const restores: MissingSkillRestore[] = [];
  for (const skill of missing) {
    if (skill.marketplace?.repo_url && skill.marketplace?.skill_path) {
      restores.push({ type: "marketplace", skill });
      continue;
    }
    const isNonMarketSource =
      skill.source === "local" || skill.source === "imported";
    if (skill.vault?.skill_id || skill.source === "vault" || isNonMarketSource) {
      restores.push({ type: "vault", skill });
    }
  }
  return restores;
}

export async function runVaultBackupThenPush<TBackup, TPush>(
  backup: () => Promise<TBackup>,
  push: () => Promise<TPush>,
): Promise<TPush> {
  await backup();
  return push();
}
