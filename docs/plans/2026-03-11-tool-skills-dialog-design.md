# Tool->Skills 弹窗与卡片入口设计

日期：2026-03-11

## 背景
当前 Skills 页面提供“Skill -> Tools”的启用/禁用弹窗，但 Tools 页面没有等价的“Tool -> Skills”入口。用户希望在工具卡片的开关左侧增加图标按钮，点击后弹出 Skills 列表，并复用 Skills 栏目的工具弹窗样式与交互。

## 目标
- 在工具卡片的开关左侧新增“技能管理”图标按钮。
- 点击按钮弹出与 Skills 页面风格一致的弹窗，展示该工具下的 Skills 列表与启用状态。
- 工具未检测到或未启用时，按钮禁用不可点击。
- 弹窗支持搜索、仅看已启用、批量开启/关闭、单个切换。

## 非目标
- 不改变后端接口与数据结构。
- 不新增全局权限或同步策略。

## 方案概述
- 抽取 Skills 页的 `SkillToolsDialog` 为可复用组件（暂定 `RelationToggleDialog`），放入 `src/components/skills/`。
- `RelationToggleDialog` 只负责 UI 与交互布局，通过 props 接收数据、状态与回调。
- Skills 页用适配层传入“skill -> tools”的数据。
- Tools 页新增适配层，传入“tool -> skills”的数据与回调。

## 交互与文案
- Tools 弹窗标题：`配置启用 Skills`。
- 描述：`{tool} 已启用 {enabled}/{total} 个 Skills`。
- 搜索框、仅看已启用、批量按钮、列表布局、完成按钮与 Skills 弹窗保持一致。

## 数据流与状态
- Tools 页面新增 `skills` 状态，通过 `list_skills`/`refresh_skills` 拉取。
- 弹窗内：
  - `enabledMap` 从 `skills[].enabled[toolId]` 反向读取。
  - 单项切换：调用 `enable_skill` / `disable_skill`。
  - 批量切换：按当前筛选结果批量调用相同接口。
- 任何切换后刷新 `skills` 与 `tools`，保持一致性。

## 错误处理
- 接口失败统一使用 toast 提示并回滚本地状态（与 Skills 页一致）。
- 工具未检测到或被禁用时，入口按钮禁用、弹窗不可打开。

## 测试与验证
- 现有单元测试无需改动；必要时补充“tool->skills”排序与批量逻辑单测（可后续补）。
- 手动验证：
  - 打开工具弹窗，搜索/仅看已启用/批量开关/单项切换。
  - 工具未检测到或禁用时，入口不可点击。

## 迁移与兼容
- 组件抽取不改变现有行为；Skills 页面功能保持不变。
