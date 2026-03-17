import { test } from "node:test";
import assert from "node:assert/strict";
import { syncPullThenPush } from "../cloudSyncWorkflow.ts";

const okResult = { status: "synced", revision: 2 } as const;

test("syncPullThenPush runs pull then push and updates stages", async () => {
  const stages: string[] = [];
  const calls: string[] = [];
  let pullResolved = false;
  let resolvePull: (() => void) | undefined;
  const pullGate = new Promise<void>((resolve) => {
    resolvePull = resolve;
  });

  const run = syncPullThenPush({
    pull: async () => {
      calls.push("pull");
      await pullGate;
      pullResolved = true;
    },
    push: async () => {
      assert.equal(pullResolved, true);
      calls.push("push");
      return okResult;
    },
    onStage: (stage) => stages.push(stage),
  });

  await Promise.resolve();
  resolvePull?.();
  const result = await run;

  assert.deepEqual(calls, ["pull", "push"]);
  assert.equal(stages[0], "pulling");
  assert.equal(stages[1], "pushing");
  assert.equal(stages[stages.length - 1], "idle");
  assert.equal(result, okResult);
});
