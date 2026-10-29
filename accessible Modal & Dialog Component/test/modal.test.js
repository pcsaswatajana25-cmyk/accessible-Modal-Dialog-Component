(function () {
  'use strict';

  const results = [];
  const container = document.getElementById('test-results');

  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  function assertEqual(actual, expected, message) {
    if (actual !== expected) throw new Error(`${message || 'Values not equal'} -> Expected: "${expected}", Actual: "${actual}"`);
  }

  async function runTest(name, testFn) {
    const testItem = { name, passed: false, error: null };
    try {
      await testFn();
      testItem.passed = true;
    } catch (err) {
      testItem.passed = false;
      testItem.error = err.message;
    }
    results.push(testItem);
    renderResult(testItem);
  }

  function renderResult(item) {
    if (!container) return;
    const row = document.createElement('div');
    row.className = `test-row ${item.passed ? 'pass' : 'fail'}`;
    row.innerHTML = `
      <span class="test-badge">${item.passed ? '✓ PASS' : '✗ FAIL'}</span>
      <span class="test-name">${item.name}</span>
      ${item.error ? `<div class="test-error">${item.error}</div>` : ''}
    `;
    container.appendChild(row);
  }

  function renderSummary() {
    const summaryEl = document.getElementById('test-summary');
    if (!summaryEl) return;
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;

    summaryEl.className = `test-summary ${failed === 0 ? 'all-passed' : 'has-failures'}`;
    summaryEl.innerHTML = `
      <h3>${failed === 0 ? 'All Tests Passed Successfully!' : `${failed} Test(s) Failed`}</h3>
      <p>Executed ${total} assertions. Passed: <strong>${passed}</strong> | Failed: <strong>${failed}</strong></p>
    `;
  }

  function createModalFixture(id, options = {}) {
    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.className = 'modal is-hidden';
    wrapper.innerHTML = `
      <div class="modal__backdrop"></div>
      <div class="modal__dialog">
        <header class="modal__header">
          <h2 class="modal__title">Test Modal Title</h2>
          <button type="button" class="modal__close" data-modal-close aria-label="Close">X</button>
        </header>
        <div class="modal__body">
          <p>Test description for modal component.</p>
          <input type="text" id="${id}-input-1" placeholder="First input" ${options.autofocusFirst ? 'data-autofocus' : ''}>
          <button type="button" id="${id}-btn-action">Action Button</button>
        </div>
        <footer class="modal__footer">
          <button type="button" id="${id}-btn-close" data-modal-close>Close</button>
        </footer>
      </div>
    `;
    document.body.appendChild(wrapper);
    return wrapper;
  }

  function cleanupFixture(el) {
    if (el && el.__modalInstance) el.__modalInstance.destroy();
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  async function executeAllTests() {
    await runTest('Constructor throws error when target selector does not exist', () => {
      let threw = false;
      try { new ModalDialog('#non-existent-element-id'); } catch (e) { threw = true; }
      assert(threw, 'Should throw error for non-existent target selector');
    });

    await runTest('Initializes ARIA attributes correctly (role, aria-modal, aria-hidden)', () => {
      const el = createModalFixture('fixture-aria-test');
      const modal = new ModalDialog(el);
      const dialog = el.querySelector('.modal__dialog');
      assertEqual(dialog.getAttribute('role'), 'dialog');
      assertEqual(dialog.getAttribute('aria-modal'), 'true');
      assertEqual(dialog.getAttribute('tabindex'), '-1');
      assertEqual(el.getAttribute('aria-hidden'), 'true');
      assert(dialog.hasAttribute('aria-labelledby'));
      assert(dialog.hasAttribute('aria-describedby'));
      cleanupFixture(el);
    });

    await runTest('open() updates classes, ARIA states, and body scroll lock', async () => {
      const el = createModalFixture('fixture-open-test');
      const modal = new ModalDialog(el, { transitionTimeout: 50 });
      assert(!modal.isOpen);
      await modal.open();
      assert(modal.isOpen);
      assertEqual(el.getAttribute('aria-hidden'), 'false');
      assert(el.classList.contains('is-open'));
      assert(document.body.classList.contains('modal-open'));
      await modal.close();
      assert(!modal.isOpen);
      assertEqual(el.getAttribute('aria-hidden'), 'true');
      assert(!document.body.classList.contains('modal-open'));
      cleanupFixture(el);
    });

    await runTest('Focus placement prioritizes data-autofocus element', async () => {
      const el = createModalFixture('fixture-focus-test', { autofocusFirst: true });
      const modal = new ModalDialog(el, { transitionTimeout: 50 });
      await modal.open();
      const input = el.querySelector('#fixture-focus-test-input-1');
      assertEqual(document.activeElement, input);
      await modal.close();
      cleanupFixture(el);
    });

    await runTest('Focus trap wraps Tab from last element back to first element', async () => {
      const el = createModalFixture('fixture-trap-test');
      const modal = new ModalDialog(el, { transitionTimeout: 50 });
      await modal.open();
      const focusable = modal.getFocusableElements();
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      lastEl.focus();
      const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, bubbles: true, cancelable: true });
      document.dispatchEvent(tabEvent);
      assertEqual(document.activeElement, firstEl);
      await modal.close();
      cleanupFixture(el);
    });

    await runTest('Restores focus to trigger button upon close', async () => {
      const trigger = document.createElement('button');
      document.body.appendChild(trigger);
      trigger.focus();
      const el = createModalFixture('fixture-restore-test');
      const modal = new ModalDialog(el, { transitionTimeout: 50 });
      await modal.open({ trigger });
      await modal.close();
      assertEqual(document.activeElement, trigger);
      cleanupFixture(el);
      document.body.removeChild(trigger);
    });

    await runTest('Escape key closes open modal when closeOnEscape is true', async () => {
      const el = createModalFixture('fixture-escape-test');
      const modal = new ModalDialog(el, { closeOnEscape: true, transitionTimeout: 50 });
      await modal.open();
      assert(modal.isOpen);
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true });
      document.dispatchEvent(escEvent);
      await new Promise((r) => setTimeout(r, 70));
      assert(!modal.isOpen);
      cleanupFixture(el);
    });

    await runTest('Dispatches all lifecycle custom events', async () => {
      const el = createModalFixture('fixture-events-test');
      const modal = new ModalDialog(el, { transitionTimeout: 50 });
      const eventsCaught = [];
      ['modal:before-open', 'modal:open', 'modal:before-close', 'modal:close'].forEach((evt) => {
        el.addEventListener(evt, () => eventsCaught.push(evt));
      });
      await modal.open();
      await modal.close();
      assertEqual(eventsCaught.length, 4);
      assertEqual(eventsCaught[0], 'modal:before-open');
      assertEqual(eventsCaught[1], 'modal:open');
      assertEqual(eventsCaught[2], 'modal:before-close');
      assertEqual(eventsCaught[3], 'modal:close');
      cleanupFixture(el);
    });

    renderSummary();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executeAllTests);
  } else {
    executeAllTests();
  }
})();
