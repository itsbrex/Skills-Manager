# Goal Prompt: Skills Manager 开源清理 - Phase 2（前端清理）

## 前提条件

✅ Phase 1（后端清理）已完成并通过验证

## 目标

删除前端所有与云功能相关的代码，包括认证、云同步、投票、遥测等 UI 和服务层代码。

## 详细任务清单

### Phase 1: 前端文件删除（预计 10 分钟）

**任务 1.1：删除云同步相关文件（9 个）**
```bash
# 组件
rm src/components/cloud/CloudSyncConflictDialog.tsx
rm src/components/cloud/VaultConsentDialog.tsx

# Hook
rm src/hooks/useCloudSyncAgent.tsx

# 服务
rm src/services/cloudSync.ts
rm src/services/cloudSyncSettingsOptions.ts
rm src/services/cloudSyncSettingsOptions.test.ts
rm src/services/cloudSyncSettingsStore.ts
rm src/services/cloudSyncSettingsStore.test.ts
rm src/services/cloudSyncUtils.ts
rm src/services/cloudSyncWorkflow.ts

# 测试
rm src/services/__tests__/cloudSyncUtils.test.ts
```

验证：
```bash
# 应该报 "No such file"
ls src/components/cloud/CloudSyncConflictDialog.tsx 2>&1
ls src/services/cloudSync.ts 2>&1
```

**任务 1.2：删除认证相关文件（5 个）**
```bash
rm src/services/auth.ts
rm src/services/authError.ts
rm src/services/authError.test.ts
rm src/services/authProfileStore.ts
rm src/services/authProfileStore.test.ts
```

验证：
```bash
# 应该报 "No such file"
ls src/services/auth.ts 2>&1
```

**任务 1.3：删除投票服务文件（如果存在）**
```bash
# 检查是否存在
ls src/services/polls.ts 2>&1

# 如果存在，删除
rm src/services/polls.ts
```

---

### Phase 2: 修改 App.tsx（预计 20 分钟）

**任务 2.1：删除遥测初始化代码**

在 `src/App.tsx` 中查找并删除以下代码块：

**位置 1：初始化时的遥测调用（约第 102-107 行）**
```typescript
// 删除这段
void invoke("telemetry_initialize").catch(() => {
    // Silent fail
});
void invoke("telemetry_clear_local_data").catch(() => {
    // Silent fail
});
```

**位置 2：useEffect 中的遥测代码（约第 138-169 行）**
```typescript
// 删除整个 useEffect 块
useEffect(() => {
    void invoke("telemetry_initialize").catch(() => {
        // Silent fail
    });
    
    const heartbeatInterval = setInterval(() => {
        void invoke("telemetry_flush_pending").catch(() => {});
    }, 600_000);
    
    const recordHeartbeat = setInterval(() => {
        void invoke("telemetry_record_heartbeat").catch(() => {});
    }, 60_000);
    
    const flushOnUnload = () => {
        void invoke("telemetry_flush_pending").catch(() => {});
    };
    
    const endSessionOnUnload = async (reason: string) => {
        try {
            await invoke("telemetry_end_session", { reason });
        } catch {
            // Silent fail
        }
    };
    
    window.addEventListener("beforeunload", flushOnUnload);
    
    return () => {
        clearInterval(heartbeatInterval);
        clearInterval(recordHeartbeat);
        window.removeEventListener("beforeunload", flushOnUnload);
        void endSessionOnUnload("app_close");
    };
}, []);
```

**任务 2.2：删除深度链接监听器（如果有）**

搜索并删除与 `auth:deep-link-argv` 相关的代码：
```bash
grep -n "auth:deep-link" src/App.tsx
```

如果找到，删除相关监听器代码。

验证：
```bash
# 不应该有遥测调用
grep -n "telemetry" src/App.tsx
# 应该返回空

# 不应该有认证深度链接
grep -n "auth:deep-link" src/App.tsx
# 应该返回空
```

---

### Phase 3: 修改 Settings.tsx（预计 30 分钟）

**任务 3.1：删除遥测设置代码**

在 `src/pages/Settings.tsx` 中查找并删除：

```typescript
// 删除遥测初始化
void invoke("telemetry_initialize").catch((err) => {
    console.error("Failed to initialize telemetry:", err);
});
void invoke("telemetry_clear_local_data").catch((err) => {
    console.error("Failed to clear telemetry data:", err);
});
```

**任务 3.2：删除云同步设置 UI**

搜索包含以下关键词的卡片组件并删除：
- "云同步"
- "Cloud Sync"
- "cloudSync"
- "auto_sync"（自动同步设置）

