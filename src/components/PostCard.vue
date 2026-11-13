<script setup>
import { computed } from 'vue';

const props = defineProps({
  post: {
    type: Object,
    required: true,
  },
  pending: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['toggle-like', 'toggle-favorite']);

const formattedTime = computed(() => {
  const date = new Date(props.post.createdAt);
  const options = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  if (date.getFullYear() !== new Date().getFullYear()) options.year = 'numeric';
  return new Intl.DateTimeFormat('zh-CN', options).format(date);
});

const fullTime = computed(() => new Date(props.post.createdAt)
  .toLocaleString('zh-CN', { hour12: false }));

function toCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

// 旧的 Post 对象可能没有新字段，这里做兜底，避免渲染期报错
const likeCount = computed(() => toCount(props.post.likeCount));
const favoriteCount = computed(() => toCount(props.post.favoriteCount));
const liked = computed(() => props.post.liked === true);
const favorited = computed(() => props.post.favorited === true);

const likeLabel = computed(() => (liked.value ? '取消点赞' : '点赞'));
const favoriteLabel = computed(() => (favorited.value ? '取消收藏' : '收藏'));

function onToggleLike() {
  emit('toggle-like', props.post.id);
}

function onToggleFavorite() {
  emit('toggle-favorite', props.post.id);
}
</script>

<template>
  <article class="post-card">
    <div class="timeline-node" aria-hidden="true"><span></span></div>
    <div class="post-card-top">
      <span class="post-signal"><span class="post-avatar" aria-hidden="true">Z</span>此刻的想法</span>
      <time class="post-time" :datetime="post.createdAt" :title="fullTime">{{ formattedTime }}</time>
    </div>
    <p class="post-content">{{ post.content }}</p>
    <div class="post-actions">
      <button
        type="button"
        class="post-action post-action-like"
        :class="{ 'is-active': liked }"
        :aria-pressed="liked ? 'true' : 'false'"
        :aria-label="likeLabel"
        :disabled="pending"
        @click="onToggleLike"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 20.2s-7.3-4.6-7.3-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7.3 2.6c0 5-7.3 9.6-7.3 9.6z" />
        </svg>
        <span class="action-count">{{ likeCount }}</span>
      </button>
      <button
        type="button"
        class="post-action post-action-favorite"
        :class="{ 'is-active': favorited }"
        :aria-pressed="favorited ? 'true' : 'false'"
        :aria-label="favoriteLabel"
        :disabled="pending"
        @click="onToggleFavorite"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 4.8l2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.5-4.6 2.5.9-5.2-3.8-3.7 5.2-.8z" />
        </svg>
        <span class="action-count">{{ favoriteCount }}</span>
      </button>
    </div>
    <div class="post-card-bottom" aria-hidden="true">
      <span>已发布到服务器</span><span class="saved-check">✓</span>
    </div>
  </article>
</template>
