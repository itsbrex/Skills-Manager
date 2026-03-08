# 客户端 Telemetry 接口设计（Cloudflare Workers + D1）

**日期**: 2026-03-07  
**适用范围**: Tauri 桌面客户端会话监控首期建设  
**部署约束**: 服务端部署在 Cloudflare Workers，数据库使用 D1  
**目标读者**: 接口提供方、服务端开发、客户端开发

---

## 1. 结论先行

由于接口提供方运行在 **Cloudflare Workers + D1**，之前的 PostgreSQL 版设计需要改成以下实现方式：

1. 数据库按 **SQLite / D1** 方言设计，不再使用 `timestamptz`、`jsonb`、`inet`
2. 所有写入接口由 Worker 提供，数据库写入通过 `env.DB.prepare(...).bind(...).run()` 或 `env.DB.batch([...])`
3. 批量入库使用 `env.DB.batch([...])`，因为 D1 官方说明 `batch()` 会把批量语句作为事务顺序执行，失败时回滚整个序列
4. 会话超时转 `abandoned` 通过 Worker 的 `scheduled()` + Cron Trigger 完成
5. 由于 D1 单库串行处理查询，且每次 Worker 调用可执行的 D1 查询数有限，首版必须控制单次批量大小，不宜沿用传统服务端的“大包上传”

---

## 2. Cloudflare 约束下的架构建议

### 2.1 推荐部署形态

建议接口提供方使用一个独立的 telemetry Worker 和一个独立的 telemetry D1 数据库：

1. `POST /api/v1/telemetry/ingest`
   1. 给客户端写入 session / event

2. `GET /api/v1/internal/telemetry/*`
   1. 给内部查看、报表或 BI 使用

3. `scheduled()`
   1. 处理超时会话转 `abandoned`
   2. 可选做历史数据清理和日聚合

### 2.2 为什么建议单独 D1 数据库

Cloudflare D1 官方文档说明每个数据库本质上是单线程处理查询，吞吐受查询时长影响明显。  
因此 telemetry 写入不建议和主业务库混用，否则埋点高峰可能与业务查询互相影响。

---

## 3. 首期范围

首期只实现 session 级数据，先满足以下指标：

1. 软件每次启动时间
2. 软件每次关闭时间
3. 单次打开时长
4. 每日启动次数
5. 每日活跃安装数
6. 异常退出率

首期仍建议预留通用事件表，方便后续扩展：

1. 功能使用次数
2. 页面访问
3. 错误事件
4. 版本发布后的行为变化

---

## 4. 时间与标识约定

### 4.1 时间格式

推荐客户端请求里直接传 **UTC Unix epoch seconds**，不要传本地时区时间字符串。

原因：

1. D1 是 SQLite 方言，`INTEGER` 时间戳存储与比较最直接
2. 避免时区、字符串解析和序列化差异
3. 体积更小，便于客户端批量上报

示例：

1. `1741338000`
2. 含义：UTC 秒级时间戳

### 4.2 标识

客户端需要提供：

1. `install_id`
   1. 一次安装实例的稳定匿名标识
   2. 首次启动生成 UUID 并持久化在本地

2. `session_id`
   1. 一次启动会话的唯一标识
   2. 每次启动生成新的 UUID

3. `user_id`
   1. 后续若产品有登录体系可上传
   2. 当前可为空

---

## 5. D1 设计原则

### 5.1 批量大小

Cloudflare D1 官方文档显示：

1. Workers Free 计划下每次 Worker 调用最多 50 个 D1 查询
2. Workers Paid 计划下每次 Worker 调用最多 1000 个 D1 查询
3. 每条 SQL 最多 100 个绑定参数
4. D1 单库串行处理查询，过高并发会返回 overloaded 错误

因此本方案首版建议：

1. `sessions` 每次请求最多 **20 条**
2. `events` 每次请求最多 **20 条**
3. 单次请求体控制在 **256KB** 以内

说明：

1. 这个限制是为了同时兼容 Free / Paid，并减轻 D1 排队压力
2. 如果接口方确认生产环境是 Workers Paid 且压测通过，可后续提升到 `50`

### 5.2 入库方式

一个 ingest 请求建议在 Worker 中按以下顺序构建语句并调用 `env.DB.batch([...])`：

1. `telemetry_ingest_requests` 插入请求审计记录
2. `telemetry_installations` upsert
3. `telemetry_sessions` upsert 若干条
4. `telemetry_events` insert / ignore 若干条

