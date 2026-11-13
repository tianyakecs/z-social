import { Hono } from 'hono';

import { PostError, createMemoryPostStore } from './postStore.js';

const MESSAGES = {
  NOT_FOUND: '动态不存在。',
  ROUTE_NOT_FOUND: '接口不存在。',
  INVALID_JSON: '请求体必须是合法的 JSON。',
  INTERNAL_ERROR: '服务器开了个小差，请稍后再试。',
};

function errorPayload(code, message) {
  return { error: { code, message } };
}

export function createApp(options = {}) {
  const store = options.store ?? createMemoryPostStore(options);
  const app = new Hono();

  app.get('/api/posts', (c) => c.json({ posts: store.list() }));

  app.post('/api/posts', async (c) => {
    const rawBody = await c.req.text();

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return c.json(errorPayload('INVALID_JSON', MESSAGES.INVALID_JSON), 400);
    }

    const content = payload && typeof payload === 'object' ? payload.content : undefined;

    try {
      const post = store.create(content);
      return c.json({ post }, 201, { Location: `/api/posts/${post.id}` });
    } catch (error) {
      if (error instanceof PostError) {
        return c.json(errorPayload(error.code, error.message), 422);
      }
      throw error;
    }
  });

  app.post('/api/posts/:id/like', (c) => {
    const post = store.toggleLike(c.req.param('id'));
    if (!post) return c.json(errorPayload('NOT_FOUND', MESSAGES.NOT_FOUND), 404);
    return c.json({ post });
  });

  app.post('/api/posts/:id/favorite', (c) => {
    const post = store.toggleFavorite(c.req.param('id'));
    if (!post) return c.json(errorPayload('NOT_FOUND', MESSAGES.NOT_FOUND), 404);
    return c.json({ post });
  });

  app.get('/api/posts/:id', (c) => {
    const post = store.getById(c.req.param('id'));
    if (!post) return c.json(errorPayload('NOT_FOUND', MESSAGES.NOT_FOUND), 404);
    return c.json({ post });
  });

  app.notFound((c) => c.json(errorPayload('NOT_FOUND', MESSAGES.ROUTE_NOT_FOUND), 404));

  app.onError((error, c) => {
    console.error('[z-server] unhandled error:', error);
    return c.json(errorPayload('INTERNAL_ERROR', MESSAGES.INTERNAL_ERROR), 500);
  });

  return app;
}
