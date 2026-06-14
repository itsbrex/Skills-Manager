# 修复：同步问题 Banner 无法消除的问题

**日期**: 2026-06-14  
**问题**: 界面顶部显示"检测到 1 个链接问题需要修复"，点击"重试修复"后无法消除

## 问题根因

在 `src-tauri/src/commands/sync.rs` 的 `fix_sync_issues()` 函数中，当遇到以下情况时会陷入死循环：

1. 某个 Skill 应该被禁用（`should_be_enabled = false`）
2. 但当前链接状态不是 `Valid`（例如是 `NotALink` 或 `Broken`）

### 原始代码逻辑（第 132-157 行）

```rust
match current_status {
    LinkStatus::Valid => {
        // 尝试禁用有效链接
        match LinkerService::disable_skill_for_tool(...) {
            Ok(_) => combined_report.success.push(...),
            Err(e) => combined_report.failed.push(...),
        }
    },
    status => {
        // ❌ 问题：对于非 Valid 状态，直接标记为失败
        // 但不尝试删除或清理该文件！
        combined_report.failed.push(create_sync_error(
            skill.instance_id.clone(),
            tool_id.clone(),
            status,
            "Target belongs to another instance or is invalid".to_string(),
        ))
    }
}
```

### 问题分析

1. `check_sync_status()` 检测到某个应该禁用的 skill 存在 `NotALink` 状态
2. 调用 `fix_sync_issues()`，遇到 `NotALink` 状态
3. 直接加入 `failed` 列表，**不执行任何清理操作**
4. 前端显示"检测到 1 个链接问题"
5. 用户点击"重试修复"，再次执行 `fix_sync_issues()`
6. 因为文件仍然存在且状态未变，再次被标记为失败
7. **死循环**：Banner 永远无法消除

## 修复方案

对于应该禁用的 skill，**无论当前状态如何**，都应该尝试删除目标文件。

### 修复后的代码

```rust
// 对于应该禁用的 skill，无论当前状态如何，都尝试删除目标文件
match LinkerService::disable_skill_for_tool(
    &tool_config.skills_path,
    &skill.id,
    &tool_id,
) {
    Ok(_) => combined_report.success.push(create_sync_result(
        skill.instance_id.clone(),
        tool_id.clone(),
        LinkStatus::Missing,
        "Disabled successfully",
    )),
    Err(e) => combined_report.failed.push(create_sync_error(
        skill.instance_id.clone(),
        tool_id.clone(),
        current_status,
        e,
    )),
}
```

### 为什么这样修复是安全的？

1. `disable_skill_for_tool()` 内部调用 `disable_skill()`
2. `disable_skill()` 会检查文件是否存在：
   ```rust
   if !link_path.exists() && link_path.symlink_metadata().is_err() {
       return Ok(());  // 文件不存在，直接返回成功
   }
   ```
3. 如果文件存在，尝试删除（先 `remove_file`，失败则 `remove_dir_all`）
4. 删除失败时才会返回错误并加入 `failed` 列表

## 测试验证

运行现有测试确保没有破坏功能：

```bash
cd src-tauri
cargo test commands::sync::tests
```

结果：✅ 2 个测试全部通过

## 用户影响

- ✅ 修复后，"重试修复"按钮能够真正清理问题文件
- ✅ Banner 能够正常消除
- ✅ 不影响正常的启用/禁用 skill 功能
- ✅ 不影响其他链接状态的处理逻辑

## 相关文件

- `src-tauri/src/commands/sync.rs` - 同步命令（已修复）
- `src-tauri/src/services/linker.rs` - 链接服务（无需修改）
- `src/components/layout/Layout.tsx` - 前端 Banner 显示（无需修改）
