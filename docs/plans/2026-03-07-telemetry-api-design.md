# 客户端 Telemetry 自建接口设计

**日期**: 2026-03-07  
**适用范围**: Tauri 桌面客户端会话监控首期建设  
**目标读者**: 接口提供方、服务端开发、客户端开发

---

## 1. 背景与目标

当前客户端首期只需要可靠采集以下指标：

1. 用户每次启动软件的时间
2. 用户每次关闭软件的时间
3. 单次打开时长
4. 每日启动次数
5. 每日活跃安装数

同时需要满足以下约束：

1. 不在客户端页面展示监控数据
2. 不影响用户正常使用，不阻塞启动、关闭和交互
3. 客户端先本地缓存，后续批量上报
4. 后端接口需要支持重复上报、乱序上报、关闭事件缺失
5. 方案后续可扩展到更多埋点事件，而不是只支持“启动/关闭”两条记录

---

## 2. 方案对比与最终结论

### 方案 A：只做 `session` 表 + 单条 session 上报接口

优点：

1. 后端实现最简单
2. 当前“打开时长”需求可以满足

缺点：

1. 后续扩展功能使用、错误日志、版本分布时需要重新设计
2. 接口演进空间小，后面容易推翻重做

### 方案 B：做通用批量采集接口，当前只上报 `session`，预留 `event`

优点：

1. 当前需求能满足
2. 后续新增功能事件时不需要改接口形态
3. 支持本地批量缓存与幂等重试
4. 更适合客户端离线后补发

缺点：

1. 初始设计比方案 A 稍复杂

### 最终结论

采用 **方案 B**。  
首期客户端只需要上传 session 数据，但后端表结构和接口按“可扩展 telemetry”设计。

---

## 3. 首期范围与非目标

### 首期范围

1. 会话开始时间 `started_at`
2. 会话最近心跳时间 `last_seen_at`
3. 会话结束时间 `ended_at`
4. 会话状态 `active / ended / abandoned`
5. 会话时长 `duration_seconds`
6. 安装维度统计 `install_id`
7. 版本维度统计 `app_version`
8. 平台维度统计 `platform`

### 当前非目标

1. 不做客户端页面展示
2. 不做实时在线人数
3. 不做复杂用户画像
4. 不做客户端侧埋点配置页面
5. 不要求服务端主动下发远程配置

---

## 4. 核心数据流

1. 客户端启动时生成 `session_id`
2. 客户端本地 SQLite 写入一条 session 记录，保存 `started_at`
3. 客户端按配置间隔更新 `last_seen_at`
4. 客户端在以下时机批量上传本地未发送记录：
   1. 启动后延迟 45 秒
   2. 本地累计 20 条待上传记录
   3. 距离上次上传超过 10 分钟
   4. 正常退出前尝试一次快速上传
   5. 下次启动时补发上次未成功的数据
5. 服务端接收批量请求，按 `session_id` 做幂等 upsert
6. 如果客户端没有发到 `ended_at`，服务端按心跳超时规则将 session 标为 `abandoned`

---

## 5. 标识设计

客户端需要提供以下标识：

1. `install_id`
   1. 含义：一次安装实例的稳定匿名标识
   2. 建议：首次启动生成 UUID，长期保存在客户端本地
   3. 用途：统计活跃安装数、留存、版本分布

2. `session_id`
   1. 含义：一次软件打开会话的唯一标识
   2. 建议：每次启动生成 UUID

3. `user_id`
   1. 含义：如果后续产品有登录体系，可选上传
   2. 当前可为空

说明：

1. 不要把嵌在客户端里的固定密钥当成真正安全的 secret
2. 若需要鉴权，客户端最多使用“公开写入 key + 限流”，不要把管理端 key 放进客户端

---

## 6. 推荐数据库

推荐使用 **PostgreSQL 15+**。  
原因：

1. 支持 `JSONB`
2. 支持可靠的 `UPSERT`
3. 适合后续做按天聚合、统计查询、索引优化

如果接口方使用 MySQL，也可以实现，但需要把以下内容做等价替换：

1. `JSONB` 改为 `JSON`
2. `ON CONFLICT DO UPDATE` 改为 `ON DUPLICATE KEY UPDATE`
3. `timestamptz` 改为带时区约定的 `timestamp`

---

## 7. 表结构设计

首期推荐至少创建 4 张表：

1. `telemetry_installations`
2. `telemetry_sessions`
3. `telemetry_events`
4. `telemetry_ingest_requests`

其中：

