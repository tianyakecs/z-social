import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INVALID_RESPONSE_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  POSTS_ENDPOINT,
  PostsApiError,
  createPost,
  createPostsApi,
  listPosts,
} from '@/lib/postsApi';

const VALID_POSTS = [
  { id: 'newer', content: '更新的一条', createdAt: '2026-11-13T09:00:00.000Z' },
  { id: 'older', content: '较早的一条', createdAt: '2026-11-13T08:00:00.000Z' },
];

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function brokenJsonResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0');
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('postsApi endpoint contract', () => {
  it('talks to the relative /api/posts endpoint', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ posts: [] }));

    await createPostsApi({ fetch: fetchMock }).listPosts();

    expect(POSTS_ENDPOINT).toBe('/api/posts');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/posts');
    expect(url.startsWith('/')).toBe(true);
    expect(url.startsWith('http')).toBe(false);
    expect(init.method).toBe('GET');
  });
});

describe('listPosts', () => {
  it('returns the server list without reordering it', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ posts: VALID_POSTS }));

    const posts = await createPostsApi({ fetch: fetchMock }).listPosts();

    expect(posts).toEqual(VALID_POSTS);
    expect(posts.map((post) => post.id)).toEqual(['newer', 'older']);
  });

  it('returns an empty list for a fresh server', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ posts: [] }));

    await expect(createPostsApi({ fetch: fetchMock }).listPosts()).resolves.toEqual([]);
  });

  it('maps a JSON parse failure to INVALID_RESPONSE', async () => {
    const fetchMock = vi.fn(async () => brokenJsonResponse(200));

    const error = await createPostsApi({ fetch: fetchMock }).listPosts().catch((thrown) => thrown);

    expect(error).toBeInstanceOf(PostsApiError);
    expect(error).toMatchObject({
      name: 'PostsApiError',
      code: 'INVALID_RESPONSE',
      message: INVALID_RESPONSE_MESSAGE,
      status: 200,
    });
  });

  it('rejects a payload whose posts field is not an array', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ posts: 'not-an-array' }));

    const error = await createPostsApi({ fetch: fetchMock }).listPosts().catch((thrown) => thrown);

    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
  });

  it('rejects a list that contains an invalid post record', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      posts: [VALID_POSTS[0], { id: 'broken', content: '   ', createdAt: '2026-11-13T08:00:00.000Z' }],
    }));

    const error = await createPostsApi({ fetch: fetchMock }).listPosts().catch((thrown) => thrown);

    expect(error).toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

describe('createPost', () => {
  it('POSTs JSON content and returns the created post', async () => {
    const created = { id: 'post-9', content: '新的想法', createdAt: '2026-11-13T10:00:00.000Z' };
    const fetchMock = vi.fn(async () => jsonResponse({ post: created }, 201));

    const post = await createPostsApi({ fetch: fetchMock }).createPost('  新的想法  ');

    expect(post).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/posts');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ content: '  新的想法  ' });
  });

  it('turns a 422 API error body into PostsApiError code/message/status', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      error: { code: 'POST_TOO_LONG', message: '内容不能超过 280 字。' },
    }, 422));

    const error = await createPostsApi({ fetch: fetchMock }).createPost('超长内容').catch((thrown) => thrown);

    expect(error).toBeInstanceOf(PostsApiError);
    expect(error).toMatchObject({
      code: 'POST_TOO_LONG',
      message: '内容不能超过 280 字。',
      status: 422,
    });
  });

  it('keeps the server message for INVALID_JSON responses', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      error: { code: 'INVALID_JSON', message: '请求体必须是合法的 JSON。' },
    }, 400));

    const error = await createPostsApi({ fetch: fetchMock }).createPost('内容').catch((thrown) => thrown);

    expect(error).toMatchObject({ code: 'INVALID_JSON', status: 400 });
  });

  it('uses INVALID_RESPONSE when a non-2xx body carries no structured error', async () => {
    const fetchMock = vi.fn(async () => brokenJsonResponse(500));

    const error = await createPostsApi({ fetch: fetchMock }).createPost('内容').catch((thrown) => thrown);

    expect(error).toMatchObject({
      code: 'INVALID_RESPONSE',
      message: INVALID_RESPONSE_MESSAGE,
      status: 500,
    });
  });

  it('uses INVALID_RESPONSE when the 201 body has no usable post', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ post: { id: '', content: '无标识' } }, 201));

    const error = await createPostsApi({ fetch: fetchMock }).createPost('内容').catch((thrown) => thrown);

    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 201 });
  });
});

describe('failure mapping', () => {
  it('maps a rejected fetch to NETWORK_ERROR with a Chinese message', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

    const error = await createPostsApi({ fetch: fetchMock }).listPosts().catch((thrown) => thrown);

    expect(error).toBeInstanceOf(PostsApiError);
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.status).toBe(0);
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
    expect(/[\u4e00-\u9fa5]/.test(error.message)).toBe(true);
  });

  it('maps a missing fetch implementation to NETWORK_ERROR instead of a TypeError', async () => {
    const error = await createPostsApi({ fetch: 'not-a-function' }).listPosts().catch((thrown) => thrown);

    expect(error).toBeInstanceOf(PostsApiError);
    expect(error.code).toBe('NETWORK_ERROR');
  });
});

describe('fetch injection', () => {
  it('never touches the global fetch when one is injected', async () => {
    const globalFetch = vi.fn(async () => jsonResponse({ posts: [] }));
    vi.stubGlobal('fetch', globalFetch);
    const injected = vi.fn(async () => jsonResponse({ posts: VALID_POSTS }));

    const posts = await createPostsApi({ fetch: injected }).listPosts();

    expect(posts).toEqual(VALID_POSTS);
    expect(injected).toHaveBeenCalledTimes(1);
    expect(globalFetch).not.toHaveBeenCalled();
  });

  it('falls back to globalThis.fetch for the exported convenience helpers', async () => {
    const globalFetch = vi.fn(async () => jsonResponse({ posts: VALID_POSTS }));
    vi.stubGlobal('fetch', globalFetch);

    await expect(listPosts()).resolves.toEqual(VALID_POSTS);
    expect(globalFetch).toHaveBeenCalledTimes(1);

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      post: { id: 'p2', content: '便捷方法', createdAt: '2026-11-13T11:00:00.000Z' },
    }, 201)));

    await expect(createPost('便捷方法')).resolves.toMatchObject({ id: 'p2' });
  });
});
