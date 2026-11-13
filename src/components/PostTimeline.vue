<script setup>
import EmptyState from '@/components/EmptyState.vue';
import PostCard from '@/components/PostCard.vue';

defineProps({
  posts: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <section class="feed" aria-labelledby="feed-title">
    <div class="feed-heading" data-reveal>
      <div>
        <p class="section-kicker">YOUR QUIET TIMELINE</p>
        <h2 id="feed-title">最近动态</h2>
      </div>
      <span class="feed-label"><span aria-hidden="true"></span>实时时间线</span>
    </div>

    <EmptyState v-if="posts.length === 0" />
    <ol v-else class="timeline" aria-live="polite" aria-relevant="additions">
      <li
        v-for="(post, index) in posts"
        :key="post.id"
        class="post-item"
        :style="{ '--post-index': Math.min(index, 6) }"
      >
        <PostCard :post="post" />
      </li>
    </ol>
  </section>
</template>
