export const MAX_CONTENT_LENGTH = 280;

export const POST_ERROR_MESSAGES = {
  EMPTY_POST: '写点什么再发布吧。',
  POST_TOO_LONG: `内容不能超过 ${MAX_CONTENT_LENGTH} 字。`,
  INVALID_CONTENT: '内容必须是文本。',
};

export class PostInputError extends Error {
  constructor(code) {
    super(POST_ERROR_MESSAGES[code] ?? '动态内容无效。');
    this.name = 'PostInputError';
    this.code = code;
  }
}

export function characterCount(value) {
  return Array.from(value).length;
}

export function validateContent(content) {
  if (typeof content !== 'string') throw new PostInputError('INVALID_CONTENT');

  const trimmed = content.trim();
  if (!trimmed) throw new PostInputError('EMPTY_POST');
  if (characterCount(trimmed) > MAX_CONTENT_LENGTH) throw new PostInputError('POST_TOO_LONG');

  return trimmed;
}

function normalizeCount(value, fallback) {
  // 契约：缺失 / undefined 才补默认值；显式传入的非法值必须判定为非法
  if (value === undefined) return fallback;
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function normalizeFlag(value, fallback) {
  if (value === undefined) return fallback;
  return typeof value === 'boolean' ? value : null;
}

export function normalizePost(record) {
  if (!record || typeof record !== 'object') return null;
  if (typeof record.id !== 'string' || !record.id.trim()) return null;
  if (typeof record.content !== 'string') return null;

  const content = record.content.trim();
  if (!content || characterCount(content) > MAX_CONTENT_LENGTH) return null;

  const createdAt = new Date(record.createdAt);
  if (Number.isNaN(createdAt.getTime())) return null;

  const likeCount = normalizeCount(record.likeCount, 0);
  const favoriteCount = normalizeCount(record.favoriteCount, 0);
  const liked = normalizeFlag(record.liked, false);
  const favorited = normalizeFlag(record.favorited, false);

  if (likeCount === null || favoriteCount === null || liked === null || favorited === null) {
    return null;
  }

  return {
    id: record.id,
    content,
    createdAt: createdAt.toISOString(),
    likeCount,
    favoriteCount,
    liked,
    favorited,
  };
}
