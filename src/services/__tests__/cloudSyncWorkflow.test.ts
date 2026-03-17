import { test } from "node:test";
import assert from "node:assert/strict";
import { syncPullThenPush } from "../cloudSyncWorkflow.ts";

const okResult = { status: "synced", revision: 2 } as const;

test("syncPullThenPush runs pull then push and updates stages", async () => {
  const stages: string[] = [];
  const calls: string[] = [];

  await syncPullThenPush({
    pull: async () => {
      calls.push("pull");
    },
    push: async () => {
      calls.push("push");
      return okResult;
    },
    onStage: (stage) => stages.push(stage),
  });

  assert.deepEqual(calls, ["pull", "push"]);
  assert.deepEqual(stages, ["pulling", "pushing", "idle"]);
});
