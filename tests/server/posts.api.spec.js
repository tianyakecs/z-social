// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { createApp } from '../../server/app.js';
import { createMemoryPostStore } from '../../server/postStore.js';

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

function toggleReaction(app, id, action, init = {}) {
  return app.request(`/api/posts/${encodeURIComponent(id)}/${action}`, { method: 'POST', ...init });
}

function createDeterministicApp() {
  return createApp({
    now: () => new Date('2026-11-13T08:00:00.000Z'),
    generateId: () => 'post-1',
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

  it('includes zeroed reaction fields on every listed post', async () => {
    const app = createApp({ generateId: () => 'post-1' });
    await postJson(app, { content: '列表字段' });

    const { posts } = await (await app.request('/api/posts')).json();

    expect(posts).toHaveLength(1);
    expect(posts[0]).toEqual({
      id: 'post-1',
      content: '列表字段',
      createdAt: expect.stringMatching(ISO_PATTERN),
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: false,
    });
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
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: false,
    });
    expect(Object.keys(post).sort()).toEqual([
      'content',
      'createdAt',
      'favoriteCount',
      'favorited',
      'id',
      'likeCount',
      'liked',
    ]);
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
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: false,
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
      post: {
        id: 'post-1',
        content: '可以被查询',
        createdAt: '2026-11-13T08:00:00.000Z',
        likeCount: 0,
        favoriteCount: 0,
        liked: false,
        favorited: false,
      },
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

  it('returns the route 404 for non-POST methods on a toggle path', async () => {
    const response = await createApp().request('/api/posts/any-id/like');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: '接口不存在。' },
    });
  });
});

describe('POST /api/posts/:id/like', () => {
  it('toggles liked state and likeCount with 200 responses', async () => {
    const app = createDeterministicApp();
    await postJson(app, { content: '点赞测试' });

    const liked = await toggleReaction(app, 'post-1', 'like');
    expect(liked.status).toBe(200);
    expect(liked.headers.get('content-type')).toContain('application/json');
    expect((await liked.json()).post).toEqual({
      id: 'post-1',
      content: '点赞测试',
      createdAt: '2026-11-13T08:00:00.000Z',
      likeCount: 1,
      favoriteCount: 0,
      liked: true,
      favorited: false,
    });

    const unliked = await toggleReaction(app, 'post-1', 'like');
    expect(unliked.status).toBe(200);
    expect((await unliked.json()).post).toEqual({
      id: 'post-1',
      content: '点赞测试',
      createdAt: '2026-11-13T08:00:00.000Z',
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: false,
    });
  });

  it('ignores the request body and works without one', async () => {
    const app = createDeterministicApp();
    await postJson(app, { content: '空请求体' });

    const noBody = await app.request('/api/posts/post-1/like', { method: 'POST' });
    expect(noBody.status).toBe(200);
    expect((await noBody.json()).post.liked).toBe(true);

    const withJson = await toggleReaction(app, 'post-1', 'like', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ liked: true, likeCount: 99 }),
    });
    expect(withJson.status).toBe(200);
    const { post } = await withJson.json();
    expect(post.liked).toBe(false);
    expect(post.likeCount).toBe(0);

    const withGarbage = await toggleReaction(app, 'post-1', 'like', {
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(withGarbage.status).toBe(200);
    expect((await withGarbage.json()).post.liked).toBe(true);
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const response = await toggleReaction(createApp(), 'missing-id', 'like');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: '动态不存在。' },
    });
  });
});

describe('POST /api/posts/:id/favorite', () => {
  it('toggles favorited state and favoriteCount with 200 responses', async () => {
    const app = createDeterministicApp();
    await postJson(app, { content: '收藏测试' });

    const favorited = await toggleReaction(app, 'post-1', 'favorite');
    expect(favorited.status).toBe(200);
    expect(favorited.headers.get('content-type')).toContain('application/json');
    expect((await favorited.json()).post).toEqual({
      id: 'post-1',
      content: '收藏测试',
      createdAt: '2026-11-13T08:00:00.000Z',
      likeCount: 0,
      favoriteCount: 1,
      liked: false,
      favorited: true,
    });

    const unfavorited = await toggleReaction(app, 'post-1', 'favorite');
    expect(unfavorited.status).toBe(200);
    expect((await unfavorited.json()).post).toEqual({
      id: 'post-1',
      content: '收藏测试',
      createdAt: '2026-11-13T08:00:00.000Z',
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: false,
    });
  });

  it('returns 404 NOT_FOUND for an unknown id', async () => {
    const response = await toggleReaction(createApp(), 'missing-id', 'favorite');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: '动态不存在。' },
    });
  });
});

