import { normalizePost } from '@/lib/postRules';

export const POSTS_ENDPOINT = '/api/posts';
export const NETWORK_ERROR_MESSAGE = '网络连接失败，请检查网络后重试。你的文字仍保留在输入框中。';
export const INVALID_RESPONSE_MESSAGE = '服务器返回的数据无法识别，请稍后重试。你的文字仍保留在输入框中。';

export class PostsApiError extends Error {
  constructor(code, message, status = 0) {
    super(message);
    this.name = 'PostsApiError';
    this.code = code;
    this.status = status;
  }
}

function resolveFetch(fetchImpl) {
  const impl = fetchImpl ?? globalThis.fetch;
  if (typeof impl !== 'function') {
    throw new PostsApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE);
  }
  return impl;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function errorFromBody(body, status) {
  const error = body?.error;
  if (error && typeof error.code === 'string' && error.code
    && typeof error.message === 'string' && error.message) {
    return new PostsApiError(error.code, error.message, status);
  }
  return new PostsApiError('INVALID_RESPONSE', INVALID_RESPONSE_MESSAGE, status);
}

export function createPostsApi({ fetch: fetchImpl, endpoint = POSTS_ENDPOINT } = {}) {
  async function request(init = {}) {
    const doFetch = resolveFetch(fetchImpl);

    let response;
    try {
      response = await doFetch(endpoint, init);
    } catch (error) {
      if (error instanceof PostsApiError) throw error;
      throw new PostsApiError('NETWORK_ERROR', NETWORK_ERROR_MESSAGE);
    }

    if (!response || typeof response !== 'object' || typeof response.ok !== 'boolean') {
      throw new PostsApiError('INVALID_RESPONSE', INVALID_RESPONSE_MESSAGE);
    }

    const body = await readJson(response);
    if (!response.ok) throw errorFromBody(body, response.status);
    if (body === undefined || body === null) {
      throw new PostsApiError('INVALID_RESPONSE', INVALID_RESPONSE_MESSAGE, response.status);
    }

    return { body, status: response.status };
  }

  async function listPosts() {
    const { body, status } = await request({
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!Array.isArray(body.posts)) {
      throw new PostsApiError('INVALID_RESPONSE', INVALID_RESPONSE_MESSAGE, status);
    }

    const posts = [];
    for (const record of body.posts) {
      const post = normalizePost(record);
      if (!post) throw new PostsApiError('INVALID_RESPONSE', INVALID_RESPONSE_MESSAGE, status);
      posts.push(post);
    }
    return posts;
  }

  async function createPost(content) {
    const { body, status } = await request({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ content }),
    });

    const post = normalizePost(body.post);
    if (!post) throw new PostsApiError('INVALID_RESPONSE', INVALID_RESPONSE_MESSAGE, status);
    return post;
  }

  return { listPosts, createPost };
}

export function listPosts(options) {
  return createPostsApi(options).listPosts();
}

export function createPost(content, options) {
  return createPostsApi(options).createPost(content);
}
