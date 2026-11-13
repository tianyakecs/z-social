<script setup>
import { computed, ref, shallowRef } from 'vue';

import { MAX_CONTENT_LENGTH } from '@/lib/postRules';
import { usePostsStore } from '@/stores/posts';

const INPUT_ERROR_CODES = new Set(['EMPTY_POST', 'POST_TOO_LONG', 'INVALID_CONTENT']);

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
});

const postsStore = usePostsStore();
const draft = ref('');
const isSubmitting = ref(false);
const inputInvalid = shallowRef(false);
const status = shallowRef({ message: '', state: '' });

const characterCount = computed(() => Array.from(draft.value).length);
const isNearLimit = computed(() => characterCount.value > 250
  && characterCount.value <= MAX_CONTENT_LENGTH);
const isOverLimit = computed(() => characterCount.value > MAX_CONTENT_LENGTH);

function setStatus(message = '', state = '') {
  status.value = { message, state };
}

function handleDraftInput() {
  inputInvalid.value = isOverLimit.value;
  if (status.value.state === 'error') setStatus();
}

async function submitPost() {
  if (props.disabled || isSubmitting.value) return;

  setStatus();
  isSubmitting.value = true;

  try {
    const result = await postsStore.publish(draft.value);

    if (!result.ok) {
      inputInvalid.value = INPUT_ERROR_CODES.has(result.error);
      setStatus(result.message, 'error');
      return;
    }

    draft.value = '';
    inputInvalid.value = false;
    setStatus('发布成功，想法已添加到时间线。', 'success');
  } finally {
    isSubmitting.value = false;
  }
}

function handleShortcut(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}
</script>

<template>
  <section id="composer" class="composer" aria-labelledby="composer-title" data-reveal>
    <div class="composer-heading">
      <div class="composer-title-wrap">
        <span class="composer-avatar" aria-hidden="true">Z</span>
        <div>
          <p class="section-kicker">A MOMENT OF YOURS</p>
          <h2 id="composer-title">分享此刻</h2>
        </div>
      </div>
      <span class="soft-badge">轻松表达</span>
    </div>

    <form id="post-form" novalidate @submit.prevent="submitPost">
      <label class="sr-only" for="post-content">动态内容</label>
      <div class="input-wrap">
        <textarea
          id="post-content"
          v-model="draft"
          name="content"
          rows="4"
          placeholder="此刻，你在想什么？"
          aria-describedby="content-help char-count form-status"
          :aria-invalid="inputInvalid || isOverLimit ? 'true' : undefined"
          :disabled="disabled"
          required
          @input="handleDraftInput"
          @keydown="handleShortcut"
        ></textarea>
      </div>
      <div class="composer-bottom">
        <p id="content-help" class="privacy-note">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.5 8V6a3.5 3.5 0 0 1 7 0v2M5 8h10v8H5V8Z"></path></svg>
          内容会保存到演示服务器，重启后清空
        </p>
        <div class="publish-actions">
          <span
            id="char-count"
            class="character-count"
            :class="{ 'is-near-limit': isNearLimit, 'is-over-limit': isOverLimit }"
          >{{ characterCount }} / {{ MAX_CONTENT_LENGTH }}</span>
          <button
            class="publish-button"
            type="submit"
            :disabled="disabled || isSubmitting"
            :aria-busy="disabled || isSubmitting ? 'true' : undefined"
          >
            <span>发布动态</span>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10M11 6l4 4-4 4"></path></svg>
          </button>
        </div>
      </div>
      <p id="form-status" class="form-status" role="status" aria-live="polite" :data-state="status.state || undefined">
        {{ status.message }}
      </p>
    </form>
  </section>
</template>