这样可以减少 Worker 到 D1 的网络往返，并利用 D1 `batch()` 的事务语义保证一致性。

---

## 6. D1 表结构

推荐至少创建以下 4 张表：

1. `telemetry_installations`
2. `telemetry_sessions`
3. `telemetry_events`
4. `telemetry_ingest_requests`

### 6.1 `telemetry_installations`

```sql
create table if not exists telemetry_installations (
  install_id text primary key,
  first_seen_at integer not null,
  last_seen_at integer not null,
  first_app_version text not null,
  last_app_version text not null,
  platform text not null,
  os_version text,
  first_user_id text,
  last_user_id text,
  created_at integer not null,
  updated_at integer not null
);

create index if not exists idx_installations_last_seen_at
  on telemetry_installations (last_seen_at);
```

### 6.2 `telemetry_sessions`

```sql
create table if not exists telemetry_sessions (
  session_id text primary key,
  install_id text not null,
  user_id text,
  app_version text not null,
  platform text not null,
  os_version text,
  started_at integer not null,
  last_seen_at integer not null,
  ended_at integer,
  duration_seconds integer not null,
  session_status text not null check (session_status in ('active', 'ended', 'abandoned')),
  end_reason text,
  heartbeat_interval_secs integer not null,
  first_ingested_at integer not null,
  last_ingested_at integer not null,
  created_at integer not null,
  updated_at integer not null,
  foreign key (install_id) references telemetry_installations(install_id),
  check (started_at <= last_seen_at),
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists idx_sessions_started_at
  on telemetry_sessions (started_at);

create index if not exists idx_sessions_install_started
  on telemetry_sessions (install_id, started_at);

create index if not exists idx_sessions_status_started
  on telemetry_sessions (session_status, started_at);

create index if not exists idx_sessions_version_started
  on telemetry_sessions (app_version, started_at);
```

### 6.3 `telemetry_events`

`properties` 在 D1 中建议用 `TEXT` 保存 JSON 字符串，并用 `json_valid()` 约束：

```sql
create table if not exists telemetry_events (
  event_id text primary key,
  install_id text not null,
  session_id text,
  user_id text,
  event_name text not null,
  event_time integer not null,
  app_version text not null,
  platform text not null,
  properties text not null default '{}' check (json_valid(properties)),
  first_ingested_at integer not null,
  created_at integer not null,
  foreign key (install_id) references telemetry_installations(install_id),
  foreign key (session_id) references telemetry_sessions(session_id)
);

create index if not exists idx_events_name_time
  on telemetry_events (event_name, event_time);

create index if not exists idx_events_install_time
  on telemetry_events (install_id, event_time);

create index if not exists idx_events_session_time
  on telemetry_events (session_id, event_time);
```

### 6.4 `telemetry_ingest_requests`

```sql
create table if not exists telemetry_ingest_requests (
  request_id text primary key,
  install_id text,
  user_id text,
  schema_version integer not null,
  sessions_count integer not null default 0,
  events_count integer not null default 0,
  processing_result text not null,
  error_message text,
  source_ip text,
  user_agent text,
  received_at integer not null
);

create index if not exists idx_ingest_requests_received_at
  on telemetry_ingest_requests (received_at);
```

---

## 7. 写入接口设计

### 7.1 `POST /api/v1/telemetry/ingest`

用途：

1. 客户端批量上传 session
2. 后续复用同一接口上传业务事件

请求头建议：

```http
Content-Type: application/json
X-Ingest-Key: <public-write-key>
X-Request-Id: <uuid>
```

说明：

1. `X-Ingest-Key` 只是公开写入 key，不是强安全凭证
2. Workers 侧仍需做 IP / install_id 限流
3. 管理端 key 不要放到客户端里

请求体示例：

```json
{
  "schema_version": 1,
  "request_id": "f8e2ed1c-56a6-40f9-8cc2-043f0d77d9d2",
  "sent_at": 1741339200,
  "client": {
    "install_id": "b61d2813-f43d-4542-a438-099416bf4444",
    "user_id": null,
    "platform": "macos",
    "os_version": "15.3.1",
    "app_version": "1.1.5"
  },
  "sessions": [
    {
      "session_id": "968e8b89-2d48-4602-b5db-2d9f3fbe834f",
      "started_at": 1741338000,
      "last_seen_at": 1741339140,
      "ended_at": null,
      "end_reason": null,
      "heartbeat_interval_secs": 60
    }
  ],
  "events": []
}
```

