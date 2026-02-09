# 刷新成功 Toast 设计

## 背景
Skills 页面与 Tools 页面顶部都有“刷新”按钮，但目前只有数据刷新动作，没有显式成功反馈。用户在手动刷新后需要一个明确、统一的“刷新成功”提示，并且需要支持中英文多语言。

## 目标
- 手动点击“刷新”按钮后显示成功 toast。
- 仅在手动刷新时提示，初次加载或其它自动刷新不提示。
- 文案走 i18n，支持中英文。
- 保持当前页面结构与交互风格，避免引入全局改造。

## 非目标
- 不新增加载态/进度条或刷新失败 toast（仍使用现有错误提示逻辑）。
- 不引入全局 toast 管理或新依赖。
- 不改变其他操作（如路径编辑、开关工具）后的提示行为。

## 方案概述
采用页面内 toast 方案：在 Skills 与 Tools 页面各自使用现有 toast 组件进行成功提示。为避免“自动刷新”触发提示，在刷新数据的函数中加入 `manual` 标记，只有手动触发时才调用 `addToast`。

## 交互与数据流
- Skills 页面：`RefreshButton` 点击 -> `fetchData({ manual: true })` -> 数据刷新成功后弹出 toast。
- Tools 页面：`RefreshButton` 点击 -> `detectTools({ manual: true })` -> 数据刷新成功后弹出 toast。
- 其他路径（页面初次加载、路径编辑后调用刷新）不传 `manual`，因此不提示。

## 国际化
在 `common` 里新增 `refreshSuccess` 文案：
- 英文：`Refresh successful`
- 中文：`刷新成功`

## 错误处理
维持现有错误处理逻辑：
- Skills 页面使用 `addToast(..., "error")`。
- Tools 页面使用页面顶部错误 `Alert`。
失败时不显示“刷新成功”提示，避免误导。

## 测试
以最小验证为目标：
- 断言中英文 `refreshSuccess` 文案存在。
- 断言 Skills/Tools 页面使用 `t("common.refreshSuccess")`。
- 断言 Tools 页面包含 `ToastContainer`。

