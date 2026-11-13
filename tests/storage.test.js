import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_CONTENT_LENGTH,
  STORAGE_KEY,
  createPost,
  loadPosts,
  savePosts,
} from '../storage.js';

class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  setItem(key, value) {
    this.#values.set(key, String(value));
  }
}

test('creates a trimmed post with an id and ISO timestamp', () => {
  const now = new Date('2026-11-13T08:00:00.000Z');
  const post = createPost('  你好，Z。  ', now, 'post-1');

  assert.deepEqual(post, {
    id: 'post-1',
    content: '你好，Z。',
    createdAt: '2026-11-13T08:00:00.000Z',
  });
});

test('rejects empty and whitespace-only content', () => {
  for (const content of ['', '   ', '\n\t']) {
    assert.throws(() => createPost(content), { code: 'EMPTY_POST' });
  }
});

test('accepts 280 Unicode characters and rejects 281', () => {
  assert.equal(createPost('😀'.repeat(MAX_CONTENT_LENGTH)).content.length, MAX_CONTENT_LENGTH * 2);
  assert.throws(() => createPost('😀'.repeat(MAX_CONTENT_LENGTH + 1)), { code: 'POST_TOO_LONG' });
});

test('returns an empty list when no data has been stored', () => {
  assert.deepEqual(loadPosts(new MemoryStorage()), { posts: [], error: null });
});

test('round-trips posts and sorts them newest first', () => {
  const storage = new MemoryStorage();
  const older = createPost('第一条', new Date('2026-11-13T08:00:00.000Z'), 'older');
  const newer = createPost('第二条', new Date('2026-11-13T09:00:00.000Z'), 'newer');

  assert.deepEqual(savePosts(storage, [older, newer]), { ok: true, error: null });
  assert.deepEqual(loadPosts(storage), { posts: [newer, older], error: null });
  assert.ok(storage.getItem(STORAGE_KEY));
});

test('recovers from malformed JSON without throwing', () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, '{broken');

  assert.deepEqual(loadPosts(storage), { posts: [], error: 'DATA_INVALID' });
});

test('filters invalid records and normalizes valid records', () => {
  const storage = new MemoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify([
    null,
    { id: '', content: '无标识', createdAt: '2026-11-13T08:00:00.000Z' },
    { id: 'bad-date', content: '错误时间', createdAt: 'not-a-date' },
    { id: 'too-long', content: '字'.repeat(MAX_CONTENT_LENGTH + 1), createdAt: '2026-11-13T08:00:00.000Z' },
    { id: 'valid', content: '  保留这条  ', createdAt: '2026-11-13T08:00:00.000Z' },
  ]));

  assert.deepEqual(loadPosts(storage), {
    posts: [{ id: 'valid', content: '保留这条', createdAt: '2026-11-13T08:00:00.000Z' }],
    error: 'DATA_INVALID',
  });
});

test('converts storage read failures into a result', () => {
  const storage = { getItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadPosts(storage), { posts: [], error: 'STORAGE_READ_FAILED' });
});

test('converts storage write failures into a result', () => {
  const storage = { setItem() { throw new Error('quota exceeded'); } };
  const post = createPost('无法保存');

  assert.deepEqual(savePosts(storage, [post]), { ok: false, error: 'STORAGE_WRITE_FAILED' });
});

test('preserves HTML-like text as plain content', () => {
  const content = '<img src=x onerror=alert(1)>';
  assert.equal(createPost(content).content, content);
});
