# LLM 翻译功能设计

> Date: 2026-05-17
> Status: Draft（待审阅）

## 背景与目标

为 Skills Manager 增加一个可配置的大语言模型（LLM）接入能力，使用户可以：

1. 在"设置"页配置自己的 LLM 提供商（Base URL / API Key / Model）；
2. 对**已安装**的 skill 进行翻译（在 UI 中查看翻译后的 name / description / SKILL.md，不修改磁盘文件）；
3. 对**市场中尚未安装**的 skill 进行翻译（仅元数据：name / description / tags）。

## 关键决策（已确认）

| 决策项 | 选择 | 说明 |
|---|---|---|
| 翻译结果处理已安装 skill | **只在 UI 显示，不动磁盘** | 安全无副作用；不影响 AI 工具实际加载的内容 |
| 市场未安装 skill 的翻译触发方式 | **完全由用户手动触发** | 节约 token；不做后台预翻译 |
| API Key 存储方式 | **明文存 `config.json`** | 与现有 `github_token` 一致 |
| Provider 数量 | **只允许一个** | 简化数据模型与 UI |
| 协议 | **固定 OpenAI 兼容** | 覆盖 OpenAI / DeepSeek / Moonshot / Qwen / Ollama / vLLM 等 |

---

## 数据模型

### `src-tauri/src/models/config.rs` 新增

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmProvider {
    pub base_url: String,                  // 例: https://api.openai.com/v1
    pub api_key: String,                   // 明文存储
    pub model: String,                     // 例: gpt-4o-mini
    #[serde(default)]
    pub temperature: Option<f32>,          // 默认 0.3
    #[serde(default)]
    pub max_tokens: Option<u32>,           // 默认不限
    #[serde(default)]
    pub timeout_secs: Option<u32>,         // 默认 60s
}
```

### `AppConfig` 新增字段

```rust
#[serde(default)]
pub llm_provider: Option<LlmProvider>,
```

### 前端 `src/types/index.ts` 对应类型

```ts
export interface LlmProvider {
  base_url: string;
  api_key: string;
  model: string;
  temperature?: number | null;
  max_tokens?: number | null;
  timeout_secs?: number | null;
}

// AppConfig 增加：
//   llm_provider?: LlmProvider | null;
```

---

## 后端架构

### 新增文件

```
src-tauri/src/
├── commands/
│   └── llm.rs              # Tauri 命令入口
└── services/
    ├── llm.rs              # OpenAI 兼容 HTTP 客户端
    ├── translation.rs      # 翻译业务逻辑（prompt 构造、解析）
    └── translation_cache.rs # 文件级缓存
```

### `services/llm.rs`

封装 OpenAI 兼容的 chat completion 调用：

```rust
pub struct ChatMessage {
    pub role: &'static str, // "system" | "user"
    pub content: String,
}

pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    pub json_mode: bool,
}

pub async fn chat(
    provider: &LlmProvider,
    req: ChatRequest,
) -> Result<String, LlmError>;

pub enum LlmError {
    NotConfigured,
    NetworkError(String),
    Unauthorized,
    RateLimited,
    ServerError(u16, String),
    Timeout,
    ParseError(String),
}
```

请求体：

```json
{
  "model": "<provider.model>",
  "messages": [...],
  "temperature": 0.3,
  "max_tokens": 4096,
  "response_format": { "type": "json_object" }  // 仅 json_mode=true 时
}
```

错误码 → `LlmError` 映射：
- 网络/连接失败 → `NetworkError`
- 401 → `Unauthorized`
- 429 → `RateLimited`
- 5xx → `ServerError`
- 解析失败 → `ParseError`

### `services/translation.rs`

```rust
pub struct SkillTranslationInput {
    pub name: String,
    pub description: String,
    pub content_md: Option<String>,
}

pub struct SkillTranslationOutput {
    pub name: String,
    pub description: String,
    pub content_md: Option<String>,
    pub cached: bool,
}

pub async fn translate_skill(
    provider: &LlmProvider,
    target_lang: &str,            // "zh" | "en"
    input: SkillTranslationInput,
) -> Result<SkillTranslationOutput, LlmError>;
```

#### Prompt 模板

```
SYSTEM:
You translate developer-tool documentation to {target_lang_name}.
Preserve markdown formatting, code blocks, YAML frontmatter, and links.
Do NOT translate: code identifiers, YAML keys, file paths, URLs, or commands.
Reply ONLY with a JSON object matching the input shape.