describe('reaction toggles', () => {
  it('keeps like and favorite counters independent', async () => {
    const app = createDeterministicApp();
    await postJson(app, { content: '互不影响' });

    const steps = [
      ['like', { likeCount: 1, liked: true, favoriteCount: 0, favorited: false }],
      ['favorite', { likeCount: 1, liked: true, favoriteCount: 1, favorited: true }],
      ['like', { likeCount: 0, liked: false, favoriteCount: 1, favorited: true }],
      ['favorite', { likeCount: 0, liked: false, favoriteCount: 0, favorited: false }],
    ];

    for (const [action, expected] of steps) {
      const response = await toggleReaction(app, 'post-1', action);
      expect(response.status).toBe(200);
      const { post } = await response.json();
      expect({
        likeCount: post.likeCount,
        liked: post.liked,
        favoriteCount: post.favoriteCount,
        favorited: post.favorited,
      }).toEqual(expected);
    }
  });

  it('never lets a counter drop below zero', async () => {
    const app = createApp({ generateId: () => 'post-1' });
    await postJson(app, { content: '不会为负' });

    for (let round = 0; round < 3; round += 1) {
      for (const action of ['like', 'favorite', 'like', 'favorite']) {
        const response = await toggleReaction(app, 'post-1', action);
        expect(response.status).toBe(200);
        const { post } = await response.json();
        expect(Number.isInteger(post.likeCount)).toBe(true);
        expect(Number.isInteger(post.favoriteCount)).toBe(true);
        expect(post.likeCount).toBeGreaterThanOrEqual(0);
        expect(post.favoriteCount).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('reflects toggles in list and detail without reordering', async () => {
    const timestamps = ['2026-11-13T08:00:00.000Z', '2026-11-13T10:30:00.000Z'];
    let index = 0;
    let idSeed = 0;
    const app = createApp({
      now: () => new Date(timestamps[index++]),
      generateId: () => `post-${++idSeed}`,
    });

    await postJson(app, { content: '第一条' });
    await postJson(app, { content: '第二条' });

    expect((await toggleReaction(app, 'post-1', 'like')).status).toBe(200);

    const { posts } = await (await app.request('/api/posts')).json();
    expect(posts.map((post) => post.content)).toEqual(['第二条', '第一条']);
    expect(posts[1]).toEqual({
      id: 'post-1',
      content: '第一条',
      createdAt: '2026-11-13T08:00:00.000Z',
      likeCount: 1,
      favoriteCount: 0,
      liked: true,
      favorited: false,
    });
    expect(posts[0].likeCount).toBe(0);
    expect(posts[0].liked).toBe(false);
    expect(posts[0].favorited).toBe(false);

    const { post } = await (await app.request('/api/posts/post-1')).json();
    expect(post.likeCount).toBe(1);
    expect(post.liked).toBe(true);
    expect(post.favoriteCount).toBe(0);
    expect(post.favorited).toBe(false);
  });
});

describe('createMemoryPostStore reactions', () => {
  it('returns null when toggling an unknown id', () => {
    const store = createMemoryPostStore();

    expect(store.toggleLike('missing')).toBeNull();
    expect(store.toggleFavorite('missing')).toBeNull();
  });

  it('toggles deterministically with injected now and generateId', () => {
    const store = createMemoryPostStore({
      now: () => new Date('2026-11-13T08:00:00.000Z'),
      generateId: () => 'store-post',
    });
    store.create('确定性');

    expect(store.toggleLike('store-post')).toEqual({
      id: 'store-post',
      content: '确定性',
      createdAt: '2026-11-13T08:00:00.000Z',
      likeCount: 1,
      favoriteCount: 0,
      liked: true,
      favorited: false,
    });
    expect(store.toggleLike('store-post')).toEqual({
      id: 'store-post',
      content: '确定性',
      createdAt: '2026-11-13T08:00:00.000Z',
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: false,
    });
    expect(store.toggleFavorite('store-post')).toEqual({
      id: 'store-post',
      content: '确定性',
      createdAt: '2026-11-13T08:00:00.000Z',
      likeCount: 0,
      favoriteCount: 1,
      liked: false,
      favorited: true,
    });
  });
});
