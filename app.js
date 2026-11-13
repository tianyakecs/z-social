import {
  MAX_CONTENT_LENGTH,
  PostInputError,
  createPost,
  loadPosts,
  savePosts,
} from './storage.js';

const form = document.querySelector('#post-form');
const input = document.querySelector('#post-content');
const publishButton = document.querySelector('#publish-button');
const characterCount = document.querySelector('#char-count');
const formStatus = document.querySelector('#form-status');
const timeline = document.querySelector('#timeline');
const emptyState = document.querySelector('#empty-state');
const postCount = document.querySelector('#post-count');
const postTemplate = document.querySelector('#post-template');
const effectsToggle = document.querySelector('#effects-toggle');
const pointerGlow = document.querySelector('#pointer-glow');
const parallaxItems = [...document.querySelectorAll('[data-parallax]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(pointer: fine)');

let storage;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}

let posts = [];
let effectsEnabled = !reducedMotion.matches;
let pointerFrame = 0;
let pointerX = 0;
let pointerY = 0;

function setStatus(message = '', state = '') {
  formStatus.textContent = message;
  if (state) formStatus.dataset.state = state;
  else delete formStatus.dataset.state;
}

function updateCount() {
  const count = Array.from(input.value).length;
  characterCount.textContent = `${count} / ${MAX_CONTENT_LENGTH}`;
  characterCount.classList.toggle('is-near-limit', count > 250 && count <= MAX_CONTENT_LENGTH);
  characterCount.classList.toggle('is-over-limit', count > MAX_CONTENT_LENGTH);
  input.setAttribute('aria-invalid', String(count > MAX_CONTENT_LENGTH));
}

function updateSummary() {
  postCount.textContent = String(posts.length);
  emptyState.hidden = posts.length > 0;
}

function formatPostTime(isoDate) {
  const date = new Date(isoDate);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const options = {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  if (!sameYear) options.year = 'numeric';
  return new Intl.DateTimeFormat('zh-CN', options).format(date);
}

function createPostElement(post) {
  const item = postTemplate.content.firstElementChild.cloneNode(true);
  const time = item.querySelector('.post-time');
  const content = item.querySelector('.post-content');

  item.dataset.postId = post.id;
  time.dateTime = post.createdAt;
  time.textContent = formatPostTime(post.createdAt);
  time.title = new Date(post.createdAt).toLocaleString('zh-CN', { hour12: false });
  content.textContent = post.content;

  return item;
}

function renderTimeline() {
  const fragment = document.createDocumentFragment();
  posts.forEach((post, index) => {
    const element = createPostElement(post);
    element.style.setProperty('--post-index', Math.min(index, 6));
    fragment.append(element);
  });
  timeline.replaceChildren(fragment);
  updateSummary();
}

function showLoadError(error) {
  if (error === 'DATA_INVALID') {
    setStatus('检测到异常数据，已恢复其中可用的动态。', 'warning');
  } else if (error === 'STORAGE_READ_FAILED') {
    setStatus('无法读取本地数据，请检查浏览器的存储权限。', 'error');
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  setStatus();
  publishButton.disabled = true;

  try {
    const post = createPost(input.value);
    const nextPosts = [post, ...posts];
    const result = savePosts(storage, nextPosts);

    if (!result.ok) {
      setStatus('发布失败，浏览器无法保存内容。你的文字仍保留在输入框中。', 'error');
      return;
    }

    posts = nextPosts;
    timeline.prepend(createPostElement(post));
    updateSummary();
    form.reset();
    updateCount();
    setStatus('发布成功，想法已写入本地时间线。', 'success');
  } catch (error) {
    if (error instanceof PostInputError) {
      input.setAttribute('aria-invalid', 'true');
      setStatus(error.message, 'error');
      input.focus();
    } else {
      setStatus('发布时遇到问题，请稍后重试。你的文字仍保留在输入框中。', 'error');
    }
  } finally {
    publishButton.disabled = false;
  }
});

input.addEventListener('input', () => {
  updateCount();
  if (formStatus.dataset.state === 'error') setStatus();
});

input.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    form.requestSubmit();
  }
});

function resetParallax() {
  for (const item of parallaxItems) {
    item.style.setProperty('--parallax-x', '0px');
    item.style.setProperty('--parallax-y', '0px');
  }
}

function updateEffects() {
  document.body.classList.toggle('effects-off', !effectsEnabled);
  effectsToggle.setAttribute('aria-pressed', String(effectsEnabled));
  effectsToggle.setAttribute('aria-label', effectsEnabled ? '关闭装饰动效' : '开启装饰动效');
  effectsToggle.title = effectsEnabled ? '关闭装饰动效' : '开启装饰动效';
  if (!effectsEnabled) {
    document.body.classList.remove('pointer-active');
    resetParallax();
  }
}

effectsToggle.addEventListener('click', () => {
  effectsEnabled = !effectsEnabled;
  updateEffects();
});

document.addEventListener('pointermove', (event) => {
  if (!effectsEnabled || reducedMotion.matches || !finePointer.matches) return;

  pointerX = event.clientX;
  pointerY = event.clientY;
  document.body.classList.add('pointer-active');

  if (pointerFrame) return;
  pointerFrame = requestAnimationFrame(() => {
    pointerGlow.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;

    const offsetX = (pointerX / window.innerWidth - 0.5) * 24;
    const offsetY = (pointerY / window.innerHeight - 0.5) * 18;
    for (const item of parallaxItems) {
      const depth = Number(item.dataset.parallax) || 1;
      item.style.setProperty('--parallax-x', `${offsetX * depth}px`);
      item.style.setProperty('--parallax-y', `${offsetY * depth}px`);
    }
    pointerFrame = 0;
  });
});

document.documentElement.addEventListener('mouseleave', () => {
  document.body.classList.remove('pointer-active');
  resetParallax();
});

function setupReveal() {
  const elements = [...document.querySelectorAll('[data-reveal]')];
  if (!effectsEnabled || reducedMotion.matches || !('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.remove('reveal-pending');
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -32px' });

  elements.forEach((element, index) => {
    element.classList.add('reveal-pending');
    element.style.setProperty('--reveal-delay', `${(index % 2) * 90}ms`);
    observer.observe(element);
  });
}

reducedMotion.addEventListener('change', (event) => {
  if (event.matches) {
    effectsEnabled = false;
    updateEffects();
  }
});

const initialState = loadPosts(storage);
posts = initialState.posts;
renderTimeline();
updateCount();
updateEffects();
setupReveal();
showLoadError(initialState.error);
