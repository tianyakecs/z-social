// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createApp } from '../../server/app.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function postJson(app, payload) {
  return app.request('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function postRaw(app, rawBody) {
  return app.request('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody,
  });
}

describe('GET /api/posts', () => {
  it('returns an empty list for a fresh app', async () => {
    const response = await createApp().request('/api/posts');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ posts: [] });
  });

  it('returns posts ordered by createdAt descending', async () => {
    const timestamps = [
      '2026-11-13T08:00:00.000Z',
      '2026-11-13T10:30:00.000Z',
      '2026-11-13T09:15:00.000Z',
    ];
    let index = 0;
    const app = createApp({ now: () => new Date(timestamps[index++]) });

    await postJson(app, { content: '第一条' });
    await postJson(app, { content: '第三条' });
    await postJson(app, { content: '第二条' });

    const { posts } = await (await app.request('/api/posts')).json();

    expect(posts.map((post) => post.content)).toEqual(['第三条', '第二条', '第一条']);
    expect(posts.map((post) => post.createdAt)).toEqual([
      '2026-11-13T10:30:00.000Z',
      '2026-11-13T09:15:00.000Z',
      '2026-11-13T08:00:00.000Z',
    ]);
  });
});

describe('POST /api/posts', () => {
  it('creates a trimmed post and returns 201 with a Location header', async () => {
    const response = await postJson(createApp(), { content: '  你好，Z。  ' });

    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('location')).toMatch(/^\/api\/posts\/[^/]+$/);

    const { post } = await response.json();
    expect(post).toEqual({
      id: expect.stringMatching(UUID_PATTERN),
      content: '你好，Z。',
      createdAt: expect.stringMatching(ISO_PATTERN),
    });
    expect(Object.keys(post).sort()).toEqual(['content', 'createdAt', 'id']);
    expect(response.headers.get('location')).toBe(`/api/posts/${post.id}`);
  });

  it('supports injected now and id for deterministic tests', async () => {
    const app = createApp({
      now: () => new Date('2026-11-13T08:00:00.000Z'),
      generateId: () => 'fixed-id',
    });
    const response = await postJson(app, { content: '确定性的动态' });

    expect(response.headers.get('location')).toBe('/api/posts/fixed-id');
    expect((await response.json()).post).toEqual({
      id: 'fixed-id',
      content: '确定性的动态',
      createdAt: '2026-11-13T08:00:00.000Z',
    });
  });

  it('accepts 280 Unicode code points and rejects 281', async () => {
    const app = createApp();
    const atLimit = '😀'.repeat(280);
    const overLimit = '😀'.repeat(281);

    const accepted = await postJson(app, { content: atLimit });
    expect(accepted.status).toBe(201);
    expect((await accepted.json()).post.content).toBe(atLimit);

    const rejected = await postJson(app, { content: overLimit });
    expect(rejected.status).toBe(422);
    expect(rejected.headers.get('content-type')).toContain('application/json');
    expect(await rejected.json()).toEqual({
      error: { code: 'POST_TOO_LONG', message: '内容不能超过 280 字。' },
    });
  });

  it('rejects empty and whitespace-only content with EMPTY_POST', async () => {
    const app = createApp();

    for (const content of ['', '   ', '\n\t  ']) {
      const response = await postJson(app, { content });
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        error: { code: 'EMPTY_POST', message: '写点什么再发布吧。' },
      });
    }

    expect(await (await app.request('/api/posts')).json()).toEqual({ posts: [] });
  });

  it('rejects non-string content with INVALID_CONTENT', async () => {
    const app = createApp();

    for (const payload of [
      { content: 42 },
      { content: null },
      { content: { nested: true } },
      { content: ['a'] },
      { content: true },
      {},
    ]) {
      const response = await postJson(app, payload);
      expect(response.status).toBe(422);

      const body = await response.json();
      expect(body.error.code).toBe('INVALID_CONTENT');
      expect(typeof body.error.message).toBe('string');
      expect(body.error.message.length).toBeGreaterThan(0);
    }

    expect(await (await app.request('/api/posts')).json()).toEqual({ posts: [] });
  });

  it('returns 400 INVALID_JSON for malformed bodies without throwing', async () => {
    const app = createApp();

    for (const rawBody of ['{ "content": ', '', 'not-json']) {
      const response = await postRaw(app, rawBody);
      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect((await response.json()).error.code).toBe('INVALID_JSON');
    }

    expect(await (await app.request('/api/posts')).json()).toEqual({ posts: [] });
  });

  it('keeps HTML-like content as plain text everywhere', async () => {
    const app = createApp();
    const content = '<img src=x onerror="alert(1)"> & <b>不会执行</b>';

    const created = await postJson(app, { content });
    const { post } = await created.json();
    expect(post.content).toBe(content);

    const listed = await (await app.request('/api/posts')).json();
    expect(listed.posts[0].content).toBe(content);

    const fetched = await (await app.request(`/api/posts/${post.id}`)).json();
    expect(fetched.post.content).toBe(content);
  });
});

describe('GET /api/posts/:id', () => {
  it('returns a single post', async () => {
    const app = createApp({
      now: () => new Date('2026-11-13T08:00:00.000Z'),
      generateId: () => 'post-1',
    });
    await postJson(app, { content: '可以被查询' });

    const response = await app.request('/api/posts/post-1');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      post: { id: 'post-1', content: '可以被查询', createdAt: '2026-11-13T08:00:00.000Z' },
    });
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const response = await createApp().request('/api/posts/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: '动态不存在。' },
    });
  });
});

describe('unknown API routes', () => {
  it('returns a 404 JSON error for an unregistered /api path', async () => {
    const response = await createApp().request('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect((await response.json()).error.code).toBe('NOT_FOUND');
  });

  it('returns a 404 JSON error for unsupported methods', async () => {
    const response = await createApp().request('/api/posts', { method: 'DELETE' });

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('NOT_FOUND');
  });
});

describe('in-memory isolation', () => {
  it('keeps posts per createApp instance', async () => {
    const appA = createApp({ generateId: () => 'a-1' });
    const appB = createApp({ generateId: () => 'b-1' });

    await postJson(appA, { content: '只属于 A' });
    await postJson(appB, { content: '只属于 B' });

    const postsA = (await (await appA.request('/api/posts')).json()).posts;
    const postsB = (await (await appB.request('/api/posts')).json()).posts;

    expect(postsA.map((post) => post.content)).toEqual(['只属于 A']);
    expect(postsB.map((post) => post.content)).toEqual(['只属于 B']);
    expect((await appA.request('/api/posts/b-1')).status).toBe(404);
    expect((await appB.request('/api/posts/a-1')).status).toBe(404);
  });
});
