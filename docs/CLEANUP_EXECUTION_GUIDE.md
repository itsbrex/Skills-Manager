# Skills Manager 开源准备 - 完整改动清单

## 📊 执行摘要

| 项目 | 数值 |
|------|------|
| **总文件数** | 42 个 |
| 删除文件 | 27 个 |
| 修改文件 | 10 个 |
| 新增文件 | 5 个 |
| **代码变化** | |
| 删除代码 | ~3,000-4,000 行 |
| 修改代码 | ~200-300 行 |
| 新增文档 | ~500-600 行 |
| **预计工作量** | 6-7 小时 |

---

## 🎯 核心策略

### 移除的功能（后端依赖）
- ❌ OAuth 认证（GitHub/Google）
- ❌ 云同步（pull/push/resolve）
- ❌ 投票功能
- ❌ 遥测上报
- ❌ Vault 备份

### 保留的功能（本地核心）
- ✅ Skills 管理
- ✅ 软链接同步
- ✅ 内置编辑器
- ✅ AI 翻译（用户自带 API Key）
- ✅ 工具检测
- ✅ Marketplace 浏览
- ✅ 配置管理

### 改造的功能
- ⚠️ Feedback → 打开 GitHub Issues
- ⚠️ Updater → 使用公开 API（移除 github_token）
- ⚠️ Marketplace → 从公开源抓取（移除后端 API）

---

## 📋 快速导航

详细改动清单已生成：**`docs/COMPLETE_CHANGELOG.md`**

包含：
- **PART 1**: 后端文件删除清单（13 个文件）
- **PART 2**: 后端文件修改清单（6 个文件）
  - `commands/mod.rs`
  - `lib.rs`
  - `models/config.rs`（重点，约 100 行修改）
  - `models/mod.rs`
  - `services/mod.rs`
  - 改造文件（feedback.rs, updater.rs, marketplace.rs）
- **PART 3**: 前端文件删除清单（14 个文件）
- **PART 4**: 前端文件修改清单（4 个文件）
  - `App.tsx`（删除遥测初始化）
  - `Settings.tsx`（删除云设置，添加 Pro 占位）
  - `Sidebar.tsx`（删除认证 UI）
  - `types/index.ts`（删除类型定义）
- **PART 5**: 依赖清理（Cargo.toml）
- **PART 6**: 开源文档创建（5 个新文件）
  - README.md
  - LICENSE（MIT）
  - CONTRIBUTING.md
  - SECURITY.md
  - CHANGELOG.md
- **PART 7**: 验证清单

---

## 🚀 执行方案

### 方案 A：一次性执行（6-7 小时）
- 今天完成所有改动
- 适合时间充裕的情况

### 方案 B：分阶段执行（推荐）
**Day 1（2 小时）：后端清理**
- 删除后端文件
- 修改模块引用
- 修改 config.rs
- 编译测试

**Day 2（2 小时）：前端清理**
- 删除前端文件
- 修改 UI 组件
- 添加 Pro 占位
- 编译测试

**Day 3（2-3 小时）：文档与验证**
- 创建开源文档
- 完整验证测试
- 提交代码

### 方案 C：先试点再全面
- 先执行 Phase 1（备份）
- 然后执行一个小模块（如删除 polls）
- 测试通过后再执行其他模块

---

## 📂 文档清单

已为你生成的文档：

1. **`docs/OPENSOURCE_CLEANUP_PLAN.md`** - 清理计划概览
2. **`docs/CLEANUP_IMPACT_ANALYSIS.md`** - 影响分析报告
3. **`docs/COMPLETE_CHANGELOG.md`** - 完整改动清单（⭐ 最重要）
4. **`docs/OPEN_SOURCE_STRATEGY.md`** - 完整开源策略（1380 行）
5. **`docs/EXECUTIVE_SUMMARY.md`** - 执行摘要
6. **`src-tauri/src/features.rs`** - Feature Flag 系统（已实现）

---

## ✅ 关键检查点

执行前确认：

### 技术准备
- [ ] Git 分支已创建（`feat/opensource-cleanup`）
- [ ] 代码已备份到 `.private-features/`
- [ ] 开发环境正常（Rust 1.70+, Node 18+）

### 理解准备
- [ ] 已阅读 `docs/COMPLETE_CHANGELOG.md`
- [ ] 理解每个改动的原因
- [ ] 知道哪些功能会被移除

### 时间准备
- [ ] 预留 6-7 小时（或分 3 天）
- [ ] 每个阶段后有测试时间
- [ ] 有时间处理意外问题

---

## 🆘 如果遇到问题

### 编译错误
1. 检查是否有遗漏的导入删除
2. 搜索错误信息中的类型/函数名
3. 参考 `COMPLETE_CHANGELOG.md` 确认是否遗漏

### 功能异常
1. 检查是否删除了本该保留的文件
2. 查看 `git diff` 确认改动
3. 运行 `cargo test` 和 `npm test`

### 不确定是否删除
1. 搜索该文件/函数的所有引用
2. 如果只在云功能中使用 → 删除
3. 如果在本地功能中使用 → 保留并改造

---

## 📞 下一步行动

现在你可以：

1. **开始执行** - 从 Phase 1 备份开始
2. **继续审阅** - 打开 `docs/COMPLETE_CHANGELOG.md` 详细查看
3. **提问题** - 对任何改动有疑问都可以问我

我建议：
1. 先打开 `docs/COMPLETE_CHANGELOG.md` 浏览一遍
2. 特别关注 `models/config.rs` 的修改（约 100 行）
3. 然后决定是今天开始还是明天开始

准备好了吗？需要我帮你开始执行吗？
