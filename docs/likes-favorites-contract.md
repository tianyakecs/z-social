# 点赞与收藏功能契约 v1

本文件是前后端并行开发的**唯一事实来源**。两个分支必须严格实现以下契约，不得单方面改名或改语义。

## 1. 数据模型：Post

```json
{
  "id": "uuid",
  "content": "文本内容",
  "createdAt": "2026-11-13T08:00:00.000Z",
  "likeCount": 0,
  "favoriteCount": 0,
  "liked": false,
  "favorited": false
}
```

- `likeCount` / `favoriteCount`：整数，恒 `>= 0`。
- `liked` / `favorited`：当前访问者（单用户演示环境，视为同一个访客）是否已点赞/收藏。
- 兼容性：前端 `normalizePost` 遇到缺失的点赞/收藏字段必须补默认值（0 / `false`），不得因此判定为非法数据。
- `GET /api/posts`、`GET /api/posts/:id`、`POST /api/posts` 返回的 Post 必须带齐以上 4 个字段（新建动态为 0/0/false/false）。

## 2. 接口

| 方法 | 路径 | 语义 |
| --- | --- | --- |
| POST | `/api/posts/:id/like` | 切换点赞状态（toggle） |
| POST | `/api/posts/:id/favorite` | 切换收藏状态（toggle） |

成功响应 `200`：

```json
{ "post": { "...Post": "切换后的完整 Post" } }
```

失败响应 `404`（动态不存在），错误结构与现有接口一致：

```json
{ "error": { "code": "NOT_FOUND", "message": "动态不存在。" } }
```

Toggle 规则：

- 未点赞 → 点赞：`liked=true`，`likeCount+1`。
- 已点赞 → 取消：`liked=false`，`likeCount-1`，且计数不得小于 0。
- 收藏同理，独立计数，互不影响。
- 请求体可为空，服务端不读取 body。

## 3. 前端模块契约

### `src/lib/postsApi.js`

- `createPostsApi(...)` 额外返回 `toggleLike(postId)`、`toggleFavorite(postId)`。
- 也导出便捷函数 `toggleLike(postId, options)`、`toggleFavorite(postId, options)`。
- 请求：`POST /api/posts/${encodeURIComponent(postId)}/like|favorite`。
- 返回值：经 `normalizePost` 处理后的 Post；非法响应抛 `PostsApiError`，沿用现有错误码与文案。

### `src/lib/postRules.js`

- `normalizePost` 归一化 `likeCount`、`favoriteCount`、`liked`、`favorited`：
  - 缺失/`undefined` → 默认 `0` / `0` / `false` / `false`
  - 计数必须为非负整数，否则返回 `null`
  - 布尔字段必须为布尔值，否则返回 `null`

### `src/stores/posts.js`

- 新增 `toggleLike(postId, { service } = {})`、`toggleFavorite(postId, { service } = {})`。
- 返回值：`{ ok, post, error, message, status }`，失败时 `ok=false`。
- 用服务端返回的 Post 原地替换列表中的同 id 项（保持顺序），不重新排序。
- 同一动态同一时刻只允许一个进行中的切换请求；重复调用返回 `{ ok: false, error: 'REACTION_PENDING' }` 之类的既有风格错误，不再发请求。
- 切换进行中的动态 id 集合以 `pendingReactionIds`（`ref([])` 或兼容实现）暴露，供 UI 禁用按钮。
- 失败时不得破坏已有列表数据（保持原对象），返回 `NETWORK_ERROR` / `NOT_FOUND` 等错误码与原文案。

### 组件

- `src/components/PostCard.vue`
  - 新增操作区，类名 `.post-actions`；点赞按钮 `.post-action.post-action-like`，收藏按钮 `.post-action.post-action-favorite`。
  - 按钮为 `<button type="button">`，`aria-pressed` 反映 `liked` / `favorited`，`aria-label` 形如 `点赞` / `取消点赞`、`收藏` / `取消收藏`。
  - 文本包含计数（无计数文案时显示 0），`<span class="action-count">`。
  - 激活态类名 `is-active`；`:disabled="pending"`；PostCard 接收 `pending` 布尔 prop（默认 false）。
  - 组件通过 `emit('toggle-like', post.id)` / `emit('toggle-favorite', post.id)` 通知父级，不直接调用 store。
  - 既有 `.post-content` 纯文本渲染与 `<time datetime>` 必须保持（已有测试依赖）。
- `src/components/PostTimeline.vue`：新增 `pendingIds`（数组，默认 `[]`）prop，向下透传 `pending`，并把 `toggle-like` / `toggle-favorite` 事件转发给父级。
- `src/App.vue`：连接 store 的 `toggleLike` / `toggleFavorite` 与 `pendingReactionIds`，失败时在 `role="status"` 区域给出可读提示。
- `src/assets/main.css`：新增样式，遵循现有浅色玻璃质感（`--ink-*`、`--ease-out`、圆角 22px 体系），含 `:focus-visible` 与 `prefers-reduced-motion` 兼容。

## 4. 测试要求

- 后端：`tests/server/posts.api.spec.js` 覆盖新字段、两次 toggle 回到原点、404、收藏/点赞互不影响、列表与单条查询携带新字段、计数不为负。
- 前端：`tests/postsApi.spec.js`、`tests/posts.store.spec.js`、`tests/PostCard.spec.js` 以及必要时新增 `tests/PostTimeline.spec.js`。
- 全部测试必须 `npm test` 通过，且不得修改既有测试的语义预期（可补充，不可削弱）。

## 5. 文件所有权（避免合并冲突）

| 分支 | 独占文件 |
| --- | --- |
| `feat/likes-api` | `server/app.js`、`server/postStore.js`、`tests/server/**` |
| `feat/likes-ui` | `src/**`、`tests/*.spec.js`（`tests/server/**` 除外） |

不得修改 `package.json`、`vite.config.js`、`vitest.config.js` 与对方分支的文件。
