# Skills Manager

> **A unified desktop application for managing AI coding assistant skills.**
> Seamlessly organize, sync, and share skills for **Claude Code、Codex、Opencode** and other AI tools.

![Version](https://img.shields.io/badge/version-1.0-blue) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey) ![Tech](https://img.shields.io/badge/built%20with-Tauri%202.0%20%2B%20React%2019-orange)

[中文说明](./README_CN.md)

## 📖 Introduction

**Skills Manager** is a modern desktop application designed to solve the fragmentation of AI assistant skills configurations. Instead of managing skills and prompts separately for different tools, Skills Manager provides a central hub.

It uses a powerful **symlink synchronization mechanism**, allowing you to write a skill once and instantly use it across supported AI tools like Claude Code、Codex、Opencode.

## ✨ Key Features

- **🎯 Unified Management**: Centralize all your AI skills in one secure location.
- **🔄 Smart Synchronization**: Automatic symlink management ensures your tools always have the latest version of your skills without file duplication.
- **⚡ High Performance**: Built with **Rust** and **Tauri 2.0** for a lightweight, blazing-fast experience.
- **🛡️ Cross-Platform**: Native support for macOS, Windows, and Linux.
- **🔌 Multi-Tool Support**: Out-of-the-box support for **Claude Code、Codex、Opencode** and extensible to others.
- **🎨 Modern UI**: Beautiful interface built with React 19, Tailwind CSS v4, and Radix UI.

## 📥 Download

Download the latest installer for your operating system from the **[Releases Page](../../releases)**.

| OS | Installer Type |
|----|----------------|
| **macOS** | `.dmg` (Universal) |
| **Windows** | `.msi` / `.exe` |
| **Linux** | `.deb` / `.AppImage` |

## 🚀 Getting Started

1. **Install**: Run the installer for your platform.
2. **Setup**: On first launch, the app will guide you to select your skills storage directory.
3. **Sync**: The app automatically detects installed AI tools (like Claude Code) and links your skills.

## 🛠️ Technology Stack

Designed for developers who care about performance and stability:

- **Core**: [Tauri 2.0](https://tauri.app/) (Rust)
- **Frontend**: [React 19](https://react.dev/) + TypeScript
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/)
- **Editor**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)

## 🤝 Contributing & Feedback

This is a public release repository. If you encounter issues or have feature requests, please check the [Issues](../../issues) page.

---

*Made with ❤️ for the AI developer community.*
