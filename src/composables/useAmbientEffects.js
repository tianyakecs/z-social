import { onBeforeUnmount, onMounted, shallowRef } from 'vue';

export function useAmbientEffects() {
  const effectsEnabled = shallowRef(true);
  let pointerGlow = null;
  let reducedMotion = null;
  let finePointer = null;
  let revealObserver = null;
  let parallaxItems = [];
  let pointerFrame = 0;
  let pointerX = 0;
  let pointerY = 0;

  function resetParallax() {
    for (const item of parallaxItems) {
      item.style.setProperty('--parallax-x', '0px');
      item.style.setProperty('--parallax-y', '0px');
    }
  }

  function applyEffectsState() {
    document.body.classList.toggle('effects-off', !effectsEnabled.value);
    if (!effectsEnabled.value) {
      document.body.classList.remove('pointer-active');
      resetParallax();
    }
  }

  function toggleEffects() {
    effectsEnabled.value = !effectsEnabled.value;
    applyEffectsState();
  }

  function handlePointerMove(event) {
    if (!effectsEnabled.value || reducedMotion?.matches || !finePointer?.matches) return;

    pointerX = event.clientX;
    pointerY = event.clientY;
    document.body.classList.add('pointer-active');

    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      if (pointerGlow) {
        pointerGlow.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
      }

      const offsetX = (pointerX / window.innerWidth - 0.5) * 24;
      const offsetY = (pointerY / window.innerHeight - 0.5) * 18;
      for (const item of parallaxItems) {
        const depth = Number(item.dataset.parallax) || 1;
        item.style.setProperty('--parallax-x', `${offsetX * depth}px`);
        item.style.setProperty('--parallax-y', `${offsetY * depth}px`);
      }
      pointerFrame = 0;
    });
  }

  function handleMouseLeave() {
    document.body.classList.remove('pointer-active');
    resetParallax();
  }

  function setupReveal() {
    const elements = [...document.querySelectorAll('[data-reveal]')];
    if (!effectsEnabled.value
      || reducedMotion?.matches
      || typeof IntersectionObserver === 'undefined') {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    revealObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove('reveal-pending');
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -32px' });

    elements.forEach((element, index) => {
      element.classList.add('reveal-pending');
      element.style.setProperty('--reveal-delay', `${(index % 2) * 90}ms`);
      revealObserver.observe(element);
    });
  }

  function handleMotionPreference(event) {
    if (!event.matches) return;
    effectsEnabled.value = false;
    applyEffectsState();
  }

  onMounted(() => {
    pointerGlow = document.querySelector('#pointer-glow');
    parallaxItems = [...document.querySelectorAll('[data-parallax]')];
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    finePointer = window.matchMedia('(pointer: fine)');
    effectsEnabled.value = !reducedMotion.matches;

    applyEffectsState();
    setupReveal();
    document.addEventListener('pointermove', handlePointerMove);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    reducedMotion.addEventListener?.('change', handleMotionPreference);
  });

  onBeforeUnmount(() => {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    revealObserver?.disconnect();
    document.removeEventListener('pointermove', handlePointerMove);
    document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
    reducedMotion?.removeEventListener?.('change', handleMotionPreference);
    document.body.classList.remove('pointer-active', 'effects-off');
  });

  return {
    effectsEnabled,
    toggleEffects,
  };
}
