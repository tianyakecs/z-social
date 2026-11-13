import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import App from '@/App.vue';

const POSTS = [
  { id: 'newer', content: '刷新后还在', createdAt: '2026-11-13T09:00:00.000Z' },
  { id: 'older', content: '更早的一条', createdAt: '2026-11-13T08:00:00.000Z' },
];

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function isRead(init) {
  return !init || init.method === 'GET';
}

let wrapper = null;

async function mountApp(fetchMock) {
  vi.stubGlobal('fetch', fetchMock);
  const pinia = createPinia();
  setActivePinia(pinia);
  wrapper = mount(App, {
    global: { plugins: [pinia] },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('App', () => {
  it('loads an empty timeline from the API', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ posts: [] }));

    const app = await mountApp(fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/posts');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    expect(app.find('.empty-state').exists()).toBe(true);
    expect(app.findAll('.post-card')).toHaveLength(0);
    expect(app.get('#post-count').text()).toBe('0');
    expect(app.find('.load-status').exists()).toBe(false);
  });

  it('renders the loaded posts and exposes the current count', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ posts: POSTS }));

    const app = await mountApp(fetchMock);

    expect(app.find('.empty-state').exists()).toBe(false);
    expect(app.findAll('.post-card')).toHaveLength(2);
    expect(app.get('#post-count').text()).toBe('2');
    expect(app.findAll('.post-content').map((node) => node.text()))
      .toEqual(['刷新后还在', '更早的一条']);
    expect(app.findAll('.post-action')).toHaveLength(4);
    expect(app.findAll('.action-count').map((node) => node.text())).toEqual(['0', '0', '0', '0']);
  });

  it('shows a loading indicator until the API responds', async () => {
    let grant;
    const fetchMock = vi.fn(() => new Promise((resolve) => {
      grant = resolve;
    }));

    const app = await mountApp(fetchMock);

    expect(app.get('.load-status').attributes('data-state')).toBe('loading');
    expect(app.get('textarea').attributes('disabled')).toBeDefined();
    expect(app.get('button[type="submit"]').attributes('disabled')).toBeDefined();

    grant(jsonResponse({ posts: POSTS }));
    await flushPromises();

    expect(app.find('.load-status').exists()).toBe(false);
    expect(app.findAll('.post-card')).toHaveLength(2);
    expect(app.get('textarea').attributes('disabled')).toBeUndefined();
    expect(app.get('button[type="submit"]').attributes('disabled')).toBeUndefined();
  });

  it('reports a load error and keeps the empty timeline', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

    const app = await mountApp(fetchMock);

    const status = app.get('.load-status');
    expect(status.attributes('data-state')).toBe('error');
    expect(status.text()).toContain('网络');
    expect(app.find('.empty-state').exists()).toBe(true);
    expect(app.findAll('.post-card')).toHaveLength(0);
    expect(app.get('#post-count').text()).toBe('0');
  });

  it('never reads or writes localStorage', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    await mountApp(vi.fn(async () => jsonResponse({ posts: POSTS })));

    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('likes a post through the API and renders the toggled state', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (isRead(init)) return jsonResponse({ posts: POSTS });
      if (url === '/api/posts/newer/like') {
        return jsonResponse({
          post: { ...POSTS[0], likeCount: 1, favoriteCount: 0, liked: true, favorited: false },
        });
      }
      return jsonResponse({ error: { code: 'NOT_FOUND', message: '动态不存在。' } }, 404);
    });

    const app = await mountApp(fetchMock);
    const likeButton = app.get('.post-card .post-action-like');
    expect(likeButton.attributes('aria-pressed')).toBe('false');
    expect(likeButton.attributes('aria-label')).toBe('点赞');

    await likeButton.trigger('click');
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('/api/posts/newer/like');
    expect(init.method).toBe('POST');

    const toggled = app.get('.post-card .post-action-like');
    expect(toggled.attributes('aria-pressed')).toBe('true');
    expect(toggled.attributes('aria-label')).toBe('取消点赞');
    expect(toggled.classes()).toContain('is-active');
    expect(toggled.get('.action-count').text()).toBe('1');
    expect(app.find('.reaction-status').exists()).toBe(false);
    expect(app.findAll('.post-card')).toHaveLength(2);
  });

  it('favorites a post through the API on the second card', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (isRead(init)) return jsonResponse({ posts: POSTS });
      if (url === '/api/posts/older/favorite') {
        return jsonResponse({
          post: { ...POSTS[1], likeCount: 0, favoriteCount: 4, liked: false, favorited: true },
        });
      }
      return jsonResponse({ error: { code: 'NOT_FOUND', message: '动态不存在。' } }, 404);
    });

    const app = await mountApp(fetchMock);

    await app.findAll('.post-action-favorite')[1].trigger('click');
    await flushPromises();

    expect(fetchMock.mock.calls[1][0]).toBe('/api/posts/older/favorite');
    const cards = app.findAll('.post-card');
    expect(cards[0].get('.post-action-favorite .action-count').text()).toBe('0');
    expect(cards[1].get('.post-action-favorite').attributes('aria-pressed')).toBe('true');
    expect(cards[1].get('.post-action-favorite .action-count').text()).toBe('4');
  });

  it('announces a failed toggle in a status region and keeps the list intact', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (isRead(init)) return jsonResponse({ posts: POSTS });
      return jsonResponse({ error: { code: 'NOT_FOUND', message: '动态不存在。' } }, 404);
    });

    const app = await mountApp(fetchMock);

    await app.get('.post-card .post-action-like').trigger('click');
    await flushPromises();

    const status = app.get('.reaction-status');
    expect(status.attributes('role')).toBe('status');
    expect(status.attributes('data-state')).toBe('error');
    expect(status.text()).toContain('动态不存在。');
    expect(/[\u4e00-\u9fa5]/.test(status.text())).toBe(true);

    expect(app.find('.load-status').exists()).toBe(false);
    expect(app.findAll('.post-card')).toHaveLength(2);
    expect(app.findAll('.post-content').map((node) => node.text()))
      .toEqual(['刷新后还在', '更早的一条']);
    expect(app.get('.post-card .post-action-like').attributes('aria-pressed')).toBe('false');
  });
});
