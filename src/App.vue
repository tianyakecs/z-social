<script setup>
import { computed } from 'vue';
import { storeToRefs } from 'pinia';

import AppHeader from '@/components/AppHeader.vue';
import HeroSection from '@/components/HeroSection.vue';
import PostComposer from '@/components/PostComposer.vue';
import PostTimeline from '@/components/PostTimeline.vue';
import { useAmbientEffects } from '@/composables/useAmbientEffects';
import { usePostsStore } from '@/stores/posts';

const postsStore = usePostsStore();
const { posts, postCount, loadError } = storeToRefs(postsStore);
const { effectsEnabled, toggleEffects } = useAmbientEffects();

postsStore.hydrate();

const loadStatus = computed(() => {
  if (loadError.value === 'DATA_INVALID') {
    return {
      state: 'warning',
      message: '检测到异常数据，已恢复其中可用的动态。',
    };
  }

  if (loadError.value === 'STORAGE_READ_FAILED') {
    return {
      state: 'error',
      message: '无法读取本地数据，请检查浏览器的存储权限。',
    };
  }

  return null;
});
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
      <PostComposer />
      <PostTimeline :posts="posts" />
    </div>
  </main>

  <footer class="site-footer shell">
    <span class="footer-mark" aria-hidden="true">Z.</span>
    <p>灵感留在此处，数据留在本地。</p>
    <span class="footer-tech">SIMPLE · PRIVATE · YOURS</span>
  </footer>
</template>
