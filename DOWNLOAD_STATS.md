# Skills Manager 下载统计

**日期:** 2026-02-07
**仓库:** jiweiyeah/Skills-Manager
**总下载量:** 163

## 查询命令

查看所有版本总下载量：

```bash
gh api repos/jiweiyeah/Skills-Manager/releases --paginate --jq '[.[].assets[].download_count] | add'
```

查看每个版本的详细下载数据：

```bash
gh api repos/jiweiyeah/Skills-Manager/releases --paginate --jq '.[] | "### " + .tag_name + "\n**发布时间:** " + (.published_at | split("T")[0]) + "\n\n| 文件名 | 下载量 |\n| :--- | :--- |\n" + (.assets | sort_by(.download_count) | reverse | map("| " + .name + " | " + (.download_count|tostring) + " |") | join("\n")) + "\n"'
```

## 详细统计数据 (记录于 2026-02-07)

### v1.0.1
**发布时间:** 2026-02-07
**版本总下载量:** 24

| 文件名 | 下载量 | 平台 |
| :--- | :--- | :--- |
| Skills.Manager_1.0.1_aarch64.dmg | 17 | macOS (Apple Silicon) |
| Skills.Manager_1.0.1_x64-setup.exe | 6 | Windows (安装程序) |
| Skills.Manager.app.zip | 1 | macOS (压缩包) |
| Skills.Manager_1.0.1_x64_en-US.msi | 0 | Windows (MSI) |
| Skills.Manager_1.0.1_amd64.deb | 0 | Linux (Debian/Ubuntu) |
| Skills.Manager_1.0.1_amd64.AppImage | 0 | Linux (通用) |
| Skills.Manager-1.0.1-1.x86_64.rpm | 0 | Linux (RedHat/Fedora) |

### v1.0.0
**发布时间:** 2026-02-07
**版本总下载量:** 139

| 文件名 | 下载量 | 平台 |
| :--- | :--- | :--- |
| Skills.Manager_1.0.0_x64-setup.exe | 60 | Windows (安装程序) |
| Skills.Manager_1.0.0_aarch64.dmg | 53 | macOS (Apple Silicon) |
| Skills.Manager_1.0.0_amd64.AppImage | 10 | Linux (通用) |
| Skills.Manager.app.zip | 5 | macOS (压缩包) |
| Skills.Manager_1.0.0_x64_en-US.msi | 4 | Windows (MSI) |
| Skills.Manager-1.0.0-1.x86_64.rpm | 4 | Linux (RedHat/Fedora) |
| Skills.Manager_1.0.0_amd64.deb | 3 | Linux (Debian/Ubuntu) |
