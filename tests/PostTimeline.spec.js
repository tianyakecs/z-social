import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import PostTimeline from '@/components/PostTimeline.vue';

const POSTS = [
  {
    id: 'a',
    content: '第一条',
    createdAt: '2026-11-13T08:00:00.000Z',
    likeCount: 1,
    favoriteCount: 2,
    liked: false,
    favorited: false,
  },
  {
    id: 'b',
    content: '第二条',
    createdAt: '2026-11-13T07:00:00.000Z',
    likeCount: 0,
    favoriteCount: 0,
    liked: true,
    favorited: true,
  },
];

describe('PostTimeline', () => {
  it('renders one post card per post and keeps the server order', () => {
    const wrapper = mount(PostTimeline, { props: { posts: POSTS } });

    expect(wrapper.findAll('.post-card')).toHaveLength(2);
    expect(wrapper.findAll('.post-content').map((node) => node.text()))
      .toEqual(['第一条', '第二条']);
  });

  it('falls back to an empty pendingIds list', () => {
    const wrapper = mount(PostTimeline, { props: { posts: POSTS } });

    const buttons = wrapper.findAll('.post-action');
    expect(buttons).toHaveLength(4);
    buttons.forEach((button) => {
      expect(button.attributes('disabled')).toBeUndefined();
    });
  });

  it('only disables the cards whose id is listed in pendingIds', () => {
    const wrapper = mount(PostTimeline, { props: { posts: POSTS, pendingIds: ['b'] } });
    const cards = wrapper.findAll('.post-card');

    expect(cards[0].get('.post-action-like').attributes('disabled')).toBeUndefined();
    expect(cards[0].get('.post-action-favorite').attributes('disabled')).toBeUndefined();
    expect(cards[1].get('.post-action-like').attributes('disabled')).toBeDefined();
    expect(cards[1].get('.post-action-favorite').attributes('disabled')).toBeDefined();
  });

  it('forwards toggle-like and toggle-favorite events with the post id', async () => {
    const wrapper = mount(PostTimeline, { props: { posts: POSTS } });

    await wrapper.findAll('.post-action-like')[1].trigger('click');
    await wrapper.findAll('.post-action-favorite')[0].trigger('click');

    expect(wrapper.emitted('toggle-like')).toEqual([['b']]);
    expect(wrapper.emitted('toggle-favorite')).toEqual([['a']]);
  });

  it('renders the empty state when there are no posts', () => {
    const wrapper = mount(PostTimeline, { props: { posts: [] } });

    expect(wrapper.find('.empty-state').exists()).toBe(true);
    expect(wrapper.findAll('.post-card')).toHaveLength(0);
  });
});
