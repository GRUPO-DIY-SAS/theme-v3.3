(function () {
  const ELEMENT_NAME = "age-verification-gate";

  if (customElements.get(ELEMENT_NAME)) return;

  const idle = (callback) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(callback, { timeout: 2200 });
      return;
    }
    window.setTimeout(callback, 350);
  };

  class AgeVerificationGate extends HTMLElement {
    constructor() {
      super();
      this.cookieName = this.dataset.cookieName || "age_verified_diyvape";
      this.cookieDaysLegacy = parseInt(this.dataset.cookieDays || "365", 10);
      this.cookieDomain = this.dataset.cookieDomain || ".diyvape.co";
      this.editorModeBehavior = (this.dataset.editorModeBehavior || "show_in_editor").trim();
      this.cookiePersistence = (this.dataset.cookiePersistence || "legacy_days").trim();
      this.cookieHours = parseInt(this.dataset.cookieHours || "24", 10);
      this.cookieDaysV2 = parseInt(this.dataset.cookieDaysV2 || String(this.cookieDaysLegacy || 365), 10);
      this.cookieCustomValue = parseInt(this.dataset.cookieCustomValue || "60", 10);
      this.cookieCustomUnit = (this.dataset.cookieCustomUnit || "minutes").trim();
      this.cartSyncEnabled = String(this.dataset.cartSyncEnabled || "true") === "true";
      this.cartAttrPrefix = (this.dataset.cartAttrPrefix || "age_verification").trim();
      this.orderNoteEnabled = String(this.dataset.orderNoteEnabled || "false") === "true";
      this.orderNoteTemplate = this.dataset.orderNoteTemplate || "";
      this.ageErrorMessage = this.dataset.ageErrorMessage || "Verifica tu fecha de nacimiento. Debes ser mayor de 18 años.";
      this.idErrorMessage = this.dataset.idErrorMessage || "El numero de identificacion debe ser numerico y tener entre 8 y 10 digitos.";
      this.cookieErrorMessage = this.dataset.cookieErrorMessage || "No se pudo guardar la cookie en este navegador. Se guardo un respaldo local.";
      this.cartErrorMessage = this.dataset.cartErrorMessage || "No se pudo guardar la verificacion en el carrito. Intenta nuevamente.";

      this.initialView = this.querySelector("[data-age-initial]");
      this.formWrap = this.querySelector("[data-age-formwrap]");
      this.blockedView = this.querySelector("[data-age-blocked]");
      this.form = this.querySelector("[data-age-form]");
      this.dobInput = this.querySelector("[data-dob-input]");
      this.idInput = this.querySelector("[data-id-input]");
      this.errDob = this.querySelector('[data-error="dob"]');
      this.errId = this.querySelector('[data-error="id"]');
      this.errCookie = this.querySelector('[data-error="cookie"]');
      this.submitBtn = this.form ? this.form.querySelector('button[type="submit"]') : null;
      this.editorTriggerWrap = this.querySelector("[data-editor-trigger]") || document.querySelector(`[data-age-editor-trigger-for="${this.id}"]`);
      this.editorTriggerBtn = this.editorTriggerWrap ? this.editorTriggerWrap.querySelector("button") : null;
      this.modal = this.querySelector("[data-age-modal]");
      this._cartSyncInFlight = false;
      this._cartSyncSessionKey = "av_cart_synced_" + this.cookieName;
      this._manualPreviewKey = "av_manual_preview_" + this.cookieName;
      this._eventsReady = false;
    }

    connectedCallback() {
      this.setDobBounds();

      if (!this.isShopifyDesignMode() && this.isCartVerified()) {
        document.documentElement.classList.add("age-gate-verified");
        this.hide();
        return;
      }

      this.restoreCookieFromStorageIfNeeded();

      const verified = this.getVerifiedObject();
      if (verified) {
        document.documentElement.classList.add("age-gate-verified");
        this.hide();
        this.deferCartSync(verified, { reason: "cookie_present", force: true });
        return;
      }

      this.setupEvents();

      if (this.isShopifyDesignMode()) {
        this.applyEditorModeBehavior();
        return;
      }

      this.show();
    }

    applyEditorModeBehavior() {
      const behavior = this.editorModeBehavior;
      const urlWantsPreview = this.hasQueryParam("age_verify_preview", "1");
      const manualPreview = this.getSessionFlag(this._manualPreviewKey);

      if (this.editorTriggerWrap && this.editorTriggerBtn) {
        if (behavior === "only_preview_button") {
          this.editorTriggerWrap.style.display = "block";
          this.editorTriggerBtn.addEventListener("click", () => {
            this.setSessionFlag(this._manualPreviewKey, "1");
            this.show();
          });
        } else {
          this.editorTriggerWrap.style.display = "none";
        }
      }

      if (behavior === "hide_in_editor") {
        if (urlWantsPreview) this.show();
        else this.hide();
        return;
      }

      if (behavior === "only_preview_button") {
        if (urlWantsPreview || manualPreview) this.show();
        else this.hide();
        return;
      }

      this.show();
    }

    setupEvents() {
      if (this._eventsReady) return;
      this._eventsReady = true;

      this.querySelectorAll('[data-action="yes"]').forEach((btn) => {
        btn.addEventListener("click", () => this.showForm());
      });

      this.querySelectorAll('[data-action="no"]').forEach((btn) => {
        btn.addEventListener("click", () => this.showBlocked());
      });

      if (this.idInput) {
        this.idInput.addEventListener("input", () => {
          const cleaned = this.idInput.value.replace(/\D/g, "").slice(0, 10);
          if (this.idInput.value !== cleaned) this.idInput.value = cleaned;
          this.clearError(this.idInput, this.errId);
        });
      }

      if (this.dobInput) {
        this.dobInput.addEventListener("input", () => this.clearError(this.dobInput, this.errDob));
        this.dobInput.addEventListener("change", () => this.clearError(this.dobInput, this.errDob));
      }

      if (this.form) {
        this.form.addEventListener("submit", (event) => this.handleSubmit(event));
      }

      this.addEventListener("keydown", (event) => this.handleKeydown(event));
    }

    show() {
      const scrollY = window.scrollY;
      document.documentElement.style.setProperty("--scroll-y", `-${scrollY}px`);
      document.body.classList.add("ai-age-gate-open");
      this.removeAttribute("aria-hidden");
      requestAnimationFrame(() => {
        this.classList.add("active");
        this.focusInitialElement();
      });
    }

    hide() {
      this.classList.remove("active");
      this.setAttribute("aria-hidden", "true");
      const scrollY = document.documentElement.style.getPropertyValue("--scroll-y");
      document.body.classList.remove("ai-age-gate-open");
      window.scrollTo(0, parseInt(scrollY || "0", 10) * -1);
    }

    showForm() {
      this.initialView.style.opacity = "0";
      window.setTimeout(() => {
        this.initialView.hidden = true;
        this.formWrap.classList.add("active");
        this.formWrap.hidden = false;
        this.formWrap.style.opacity = "1";
        if (this.dobInput) this.dobInput.focus({ preventScroll: true });
      }, 130);
    }

    showBlocked() {
      this.initialView.style.opacity = "0";
      this.formWrap.style.opacity = "0";
      window.setTimeout(() => {
        this.initialView.hidden = true;
        this.formWrap.classList.remove("active");
        this.formWrap.hidden = true;
        this.blockedView.hidden = false;
        this.blockedView.classList.add("active");
        this.blockedView.style.opacity = "1";
      }, 130);
    }

    setDobBounds() {
      if (!this.dobInput) return;
      const now = new Date();
      const max = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
      this.dobInput.max = this.formatDateInputValue(max);
      this.dobInput.min = "1920-01-01";
    }

    async handleSubmit(event) {
      event.preventDefault();
      this.clearAllErrors();

      const dob = this.dobInput ? this.dobInput.value : "";
      const id = this.idInput ? (this.idInput.value || "").trim() : "";
      let ok = true;

      if (!dob || !this.isRealDate(dob) || !this.isOver18(dob)) {
        this.showError(this.errDob, this.ageErrorMessage);
        if (this.dobInput) this.dobInput.classList.add("error");
        ok = false;
      }

      if (!this.isValidID(id)) {
        this.showError(this.errId, this.idErrorMessage);
        if (this.idInput) this.idInput.classList.add("error");
        ok = false;
      }

      if (!ok) return;

      if (this.submitBtn) this.submitBtn.disabled = true;

      const payload = {
        dob,
        id: String(id),
        verified: true,
        added_at: this.formatColombiaTimestamp(),
      };

      try {
        await this.syncVerificationToCartIfNeeded(payload, { reason: "just_verified", force: true, required: true });
      } catch (error) {
        this.showError(this.errCookie, this.cartErrorMessage);
        if (this.submitBtn) this.submitBtn.disabled = false;
        return;
      }

      this.persistVerificationFallbacks(payload);

      document.documentElement.classList.add("age-gate-verified");
      this.hide();

      if (this.submitBtn) this.submitBtn.disabled = false;
    }

    focusInitialElement() {
      const target = this.querySelector("[data-autofocus]") || this.querySelector("button, input, select, textarea, a[href]");
      if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
    }

    handleKeydown(event) {
      if (event.key !== "Tab" || !this.classList.contains("active")) return;
      const focusables = Array.from(this.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    formatDateInputValue(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    formatDobToDDMMYYYY(isoDob) {
      if (!isoDob || typeof isoDob !== "string") return "";
      const parts = isoDob.split("-");
      if (parts.length !== 3) return isoDob;
      const y = parts[0];
      const m = parts[1];
      const d = parts[2];
      if (!y || !m || !d) return isoDob;
      return `${d}/${m}/${y}`;
    }

    isRealDate(iso) {
      const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
      const dt = new Date(y, m - 1, d);
      return dt && dt.getFullYear() === y && dt.getMonth() + 1 === m && dt.getDate() === d;
    }

    isOver18(isoDob) {
      const [y, m, d] = isoDob.split("-").map((n) => parseInt(n, 10));
      const birth = new Date(y, m - 1, d);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const md = today.getMonth() - birth.getMonth();
      if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age -= 1;
      return age >= 18;
    }

    isValidID(id) {
      return Boolean(id && /^\d+$/.test(id) && id.length >= 6 && id.length <= 10);
    }

    getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(";").shift();
      return null;
    }

    parseVerified(raw) {
      if (!raw) return null;

      try {
        const obj = JSON.parse(decodeURIComponent(raw));
        if (obj && obj.verified && obj.dob && obj.id) return obj;
      } catch (error) {
        try {
          const obj = JSON.parse(raw);
          if (obj && obj.verified && obj.dob && obj.id) return obj;
        } catch (innerError) {}
      }

      return null;
    }

    isVerifiedCookieValid() {
      return Boolean(this.parseVerified(this.getCookie(this.cookieName)));
    }

    getVerifiedObject() {
      return this.parseVerified(this.getCookie(this.cookieName));
    }

    isCartVerified() {
      return String(this.dataset.cartVerified || "").trim() === "true";
    }

    getCookieTTL() {
      const mode = (this.cookiePersistence || "legacy_days").trim();

      if (mode === "legacy_days") {
        const days = Number.isFinite(this.cookieDaysLegacy) && this.cookieDaysLegacy > 0 ? this.cookieDaysLegacy : 365;
        return { type: "expires", ms: days * 24 * 60 * 60 * 1000 };
      }

      if (mode === "session") return { type: "session" };

      if (mode === "hours") {
        const hours = Number.isFinite(this.cookieHours) && this.cookieHours > 0 ? this.cookieHours : 24;
        return { type: "expires", ms: hours * 60 * 60 * 1000 };
      }

      if (mode === "days") {
        const days = Number.isFinite(this.cookieDaysV2) && this.cookieDaysV2 > 0 ? this.cookieDaysV2 : 365;
        return { type: "expires", ms: days * 24 * 60 * 60 * 1000 };
      }

      if (mode === "custom") {
        const value = Number.isFinite(this.cookieCustomValue) && this.cookieCustomValue > 0 ? this.cookieCustomValue : 60;
        const unit = (this.cookieCustomUnit || "minutes").trim();
        let ms = value * 60 * 1000;
        if (unit === "hours") ms = value * 60 * 60 * 1000;
        if (unit === "days") ms = value * 24 * 60 * 60 * 1000;
        return { type: "expires", ms };
      }

      const days = Number.isFinite(this.cookieDaysLegacy) && this.cookieDaysLegacy > 0 ? this.cookieDaysLegacy : 365;
      return { type: "expires", ms: days * 24 * 60 * 60 * 1000 };
    }

    setCookieStrongFlexible(name, value, ttl, domain) {
      const secure = location && location.protocol === "https:" ? ";Secure" : "";
      const base = `${name}=${encodeURIComponent(value)};path=/;domain=${domain};SameSite=Lax${secure}`;

      if (ttl && ttl.type === "session") {
        document.cookie = base;
        return;
      }

      const ms = ttl && typeof ttl.ms === "number" ? ttl.ms : 365 * 24 * 60 * 60 * 1000;
      const date = new Date();
      date.setTime(date.getTime() + ms);
      document.cookie = `${base};expires=${date.toUTCString()}`;
    }

    persistVerificationFallbacks(payload) {
      if (!payload || !payload.verified || !payload.dob || !payload.id) return;

      this.setCookieStrongFlexible(this.cookieName, JSON.stringify(payload), this.getCookieTTL(), this.cookieDomain);
      try {
        localStorage.setItem(this.cookieName, JSON.stringify(payload));
      } catch (error) {}
    }

    restoreCookieFromStorageIfNeeded() {
      if (this.isVerifiedCookieValid()) return;
      let stored = null;

      try {
        stored = localStorage.getItem(this.cookieName);
      } catch (error) {}

      if (!stored) return;

      try {
        const obj = JSON.parse(stored);
        if (obj && obj.verified && obj.dob && obj.id) {
          this.setCookieStrongFlexible(this.cookieName, JSON.stringify(obj), this.getCookieTTL(), this.cookieDomain);
        }
      } catch (error) {}
    }

    deferCartSync(verifiedObj, opts) {
      if (opts && opts.force) {
        return this.syncVerificationToCartIfNeeded(verifiedObj, opts);
      }

      idle(() => {
        this.syncVerificationToCartIfNeeded(verifiedObj, opts).catch(() => {});
      });
      return Promise.resolve(false);
    }

    waitForCartSync() {
      return new Promise((resolve) => {
        const check = () => {
          if (!this._cartSyncInFlight) {
            resolve();
            return;
          }
          window.setTimeout(check, 60);
        };
        check();
      });
    }

    async syncVerificationToCartIfNeeded(verifiedObj, opts) {
      const required = Boolean(opts && opts.required);

      if (!this.cartSyncEnabled) {
        if (required) throw new Error("Cart sync disabled");
        return false;
      }

      if (!verifiedObj || !verifiedObj.verified || !verifiedObj.dob || !verifiedObj.id) {
        if (required) throw new Error("Missing age verification payload");
        return false;
      }

      const force = Boolean(opts && opts.force);
      if (!force && this.getSessionFlag(this._cartSyncSessionKey)) return true;

      if (this._cartSyncInFlight) {
        if (required) await this.waitForCartSync();
        return Boolean(this.getSessionFlag(this._cartSyncSessionKey));
      }

      this._cartSyncInFlight = true;

      try {
        const reduced = this.buildReducedVerificationPayload(verifiedObj);
        const attrs = {};
        attrs[this.cartAttrPrefix + "_verified"] = "true";
        attrs[this.cartAttrPrefix + "_dob_full"] = reduced.dob_full;
        attrs[this.cartAttrPrefix + "_id_full"] = reduced.id_full;
        attrs[this.cartAttrPrefix + "_sig"] = reduced.sig;
        attrs[this.cartAttrPrefix + "_added_at"] = reduced.added_at;

        const payload = { attributes: attrs };

        if (this.orderNoteEnabled) {
          const noteLine = this.renderOrderNoteLine(reduced);
          if (noteLine) {
            const existing = await this.safeGetCart();
            const nextNote = this.mergeOrderNote(existing && existing.note ? String(existing.note) : "", noteLine);
            payload.note = nextNote;
          }
        }

        const response = await fetch("/cart/update.js", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("Cart update failed");

        this.setSessionFlag(this._cartSyncSessionKey, "1");
        return true;
      } catch (error) {
        if (required) throw error;
        return false;
      } finally {
        this._cartSyncInFlight = false;
      }
    }

    buildReducedVerificationPayload(obj) {
      const dob = String(obj.dob || "");
      const id = String(obj.id || "");
      const dob_full = dob;
      const id_full = id;
      const added_at = obj.added_at ? String(obj.added_at) : this.formatColombiaTimestamp();
      const sigInput = `${dob}|${id}|${added_at}|${this.cookieDomain || ""}|${this.cookieName || ""}`;
      const sig = this.fnv1a(sigInput);

      return { dob, id, verified: true, dob_full, id_full, sig, added_at };
    }

    renderOrderNoteLine(verifiedObj) {
      const tpl = this.orderNoteTemplate;
      if (!tpl) return "";

      const dobIso = String((verifiedObj && (verifiedObj.dob_full || verifiedObj.dob)) || "");
      const idFull = String((verifiedObj && (verifiedObj.id_full || verifiedObj.id)) || "");
      const dobFull = this.formatDobToDDMMYYYY(dobIso);
      const addedAt = String((verifiedObj && verifiedObj.added_at) || this.formatColombiaTimestamp());
      const sig = String((verifiedObj && verifiedObj.sig) || this.fnv1a(`${dobIso}|${idFull}|${addedAt}|${this.cookieDomain || ""}|${this.cookieName || ""}`));

      return tpl
        .replace(/\[\[\s*dob_full\s*\]\]/g, dobFull)
        .replace(/\[\[\s*id_full\s*\]\]/g, idFull)
        .replace(/\[\[\s*added_at\s*\]\]/g, addedAt)
        .replace(/\[\[\s*sig\s*\]\]/g, sig);
    }

    formatColombiaTimestamp(date) {
      const source = date instanceof Date ? date : new Date();
      const colombia = new Date(source.getTime() - 5 * 60 * 60 * 1000);
      const y = colombia.getUTCFullYear();
      const m = String(colombia.getUTCMonth() + 1).padStart(2, "0");
      const d = String(colombia.getUTCDate()).padStart(2, "0");
      const h = String(colombia.getUTCHours()).padStart(2, "0");
      const min = String(colombia.getUTCMinutes()).padStart(2, "0");
      const s = String(colombia.getUTCSeconds()).padStart(2, "0");
      return `${y}-${m}-${d} ${h}:${min}:${s} GMT-5`;
    }

    mergeOrderNote(existingNote, newLine) {
      const cleanExisting = (existingNote || "").trim();
      const cleanNew = (newLine || "").trim();
      if (!cleanNew) return cleanExisting;
      if (cleanExisting && cleanExisting.indexOf(cleanNew) !== -1) return cleanExisting;
      if (!cleanExisting) return cleanNew;
      return `${cleanExisting}\n${cleanNew}`;
    }

    async safeGetCart() {
      try {
        const response = await fetch("/cart.js", { headers: { Accept: "application/json" } });
        if (!response.ok) return null;
        return await response.json();
      } catch (error) {
        return null;
      }
    }

    fnv1a(str) {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i += 1) {
        h ^= str.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      return ("00000000" + h.toString(16)).slice(-8);
    }

    isShopifyDesignMode() {
      try {
        return Boolean(window && window.Shopify && window.Shopify.designMode);
      } catch (error) {
        return false;
      }
    }

    hasQueryParam(key, expectedValue) {
      try {
        const url = new URL(window.location.href);
        const value = url.searchParams.get(key);
        if (expectedValue == null) return value != null;
        return value === expectedValue;
      } catch (error) {
        return false;
      }
    }

    setSessionFlag(key, value) {
      try {
        sessionStorage.setItem(key, value);
      } catch (error) {}
    }

    getSessionFlag(key) {
      try {
        return sessionStorage.getItem(key);
      } catch (error) {
        return null;
      }
    }

    clearAllErrors() {
      [this.errDob, this.errId, this.errCookie].forEach((errorEl) => {
        if (!errorEl) return;
        errorEl.classList.remove("active");
        errorEl.textContent = "";
      });

      [this.dobInput, this.idInput].forEach((input) => {
        if (input) input.classList.remove("error");
      });
    }

    clearError(input, errorEl) {
      if (input) input.classList.remove("error");
      if (!errorEl) return;
      errorEl.classList.remove("active");
      errorEl.textContent = "";
    }

    showError(errorEl, message) {
      if (!errorEl) return;
      errorEl.textContent = message;
      errorEl.classList.add("active");
    }
  }

  customElements.define(ELEMENT_NAME, AgeVerificationGate);
})();
