(function () {
  const ELEMENT_NAME = "age-verification-gate";
  const CANONICAL_COOKIE_NAME = "age_verified_diyvape";

  /* ==========================================================================
     VENTANA DE CADUCIDAD — cambie este flag según el comportamiento que quiera.

       false (actual) = ventana FIJA desde la verificación original.
                        Con TTL de 24h, quien verificó ayer a las 10:00 vuelve a
                        ver el modal hoy a las 10:00, aunque haya entrado 5 veces
                        en el intermedio.

       true           = ventana RODANTE. Cada visita reinicia el contador; sólo
                        reverifica tras 24h de INACTIVIDAD. Ojo: al mover
                        added_at cambia la firma (sig) y el carrito se
                        re-sincroniza en cada visita.
     ========================================================================== */
  const ROLLING_WINDOW = false;

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
      this.cookieName = this.dataset.cookieName || CANONICAL_COOKIE_NAME;
      this.canonicalCookieName = CANONICAL_COOKIE_NAME;
      this.cookieAliases =
        this.cookieName === this.canonicalCookieName
          ? [this.canonicalCookieName]
          : [this.canonicalCookieName, this.cookieName];
      this.cookieDaysLegacy = parseInt(this.dataset.cookieDays || "365", 10);
      /* Default host-only (""): un domain que no corresponde al host actual
         (preview *.myshopify.com, staging) hace que el navegador DESCARTE la
         cookie en silencio — document.cookie nunca lanza excepción. */
      this.cookieDomain = (this.dataset.cookieDomain || "").trim();
      this.editorModeBehavior = (this.dataset.editorModeBehavior || "only_preview_button").trim();
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
      this.idErrorMessage = this.dataset.idErrorMessage || "El numero de identificacion debe ser numerico y tener entre 6 y 10 digitos.";
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
      /* El trigger del editor vive DESPUÉS de </age-verification-gate>, así que
         en el constructor todavía no existe. Se resuelve en connectedCallback. */
      this.editorTriggerWrap = null;
      this.editorTriggerBtn = null;
      this.modal = this.querySelector("[data-age-modal]");
      this._cartSyncInFlight = false;
      this._cartSyncSessionKey = "av_cart_synced_" + this.canonicalCookieName;
      this._pendingCartSyncKey = "av_cart_sync_pending_" + this.canonicalCookieName;
      this._legacyPendingCartSyncKey =
        this.cookieName === this.canonicalCookieName ? null : "av_cart_sync_pending_" + this.cookieName;
      this._manualPreviewKey = "av_manual_preview_" + this.cookieName;
      this._eventsReady = false;
      this._cartSyncRescueReady = false;
      this._cartSyncPromise = null;
      this._pendingCartSyncMemory = null;
      this._perfEnabled = this.isPerfEnabled();
      this._perfMarks = {};
      this._lastSubmitPerfAt = 0;
      this._lastCookieWriteOk = null;
      this._lastExpiryPurgeAt = null;
    }

    connectedCallback() {
      this.setDobBounds();
      this.resolveEditorTrigger();
      this.installCartSyncRescueEvents();
      this.installPerfObserver();

      this.restoreCookieFromStorageIfNeeded();

      /* getVerifiedObject() ya descarta y purga las verificaciones vencidas,
         así que aquí sólo llegan las vigentes. */
      const verified = this.getVerifiedObject();
      if (verified) {
        this.refreshPersistence(verified);
        document.documentElement.classList.add("age-gate-verified");
        this.hide();
        this.dispatchVerifiedEvent(this.isCartVerified() ? "cart_verified_with_local_data" : "cookie_present");
        this.deferCartSync(verified, { reason: "cookie_present", force: true });
        return;
      }

      /* Importante: quitar la clase. El detector de theme.liquid la añade sin
         mirar caducidad, y la regla
         html.age-gate-verified .ai-age-verify-overlay { display:none !important }
         dejaría el modal invisible aunque show() añada .active. */
      document.documentElement.classList.remove("age-gate-verified");
      this.setupEvents();

      if (this.isShopifyDesignMode()) {
        this.applyEditorModeBehavior();
        return;
      }

      this.show();
    }

    resolveEditorTrigger() {
      this.editorTriggerWrap =
        this.querySelector("[data-editor-trigger]") ||
        document.querySelector(`[data-age-editor-trigger-for="${this.id}"]`);
      this.editorTriggerBtn = this.editorTriggerWrap ? this.editorTriggerWrap.querySelector("button") : null;
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
      /* En el bloque actual [data-dob-input] es un input hidden alimentado por
         la rueda custom, así que min/max no aplican. La validación real vive en
         isRealDate/isOver18. */
      if (!this.dobInput || this.dobInput.type === "hidden") return;
      const now = new Date();
      const max = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
      this.dobInput.max = this.formatDateInputValue(max);
      this.dobInput.min = "1920-01-01";
    }

    async handleSubmit(event) {
      this.perfMark("submit_received");
      event.preventDefault();
      this.clearAllErrors();
      this.setSubmitLoading(true);

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

      if (!ok) {
        this.setSubmitLoading(false);
        return;
      }
      this.perfMark("validation_complete");

      const payload = {
        dob,
        id: String(id),
        verified: true,
        added_at: this.formatColombiaTimestamp(),
      };

      this.persistVerificationFallbacks(payload);

      /* Verificar que SE GUARDÓ, no que esté vigente. El dato se acaba de
         escribir, así que evaluar caducidad aquí es contradictorio: el
         fail-closed de isVerificationExpired purgaría lo recién guardado y
         mostraría el error de cookie sobre una escritura correcta. */
      if (!this.getVerifiedObjectFromCookies() && !this.getVerifiedObjectFromStorage()) {
        this.showError(this.errCookie, this.cookieErrorMessage);
        this.setSubmitLoading(false);
        return;
      }

      if (this.cartSyncEnabled) {
        this.setPendingCartSyncPayload(payload);
      }

      this.resetTransientDrawers({ includeNav: true });
      /* includeNav: true durante 800ms absorbe el "ghost click" de Safari iOS:
         al cerrar el modal rápidamente, el touch del usuario sobre el botón
         "Sí" se completa en el elemento que queda debajo (hamburguesa/search),
         abriendo el menú "sin razón". */
      this.suppressMinicartDrawer(800, { includeNav: true });
      document.documentElement.classList.add("age-gate-verified");
      this.hide();
      this.setSubmitLoading(false);
      this.perfMark("modal_hidden");
      this.logSubmitPerf();

      this.afterNextPaint(() => {
        this.perfMark("age_verified_event");
        this.dispatchVerifiedEvent("just_verified");

        if (!this.cartSyncEnabled) return;
        this.syncVerificationToCartIfNeeded(payload, {
          reason: "just_verified_background",
          force: true,
          retries: 2,
        })
          .catch((error) => {
            if (window.console && console.warn) console.warn("[AgeGate] background cart sync failed", error);
          });
      });
    }

    dispatchVerifiedEvent(reason) {
      const detail = { reason, gateId: this.id };
      window.dispatchEvent(new CustomEvent("diyvape:age-verified", { detail }));
      document.dispatchEvent(new CustomEvent("diyvape:age-verified", { detail }));
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

    /* Lector inmune a cookies duplicadas: itera y devuelve el primer match.
       La versión con split(`; ${name}=`) devolvía null cuando había dos cookies
       del mismo nombre, aunque la cookie existiera. */
    getCookie(name) {
      const parts = document.cookie ? document.cookie.split(";") : [];
      const prefix = name + "=";
      for (let i = 0; i < parts.length; i += 1) {
        const cookie = parts[i].trim();
        if (cookie.indexOf(prefix) === 0) return cookie.slice(prefix.length);
      }
      return null;
    }

    /* Todas las cookies con este nombre, no sólo la primera. Con duplicados
       (host-only + domain heredado), quedarse con la primera hace que un residuo
       viejo tape la cookie recién escrita. */
    getAllCookieValues(name) {
      const prefix = name + "=";
      const parts = document.cookie ? document.cookie.split(";") : [];
      const values = [];
      for (let i = 0; i < parts.length; i += 1) {
        const cookie = parts[i].trim();
        if (cookie.indexOf(prefix) === 0) values.push(cookie.slice(prefix.length));
      }
      return values;
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
      return Boolean(this.getVerifiedObjectFromCookies());
    }

    isSessionMode() {
      return this.getCookieTTL().type === "session";
    }

    verificationStore() {
      try {
        return this.isSessionMode() ? sessionStorage : localStorage;
      } catch (error) {
        return null;
      }
    }

    /* ==========================================================================
       CADUCIDAD REAL

       El problema: el respaldo en localStorage NO tiene expiración, y
       restoreCookieFromStorageIfNeeded() reconstruía la cookie desde ahí en
       cada carga. La cookie vencía, el respaldo la revivía, y el TTL
       configurado no significaba nada en la práctica.

       Ahora el timestamp added_at del payload es la fuente de verdad: si pasó
       más tiempo que el TTL, la verificación se descarta y se purga TODO
       (cookie + localStorage + sessionStorage), de modo que el modal reaparece.
       ========================================================================== */
    parseAddedAt(value) {
      if (!value) return NaN;
      const raw = String(value).trim();
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
      if (!m) return Date.parse(raw);
      /* formatColombiaTimestamp emite "YYYY-MM-DD HH:mm:ss GMT-5" */
      return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}-05:00`);
    }

    isVerificationExpired(obj) {
      if (!obj) return false;
      const ttl = this.getCookieTTL();
      if (ttl.type !== "expires") return false;

      const born = this.parseAddedAt(obj.added_at);

      /* FAIL-CLOSED (compliance): sin timestamp legible no podemos PROBAR que
         la verificación siga vigente, así que se trata como vencida. Un payload
         corrupto o manipulado no debe conceder acceso indefinido. */
      if (!Number.isFinite(born)) return true;

      /* Vence si se cumplió el TTL VIGENTE del selector o el sello absoluto
         guardado al escribir, lo que ocurra primero. Tomar el más estricto hace
         que bajar el selector (365 días → 24 horas) aplique de inmediato a las
         verificaciones ya guardadas, sin esperar a que expire el valor anterior. */
      if (Date.now() - born > ttl.ms) return true;
      if (Number.isFinite(obj.exp) && Date.now() > obj.exp) return true;

      return false;
    }

    purgeVerification() {
      this._lastExpiryPurgeAt = Date.now();
      this.clearVerificationCookies();
      this.cookieAliases.forEach((name) => {
        try { sessionStorage.removeItem(name); } catch (error) {}
      });
      try { sessionStorage.removeItem(this._cartSyncSessionKey); } catch (error) {}
      this.clearPendingCartSyncPayload();
      document.documentElement.classList.remove("age-gate-verified");
    }

    clearVerificationCookies() {
      const host = location.hostname;
      const bare = host.replace(/^www\./, "");
      /* Barrer TODAS las variantes de dominio, no sólo this.cookieDomain. Una
         cookie escrita con domain=.diyvape.co NO se borra con una petición
         host-only; si el merchant vacía el setting de dominio, ese residuo queda
         huérfano, se lee antes que la cookie nueva y bloquea la verificación de
         forma permanente (read-back siempre falso). */
      const domains = ["", host, "." + host, bare, "." + bare];
      if (this.cookieDomain) domains.push(this.cookieDomain);

      this.cookieAliases.forEach((name) => {
        domains.forEach((d) => {
          document.cookie =
            name + "=;path=/;Max-Age=0;expires=Thu, 01 Jan 1970 00:00:00 GMT" + (d ? ";domain=" + d : "");
        });
        try { localStorage.removeItem(name); } catch (error) {}
      });
    }

    getVerifiedObject() {
      let found = null;

      if (this.isSessionMode()) {
        /* Por pestaña: sessionStorage es la única fuente de verdad. Una cookie
           de sesión sobrevive al cierre de pestaña, así que no sirve acá. */
        found = this.getVerifiedObjectFromStorage();
        if (!found) {
          this.clearVerificationCookies();
          return null;
        }
      } else {
        found = this.getVerifiedObjectFromCookies() || this.getVerifiedObjectFromStorage();
      }

      if (found && this.isVerificationExpired(found)) {
        this.purgeVerification();
        return null;
      }

      return found;
    }

    getVerifiedObjectFromCookies() {
      let expiredFallback = null;
      for (let i = 0; i < this.cookieAliases.length; i += 1) {
        const values = this.getAllCookieValues(this.cookieAliases[i]);
        for (let j = 0; j < values.length; j += 1) {
          const parsed = this.parseVerified(values[j]);
          if (!parsed) continue;
          /* Con duplicados gana la primera VIGENTE, no la primera a secas: un
             residuo vencido no debe tapar una verificación válida ni disparar
             la purga de lo recién guardado. */
          if (!this.isVerificationExpired(parsed)) return parsed;
          expiredFallback = expiredFallback || parsed;
        }
      }
      return expiredFallback;
    }

    getVerifiedObjectFromStorage() {
      const store = this.verificationStore();
      if (!store) return null;
      try {
        for (let i = 0; i < this.cookieAliases.length; i += 1) {
          const parsed = this.parseVerified(store.getItem(this.cookieAliases[i]));
          if (parsed) return parsed;
        }
      } catch (error) {}
      return null;
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

    /* TTL efectivo para ESTA escritura. Con ventana fija, la cookie se escribe
       con el tiempo RESTANTE desde added_at, no con el TTL completo — así el
       navegador también la vence solo y no dependemos únicamente del chequeo JS. */
    effectiveTTL(payload) {
      const ttl = this.getCookieTTL();
      if (ttl.type !== "expires" || ROLLING_WINDOW) return ttl;
      const born = this.parseAddedAt(payload && payload.added_at);
      if (!Number.isFinite(born)) return ttl;
      const remaining = ttl.ms - (Date.now() - born);
      return { type: "expires", ms: Math.max(remaining, 1000) };
    }

    /* Escritura robusta:
       1) Max-Age además de expires. `expires` es absoluto y se evalúa contra el
          reloj del dispositivo; un equipo con la hora adelantada recibe una
          fecha ya vencida. Max-Age es relativo y tiene precedencia.
       2) Read-back por comparación EXACTA del valor escrito.
       3) Borra el residuo del dominio rechazado antes de reintentar host-only,
          para no acumular cookies duplicadas del mismo nombre. */
    setCookieStrongFlexible(name, value, ttl, domain) {
      const secure = location && location.protocol === "https:" ? ";Secure" : "";
      const encoded = encodeURIComponent(value);

      const write = (cookieDomain) => {
        const domainAttr = cookieDomain ? `;domain=${cookieDomain}` : "";
        const base = `${name}=${encoded};path=/${domainAttr};SameSite=Lax${secure}`;

        if (ttl && ttl.type === "session") {
          document.cookie = base;
          return;
        }

        const ms = ttl && typeof ttl.ms === "number" && ttl.ms > 0 ? ttl.ms : 365 * 24 * 60 * 60 * 1000;
        const date = new Date(Date.now() + ms);
        document.cookie = `${base};Max-Age=${Math.floor(ms / 1000)};expires=${date.toUTCString()}`;
      };

      write(domain);
      /* Read-back sobre TODAS las cookies homónimas: si un residuo con otro
         dominio aparece primero en document.cookie, comparar sólo contra
         getCookie() daría falso negativo sobre una escritura correcta. */
      if (this.getAllCookieValues(name).indexOf(encoded) !== -1) return true;

      if (domain) {
        document.cookie = `${name}=;path=/;domain=${domain};Max-Age=0;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
      write("");
      return this.getAllCookieValues(name).indexOf(encoded) !== -1;
    }

    persistVerificationFallbacks(payload) {
      if (!payload || !payload.verified || !payload.dob || !payload.id) return false;

      /* Modo por pestaña: nada persistente. sessionStorage muere con la pestaña. */
      if (this.isSessionMode()) {
        const sessionRaw = JSON.stringify(payload);
        this.clearVerificationCookies();
        this.cookieAliases.forEach((name) => {
          try { sessionStorage.setItem(name, sessionRaw); } catch (error) {}
        });
        this._lastCookieWriteOk = true;
        return true;
      }

      const ttl = this.effectiveTTL(payload);

      /* Sello absoluto de expiración dentro del payload. Sirve para dos cosas:
         (1) el detector de theme.liquid puede descartar una verificación vencida
             antes de que cargue este asset (que va con defer), evitando que el
             sitio se vea unos ms sin el modal;
         (2) queda evidencia del vencimiento en el propio dato, no sólo en el
             atributo de la cookie. */
      const stamped =
        ttl.type === "expires" ? Object.assign({}, payload, { exp: Date.now() + ttl.ms }) : payload;
      const raw = JSON.stringify(stamped);

      /* Borrar el estado anterior ANTES de escribir, en todas las variantes de
         dominio. Sin esto, un residuo vencido (verificación de hace meses,
         escrita con otro domain y sin sello `exp`) se lee antes que el dato
         nuevo: el read-back falla y purgeVerification() borra cookie Y
         localStorage, destruyendo lo recién guardado. Efecto visible: una
         verificación vencida impedía volver a verificarse. */
      const clearHost = location.hostname;
      const clearBare = clearHost.replace(/^www\./, "");
      const clearDomains = ["", clearHost, "." + clearHost, clearBare, "." + clearBare];
      if (this.cookieDomain) clearDomains.push(this.cookieDomain);
      this.cookieAliases.forEach((name) => {
        clearDomains.forEach((d) => {
          document.cookie =
            name + "=;path=/;Max-Age=0;expires=Thu, 01 Jan 1970 00:00:00 GMT" + (d ? ";domain=" + d : "");
        });
      });

      let cookieOk = true;

      this.cookieAliases.forEach((name) => {
        const written = this.setCookieStrongFlexible(name, raw, ttl, this.cookieDomain);
        if (!written) cookieOk = false;
        try {
          localStorage.setItem(name, raw);
        } catch (error) {}
      });

      this._lastCookieWriteOk = cookieOk;

      if (!cookieOk && window.console && console.warn) {
        console.warn("[AgeGate] cookie NO persistida — operando sólo con localStorage", {
          domainSetting: this.cookieDomain,
          host: location.hostname,
          persistence: this.cookiePersistence,
          ttl,
        });
      }

      return cookieOk;
    }

    /* Refresco en cada carga verificada. Con ventana fija sólo renueva el
       soporte (Safari/ITP capa las cookies a 7 días) sin mover added_at, así que
       la caducidad lógica se respeta. Con ROLLING_WINDOW = true, reinicia el
       contador en cada visita. */
    refreshPersistence(verifiedObj) {
      if (!verifiedObj) return;
      const payload = ROLLING_WINDOW
        ? Object.assign({}, verifiedObj, { added_at: this.formatColombiaTimestamp() })
        : verifiedObj;
      this.persistVerificationFallbacks(payload);
    }

    restoreCookieFromStorageIfNeeded() {
      if (this.isSessionMode()) return;
      if (this.isVerifiedCookieValid()) return;

      const stored = this.getVerifiedObjectFromStorage();
      if (!stored) return;

      if (this.isVerificationExpired(stored)) {
        this.purgeVerification();
        return;
      }

      this.persistVerificationFallbacks(stored);
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

      const reduced = this.buildReducedVerificationPayload(verifiedObj);
      const force = Boolean(opts && opts.force);
      if (!force && this.getSessionFlag(this._cartSyncSessionKey) === reduced.sig && !this.getPendingCartSyncPayload()) return true;

      if (this._cartSyncPromise) {
        const result = await this._cartSyncPromise;
        if (required && !result) throw new Error("Cart sync already failed");
        return result;
      }

      this._cartSyncInFlight = true;
      this._cartSyncPromise = this.performCartSync(reduced, opts || {});

      try {
        return await this._cartSyncPromise;
      } catch (error) {
        if (required) throw error;
        return false;
      } finally {
        this._cartSyncInFlight = false;
        this._cartSyncPromise = null;
      }
    }

    async performCartSync(reduced, opts) {
      this.perfMark("cart_sync_start");
      this.suppressMinicartDrawer(400, { includeNav: false });
      this.setPendingCartSyncPayload(reduced);

      const attempts = Math.max(1, (parseInt(opts.retries || "0", 10) || 0) + 1);
      let lastError = null;

      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const cart = await this.postVerificationToCart(reduced);
          if (!this.isCartSyncConfirmed(cart, reduced)) {
            throw new Error("Cart sync response missing age attributes");
          }

          this.setSessionFlag(this._cartSyncSessionKey, reduced.sig);
          this.clearPendingCartSyncPayload();
          this.perfMark("cart_sync_success");
          this.logSubmitPerf();
          return true;
        } catch (error) {
          lastError = error;
          if (attempt < attempts) await this.delay(180 * attempt);
        }
      }

      this.perfMark("cart_sync_failed");
      this.logSubmitPerf();
      if (opts && opts.required) throw lastError || new Error("Cart sync failed");
      return false;
    }

    async postVerificationToCart(reduced) {
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

      const controller = "AbortController" in window ? new AbortController() : null;
      const timeoutId = controller ? window.setTimeout(() => controller.abort(), 8000) : null;
      let response;

      try {
        response = await fetch("/cart/update.js", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          keepalive: true,
          signal: controller ? controller.signal : undefined,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
        });
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }

      if (!response.ok) throw new Error("Cart update failed");
      return response.json();
    }

    isCartSyncConfirmed(cart, reduced) {
      const attrs = cart && cart.attributes ? cart.attributes : {};
      return (
        String(attrs[this.cartAttrPrefix + "_verified"] || "") === "true" &&
        String(attrs[this.cartAttrPrefix + "_dob_full"] || "") === String(reduced.dob_full || "") &&
        String(attrs[this.cartAttrPrefix + "_id_full"] || "") === String(reduced.id_full || "") &&
        String(attrs[this.cartAttrPrefix + "_sig"] || "") === String(reduced.sig || "")
      );
    }

    clearMinicartSuppression() {
      window.diyvapeSuppressMinicartUntil = 0;
      window.diyvapeSuppressSearchUntil = 0;
      window.diyvapeSuppressNavUntil = 0;
      document.documentElement.classList.remove("diyvape-suppress-minicart");
      document.documentElement.classList.remove("diyvape-suppress-search");
      document.documentElement.classList.remove("diyvape-suppress-nav");
      this.resetTransientDrawers({ includeNav: true });
      if (window.diyvapeSuppressMinicartTimer) {
        window.clearTimeout(window.diyvapeSuppressMinicartTimer);
        window.diyvapeSuppressMinicartTimer = null;
      }
    }

    suppressMinicartDrawer(duration = 4000, options = {}) {
      const includeNav = options.includeNav !== false;
      const until = Date.now() + duration;
      window.diyvapeSuppressMinicartUntil = Math.max(window.diyvapeSuppressMinicartUntil || 0, until);
      window.diyvapeSuppressSearchUntil = Math.max(window.diyvapeSuppressSearchUntil || 0, until);
      document.documentElement.classList.add("diyvape-suppress-minicart");
      document.documentElement.classList.add("diyvape-suppress-search");
      if (includeNav) {
        window.diyvapeSuppressNavUntil = Math.max(window.diyvapeSuppressNavUntil || 0, until);
        document.documentElement.classList.add("diyvape-suppress-nav");
      }
      this.resetTransientDrawers({ includeNav });

      if (window.diyvapeSuppressMinicartTimer) {
        window.clearTimeout(window.diyvapeSuppressMinicartTimer);
      }

      window.diyvapeSuppressMinicartTimer = window.setTimeout(() => {
        if ((window.diyvapeSuppressMinicartUntil || 0) <= Date.now()) {
          document.documentElement.classList.remove("diyvape-suppress-minicart");
        }
        if ((window.diyvapeSuppressSearchUntil || 0) <= Date.now()) {
          document.documentElement.classList.remove("diyvape-suppress-search");
        }
        if ((window.diyvapeSuppressNavUntil || 0) <= Date.now()) {
          document.documentElement.classList.remove("diyvape-suppress-nav");
        }
        this.resetTransientDrawers({ includeNav });
      }, duration + 80);
    }

    resetTransientDrawers(options = {}) {
      const includeNav = options.includeNav !== false;
      const rootEl = document.documentElement;
      rootEl.classList.remove("open-search", "open-minicart");
      if (includeNav) {
        rootEl.classList.remove("nav-open", "nav-verticalmenu");
        rootEl.style.removeProperty("padding-right");
      }
      if (!rootEl.classList.contains("open-sidebar") && (includeNav || !rootEl.classList.contains("nav-open"))) {
        rootEl.classList.remove("open-drawer");
      }

      document.querySelectorAll(".top-search-toggle.open").forEach((el) => {
        el.classList.remove("open");
      });

      if (includeNav) {
        document.querySelectorAll(".nav-toggle.open").forEach((el) => {
          el.classList.remove("open");
        });
        document.querySelectorAll(".navigation.mobile .is-open, .navigation.mobile .visible").forEach((el) => {
          el.classList.remove("is-open", "visible");
        });
      }
    }

    installCartSyncRescueEvents() {
      if (this._cartSyncRescueReady) return;
      this._cartSyncRescueReady = true;
      this.installCommercialActionGuard();
      this.updateCartSyncPendingState();

      window.diyvapeEnsureAgeCartSync = (opts = {}) => {
        const pending = this.getPendingCartSyncPayload();
        const verified = pending || this.getVerifiedObject();
        if (!verified) return Promise.resolve(false);
        return this.syncVerificationToCartIfNeeded(verified, {
          reason: opts.reason || "manual_retry",
          force: Boolean(opts.force || pending),
          required: Boolean(opts.required),
          retries: opts.retries == null ? 1 : opts.retries,
        });
      };
      window.diyvapeGuardAgeCommercialAction = (opts = {}) => this.ensureCommercialActionReady(opts);
      window.diyvapeProceedToCheckout = (url = "/checkout", opts = {}) => {
        const targetUrl = url || "/checkout";
        const anchor = opts.anchor || document.querySelector(".btn-checkout, button[name='checkout'], .shopify-payment-button__button");
        return this.ensureCommercialActionReady({
          anchor,
          force: Boolean(opts.force),
          reason: opts.reason || "programmatic_checkout",
        }).then((ok) => {
          if (ok) window.location.href = targetUrl;
          return ok;
        });
      };

      const retryPending = () => {
        this.retryPendingCartSync("pending_retry").catch(() => {});
      };

      window.addEventListener("pageshow", retryPending);
      document.addEventListener("cart:updated", retryPending);
      document.addEventListener("diyvape:cart-updated", retryPending);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) retryPending();
      });
    }

    installCommercialActionGuard() {
      if (window.diyvapeAgeCartSyncGuardReady) return;
      window.diyvapeAgeCartSyncGuardReady = true;

      document.addEventListener(
        "submit",
        (event) => {
          const form = event.target;
          if (!form || !form.matches || this.isInsideAgeGate(form)) return;
          const submitter = this.getSubmitter(event, form);
          const shouldGuard = this.isAddToCartForm(form) || this.isCheckoutSubmit(form, submitter);
          if (!shouldGuard) return;

          this.guardCommercialAction(event, submitter || form, () => {
            if (typeof form.requestSubmit === "function") {
              if (submitter && submitter.form === form && !submitter.disabled) form.requestSubmit(submitter);
              else form.requestSubmit();
              return;
            }
            form.submit();
          });
        },
        true
      );

      document.addEventListener(
        "click",
        (event) => {
          const control = this.closestFromEvent(
            event,
            [
              'a[href*="/checkout"]',
              'button[name="checkout"]',
              '.btn-checkout',
              '.shopify-payment-button button',
              '.shopify-payment-button__button',
              '.additional-checkout-buttons button',
              '.cart__dynamic-checkout-buttons button',
              '[data-testid="Checkout-button"]',
              '.product-group-buy-now',
              'shopify-accelerated-checkout',
              'shopify-accelerated-checkout-cart',
            ].join(",")
          );
          if (!control || this.isInsideAgeGate(control)) return;

          this.guardCommercialAction(event, control, () => {
            if (typeof control.click === "function") control.click();
          });
        },
        true
      );
    }

    guardCommercialAction(event, anchor, replay) {
      const pending = this.getPendingCartSyncPayload();
      if (!this.cartSyncEnabled || !pending) return false;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

      if (this._commercialActionPending) return true;
      this._commercialActionPending = true;
      this.updateCartSyncPendingState();

      this.ensureCommercialActionReady({
        anchor,
        reason: "commercial_guard",
        force: true,
      })
        .then((ok) => {
          this._commercialActionPending = false;
          this.updateCartSyncPendingState();
          if (ok) window.setTimeout(replay, 0);
        })
        .catch(() => {
          this._commercialActionPending = false;
          this.updateCartSyncPendingState();
        });

      return true;
    }

    ensureCommercialActionReady(opts = {}) {
      if (!this.cartSyncEnabled) return Promise.resolve(true);

      const pending = this.getPendingCartSyncPayload();
      const verified = pending || this.getVerifiedObject();
      if (!verified) {
        this.reopenForMissingVerificationData();
        return Promise.resolve(false);
      }

      return this.syncVerificationToCartIfNeeded(verified, {
        reason: opts.reason || "commercial_guard",
        force: Boolean(opts.force || pending),
        required: true,
        retries: opts.retries == null ? 2 : opts.retries,
      })
        .then(Boolean)
        .catch((error) => {
          this.reportCartSyncIssue(this.cartErrorMessage, opts.anchor || document.body, error);
          return false;
        });
    }

    reopenForMissingVerificationData() {
      document.documentElement.classList.remove("age-gate-verified");
      if (this.isShopifyDesignMode()) return;

      this.setupEvents();
      this.clearAllErrors();
      this.show();
      window.setTimeout(() => {
        if (this.initialView && this.formWrap) this.showForm();
      }, 80);
      window.setTimeout(() => {
        if (this.dobInput && typeof this.dobInput.focus === "function") {
          this.dobInput.focus({ preventScroll: true });
        }
      }, 240);
    }

    isAddToCartForm(form) {
      const action = form && form.getAttribute ? form.getAttribute("action") || "" : "";
      return Boolean(
        action.indexOf("/cart/add") !== -1 ||
          form.matches('form[data-type="add-to-cart-form"]') ||
          form.closest("product-form")
      );
    }

    isCheckoutSubmit(form, submitter) {
      const action = form && form.getAttribute ? form.getAttribute("action") || "" : "";
      return Boolean(
        action.indexOf("/checkout") !== -1 ||
          (submitter && submitter.getAttribute && submitter.getAttribute("name") === "checkout")
      );
    }

    getSubmitter(event, form) {
      if (event && event.submitter) return event.submitter;
      const active = document.activeElement;
      return active && form && form.contains(active) ? active : null;
    }

    closestFromEvent(event, selector) {
      let target = event && event.target;
      if (target && target.nodeType !== 1) target = target.parentElement;
      return target && target.closest ? target.closest(selector) : null;
    }

    isInsideAgeGate(element) {
      return Boolean(element && element.closest && element.closest(ELEMENT_NAME));
    }

    updateCartSyncPendingState() {
      const pending = Boolean(this.cartSyncEnabled && this.getPendingCartSyncPayload());
      document.documentElement.classList.toggle("diyvape-age-cart-sync-pending", pending);
      document
        .querySelectorAll(
          [
            ".btn-checkout-dynamic",
            ".shopify-payment-button",
            ".additional-checkout-buttons",
            ".cart__dynamic-checkout-buttons",
            "shopify-accelerated-checkout",
            "shopify-accelerated-checkout-cart",
          ].join(",")
        )
        .forEach((wrapper) => {
          wrapper.setAttribute("aria-busy", pending ? "true" : "false");
        });
    }

    reportCartSyncIssue(message, anchor, error) {
      if (error && window.console && console.warn) console.warn("[AgeGate] cart sync failed", error);
      if (this.errCookie && this.classList.contains("active")) this.showError(this.errCookie, message);
      if (typeof window.showToast === "function") {
        window.showToast(message, 4000, "modal-error");
        return;
      }

      let alert = document.getElementById("diyvape-age-cart-sync-alert");
      if (!alert) {
        alert = document.createElement("div");
        alert.id = "diyvape-age-cart-sync-alert";
        alert.className = "diyvape-age-cart-sync-alert";
        alert.setAttribute("role", "alert");
      }
      alert.textContent = message;

      const parent = anchor && anchor.parentNode ? anchor.parentNode : document.body;
      if (alert.parentNode !== parent) parent.appendChild(alert);
    }

    async retryPendingCartSync(reason) {
      if (!this.cartSyncEnabled || this._cartSyncInFlight) return false;
      const pending = this.getPendingCartSyncPayload();
      if (!pending) return false;
      return this.syncVerificationToCartIfNeeded(pending, {
        reason: reason || "pending_retry",
        force: true,
        retries: 1,
      });
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

    setPendingCartSyncPayload(payload) {
      if (!payload || !payload.dob || !payload.id) return;
      this._pendingCartSyncMemory = payload;
      try {
        localStorage.setItem(this._pendingCartSyncKey, JSON.stringify(payload));
        if (this._legacyPendingCartSyncKey) {
          localStorage.setItem(this._legacyPendingCartSyncKey, JSON.stringify(payload));
        }
      } catch (error) {}
      this.updateCartSyncPendingState();
    }

    getPendingCartSyncPayload() {
      if (this._pendingCartSyncMemory) return this._pendingCartSyncMemory;
      try {
        const pending = this.parseVerified(localStorage.getItem(this._pendingCartSyncKey));
        if (pending) return pending;
        if (this._legacyPendingCartSyncKey) {
          const legacy = this.parseVerified(localStorage.getItem(this._legacyPendingCartSyncKey));
          if (legacy) {
            localStorage.setItem(this._pendingCartSyncKey, JSON.stringify(legacy));
            return legacy;
          }
        }
      } catch (error) {
        return null;
      }
      return null;
    }

    clearPendingCartSyncPayload() {
      this._pendingCartSyncMemory = null;
      try {
        localStorage.removeItem(this._pendingCartSyncKey);
        if (this._legacyPendingCartSyncKey) localStorage.removeItem(this._legacyPendingCartSyncKey);
      } catch (error) {}
      this.updateCartSyncPendingState();
    }

    setSubmitLoading(isLoading) {
      if (!this.submitBtn) return;
      this.submitBtn.disabled = Boolean(isLoading);
      this.submitBtn.classList.toggle("loading", Boolean(isLoading));
      this.submitBtn.setAttribute("aria-busy", isLoading ? "true" : "false");
    }

    delay(ms) {
      return new Promise((resolve) => window.setTimeout(resolve, ms));
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

    afterNextPaint(callback) {
      if ("requestAnimationFrame" in window) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(callback));
        return;
      }
      window.setTimeout(callback, 0);
    }

    isPerfEnabled() {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.get("diyvape_perf") === "1") return true;
      } catch (error) {}
      try {
        return localStorage.getItem("diyvape_perf") === "1";
      } catch (error) {
        return false;
      }
    }

    perfMark(name) {
      if (!this._perfEnabled || !window.performance || typeof performance.now !== "function") return;
      const now = performance.now();
      this._perfMarks[name] = now;
      if (name === "submit_received") this._lastSubmitPerfAt = now;
      if (window.console && console.info) console.info("[AgeGate Perf]", name, Math.round(now));
    }

    logSubmitPerf() {
      if (!this._perfEnabled || !this._perfMarks.submit_received || !window.console || !console.info) return;
      const start = this._perfMarks.submit_received;
      const report = {};
      [
        "validation_complete",
        "modal_hidden",
        "age_verified_event",
        "cart_sync_start",
        "cart_sync_success",
        "cart_sync_failed",
      ].forEach((name) => {
        if (typeof this._perfMarks[name] === "number") {
          report[name] = Math.round(this._perfMarks[name] - start);
        }
      });
      console.info("[AgeGate INP]", report);
    }

    installPerfObserver() {
      if (!this._perfEnabled || window.diyvapeAgePerfObserverReady || !("PerformanceObserver" in window)) return;
      window.diyvapeAgePerfObserverReady = true;

      const nearSubmit = (entry) => {
        return this._lastSubmitPerfAt && entry.startTime >= this._lastSubmitPerfAt - 250 && entry.startTime <= this._lastSubmitPerfAt + 5000;
      };

      try {
        if (PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.indexOf("longtask") !== -1) {
          new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (nearSubmit(entry) && window.console && console.info) {
                console.info("[AgeGate LongTask]", {
                  start: Math.round(entry.startTime),
                  duration: Math.round(entry.duration),
                });
              }
            });
          }).observe({ type: "longtask", buffered: true });
        }
      } catch (error) {}

      try {
        if (PerformanceObserver.supportedEntryTypes && PerformanceObserver.supportedEntryTypes.indexOf("event") !== -1) {
          new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
              if (nearSubmit(entry) && window.console && console.info) {
                console.info("[AgeGate EventTiming]", {
                  name: entry.name,
                  duration: Math.round(entry.duration),
                  processingStart: Math.round(entry.processingStart || 0),
                });
              }
            });
          }).observe({ type: "event", buffered: true, durationThreshold: 16 });
        }
      } catch (error) {}
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

  /* ==========================================================================
     Helpers de consola.

       DiyvapeAgeGate.diagnose()   → estado completo, incluyendo cuánto falta
                                     para que caduque la verificación actual.
       DiyvapeAgeGate.expireNow()  → simula el vencimiento SIN esperar el TTL:
                                     mueve added_at hacia atrás y recarga.
                                     El modal debe reaparecer.
       DiyvapeAgeGate.reset()      → borra todo y recarga (verificación limpia).
     ========================================================================== */
  window.DiyvapeAgeGate = window.DiyvapeAgeGate || {};

  window.DiyvapeAgeGate.diagnose = function () {
    const gate = document.querySelector(ELEMENT_NAME);
    const names = gate && gate.cookieAliases ? gate.cookieAliases : [CANONICAL_COOKIE_NAME];
    const ttl = gate ? gate.getCookieTTL() : null;

    const report = {
      host: location.hostname,
      modo: gate ? gate.cookiePersistence : null,
      ventana: ROLLING_WINDOW ? "rodante (reinicia en cada visita)" : "fija (desde la verificación original)",
      ttlHoras: ttl && ttl.type === "expires" ? ttl.ms / 3600000 : null,
      tipoTTL: ttl ? ttl.type : null,
      dominioSetting: gate ? gate.cookieDomain || "(vacío = host-only)" : null,
      claseVerificado: document.documentElement.classList.contains("age-gate-verified"),
      modalActivo: !!document.querySelector(ELEMENT_NAME + ".active"),
      ultimaEscrituraOK: gate ? gate._lastCookieWriteOk : null,
      purgaPorVencimiento: gate && gate._lastExpiryPurgeAt ? new Date(gate._lastExpiryPurgeAt).toLocaleString("es-CO") : null,
      cookiesCrudas: (document.cookie || "")
        .split(";")
        .map((c) => c.trim())
        .filter((c) => c.indexOf("age_verified") !== -1),
      cookies: {},
      localStorage: {},
      sessionStorage: {},
    };

    names.forEach((name) => {
      report.cookies[name] = gate ? gate.getCookie(name) : null;
      try { report.localStorage[name] = localStorage.getItem(name); } catch (e) { report.localStorage[name] = "<bloqueado>"; }
      try { report.sessionStorage[name] = sessionStorage.getItem(name); } catch (e) { report.sessionStorage[name] = "<bloqueado>"; }
    });

    if (gate) {
      const obj = gate.getVerifiedObjectFromCookies() || gate.getVerifiedObjectFromStorage();
      if (obj) {
        const born = gate.parseAddedAt(obj.added_at);
        report.verificadaEl = Number.isFinite(born) ? new Date(born).toLocaleString("es-CO") : "(added_at ilegible)";
        if (Number.isFinite(born) && ttl && ttl.type === "expires") {
          const restanMs = ttl.ms - (Date.now() - born);
          report.caducaEl = new Date(born + ttl.ms).toLocaleString("es-CO");
          report.restanHoras = +(restanMs / 3600000).toFixed(2);
          report.selloExp = Number.isFinite(obj.exp) ? new Date(obj.exp).toLocaleString("es-CO") : "(sin sello)";
          report.vencida = gate.isVerificationExpired(obj);
        }
      } else {
        report.verificadaEl = "(sin verificación almacenada)";
      }
    }

    if (report.cookiesCrudas.length > 1) {
      report.AVISO = "Más de una cookie age_verified — duplicados. Corre DiyvapeAgeGate.reset().";
    }

    if (window.console && console.log) console.log("[AgeGate diagnose]", report);
    return report;
  };

  window.DiyvapeAgeGate.expireNow = function () {
    const gate = document.querySelector(ELEMENT_NAME);
    if (!gate) return "No hay age-verification-gate en el DOM";
    const ttl = gate.getCookieTTL();
    if (ttl.type !== "expires") return "El modo actual no usa expiración por tiempo";

    const obj = gate.getVerifiedObjectFromCookies() || gate.getVerifiedObjectFromStorage();
    if (!obj) return "No hay verificación almacenada — verifica edad primero";

    /* added_at al doble del TTL hacia atrás → garantizado vencido */
    const past = new Date(Date.now() - ttl.ms * 2);
    obj.added_at = gate.formatColombiaTimestamp(past);
    const raw = JSON.stringify(obj);

    gate.cookieAliases.forEach((name) => {
      document.cookie = name + "=" + encodeURIComponent(raw) + ";path=/";
      try { localStorage.setItem(name, raw); } catch (e) {}
      try { sessionStorage.setItem(name, raw); } catch (e) {}
    });

    console.log("[AgeGate] added_at movido a", obj.added_at, "— recargando…");
    setTimeout(() => location.reload(), 400);
    return "Vencimiento simulado. Al recargar debe aparecer el modal.";
  };

  window.DiyvapeAgeGate.reset = function () {
    const gate = document.querySelector(ELEMENT_NAME);
    const names = gate && gate.cookieAliases ? gate.cookieAliases : [CANONICAL_COOKIE_NAME];
    const host = location.hostname;
    const bare = host.replace(/^www\./, "");
    const domains = ["", host, "." + host, bare, "." + bare];
    if (gate && gate.cookieDomain) domains.push(gate.cookieDomain);

    names.forEach((name) => {
      domains.forEach((d) => {
        document.cookie = name + "=;path=/;Max-Age=0" + (d ? ";domain=" + d : "");
      });
      try { localStorage.removeItem(name); } catch (e) {}
      try { sessionStorage.removeItem(name); } catch (e) {}
    });
    if (gate) {
      try { localStorage.removeItem(gate._pendingCartSyncKey); } catch (e) {}
      try { sessionStorage.removeItem(gate._cartSyncSessionKey); } catch (e) {}
    }
    document.documentElement.classList.remove("age-gate-verified");
    setTimeout(() => location.reload(), 300);
    return "Verificación borrada. Recargando…";
  };
})();