1. 前两张为首期必需
2. `telemetry_events` 为后续扩展预留，建议首期一并建好
3. `telemetry_ingest_requests` 用于审计、排错、限流分析，强烈建议保留

### 7.1 `telemetry_installations`

```sql
create table if not exists telemetry_installations (
  install_id varchar(64) primary key,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  first_app_version varchar(32) not null,
  last_app_version varchar(32) not null,
  platform varchar(32) not null,
  os_version varchar(64),
  first_user_id varchar(128),
  last_user_id varchar(128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_telemetry_installations_last_seen_at
  on telemetry_installations (last_seen_at desc);
```

用途：

1. 统计活跃安装数
2. 统计版本分布
3. 统计平台分布

### 7.2 `telemetry_sessions`

```sql
create table if not exists telemetry_sessions (
  session_id varchar(64) primary key,
  install_id varchar(64) not null references telemetry_installations (install_id),
  user_id varchar(128),
  app_version varchar(32) not null,
  platform varchar(32) not null,
  os_version varchar(64),
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer not null,
  session_status varchar(16) not null,
  end_reason varchar(32),
  heartbeat_interval_secs integer not null,
  first_ingested_at timestamptz not null default now(),
  last_ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_telemetry_sessions_time_order check (
    started_at <= last_seen_at
    and (ended_at is null or ended_at >= started_at)
  ),
  constraint ck_telemetry_sessions_status check (
    session_status in ('active', 'ended', 'abandoned')
  )
);

create index if not exists idx_telemetry_sessions_started_at
  on telemetry_sessions (started_at desc);

create index if not exists idx_telemetry_sessions_install_started
  on telemetry_sessions (install_id, started_at desc);

create index if not exists idx_telemetry_sessions_app_version_started
  on telemetry_sessions (app_version, started_at desc);

create index if not exists idx_telemetry_sessions_status_started
  on telemetry_sessions (session_status, started_at desc);
```

字段说明：

1. `started_at`
   1. 会话开始时间

2. `last_seen_at`
   1. 最近一次客户端心跳时间
   2. 即使没有 `ended_at`，也能用来估算会话时长

3. `ended_at`
   1. 正常关闭时记录
   2. 异常退出时可能为空

4. `duration_seconds`
   1. 当 `ended_at` 不为空时：`ended_at - started_at`
   2. 当 `ended_at` 为空时：`last_seen_at - started_at`

5. `session_status`
   1. `active`：已开始，尚未正常结束
   2. `ended`：收到正常结束上报
   3. `abandoned`：长时间未收到心跳，由服务端定时任务判定异常中断

6. `end_reason`
   1. 可选值建议：`normal_close`、`window_close`、`quit`、`update_restart`、`unknown`

### 7.3 `telemetry_events`

首期客户端可不上传业务事件，但建议表先建好。

```sql
create table if not exists telemetry_events (
  event_id varchar(64) primary key,
  install_id varchar(64) not null references telemetry_installations (install_id),
  session_id varchar(64) references telemetry_sessions (session_id),
  user_id varchar(128),
  event_name varchar(64) not null,
  event_time timestamptz not null,
  app_version varchar(32) not null,
  platform varchar(32) not null,
  properties jsonb not null default '{}'::jsonb,
  first_ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_telemetry_events_name_time
  on telemetry_events (event_name, event_time desc);

create index if not exists idx_telemetry_events_session_time
  on telemetry_events (session_id, event_time desc);

create index if not exists idx_telemetry_events_install_time
  on telemetry_events (install_id, event_time desc);

create index if not exists idx_telemetry_events_properties_gin
  on telemetry_events using gin (properties);
```

### 7.4 `telemetry_ingest_requests`

```sql
create table if not exists telemetry_ingest_requests (
  request_id varchar(64) primary key,
  install_id varchar(64),
  user_id varchar(128),
  schema_version integer not null,
  sessions_count integer not null default 0,
  events_count integer not null default 0,
  processing_result varchar(16) not null,
  error_message text,
  source_ip inet,
  user_agent text,
  received_at timestamptz not null default now()
);

create index if not exists idx_telemetry_ingest_requests_received_at
  on telemetry_ingest_requests (received_at desc);
```

用途：

1. 审计每次上报请求
2. 追查重试、失败、异常流量
3. 配合限流策略定位问题

---

## 8. 服务端接口设计

### 8.1 客户端写入接口

#### `POST /api/v1/telemetry/ingest`

用途：

1. 客户端批量上传 session 和 event
2. 当前首期客户端只需要传 `sessions`

请求头建议：

