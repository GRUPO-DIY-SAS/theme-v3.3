/* ============================================================
   assets/shipping-widget.js
   ============================================================
   Lógica compartida del Widget Interactivo de Envíos DIY Vape Shop.

   - Se autoejecuta una sola vez (guard window.__diyvapeShippingWidget).
   - Parcha window.fetch UNA vez para emitir el evento `cart:updated`
     después de cada mutación de carrito (/cart/add|change|update|clear).
   - Define el custom element <shipping-widget>. Cada instancia se
     auto-inicializa al conectarse al DOM y escucha `cart:updated`.
   - Es seguro reusar la misma URL en varios `<script>` tags: el guard
     evita re-ejecutar la lógica y customElements.define solo se llama
     una vez.

   Eventos públicos:
     · `cart:updated` (detail: cart obj de /cart.js)
     · `diyvape:cart-updated` (alias para compatibilidad interna)
   ============================================================ */
(function () {
  if (window.__diyvapeShippingWidget) return;
  window.__diyvapeShippingWidget = true;

  /* ── Patch fetch UNA vez para emitir cart:updated ── */
  if (!window.__diyvapeFetchPatched) {
    window.__diyvapeFetchPatched = true;
    var originalFetch = window.fetch.bind(window);

    window.fetch = function () {
      var promise = originalFetch.apply(window, arguments);
      try {
        var firstArg = arguments[0];
        var url =
          typeof firstArg === "string"
            ? firstArg
            : firstArg && firstArg.url
            ? firstArg.url
            : "";
        if (/\/cart\/(add|change|update|clear)(\.js)?(\?|$)/.test(url)) {
          promise
            .then(function () {
              setTimeout(refetchAndDispatch, 60);
            })
            .catch(function () {});
        }
      } catch (e) {
        /* swallow */
      }
      return promise;
    };

    function refetchAndDispatch() {
      originalFetch("/cart.js", { credentials: "same-origin" })
        .then(function (r) {
          return r.json();
        })
        .then(function (cart) {
          var detail = { detail: cart };
          document.dispatchEvent(new CustomEvent("cart:updated", detail));
          document.dispatchEvent(
            new CustomEvent("diyvape:cart-updated", detail)
          );
        })
        .catch(function () {});
    }
  }

  /* ── Utilidades ── */
  var DAYS = [
    "domingo",
    "lunes",
    "martes",
    "miércoles",
    "jueves",
    "viernes",
    "sábado",
  ];

  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }
  function colNow() {
    return new Date(
      new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })
    );
  }
  function fmtMoney(n) {
    var v = Math.max(0, Math.round(n));
    return "$" + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }

  /* ── Custom element ── */
  if (!customElements.get("shipping-widget")) {
    customElements.define(
      "shipping-widget",
      class ShippingWidget extends HTMLElement {
        constructor() {
          super();
          this._tickIv = null;
          this._sepIv = null;
          this._cartHandler = null;
        }

        connectedCallback() {
          if (this._wired) return;
          this._wired = true;

          this.cutoff = parseInt(this.dataset.cutoffHour, 10) || 13;
          this.bogotaTh = parseInt(this.dataset.bogotaThreshold, 10) || 0;
          this.nationalTh = parseInt(this.dataset.nationalThreshold, 10) || 0;
          this.cartTotal = parseInt(this.dataset.cartTotal, 10) || 0;

          this.holidays = {};
          (this.dataset.holidays || "").split(",").forEach((h) => {
            var t = h.trim();
            if (t) this.holidays[t] = true;
          });

          this.elH = this.querySelector('[data-unit="hours"]');
          this.elM = this.querySelector('[data-unit="minutes"]');
          this.elS = this.querySelector('[data-unit="seconds"]');
          this.elPill = this.querySelector("[data-status-pill]");
          this.elText = this.querySelector("[data-status-text]");
          this.elDot = this.querySelector(".sw-dot");
          this.barBog = this.querySelector('[data-bar="bogota"]');
          this.barNat = this.querySelector('[data-bar="national"]');
          this.hintBog = this.querySelector('[data-hint="bogota"]');
          this.hintNat = this.querySelector('[data-hint="national"]');
          this.seps = this.querySelectorAll(".sw-separator");

          /* Render inicial síncrono (sin esperar IO) */
          this.tick();
          this.updateBars(this.cartTotal);

          /* Listener de cart:updated (siempre activo, no consume CPU idle) */
          this._cartHandler = (e) => {
            var cart = e && e.detail ? e.detail : null;
            if (cart && typeof cart.total_price === "number") {
              this.updateBars(Math.round(cart.total_price / 100));
            }
          };
          document.addEventListener("cart:updated", this._cartHandler);

          /* Pause-when-hidden: el setInterval(1s) del countdown solo corre
             si el widget está en el viewport. Reduce TBT en PDP largos. */
          if ("IntersectionObserver" in window) {
            this._io = new IntersectionObserver(
              (entries) => {
                entries.forEach((entry) => {
                  if (entry.isIntersecting) {
                    this._startTimers();
                  } else {
                    this._stopTimers();
                  }
                });
              },
              { threshold: 0.01 }
            );
            this._io.observe(this);
          } else {
            this._startTimers();
          }

          /* Page Visibility: pausar también al cambiar de pestaña */
          this._onVisibility = () => {
            if (document.hidden) {
              this._stopTimers();
            } else if (this._isInView()) {
              this._startTimers();
            }
          };
          document.addEventListener("visibilitychange", this._onVisibility);
        }

        disconnectedCallback() {
          this._stopTimers();
          if (this._io) {
            this._io.disconnect();
            this._io = null;
          }
          if (this._cartHandler) {
            document.removeEventListener("cart:updated", this._cartHandler);
          }
          if (this._onVisibility) {
            document.removeEventListener("visibilitychange", this._onVisibility);
          }
          this._wired = false;
        }

        _isInView() {
          var r = this.getBoundingClientRect();
          return (
            r.bottom > 0 &&
            r.top < (window.innerHeight || document.documentElement.clientHeight)
          );
        }

        _startTimers() {
          if (this._tickIv || document.hidden) return;
          /* Tick inmediato al volver al viewport para no quedar "atrasado" */
          this.tick();
          this._tickIv = setInterval(() => this.tick(), 1000);
          this._sepVis = true;
          this._sepIv = setInterval(() => {
            this._sepVis = !this._sepVis;
            this.seps.forEach((s) => {
              s.style.color = this._sepVis ? "" : "transparent";
            });
          }, 500);
        }

        _stopTimers() {
          if (this._tickIv) {
            clearInterval(this._tickIv);
            this._tickIv = null;
          }
          if (this._sepIv) {
            clearInterval(this._sepIv);
            this._sepIv = null;
          }
        }

        isHoliday(date) {
          var y = date.getFullYear();
          var m = date.getMonth() + 1;
          var d = date.getDate();
          var key =
            y +
            "-" +
            (m < 10 ? "0" + m : m) +
            "-" +
            (d < 10 ? "0" + d : d);
          return Boolean(this.holidays[key]);
        }

        isNonWorkDay(date) {
          return date.getDay() === 0 || this.isHoliday(date);
        }

        tick() {
          var now = colNow();
          var isWork = !this.isNonWorkDay(now);
          var before = now.getHours() < this.cutoff;
          var ships = isWork && before;

          var next = new Date(now);
          if (ships) {
            next.setHours(this.cutoff, 0, 0, 0);
          } else {
            next.setDate(next.getDate() + 1);
            var safety = 0;
            while (this.isNonWorkDay(next) && safety < 15) {
              next.setDate(next.getDate() + 1);
              safety++;
            }
            next.setHours(this.cutoff, 0, 0, 0);
          }

          var diff = next - now;
          if (this.elH) this.elH.textContent = pad(Math.floor(diff / 3600000));
          if (this.elM)
            this.elM.textContent = pad(Math.floor((diff % 3600000) / 60000));
          if (this.elS)
            this.elS.textContent = pad(Math.floor((diff % 60000) / 1000));

          var color = ships ? "#2E7D57" : "#D4A843";
          if (this.elPill) {
            this.elPill.style.background = color + "14";
            this.elPill.style.borderColor = color + "30";
          }
          if (this.elDot) this.elDot.style.background = color;
          if (this.elText) {
            this.elText.style.color = color;
            if (ships) {
              if (this.elDot) this.elDot.classList.add("sw-dot--on");
              this.elText.textContent = "¡Pide ahora y se despacha hoy!";
            } else {
              if (this.elDot) this.elDot.classList.remove("sw-dot--on");
              var reason = "";
              if (this.isHoliday(now)) reason = "Hoy es festivo. ";
              this.elText.textContent =
                reason + "Próximo despacho: " + DAYS[next.getDay()];
            }
          }
        }

        updateBars(total) {
          if (total === null || total === undefined || isNaN(total)) return;
          var pB =
            this.bogotaTh > 0
              ? Math.min((total / this.bogotaTh) * 100, 100)
              : 0;
          var pN =
            this.nationalTh > 0
              ? Math.min((total / this.nationalTh) * 100, 100)
              : 0;

          if (this.barBog) this.barBog.style.width = pB + "%";
          if (this.barNat) this.barNat.style.width = pN + "%";

          if (this.hintBog) {
            if (pB >= 100) {
              if (this.barBog) this.barBog.style.background = "#2E7D57";
              this.hintBog.innerHTML =
                '<strong style="color:#2E7D57">✓ ¡Envío gratis desbloqueado!</strong>';
            } else if (total > 0) {
              this.hintBog.innerHTML =
                'Te faltan <strong style="color:#C8102E">' +
                fmtMoney(this.bogotaTh - total) +
                "</strong> para envío gratis";
            } else {
              this.hintBog.textContent =
                "Agrega productos para desbloquear envío gratis";
            }
          }

          if (this.hintNat) {
            if (pN >= 100) {
              if (this.barNat) this.barNat.style.background = "#2E7D57";
              this.hintNat.innerHTML =
                '<strong style="color:#2E7D57">✓ ¡Envío gratis desbloqueado!</strong>';
            } else if (total > 0) {
              this.hintNat.innerHTML =
                'Te faltan <strong style="color:#C8102E">' +
                fmtMoney(this.nationalTh - total) +
                "</strong> para envío gratis";
            } else {
              this.hintNat.textContent =
                "Agrega productos para desbloquear envío gratis";
            }
          }
        }
      }
    );
  }
})();
