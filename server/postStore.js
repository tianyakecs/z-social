export const MAX_CONTENT_LENGTH = 280;

export const POST_ERROR_MESSAGES = {
  EMPTY_POST: '写点什么再发布吧。',
  POST_TOO_LONG: `内容不能超过 ${MAX_CONTENT_LENGTH} 字。`,
  INVALID_CONTENT: '内容必须是文本。',
};

export class PostError extends Error {
  constructor(code) {
    super(POST_ERROR_MESSAGES[code] ?? '动态内容无效。');
    this.name = 'PostError';
    this.code = code;
  }
}

function defaultNow() {
  return new Date();
}

function defaultGenerateId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toIsoString(now) {
  const value = typeof now === 'function' ? now() : now;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid creation date is required.');
  return date.toISOString();
}

function toPost(record) {
  return {
    id: record.id,
    content: record.content,
    createdAt: record.createdAt,
    likeCount: record.likeCount,
    favoriteCount: record.favoriteCount,
    liked: record.liked,
    favorited: record.favorited,
  };
}

export function createMemoryPostStore(options = {}) {
  const now = options.now ?? defaultNow;
  const generateId = options.generateId ?? defaultGenerateId;
  const records = new Map();
  let sequence = 0;

  function list() {
    return [...records.values()]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.sequence - a.sequence)
      .map(toPost);
  }

  function getById(id) {
    const record = records.get(id);
    return record ? toPost(record) : null;
  }

  function create(content) {
    if (typeof content !== 'string') throw new PostError('INVALID_CONTENT');

    const trimmed = content.trim();
    if (!trimmed) throw new PostError('EMPTY_POST');
    if (Array.from(trimmed).length > MAX_CONTENT_LENGTH) throw new PostError('POST_TOO_LONG');

    const record = {
      id: String(generateId()),
      content: trimmed,
      createdAt: toIsoString(now),
      sequence: sequence++,
      likeCount: 0,
      favoriteCount: 0,
      liked: false,
      favorited: false,
    };

    records.set(record.id, record);
    return toPost(record);
  }

  function toggleLike(id) {
    const record = records.get(id);
    if (!record) return null;

    if (record.liked) {
      record.liked = false;
      record.likeCount = Math.max(0, record.likeCount - 1);
    } else {
      record.liked = true;
      record.likeCount += 1;
    }

    return toPost(record);
  }

  function toggleFavorite(id) {
    const record = records.get(id);
    if (!record) return null;

    if (record.favorited) {
      record.favorited = false;
      record.favoriteCount = Math.max(0, record.favoriteCount - 1);
    } else {
      record.favorited = true;
      record.favoriteCount += 1;
    }

    return toPost(record);
  }

  return { list, getById, create, toggleLike, toggleFavorite };
}