```http
Content-Type: application/json
X-Ingest-Key: <public-write-key>
X-Request-Id: <uuid>
```

说明：

1. `X-Ingest-Key` 是公开写入 key，不是管理端 secret
2. 服务端必须做 IP / install_id 限流
3. 如果未来客户端有登录态，也可以额外带 `Authorization`，但首期不强依赖

请求体示例：

```json
{
  "schema_version": 1,
  "request_id": "df4813cf-f910-4c20-9644-cf4fdbd1f942",
  "sent_at": "2026-03-07T09:20:00Z",
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
      "started_at": "2026-03-07T09:00:00Z",
      "last_seen_at": "2026-03-07T09:19:00Z",
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
   2. 后续若请求体变更，用它做版本兼容

2. `request_id`
   1. 一次上传请求唯一 ID
   2. 用于审计和问题排查

3. `client.install_id`
   1. 必填
   2. 同一安装实例保持稳定不变

4. `sessions`
   1. 至少支持 1 条，最多建议 100 条

5. `events`
   1. 首期可为空数组
   2. 后续客户端扩展功能事件时复用同一接口

成功响应示例：

```json
{
  "request_id": "df4813cf-f910-4c20-9644-cf4fdbd1f942",
  "accepted": true,
  "server_time": "2026-03-07T09:20:00Z",
  "sessions_upserted": 1,
  "events_inserted": 0,
  "duplicate_events_ignored": 0
}
```

失败响应建议：

```json
{
  "request_id": "df4813cf-f910-4c20-9644-cf4fdbd1f942",
  "accepted": false,
  "error_code": "INVALID_PAYLOAD",
  "message": "sessions[0].started_at must be earlier than last_seen_at"
}
```

状态码约定：

1. `202 Accepted`
   1. 成功接收并入库或入队

2. `400 Bad Request`
   1. JSON 结构错误
   2. 必填字段缺失

3. `401 Unauthorized` / `403 Forbidden`
   1. `X-Ingest-Key` 缺失或无效

4. `413 Payload Too Large`
   1. 请求体过大

5. `422 Unprocessable Entity`
   1. 字段格式正确但业务校验不通过

6. `429 Too Many Requests`
   1. 超过限流阈值
   2. 返回 `retry_after_seconds`

7. `500 Internal Server Error`
   1. 服务端内部异常

### 8.2 可选内部查询接口

如果接口提供方也负责给你们内部做查看接口，建议最少提供以下只读接口。这些接口不需要给客户端使用，可供内部管理后台或 BI 调用。

#### `GET /api/v1/internal/telemetry/overview`

查询参数：

1. `from`
2. `to`
3. `timezone`
4. `platform` 可选
5. `app_version` 可选

返回字段建议：

1. `session_start_count`
2. `active_install_count`
3. `avg_duration_seconds`
4. `p50_duration_seconds`
5. `p90_duration_seconds`
6. `abandoned_session_count`
7. `abandoned_session_rate`

#### `GET /api/v1/internal/telemetry/sessions`

查询参数：

1. `from`
2. `to`
3. `platform`
4. `app_version`
5. `status`
6. `page`
7. `page_size`

用途：

1. 排查某版本是否异常退出变多
2. 排查某平台启动后很快退出

#### `GET /api/v1/internal/telemetry/daily-metrics`

查询参数：

1. `from`
2. `to`
3. `timezone`

返回字段建议：

1. `date`
2. `session_start_count`
3. `active_install_count`
4. `avg_duration_seconds`
5. `abandoned_session_count`

---

## 9. 服务端幂等规则

客户端本地缓存后会重复重试，因此服务端必须按以下规则处理：

1. `telemetry_ingest_requests.request_id` 可重复收到
2. 同一个 `session_id` 会被多次上报
3. 同一个会话可能先上传“active”，后上传“ended”
4. 网络重试可能导致乱序到达

### 9.1 `installations` upsert 规则

1. `first_seen_at = least(已有值, 新值)`
2. `last_seen_at = greatest(已有值, 新值)`
3. `first_app_version` 保留第一次值
4. `last_app_version` 更新为最新上报值
5. `last_user_id` 用最近非空值覆盖

参考 PostgreSQL upsert SQL：

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
) values (
  :install_id,
  :first_seen_at,
  :last_seen_at,
  :app_version,
  :app_version,
  :platform,
  :os_version,
  :user_id,
  :user_id,
  now(),
  now()
)
on conflict (install_id) do update
set
  first_seen_at = least(telemetry_installations.first_seen_at, excluded.first_seen_at),
  last_seen_at = greatest(telemetry_installations.last_seen_at, excluded.last_seen_at),
  last_app_version = excluded.last_app_version,
  platform = excluded.platform,
  os_version = excluded.os_version,
  last_user_id = coalesce(excluded.last_user_id, telemetry_installations.last_user_id),
  updated_at = now();
```

