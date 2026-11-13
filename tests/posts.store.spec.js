import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { createPost, STORAGE_KEY } from '@/lib/postStorage';
import { usePostsStore } from '@/stores/posts';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

describe('posts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('hydrates valid posts in newest-first order without a load error', () => {
    const storage = new MemoryStorage();
    const older = createPost('较早', new Date('2026-11-13T08:00:00.000Z'), 'older');
    const newer = createPost('更新', new Date('2026-11-13T09:00:00.000Z'), 'newer');
    storage.setItem(STORAGE_KEY, JSON.stringify([older, newer]));

    const store = usePostsStore();
    const result = store.hydrate(storage);

    expect(result.error).toBeNull();
    expect(store.posts.map((post) => post.id)).toEqual(['newer', 'older']);
    expect(store.postCount).toBe(2);
    expect(store.isEmpty).toBe(false);
    expect(store.loadError).toBeNull();
  });

  it('exposes an empty state and load error for malformed data', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{broken');

    const store = usePostsStore();
    store.hydrate(storage);

    expect(store.posts).toEqual([]);
    expect(store.postCount).toBe(0);
    expect(store.isEmpty).toBe(true);
    expect(store.loadError).toBe('DATA_INVALID');
  });

  it('persists a new post before exposing it at the top of the timeline', () => {
    const storage = new MemoryStorage();
    const store = usePostsStore();
    store.hydrate(storage);

    const result = store.publish('  新的想法  ', {
      storage,
      now: new Date('2026-11-13T10:00:00.000Z'),
    });

    expect(result.ok).toBe(true);
    expect(result.post.content).toBe('新的想法');
    expect(store.posts[0]).toEqual(result.post);
    expect(store.postCount).toBe(1);

    const persisted = JSON.parse(storage.getItem(STORAGE_KEY));
    expect(persisted[0]).toEqual(result.post);
  });

  it('leaves state and storage unchanged when validation fails', () => {
    const storage = new MemoryStorage();
    const store = usePostsStore();
    store.hydrate(storage);

    const result = store.publish('   ', { storage });

    expect(result).toMatchObject({ ok: false, error: 'EMPTY_POST' });
    expect(store.posts).toEqual([]);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('keeps existing posts when storage writing fails', () => {
    const memory = new MemoryStorage();
    const existing = createPost('已存在', new Date('2026-11-13T08:00:00.000Z'), 'existing');
    memory.setItem(STORAGE_KEY, JSON.stringify([existing]));
    const failingStorage = {
      getItem: (key) => memory.getItem(key),
      setItem: () => { throw new Error('quota exceeded'); },
    };

    const store = usePostsStore();
    store.hydrate(memory);
    const result = store.publish('无法保存', { storage: failingStorage });

    expect(result).toMatchObject({ ok: false, error: 'STORAGE_WRITE_FAILED' });
    expect(store.posts).toEqual([existing]);
    expect(JSON.parse(memory.getItem(STORAGE_KEY))).toEqual([existing]);
  });
});
