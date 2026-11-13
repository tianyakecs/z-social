import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import PostCard from '@/components/PostCard.vue';

const LEGACY_POST = {
  id: 'safe-post',
  content: '<img src=x onerror=alert(1)> 纯文本内容',
  createdAt: '2026-11-13T08:00:00.000Z',
};

const FULL_POST = {
  id: 'full-post',
  content: '有点赞的一条',
  createdAt: '2026-11-13T09:00:00.000Z',
  likeCount: 3,
  favoriteCount: 0,
  liked: true,
  favorited: false,
};

describe('PostCard', () => {
  it('renders user content as text without creating HTML elements', () => {
    const wrapper = mount(PostCard, {
      props: {
        post: {
          id: 'safe-post',
          content: '<img src=x onerror=alert(1)> 纯文本内容',
          createdAt: '2026-11-13T08:00:00.000Z',
        },
      },
    });

    expect(wrapper.get('.post-content').text()).toBe('<img src=x onerror=alert(1)> 纯文本内容');
    expect(wrapper.find('.post-content img').exists()).toBe(false);
  });

  it('exposes a machine-readable creation time', () => {
    const wrapper = mount(PostCard, {
      props: {
        post: {
          id: 'timed-post',
          content: '有时间',
          createdAt: '2026-11-13T08:00:00.000Z',
        },
      },
    });

    expect(wrapper.get('time').attributes('datetime')).toBe('2026-11-13T08:00:00.000Z');
    expect(wrapper.get('time').text()).not.toBe('');
  });

  it('renders the action counts and falls back to 0 for legacy posts', () => {
    const legacy = mount(PostCard, { props: { post: LEGACY_POST } });
    expect(legacy.findAll('.post-action')).toHaveLength(2);
    expect(legacy.findAll('.action-count').map((node) => node.text())).toEqual(['0', '0']);

    const full = mount(PostCard, { props: { post: FULL_POST } });
    expect(full.get('.post-action-like .action-count').text()).toBe('3');
    expect(full.get('.post-action-favorite .action-count').text()).toBe('0');
  });

  it('toggles aria-pressed, labels and the is-active class with the post state', () => {
    const off = mount(PostCard, { props: { post: LEGACY_POST } });
    const likeOff = off.get('.post-action-like');
    expect(likeOff.attributes('type')).toBe('button');
    expect(likeOff.attributes('aria-pressed')).toBe('false');
    expect(likeOff.attributes('aria-label')).toBe('点赞');
    expect(likeOff.classes()).not.toContain('is-active');
    expect(off.get('.post-action-favorite').attributes('aria-pressed')).toBe('false');
    expect(off.get('.post-action-favorite').attributes('aria-label')).toBe('收藏');

    const on = mount(PostCard, { props: { post: { ...FULL_POST, favorited: true } } });
    const likeOn = on.get('.post-action-like');
    expect(likeOn.attributes('aria-pressed')).toBe('true');
    expect(likeOn.attributes('aria-label')).toBe('取消点赞');
    expect(likeOn.classes()).toContain('is-active');
    const favoriteOn = on.get('.post-action-favorite');
    expect(favoriteOn.attributes('aria-pressed')).toBe('true');
    expect(favoriteOn.attributes('aria-label')).toBe('取消收藏');
    expect(favoriteOn.classes()).toContain('is-active');
  });

  it('emits toggle events with the post id instead of calling the store', async () => {
    const wrapper = mount(PostCard, { props: { post: FULL_POST } });

    await wrapper.get('.post-action-like').trigger('click');
    await wrapper.get('.post-action-favorite').trigger('click');

    expect(wrapper.emitted('toggle-like')).toEqual([[FULL_POST.id]]);
    expect(wrapper.emitted('toggle-favorite')).toEqual([[FULL_POST.id]]);
  });

  it('disables both buttons while pending and does not emit', async () => {
    const idle = mount(PostCard, { props: { post: FULL_POST } });
    expect(idle.get('.post-action-like').attributes('disabled')).toBeUndefined();

    const wrapper = mount(PostCard, { props: { post: FULL_POST, pending: true } });
    expect(wrapper.get('.post-action-like').attributes('disabled')).toBeDefined();
    expect(wrapper.get('.post-action-favorite').attributes('disabled')).toBeDefined();

    await wrapper.get('.post-action-like').trigger('click');
    expect(wrapper.emitted('toggle-like')).toBeUndefined();
  });
});
