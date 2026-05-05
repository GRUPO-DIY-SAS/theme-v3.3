/* ═══════════════════════════════════════════════════════
   DIYVAPE.CO — Color Swatch → Variant Selector Bridge
   Version 1.0 · 2026-05-04

   PURPOSE:
   Connects clickable .cs__dot color swatches in the body_html
   to the theme's variant selector, triggering image and
   variant change as if the user had clicked the official
   variant input directly.

   USAGE IN BODY_HTML:
   <div class="cs__dot" data-color="Black Carbon"
        onclick="pCS(this)" style="background:#1a1a1a"></div>

   INSTALL:
   Append this code to /assets/diyvape-pdp-interactions.js
   OR include as a separate <script> tag in theme.liquid
   AFTER the variant selector renders.

   COMPATIBILITY:
   - Dawn / Sense / Refresh / Studio (radio inputs)
   - Legacy themes with select dropdowns
   - Custom themes with [data-option-value] buttons
   - Themes that hide radios behind label[for]
   ═══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  function escSel(s) {
    // Polyfill for CSS.escape on older themes
    if (window.CSS && typeof CSS.escape === 'function') return CSS.escape(s);
    return String(s).replace(/[^a-zA-Z0-9_-]/g, function (c) {
      return '\\' + c;
    });
  }

  function findOptionName(haystack) {
    // Some themes use Spanish option names ("Color", "Acabado")
    return ['Color', 'Acabado', 'Colour', 'colour', 'color'];
  }

  function syncVariantSelector(colorValue) {
    if (!colorValue) return false;
    var escaped = escSel(colorValue);
    var optionNames = findOptionName();
    var i, j, sel, query, el;

    // Strategy 1: Radio input — most common in Dawn-based themes
    for (i = 0; i < optionNames.length; i++) {
      var n = optionNames[i];
      query =
        'input[type="radio"][name="' + n + '"][value="' + escaped + '"], ' +
        'input[type="radio"][name="options[' + n + ']"][value="' + escaped + '"]';
      el = document.querySelector(query);
      if (el && !el.disabled) {
        if (!el.checked) {
          el.click(); // Triggers theme's full variant change pipeline
        }
        return true;
      }
    }

    // Strategy 2: Hidden radio behind a label[for]
    for (i = 0; i < optionNames.length; i++) {
      var radios = document.querySelectorAll(
        'input[type="radio"][name*="' + optionNames[i] + '"]'
      );
      for (j = 0; j < radios.length; j++) {
        if (radios[j].value === colorValue && !radios[j].disabled) {
          var labelFor = document.querySelector(
            'label[for="' + escSel(radios[j].id) + '"]'
          );
          if (labelFor) {
            labelFor.click();
          } else {
            radios[j].click();
          }
          return true;
        }
      }
    }

    // Strategy 3: Native select dropdown
    sel = document.querySelector(
      'select[name="options[Color]"], select[name="options[color]"], ' +
      'select[data-option-name="Color"], select[name*="Color" i]'
    );
    if (sel) {
      // Find option matching colorValue (case-sensitive first, then fallback)
      var match = null;
      for (i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === colorValue || sel.options[i].text === colorValue) {
          match = sel.options[i].value;
          break;
        }
      }
      if (match !== null) {
        sel.value = match;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
    }

    // Strategy 4: Custom button swatches (e.g. theme uses [data-option-value])
    var btns = document.querySelectorAll('[data-option-value], [data-value]');
    for (i = 0; i < btns.length; i++) {
      var v = btns[i].getAttribute('data-option-value') || btns[i].getAttribute('data-value');
      if (v === colorValue && !btns[i].classList.contains('disabled')) {
        btns[i].click();
        return true;
      }
    }

    // Strategy 5: variant_id form input — last resort
    // This requires window.productVariants or similar global to map color → id
    if (window.productVariants && Array.isArray(window.productVariants)) {
      for (i = 0; i < window.productVariants.length; i++) {
        var pv = window.productVariants[i];
        if (pv.option1 === colorValue || pv.title === colorValue) {
          var idInput = document.querySelector('input[name="id"]');
          if (idInput) {
            idInput.value = pv.id;
            idInput.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      }
    }

    return false;
  }

  // Helper: update visible label #csName with the selected color
  function updateColorLabel(color) {
    var label = document.getElementById('csName');
    if (label && color) {
      label.textContent = color;
    }
  }

  // Public function — referenced by onclick="pCS(this)" in body_html
  window.pCS = function (el) {
    if (!el || !el.dataset) return;

    // 1. Visual state — mark the clicked dot as active, others off
    var allDots = document.querySelectorAll('.cs__dot');
    for (var i = 0; i < allDots.length; i++) {
      allDots[i].classList.remove('on');
    }
    el.classList.add('on');

    // 2. Update visible label
    updateColorLabel(el.dataset.color);

    // 3. Sync with variant selector
    var color = el.dataset.color;
    var ok = syncVariantSelector(color);

    if (!ok && window.console && console.warn) {
      console.warn(
        '[pCS] No variant selector matched for color "' + color +
        '". Verify your theme exposes <input type="radio" name="Color"> ' +
        'or <select name="options[Color]">.'
      );
    }
  };

  // Bonus: sync the swatches on page load if a variant is preselected
  document.addEventListener('DOMContentLoaded', function () {
    var radios = document.querySelectorAll('input[type="radio"][name*="Color"]:checked');
    if (radios.length > 0) {
      var preselected = radios[0].value;
      var dot = document.querySelector('.cs__dot[data-color="' + escSel(preselected) + '"]');
      if (dot) {
        document.querySelectorAll('.cs__dot').forEach(function (d) { d.classList.remove('on'); });
        dot.classList.add('on');
        updateColorLabel(preselected);
      }
    } else {
      // Default: activate the first dot
      var first = document.querySelector('.cs__dot');
      if (first) {
        first.classList.add('on');
        updateColorLabel(first.dataset.color);
      }
    }
  });

  // Bonus: keep swatches in sync if user changes variant via the official selector
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.name) return;
    var nameMatch = /Color|color/.test(t.name);
    if (!nameMatch) return;
    var newColor = t.value;
    var dot = document.querySelector('.cs__dot[data-color="' + escSel(newColor) + '"]');
    if (dot) {
      document.querySelectorAll('.cs__dot').forEach(function (d) { d.classList.remove('on'); });
      dot.classList.add('on');
      updateColorLabel(newColor);
    }
  }, true);
})();