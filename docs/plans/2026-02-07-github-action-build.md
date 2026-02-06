# GitHub Action Manual Build Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a manually triggered GitHub Action workflow to build and upload unsigned Tauri application artifacts for macOS, Windows, and Linux.

**Architecture:**
- **Trigger:** `workflow_dispatch` (manual button in GitHub UI).
- **Matrix:** Parallel builds on `ubuntu-22.04`, `windows-latest`, and `macos-latest`.
- **Steps:** Checkout -> Setup Node/Rust -> Install Deps -> Build -> Upload Artifacts.
- **Output:** 3 zip files (Artifacts) containing the platform-specific installers.

**Tech Stack:** GitHub Actions, Tauri CLI, Node.js 22, Rust Stable.

---

### Task 1: Create Build Workflow Configuration

**Files:**
- Create: `.github/workflows/build.yml`

**Step 1: Create workflow file**

Create the directory `.github/workflows` if it doesn't exist, then write the file.

**File Content:**
```yaml
name: "Manual Build"

on:
  workflow_dispatch:

jobs:
  build-tauri:
    permissions:
      contents: read
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: "macos-latest"
            args: "--target aarch64-apple-darwin"
          - platform: "ubuntu-22.04"
            args: ""
          - platform: "windows-latest"
            args: ""

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: setup node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin' || '' }}

      - name: install dependencies (ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

      - name: install frontend dependencies
        run: npm ci

      - name: build tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: v__VERSION__ # the action automatically replaces \_\_VERSION\_\_ with the app version.
          releaseName: "Skills Manager v__VERSION__"
          releaseBody: "See the assets to download this version and install."
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: skills-manager-${{ matrix.platform }}
          path: src-tauri/target/release/bundle/
          retention-days: 7
```

*Note: using `tauri-apps/tauri-action@v0` simplifies the build process significantly compared to running raw commands, as it handles caching and standard flags.*

**Step 2: Verify file creation**
Run: `ls -l .github/workflows/build.yml`

**Step 3: Commit**
```bash
git add .github/workflows/build.yml
git commit -m "ci: add manual build workflow for multi-platform artifacts"
```
