# Bump Version to 1.0.2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade application version from 1.0.1 to 1.0.2 across all configuration files to ensure consistency.

**Architecture:** Direct modification of version strings in configuration (JSON/TOML) and source code (Rust) files.

**Tech Stack:** Node.js (package.json), Tauri (tauri.conf.json), Rust (Cargo.toml, config.rs).

---

### Task 1: Update package.json

**Files:**
- Modify: `package.json`

**Step 1: Update version field**

```json
// package.json
{
  "name": "skills-manager",
  "private": true,
  "version": "1.0.2", // Update from 1.0.1
  ...
}
```

**Step 2: Verify update**

Run: `grep "version" package.json`
Expected: `"version": "1.0.2"`

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 1.0.2 in package.json"
```

### Task 2: Update src-tauri/tauri.conf.json

**Files:**
- Modify: `src-tauri/tauri.conf.json`

**Step 1: Update version field**

```json
// src-tauri/tauri.conf.json
{
  "productName": "skills-manager",
  "version": "1.0.2", // Update from 1.0.1
  ...
}
```

**Step 2: Verify update**

Run: `grep "version" src-tauri/tauri.conf.json`
Expected: `"version": "1.0.2"`

**Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: bump version to 1.0.2 in tauri.conf.json"
```

### Task 3: Update src-tauri/Cargo.toml

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: Update version field**

```toml
[package]
name = "skills-manager"
version = "1.0.2" # Update from 1.0.1
...
```

**Step 2: Verify update**

Run: `grep "version" src-tauri/Cargo.toml`
Expected: `version = "1.0.2"`

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "chore: bump version to 1.0.2 in Cargo.toml"
```

### Task 4: Update src-tauri/src/models/config.rs

**Files:**
- Modify: `src-tauri/src/models/config.rs`

**Step 1: Update default version**

```rust
// src-tauri/src/models/config.rs
impl Default for AppConfig {
    fn default() -> Self {
        Self {
            version: "1.0.2".to_string(), // Update from 1.0.1
            ...
        }
    }
}
```

**Step 2: Verify update**

Run: `grep "version" src-tauri/src/models/config.rs`
Expected: `version: "1.0.2".to_string(),`

**Step 3: Commit**

```bash
git add src-tauri/src/models/config.rs
git commit -m "chore: bump version to 1.0.2 in config.rs"
```
