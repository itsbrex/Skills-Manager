import { invoke } from "@tauri-apps/api/core";
import type {
  CloudSyncPayload,
  CloudSyncPushResult,
  CloudSyncSnapshot,
  InstallResult,
} from "@/types";

export async function cloudSyncPull(): Promise<CloudSyncSnapshot> {
  return invoke<CloudSyncSnapshot>("cloud_sync_pull");
}

export async function cloudSyncPush(): Promise<CloudSyncPushResult> {
  return invoke<CloudSyncPushResult>("cloud_sync_push");
}

export async function cloudSyncResolve(
  payload: CloudSyncPayload,
): Promise<number> {
  return invoke<number>("cloud_sync_resolve", { payload });
}

export async function installMarketplaceSkillByRef(
  reference: {
    name: string;
    marketplace_source_id?: string | null;
    marketplace_skill_id?: string | null;
    marketplace_skill_slug?: string | null;
    repo_url?: string | null;
    skill_path?: string | null;
    remote_revision?: string | null;
  },
): Promise<InstallResult> {
  return invoke<InstallResult>("install_marketplace_skill_by_ref", { reference });
}

export async function vaultDownload(skillId: string): Promise<string> {
  return invoke<string>("vault_download", { skillId });
}