USER:
{
  "name": "...",
  "description": "...",
  "content_md": "..."  // optional
}
```

JSON 模式优先；若解析失败，**不做文本兜底**，直接返回 `ParseError`（避免误改用户内容）。

### `services/translation_cache.rs`

缓存目录：`~/.skills-manager/cache/translations/`

缓存键：

```
sha256(
  provider.base_url + "|" +
  provider.model + "|" +
  target_lang + "|" +
  serde_json::to_string(&input)
)
```

文件格式：`<hash>.json`，内容即 `SkillTranslationOutput`（`cached` 字段在读取时设为 `true`）。

提供：
- `pub fn get(key: &str) -> Option<SkillTranslationOutput>`
- `pub fn put(key: &str, value: &SkillTranslationOutput) -> Result<()>`
- `pub fn clear() -> Result<()>`

### Tauri 命令（`commands/llm.rs`）

| 命令 | 签名 | 说明 |
|---|---|---|
| `get_llm_provider` | `() -> Option<LlmProvider>` | 读取当前配置 |
| `save_llm_provider` | `(provider: LlmProvider) -> Result<()>` | 写入 config |
| `clear_llm_provider` | `() -> Result<()>` | 删除配置 |
| `test_llm_provider` | `(provider: LlmProvider) -> Result<String>` | 不写入；发送一条最小 prompt 返回响应内容（用于"测试连接"） |
| `translate_skill` | `(skill_id: String, target_lang: String) -> Result<SkillTranslationOutput, String>` | 翻译已安装 skill（含 SKILL.md 全文） |
| `translate_marketplace_skill` | `(input: MarketplaceTranslationInput, target_lang: String) -> Result<SkillTranslationOutput, String>` | 仅翻译元数据 |
| `clear_translation_cache` | `() -> Result<()>` | 清空缓存 |

`MarketplaceTranslationInput` 由前端组装（包含 name + description；可选 tags 后续再加）。

### Cloud Sync 排除（重要）

`models/cloud_sync.rs` 在构建 `CloudSyncPayload` 时**不要**包含 `llm_provider`。api_key 不能进云端同步。需要：

- 检查 `services/cloud_sync.rs` 中构造 payload 的位置
- 显式跳过 `llm_provider` 字段

---

## 前端 UI

### 1. Settings 页新增"AI 翻译"区块

位置建议：放在"外观"区块之后、"同步"区块之前。

字段：

| 字段 | 控件 | 说明 |
|---|---|---|
| Base URL | text input | 占位符 `https://api.openai.com/v1` |
| API Key | password input + 显示/隐藏切换 | |
| Model | text input + 常用预设下拉 | 预设：`gpt-4o-mini` / `gpt-4o` / `deepseek-chat` / `qwen-plus` / `自定义` |
| 高级（折叠） | temperature / max_tokens / timeout_secs | 留空使用默认值 |

按钮：

- **测试连接** → 调 `test_llm_provider`，显示 toast（成功 + 返回内容片段 / 失败 + 错误码）
- **保存** → 调 `save_llm_provider`
- **清空配置** → 调 `clear_llm_provider`
- **清空翻译缓存** → 调 `clear_translation_cache`

### 2. Skills 卡片改造（`src/pages/Skills.tsx`）

每张卡片右上角动作菜单新增：

- **"翻译"** (UI 是英文则显示 "Translate to English"，反之 "翻译为中文")
- 翻译完成后，菜单项变为 **"显示原文"**
- 翻译态保存在内存中（`useTranslation` hook 维护 `Map<skillId, SkillTranslationOutput | "original">`）

点击行为：

1. 检查是否配置 LLM Provider；未配置 → toast "请先在设置中配置 AI 提供商" + 提供跳转 Settings 的按钮
2. 已配置 → 卡片显示 loading 覆盖层 → 调 `translate_skill` → 用返回结果覆盖渲染 name / description
3. 失败 → toast 显示错误码对应文案
4. 缓存命中 → 无 loading 直接渲染

> SKILL.md 全文翻译的展示位置：在 **Editor 页**打开 skill 时，若该 skill 已有翻译，顶部显示一个 banner："已翻译版本可用 / 显示原文 / 显示翻译"。

### 3. Marketplace 卡片改造（`src/pages/Marketplace.tsx`）

类似 Skills 卡片，但只翻译元数据（name / description）。点击 → 调 `translate_marketplace_skill` → 覆盖渲染。

### 4. 新 Hook

```ts
// src/hooks/useTranslation.ts
export function useTranslation() {
  return {
    isLlmConfigured: boolean,
    translateSkill(skillId: string): Promise<SkillTranslationOutput>,
    translateMarketplace(skill: MarketplaceSkill): Promise<SkillTranslationOutput>,
    showOriginal(key: string): void,
    getTranslation(key: string): SkillTranslationOutput | null,
  };
}
```

