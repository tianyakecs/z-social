import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';

import { PostsApiError, createPostsApi } from '@/lib/postsApi';
import { validateContent } from '@/lib/postRules';

const UNKNOWN_ERROR_MESSAGE = '发布时遇到问题，请稍后重试。你的文字仍保留在输入框中。';
const UNKNOWN_LOAD_MESSAGE = '动态加载失败，请稍后重试。';
const BUSY_MESSAGE = '正在发布，请稍候。';

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

  return {
    posts,
    loading,
    publishing,
    loadError,
    postCount,
    isEmpty,
    hydrate,
    publish,
  };
});
