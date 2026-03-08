# Telemetry Client Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 Tauri 客户端侧实现本地 telemetry 会话持久化、批量上传和静默重试，并接入已部署的 `POST /api/v1/telemetry/ingest`。

**Architecture:** Rust 后端负责 telemetry 配置、会话存储、事件队列和上传逻辑；前端只在应用生命周期触发初始化、心跳、结束和定时 flush，不展示任何 telemetry UI。为了支持后续扩展到 event，上报协议按批量 payload 实现，本地存储保持可幂等重复 flush。

**Tech Stack:** Tauri 2、Rust、serde、reqwest、SQLite（rusqlite）、React

---

### Task 1: 增加 telemetry 配置与模型

**Files:**
- Modify: `src-tauri/src/models/config.rs`
- Modify: `src-tauri/src/models/mod.rs`
- Modify: `src/types/index.ts`

**Step 1: Write the failing test**

在 `src-tauri/src/models/config.rs` 增加测试，断言默认配置包含 telemetry 字段且心跳/批量参数默认值正确。

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test telemetry_config_ -- --nocapture`  
Expected: FAIL because telemetry config types do not exist yet

**Step 3: Write minimal implementation**

新增 `TelemetryConfig` 到 `AppConfig`，默认包含：

```rust
enabled: false
base_url: None
ingest_path: "/api/v1/telemetry/ingest"
ingest_key: None
heartbeat_interval_secs: 60
flush_interval_secs: 600
startup_flush_delay_secs: 45
batch_size: 20
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test telemetry_config_ -- --nocapture`  
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/models/config.rs src-tauri/src/models/mod.rs src/types/index.ts
git commit -m "feat: add telemetry config models"
```

### Task 2: 实现 telemetry 本地存储与会话生命周期

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/services/mod.rs`
- Create: `src-tauri/src/services/telemetry.rs`
- Modify: `src-tauri/src/test_support.rs`

**Step 1: Write the failing test**

在 `src-tauri/src/services/telemetry.rs` 增加测试，覆盖：

```rust
#[test]
fn telemetry_initialize_creates_install_and_session() {}

#[test]
fn telemetry_heartbeat_updates_last_seen_at() {}

#[test]
fn telemetry_end_session_marks_session_complete() {}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test telemetry_ -- --nocapture`  
Expected: FAIL because telemetry service does not exist yet

**Step 3: Write minimal implementation**

引入 `rusqlite`，实现本地 SQLite 文件、meta 表、sessions 表和 events 表，支持：

```rust
TelemetryService::initialize_session()
TelemetryService::record_heartbeat()
TelemetryService::end_session()
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test telemetry_ -- --nocapture`  
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/services/mod.rs src-tauri/src/services/telemetry.rs src-tauri/src/test_support.rs
git commit -m "feat: add local telemetry session store"
```

### Task 3: 实现批量上传与幂等 flush

**Files:**
- Modify: `src-tauri/src/services/telemetry.rs`

**Step 1: Write the failing test**

增加测试，覆盖：

```rust
#[test]
fn telemetry_flush_builds_batch_payload() {}

#[test]
fn telemetry_flush_marks_uploaded_records_on_success() {}
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test telemetry_flush_ -- --nocapture`  
Expected: FAIL because flush logic does not exist yet

**Step 3: Write minimal implementation**

实现：

```rust
TelemetryService::flush_pending()
TelemetryService::track_event()
```

上传目标为：

```text
{base_url}{ingest_path}
```

请求头：

```text
Content-Type: application/json
X-Ingest-Key: <telemetry.ingest_key>
X-Request-Id: <uuid>
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test telemetry_flush_ -- --nocapture`  
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/services/telemetry.rs
git commit -m "feat: add telemetry batch upload"
```

### Task 4: 暴露 Tauri 命令并接入前端生命周期

**Files:**
- Modify: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/telemetry.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/App.tsx`

**Step 1: Write the failing test**

在 Rust 命令层增加测试，验证命令调用 telemetry service 并返回成功。

**Step 2: Run test to verify it fails**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test telemetry_command_ -- --nocapture`  
Expected: FAIL because telemetry commands are not wired

**Step 3: Write minimal implementation**

新增命令：

```rust
telemetry_initialize
telemetry_record_heartbeat
telemetry_end_session
telemetry_flush_pending
telemetry_track_event
```

前端 `App.tsx`：

1. 初始化后调用 `telemetry_initialize`
2. 用 `setInterval` 发送 heartbeat
3. 用 `setTimeout` 延迟 flush
4. 在 `beforeunload` 中 best-effort 调用 `telemetry_end_session`

**Step 4: Run test to verify it passes**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test telemetry_ -- --nocapture`  
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/commands/mod.rs src-tauri/src/commands/telemetry.rs src-tauri/src/lib.rs src/App.tsx
git commit -m "feat: wire telemetry lifecycle commands"
```

### Task 5: 全量验证

**Files:**
- Modify: `docs/plans/2026-03-08-telemetry-client-implementation.md`

**Step 1: Run targeted Rust tests**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test telemetry_ -- --nocapture`

**Step 2: Run full Rust test suite**

Run: `cd /Users/yjw/code/projects/skills-manager/src-tauri && cargo test`

**Step 3: Run frontend build**

Run: `cd /Users/yjw/code/projects/skills-manager && npm run build`

**Step 4: Update plan notes if implementation differs**

记录任何偏离计划的实际落点和原因。

**Step 5: Commit**

```bash
git add docs/plans/2026-03-08-telemetry-client-implementation.md
git commit -m "docs: finalize telemetry client implementation plan"
```
