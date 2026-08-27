/* JS del bloque Spotlight; se carga una vez por página vía diyvapeDeferredAssets (antes iba inline en cada instancia). */
(function () {
  if (customElements.get('spotlight-tab-sync')) return;

  class SpotlightTabSync extends HTMLElement {
    connectedCallback() {
      // Defer so the whole section is in the DOM even if we upgrade mid-parse or mid-rerender.
      requestAnimationFrame(() => this.setup());
    }

    setup() {
      if (this._ready) return;
      this.root = this.closest('.featured-tabs-spotlight');
      if (!this.root) return;
      this._ready = true;

      this.headerVariants = this.root.querySelectorAll('.featured-tabs-spotlight__header-variant');
      this.heroMedia = this.root.querySelectorAll('.featured-tabs-spotlight__hero-media');

      // A hidden hero variant must never keep playing (the lazy loader autoplays all on first gesture).
      this.heroMedia.forEach((media) => {
        media.querySelectorAll('video').forEach((video) => {
          video.addEventListener('play', () => {
            if (media.hasAttribute('hidden')) video.pause();
          });
        });
      });

      this.tabList = this.root.querySelector('.featured-tabs-spotlight__tabs');
      this.indicator = this.tabList && this.tabList.querySelector('.featured-tabs-spotlight__tab-indicator');

      this.onClick = this.onClick.bind(this);
      this.syncFromActive = this.syncFromActive.bind(this);
      this.onResize = this.onResize.bind(this);

      // Clicking a tab applies that tab directly (works even if the tab switcher is broken).
      this.root.addEventListener('click', this.onClick);

      // The sliding bar is offset-based, so it must be repositioned when the row reflows.
      if (this.indicator) window.addEventListener('resize', this.onResize);

      // Also follow the real active-tab change for keyboard/programmatic switches.
      if (this.tabList) {
        this.observer = new MutationObserver(this.syncFromActive);
        this.observer.observe(this.tabList, { subtree: true, attributes: true, attributeFilter: ['class', 'aria-selected'] });
      }

      this.syncFromActive();
      this.setupLazyPanels();
    }

    // Paneles con data-lazy-url: sus productos no vienen en el HTML inicial. Se piden todos en idle
    // tras window.load (para que el clic sea instantáneo) y, si el usuario llega antes, al activar la pestaña.
    setupLazyPanels() {
      var lazy = this.root.querySelectorAll('[data-lazy-url]');
      if (!lazy.length) return;
      var self = this;
      var prefetch = function () {
        var idle = window.requestIdleCallback || function (cb) { setTimeout(cb, 1500); };
        idle(function () { lazy.forEach(function (c) { self.loadPanel(c); }); }, { timeout: 8000 });
      };
      if (document.readyState === 'complete') prefetch();
      else window.addEventListener('load', prefetch, { once: true });
    }

    loadPanel(container) {
      if (!container || container.__spotlightLoading || !container.hasAttribute('data-lazy-url')) return container && container.__spotlightLoading;
      var url = container.getAttribute('data-lazy-url');
      var panel = container.closest('.collection-tab__tab-content');
      var blockId = panel && panel.dataset.blockId;
      container.__spotlightLoading = fetch(url, { credentials: 'same-origin' })
        .then(function (r) { return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var src = doc.querySelector('#spotlight-panel-' + blockId + ' [data-spotlight-products]');
          if (!src) return;
          container.innerHTML = src.innerHTML;
          container.removeAttribute('data-lazy-url');
          var slide = container.closest('slide-section');
          if (slide) {
            // El Swiper se creó sobre un wrapper vacío: se rehace una sola vez con los slides reales.
            if (slide.swiper && slide.swiper.destroy) { try { slide.swiper.destroy(true, true); } catch (e) {} }
            if (typeof slide.initSlide === 'function' && window.Swiper) { try { slide.initSlide(); } catch (e) {} }
          }
        })
        .catch(function () { container.__spotlightLoading = null; });
      return container.__spotlightLoading;
    }

    disconnectedCallback() {
      if (this.observer) this.observer.disconnect();
      if (this.root && this.onClick) this.root.removeEventListener('click', this.onClick);
      if (this.onResize) window.removeEventListener('resize', this.onResize);
    }

    onClick(e) {
      var tab = e.target.closest('.collection-tab__tab-item');
      if (tab) this.apply(tab.dataset.blockId);
    }

    syncFromActive() {
      var active = this.root.querySelector('.collection-tab__tab-item.active')
        || this.root.querySelector('.collection-tab__tab-item');
      this.apply(active ? active.dataset.blockId : null);
    }

    apply(blockId) {
      if (blockId === this._lastBlockId) return;
      this._lastBlockId = blockId;
      var lazyPanel = blockId && this.root.querySelector('#spotlight-panel-' + blockId + ' [data-lazy-url]');
      if (lazyPanel) this.loadPanel(lazyPanel);
      this.showVariant(this.headerVariants, 'headerBlock', blockId, false, false);
      this.showVariant(this.heroMedia, 'heroBlock', blockId, true, true);
      this.moveIndicator(blockId);
    }

    onResize() {
      this.moveIndicator(this._lastBlockId);
    }

    // Slide the active-tab bar to the matching pill's offset within the (scrollable) row.
    moveIndicator(blockId) {
      if (!this.tabList || !this.indicator) return;
      var tab = blockId && this.tabList.querySelector('.collection-tab__tab-item[data-block-id="' + blockId + '"]');
      if (!tab) {
        tab = this.tabList.querySelector('.collection-tab__tab-item.active')
          || this.tabList.querySelector('.collection-tab__tab-item');
      }
      if (!tab) return;
      this.tabList.style.setProperty('--ind-x', tab.offsetLeft + 'px');
      this.tabList.style.setProperty('--ind-w', tab.offsetWidth + 'px');
      if (!this._indReady) {
        var list = this.tabList;
        requestAnimationFrame(function () { list.classList.add('is-indicator-ready'); });
        this._indReady = true;
      }
    }

    // Show the variant whose data-*-block matches the active tab; hide the rest.
    // hasDefault: fall back to the '__default__' variant. manageVideo: play active / pause hidden.
    showVariant(list, key, blockId, hasDefault, manageVideo) {
      if (!list || !list.length) return;
      var target = null;
      var fallback = null;
      list.forEach(function (el) {
        if (el.dataset[key] === blockId) target = el;
        if (hasDefault && el.dataset[key] === '__default__') fallback = el;
      });
      var show = target || fallback || list[0];
      list.forEach(function (el) {
        var on = el === show;
        el.hidden = !on;
        if (manageVideo) {
          el.querySelectorAll('video').forEach(function (video) {
            if (on) { if (video.play) video.play().catch(function () {}); }
            else if (video.pause) video.pause();
          });
        }
      });
    }
  }

  customElements.define('spotlight-tab-sync', SpotlightTabSync);
})();
/* Pause spotlight animations while a block is offscreen — one shared observer for every
   instance, so stacking several blocks doesn't keep their motion compositing off-screen
   and jank the scroll on low-GPU devices. */
(function () {
  if (window.__spotlightPerf || !('IntersectionObserver' in window)) return;
  window.__spotlightPerf = true;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      e.target.classList.toggle('is-offscreen', !e.isIntersecting);
    });
  }, { rootMargin: '300px 0px' });
  function observe() {
    var nodes = document.querySelectorAll('.featured-tabs-spotlight');
    for (var i = 0; i < nodes.length; i++) {
      if (!nodes[i].__perfObserved) {
        nodes[i].__perfObserved = true;
        io.observe(nodes[i]);
      }
    }
  }
  observe();
  document.addEventListener('shopify:section:load', observe);
})();
