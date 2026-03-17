import type { CloudSyncPushResult } from "../types/index.ts";

export type SyncStage = "idle" | "pulling" | "pushing" | "error";

type SyncPullThenPushOptions = {
  pull: () => Promise<void>;
  push: () => Promise<CloudSyncPushResult>;
  onStage: (stage: SyncStage) => void;
  onError?: (message: string) => void;
  retryOnConflict?: boolean;
};

export async function syncPullThenPush({
  pull,
  push,
  onStage,
  onError,
  retryOnConflict = true,
}: SyncPullThenPushOptions): Promise<CloudSyncPushResult> {
  try {
    onStage("pulling");
    await pull();
    onStage("pushing");
    let result = await push();

    if (result.status === "conflict" && retryOnConflict) {
      onStage("pulling");
      await pull();
      onStage("pushing");
      result = await push();
    }

    if (result.status === "conflict") {
      throw new Error("Sync conflict persists after retry");
    }

    onStage("idle");
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onError?.(message);
    onStage("error");
    throw err;
  }
}