```bash
# 查找位置
grep -n "云同步\|Cloud Sync\|cloudSync" src/pages/Settings.tsx
```

删除整个卡片组件（通常是 `<Card>...</Card>` 块）。

**任务 3.3：删除 Vault 同意对话框**

搜索 `VaultConsentDialog` 并删除：
```bash
grep -n "VaultConsentDialog" src/pages/Settings.tsx
```

删除导入和使用该组件的代码。

**任务 3.4：删除认证相关 UI**

搜索以下内容并删除：
- 用户头像
- 登录按钮
- "登录" / "Login"
- "logout" / "注销"

**任务 3.5：添加 Pro 功能占位 UI**

在设置页面添加新的 Pro 功能介绍卡片：

```typescript
{/* Pro 功能占位 - 添加到设置页面适当位置 */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Sparkles className="h-5 w-5" />
      Pro 功能
    </CardTitle>
    <CardDescription>
      即将推出的高级功能
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center">
      <h3 className="font-semibold mb-2">☁️ 云同步</h3>
      <p className="text-sm text-muted-foreground mb-4">
        多设备无缝同步您的 Skills 配置
      </p>
      <Badge variant="secondary">开发中</Badge>
    </div>
    
    <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center">
      <h3 className="font-semibold mb-2">👥 团队协作</h3>
      <p className="text-sm text-muted-foreground mb-4">
        与团队成员共享和管理 Skills
      </p>
      <Badge variant="secondary">开发中</Badge>
    </div>

    <div className="rounded-lg border border-dashed border-muted-foreground/25 p-6 text-center">
      <h3 className="font-semibold mb-2">🚀 无限翻译</h3>
      <p className="text-sm text-muted-foreground mb-4">
        AI 翻译无速率限制
      </p>
      <Badge variant="secondary">开发中</Badge>
    </div>
  </CardContent>
</Card>
```

验证：
```bash
# 不应该有云同步相关代码
grep -n "cloudSync\|cloud_sync" src/pages/Settings.tsx
# 应该返回空或只有注释

# 应该有 Pro 功能占位
grep -n "Pro 功能\|开发中" src/pages/Settings.tsx
# 应该找到新添加的代码
```

---

### Phase 4: 修改 Sidebar.tsx（预计 15 分钟）

**任务 4.1：删除用户头像/认证按钮**

在 `src/components/layout/Sidebar.tsx` 中：

搜索以下内容并删除：
```bash
grep -n "AuthContext\|useAuth\|avatar\|login\|logout" src/components/layout/Sidebar.tsx
```

删除：
- `AuthContext` 导入
- `useAuth` Hook 调用
- 用户头像组件
- 登录/登出按钮

**任务 4.2：删除云同步状态指示器**

搜索并删除：
- "同步中" / "Syncing"
- "已同步" / "Synced"
- 云同步图标
- 同步状态徽章

验证：
```bash
# 不应该有认证相关代码
grep -n "auth\|login\|logout" src/components/layout/Sidebar.tsx
# 应该返回空或只有注释
```

---

### Phase 5: 修改类型定义（预计 15 分钟）

**任务 5.1：清理 src/types/index.ts**

删除以下类型定义（如果存在）：

```typescript
// 删除认证类型
export interface AuthSession { ... }
export interface AuthProfile { ... }
export interface AuthStartResult { ... }
export interface AuthMeResponse { ... }

// 删除云同步类型
export interface CloudSyncPayload { ... }
export interface CloudSyncSnapshot { ... }
export interface CloudSyncPushResult { ... }
export interface CloudSyncState { ... }
export interface CloudSyncConflict { ... }

// 删除投票类型
export interface Poll { ... }
export interface PollOption { ... }
export interface PollClientState { ... }
export interface PollVote { ... }

// 删除 Vault 类型
export interface VaultBackupResult { ... }
export interface VaultMeta { ... }

// 删除遥测类型（如果有）
export interface TelemetryEvent { ... }
```

**保留所有本地功能类型：**
- ✅ Config 相关
- ✅ Skill 相关
- ✅ Tool 相关
- ✅ MarketplaceSkill 相关
- ✅ LlmProvider 相关
- ✅ Editor 相关

验证：
```bash
# 不应该有云功能类型
grep -E "(AuthSession|CloudSync|Poll|Vault|Telemetry)" src/types/index.ts
# 应该返回空
```

---

### Phase 6: 前端编译验证（预计 10 分钟）

**任务 6.1：类型检查**
```bash
npm run typecheck
```

**预期结果：** ✅ 无类型错误

如果有错误：
1. 检查错误信息中的类型名
2. 搜索该类型的使用位置
3. 删除或注释掉相关代码
4. 重新检查

