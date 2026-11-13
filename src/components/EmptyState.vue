<script setup>
import { ref } from 'vue';

import emptyImage from '@/assets/images/z-empty.svg';

const imageFailed = ref(false);
</script>

<template>
  <div class="empty-state" data-reveal>
    <div class="empty-visual" :class="{ 'image-error': imageFailed }">
      <img
        :src="emptyImage"
        alt=""
        width="420"
        height="360"
        loading="lazy"
        @error="imageFailed = true"
      >
    </div>
    <h3>从一个小想法开始</h3>
    <p>不必想得太完整，写下来就很好。</p>
    <a href="#post-content">开始记录<span aria-hidden="true">↗</span></a>
  </div>
</template>
