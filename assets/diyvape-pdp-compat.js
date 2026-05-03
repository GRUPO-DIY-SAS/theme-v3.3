/**
 * diyvape-pdp-compat.js  — Verificador de compatibilidad v1.2
 * Cargar via <script defer src="{{ 'diyvape-pdp-compat.js' | asset_url }}"> en theme.liquid
 *
 * TRES FUENTES (en orden de prioridad):
 *   S1 — window.diyCompatDevs  ← complementary_products (objetos {t, u} con link)
 *   S2 — window.diyCompatDevs  ← custom.compat_devices  (objetos {t, u:null} sin link)
 *        (S1 y S2 los inyecta snippets/diyvape-pdp-compat.liquid)
 *   S3 — atributo data-devs en el div .compat del body_html (fallback pipe-separated)
 *
 * DEDUPLICACIÓN:
 *   Clave normalizada: minúsculas + solo alfanuméricos (norm()).
 *   Ejemplo: "Oxva - NeXlim Kit" y "Oxva NeXlim Kit" → misma clave "oxvanexlimkit".
 *   S1 entra primero → siempre gana sobre S2/S3 → si un equipo está en
 *   complementary_products aparece como link y nunca como texto plano duplicado.
 *
 * CAMBIOS v1.2 (2026-05-02):
 *   - norm() para dedup robusta: evita duplicados por guiones/espacios/tildes.
 *   - Sin otros cambios funcionales.
 *
 * CAMBIOS v1.3 (2026-05-02):
 *   - norm() también stripea "kit" y "pod" antes de comparar.
 *   - Razón: los títulos de productos Shopify incluyen "Kit" al final
 *     ("Oxva - Xlim Pro 2 Kit") mientras data-devs usa el nombre corto
 *     ("Oxva Xlim Pro 2"). Sin este strip se mostraban como entradas distintas
 *     aunque fueran el mismo equipo.
 *   - Ejemplo: norm("Oxva - Xlim Pro 2 Kit") = norm("Oxva Xlim Pro 2") = "oxvaxlimpro2"
 */
(function () {

  /**
   * Normaliza un nombre para deduplicación:
   *   1. Minúsculas
   *   2. Puntuación → espacio (guiones, paréntesis, etc.)
   *   3. Elimina palabras "kit" y "pod" (sufijos frecuentes en títulos Shopify)
   *   4. Colapsa espacios y los elimina
   *
   * Casos cubiertos:
   *   "Oxva - Xlim Pro 2 Kit"  →  "oxvaxlimpro2"
   *   "Oxva Xlim Pro 2"        →  "oxvaxlimpro2"  → MISMO → dedup ✓
   *
   *   "Oxva Xlim SE"           →  "oxvaxlimse"
   *   "Oxva Xlim SE 2"         →  "oxvaxlimse2"   → DISTINTOS ✓
   */
  function norm(s) {
    return s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')   // puntuación → espacio
      .replace(/\b(kit|pod)\b/g, ' ') // strip "kit" / "pod"
      .replace(/\s+/g, '');            // elimina todos los espacios
  }

  function chkC(inp) {
    var v = inp.value.trim(),
        c = inp.closest('.compat'),
        r = c ? c.querySelector('.compat__res') : null;
    if (!r) return;

    if (v.length < 2) {
      r.innerHTML = '';
      r.style.height = '';
      return;
    }

    // S3: data-devs del body_html (fallback garantizado)
    var s3 = (c.getAttribute('data-devs') || '')
      .split('|')
      .map(function (d) { return { t: d.trim(), u: null }; })
      .filter(function (x) { return x.t; });

    // S1 + S2: inyectados por el snippet liquid (S1 con link, S2 sin link)
    var base = (window.diyCompatDevs && window.diyCompatDevs.length)
      ? window.diyCompatDevs : [];

    // Dedup por clave normalizada — S1 entra primero, siempre gana
    var seen = {}, all = [];
    base.concat(s3).forEach(function (x) {
      var k = norm(x.t);
      if (!seen[k]) { seen[k] = true; all.push(x); }
    });

    if (!all.length) {
      r.innerHTML = '';
      r.style.height = '';
      return;
    }

    var q = v.toLowerCase(), h = '', f = 0;
    all.forEach(function (x) {
      if (x.t.toLowerCase().indexOf(q) > -1) {
        var nameHtml = x.u
          ? '<a href="' + x.u + '" style="color:inherit;text-decoration:underline;'
            + 'text-decoration-color:rgba(0,0,0,0.25);text-underline-offset:3px;cursor:pointer;">'
            + x.t
            + ' <span style="font-size:0.7em;opacity:0.45;vertical-align:middle;">↗</span></a>'
          : '<span>' + x.t + '</span>';
        h += '<div class="compat__item">' + nameHtml
           + '<span class="compat__badge compat__badge--y">Compatible</span></div>';
        f++;
      }
    });

    if (!f) {
      h = '<div class="compat__item">'
        + '<span>No encontrado entre los equipos compatibles</span>'
        + '<span class="compat__badge compat__badge--n">Consultar</span></div>';
    }

    r.style.height = 'auto';
    r.innerHTML = h;
  }

  window.chkC = chkC;

  // Listener delegado — captura inputs en cualquier .compat__in de la página
  document.addEventListener('input', function (e) {
    if (e.target && e.target.classList.contains('compat__in')) {
      chkC(e.target);
    }
  }, true);

})();