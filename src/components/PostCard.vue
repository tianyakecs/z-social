<script setup>
import { computed } from 'vue';

const props = defineProps({
  post: {
    type: Object,
    required: true,
  },
});

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
</script>

<template>
  <article class="post-card">
    <div class="timeline-node" aria-hidden="true"><span></span></div>
    <div class="post-card-top">
      <span class="post-signal"><span class="post-avatar" aria-hidden="true">Z</span>此刻的想法</span>
      <time class="post-time" :datetime="post.createdAt" :title="fullTime">{{ formattedTime }}</time>
    </div>
    <p class="post-content">{{ post.content }}</p>
    <div class="post-card-bottom" aria-hidden="true">
      <span>已发布到服务器</span><span class="saved-check">✓</span>
    </div>
  </article>
</template>