**任务 6.2：编译前端**
```bash
npm run build
```

**预期结果：** ✅ 构建成功

**任务 6.3：Lint 检查**
```bash
npm run lint
```

**预期结果：** ✅ 无 lint 错误

**任务 6.4：搜索残留引用**
```bash
# 搜索前端代码中的云功能引用
grep -r "cloudSync\|authProfile\|telemetry\|vault_backup" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

**预期结果：** ✅ 无残留引用（或只有注释）

---

### Phase 7: 完整应用测试（预计 20 分钟）

**任务 7.1：启动开发服务器**
```bash
npm run tauri dev
```

**预期结果：** ✅ 应用启动成功，无控制台错误

**任务 7.2：手动功能测试**

测试以下功能是否正常：

- [ ] 应用启动成功
- [ ] 首页正常显示
- [ ] Skills 列表正常加载
- [ ] 可以启用/禁用 Skill
- [ ] 编辑器可以打开
- [ ] AI 翻译功能正常（输入自己的 API Key）
- [ ] Marketplace 可以浏览
- [ ] 设置页面正常显示
- [ ] Pro 功能占位显示正常
- [ ] ❌ 无云同步按钮
- [ ] ❌ 无登录/用户头像
- [ ] ❌ 无遥测相关 UI

**任务 7.3：检查控制台**

打开开发者工具控制台，检查：
- ✅ 无错误信息
- ✅ 无 "command not found" 错误（说明前端在调用已删除的后端命令）
- ✅ 无类型错误

---

### Phase 8: 提交代码（预计 5 分钟）

**任务 8.1：查看改动**
```bash
git status
git diff --stat
```

**预期改动：**
- 删除 14 个前端文件
- 修改 4 个前端文件

**任务 8.2：提交**
```bash
git add -A
git commit -m "refactor: remove cloud features from frontend

- Remove auth components and services
- Remove cloud sync UI and services  
- Remove polls service
- Remove telemetry tracking
- Remove vault consent dialog
- Update Settings page (remove cloud settings, add Pro placeholder)
- Update App.tsx (remove telemetry initialization)
- Update Sidebar (remove auth UI)
- Clean up type definitions

All local features remain functional.
"
```

---

## 成功标准

### 必须满足

- [ ] 所有列出的文件已删除（14 个）
- [ ] App.tsx 已清理（无遥测代码）
- [ ] Settings.tsx 已清理并添加 Pro 占位
- [ ] Sidebar.tsx 已清理（无认证 UI）
- [ ] types/index.ts 已清理（无云类型）
- [ ] `npm run typecheck` 通过
- [ ] `npm run build` 成功
- [ ] `npm run lint` 无错误
- [ ] `npm run tauri dev` 启动成功
- [ ] 手动功能测试全部通过
- [ ] Git 提交完成

### 验证命令

```bash
# 1. 确认文件已删除
ls src/services/auth.ts 2>&1 | grep "No such file"
ls src/services/cloudSync.ts 2>&1 | grep "No such file"
ls src/components/cloud/CloudSyncConflictDialog.tsx 2>&1 | grep "No such file"

# 2. 确认无残留引用
grep -r "cloudSync\|authProfile" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | wc -l
# 应该返回 0

# 3. 确认类型检查通过
npm run typecheck 2>&1 | grep "Found 0 errors"
# 应该看到 "Found 0 errors"

# 4. 确认构建成功
npm run build 2>&1 | tail -5 | grep "built in"
# 应该看到构建完成信息
```

---

## 时间估算

- Phase 1（删除文件）：10 分钟
- Phase 2（App.tsx）：20 分钟
- Phase 3（Settings.tsx）：30 分钟
- Phase 4（Sidebar.tsx）：15 分钟
- Phase 5（types）：15 分钟
- Phase 6（编译验证）：10 分钟
- Phase 7（测试）：20 分钟
- Phase 8（提交）：5 分钟

**总计：约 2 小时**

---

## 参考文档

完整改动清单：`docs/COMPLETE_CHANGELOG.md`（PART 3-4）

---

## 注意事项

1. **Settings.tsx 需要仔细操作** - 删除云设置的同时要添加 Pro 占位
2. **保持应用可用** - 确保删除 UI 后应用仍然可用
3. **测试每个改动** - 每修改一个文件就保存并检查控制台
4. **Pro 占位要醒目** - 让用户知道这些功能在开发中

---

## 完成后下一步

Phase 2（前端清理）完成后：
- Phase 3：文档创建与最终验证（约 2-3 小时）

或者休息一下，明天继续 😊
