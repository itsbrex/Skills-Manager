# Vault Non-Market Consent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add one-time consent for syncing non-market skills, with a tri-state preference and settings toggle; manual sync prompts once, auto sync never prompts.

**Architecture:** Persist a tri-state consent value in config preferences, gate vault backup and non-market payload on consent, and surface a settings toggle plus a manual-sync consent modal. Auto sync skips vault backup unless consent is granted.

**Tech Stack:** Tauri (Rust), React (TypeScript), i18n (en/zh), Vitest + Rust unit tests.

---

### Task 1: Add tri-state consent to config/types

**Files:**
- Modify: `src-tauri/src/models/config.rs`
- Modify: `src/types/index.ts`
- Modify: `src/constants/preferences.ts`

**Step 1: Write failing test (Rust)**
Add a new test in `src-tauri/src/models/config.rs` (or a nearby config test module) that loads a config missing the new field and asserts the default is `unknown`.

**Step 2: Run test to verify it fails**
Run: `cargo test -p skills-manager` (or the repo’s standard Rust test command)
Expected: FAIL because the new field/enum isn’t defined yet.

**Step 3: Write minimal implementation**
- Add `VaultBackupConsent` enum with `Unknown/Granted/Denied` (serde rename to snake_case).
- Add `vault_backup_consent` to `UserPreferences` with `#[serde(default)]` and default `Unknown` in `impl Default`.
- Add TS type union: `"unknown" | "granted" | "denied"` in `UserPreferences`.
- Add default in `src/constants/preferences.ts` as `vault_backup_consent: "unknown"`.

**Step 4: Run test to verify it passes**
Run: `cargo test -p skills-manager`
Expected: PASS

**Step 5: Commit**
```
git add src-tauri/src/models/config.rs src/types/index.ts src/constants/preferences.ts
git commit -m "feat: add vault backup consent preference"
```

---

### Task 2: Gate cloud sync payload & vault backup by consent

**Files:**
- Modify: `src-tauri/src/services/cloud_sync.rs`
- Modify: `src-tauri/src/commands/cloud_sync.rs`
- Test: `src-tauri/src/services/cloud_sync.rs` (new unit test)

**Step 1: Write failing test (Rust)**
Add a unit test that builds a payload with marketplace + local skills and `vault_backup_consent = denied`, and asserts only marketplace skills are included.

**Step 2: Run test to verify it fails**
Run: `cargo test -p skills-manager`
Expected: FAIL because filtering doesn’t exist.

**Step 3: Write minimal implementation**
- Add a helper in `services/cloud_sync.rs` to filter skills when consent is not `granted`.
- In `cloud_sync_push`, filter skills before building payload when consent is `unknown/denied`.

**Step 4: Run test to verify it passes**
Run: `cargo test -p skills-manager`
Expected: PASS

**Step 5: Commit**
```
git add src-tauri/src/services/cloud_sync.rs src-tauri/src/commands/cloud_sync.rs
git commit -m "feat: skip non-market skills when vault consent not granted"
```

---

### Task 3: Add consent modal + manual sync flow

**Files:**
- Create: `src/components/cloud/VaultConsentDialog.tsx`
- Modify: `src/hooks/useCloudSyncAgent.tsx`
- Modify: `src/App.tsx`

**Step 1: Write failing test (JS/TS)**
If no UI tests exist, add a minimal unit test in `src/services/__tests__/cloudSyncUtils.test.ts` for a new helper that decides `allowVaultBackup` from consent values.

**Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL because helper doesn’t exist yet.

**Step 3: Write minimal implementation**
- Add consent state to `useCloudSyncAgent` and load/save via `get_config`/`save_config`.
- Change `performPush` to accept `allowVaultBackup` boolean.
- `manualSync`: if consent `unknown`, open modal; if `granted` -> vault backup + push; if `denied` -> push only.
- Add handlers `accept/deny/cancel` to drive modal.
- Add `VaultConsentDialog` and mount under `App` (near `CloudSyncConflictDialog`).

**Step 4: Run test to verify it passes**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```
git add src/hooks/useCloudSyncAgent.tsx src/components/cloud/VaultConsentDialog.tsx src/App.tsx
git commit -m "feat: prompt once for vault consent on manual sync"
```

---

### Task 4: Settings toggle + i18n copy

**Files:**
- Modify: `src/pages/Settings.tsx`
- Modify: `src/i18n/locales/zh.ts`
- Modify: `src/i18n/locales/en.ts`

**Step 1: Write failing test**
If no UI tests exist, skip test and do a manual verification checklist instead.

**Step 2: Implement UI**
- Add a toggle under Cloud Sync section for “允许备份非市场技能”.
- Toggle writes `vault_backup_consent` to `granted/denied` and updates label text for `unknown/denied/granted`.

**Step 3: Manual verification**
- Unknown -> click “立即同步” shows modal.
- Agree -> modal closes, consent set to granted, no future prompt.
- Deny -> consent set to denied, no future prompt.
- Toggle on from denied -> granted with no modal.

**Step 4: Commit**
```
git add src/pages/Settings.tsx src/i18n/locales/zh.ts src/i18n/locales/en.ts
git commit -m "feat: add vault consent toggle in settings"
```

---

### Task 5: End-to-end verification

**Step 1: Run tests**
- `cargo test -p skills-manager`
- `npm test`

**Step 2: Manual smoke**
- Login, create local skill, click Sync Now.
- Verify modal appears once and consent is recorded.
- Verify denied path skips vault backup but still pushes.

**Step 3: Commit (if needed)**
Only if additional fixes were required.

---

**Plan complete and saved to** `docs/plans/2026-03-16-vault-consent.md`.

Two execution options:
1. Subagent-Driven (this session)
2. Parallel Session (separate)

Which approach?
