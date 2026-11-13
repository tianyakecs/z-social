import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import PostComposer from '@/components/PostComposer.vue';
import { usePostsStore } from '@/stores/posts';

const CREATED = {
  id: 'created-1',
  content: '一条新的想法',
  createdAt: '2026-11-13T10:00:00.000Z',
};

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function stubFetch(handler) {
  const fetchMock = vi.fn(handler);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mountComposer() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return mount(PostComposer, { global: { plugins: [pinia] } });
}

let wrapper = null;

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
});

describe('PostComposer', () => {
  it('blocks empty content locally without calling fetch', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ post: CREATED }, 201));
    wrapper = mountComposer();

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('.form-status').text()).toBe('写点什么再发布吧。');
    expect(wrapper.get('.form-status').attributes('data-state')).toBe('error');
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBe('true');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(usePostsStore().posts).toEqual([]);
  });

  it('counts Unicode characters and blocks 281 characters locally', async () => {
    const fetchMock = stubFetch(async () => jsonResponse({ post: CREATED }, 201));
    wrapper = mountComposer();
    const overLimit = '😀'.repeat(281);

    await wrapper.get('textarea').setValue(overLimit);
    expect(wrapper.get('.character-count').text()).toBe('281 / 280');

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('.form-status').text()).toBe('内容不能超过 280 字。');
    expect(wrapper.get('textarea').element.value).toBe(overLimit);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(usePostsStore().posts).toEqual([]);
  });

  it('publishes through the API, then clears the draft and the pending state', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const fetchMock = stubFetch(async (url, init) => jsonResponse({
      post: { ...CREATED, content: JSON.parse(init.body).content },
    }, 201));
    wrapper = mountComposer();

    await wrapper.get('textarea').setValue('  一条新的想法  ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(wrapper.get('.form-status').text()).toContain('发布成功');
    expect(wrapper.get('.form-status').attributes('data-state')).toBe('success');
    expect(wrapper.get('textarea').element.value).toBe('');
    expect(wrapper.get('textarea').attributes('aria-invalid')).toBeUndefined();
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
    expect(usePostsStore().posts).toHaveLength(1);
    expect(usePostsStore().posts[0].content).toBe('一条新的想法');
    expect(setItem).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
  });

  it('disables the submit button while pending and ignores duplicate submits', async () => {
    let grant;
    const fetchMock = stubFetch(() => new Promise((resolve) => {
      grant = resolve;
    }));
    wrapper = mountComposer();

    await wrapper.get('textarea').setValue('等待中的想法');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();

    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBe('true');

    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    grant(jsonResponse({ post: { ...CREATED, content: '等待中的想法' } }, 201));
    await flushPromises();

    expect(wrapper.get('.form-status').text()).toContain('发布成功');
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
    expect(wrapper.get('button[type="submit"]').attributes('aria-busy')).toBeUndefined();
  });

  it('keeps the draft when the API rejects the publish', async () => {
    stubFetch(async () => jsonResponse({
      error: { code: 'POST_TOO_LONG', message: '内容不能超过 280 字。' },
    }, 422));
    wrapper = mountComposer();

    await wrapper.get('textarea').setValue('服务端认为过长');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('.form-status').text()).toContain('内容不能超过 280 字。');
    expect(wrapper.get('.form-status').attributes('data-state')).toBe('error');
    expect(wrapper.get('textarea').element.value).toBe('服务端认为过长');
    expect(usePostsStore().posts).toEqual([]);
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
  });

  it('keeps the draft when the network fails', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    wrapper = mountComposer();

    await wrapper.get('textarea').setValue('不能丢失的草稿');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('.form-status').text()).toContain('网络');
    expect(wrapper.get('.form-status').attributes('data-state')).toBe('error');
    expect(wrapper.get('textarea').element.value).toBe('不能丢失的草稿');
    expect(usePostsStore().posts).toEqual([]);
  });

  it('keeps the draft when the API response is unreadable', async () => {
    stubFetch(async () => jsonResponse({ nope: true }, 201));
    wrapper = mountComposer();

    await wrapper.get('textarea').setValue('响应异常时的草稿');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(wrapper.get('.form-status').text()).toContain('无法识别');
    expect(wrapper.get('textarea').element.value).toBe('响应异常时的草稿');
    expect(usePostsStore().posts).toEqual([]);
  });
});
