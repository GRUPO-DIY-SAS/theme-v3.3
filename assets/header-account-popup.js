(() => {
  const globalKey = 'PurityHeaderAccountPopup';
  const existingApi = window[globalKey];

  if (existingApi?.bindAccountPopups && existingApi?.syncHeaderHeight) {
    existingApi.syncHeaderHeight();
    existingApi.bindAccountPopups(document);
    return;
  }

  const root = document.documentElement;
  const accountSelector = '.header-account-popup shopify-account';
  const accountShadowStyleId = 'purity-account-sheet-style';
  const accountLoginShadowStyleId = 'purity-account-login-style';
  const accountOverlayClass = 'purity-account-dialog-overlay';
  const accountMobileSheetLayout = 'mobile-sheet';
  const accountMobileSheetDialogClass = 'dialog-mobile-sheet';
  const accountDialogActiveClass = 'dialog-active';
  const accountDialogClosingClass = 'dialog-closing';
  const accountDialogOpenDurationMs = 200;
  const accountDialogCloseDurationMs = 300;
  const accountDialogCloseEasing = 'cubic-bezier(0.5, -0.03, 0.34, 0.83)';
  const accountInitialFocusGuardDurationMs = 320;
  const accountSheetCloseAnimationName = 'accountSheetClose';
  const accountSheetCloseOffsetProperty = '--account-sheet-close-offset';
  const sheetDragThreshold = 100;
  const sheetDragResistance = 0.4;
  const accountObservers = new WeakMap();
  const accountDialogListeners = new WeakSet();
  const accountCloseTimers = new WeakMap();
  const accountOpenFrames = new WeakMap();
  const accountNativeCloseBypass = new WeakSet();
  const closingAccounts = new WeakSet();
  const accountSheetDragStates = new WeakMap();
  const accountInitialFocusGuardTimers = new WeakMap();
  const accountInitialFocusSuppressUntil = new WeakMap();
  const accountInitialFocusGuardRoots = new WeakSet();
  const accountCloseCanvasSubscriptions = new WeakMap();
  const systemPopupOpenClass = 'open-popup';
  const systemTingleEnabledClass = 'tingle-enabled';
  const accountShadowStyles = `
    .dialog {
      --dialog-drawer-opening-animation: none;
      --dialog-drawer-closing-animation: none;
      box-sizing: border-box;
      position: fixed !important;
      inset: 0 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 100vw !important;
      max-width: none !important;
      height: 100dvh !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 1.5rem !important;
      background: transparent !important;
      background-color: transparent !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      clip-path: none !important;
      overflow: visible !important;
      pointer-events: none;
    }

    .dialog[open] {
      animation: none !important;
    }

    .account,
    .account__header,
    .account__header-content,
    .account__content,
    .account__login-form-container,
    shopify-login-form,
    nav.stack-inline {
      box-sizing: border-box;
      min-width: 0;
    }

    .account__header,
    .account__header-content,
    .account__content,
    .account__login-form-container,
    shopify-login-form,
    nav.stack-inline {
      width: 100%;
    }

    .${accountOverlayClass} {
      background-color: #1d1d1f80;
      min-height: 100lvh;
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 1;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      cursor:
      url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" fill="none"><rect width="60" height="60" fill="%23fff" rx="30"/><path fill="%231D1D1F" d="M22.348 23.93a1.02 1.02 0 0 1-.348-.778c0-.321.116-.598.348-.83.214-.215.481-.322.803-.322.32 0 .588.107.802.322L30 28.379l6.047-6.057c.214-.215.481-.322.803-.322.32 0 .588.107.802.322.232.232.348.509.348.83 0 .304-.116.563-.348.778l-6.047 6.057 6.047 6.057c.232.232.348.509.348.83 0 .304-.116.563-.348.778a1.046 1.046 0 0 1-.803.348c-.32 0-.588-.116-.802-.348L30 31.622l-6.047 6.03a1.046 1.046 0 0 1-.802.348c-.322 0-.59-.116-.803-.348a1.02 1.02 0 0 1-.348-.778c0-.321.116-.598.348-.83l6.047-6.057-6.047-6.057Z"/></svg>')
        30 30,
      pointer;      transition:
        opacity var(--dur-in, 0.5s) var(--ease-in, ease),
        visibility 0s linear var(--dur-in, 0.5s),
        background-color var(--dur-in, 0.5s) var(--ease-in, ease);
      transition-property: opacity, visibility, background-color;
    }

    .account {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      align-self: center;
      flex: 0 0 auto;
      width: min(var(--drawer-width, 48rem), calc(100vw - 3rem), 90vw);
      max-width: 100%;
      height: auto !important;
      min-height: 0 !important;
      max-height: min(80vh, calc(100dvh - 3rem));
      background: var(--shopify-account-color-background, #fff);
      border: 1px solid var(--shopify-account-color-border, rgba(29, 29, 31, 0.08));
      box-shadow: 0 0 24px 0 var(--shopify-account-color-shadow, rgba(0, 0, 0, 0.08));
      overflow: hidden;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      will-change: transform, opacity;
      transform: scale(0.85);
      transform-origin: center center;
      transition:
        opacity ${accountDialogOpenDurationMs}ms ease,
        transform ${accountDialogOpenDurationMs}ms ease,
        visibility 0s linear ${accountDialogOpenDurationMs}ms;
      border-radius: var(--shopify-account-radius-dialog, 10px);
      clip-path: inset(0 0 0 0 round var(--shopify-account-radius-dialog, 10px));
    }

    .account__content,
    .account__login-form-container,
    shopify-login-form {
      display: block;
      height: auto !important;
      min-height: 0 !important;
      flex: 0 1 auto;
    }

    :is(#close-button, .account__close, button[aria-label="Close menu"]) svg {
      transition: transform 0.3s;
    }

    :is(#close-button, .account__close, button[aria-label="Close menu"]):hover svg {
      transform: rotate(180deg);
    }

    nav.stack-inline {
      align-self: stretch;
    }

    .dialog::backdrop {
      background: transparent !important;
      background-color: transparent !important;
      opacity: 0 !important;
      visibility: hidden !important;
      transition: none !important;
      animation: none !important;
    }

    .dialog[open].${accountDialogActiveClass} {
      pointer-events: auto;
    }

    .dialog[open].${accountDialogActiveClass} .${accountOverlayClass} {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transition-delay: 0s;
    }

    .dialog[open].${accountDialogActiveClass} .account {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: scale(1);
      transition-delay: 0s;
    }

    .dialog[open].${accountDialogClosingClass} {
      pointer-events: none;
    }

    .dialog[open].${accountDialogClosingClass} .${accountOverlayClass} {
      opacity: 0;
      visibility: hidden;
      transition:
        opacity var(--dur-out, 0.48s) var(--ease-in, ease),
        visibility 0s linear var(--dur-out, 0.48s),
        background-color var(--dur-out, 0.48s) var(--ease-in, ease);
      transition-property: opacity, visibility, background-color;
    }

    .dialog[open].${accountDialogClosingClass} .account {
      visibility: visible;
      pointer-events: none;
      transition: none;
      animation: zoomOut ${accountDialogCloseDurationMs}ms ${accountDialogCloseEasing} forwards;
    }

    @keyframes zoomOut {
      0% {
        transform: scale(1);
        opacity: 1;
        visibility: visible;
      }

      100% {
        transform: scale(0.8);
        opacity: 0;
        visibility: hidden;
      }
    }

    @keyframes ${accountSheetCloseAnimationName} {
      0% {
        transform: translateY(var(${accountSheetCloseOffsetProperty}, 0px));
      }

      100% {
        transform: translateY(calc(100% + 1rem));
      }
    }

    @media (min-width: 1025px) {
      .account {
        width: min(var(--drawer-width, 48rem), calc(100vw - 3rem), 90vw);
        max-height: 80vh;
      }
    }

    @media (max-width: 1024.98px) {
      .dialog {
        padding: 1.5rem !important;
      }

      .account {
        width: min(100%, calc(100vw - 3rem));
        max-height: calc(100dvh - 3rem);
      }

      .dialog.${accountMobileSheetDialogClass} {
        align-items: flex-end !important;
        justify-content: center !important;
        padding: 0 !important;
      }

      .dialog.${accountMobileSheetDialogClass} .account {
        align-self: flex-end;
        width: 100%;
        max-width: 100%;
        max-height: min(calc(100dvh - 0.75rem), 92dvh);
        border-width: 1px 0 0;
        border-radius: 20px 20px 0 0;
        clip-path: none;
        opacity: 1;
        transform: translateY(calc(100% + 1rem));
        transform-origin: center bottom;
        transition:
          transform ${accountDialogOpenDurationMs}ms ease,
          visibility 0s linear ${accountDialogOpenDurationMs}ms;
      }

      .dialog.${accountMobileSheetDialogClass} .account__header {
        position: relative;
        cursor: grab;
        padding-top: 1.2rem;
      }

      .dialog[open].${accountDialogActiveClass}.${accountMobileSheetDialogClass} .account {
        visibility: visible;
        pointer-events: auto;
        transform: translateY(0);
      }

      .dialog[open].${accountDialogClosingClass}.${accountMobileSheetDialogClass} .account {
        opacity: 1;
        visibility: visible;
        pointer-events: none;
        transition: none;
        animation: ${accountSheetCloseAnimationName} ${accountDialogCloseDurationMs}ms ${accountDialogCloseEasing} forwards;
      }

      .dialog.${accountMobileSheetDialogClass}.is-dragging .account {
        transition: none !important;
      }
    }
  `;

  const accountLoginShadowStyles = `
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }

    #shopify-element-wrapper,
    .account__login-form,
    .account__email-form,
    .account__email-input-wrapper {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
    }
  `;

  const syncHeaderHeight = () => {
    const header = document.querySelector('.header-site');
    if (!header) return;

    requestAnimationFrame(() => {
      const height = header.getBoundingClientRect().height || 0;
      document.body.style.setProperty('--header-height', `${Math.ceil(height)}px`);
    });
  };

  const getSystemScrollbarWidth = () => {
    if (typeof window.getScrollBarWidth?.init === 'function') {
      return window.getScrollBarWidth.init() || 0;
    }

    const viewportWidth = window.innerWidth || 0;
    const documentWidth = document.documentElement?.clientWidth || 0;
    const width = viewportWidth - documentWidth;

    return width > 0 ? width : 0;
  };

  const hasVisibleSystemTingleModal = () =>
    document.querySelector('.tingle-modal--visible') != null;

  const closeSystemCanvasBeforeOpenAccount = () => {
    if (typeof window.CloseAllPopup === 'function') {
      window.CloseAllPopup({ source: 'account-popup' });
      return;
    }

    if (typeof window.publish === 'function') {
      window.publish('closeCanvas', { source: 'account-popup' });
    }
  };

  const shouldPreserveNonAccountScrollLock = () => {
    if (root.classList.contains('open-modal')) return true;
    if (root.classList.contains('open-modal-shopable-video')) return true;
    if (root.classList.contains('open-modal-offer-popup')) return true;
    if (root.classList.contains('open-search')) return true;
    if (root.classList.contains('open-minicart')) return true;
    if (root.classList.contains('nav-open')) return true;
    if (root.classList.contains('open-sidebar')) return true;
    if (root.classList.contains('open-byl')) return true;
    if (hasVisibleSystemTingleModal()) return true;
    if (document.querySelector('.active-modal-js.active')) return true;

    return false;
  };

  const ensureSystemPopupLock = () => {
    if (root.classList.contains(systemPopupOpenClass)) return;

    root.classList.add(systemPopupOpenClass);
    document.body.classList.add(systemTingleEnabledClass);
    document.dispatchEvent(new CustomEvent('modal:opened'));

    if (window.innerWidth < 767.95) return;
    document.body.style.setProperty('padding-right', `${getSystemScrollbarWidth()}px`);
  };

  const syncAccountScrollLockState = (hasOpenAccountSheet) => {
    if (!hasOpenAccountSheet) return;

    ensureSystemPopupLock();
    if (shouldPreserveNonAccountScrollLock()) return;

    removeInlineLockStyle(root, 'overflow', ['hidden']);
    removeInlineLockStyle(root, 'touch-action', ['none']);
    removeInlineLockStyle(root, 'scrollbar-gutter', ['stable']);
    removeInlineLockStyle(document.body, 'touch-action', ['none']);
  };

  const getAccountDialog = (account) => {
    const shadowRoot = account?.shadowRoot;
    if (!shadowRoot) return null;

    return shadowRoot.querySelector('dialog');
  };

  const getAccountPanel = (account) => {
    const shadowRoot = account?.shadowRoot;
    if (!shadowRoot) return null;

    return shadowRoot.querySelector('.account');
  };

  const getAccountCloseTrigger = (account) => {
    const shadowRoot = account?.shadowRoot;
    if (!shadowRoot) return null;

    return shadowRoot.querySelector('#close-button, .account__close, button[aria-label="Close menu"]');
  };

  const getAccountAuthState = (account) => {
    const shadowRoot = account?.shadowRoot;
    if (!shadowRoot) return 'unknown';

    const avatarTrigger = shadowRoot.querySelector('.account-button[part]');
    if (!(avatarTrigger instanceof HTMLElement)) return 'unknown';

    const partValue = (avatarTrigger.getAttribute('part') || '').trim();
    if (!partValue) return 'unknown';
    if (partValue.includes('signed-in-avatar')) return 'signed-in';
    if (partValue.includes('signed-out-avatar')) return 'signed-out';

    return 'unknown';
  };

  const syncAccountAuthState = (account) => {
    if (!account) return;

    account.dataset.accountAuthState = getAccountAuthState(account);
  };

  const isMobileSheetAccount = (account) =>
    account?.dataset?.accountPopupLayout === accountMobileSheetLayout;

  const shouldUseMobileSheet = (account) =>
    isMobileSheetAccount(account) && window.innerWidth <= 1024;

  const clearAccountSheetOffset = (accountPanel) => {
    if (!(accountPanel instanceof HTMLElement)) return;

    accountPanel.style.removeProperty(accountSheetCloseOffsetProperty);
    accountPanel.style.removeProperty('transform');
    accountPanel.style.removeProperty('transition');
    accountPanel.style.removeProperty('will-change');
  };

  const syncAccountDialogLayout = (account) => {
    const dialog = getAccountDialog(account);
    if (!(dialog instanceof HTMLDialogElement)) return;

    const useMobileSheet = shouldUseMobileSheet(account);
    dialog.classList.toggle(accountMobileSheetDialogClass, useMobileSheet);

    if (!useMobileSheet) {
      dialog.classList.remove('is-dragging');
      clearAccountSheetOffset(getAccountPanel(account));
    }
  };

  const getDeepActiveElement = (rootNode) => {
    let activeElement = rootNode?.activeElement || null;

    while (activeElement?.shadowRoot?.activeElement) {
      activeElement = activeElement.shadowRoot.activeElement;
    }

    return activeElement;
  };

  const shouldSuppressInitialAccountFieldFocus = (account) => {
    const suppressUntil = accountInitialFocusSuppressUntil.get(account) || 0;

    return suppressUntil > Date.now();
  };

  const toggleAccountInitialFocusSuppression = (account, suppressed) => {
    const dialog = getAccountDialog(account);
    if (!(dialog instanceof HTMLDialogElement)) return;

    const guardTargets = dialog.querySelectorAll('.account__content, .account__login-form-container, shopify-login-form');
    guardTargets.forEach((target) => {
      if (!(target instanceof HTMLElement)) return;

      target.inert = suppressed;
      if (suppressed) {
        target.setAttribute('data-initial-focus-suppressed', 'true');
      } else {
        target.removeAttribute('data-initial-focus-suppressed');
      }
    });
  };

  const clearInitialAccountFieldFocusGuard = (account) => {
    const timerId = accountInitialFocusGuardTimers.get(account);
    if (timerId != null) {
      window.clearTimeout(timerId);
      accountInitialFocusGuardTimers.delete(account);
    }

    accountInitialFocusSuppressUntil.delete(account);
    toggleAccountInitialFocusSuppression(account, false);
  };

  const preventInitialAccountFieldFocus = (account) => {
    const shadowRoot = account?.shadowRoot;
    if (!shadowRoot) return;

    const dialog = getAccountDialog(account);
    if (!(dialog instanceof HTMLDialogElement) || !dialog.hasAttribute('open')) return;

    const activeElement = getDeepActiveElement(shadowRoot);
    if (!(activeElement instanceof HTMLElement)) return;
    if (!activeElement.matches('input, textarea, select, [contenteditable="true"]')) return;

    activeElement.blur();

    const fallbackFocusTarget =
      getAccountCloseTrigger(account) || getAccountPanel(account) || dialog;
    if (!(fallbackFocusTarget instanceof HTMLElement)) return;

    if (!fallbackFocusTarget.hasAttribute('tabindex')) {
      fallbackFocusTarget.setAttribute('tabindex', '-1');
    }

    fallbackFocusTarget.focus({ preventScroll: true });
  };

  const handleInitialAccountFieldFocus = (account) => {
    if (!shouldSuppressInitialAccountFieldFocus(account)) return;

    window.setTimeout(() => {
      preventInitialAccountFieldFocus(account);
    }, 0);
  };

  const armInitialAccountFieldFocusGuard = (account) => {
    clearInitialAccountFieldFocusGuard(account);
    accountInitialFocusSuppressUntil.set(
      account,
      Date.now() + accountInitialFocusGuardDurationMs,
    );
    toggleAccountInitialFocusSuppression(account, true);
    window.setTimeout(() => {
      preventInitialAccountFieldFocus(account);
    }, 0);
    accountInitialFocusGuardTimers.set(
      account,
      window.setTimeout(() => {
        clearInitialAccountFieldFocusGuard(account);
      }, accountInitialFocusGuardDurationMs),
    );
  };

  const shouldPreserveDocumentScrollLock = () => {
    if (root.classList.contains('open-modal-account')) return true;
    if (root.classList.contains('open-modal')) return true;
    if (root.classList.contains('open-modal-shopable-video')) return true;
    if (root.classList.contains('open-modal-offer-popup')) return true;
    if (root.classList.contains('open-search')) return true;
    if (root.classList.contains('open-minicart')) return true;
    if (root.classList.contains('nav-open')) return true;
    if (root.classList.contains('open-sidebar')) return true;
    if (root.classList.contains('open-byl')) return true;
    if (hasVisibleSystemTingleModal()) return true;
    if (document.querySelector('.active-modal-js.active')) return true;

    return [...document.querySelectorAll(accountSelector)].some(
      (account) =>
        account?.dataset?.accountSheetClosing === 'true' || isAccountSheetOpen(account),
    );
  };

  const removeInlineLockStyle = (element, property, expectedValues = []) => {
    if (!element?.style) return;

    const value = element.style.getPropertyValue(property).trim();
    if (!value) return;
    if (expectedValues.length > 0 && !expectedValues.includes(value)) return;

    element.style.removeProperty(property);
  };

  const releaseAccountScrollLock = () => {
    if (shouldPreserveDocumentScrollLock()) return;

    root.classList.remove(systemPopupOpenClass);
    document.body.classList.remove(systemTingleEnabledClass);
    document.dispatchEvent(new CustomEvent('modal:closed'));
    document.body.style.removeProperty('padding-right');
    removeInlineLockStyle(root, 'overflow', ['hidden']);
    removeInlineLockStyle(root, 'touch-action', ['none']);
    removeInlineLockStyle(root, 'scrollbar-gutter', ['stable']);
    removeInlineLockStyle(document.body, 'overflow', ['hidden']);
    removeInlineLockStyle(document.body, 'touch-action', ['none']);
  };

  const scheduleAccountScrollLockCleanup = () => {
    window.requestAnimationFrame(() => {
      releaseAccountScrollLock();
      window.setTimeout(releaseAccountScrollLock, 0);
    });
  };

  const requestNativeAccountClose = (account) => {
    const dialog = getAccountDialog(account);
    if (!(dialog instanceof HTMLDialogElement)) return false;

    const closeTrigger = getAccountCloseTrigger(account);
    if (closeTrigger instanceof HTMLElement) {
      accountNativeCloseBypass.add(account);
      closeTrigger.click();

      window.requestAnimationFrame(() => {
        accountNativeCloseBypass.delete(account);
      });

      return true;
    }

    if (typeof dialog.requestClose === 'function') {
      dialog.requestClose();
      return true;
    }

    dialog.close();
    return true;
  };

  const ensureAccountDialogStructure = (account) => {
    const dialog = getAccountDialog(account);
    if (!(dialog instanceof HTMLDialogElement)) return;
    if (dialog.querySelector(`.${accountOverlayClass}`)) return;

    const overlay = document.createElement('div');
    overlay.className = accountOverlayClass;
    overlay.setAttribute('aria-hidden', 'true');
    dialog.prepend(overlay);
  };

  const getDialogAnimationDuration = () => accountDialogCloseDurationMs;

  const getAccountCloseAnimationName = (account) => {
    const dialog = getAccountDialog(account);
    if (!(dialog instanceof HTMLDialogElement)) return 'zoomOut';

    return dialog.classList.contains(accountMobileSheetDialogClass)
      ? accountSheetCloseAnimationName
      : 'zoomOut';
  };

  const ensureAccountSheetDrag = (account) => {
    const shadowRoot = account?.shadowRoot;
    if (!shadowRoot || accountSheetDragStates.has(account)) return;

    const state = {
      isDragging: false,
      startY: 0,
      currentY: 0,
    };

    const startDrag = (event) => {
      if (!shouldUseMobileSheet(account)) return;

      const dialog = getAccountDialog(account);
      const accountPanel = getAccountPanel(account);
      if (!(dialog instanceof HTMLDialogElement) || !(accountPanel instanceof HTMLElement)) return;
      if (!dialog.hasAttribute('open')) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('.account__header')) return;
      if (target.closest('#close-button, .account__close, button[aria-label="Close menu"]')) return;

      state.isDragging = true;
      state.startY = event.type.includes('mouse') ? event.clientY : event.touches[0].clientY;
      state.currentY = state.startY;

      dialog.classList.add('is-dragging');
      accountPanel.style.transition = 'none';
      accountPanel.style.willChange = 'transform';
    };

    const onDrag = (event) => {
      if (!state.isDragging || !shouldUseMobileSheet(account)) return;

      const accountPanel = getAccountPanel(account);
      if (!(accountPanel instanceof HTMLElement)) return;

      if (event.cancelable) {
        event.preventDefault();
      }

      state.currentY = event.type.includes('mouse') ? event.clientY : event.touches[0].clientY;
      const dragDistance = Math.max(0, state.currentY - state.startY);
      const offset = dragDistance * sheetDragResistance;

      accountPanel.style.setProperty(accountSheetCloseOffsetProperty, `${offset}px`);
      accountPanel.style.transform = `translateY(${offset}px)`;
    };

    const endDrag = () => {
      if (!state.isDragging) return;

      state.isDragging = false;

      const dialog = getAccountDialog(account);
      const accountPanel = getAccountPanel(account);
      if (!(dialog instanceof HTMLDialogElement) || !(accountPanel instanceof HTMLElement)) return;

      dialog.classList.remove('is-dragging');

      const dragDistance = Math.max(0, state.currentY - state.startY);

      if (dragDistance > sheetDragThreshold) {
        closeAccountPopup(account);
        return;
      }

      accountPanel.style.transition = 'transform 0.1s ease-in-out';
      accountPanel.style.transform = '';
      accountPanel.style.removeProperty(accountSheetCloseOffsetProperty);

      window.setTimeout(() => {
        accountPanel.style.removeProperty('transition');
        accountPanel.style.removeProperty('will-change');
      }, 120);
    };

    shadowRoot.addEventListener('touchstart', startDrag, { passive: true });
    shadowRoot.addEventListener('mousedown', startDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('touchend', endDrag);
    document.addEventListener('mouseup', endDrag);

    accountSheetDragStates.set(account, state);
  };

  const clearScheduledAccountOpen = (account) => {
    const frameId = accountOpenFrames.get(account);
    if (frameId == null) return;

    window.cancelAnimationFrame(frameId);
    accountOpenFrames.delete(account);
  };

  const clearAccountCloseTimer = (account) => {
    const closeState = accountCloseTimers.get(account);
    if (!closeState) return;

    window.clearTimeout(closeState.timeoutId);
    if (closeState.animationTarget && closeState.handleAnimationEnd) {
      closeState.animationTarget.removeEventListener('animationend', closeState.handleAnimationEnd);
    }

    accountCloseTimers.delete(account);
  };

  const queueAccountDialogOpen = (account) => {
    const dialog = getAccountDialog(account);
    if (!(dialog instanceof HTMLDialogElement) || !dialog.hasAttribute('open')) return;
    if (dialog.classList.contains(accountDialogClosingClass)) return;

    syncAccountDialogLayout(account);
    clearScheduledAccountOpen(account);
    clearAccountCloseTimer(account);
    dialog.classList.remove(accountDialogActiveClass);
    dialog.classList.remove(accountDialogClosingClass);

    const frameId = window.requestAnimationFrame(() => {
      const activeDialog = getAccountDialog(account);
      accountOpenFrames.delete(account);

      if (!(activeDialog instanceof HTMLDialogElement) || !activeDialog.hasAttribute('open')) return;

      syncAccountDialogLayout(account);
      activeDialog.classList.add(accountDialogActiveClass);
      armInitialAccountFieldFocusGuard(account);
    });

    accountOpenFrames.set(account, frameId);
  };

  const ensureAccountDialogActive = (account) => {
    const dialog = getAccountDialog(account);
    if (!(dialog instanceof HTMLDialogElement) || !dialog.hasAttribute('open')) return;
    if (accountOpenFrames.has(account)) return;
    if (dialog.classList.contains(accountDialogActiveClass)) return;
    if (dialog.classList.contains(accountDialogClosingClass)) return;

    queueAccountDialogOpen(account);
  };

  const resetAccountDialogState = (account) => {
    const dialog = getAccountDialog(account);
    if (!(dialog instanceof HTMLDialogElement)) return;

    clearInitialAccountFieldFocusGuard(account);
    clearScheduledAccountOpen(account);
    dialog.classList.remove(accountDialogActiveClass);
    dialog.classList.remove(accountDialogClosingClass);
    dialog.classList.remove('is-dragging');
    clearAccountSheetOffset(getAccountPanel(account));
    syncAccountDialogLayout(account);
  };

  const ensureAccountDialogInteractions = (account) => {
    const shadowRoot = account?.shadowRoot;
    if (!shadowRoot) return;

    shadowRoot.querySelectorAll('dialog').forEach((dialog) => {
      if (accountDialogListeners.has(dialog)) return;

      dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        closeAccountPopup(account);
      });

      dialog.addEventListener('close', () => {
        finishAccountPopupState(account, false);
      });

      accountDialogListeners.add(dialog);
    });
  };

  const isAccountSheetOpen = (account) => {
    const shadowRoot = account?.shadowRoot;
    if (!shadowRoot) return account?.dataset.accountSheetOpen === 'true';

    return shadowRoot.querySelector('dialog[open], [popover]:popover-open') != null;
  };

  const syncAccountSheetState = () => {
    const accounts = [...document.querySelectorAll(accountSelector)];
    const hasOpenAccountSheet = accounts.some((account) => {
      const isOpen = isAccountSheetOpen(account);
      account.dataset.accountSheetOpen = isOpen ? 'true' : 'false';
      syncAccountAuthState(account);
      return isOpen;
    });

    root.classList.toggle('open-modal-account', hasOpenAccountSheet);
    syncAccountScrollLockState(hasOpenAccountSheet);
  };

  const startClosingAccountPopup = (account) => {
    if (!account) return;

    clearScheduledAccountOpen(account);
    closingAccounts.add(account);
    account.dataset.accountSheetClosing = 'true';
    syncAccountSheetState();
  };

  const finishAccountPopupState = (account, isOpen) => {
    if (!account) return;

    clearScheduledAccountOpen(account);
    clearAccountCloseTimer(account);

    if (isOpen) {
      closingAccounts.delete(account);
      account.dataset.accountSheetClosing = 'false';
      account.dataset.accountSheetOpen = 'true';
      clearAccountSheetOffset(getAccountPanel(account));
      syncAccountDialogLayout(account);
      queueAccountDialogOpen(account);
    } else {
      closingAccounts.delete(account);
      account.dataset.accountSheetClosing = 'false';
      account.dataset.accountSheetOpen = 'false';
      resetAccountDialogState(account);
    }

    syncAccountSheetState();

    if (!isOpen) {
      scheduleAccountScrollLockCleanup();
    }
  };

  const ensureAccountDialogStyles = (account) => {
    const shadowRoot = account?.shadowRoot;
    if (!shadowRoot || shadowRoot.getElementById(accountShadowStyleId)) return;

    const style = document.createElement('style');
    style.id = accountShadowStyleId;
    style.textContent = accountShadowStyles;
    shadowRoot.append(style);
  };

  const ensureAccountLoginFormStyles = (account) => {
    const shadowRoot = account?.shadowRoot;
    if (!shadowRoot) return;

    shadowRoot.querySelectorAll('shopify-login-form').forEach((loginForm) => {
      const loginShadowRoot = loginForm.shadowRoot;
      if (!loginShadowRoot) return;

      if (!accountInitialFocusGuardRoots.has(loginShadowRoot)) {
        loginShadowRoot.addEventListener('focusin', () => {
          handleInitialAccountFieldFocus(account);
        });
        accountInitialFocusGuardRoots.add(loginShadowRoot);
      }
      if (loginShadowRoot.getElementById(accountLoginShadowStyleId)) return;

      const style = document.createElement('style');
      style.id = accountLoginShadowStyleId;
      style.textContent = accountLoginShadowStyles;
      loginShadowRoot.append(style);
    });
  };

  const observeAccountPopup = (account) => {
    const shadowRoot = account?.shadowRoot;
    if (!shadowRoot || accountObservers.has(account)) return;

    const observer = new MutationObserver(() => {
      const dialogIsOpen = shadowRoot.querySelector('dialog[open], [popover]:popover-open') != null;
      const previousDialogState = account.dataset.accountSheetOpen === 'true';

      ensureAccountDialogStructure(account);
      ensureAccountDialogInteractions(account);
      ensureAccountLoginFormStyles(account);
      ensureAccountSheetDrag(account);
      syncAccountDialogLayout(account);
      syncAccountAuthState(account);

      if (closingAccounts.has(account)) {
        if (!dialogIsOpen) {
          finishAccountPopupState(account, false);
          return;
        }

        syncAccountSheetState();
        return;
      }

      if (dialogIsOpen !== previousDialogState) {
        finishAccountPopupState(account, dialogIsOpen);
        return;
      }

      if (dialogIsOpen) {
        ensureAccountDialogActive(account);
      }

      syncAccountSheetState();
    });

    observer.observe(shadowRoot, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open'],
    });

    accountObservers.set(account, observer);
  };

  const closeAccountPopup = (account) => {
    const dialog = getAccountDialog(account);
    const accountPanel = getAccountPanel(account);
    if (!(dialog instanceof HTMLDialogElement)) return;

    if (!dialog.hasAttribute('open')) {
      finishAccountPopupState(account, false);
      return;
    }

    if (!(accountPanel instanceof HTMLElement)) {
      dialog.close();
      return;
    }

    if (dialog.classList.contains(accountDialogClosingClass)) return;

    startClosingAccountPopup(account);
    clearAccountCloseTimer(account);
    syncAccountDialogLayout(account);
    dialog.classList.remove(accountDialogActiveClass);
    dialog.classList.add(accountDialogClosingClass);

    const finishClose = () => {
      clearAccountCloseTimer(account);
      if (dialog.hasAttribute('open')) {
        requestNativeAccountClose(account);

        window.setTimeout(() => {
          if (dialog.hasAttribute('open')) {
            dialog.close();
          }
        }, 32);

        return;
      }

      finishAccountPopupState(account, false);
    };

    const handleAnimationEnd = (event) => {
      if (event.target !== accountPanel || event.animationName !== getAccountCloseAnimationName(account)) return;
      finishClose();
    };

    accountPanel.addEventListener('animationend', handleAnimationEnd);
    accountCloseTimers.set(account, {
      timeoutId: window.setTimeout(finishClose, getDialogAnimationDuration(dialog) + 32),
      animationTarget: accountPanel,
      handleAnimationEnd,
    });
  };

  const handleAccountShadowClick = (account, event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const dialog = getAccountDialog(account);
    const openTrigger = target.closest('.account-button');
    if (openTrigger && dialog instanceof HTMLDialogElement && !dialog.hasAttribute('open')) {
      closeSystemCanvasBeforeOpenAccount();
      ensureSystemPopupLock();
      armInitialAccountFieldFocusGuard(account);
      return;
    }

    const closeTrigger = target.closest('#close-button, .account__close, button[aria-label="Close menu"]');
    if (closeTrigger) {
      if (accountNativeCloseBypass.has(account)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      closeAccountPopup(account);
      return;
    }

    const dialogOverlay = target.closest(`.${accountOverlayClass}`);
    if (dialogOverlay) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeAccountPopup(account);
      return;
    }

    if (target instanceof HTMLDialogElement && target.hasAttribute('open')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeAccountPopup(account);
    }
  };

  const bindAccountPopup = (account) => {
    if (!account || account.dataset.accountPopupBound === 'true') return;
    if (account.dataset.accountPopupBinding === 'true') return;

    account.dataset.accountPopupBinding = 'true';

    customElements.whenDefined('shopify-account').then(() => {
      const bindWhenShadowReady = (attempt = 0) => {
        if (!account?.isConnected) {
          account.dataset.accountPopupBinding = 'false';
          return;
        }

        const shadowRoot = account.shadowRoot;
        if (!shadowRoot) {
          if (attempt < 180) {
            window.requestAnimationFrame(() => bindWhenShadowReady(attempt + 1));
            return;
          }

          account.dataset.accountPopupBinding = 'false';
          return;
        }

        if (account.dataset.accountPopupBound === 'true') {
          account.dataset.accountPopupBinding = 'false';
          return;
        }

        ensureAccountDialogStyles(account);
        ensureAccountDialogStructure(account);
        ensureAccountLoginFormStyles(account);
        ensureAccountDialogInteractions(account);
        ensureAccountSheetDrag(account);
        syncAccountDialogLayout(account);
        observeAccountPopup(account);
        syncAccountAuthState(account);
        syncAccountSheetState();

        if (!accountInitialFocusGuardRoots.has(shadowRoot)) {
          shadowRoot.addEventListener('focusin', () => {
            handleInitialAccountFieldFocus(account);
          });
          accountInitialFocusGuardRoots.add(shadowRoot);
        }

        shadowRoot.addEventListener(
          'click',
          (event) => {
            handleAccountShadowClick(account, event);
          },
          true,
        );

        shadowRoot.addEventListener('keydown', (event) => {
          if (event.key !== 'Escape') return;

          const dialog = getAccountDialog(account);
          if (!(dialog instanceof HTMLDialogElement) || !dialog.hasAttribute('open')) return;

          event.preventDefault();
          event.stopImmediatePropagation();
          closeAccountPopup(account);
        });

        if (
          typeof window.subscribe === 'function' &&
          !accountCloseCanvasSubscriptions.has(account)
        ) {
          const unsubscribe = window.subscribe('closeCanvas', (data) => {
            if (data?.source === 'account-popup') return;

            const dialog = getAccountDialog(account);
            if (!(dialog instanceof HTMLDialogElement) || !dialog.hasAttribute('open')) return;
            closeAccountPopup(account);
          });

          accountCloseCanvasSubscriptions.set(account, unsubscribe);
        }

        account.dataset.accountPopupBound = 'true';
        account.dataset.accountPopupBinding = 'false';
      };

      bindWhenShadowReady();
    });
  };

  const bindAccountPopups = (scope = document) => {
    scope.querySelectorAll(accountSelector).forEach((account) => {
      bindAccountPopup(account);
      syncAccountDialogLayout(account);
    });
    syncAccountSheetState();
  };

  const handleSectionLoad = (event) => {
    syncHeaderHeight();
    bindAccountPopups(event.target || document);
  };

  const api = {
    bindAccountPopups,
    syncHeaderHeight,
  };

  window[globalKey] = api;

  syncHeaderHeight();
  bindAccountPopups();

  window.addEventListener('resize', () => {
    syncHeaderHeight();
    bindAccountPopups();
  });
  document.addEventListener('shopify:section:load', handleSectionLoad);
})();
