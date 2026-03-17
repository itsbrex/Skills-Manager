import { test } from "node:test";
import assert from "node:assert/strict";
import { syncPullThenPush } from "../cloudSyncWorkflow.ts";

const okResult = { status: "synced", revision: 2 } as const;
const payload = {
  version: 1,
  updated_at: 1,
  device_id: "device-a",
  skills: [],
  tool_states: {},
  custom_tools: [],
} as const;

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
  assert.deepEqual(stages, ["pulling", "pushing", "idle"]);
  assert.deepEqual(result, okResult);
});

test("syncPullThenPush stops when pull fails", async () => {
  const stages: string[] = [];
  let pushCalls = 0;

  await assert.rejects(
    () =>
      syncPullThenPush({
        pull: async () => {
          throw new Error("pull failed");
        },
        push: async () => {
          pushCalls += 1;
          return okResult;
        },
        onStage: (stage) => stages.push(stage),
      }),
    /pull failed/,
  );

  assert.equal(pushCalls, 0);
  assert.deepEqual(stages, ["pulling", "error"]);
});

test("syncPullThenPush retries once on conflict and succeeds", async () => {
  const stages: string[] = [];
  const calls: string[] = [];
  let pushCount = 0;

  const result = await syncPullThenPush({
    pull: async () => {
      calls.push("pull");
    },
    push: async () => {
      calls.push("push");
      pushCount += 1;
      if (pushCount === 1) {
        return {
          status: "conflict",
          revision: 1,
          payload,
          local_payload: payload,
        };
      }
      return okResult;
    },
    onStage: (stage) => stages.push(stage),
  });

  assert.deepEqual(calls, ["pull", "push", "pull", "push"]);
  assert.deepEqual(stages, ["pulling", "pushing", "pulling", "pushing", "idle"]);
  assert.deepEqual(result, okResult);
});
