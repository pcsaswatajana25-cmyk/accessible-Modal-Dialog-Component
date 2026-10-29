/**
 * ModalDialog.js
 * A production-grade, accessible, responsive, and customizable Modal Dialog Component in vanilla JavaScript.
 *
 * Adheres to:
 * - W3C WAI-ARIA 1.2 Authoring Practices for Dialog (Modal)
 * - WCAG 2.1 AA Accessibility Standards (Focus Management, Keyboard Navigation, Screen Reader Semantics)
 * - UMD Pattern (Universal Module Definition for vanilla script, CommonJS, and ES Modules)
 *
 * @version 1.0.0
 * @author UI Engineering
 * @license MIT
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ModalDialog = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FOCUSABLE_SELECTOR = [
    'a[href]:not([tabindex="-1"])',
    'area[href]:not([tabindex="-1"])',
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    'button:not([disabled]):not([tabindex="-1"])',
    'iframe:not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
    '[contentEditable=true]:not([tabindex="-1"])'
  ].join(',');

  const activeModalStack = [];
  let globalKeydownHandler = null;

  const DEFAULT_OPTIONS = {
    initialFocus: 'first',
    closeOnEscape: true,
    closeOnBackdrop: true,
    lockScroll: true,
    scrollbarCompensation: true,
    restoreFocus: true,
    bodyOpenClass: 'modal-open',
    transitionTimeout: 400,
    role: 'dialog',
    onBeforeOpen: null,
    onOpen: null,
    onBeforeClose: null,
    onClose: null
  };

  function getScrollbarWidth() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return 0;
    }
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    outer.style.msOverflowStyle = 'scrollbar';
    outer.style.position = 'absolute';
    outer.style.top = '-9999px';
    outer.style.width = '100px';
    outer.style.height = '100px';
    document.body.appendChild(outer);

    const inner = document.createElement('div');
    inner.style.width = '100%';
    outer.appendChild(inner);

    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    if (outer.parentNode) {
      outer.parentNode.removeChild(outer);
    }
    return scrollbarWidth;
  }

  function isReducedMotionPreferred() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  }

  function isVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  class ModalDialog {
    constructor(target, options = {}) {
      if (!target) {
        throw new Error('[ModalDialog] Target element or selector must be provided.');
      }

      this.modal = typeof target === 'string' ? document.querySelector(target) : target;

      if (!this.modal || !(this.modal instanceof HTMLElement)) {
        throw new Error(`[ModalDialog] Target "${target}" could not be resolved to a valid DOM HTMLElement.`);
      }

      this.options = this._resolveOptions(options);
      this.dialog = this.modal.querySelector('.modal__dialog') || this.modal;
      this.backdrop = this.modal.querySelector('.modal__backdrop');

      this.isOpen = false;
      this.isTransitioning = false;
      this.previousActiveElement = null;
      this._originalBodyPaddingRight = '';
      this._hasBodyScrollLock = false;

      this._handleBackdropClick = this._handleBackdropClick.bind(this);
      this._handleDialogClick = this._handleDialogClick.bind(this);

      this._initAccessibility();
      this._bindEvents();

      this.modal.__modalInstance = this;
    }

    _resolveOptions(options) {
      const dataset = this.modal.dataset;
      const dataOptions = {};

      if (dataset.initialFocus) dataOptions.initialFocus = dataset.initialFocus;
      if (dataset.closeOnEscape !== undefined) dataOptions.closeOnEscape = dataset.closeOnEscape !== 'false';
      if (dataset.closeOnBackdrop !== undefined) dataOptions.closeOnBackdrop = dataset.closeOnBackdrop !== 'false';
      if (dataset.lockScroll !== undefined) dataOptions.lockScroll = dataset.lockScroll !== 'false';
      if (dataset.role) dataOptions.role = dataset.role;

      return Object.assign({}, DEFAULT_OPTIONS, options, dataOptions);
    }

    _initAccessibility() {
      const role = this.options.role === 'alertdialog' ? 'alertdialog' : 'dialog';
      this.dialog.setAttribute('role', role);
      this.dialog.setAttribute('aria-modal', 'true');

      if (!this.dialog.hasAttribute('tabindex')) {
        this.dialog.setAttribute('tabindex', '-1');
      }

      const title = this.modal.querySelector('.modal__title, [data-modal-title]');
      if (title && !this.dialog.hasAttribute('aria-labelledby')) {
        if (!title.id) {
          title.id = `modal-title-${Math.random().toString(36).substr(2, 9)}`;
        }
        this.dialog.setAttribute('aria-labelledby', title.id);
      }

      const description = this.modal.querySelector('.modal__body, [data-modal-description]');
      if (description && !this.dialog.hasAttribute('aria-describedby')) {
        if (!description.id) {
          description.id = `modal-desc-${Math.random().toString(36).substr(2, 9)}`;
        }
        this.dialog.setAttribute('aria-describedby', description.id);
      }

      if (!this.isOpen) {
        this.modal.setAttribute('aria-hidden', 'true');
        this.modal.classList.add('is-hidden');
      }
    }

    _bindEvents() {
      this.modal.addEventListener('click', (event) => {
        const closeBtn = event.target.closest('[data-modal-close], .modal__close');
        if (closeBtn) {
          event.preventDefault();
          this.close({ trigger: closeBtn });
        }
      });

      if (this.backdrop) {
        this.backdrop.addEventListener('click', this._handleBackdropClick);
      } else {
        this.modal.addEventListener('click', this._handleBackdropClick);
      }

      this.dialog.addEventListener('click', this._handleDialogClick);
    }

    _handleBackdropClick(event) {
      if (!this.options.closeOnBackdrop || !this.isOpen) return;

      if (event.target === this.backdrop || event.target === this.modal) {
        this.close({ trigger: 'backdrop' });
      }
    }

    _handleDialogClick(event) {
      event.stopPropagation();
    }

    _dispatchEvent(eventName, detail = {}, cancelable = false) {
      let event;
      if (typeof window.CustomEvent === 'function') {
        event = new CustomEvent(eventName, {
          bubbles: true,
          cancelable: cancelable,
          detail: Object.assign({ instance: this }, detail)
        });
      } else {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent(eventName, true, cancelable, Object.assign({ instance: this }, detail));
      }
      return this.modal.dispatchEvent(event);
    }

    getFocusableElements() {
      const elements = Array.from(this.dialog.querySelectorAll(FOCUSABLE_SELECTOR));
      return elements.filter((el) => isVisible(el));
    }

    _trapFocus(event) {
      if (event.key !== 'Tab' && event.keyCode !== 9) return;

      const focusable = this.getFocusableElements();

      if (focusable.length === 0) {
        event.preventDefault();
        this.dialog.focus();
        return;
      }

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable || document.activeElement === this.dialog) {
          event.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault();
          firstFocusable.focus();
        }
      }
    }

    _applyScrollLock() {
      if (!this.options.lockScroll) return;

      const body = document.body;

      if (activeModalStack.length === 1) {
        const isBodyOverflowing = window.innerHeight < document.body.scrollHeight;
        if (isBodyOverflowing && this.options.scrollbarCompensation) {
          const scrollbarWidth = getScrollbarWidth();
          if (scrollbarWidth > 0) {
            this._originalBodyPaddingRight = body.style.paddingRight || '';
            const currentPadding = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
            body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
          }
        }
        body.classList.add(this.options.bodyOpenClass);
        this._hasBodyScrollLock = true;
      }
    }

    _removeScrollLock() {
      if (!this.options.lockScroll) return;

      if (activeModalStack.length === 0 && this._hasBodyScrollLock) {
        const body = document.body;
        body.classList.remove(this.options.bodyOpenClass);
        if (this.options.scrollbarCompensation) {
          body.style.paddingRight = this._originalBodyPaddingRight;
        }
        this._hasBodyScrollLock = false;
      }
    }

    open(meta = {}) {
      if (this.isOpen || this.isTransitioning) {
        return Promise.resolve(this);
      }

      if (typeof this.options.onBeforeOpen === 'function') {
        const shouldContinue = this.options.onBeforeOpen(this, meta);
        if (shouldContinue === false) return Promise.resolve(this);
      }

      const notCancelled = this._dispatchEvent('modal:before-open', meta, true);
      if (!notCancelled) return Promise.resolve(this);

      this.previousActiveElement = meta.trigger || document.activeElement;

      this.isTransitioning = true;
      this.isOpen = true;

      activeModalStack.push(this);
      ModalDialog._ensureGlobalKeyboardListener();

      this._applyScrollLock();

      this.modal.classList.remove('is-hidden');
      this.modal.setAttribute('aria-hidden', 'false');
      this.modal.classList.add('is-opening');

      void this.modal.offsetWidth;

      return new Promise((resolve) => {
        const onEnd = () => {
          this.modal.classList.remove('is-opening');
          this.modal.classList.add('is-open');
          this.isTransitioning = false;

          this._setInitialFocus();

          if (typeof this.options.onOpen === 'function') {
            this.options.onOpen(this, meta);
          }
          this._dispatchEvent('modal:open', meta, false);

          resolve(this);
        };

        if (isReducedMotionPreferred()) {
          onEnd();
        } else {
          this._waitForTransition(this.dialog, onEnd);
        }
      });
    }

    close(meta = {}) {
      if (!this.isOpen || this.isTransitioning) {
        return Promise.resolve(this);
      }

      if (typeof this.options.onBeforeClose === 'function') {
        const shouldContinue = this.options.onBeforeClose(this, meta);
        if (shouldContinue === false) return Promise.resolve(this);
      }

      const notCancelled = this._dispatchEvent('modal:before-close', meta, true);
      if (!notCancelled) return Promise.resolve(this);

      this.isTransitioning = true;
      this.isOpen = false;

      const stackIndex = activeModalStack.indexOf(this);
      if (stackIndex !== -1) {
        activeModalStack.splice(stackIndex, 1);
      }
      ModalDialog._checkGlobalKeyboardListener();

      this.modal.classList.remove('is-open');
      this.modal.classList.add('is-closing');

      return new Promise((resolve) => {
        const onEnd = () => {
          this.modal.classList.remove('is-closing');
          this.modal.classList.add('is-hidden');
          this.modal.setAttribute('aria-hidden', 'true');
          this.isTransitioning = false;

          this._removeScrollLock();

          if (this.options.restoreFocus && this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
            try {
              this.previousActiveElement.focus();
            } catch (err) {
              console.warn('[ModalDialog] Could not restore focus to previous element:', err);
            }
          }

          if (typeof this.options.onClose === 'function') {
            this.options.onClose(this, meta);
          }
          this._dispatchEvent('modal:close', meta, false);

          resolve(this);
        };

        if (isReducedMotionPreferred()) {
          onEnd();
        } else {
          this._waitForTransition(this.dialog, onEnd);
        }
      });
    }

    toggle(meta = {}) {
      return this.isOpen ? this.close(meta) : this.open(meta);
    }

    _setInitialFocus() {
      const autofocusEl = this.dialog.querySelector('[data-autofocus]');
      if (autofocusEl && isVisible(autofocusEl)) {
        autofocusEl.focus();
        return;
      }

      if (this.options.initialFocus === 'first') {
        const focusable = this.getFocusableElements();
        if (focusable.length > 0) {
          focusable[0].focus();
          return;
        }
      } else if (this.options.initialFocus === 'closeButton') {
        const closeBtn = this.dialog.querySelector('[data-modal-close], .modal__close');
        if (closeBtn && isVisible(closeBtn)) {
          closeBtn.focus();
          return;
        }
      } else if (typeof this.options.initialFocus === 'string') {
        const customTarget = this.dialog.querySelector(this.options.initialFocus);
        if (customTarget && isVisible(customTarget)) {
          customTarget.focus();
          return;
        }
      }

      this.dialog.focus();
    }

    _waitForTransition(element, callback) {
      let called = false;
      const timeoutDuration = this.options.transitionTimeout;

      const onceCallback = (e) => {
        if (e && e.target !== element) return;
        if (called) return;
        called = true;
        element.removeEventListener('transitionend', onceCallback);
        element.removeEventListener('animationend', onceCallback);
        clearTimeout(fallbackTimer);
        callback();
      };

      element.addEventListener('transitionend', onceCallback);
      element.addEventListener('animationend', onceCallback);

      const fallbackTimer = setTimeout(() => {
        if (!called) {
          called = true;
          element.removeEventListener('transitionend', onceCallback);
          element.removeEventListener('animationend', onceCallback);
          callback();
        }
      }, timeoutDuration);
    }

    destroy() {
      if (this.isOpen) {
        this.close();
      }

      const index = activeModalStack.indexOf(this);
      if (index !== -1) {
        activeModalStack.splice(index, 1);
      }
      ModalDialog._checkGlobalKeyboardListener();

      this.modal.classList.remove('is-open', 'is-opening', 'is-closing');
      this.modal.classList.add('is-hidden');
      this.modal.setAttribute('aria-hidden', 'true');
      this.modal.removeAttribute('role');
      this.dialog.removeAttribute('role');
      this.dialog.removeAttribute('aria-modal');

      delete this.modal.__modalInstance;
    }

    static _handleGlobalKeydown(event) {
      if (activeModalStack.length === 0) return;

      const topModal = activeModalStack[activeModalStack.length - 1];

      if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) {
        if (topModal.options.closeOnEscape && topModal.isOpen) {
          event.preventDefault();
          topModal.close({ trigger: 'escape' });
        }
        return;
      }

      if (event.key === 'Tab' || event.keyCode === 9) {
        topModal._trapFocus(event);
      }
    }

    static _ensureGlobalKeyboardListener() {
      if (!globalKeydownHandler) {
        globalKeydownHandler = ModalDialog._handleGlobalKeydown;
        document.addEventListener('keydown', globalKeydownHandler, true);
      }
    }

    static _checkGlobalKeyboardListener() {
      if (activeModalStack.length === 0 && globalKeydownHandler) {
        document.removeEventListener('keydown', globalKeydownHandler, true);
        globalKeydownHandler = null;
      }
    }

    static initAll() {
      document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-modal-target], [data-modal-toggle]');
        if (!trigger) return;

        const targetSelector = trigger.dataset.modalTarget || trigger.getAttribute('href');
        if (!targetSelector) return;

        event.preventDefault();

        const modalEl = document.querySelector(targetSelector);
        if (!modalEl) {
          console.warn(`[ModalDialog] Target modal "${targetSelector}" was not found.`);
          return;
        }

        const instance = modalEl.__modalInstance || new ModalDialog(modalEl);
        instance.open({ trigger: trigger });
      });
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => ModalDialog.initAll());
    } else {
      ModalDialog.initAll();
    }
  }

  return ModalDialog;
});
