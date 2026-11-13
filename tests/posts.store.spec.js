import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { PostsApiError } from '@/lib/postsApi';
import { MAX_CONTENT_LENGTH } from '@/lib/postRules';
import { usePostsStore } from '@/stores/posts';

const EXISTING = {
  id: 'existing',
  content: '已存在的动态',
  createdAt: '2026-11-13T08:00:00.000Z',
};

const CREATED = {
  id: 'created-1',
  content: '新的想法',
  createdAt: '2026-11-13T10:00:00.000Z',
};

const FIRST = {
  id: 'first',
  content: '第一条',
  createdAt: '2026-11-13T09:00:00.000Z',
  likeCount: 0,
  favoriteCount: 0,
  liked: false,
  favorited: false,
};

const SECOND = {
  id: 'second',
  content: '第二条',
  createdAt: '2026-11-13T08:00:00.000Z',
  likeCount: 2,
  favoriteCount: 1,
  liked: false,
  favorited: false,
};

const THIRD = {
  id: 'third',
  content: '第三条',
  createdAt: '2026-11-13T07:00:00.000Z',
  likeCount: 5,
  favoriteCount: 0,
  liked: true,
  favorited: false,
};

function createService({ listPosts, createPost } = {}) {
  return {
    listPosts: listPosts ?? vi.fn(async () => []),
    createPost: createPost ?? vi.fn(async (content) => ({
      id: 'created-1',
      content,
      createdAt: CREATED.createdAt,
    })),
  };
}

