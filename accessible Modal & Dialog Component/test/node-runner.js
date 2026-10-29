class MockClassList {
  constructor() { this.classes = new Set(); }
  add(...names) { names.forEach(n => this.classes.add(n)); }
  remove(...names) { names.forEach(n => this.classes.delete(n)); }
  contains(name) { return this.classes.has(name); }
}

class MockElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.classList = new MockClassList();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this.dataset = {};
    this.offsetWidth = 100;
    this.offsetHeight = 100;
    this.id = attributes.id || '';
  }
  getAttribute(name) { return this.attributes[name] || null; }
  setAttribute(name, val) { this.attributes[name] = String(val); }
  hasAttribute(name) { return name in this.attributes; }
  removeAttribute(name) { delete this.attributes[name]; }
  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  closest(sel) {
    let curr = this;
    while (curr) {
      if (curr._matches(sel)) return curr;
      curr = curr.parentNode;
    }
    return null;
  }
  _matches(sel) {
    if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    if (sel.startsWith('[')) {
      const attr = sel.replace(/[\[\]]/g, '').split('=')[0];
      return this.hasAttribute(attr);
    }
    return this.tagName.toLowerCase() === sel.toLowerCase();
  }
  querySelector(sel) {
    if (sel.includes(',')) {
      const parts = sel.split(',').map(s => s.trim());
      for (const part of parts) {
        const found = this.querySelector(part);
        if (found) return found;
      }
      return null;
    }
    return this._find(el => el._matches(sel));
  }
  querySelectorAll(sel) {
    const found = [];
    this._findAll(el => true, found);
    return found;
  }
  _find(predicate) {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const sub = child._find(predicate);
      if (sub) return sub;
    }
    return null;
  }
  _findAll(predicate, acc) {
    for (const child of this.children) {
      if (predicate(child)) acc.push(child);
      child._findAll(predicate, acc);
    }
  }
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  removeEventListener(event, fn) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(f => f !== fn);
  }
  dispatchEvent(event) {
    event.target = this;
    const handlers = this.listeners[event.type] || [];
    for (const h of handlers) h(event);
    return !event.defaultPrevented;
  }
  focus() {
    global.document.activeElement = this;
  }
}

global.HTMLElement = MockElement;
const mockCustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = init.bubbles || false;
    this.cancelable = init.cancelable || false;
    this.detail = init.detail || {};
    this.defaultPrevented = false;
  }
  preventDefault() { this.defaultPrevented = true; }
};

global.CustomEvent = mockCustomEvent;
global.window = {
  innerWidth: 1024,
  innerHeight: 768,
  CustomEvent: mockCustomEvent,
  getComputedStyle: () => ({ paddingRight: '0px' }),
  matchMedia: () => ({ matches: false })
};
global.document = {
  body: new MockElement('body'),
  documentElement: new MockElement('html'),
  activeElement: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: (tag) => new MockElement(tag),
  querySelector: (sel) => global.document.body.querySelector(sel)
};

const ModalDialog = require('../js/modal.js');

let passed = 0;
let failed = 0;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(`${msg}: expected "${b}", got "${a}"`); }

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ FAIL: ${name} -> ${e.message}`);
    failed++;
  }
}

async function run() {
  console.log('\n=============================================');
  console.log('Running ModalDialog Automated Test Suite (CLI)');
  console.log('=============================================\n');

  await test('Constructor throws on invalid target', () => {
    let threw = false;
    try { new ModalDialog(null); } catch (e) { threw = true; }
    assert(threw, 'Should throw for null target');
  });

  await test('Initializes ARIA attributes (role, aria-modal, aria-hidden)', () => {
    const modalEl = new MockElement('div');
    const dialogEl = new MockElement('div');
    dialogEl.classList.add('modal__dialog');
    const titleEl = new MockElement('h2');
    titleEl.classList.add('modal__title');
    dialogEl.appendChild(titleEl);
    modalEl.appendChild(dialogEl);

    const instance = new ModalDialog(modalEl);
    assertEqual(dialogEl.getAttribute('role'), 'dialog', 'Role must be dialog');
    assertEqual(dialogEl.getAttribute('aria-modal'), 'true', 'aria-modal must be true');
    assertEqual(dialogEl.getAttribute('tabindex'), '-1', 'tabindex must be -1');
    assertEqual(modalEl.getAttribute('aria-hidden'), 'true', 'aria-hidden must be true initially');
    assert(dialogEl.hasAttribute('aria-labelledby'), 'Should link aria-labelledby');
  });

  await test('open() lifecycle updates classes and ARIA state', async () => {
    const modalEl = new MockElement('div');
    const dialogEl = new MockElement('div');
    dialogEl.classList.add('modal__dialog');
    modalEl.appendChild(dialogEl);

    const instance = new ModalDialog(modalEl, { transitionTimeout: 10 });
    assert(!instance.isOpen, 'Should be closed initially');

    await instance.open();
    assert(instance.isOpen, 'Should be open');
    assertEqual(modalEl.getAttribute('aria-hidden'), 'false', 'aria-hidden must be false');
    assert(modalEl.classList.contains('is-open'), 'Must have is-open class');

    await instance.close();
    assert(!instance.isOpen, 'Should be closed');
    assertEqual(modalEl.getAttribute('aria-hidden'), 'true', 'aria-hidden must be true');
  });

  await test('Lifecycle events are dispatched in order', async () => {
    const modalEl = new MockElement('div');
    const dialogEl = new MockElement('div');
    dialogEl.classList.add('modal__dialog');
    modalEl.appendChild(dialogEl);

    const instance = new ModalDialog(modalEl, { transitionTimeout: 10 });
    const events = [];
    ['modal:before-open', 'modal:open', 'modal:before-close', 'modal:close'].forEach(evt => {
      modalEl.addEventListener(evt, () => events.push(evt));
    });

    await instance.open();
    await instance.close();

    assertEqual(events.length, 4, 'Must dispatch all 4 lifecycle events');
    assertEqual(events[0], 'modal:before-open', '1st event');
    assertEqual(events[1], 'modal:open', '2nd event');
    assertEqual(events[2], 'modal:before-close', '3rd event');
    assertEqual(events[3], 'modal:close', '4th event');
  });

  await test('Focus restoration returns focus to trigger element', async () => {
    const trigger = new MockElement('button');
    global.document.activeElement = trigger;

    const modalEl = new MockElement('div');
    const dialogEl = new MockElement('div');
    dialogEl.classList.add('modal__dialog');
    modalEl.appendChild(dialogEl);

    const instance = new ModalDialog(modalEl, { transitionTimeout: 10 });
    await instance.open({ trigger });
    assertEqual(instance.previousActiveElement, trigger, 'Must store trigger');

    await instance.close();
    assertEqual(global.document.activeElement, trigger, 'Must restore focus to trigger');
  });

  console.log('\n---------------------------------------------');
  console.log(`Summary: ${passed} passed, ${failed} failed.`);
  console.log('---------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

run();
