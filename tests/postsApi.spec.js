import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  INVALID_RESPONSE_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  POSTS_ENDPOINT,
  PostsApiError,
  createPost,
  createPostsApi,
  listPosts,
  toggleFavorite,
  toggleLike,
} from '@/lib/postsApi';

const VALID_POSTS = [
  {
    id: 'newer',
    content: '更新的一条',
    createdAt: '2026-11-13T09:00:00.000Z',
    likeCount: 0,
    favoriteCount: 0,
    liked: false,
    favorited: false,
  },
  {
    id: 'older',
    content: '较早的一条',
    createdAt: '2026-11-13T08:00:00.000Z',
    likeCount: 0,
    favoriteCount: 0,
    liked: false,
    favorited: false,
  },
];

const TOGGLED = {
  id: 'post 1/2',
  content: '被点赞的动态',
  createdAt: '2026-11-13T08:00:00.000Z',
  likeCount: 3,
  favoriteCount: 1,
  liked: true,
  favorited: false,
};

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

  it('fills in the reaction fields with 0 / false when the server omits them', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      posts: [{ id: 'legacy', content: '旧数据', createdAt: '2026-11-13T08:00:00.000Z' }],
    }));

    const posts = await createPostsApi({ fetch: fetchMock }).listPosts();

    expect(posts[0]).toEqual({
      id: 'legacy',
      content: '旧数据',
      createdAt: '2026-11-13T08:00:00.000Z',
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: false,
    });
  });

  it('rejects counters that are not non-negative integers', async () => {
    for (const likeCount of [-1, 1.5, '3', null]) {
      const fetchMock = vi.fn(async () => jsonResponse({
        posts: [{ ...VALID_POSTS[0], likeCount }],
      }));

      const error = await createPostsApi({ fetch: fetchMock }).listPosts().catch((thrown) => thrown);
      expect(error).toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });

  it('rejects boolean flags that are not real booleans', async () => {
    for (const liked of ['true', 1, null]) {
      const fetchMock = vi.fn(async () => jsonResponse({
        posts: [{ ...VALID_POSTS[0], liked }],
      }));

      const error = await createPostsApi({ fetch: fetchMock }).listPosts().catch((thrown) => thrown);
      expect(error).toMatchObject({ code: 'INVALID_RESPONSE' });
    }
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
    const created = {
      id: 'post-9',
      content: '新的想法',
      createdAt: '2026-11-13T10:00:00.000Z',
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: false,
    };
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

describe('toggleLike', () => {
  it('POSTs to the encoded like endpoint and returns the normalized post', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ post: TOGGLED }));

    const post = await createPostsApi({ fetch: fetchMock }).toggleLike('post 1/2');

    expect(post).toEqual(TOGGLED);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/posts/post%201%2F2/like');
    expect(url.startsWith('/')).toBe(true);
    expect(init.method).toBe('POST');
  });

  it('maps a 404 body to NOT_FOUND with the server message', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      error: { code: 'NOT_FOUND', message: '动态不存在。' },
    }, 404));

    const error = await createPostsApi({ fetch: fetchMock }).toggleLike('missing').catch((thrown) => thrown);

    expect(error).toBeInstanceOf(PostsApiError);
    expect(error).toMatchObject({ code: 'NOT_FOUND', message: '动态不存在。', status: 404 });
  });

  it('maps a rejected fetch to NETWORK_ERROR', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

    const error = await createPostsApi({ fetch: fetchMock }).toggleLike('any').catch((thrown) => thrown);

    expect(error).toMatchObject({
      code: 'NETWORK_ERROR',
      message: NETWORK_ERROR_MESSAGE,
      status: 0,
    });
  });

  it('rejects a payload that does not contain a usable post', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      post: { id: 'broken', content: '   ', createdAt: '2026-11-13T08:00:00.000Z' },
    }));

    const error = await createPostsApi({ fetch: fetchMock }).toggleLike('broken').catch((thrown) => thrown);

    expect(error).toMatchObject({ code: 'INVALID_RESPONSE', status: 200 });
  });

  it('fills in the reaction fields when the server omits them', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      post: { id: 'p1', content: '无计数字段', createdAt: '2026-11-13T08:00:00.000Z' },
    }));

    const post = await createPostsApi({ fetch: fetchMock }).toggleLike('p1');

    expect(post).toEqual({
      id: 'p1',
      content: '无计数字段',
      createdAt: '2026-11-13T08:00:00.000Z',
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: false,
    });
  });
});

describe('toggleFavorite', () => {
  it('POSTs to the favorite endpoint with the same URL contract', async () => {
    const favorited = { ...TOGGLED, liked: false, favorited: true, favoriteCount: 2 };
    const fetchMock = vi.fn(async () => jsonResponse({ post: favorited }));

    const post = await createPostsApi({ fetch: fetchMock }).toggleFavorite('post 1/2');

    expect(post).toEqual(favorited);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/posts/post%201%2F2/favorite');
    expect(init.method).toBe('POST');
  });
});

describe('reaction convenience helpers', () => {
  it('uses globalThis.fetch for toggleLike and toggleFavorite', async () => {
    const likeFetch = vi.fn(async () => jsonResponse({ post: TOGGLED }));
    vi.stubGlobal('fetch', likeFetch);

    await expect(toggleLike('post 1/2')).resolves.toMatchObject({ id: 'post 1/2', liked: true });
    expect(likeFetch.mock.calls[0][0]).toBe('/api/posts/post%201%2F2/like');

    const favoriteFetch = vi.fn(async () => jsonResponse({
      post: { ...TOGGLED, liked: false, favorited: true },
    }));
    vi.stubGlobal('fetch', favoriteFetch);

    await expect(toggleFavorite('post 1/2')).resolves.toMatchObject({ favorited: true });
    expect(favoriteFetch.mock.calls[0][0]).toBe('/api/posts/post%201%2F2/favorite');
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
      post: {
        id: 'p2',
        content: '便捷方法',
        createdAt: '2026-11-13T11:00:00.000Z',
        likeCount: 0,
        favoriteCount: 0,
        liked: false,
        favorited: false,
      },
    }, 201)));

    await expect(createPost('便捷方法')).resolves.toMatchObject({ id: 'p2' });
  });
});
