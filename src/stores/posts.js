import { computed, ref, shallowRef } from 'vue';
import { defineStore } from 'pinia';

import {
  PostInputError,
  createPost,
  loadPosts,
  savePosts,
} from '@/lib/postStorage';

const WRITE_ERROR_MESSAGE = '发布失败，浏览器无法保存内容。你的文字仍保留在输入框中。';
const UNKNOWN_ERROR_MESSAGE = '发布时遇到问题，请稍后重试。你的文字仍保留在输入框中。';

function getDefaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export const usePostsStore = defineStore('posts', () => {
  const posts = ref([]);
  const loadError = shallowRef(null);
  const postCount = computed(() => posts.value.length);
  const isEmpty = computed(() => posts.value.length === 0);

  function hydrate(storage = getDefaultStorage()) {
    const result = loadPosts(storage);
    posts.value = result.posts;
    loadError.value = result.error;
    return result;
  }

  function publish(content, { storage = getDefaultStorage(), now = new Date() } = {}) {
    try {
      const post = createPost(content, now);
      const nextPosts = [post, ...posts.value];
      const saved = savePosts(storage, nextPosts);

      if (!saved.ok) {
        return {
          ok: false,
          error: saved.error,
          message: WRITE_ERROR_MESSAGE,
        };
      }

      posts.value = nextPosts;
      return { ok: true, post, error: null, message: null };
    } catch (error) {
      if (error instanceof PostInputError) {
        return { ok: false, error: error.code, message: error.message };
      }

      return { ok: false, error: 'UNKNOWN_ERROR', message: UNKNOWN_ERROR_MESSAGE };
    }
  }

  return {
    posts,
    loadError,
    postCount,
    isEmpty,
    hydrate,
    publish,
  };
});
