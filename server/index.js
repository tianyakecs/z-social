import { serve } from '@hono/node-server';

import { createApp } from './app.js';

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = '127.0.0.1';

function resolvePort(rawValue) {
  if (rawValue === undefined || rawValue === '') return DEFAULT_PORT;

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`PORT 必须是 0-65535 之间的整数，当前值：${rawValue}`);
  }
  return parsed;
}

function main() {
  const port = resolvePort(process.env.PORT);
  const hostname = process.env.HOST || DEFAULT_HOST;
  const app = createApp();

  const server = serve({ fetch: app.fetch, hostname, port }, (info) => {
    console.log(`[z-server] API 已启动：http://${info.address}:${info.port}`);
  });

  server.on('error', (error) => {
    console.error('[z-server] 启动失败：', error.message);
    process.exitCode = 1;
  });
}

try {
  main();
} catch (error) {
  console.error('[z-server] 启动失败：', error.message);
  process.exitCode = 1;
}
