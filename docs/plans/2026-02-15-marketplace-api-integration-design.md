# Skills Marketplace 第三方 API 重构设计

**日期**: 2026-02-15  
**范围**: `Marketplace` 前端页面、Tauri marketplace 命令层与服务层、缓存层、配置层

---

## 1. 背景与约束

当前线上第三方接口 `https://skills-market-api.guardssl.info` 已提供：

1. `GET /api/v1/sources`
2. `GET /api/v1/skills`（分页 + 搜索 + sourceId）
3. `GET /api/v1/skills/all`（全量）

实测生产数据规模：

1. `total = 60158`
2. `/api/v1/skills/all` 单次响应约 `26.8MB`

这意味着“每次拉全量 + 本地搜索”的方案在首屏时延、内存占用、带宽成本、移动网络场景都不理想，且每 24h 刷新会重复付出大流量成本。

---

## 2. 两种方案对比与结论

### 方案 A：全量拉取并本地缓存（24h）

优点：

1. 本地搜索与筛选响应极快
2. 离线可继续搜索缓存数据

缺点：

1. 冷启动拉取体积过大（26.8MB+，且未来继续增长）
2. 首次解析和内存压力明显
3. 全量刷新成本高，失败时用户感知更明显

### 方案 B：分页拉取 + 页级缓存（24h）+ 搜索走远端 API

优点：

1. 首屏快，按需加载，网络/内存成本线性可控
2. 与 API 设计天然一致（分页 + 搜索 + sourceId）
3. 更适合 6 万级以上数据集的持续增长

缺点：

1. 搜索依赖在线请求（需做防抖与失败兜底）
2. 复杂度略高于全量缓存

### 最终决策

采用 **方案 B**。  
原因：在当前真实数据规模下，方案 B 的可扩展性、性能稳定性和用户体验综合收益明显高于方案 A。

---

## 3. 目标架构

### 3.1 数据流

1. 前端触发 `fetch_marketplace_skills(page, query, sourceIds, forceRefresh)`
2. 命令层优先命中本地页缓存（24h）
3. 未命中或强刷时调用第三方分页 API
4. 服务层将第三方字段映射为当前应用 `MarketplaceSkill`
5. 命令层补齐本地安装状态（`not_installed / installed / update_available`）
6. 回写页缓存与技能索引缓存，返回前端

### 3.2 缓存策略

缓存粒度：**页级**（`page + query + sourceFilter`）  
缓存 TTL：**24h**（内存 + 磁盘一致）  
持久化：`~/.skills-manager/cache/marketplace-skills.json`

缓存能力：

1. 缓存命中直接返回，避免重复网络请求
2. 网络失败时可回退到可用缓存（优先同 key，其次本地任意技能集合进行弱兜底）
3. 安装成功后清理 marketplace 列表缓存，防止安装状态脏读

---

## 4. 关键设计细节

### 4.1 第三方字段映射

远端模型（示例）：

1. `id, sourceId, slug, name, summary, installUrl, createdAt`
2. `source: { id, name, type }`

本地模型映射：

1. `description <- summary`
2. `source_id/source_name <- source`
3. `install_url <- installUrl`
4. 尝试从 `installUrl/slug` 推导 `repo_url` 与 `skill_path`，以复用现有详情预览与安装流程

### 4.2 安装策略

优先复用既有安装能力（GitHub 目录下载）：

1. 可解析 GitHub `repo + skill_path`：沿用现有安装逻辑
2. 无法解析：返回明确错误，引导用户通过外链手动安装

### 4.3 搜索与筛选

1. 搜索：前端输入防抖后调用分页 API（不再仅本地搜索已加载数据）
2. 来源筛选：沿用 source 过滤参数（单源精确过滤）
3. 本地仍允许对当前结果做轻量二次筛选（如 tags，若后续有）

---

## 5. 质量保证

测试重点：

1. 页缓存 24h 命中与过期行为
2. 远端字段映射与 GitHub 链接解析
3. 搜索触发远端请求、分页与缓存协同
4. 网络失败回退缓存行为

验收标准：

1. 功能上已完全切换到第三方 API，不再依赖仓库扫描拉取市场列表
2. 缓存 TTL 为 24h，重启后仍可命中
3. 搜索、分页、来源筛选在大数据量下保持可用与流畅