### 9.2 `sessions` upsert 规则

按 `session_id` 做唯一键更新，推荐规则：

1. `started_at = least(existing.started_at, incoming.started_at)`
2. `last_seen_at = greatest(existing.last_seen_at, incoming.last_seen_at)`
3. `ended_at = greatest(existing.ended_at, incoming.ended_at)`，空值忽略
4. `duration_seconds`
   1. 若 `ended_at` 不为空，按 `ended_at - started_at` 重算
   2. 否则按 `last_seen_at - started_at` 重算
5. `session_status`
   1. 若 `ended_at` 不为空，则为 `ended`
   2. 否则保持 `active`
   3. `abandoned` 只由服务端定时任务判定
6. `end_reason`
   1. 仅当传入非空时覆盖

参考 PostgreSQL upsert SQL：

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
) values (
  :session_id,
  :install_id,
  :user_id,
  :app_version,
  :platform,
  :os_version,
  :started_at,
  :last_seen_at,
  :ended_at,
  :duration_seconds,
  case when :ended_at is null then 'active' else 'ended' end,
  :end_reason,
  :heartbeat_interval_secs,
  now(),
  now(),
  now(),
  now()
)
on conflict (session_id) do update
set
  user_id = coalesce(excluded.user_id, telemetry_sessions.user_id),
  app_version = excluded.app_version,
  platform = excluded.platform,
  os_version = excluded.os_version,
  started_at = least(telemetry_sessions.started_at, excluded.started_at),
  last_seen_at = greatest(telemetry_sessions.last_seen_at, excluded.last_seen_at),
  ended_at = case
    when telemetry_sessions.ended_at is null then excluded.ended_at
    when excluded.ended_at is null then telemetry_sessions.ended_at
    else greatest(telemetry_sessions.ended_at, excluded.ended_at)
  end,
  duration_seconds = case
    when case
      when telemetry_sessions.ended_at is null then excluded.ended_at
      when excluded.ended_at is null then telemetry_sessions.ended_at
      else greatest(telemetry_sessions.ended_at, excluded.ended_at)
    end is not null
    then extract(
      epoch from (
        case
          when telemetry_sessions.ended_at is null then excluded.ended_at
          when excluded.ended_at is null then telemetry_sessions.ended_at
          else greatest(telemetry_sessions.ended_at, excluded.ended_at)
        end - least(telemetry_sessions.started_at, excluded.started_at)
      )
    )::integer
    else extract(
      epoch from (
        greatest(telemetry_sessions.last_seen_at, excluded.last_seen_at)
        - least(telemetry_sessions.started_at, excluded.started_at)
      )
    )::integer
  end,
  session_status = case
    when case
      when telemetry_sessions.ended_at is null then excluded.ended_at
      when excluded.ended_at is null then telemetry_sessions.ended_at
      else greatest(telemetry_sessions.ended_at, excluded.ended_at)
    end is not null
    then 'ended'
    when telemetry_sessions.session_status = 'abandoned' then 'abandoned'
    else 'active'
  end,
  end_reason = coalesce(excluded.end_reason, telemetry_sessions.end_reason),
  heartbeat_interval_secs = excluded.heartbeat_interval_secs,
  last_ingested_at = now(),
  updated_at = now();
