<script setup>
import { ref } from 'vue';

import heroImage from '@/assets/images/z-hero.jpg';
import orbitImage from '@/assets/images/z-orbit.svg';

defineProps({
  postCount: {
    type: Number,
    required: true,
  },
});

const mainImageFailed = ref(false);
const orbitFailed = ref(false);
</script>

<template>
  <section class="hero shell" aria-labelledby="hero-title">
    <div class="hero-copy-block" data-reveal>
      <div class="eyebrow"><span aria-hidden="true"></span>A QUIET PLACE FOR IDEAS</div>
      <h1 id="hero-title">让想法，<br><span>即刻连接。</span></h1>
      <p class="hero-copy">留一点空间，给此刻的灵感。<br class="desktop-break">简单记录，自在表达，让每一条思绪都有自己的位置。</p>
      <div class="hero-actions">
        <a class="hero-cta" href="#composer">记录此刻<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10h10M11 6l4 4-4 4"></path></svg></a>
        <span>无需账号，打开即写</span>
      </div>
      <div class="hero-meta">
        <span><strong id="post-count">{{ postCount }}</strong> 条动态</span>
        <span class="meta-divider" aria-hidden="true"></span>
        <span>所有访问者共享的演示空间</span>
      </div>
    </div>

    <div class="hero-visual" data-reveal aria-hidden="true">
      <div class="visual-halo"></div>
      <div class="hero-main-image" :class="{ 'image-error': mainImageFailed }" data-parallax="0.55">
        <img
          :src="heroImage"
          alt=""
          width="900"
          height="820"
          fetchpriority="high"
          @error="mainImageFailed = true"
        >
      </div>
      <div v-show="!orbitFailed" class="hero-orbit-image" data-parallax="1.1">
        <img :src="orbitImage" alt="" width="640" height="640" @error="orbitFailed = true">
      </div>
      <div class="floating-note note-saved" data-parallax="0.8">
        <span class="note-icon"><svg viewBox="0 0 20 20"><path d="m5 10 3 3 7-7"></path></svg></span>
        <span><strong>灵感已发布</strong><small>保存在服务器</small></span>
      </div>
      <div class="floating-note note-private" data-parallax="0.35">
        <svg viewBox="0 0 20 20"><path d="M6.5 8V6a3.5 3.5 0 0 1 7 0v2M5 8h10v8H5V8Z"></path></svg>
        仅自己可见
      </div>
    </div>
  </section>
</template>
