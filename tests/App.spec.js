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
});
