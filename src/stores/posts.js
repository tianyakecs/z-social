import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';

import { PostsApiError, createPostsApi } from '@/lib/postsApi';
import { normalizePost, validateContent } from '@/lib/postRules';

const UNKNOWN_ERROR_MESSAGE = '发布时遇到问题，请稍后重试。你的文字仍保留在输入框中。';
const UNKNOWN_LOAD_MESSAGE = '动态加载失败，请稍后重试。';
const BUSY_MESSAGE = '正在发布，请稍候。';
const REACTION_PENDING_MESSAGE = '上一次操作还在处理中，请稍候再试。';
const INVALID_REACTION_POST_MESSAGE = '动态标识无效，请刷新后重试。';
const UNKNOWN_REACTION_MESSAGE = '操作没有成功，请稍后重试。';

const REACTION_METHODS = {
  like: 'toggleLike',
  favorite: 'toggleFavorite',
};

let defaultService = null;

function getDefaultService() {
  if (!defaultService) defaultService = createPostsApi();
  return defaultService;
}

function toErrorPayload(error, fallbackMessage) {
  if (error instanceof PostsApiError) {
    return { code: error.code, message: error.message, status: error.status };
  }

  if (error && typeof error === 'object' && typeof error.code === 'string' && error.code) {
    return {
      code: error.code,
      message: typeof error.message === 'string' && error.message ? error.message : fallbackMessage,
      status: 0,
    };
  }

  return { code: 'UNKNOWN_ERROR', message: fallbackMessage, status: 0 };
}

export const usePostsStore = defineStore('posts', () => {
  const posts = ref([]);
  const loading = ref(false);
  const publishing = ref(false);
  const loadError = shallowRef(null);
  const pendingReactionIds = ref([]);

  const postCount = computed(() => posts.value.length);
  const isEmpty = computed(() => posts.value.length === 0);

  async function hydrate({ service = getDefaultService() } = {}) {
    loading.value = true;
    loadError.value = null;

    try {
      const list = await service.listPosts();
      posts.value = Array.isArray(list) ? list : [];
      return { ok: true, posts: posts.value, error: null };
    } catch (error) {
      const payload = toErrorPayload(error, UNKNOWN_LOAD_MESSAGE);
      loadError.value = { code: payload.code, message: payload.message };
      return {
        ok: false,
        posts: posts.value,
        error: payload.code,
        message: payload.message,
        status: payload.status,
      };
    } finally {
      loading.value = false;
    }
  }

  async function publish(content, { service = getDefaultService() } = {}) {
    if (publishing.value) {
      return { ok: false, post: null, error: 'PUBLISHING', message: BUSY_MESSAGE, status: 0 };
    }

    let trimmed;
    try {
      trimmed = validateContent(content);
    } catch (error) {
      const payload = toErrorPayload(error, UNKNOWN_ERROR_MESSAGE);
      return { ok: false, post: null, error: payload.code, message: payload.message, status: 0 };
    }

    publishing.value = true;

    try {
      const post = await service.createPost(trimmed);
      posts.value = [post, ...posts.value.filter((item) => item.id !== post.id)];
      return { ok: true, post, error: null, message: null, status: 201 };
    } catch (error) {
      const payload = toErrorPayload(error, UNKNOWN_ERROR_MESSAGE);
      return {
        ok: false,
        post: null,
        error: payload.code,
        message: payload.message,
        status: payload.status,
      };
    } finally {
      publishing.value = false;
    }
  }

  async function toggleReaction(kind, postId, { service = getDefaultService() } = {}) {
    const id = typeof postId === 'string' ? postId : '';

    if (!id) {
      return {
        ok: false,
        post: null,
        error: 'INVALID_POST_ID',
        message: INVALID_REACTION_POST_MESSAGE,
        status: 0,
      };
    }

    // 同一动态同一时刻只允许一个进行中的切换请求
    if (pendingReactionIds.value.includes(id)) {
      return {
        ok: false,
        post: null,
        error: 'REACTION_PENDING',
        message: REACTION_PENDING_MESSAGE,
        status: 0,
      };
    }

    pendingReactionIds.value = [...pendingReactionIds.value, id];

    try {
      const method = REACTION_METHODS[kind];
      const raw = await service[method](id);
      const next = normalizePost(raw);

      if (!next || next.id !== id) {
        return {
          ok: false,
          post: null,
          error: 'INVALID_RESPONSE',
          message: INVALID_REACTION_POST_MESSAGE,
          status: 0,
        };
      }

      // 原地替换同 id 项，保持既有顺序，不重新排序
      posts.value = posts.value.map((item) => (item.id === next.id ? next : item));

      return { ok: true, post: next, error: null, message: null, status: 200 };
    } catch (error) {
      const payload = toErrorPayload(error, UNKNOWN_REACTION_MESSAGE);
      return {
        ok: false,
        post: null,
        error: payload.code,
        message: payload.message,
        status: payload.status,
      };
    } finally {
      pendingReactionIds.value = pendingReactionIds.value.filter((item) => item !== id);
    }
  }

  function toggleLike(postId, { service = getDefaultService() } = {}) {
    return toggleReaction('like', postId, { service });
  }

  function toggleFavorite(postId, { service = getDefaultService() } = {}) {
    return toggleReaction('favorite', postId, { service });
  }

  return {
    posts,
    loading,
    publishing,
    loadError,
    pendingReactionIds,
    postCount,
    isEmpty,
    hydrate,
    publish,
    toggleLike,
    toggleFavorite,
  };
});
