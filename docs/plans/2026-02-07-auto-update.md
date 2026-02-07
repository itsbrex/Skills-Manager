# Auto-Update Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement automatic update checking against GitHub Releases, notifying users of new versions and providing a download link.

**Architecture:**
- **Backend (Rust):** New `updater` service using `reqwest` to fetch GitHub releases and `semver` to compare versions. Exposes a `check_update` command.
- **Frontend (React):** Auto-check on app launch with Toast notification. Manual check button in Settings > About.
- **Data Flow:** Frontend invokes `check_update` -> Backend calls GitHub API -> Returns `UpdateInfo` -> Frontend displays result.

**Tech Stack:**
- Rust: `reqwest` (HTTP client), `semver` (Version comparison)
- TypeScript: React, Tauri Invoke API
- UI: Radix UI Toast, Tailwind CSS

---

### Task 1: Add Rust Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

**Step 1: Add reqwest and semver to Cargo.toml**

Add the following under `[dependencies]`:

```toml
reqwest = { version = "0.11", features = ["json", "blocking"] } # Use blocking for simplicity in command, or async if async runtime is available
semver = "1.0"
serde = { version = "1.0", features = ["derive"] } # Ensure features are present
```

*Note: Verify if `reqwest` needs `json` feature.*

**Step 2: Build to verify dependencies**

Run: `npm run tauri build -- --debug` (or just `cargo check` in `src-tauri`)
Expected: Success

---

### Task 2: Implement Update Service (Rust)

**Files:**
- Create: `src-tauri/src/models/update.rs`
- Create: `src-tauri/src/services/updater.rs`
- Modify: `src-tauri/src/models/mod.rs`
- Modify: `src-tauri/src/services/mod.rs`

**Step 1: Define Update Models**

In `src-tauri/src/models/update.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub has_update: bool,
    pub latest_version: String,
    pub download_url: String,
    pub release_notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct GithubRelease {
    pub tag_name: String,
    pub html_url: String,
    pub body: Option<String>,
}
```

**Step 2: Register model module**

In `src-tauri/src/models/mod.rs`:
```rust
pub mod update;
```

**Step 3: Implement Updater Service**

In `src-tauri/src/services/updater.rs`:

```rust
use crate::models::update::{GithubRelease, UpdateInfo};
use semver::Version;
use std::error::Error;

const REPO_OWNER: &str = "jiweiyeah";
const REPO_NAME: &str = "Skills-Manager";

pub async fn check_for_updates(current_version: &str) -> Result<UpdateInfo, Box<dyn Error>> {
    let client = reqwest::Client::new();
    let url = format!("https://api.github.com/repos/{}/{}/releases/latest", REPO_OWNER, REPO_NAME);

    // GitHub requires User-Agent
    let resp = client.get(&url)
        .header("User-Agent", "Skills-Manager-App")
        .send()
        .await?
        .json::<GithubRelease>()
        .await?;

    // Parse versions (strip 'v' prefix if present)
    let clean_latest = resp.tag_name.trim_start_matches('v');
    let latest_v = Version::parse(clean_latest)?;
    let current_v = Version::parse(current_version)?;

    Ok(UpdateInfo {
        has_update: latest_v > current_v,
        latest_version: resp.tag_name,
        download_url: resp.html_url,
        release_notes: resp.body,
    })
}
```

**Step 4: Register service module**

In `src-tauri/src/services/mod.rs`:
```rust
pub mod updater;
```

---

### Task 3: Implement Update Command (Rust)

**Files:**
- Create: `src-tauri/src/commands/updater.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Create Command**

In `src-tauri/src/commands/updater.rs`:

```rust
use crate::services::updater;
use crate::models::update::UpdateInfo;

#[tauri::command]
pub async fn check_update(app_handle: tauri::AppHandle) -> Result<UpdateInfo, String> {
    let package_info = app_handle.package_info();
    let current_version = &package_info.version; // DO NOT use config.version, use actual app version

    // OR if we strictly must use the config's version as per exploration:
    // But package_info is more reliable for the app binary.
    // Let's use the string version passed from config if needed, but app_handle is safer.
    // Converting Version struct to string:
    let v_str = format!("{}.{}.{}", current_version.major, current_version.minor, current_version.patch);

    updater::check_for_updates(&v_str).await.map_err(|e| e.to_string())
}
```

**Step 2: Register command module**

In `src-tauri/src/commands/mod.rs`:
```rust
pub mod updater;
pub use updater::*;
```

**Step 3: Expose command in lib.rs**

In `src-tauri/src/lib.rs`:
```rust
// Add to generate_handler! list:
check_update,
```

---

### Task 4: Frontend Implementation - API & Types

**Files:**
- Modify: `src/types/index.ts`
- Create: `src/services/updater.ts`

**Step 1: Add Types**

In `src/types/index.ts`:

```typescript
export interface UpdateInfo {
  has_update: boolean;
  latest_version: string;
  download_url: string;
  release_notes?: string;
}
```

**Step 2: Create Service**

In `src/services/updater.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import { UpdateInfo } from "../types";

export async function checkUpdate(): Promise<UpdateInfo> {
  return await invoke("check_update");
}
```

---

### Task 5: Settings Page UI

**Files:**
- Modify: `src/pages/Settings.tsx`

**Step 1: Add Update Button State**

Add state for checking status (`checking`, `updateAvailable`, etc.).

**Step 2: Implement Check Handler**

```typescript
const handleCheckUpdate = async () => {
  setIsChecking(true);
  try {
    const info = await checkUpdate();
    if (info.has_update) {
      // Show toast or alert with link
      open(info.download_url); // import { open } from '@tauri-apps/plugin-shell'
    } else {
      toast({ title: "No updates available", description: "You are on the latest version." });
    }
  } catch (error) {
    console.error(error);
    toast({ variant: "destructive", title: "Check failed", description: String(error) });
  } finally {
    setIsChecking(false);
  }
};
```

**Step 3: Add UI Element**

In the "About" section:
- Add a Button "Check for Updates" next to the version.
- If update available, show "New version available: vX.Y.Z" with a Link button.

---

### Task 6: Auto-Check on Startup

**Files:**
- Modify: `src/App.tsx` (or `src/layouts/RootLayout.tsx` if exists)

**Step 1: Add useEffect for check**

In the main component:

```typescript
useEffect(() => {
  const runAutoCheck = async () => {
    try {
      const info = await checkUpdate();
      if (info.has_update) {
        toast({
          title: `Update Available: ${info.latest_version}`,
          description: "Click to download the new version.",
          action: <ToastAction altText="Download" onClick={() => open(info.download_url)}>Download</ToastAction>,
        });
      }
    } catch (e) {
      // Silent fail on auto-check
      console.warn("Auto-update check failed", e);
    }
  };

  runAutoCheck();
}, []);
```

---
