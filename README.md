# Z

一个本地优先的轻量动态发布页面，使用 Vue 3、Pinia、Vite 和 Local Storage 构建。界面延续浅色、淡雅的产品风格，无需后端即可发布和查看内容。

## 功能

- 发布最多 280 字的文字动态，支持实时字数统计与空白校验
- 最新动态优先展示，显示本地化发布时间
- 使用 Local Storage 保存数据，刷新后自动恢复
- 浅色界面、磨砂导航、柔和阴影和本地装饰插画
- 已有滚动显现、轻微视差与卡片交错入场，可一键关闭装饰动效
- 支持系统“减少动态效果”偏好
- 适配桌面与手机，提供输入错误、存储异常和发布成功反馈
- 用户内容按纯文本渲染，避免 HTML 注入

## 技术栈

- Node.js 22.12 或更高版本
- Vue 3 Composition API 与单文件组件
- Pinia 状态管理
- Vite 开发与生产构建
- Vitest、Vue Test Utils 与 jsdom
- 浏览器 Local Storage

## 本地运行

```powershell
npm install
npm run dev
```

打开终端显示的本地地址，通常为 <http://127.0.0.1:5173>。

生产构建与本地预览：

```powershell
npm run build
npm run preview
```

## 测试

```powershell
npm test
```

测试遵循先失败、再实现、后重构的 TDD 流程，覆盖：

- Local Storage 数据校验、排序、损坏数据恢复与读写异常
- Pinia 初始化、动态计数及写入失败时的原子性
- 发布表单的空值、超长、成功清空和失败保留草稿
- 动态内容的安全纯文本渲染
- 空状态、持久化恢复和页面动态计数

监听模式：

```powershell
npm run test:watch
```

## 数据兼容

动态保存在当前浏览器、当前站点来源下的 `z.posts.v1` 存储键中，数据结构仍为 `{ id, content, createdAt }`，可直接读取迁移前的本地动态。

- 数据不上传服务器，不在不同浏览器或设备之间同步
- 清理浏览器站点数据会删除动态
- 更换端口或域名会被视为不同站点来源，原数据不会自动迁移
- 存储不可用时，尚未发布的输入会保留在文本框中

## 文件结构

```text
├── index.html                  # Vite 入口
├── src/
│   ├── main.js                 # 创建 Vue 应用并安装 Pinia
│   ├── App.vue                 # 页面组合与加载状态
│   ├── components/             # 首屏、发布表单、时间线和动态卡片
│   ├── composables/            # 动效、视差与生命周期清理
│   ├── lib/postStorage.js      # Local Storage 领域模块
│   ├── stores/posts.js         # Pinia posts store
│   └── assets/                 # 全局样式与本地插画
├── tests/                      # Vitest 单元与组件测试
├── vite.config.js
├── vitest.config.js
└── package.json
```

## 远程仓库

<https://github.com/tianyakecs/z-social>