字段规则：

1. `schema_version`
   1. 当前固定为 `1`

2. `request_id`
   1. 一次上传请求唯一 ID
   2. 用于审计与排错

3. `sessions`
   1. 当前首期至少支持 1 条
   2. 最多建议 20 条

4. `events`
   1. 首期允许为空数组
   2. 后续可以复用

成功响应示例：

```json
{
  "request_id": "f8e2ed1c-56a6-40f9-8cc2-043f0d77d9d2",
  "accepted": true,
  "server_time": 1741339200,
  "sessions_upserted": 1,
  "events_inserted": 0,
  "duplicate_events_ignored": 0
}
```

失败响应示例：

```json
{
  "request_id": "f8e2ed1c-56a6-40f9-8cc2-043f0d77d9d2",
  "accepted": false,
  "error_code": "INVALID_PAYLOAD",
  "message": "sessions[0].started_at must be earlier than last_seen_at"
}
```

状态码建议：

1. `202`
   1. 成功接收并入库

2. `400`
   1. JSON 结构错误

3. `401` / `403`
   1. 写入 key 无效

4. `413`
   1. 请求体过大

5. `422`
   1. 业务校验未通过

6. `429`
   1. 超过限流阈值

7. `500`
   1. Worker 或 D1 内部异常

---

## 8. D1 Upsert 规则

### 8.1 `telemetry_installations`

规则：

1. `first_seen_at = min(existing, incoming)`
2. `last_seen_at = max(existing, incoming)`
3. `first_app_version` 保留首次值
4. `last_app_version` 更新为最新值
5. `last_user_id` 使用最近一次非空值

参考 SQL：

```sql
insert into telemetry_installations (
  install_id,
  first_seen_at,
  last_seen_at,
  first_app_version,
  last_app_version,
  platform,
  os_version,
  first_user_id,
  last_user_id,
  created_at,
  updated_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict(install_id) do update set
  first_seen_at = min(telemetry_installations.first_seen_at, excluded.first_seen_at),
  last_seen_at = max(telemetry_installations.last_seen_at, excluded.last_seen_at),
  last_app_version = excluded.last_app_version,
  platform = excluded.platform,
  os_version = excluded.os_version,
  last_user_id = coalesce(excluded.last_user_id, telemetry_installations.last_user_id),
  updated_at = excluded.updated_at;
```

### 8.2 `telemetry_sessions`

规则：

1. `started_at = min(existing, incoming)`
2. `last_seen_at = max(existing, incoming)`
3. `ended_at` 保留更晚且非空的值
4. `duration_seconds`
   1. 若 `ended_at` 存在，用 `ended_at - started_at`
   2. 否则用 `last_seen_at - started_at`
5. `session_status`
   1. 有 `ended_at` 时为 `ended`
   2. 否则保持 `active`
   3. `abandoned` 只由定时任务修改

参考 SQL：

