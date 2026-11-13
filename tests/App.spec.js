import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import App from '@/App.vue';
import { STORAGE_KEY } from '@/lib/postStorage';

function mountApp() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(App, {
    global: { plugins: [pinia] },
    attachTo: document.body,
  });
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the empty state on a fresh browser', () => {
    const wrapper = mountApp();

    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(wrapper.findAll('.post-card')).toHaveLength(0);
    expect(wrapper.get('#post-count').text()).toBe('0');
  });

  it('hydrates persisted posts and exposes the current count', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      {
        id: 'persisted',
        content: '刷新后还在',
        createdAt: '2026-11-13T08:00:00.000Z',
      },
    ]));

    const wrapper = mountApp();

    expect(wrapper.find('.empty-state').exists()).toBe(false);
    expect(wrapper.findAll('.post-card')).toHaveLength(1);
    expect(wrapper.get('#post-count').text()).toBe('1');
    expect(wrapper.get('.post-content').text()).toBe('刷新后还在');
  });
});
