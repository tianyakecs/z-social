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

export function normalizePost(record) {
  if (!record || typeof record !== 'object') return null;
  if (typeof record.id !== 'string' || !record.id.trim()) return null;
  if (typeof record.content !== 'string') return null;

  const content = record.content.trim();
  if (!content || characterCount(content) > MAX_CONTENT_LENGTH) return null;

  const createdAt = new Date(record.createdAt);
  if (Number.isNaN(createdAt.getTime())) return null;

  return { id: record.id, content, createdAt: createdAt.toISOString() };
}
