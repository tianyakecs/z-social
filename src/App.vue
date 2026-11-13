<script setup>
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';

import AppHeader from '@/components/AppHeader.vue';
import HeroSection from '@/components/HeroSection.vue';
import PostComposer from '@/components/PostComposer.vue';
import PostTimeline from '@/components/PostTimeline.vue';
import { useAmbientEffects } from '@/composables/useAmbientEffects';
import { usePostsStore } from '@/stores/posts';

const postsStore = usePostsStore();
const { posts, postCount, loading, loadError, pendingReactionIds } = storeToRefs(postsStore);
const { effectsEnabled, toggleEffects } = useAmbientEffects();

const reactionStatus = ref(null);

onMounted(() => {
  void postsStore.hydrate();
});

const loadStatus = computed(() => {
  if (loading.value) {
    return { state: 'loading', message: '正在从服务器加载动态…' };
  }

  if (loadError.value) {
    return { state: 'error', message: loadError.value.message };
  }

  return null;
});

function reportReaction(result) {
  reactionStatus.value = result?.ok
    ? null
    : { state: 'error', message: result?.message ?? '操作没有成功，请稍后重试。' };
}

async function handleToggleLike(postId) {
  reportReaction(await postsStore.toggleLike(postId));
}

async function handleToggleFavorite(postId) {
  reportReaction(await postsStore.toggleFavorite(postId));
}
</script>

<template>
  <a class="skip-link" href="#post-content">跳转到发布区</a>

  <div class="environment" aria-hidden="true">
    <div class="ambient-shape shape-blue"></div>
    <div class="ambient-shape shape-lilac"></div>
    <div class="ambient-shape shape-mint"></div>
    <div class="soft-dots"></div>
  </div>
  <div id="pointer-glow" class="pointer-glow" aria-hidden="true"></div>

  <AppHeader
    :effects-enabled="effectsEnabled"
    @toggle-effects="toggleEffects"
  />

  <main>
    <p
      v-if="loadStatus"
      class="load-status shell"
      role="status"
      :data-state="loadStatus.state"
    >{{ loadStatus.message }}</p>

    <HeroSection :post-count="postCount" />

    <div class="content-column">
      <PostComposer :disabled="loading" />
      <p
        v-if="reactionStatus"
        class="reaction-status"
        role="status"
        :data-state="reactionStatus.state"
      >{{ reactionStatus.message }}</p>
      <PostTimeline
        :posts="posts"
        :pending-ids="pendingReactionIds"
        @toggle-like="handleToggleLike"
        @toggle-favorite="handleToggleFavorite"
      />
    </div>
  </main>

  <footer class="site-footer shell">
    <span class="footer-mark" aria-hidden="true">Z.</span>
    <p>灵感发布在此处，数据保存在演示服务器。</p>
    <span class="footer-tech">SIMPLE · SHARED · FRESH</span>
  </footer>
</template>
