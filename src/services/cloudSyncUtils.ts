export function computeMissingSkills<T extends { id: string }>(
  remote: T[],
  local: { id: string }[],
): T[] {
  const localIds = new Set(local.map((skill) => skill.id));
  return remote.filter((skill) => !localIds.has(skill.id));
}

export type MissingSkillRestore =
  | { type: "marketplace"; skill: CloudSyncSkillLike }
  | { type: "vault"; skill: CloudSyncSkillLike };

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
