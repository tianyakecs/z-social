import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import PostCard from '@/components/PostCard.vue';

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
});
