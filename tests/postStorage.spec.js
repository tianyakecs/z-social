import { describe, expect, it } from 'vitest';

import {
  MAX_CONTENT_LENGTH,
  PostInputError,
  STORAGE_KEY,
  createPost,
  loadPosts,
  savePosts,
} from '@/lib/postStorage';

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

function expectInputError(fn, code) {
  let thrown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }

  expect(thrown).toBeInstanceOf(PostInputError);
  expect(thrown).toMatchObject({ code });
}

describe('createPost', () => {
  it('creates a trimmed post with an id and ISO timestamp', () => {
    const now = new Date('2026-11-13T08:00:00.000Z');
    const post = createPost('  你好，Z。  ', now, 'post-1');

    expect(post).toEqual({
      id: 'post-1',
      content: '你好，Z。',
      createdAt: '2026-11-13T08:00:00.000Z',
    });
  });

  it('rejects empty and whitespace-only content', () => {
    for (const content of ['', '   ', '\n\t']) {
      expectInputError(() => createPost(content), 'EMPTY_POST');
    }
  });

  it('accepts 280 Unicode characters and rejects 281', () => {
    expect(createPost('😀'.repeat(MAX_CONTENT_LENGTH)).content).toBe('😀'.repeat(MAX_CONTENT_LENGTH));
    expectInputError(
      () => createPost('😀'.repeat(MAX_CONTENT_LENGTH + 1)),
      'POST_TOO_LONG',
    );
  });

  it('preserves HTML-like text as plain content', () => {
    const content = '<img src=x onerror=alert(1)>';
    expect(createPost(content).content).toBe(content);
  });
});

describe('loadPosts', () => {
  it('returns an empty list when no data has been stored', () => {
    expect(loadPosts(new MemoryStorage())).toEqual({ posts: [], error: null });
  });

  it('round-trips posts and sorts them newest first', () => {
    const storage = new MemoryStorage();
    const older = createPost('第一条', new Date('2026-11-13T08:00:00.000Z'), 'older');
    const newer = createPost('第二条', new Date('2026-11-13T09:00:00.000Z'), 'newer');

    expect(savePosts(storage, [older, newer])).toEqual({ ok: true, error: null });
    expect(loadPosts(storage)).toEqual({ posts: [newer, older], error: null });
    expect(storage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('recovers from malformed JSON without throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{broken');

    expect(loadPosts(storage)).toEqual({ posts: [], error: 'DATA_INVALID' });
  });

  it('filters invalid records and normalizes valid records', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify([
      null,
      { id: '', content: '无标识', createdAt: '2026-11-13T08:00:00.000Z' },
      { id: 'bad-date', content: '错误时间', createdAt: 'not-a-date' },
      { id: 'too-long', content: '字'.repeat(MAX_CONTENT_LENGTH + 1), createdAt: '2026-11-13T08:00:00.000Z' },
      { id: 'valid', content: '  保留这条  ', createdAt: '2026-11-13T08:00:00.000Z' },
    ]));

    expect(loadPosts(storage)).toEqual({
      posts: [{ id: 'valid', content: '保留这条', createdAt: '2026-11-13T08:00:00.000Z' }],
      error: 'DATA_INVALID',
    });
  });

  it('converts storage read failures into a result', () => {
    const storage = { getItem() { throw new Error('blocked'); } };
    expect(loadPosts(storage)).toEqual({ posts: [], error: 'STORAGE_READ_FAILED' });
  });
});

describe('savePosts', () => {
  it('converts storage write failures into a result', () => {
    const storage = { setItem() { throw new Error('quota exceeded'); } };
    const post = createPost('无法保存');

    expect(savePosts(storage, [post])).toEqual({ ok: false, error: 'STORAGE_WRITE_FAILED' });
  });
});
