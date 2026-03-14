import { invoke } from "@tauri-apps/api/core";
import type {
  CloudSyncPayload,
  CloudSyncPushResult,
  CloudSyncSnapshot,
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