function createReactionService({ toggleLike, toggleFavorite } = {}) {
  return {
    listPosts: vi.fn(async () => []),
    createPost: vi.fn(async (content) => ({ ...CREATED, content })),
    toggleLike: toggleLike ?? vi.fn(async () => ({ ...FIRST, likeCount: 1, liked: true })),
    toggleFavorite: toggleFavorite
      ?? vi.fn(async () => ({ ...FIRST, favoriteCount: 1, favorited: true })),
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('posts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('hydrates asynchronously from the service and toggles loading', async () => {
    const service = createService({ listPosts: vi.fn(async () => [EXISTING]) });
    const store = usePostsStore();

    const pending = store.hydrate({ service });
    expect(pending).toBeInstanceOf(Promise);
    expect(store.loading).toBe(true);

    const result = await pending;

    expect(result).toEqual({ ok: true, posts: [EXISTING], error: null });
    expect(store.loading).toBe(false);
    expect(store.posts).toEqual([EXISTING]);
    expect(store.postCount).toBe(1);
    expect(store.isEmpty).toBe(false);
    expect(store.loadError).toBeNull();
    expect(service.listPosts).toHaveBeenCalledTimes(1);
  });

  it('records a load error and keeps the current posts when loading fails', async () => {
    const store = usePostsStore();
    await store.hydrate({ service: createService({ listPosts: async () => [EXISTING] }) });

    const failure = new PostsApiError('NETWORK_ERROR', '网络连接失败，请检查网络后重试。', 0);
    const failing = createService({
      listPosts: vi.fn(async () => {
        throw failure;
      }),
    });

    const result = await store.hydrate({ service: failing });

    expect(result).toMatchObject({ ok: false, error: 'NETWORK_ERROR' });
    expect(result.message).toBe(failure.message);
    expect(store.posts).toEqual([EXISTING]);
    expect(store.postCount).toBe(1);
    expect(store.loading).toBe(false);
    expect(store.loadError).toEqual({ code: 'NETWORK_ERROR', message: failure.message });
  });

  it('clears a previous load error after a successful reload', async () => {
    const store = usePostsStore();
    await store.hydrate({
      service: createService({
        listPosts: vi.fn(async () => {
          throw new PostsApiError('INVALID_RESPONSE', '服务器返回的数据无法识别，请稍后重试。', 200);
        }),
      }),
    });
    expect(store.loadError).not.toBeNull();

    await store.hydrate({ service: createService({ listPosts: async () => [EXISTING] }) });

    expect(store.loadError).toBeNull();
    expect(store.posts).toEqual([EXISTING]);
  });

  it('prepends the post returned by the API after a successful publish', async () => {
    const store = usePostsStore();
    await store.hydrate({ service: createService({ listPosts: async () => [EXISTING] }) });
    const service = createService();

    const result = await store.publish('  新的想法  ', { service });

    expect(result.ok).toBe(true);
    expect(result.error).toBeNull();
    expect(result.post).toEqual(CREATED);
    expect(service.createPost).toHaveBeenCalledTimes(1);
    expect(service.createPost).toHaveBeenCalledWith('新的想法');
    expect(store.posts.map((post) => post.id)).toEqual(['created-1', 'existing']);
    expect(store.postCount).toBe(2);
    expect(store.publishing).toBe(false);
  });

  it('rejects empty and over-long content locally without any network call', async () => {
    const store = usePostsStore();
    const service = createService();

    const empty = await store.publish('   ', { service });
    expect(empty).toMatchObject({
      ok: false,
      error: 'EMPTY_POST',
      message: '写点什么再发布吧。',
    });

    const tooLong = await store.publish('😀'.repeat(MAX_CONTENT_LENGTH + 1), { service });
    expect(tooLong).toMatchObject({
      ok: false,
      error: 'POST_TOO_LONG',
      message: '内容不能超过 280 字。',
    });

    const invalid = await store.publish(42, { service });
    expect(invalid).toMatchObject({ ok: false, error: 'INVALID_CONTENT' });

    expect(service.createPost).not.toHaveBeenCalled();
    expect(store.posts).toEqual([]);
    expect(store.publishing).toBe(false);
  });

  it('keeps posts untouched when the API rejects the publish', async () => {
    const store = usePostsStore();
    await store.hydrate({ service: createService({ listPosts: async () => [EXISTING] }) });

    const failure = new PostsApiError('EMPTY_POST', '写点什么再发布吧。', 422);
    const service = createService({
      createPost: vi.fn(async () => {
        throw failure;
      }),
    });

    const result = await store.publish('任意内容', { service });

    expect(result).toMatchObject({ ok: false, error: 'EMPTY_POST', message: failure.message, status: 422 });
    expect(store.posts).toEqual([EXISTING]);
    expect(store.publishing).toBe(false);
  });

  it('keeps posts untouched and reports NETWORK_ERROR when the network fails', async () => {
    const store = usePostsStore();
    await store.hydrate({ service: createService({ listPosts: async () => [EXISTING] }) });

    const failure = new PostsApiError(
      'NETWORK_ERROR',
      '网络连接失败，请检查网络后重试。你的文字仍保留在输入框中。',
      0,
    );
    const service = createService({
      createPost: vi.fn(async () => {
        throw failure;
      }),
    });

    const result = await store.publish('不能丢失的草稿', { service });

    expect(result).toMatchObject({ ok: false, error: 'NETWORK_ERROR' });
    expect(result.message).toContain('网络');
    expect(store.posts).toEqual([EXISTING]);
  });

  it('maps an unexpected exception to a friendly UNKNOWN_ERROR', async () => {
    const store = usePostsStore();
    const service = createService({
      createPost: vi.fn(async () => {
        throw new Error('boom');
      }),
    });

    const result = await store.publish('内容', { service });

    expect(result).toMatchObject({ ok: false, error: 'UNKNOWN_ERROR' });
    expect(result.message).toContain('文字仍保留在输入框中');
    expect(store.posts).toEqual([]);
  });

  it('ignores a second publish while the first one is in flight', async () => {
    const store = usePostsStore();
    const gate = deferred();
    const service = createService({ createPost: vi.fn(() => gate.promise) });

    const first = store.publish('并发内容', { service });
    expect(store.publishing).toBe(true);

    const second = await store.publish('并发内容', { service });
    expect(second).toMatchObject({ ok: false, error: 'PUBLISHING' });

    gate.resolve(CREATED);
    const firstResult = await first;

    expect(firstResult.ok).toBe(true);
    expect(service.createPost).toHaveBeenCalledTimes(1);
    expect(store.posts).toEqual([CREATED]);
  });

  it('never reads or writes localStorage', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const store = usePostsStore();

    await store.hydrate({ service: createService({ listPosts: async () => [EXISTING] }) });
    await store.publish('新的想法', { service: createService() });

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('exposes an empty pendingReactionIds collection after hydration', async () => {
    const store = usePostsStore();
    await store.hydrate({ service: createService({ listPosts: async () => [FIRST] }) });

    expect(store.pendingReactionIds).toEqual([]);
  });

  it('replaces the matching post in place after a successful like and keeps the order', async () => {
    const store = usePostsStore();
    await store.hydrate({
      service: createService({ listPosts: async () => [FIRST, SECOND, THIRD] }),
    });

    const updated = { ...SECOND, likeCount: 3, liked: true };
    const service = createReactionService({ toggleLike: vi.fn(async () => updated) });

    const result = await store.toggleLike('second', { service });

    expect(result).toMatchObject({ ok: true, error: null });
    expect(result.post).toEqual(updated);
    expect(service.toggleLike).toHaveBeenCalledTimes(1);
    expect(service.toggleLike).toHaveBeenCalledWith('second');
    expect(store.posts.map((post) => post.id)).toEqual(['first', 'second', 'third']);
    expect(store.posts[1]).toEqual(updated);
    expect(store.posts[0]).toStrictEqual(FIRST);
    expect(store.posts[2]).toStrictEqual(THIRD);
  });

  it('uses toggleFavorite for favorites and leaves likes untouched', async () => {
    const store = usePostsStore();
    await store.hydrate({ service: createService({ listPosts: async () => [FIRST, SECOND] }) });

    const service = createReactionService();

    const result = await store.toggleFavorite('first', { service });

    expect(result).toMatchObject({ ok: true, error: null });
    expect(service.toggleFavorite).toHaveBeenCalledWith('first');
    expect(service.toggleLike).not.toHaveBeenCalled();
    expect(store.posts[0].favorited).toBe(true);
  });

  it('exposes the toggling id in pendingReactionIds until the request settles', async () => {
    const store = usePostsStore();
    await store.hydrate({ service: createService({ listPosts: async () => [FIRST] }) });

    const gate = deferred();
    const service = createReactionService({ toggleLike: vi.fn(() => gate.promise) });

    const running = store.toggleLike('first', { service });
    expect(store.pendingReactionIds).toContain('first');

    gate.resolve({ ...FIRST, likeCount: 1, liked: true });
    await running;

    expect(store.pendingReactionIds).toEqual([]);
  });

  it('rejects a second concurrent toggle of the same post without a second request', async () => {
    const store = usePostsStore();
    await store.hydrate({ service: createService({ listPosts: async () => [FIRST] }) });

    const gate = deferred();
    const service = createReactionService({ toggleLike: vi.fn(() => gate.promise) });

    const first = store.toggleLike('first', { service });
    const second = await store.toggleLike('first', { service });

    expect(second).toMatchObject({ ok: false, error: 'REACTION_PENDING' });
    expect(typeof second.message).toBe('string');
    expect(/[\u4e00-\u9fa5]/.test(second.message)).toBe(true);

    gate.resolve({ ...FIRST, likeCount: 1, liked: true });
    const firstResult = await first;

    expect(firstResult.ok).toBe(true);
    expect(service.toggleLike).toHaveBeenCalledTimes(1);
    expect(store.posts[0].likeCount).toBe(1);
  });

  it('still allows toggling a different post while one toggle is in flight', async () => {
    const store = usePostsStore();
    await store.hydrate({ service: createService({ listPosts: async () => [FIRST, SECOND] }) });

    const gate = deferred();
    const service = createReactionService({
      toggleLike: vi.fn((postId) => (postId === 'first'
        ? gate.promise
        : Promise.resolve({ ...SECOND, likeCount: 3, liked: true }))),
    });

    const running = store.toggleLike('first', { service });
    const other = await store.toggleLike('second', { service });

    expect(other.ok).toBe(true);
    expect(service.toggleLike).toHaveBeenCalledTimes(2);

    gate.resolve({ ...FIRST, likeCount: 1, liked: true });
    await running;
    expect(store.pendingReactionIds).toEqual([]);
  });

  it('keeps the list untouched and reports the API error when a toggle fails', async () => {
    const store = usePostsStore();
    await store.hydrate({ service: createService({ listPosts: async () => [FIRST, SECOND] }) });
    const before = store.posts.slice();

    const failure = new PostsApiError('NOT_FOUND', '动态不存在。', 404);
    const service = createReactionService({
      toggleLike: vi.fn(async () => {
        throw failure;
      }),
    });

    const result = await store.toggleLike('second', { service });

    expect(result).toMatchObject({
      ok: false,
      error: 'NOT_FOUND',
      message: '动态不存在。',
      status: 404,
    });
    expect(store.posts).toHaveLength(2);
    store.posts.forEach((post, index) => expect(post).toBe(before[index]));
    expect(store.pendingReactionIds).toEqual([]);
  });

  it('maps an unexpected toggle exception to UNKNOWN_ERROR and clears the pending id', async () => {
    const store = usePostsStore();
    await store.hydrate({ service: createService({ listPosts: async () => [FIRST] }) });

    const service = createReactionService({
      toggleLike: vi.fn(async () => {
        throw new Error('boom');
      }),
    });

    const result = await store.toggleLike('first', { service });

    expect(result).toMatchObject({ ok: false, error: 'UNKNOWN_ERROR' });
    expect(/[\u4e00-\u9fa5]/.test(result.message)).toBe(true);
    expect(store.pendingReactionIds).toEqual([]);
    expect(store.posts[0]).toStrictEqual(FIRST);
  });

  it('rejects a toggle without a usable post id', async () => {
    const store = usePostsStore();
    const service = createReactionService();

    const result = await store.toggleLike('', { service });

    expect(result).toMatchObject({ ok: false, error: 'INVALID_POST_ID' });
    expect(service.toggleLike).not.toHaveBeenCalled();
  });
});