内部使用 React Context + 内存 Map 管理翻译态（页面切换不丢失）。

### 5. i18n 文案

`src/i18n/locales/zh.ts` 与 `en.ts` 同步添加：

```
settings.llm.title           = "AI 翻译" / "AI Translation"
settings.llm.description     = "配置用于翻译 Skill 内容的大语言模型"
settings.llm.baseUrl         = "Base URL"
settings.llm.baseUrlHint     = "OpenAI 兼容协议接口地址"
settings.llm.apiKey          = "API Key"
settings.llm.model           = "模型"
settings.llm.temperature     = "Temperature"
settings.llm.maxTokens       = "最大 Token 数"
settings.llm.timeout         = "超时（秒）"
settings.llm.test            = "测试连接"
settings.llm.testSuccess     = "连接成功"
settings.llm.testFailed      = "连接失败：{reason}"
settings.llm.save            = "保存"
settings.llm.clearConfig     = "清空配置"
settings.llm.clearCache      = "清空翻译缓存"
settings.llm.advanced        = "高级"

skills.translate             = "翻译"
skills.showOriginal          = "显示原文"
skills.translating           = "翻译中..."
skills.translateFailed       = "翻译失败：{reason}"
skills.llmNotConfigured      = "请先在设置中配置 AI 提供商"
skills.llmNotConfiguredCTA   = "前往设置"

llm.error.network            = "网络错误"
llm.error.unauthorized       = "API Key 无效"
llm.error.rateLimited        = "请求过于频繁"
llm.error.serverError        = "服务器错误（{code}）"
llm.error.timeout            = "请求超时"
llm.error.parseError         = "响应格式错误"
```

---

## 实施计划（拆 3 个 PR）

### PR1 — 后端骨架 + Settings 表单

**目标**：跑通配置 → 测试连接闭环。

- [ ] `models/config.rs`：新增 `LlmProvider` 结构与 `AppConfig.llm_provider` 字段
- [ ] `services/llm.rs`：实现 `chat()` 与 `LlmError`
- [ ] `commands/llm.rs`：实现 `get_llm_provider` / `save_llm_provider` / `clear_llm_provider` / `test_llm_provider`
- [ ] `lib.rs` 注册新命令
- [ ] **`services/cloud_sync.rs` 排除 `llm_provider` 字段**（关键安全点）
- [ ] `src/types/index.ts`：新增 `LlmProvider` 类型
- [ ] `src/pages/Settings.tsx`：新增"AI 翻译"区块 + 表单 + 测试连接按钮
- [ ] i18n 文案：`settings.llm.*` + `llm.error.*`
- [ ] 单测：`LlmError` 映射；config 序列化/反序列化包含/排除 `llm_provider`

### PR2 — 翻译核心 + Skills 卡片接入

- [ ] `services/translation.rs`：实现 `translate_skill()` 与 prompt 模板
- [ ] `services/translation_cache.rs`：文件缓存读写
- [ ] `commands/llm.rs`：实现 `translate_skill` / `clear_translation_cache`
- [ ] `src/hooks/useTranslation.ts`：新 Hook + Context
- [ ] `src/pages/Skills.tsx`：卡片菜单加"翻译 / 显示原文"
- [ ] `src/pages/Editor.tsx`：翻译 banner（可选，PR2 末尾或 PR3 处理）
- [ ] Settings 加"清空翻译缓存"按钮
- [ ] i18n 文案：`skills.translate*`
- [ ] 单测：缓存命中 / 缺失；prompt 模板快照测试

### PR3 — 市场接入

- [ ] `commands/llm.rs`：实现 `translate_marketplace_skill`
- [ ] `src/pages/Marketplace.tsx`：卡片接入翻译
- [ ] E2E：Marketplace → 翻译 → 安装 → Skills 列表自动复用翻译缓存（同一份 source text）
- [ ] 文档：在 README 或 CLAUDE.md 增加一段"AI 翻译"使用说明

---

## 风险与注意事项

1. **api_key 泄漏到云端**：必须在 cloud sync payload 构造处显式排除 `llm_provider`。建议加单测：`cloud_sync_payload_excludes_llm_provider`。
2. **token 消耗失控**：SKILL.md 全文可能很大。建议在 `translate_skill` 内对超长内容（如 > 32k chars）拒绝并提示用户。
3. **JSON 解析鲁棒性**：部分上游不支持 `response_format`。若解析失败直接返回 `ParseError`，不要尝试用正则切原文（误改风险）。
4. **并发翻译**：用户连点会发多请求。前端 Hook 内部用 promise 去重（同 key 复用进行中的 promise）。
5. **目标语言**：默认跟随 UI language。但 zh ↔ en 双向都要支持（中文 UI 用户也可能想看英文原内容；这通过"显示原文"按钮解决，无需双向翻译命令）。
6. **缓存目录权限**：复用 `~/.skills-manager/` 已有的目录创建逻辑，避免重复 mkdir 错误。

