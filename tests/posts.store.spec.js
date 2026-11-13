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
});
