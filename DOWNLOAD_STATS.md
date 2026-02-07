# Skills Manager 下载统计

**日期:** 2026-02-07
**仓库:** jiweiyeah/Skills-Manager

## 查询命令

查看最新 Release 中每个文件的下载量：

```bash
gh release view -R jiweiyeah/Skills-Manager --json assets --jq '.assets[] | "| " + .name + " | " + (.downloadCount|tostring) + " |"'
```

查看总下载量：

```bash
gh release view -R jiweiyeah/Skills-Manager --json assets --jq '[.assets[].downloadCount] | add'
```

## 当前统计数据 (记录于 2026-02-07)

| 文件名 | 下载量 | 平台 |
| :--- | :--- | :--- |
| **Skills.Manager_1.0.0_x64-setup.exe** | **2** | Windows (安装程序) |
| Skills.Manager_1.0.0_aarch64.dmg | 1 | macOS (Apple Silicon) |
| Skills.Manager.app.zip | 1 | macOS (压缩包) |
| Skills.Manager_1.0.0_amd64.AppImage | 1 | Linux (通用) |
| Skills.Manager_1.0.0_amd64.deb | 1 | Linux (Debian/Ubuntu) |
| Skills.Manager-1.0.0-1.x86_64.rpm | 1 | Linux (RedHat/Fedora) |
| Skills.Manager_1.0.0_x64_en-US.msi | 1 | Windows (MSI) |

**总下载量:** 8
