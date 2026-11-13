export const STORAGE_KEY = 'z.posts.v1';
export const MAX_CONTENT_LENGTH = 280;

export class PostInputError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PostInputError';
    this.code = code;
  }
}

function characterCount(value) {
  return Array.from(value).length;
}

function createId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePost(record) {
  if (!record || typeof record !== 'object') return null;
  if (typeof record.id !== 'string' || !record.id.trim()) return null;
  if (typeof record.content !== 'string') return null;

  const content = record.content.trim();
  const date = new Date(record.createdAt);

  if (!content || characterCount(content) > MAX_CONTENT_LENGTH || Number.isNaN(date.getTime())) {
    return null;
  }

  return {
    id: record.id,
    content,
    createdAt: date.toISOString(),
  };
}

export function createPost(content, now = new Date(), id = createId()) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new PostInputError('EMPTY_POST', '写点什么再发布吧。');
  }

  const trimmedContent = content.trim();
  if (characterCount(trimmedContent) > MAX_CONTENT_LENGTH) {
    throw new PostInputError('POST_TOO_LONG', `内容不能超过 ${MAX_CONTENT_LENGTH} 字。`);
  }

  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('A valid creation date is required.');
  }

  return {
    id,
    content: trimmedContent,
    createdAt: now.toISOString(),
  };
}

export function loadPosts(storage) {
  let rawValue;
  try {
    rawValue = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return { posts: [], error: 'STORAGE_READ_FAILED' };
  }

  if (rawValue === null) return { posts: [], error: null };

  try {
    const records = JSON.parse(rawValue);
    if (!Array.isArray(records)) return { posts: [], error: 'DATA_INVALID' };

    let hasInvalidRecords = false;
    const posts = [];

    for (const record of records) {
      const post = normalizePost(record);
      if (post) posts.push(post);
      else hasInvalidRecords = true;
    }

    posts.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return { posts, error: hasInvalidRecords ? 'DATA_INVALID' : null };
  } catch {
    return { posts: [], error: 'DATA_INVALID' };
  }
}

export function savePosts(storage, posts) {
  try {
    if (!storage) throw new Error('Storage is unavailable.');
    storage.setItem(STORAGE_KEY, JSON.stringify(posts));
    return { ok: true, error: null };
  } catch {
    return { ok: false, error: 'STORAGE_WRITE_FAILED' };
  }
}