```sql
insert into telemetry_sessions (
  session_id,
  install_id,
  user_id,
  app_version,
  platform,
  os_version,
  started_at,
  last_seen_at,
  ended_at,
  duration_seconds,
  session_status,
  end_reason,
  heartbeat_interval_secs,
  first_ingested_at,
  last_ingested_at,
  created_at,
  updated_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
on conflict(session_id) do update set
  user_id = coalesce(excluded.user_id, telemetry_sessions.user_id),
  app_version = excluded.app_version,
  platform = excluded.platform,
  os_version = excluded.os_version,
  started_at = min(telemetry_sessions.started_at, excluded.started_at),
  last_seen_at = max(telemetry_sessions.last_seen_at, excluded.last_seen_at),
  ended_at = case
    when telemetry_sessions.ended_at is null then excluded.ended_at
    when excluded.ended_at is null then telemetry_sessions.ended_at
    else max(telemetry_sessions.ended_at, excluded.ended_at)
  end,
  duration_seconds = case
    when case
      when telemetry_sessions.ended_at is null then excluded.ended_at
      when excluded.ended_at is null then telemetry_sessions.ended_at
      else max(telemetry_sessions.ended_at, excluded.ended_at)
    end is not null
    then
      case
        when (
          case
            when telemetry_sessions.ended_at is null then excluded.ended_at
            when excluded.ended_at is null then telemetry_sessions.ended_at
            else max(telemetry_sessions.ended_at, excluded.ended_at)
          end
          - min(telemetry_sessions.started_at, excluded.started_at)
        ) < 0 then 0
        else (
          case
            when telemetry_sessions.ended_at is null then excluded.ended_at
            when excluded.ended_at is null then telemetry_sessions.ended_at
            else max(telemetry_sessions.ended_at, excluded.ended_at)
          end
          - min(telemetry_sessions.started_at, excluded.started_at)
        )
      end
    else
      case
        when (
          max(telemetry_sessions.last_seen_at, excluded.last_seen_at)
          - min(telemetry_sessions.started_at, excluded.started_at)
        ) < 0 then 0
        else (
          max(telemetry_sessions.last_seen_at, excluded.last_seen_at)
          - min(telemetry_sessions.started_at, excluded.started_at)
        )
      end
  end,
  session_status = case
    when case
      when telemetry_sessions.ended_at is null then excluded.ended_at
      when excluded.ended_at is null then telemetry_sessions.ended_at
      else max(telemetry_sessions.ended_at, excluded.ended_at)
    end is not null then 'ended'
    when telemetry_sessions.session_status = 'abandoned' then 'abandoned'
    else 'active'
  end,
  end_reason = coalesce(excluded.end_reason, telemetry_sessions.end_reason),
  heartbeat_interval_secs = excluded.heartbeat_interval_secs,
  last_ingested_at = excluded.last_ingested_at,
  updated_at = excluded.updated_at;
```

### 8.3 `telemetry_events`

事件表建议使用 `insert or ignore`，按 `event_id` 做幂等：

```sql
insert or ignore into telemetry_events (
  event_id,
  install_id,
  session_id,
  user_id,
  event_name,
  event_time,
  app_version,
  platform,
  properties,
  first_ingested_at,
  created_at
) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
```

---

## 9. Worker 处理流程

### 9.1 `fetch()` 中 ingest 处理顺序

建议顺序：

1. 校验 `X-Ingest-Key`
2. 解析 JSON
3. 校验 `sessions.length <= 20`
4. 校验时间顺序与字段长度
5. 生成 `received_at = Math.floor(Date.now() / 1000)`
6. 构建 D1 prepared statements
7. `await env.DB.batch(statements)`
8. 返回 `202`

### 9.2 伪代码

```ts
const now = Math.floor(Date.now() / 1000);
const statements = [];

statements.push(
  env.DB.prepare(`
    insert into telemetry_ingest_requests (
      request_id, install_id, user_id, schema_version,
      sessions_count, events_count, processing_result,
      error_message, source_ip, user_agent, received_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    body.request_id,
    body.client.install_id,
    body.client.user_id,
    body.schema_version,
    body.sessions.length,
    body.events.length,
    "accepted",
    null,
    request.headers.get("CF-Connecting-IP"),
    request.headers.get("User-Agent"),
    now,
  )
);

statements.push(installationUpsertStmt.bind(...));
for (const session of body.sessions) statements.push(sessionUpsertStmt.bind(...));
for (const event of body.events) statements.push(eventInsertStmt.bind(...));

await env.DB.batch(statements);
```

说明：

1. `request.headers.get("CF-Connecting-IP")` 在 Cloudflare 边缘可取到用户 IP
2. 若担心隐私，可以不存原始 IP，只存哈希或直接不存

---

## 10. 超时会话转 `abandoned`

### 10.1 实现方式

Cloudflare Workers 官方支持 Cron Trigger，对应 Worker 里的 `scheduled()` 处理函数。  
建议配置每 5 分钟运行一次。

建议 `wrangler.jsonc`：

```json
{
  "triggers": {
    "crons": ["*/5 * * * *"]
  }
}
```

说明：

1. Cloudflare Cron Trigger 以 **UTC** 运行
2. 新增或修改 cron 规则传播可能需要几分钟

### 10.2 判定规则

当满足以下条件时，将会话标记为 `abandoned`：

1. `session_status = 'active'`
2. `ended_at is null`
3. `last_seen_at < now - 180`

这里的 `180` 秒是针对当前默认 `heartbeat_interval_secs = 60` 的推荐宽限值。

### 10.3 参考 SQL

```sql
update telemetry_sessions
set
  session_status = 'abandoned',
  duration_seconds = case
    when (last_seen_at - started_at) < 0 then 0
    else (last_seen_at - started_at)
  end,
  updated_at = ?
