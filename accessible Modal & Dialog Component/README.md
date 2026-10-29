# Accessible Modal Dialog Component (`ModalDialog`)

A production-grade, zero-dependency, accessible, and responsive interactive Modal Dialog component engineered in **Vanilla JavaScript**, **semantic HTML5**, and **modern CSS3**.

Adheres strictly to the **W3C WAI-ARIA 1.2 Dialog (Modal) Authoring Practices** and **WCAG 2.1 AA** accessibility standards.

---

## Table of Contents
1. [Component Overview & UX Rationale](#1-component-overview--ux-rationale)
2. [Key Features](#2-key-features)
3. [Component Architecture & Directory Structure](#3-component-architecture--directory-structure)
4. [Semantic HTML5 Structure](#4-semantic-html5-structure)
5. [CSS Styling & Design System](#5-css-styling--design-system)
6. [JavaScript API Reference](#6-javascript-api-reference)
7. [Accessibility & WAI-ARIA Compliance](#7-accessibility--wai-aria-compliance)
8. [Error Handling & Fallback Strategies](#8-error-handling--fallback-strategies)
9. [Testing & Verification Guide](#9-testing--verification-guide)
10. [Browser Support Matrix](#10-browser-support-matrix)

---

## 1. Component Overview & UX Rationale

The modal dialog is one of the most critical and frequently misused interactive components in modern web applications. When designed properly, modals enhance user engagement by:
- **Focusing User Attention**: Isolating critical workflows (forms, confirmations, authentications) without navigating away from the current page.
- **Preventing Catastrophic Errors**: Providing high-friction confirmation prompts (`alertdialog`) before destructive operations.
- **Reducing Cognitive Load**: Breaking complex multi-step processes into clean, focused sub-flows.

This component was built to solve every single one of those challenges in pure vanilla JavaScript with zero runtime dependencies.

---

## 2. Key Features

- **Strict WAI-ARIA 1.2 Compliance**: Native support for `role="dialog"` and `role="alertdialog"`, `aria-modal="true"`, `aria-hidden` state syncing, and dynamic `aria-labelledby` / `aria-describedby` association.
- **Robust Focus Trap**: Intercepts keyboard navigation (`Tab` and `Shift+Tab`) ensuring focus cycles exclusively inside the active dialog window.
- **Intelligent Focus Placement & Restoration**: Automatically focuses inputs with `data-autofocus`, falls back gracefully to the first focusable element or the dialog container, and reliably restores focus to the invoking trigger upon dismissal.
- **Scroll Locking with Scrollbar Compensation**: Locks `document.body` scrolling when active and dynamically calculates browser scrollbar width to prevent jarring horizontal layout shifts.
- **LIFO Stack Management**: Handles nested and stacked modals cleanly, closing the topmost dialog first when pressing `Escape`.
- **Hardware-Accelerated Transitions**: CSS scale and fade animations with fallback JavaScript timers to handle interrupted or disabled CSS animations.
- **Adaptive Layouts**: Standard modal, small alert, wide sheet, and an off-canvas **Slide Drawer** variant (`.modal--drawer-right`).
- **Inclusive Design**: Full dark mode support via `prefers-color-scheme` and instant transitions for users with `prefers-reduced-motion: reduce`.
- **Dual Invocation**: Supports declarative HTML attributes (`data-modal-target="#id"`) and a flexible programmatic API (`new ModalDialog()`).

---

## 3. Component Architecture & Directory Structure

```text
accessible-modal-component/
├── index.html              # Interactive demonstration showcase page
├── README.md               # Comprehensive documentation and testing guide
├── package.json            # NPM manifest & script runner
├── css/
│   ├── modal.css           # Standalone component stylesheet & design tokens
│   └── demo.css            # Showcase page styling & layout
├── js/
│   └── modal.js            # Modular Vanilla JS ModalDialog class (UMD / ESM)
└── test/
    ├── test-runner.html    # In-browser automated unit test runner
    ├── modal.test.js       # In-browser test assertions suite
    └── node-runner.js      # Headless Node.js CLI test suite
```

---

## 4. Semantic HTML5 Structure

The component uses semantic HTML5 elements structured to ensure assistive technologies interpret the dialog correctly:

```html
<!-- Modal Outer Wrapper (fixed overlay) -->
<div id="example-modal" class="modal is-hidden" aria-hidden="true">
  <!-- Clickable backdrop overlay -->
  <div class="modal__backdrop" tabindex="-1"></div>

  <!-- Dialog Window -->
  <div class="modal__dialog" 
       role="dialog" 
       aria-modal="true" 
       aria-labelledby="example-modal-title" 
       aria-describedby="example-modal-desc" 
       tabindex="-1">
    
    <!-- Modal Header -->
    <header class="modal__header">
      <h2 id="example-modal-title" class="modal__title">Dialog Title</h2>
      <button type="button" class="modal__close" data-modal-close aria-label="Close dialog">
        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </header>

    <!-- Modal Body Content -->
    <div class="modal__body">
      <p id="example-modal-desc">This is the descriptive text explaining the purpose of this dialog.</p>
      <input type="text" data-autofocus placeholder="Focus lands here automatically">
    </div>

    <!-- Modal Footer Actions -->
    <footer class="modal__footer">
      <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
      <button type="button" class="btn btn-primary">Confirm</button>
    </footer>
  </div>
</div>
```

---

## 5. CSS Styling & Design System

The stylesheet `css/modal.css` uses CSS custom properties for easy theming and consistent spacing:

### Design Tokens (`:root`)

```css
:root {
  --modal-bg-surface: #ffffff;
  --modal-bg-header: #f8fafc;
  --modal-bg-footer: #f8fafc;
  --modal-backdrop-color: rgba(15, 23, 42, 0.65);
  --modal-backdrop-blur: 4px;
  --modal-text-main: #0f172a;
  --modal-text-muted: #64748b;
  --modal-border-color: #e2e8f0;
  --modal-border-radius: 12px;
  --modal-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  --modal-max-width-md: 560px;
  --modal-transition-duration: 250ms;
  --modal-focus-ring-color: #3b82f6;
}
```

---

## 6. JavaScript API Reference

### Declarative Usage
Add `data-modal-target="#modal-id"` to any button or link:

```html
<button type="button" data-modal-target="#example-modal">Open Modal</button>
```

Add `data-modal-close` to any element inside the modal to make it dismiss the dialog on click.

### Programmatic Usage

```javascript
const modalEl = document.querySelector('#example-modal');
const modal = new ModalDialog(modalEl, {
  initialFocus: 'first',      // 'first' | 'container' | 'closeButton' | CSS selector
  closeOnEscape: true,        // Close when pressing Escape key
  closeOnBackdrop: true,      // Close when clicking overlay backdrop
  lockScroll: true,           // Lock body scroll and prevent layout shift
  scrollbarCompensation: true,// Add dynamic padding to body
  restoreFocus: true,         // Return focus to trigger button
  role: 'dialog',             // 'dialog' | 'alertdialog'
  onOpen: (instance, meta) => console.log('Opened:', instance),
  onClose: (instance, meta) => console.log('Closed:', instance)
});

modal.open();
modal.close();
modal.toggle();
modal.destroy();
```

---

## 7. Accessibility & WAI-ARIA Compliance

This component was audited against the **W3C WAI-ARIA Authoring Practices 1.2**:
1. **Role Semantics**: Standard modals receive `role="dialog"` and `aria-modal="true"`. Critical alerts receive `role="alertdialog"`.
2. **Labeling**: `aria-labelledby` automatically links to the dialog's header title; `aria-describedby` links to body description.
3. **Focus Trapping**: Keyboard `Tab` and `Shift+Tab` cycling is strictly confined inside the dialog.
4. **Focus Restoration**: Keyboard focus is returned cleanly to the invoking element upon dismissal.
5. **Keyboard Support**: `Escape` closes the active modal; `Tab` / `Shift+Tab` cycles elements.
6. **High Contrast & Visibility**: `:focus-visible` defines an unmistakable 3px high-contrast outline with 2px offset.
7. **Reduced Motion**: Full compliance with `prefers-reduced-motion: reduce`.

---

## 8. Error Handling & Fallback Strategies

- **Invalid Selector Guard**: Constructor verifies that the target selector or HTMLElement exists; throws an informative error message if null.
- **Duplicate Opening Prevention**: Guard clauses prevent state corruption if `open()` or `close()` are called repeatedly during transitions.
- **CSS Transition Fallback**: A defensive JavaScript `setTimeout` guarantees callbacks execute even if transitions fail or are interrupted.
- **Progressive Enhancement / No-JS Fallback**: Semantic markup includes a `<noscript>` notice explaining script requirements; content remains readable in static document flow.
- **Scrollbar Shift Prevention**: Computes the exact scrollbar width and applies compensation padding, preventing the entire page from jumping when scroll locks.

---

## 9. Testing & Verification Guide

### 1. Interactive Demonstration Showcase
Open `index.html` in any web browser to test form modals, danger alerts, slide drawers, scrollable terms, and stacked modals.

### 2. In-Browser Automated Test Suite
Open `test/test-runner.html` in any modern browser to run 8 programmatic unit and integration test assertions.

### 3. Headless CLI Test Suite (Node.js)
Run:
```bash
node test/node-runner.js
```

---

## 10. Browser Support Matrix

| Browser | Version | Support |
| :--- | :--- | :--- |
| Google Chrome | 60+ | Full Support |
| Mozilla Firefox | 60+ | Full Support |
| Apple Safari / iOS Safari | 12+ | Full Support |
| Microsoft Edge | 79+ (Chromium) | Full Support |
| Older Browsers (ES5) | Legacy | Gracefully degrades |

---
*Created with zero runtime dependencies. Designed for enterprise maintainability, accessibility, and performance.*
