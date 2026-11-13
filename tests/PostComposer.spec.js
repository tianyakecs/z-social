import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import PostComposer from '@/components/PostComposer.vue';
import { usePostsStore } from '@/stores/posts';

function mountComposer() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(PostComposer, {
    global: { plugins: [pinia] },
  });
}

describe('PostComposer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows validation feedback for empty content', async () => {
    const wrapper = mountComposer();

    await wrapper.get('form').trigger('submit');

    expect(wrapper.get('.form-status').text()).toBe('写点什么再发布吧。');
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true');
  });

  it('counts Unicode characters and blocks content over 280 characters', async () => {
    const wrapper = mountComposer();
    const textarea = wrapper.get('textarea');

    await textarea.setValue('😀'.repeat(281));
    expect(wrapper.get('.character-count').text()).toBe('281 / 280');

    await wrapper.get('form').trigger('submit');
    expect(wrapper.get('.form-status').text()).toBe('内容不能超过 280 字。');
    expect(textarea.element.value).toBe('😀'.repeat(281));
  });

  it('clears the draft and announces success after publishing', async () => {
    const wrapper = mountComposer();
    const textarea = wrapper.get('textarea');

    await textarea.setValue('一条新的想法');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.get('.form-status').text()).toContain('发布成功');
    expect(textarea.element.value).toBe('');
    expect(usePostsStore().posts).toHaveLength(1);
  });

  it('keeps the draft when storage writing fails', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const wrapper = mountComposer();
    const textarea = wrapper.get('textarea');

    await textarea.setValue('不能丢失的草稿');
    await wrapper.get('form').trigger('submit');

    expect(wrapper.get('.form-status').text()).toContain('发布失败');
    expect(textarea.element.value).toBe('不能丢失的草稿');
  });
});