where
  session_status = 'active'
  and ended_at is null
  and last_seen_at < ?;
```

绑定参数：

1. `updated_at = nowSec`
2. `last_seen_at < nowSec - 180`

---

## 11. 数据保留与清理

由于 D1 官方有数据库大小上限，首版就建议约定数据保留策略。

推荐：

1. `telemetry_ingest_requests` 保留 30 天
2. `telemetry_events` 保留 90 天
3. `telemetry_sessions` 保留 180 天

如果后续埋点量明显变大，建议增加：

1. `telemetry_daily_metrics` 聚合表
2. 每日 Cron 先汇总，再删除历史原始数据

---

## 12. 内部查询接口

这部分不提供给客户端，只给你们内部看板、报表、排查使用。

### 12.1 `GET /api/v1/internal/telemetry/overview`

返回字段建议：

1. `session_start_count`
2. `active_install_count`
3. `avg_duration_seconds`
4. `p50_duration_seconds`
5. `p90_duration_seconds`
6. `abandoned_session_count`
7. `abandoned_session_rate`

### 12.2 `GET /api/v1/internal/telemetry/daily-metrics`

返回字段建议：

1. `date`
2. `session_start_count`
3. `active_install_count`
4. `avg_duration_seconds`
5. `abandoned_session_count`

说明：

1. 如果接口方暂时不做内部查询接口，客户端接入不受影响
2. 客户端只依赖 `POST /api/v1/telemetry/ingest`

---

## 13. 校验规则

服务端建议校验：

1. `started_at <= last_seen_at`
2. 若 `ended_at` 不为空，则 `ended_at >= started_at`
3. `heartbeat_interval_secs` 必须在 `15 ~ 300`
4. `session_id`、`install_id`、`request_id` 长度不超过 `64`
5. `app_version` 长度不超过 `32`
6. `platform` 长度不超过 `32`
7. `sessions <= 20`
8. `events <= 20`
9. 客户端时间允许最多 `10 分钟` 的未来偏差

---

## 14. 限流建议

建议至少做以下限流：

1. 按 `install_id`：`12 次 / 分钟`
2. 按 IP：`60 次 / 分钟`
3. 对重复无效请求做更严厉限流

原因：

1. 正常客户端只会启动补发、定时补发、关闭前补发，不会高频调用
2. D1 单库串行写入，不需要把限流阈值设得很高

---

## 15. 推荐统计 SQL（D1 / SQLite）

### 15.1 查询某天启动次数

```sql
select count(*) as session_start_count
from telemetry_sessions
where started_at >= ?
  and started_at < ?;
```

### 15.2 查询某天活跃安装数

```sql
select count(distinct install_id) as active_install_count
from telemetry_sessions
where started_at >= ?
  and started_at < ?;
```

### 15.3 查询某天平均打开时长

```sql
select avg(duration_seconds) as avg_duration_seconds
from telemetry_sessions
where started_at >= ?
  and started_at < ?;
```

### 15.4 查询某天 p50 / p90 打开时长

SQLite 没有 PostgreSQL 那样直接的 `percentile_cont` 聚合函数。  
如果接口方需要 p50 / p90，建议：

1. 在 Worker 里先按 `duration_seconds` 排序取数组，再在应用层计算
2. 或者在日聚合任务中离线计算后写入 `telemetry_daily_metrics`

---

## 16. 接口方交付清单

请接口提供方至少交付：

1. Cloudflare Worker 项目
2. D1 schema 与 migration
3. `POST /api/v1/telemetry/ingest`
4. `scheduled()` 定时任务
5. `X-Ingest-Key`
6. 测试环境与正式环境地址
7. 限流规则说明
8. 错误码说明

客户端开发在接入前需要对方提供：

1. `base_url`
2. ingest 路径
3. `X-Ingest-Key`
4. 单次最大 `sessions` 数
5. 单次最大 `events` 数
6. 请求超时建议
7. 重试建议

---

## 17. 对客户端开发的影响

客户端后续需要按这个 D1 版接口契约开发：

1. 本地 SQLite 缓存 session
2. 时间字段用 UTC epoch seconds
3. 单次上报最多 20 条 session
4. 正常关闭时尽量补发 `ended_at`
5. 失败时静默重试，下次启动补发

当前仍然不需要在客户端页面展示任何监控数据。