---

## 待审阅问题（已确认）

| 问题 | 决定 |
|---|---|
| PR 拆分 | **按当前 3 个 PR 拆分** |
| Editor 翻译 banner | **v1 就做**（纳入 PR2） |
| 批量翻译 | **v1 支持**（纳入 PR2） |
| 错误文案 | **可以详细**，但单条不超过 ~30 字符，避免撑破 toast |

---

## 补充设计（基于待审阅回复）

### Editor 翻译 banner（PR2 范围内）

`src/pages/Editor.tsx` 打开 SKILL.md 时：

- 若 `useTranslation` 中已有该 skill 的翻译缓存 → 顶部显示 banner：
  - 文案："已翻译版本可用" + 切换按钮"[显示翻译 / 显示原文]"
- 若**无**缓存 → banner 显示：「翻译为 {target_lang_name}」按钮 + 一行说明
- 翻译态切换时 Monaco Editor 内容随之刷新；**编辑动作只作用于原文文件**（翻译为只读视图，避免污染源文件）
- 进入翻译视图时编辑器置为 `readOnly: true`，顶部追加一行小提示："翻译视图为只读"

### 批量翻译（PR2 范围内）

**入口位置**：Skills 页顶部工具栏（已有"刷新"按钮的区域），新增 "翻译选中项"。

**交互**：

- 复用 Skills 已有的多选机制（若没有则需要新增 checkbox 选择态）；若现状无多选，则改为"翻译全部当前过滤结果"
- 点击 → 弹确认对话框：「将翻译 {N} 个 skill，预计消耗较多 token，是否继续？」
- 确认后 → 逐项调用 `translate_skill`，**串行执行**（避免触发 RateLimited），底部出现进度条 toast：「正在翻译 {i}/{N}: {name}」
- 失败项跳过并累计；完成后汇总 toast：「完成 {成功}/{总} 项，{失败} 失败」
- 中途可点击 toast 上的「取消」终止后续请求

**后端新增命令（PR2）**：

```rust
// commands/llm.rs
#[tauri::command]
pub async fn translate_skills_batch(
    skill_ids: Vec<String>,
    target_lang: String,
    app: AppHandle,
) -> Result<BatchTranslationResult, String>;

pub struct BatchTranslationResult {
    pub succeeded: Vec<String>,         // skill_id
    pub failed: Vec<BatchTranslationFailure>,
}

pub struct BatchTranslationFailure {
    pub skill_id: String,
    pub reason: String,
}
```

通过 Tauri event（如 `llm:batch-progress`）推送进度，前端订阅。

### 错误文案精简（统一 ≤ 30 字符）

| 错误 | 文案（中文） | 文案（英文） |
|---|---|---|
| NotConfigured | 请先配置 AI 提供商 | LLM not configured |
| NetworkError | 网络错误，请检查连接 | Network error |
| Unauthorized | API Key 无效或已过期 | Invalid API key |
| RateLimited | 请求过于频繁，请稍候 | Rate limit exceeded |
| ServerError | 服务异常 ({code}) | Server error ({code}) |
| Timeout | 请求超时 | Request timed out |
| ParseError | 响应格式异常 | Bad response format |
| BadBaseUrl | Base URL 格式错误 | Invalid Base URL |
| ContentTooLarge | 内容过长，无法翻译 | Content too large |

详细诊断信息（完整 server 返回体、堆栈等）**不写入 toast**，仅写入控制台 / 日志，便于排查但不破坏 UI。

### PR 清单更新

**PR2 增补项：**

- [ ] `commands/llm.rs`：`translate_skills_batch` 命令 + Tauri event 进度推送
- [ ] `src/pages/Skills.tsx`：批量翻译入口（含多选机制如果不存在则新增）
- [ ] `src/pages/Editor.tsx`：翻译 banner + 只读切换
- [ ] `src/components/`：进度 toast 组件（若 toast 系统不支持则扩展）
- [ ] i18n：批量翻译相关文案 + 精简版错误文案

**PR1 增补：** Base URL 格式校验（必须以 `http://` 或 `https://` 开头，去除末尾斜杠）。
