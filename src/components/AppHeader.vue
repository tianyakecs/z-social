<script setup>
defineProps({
  effectsEnabled: {
    type: Boolean,
    required: true,
  },
});

defineEmits({
  toggleEffects: () => true,
});
</script>

<template>
  <header class="site-header">
    <nav class="nav shell" aria-label="主导航">
      <a class="brand" href="#" aria-label="Z 首页">
        <span class="brand-mark" aria-hidden="true">Z</span>
        <span class="brand-wordmark">Z<span class="brand-dot">.</span></span>
      </a>
      <div class="nav-actions">
        <span class="local-badge"><span class="status-dot" aria-hidden="true"></span>本地运行</span>
        <button
          class="effects-toggle"
          type="button"
          :aria-pressed="effectsEnabled"
          :aria-label="effectsEnabled ? '关闭装饰动效' : '开启装饰动效'"
          :title="effectsEnabled ? '关闭装饰动效' : '开启装饰动效'"
          @click="$emit('toggleEffects')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z"></path>
            <path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"></path>
          </svg>
          <span>动效</span>
        </button>
      </div>
    </nav>
  </header>
</template>