```

### 9.3 `events` 幂等规则

1. `event_id` 全局唯一
2. 如果 `event_id` 已存在，则忽略重复写入

---

## 10. 服务端定时任务要求

必须有一个定时任务负责把“长时间无心跳的 active session”改为 `abandoned`。

推荐规则：

1. 每 5 分钟执行一次
2. 选择满足以下条件的记录：
   1. `session_status = 'active'`
   2. `ended_at is null`
   3. `last_seen_at < now() - interval '3 minutes'`

说明：

1. 这里的 `3 分钟` 不是心跳间隔本身，而是建议的超时宽限值
2. 对当前默认 `heartbeat_interval_secs = 60` 的客户端，`3 分钟` 已足够区分“暂时没上报”和“基本不会再上报”

更新规则：

1. `session_status = 'abandoned'`
2. `duration_seconds = extract(epoch from (last_seen_at - started_at))::integer`
3. `updated_at = now()`

---

## 11. 服务端校验规则

接口方建议实现以下校验：

1. `started_at <= last_seen_at`
2. 若 `ended_at` 不为空，则 `ended_at >= started_at`
3. `heartbeat_interval_secs` 必须在 `15 ~ 300` 秒之间
4. `sessions` 最多 100 条
5. `events` 最多 500 条
6. 单次请求体最大建议 `512KB`
7. 客户端时间允许有少量偏差，但不接受明显未来时间
   1. 建议允许 `10 分钟` 以内的未来偏差

---

## 12. 限流与安全建议

### 12.1 限流

建议至少做以下限流：

1. 按 `install_id` 限制：`60 次请求 / 分钟`
2. 按 IP 限制：`120 次请求 / 分钟`
3. 对单 IP 的异常高频写入做封禁或熔断

### 12.2 安全

1. 全站强制 HTTPS
2. 客户端只放公开写入 key，不放管理端密钥
3. 记录 `source_ip` 和 `user_agent`
4. 对过大的 payload 直接拒绝
5. 对超长字符串做长度截断或拒绝
6. 不采集不必要的个人敏感信息

---

## 13. 首期统计口径定义

为了避免服务端和客户端各自理解不同，建议明确以下口径：

1. 启动次数
   1. 定义：统计周期内 `telemetry_sessions` 的记录数

2. 活跃安装数
   1. 定义：统计周期内 `distinct install_id`

3. 打开时长
   1. 定义：单条 session 的 `duration_seconds`

4. 平均打开时长
   1. 定义：统计周期内所有 session 的 `avg(duration_seconds)`

5. 异常中断率
   1. 定义：`session_status = 'abandoned'` 的会话数 / 总会话数

---

## 14. 推荐统计 SQL

### 14.1 查询某天启动次数

```sql
select count(*) as session_start_count
from telemetry_sessions
where started_at >= '2026-03-07T00:00:00+08:00'
  and started_at < '2026-03-08T00:00:00+08:00';
```

### 14.2 查询某天活跃安装数

```sql
select count(distinct install_id) as active_install_count
from telemetry_sessions
where started_at >= '2026-03-07T00:00:00+08:00'
  and started_at < '2026-03-08T00:00:00+08:00';
```

### 14.3 查询某天平均打开时长

```sql
select avg(duration_seconds) as avg_duration_seconds
from telemetry_sessions
where started_at >= '2026-03-07T00:00:00+08:00'
  and started_at < '2026-03-08T00:00:00+08:00';
```

### 14.4 查询某天 p50 / p90 打开时长

```sql
select
  percentile_cont(0.5) within group (order by duration_seconds) as p50_duration_seconds,
  percentile_cont(0.9) within group (order by duration_seconds) as p90_duration_seconds
from telemetry_sessions
where started_at >= '2026-03-07T00:00:00+08:00'
  and started_at < '2026-03-08T00:00:00+08:00';
```

---

## 15. 接口方交付清单

请接口提供方至少交付以下内容：

1. PostgreSQL 表结构与索引
2. `POST /api/v1/telemetry/ingest` 接口
3. 接口鉴权方案
4. 幂等 upsert 逻辑
5. 心跳超时转 `abandoned` 的定时任务
6. 基础监控与日志
7. 错误码说明文档
8. 调用示例

如果接口方也负责查询接口，再补充：

1. `GET /api/v1/internal/telemetry/overview`
2. `GET /api/v1/internal/telemetry/sessions`
3. `GET /api/v1/internal/telemetry/daily-metrics`

---

## 16. 需要接口方最终回传给客户端开发的内容

客户端接入前，需要接口方提供：

1. `base_url`
2. 实际 ingest 路径
3. `X-Ingest-Key`
4. 单次最大批量条数
5. 单次最大请求体大小
6. 限流规则
7. 失败重试建议
8. 正式环境与测试环境地址

---

## 17. 对客户端开发的直接影响

客户端后续只需要对接一个写入接口：

1. 本地 SQLite 持久化 session
2. 定时批量读取未上传记录
3. 调用 `POST /api/v1/telemetry/ingest`
4. 成功后标记已上传
5. 失败后静默重试

当前不需要客户端展示任何监控数据。

---

## 18. 最终建议

如果接口方只愿意做最小版本，也不要退回“只收 start/end 两个事件”的方案。  
最少也应满足以下能力：

1. 能按 `session_id` 做 upsert
2. 能接收 `last_seen_at`
3. 能容忍没有 `ended_at`
4. 能把超时未结束 session 判定为 `abandoned`

否则最终算出来的“打开时长”会明显失真。
