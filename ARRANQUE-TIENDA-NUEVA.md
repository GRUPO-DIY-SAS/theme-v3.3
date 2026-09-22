# Arrancar una tienda nueva sobre el tema vivo de diyvape.co

Punto de partida: rama `plantilla-tienda-nueva`, sacada de `pagespeed-settings-improvements` en el commit `3729f83` (22-09-2026), que es exactamente el código del tema vivo `#158298636540` de diyvape.co.

Este archivo es el contexto que necesita una sesión nueva para no repetir el trabajo ya hecho ni volver a caer en las trampas que ya costaron horas. Léelo antes de tocar código.

---

## 1. Cómo funciona el despliegue (no es obvio y duele si se asume mal)

Una rama de este repo está conectada por la integración de GitHub a **un** tema de Shopify. Al hacer push, Shopify baja los archivos sola en un par de minutos. No hay build ni comando de deploy.

| Tienda | Rama | Tema | Dominio |
|---|---|---|---|
| DIY Vape | `pagespeed-settings-improvements` | `#158298636540` (MAIN) | diyvape.co |
| Homesale | `homesale` | `#176684007588` (MAIN) | homesale.com.co |
| Tienda nueva | *(por definir)* | *(por crear)* | *(por definir)* |

Consecuencias:

- **Push a esas dos ramas = producción.** No hay staging intermedio.
- El editor de temas de Shopify escribe de vuelta al repo con commits `Update from Shopify for theme …`. Hacer `git pull` antes de trabajar; si hay conflicto en un `templates/*.json` o `config/settings_data.json`, **gana la versión de Shopify** (es el estado real que ve el cliente) y encima se reaplican los cambios propios.
- Esos write-backs pueden **borrar bloques** que quitaste del `block_order` de un template. Si un bloque desaparece sin explicación, mirar el último write-back.

Para la tienda nueva: crear la rama desde aquí, crear un tema en la tienda Shopify nueva, y recién entonces conectarlos desde Admin → Online Store → Themes → Add theme → Connect from GitHub.

## 2. Lo primero que hay que decidir

**¿La tienda nueva vende productos con restricción de edad?** Todo lo demás depende de esto.

- **Sí** → el gate se queda tal cual. Es obligación legal (Ley 1581 de 2012). Nunca se puentea ni se quita la sincronización de los atributos al carrito.
- **No** → hay que arrancarlo entero. Homesale ya hizo ese camino; la lista de abajo es lo que se quitó.

Archivos del gate, todos exclusivos de DIY:

```
blocks/ai_gen_block_3f4d556.liquid    el gate en sí
sections/age-verifier.liquid
assets/age-verification.css
assets/age-verification.js            escribe la cookie y sincroniza al carrito
snippets/spotlight-gate-media.liquid  media que espera a la verificación
```

Pero borrar esos cinco archivos no alcanza: el gate se referencia desde otros seis sitios, y olvidar uno deja la página rota o el overlay huérfano. La lista completa sale de

```bash
git grep -l -iE "age_verified_diyvape|age-verification|isAgeVerified|age-verifier|ai_gen_block_3f4d556"
```

y hoy da, además de los cinco de arriba: `layout/theme.liquid`, `sections/overlay-group.json`, `snippets/preload-page.liquid`, `snippets/deferred-assets-loader.liquid`, `snippets/chat-widget-leadconnector.liquid` y `locales/en.default.schema.json`.

Lo delicado está en el loader:

- `isAgeVerified()` (~línea 253) lee la cookie `age_verified_diyvape`, el `localStorage` y la clase `html.age-gate-verified`.
- `initiallyAgeVerified` decide si se parchean `Node.prototype.appendChild/insertBefore` para bloquear scripts de terceros.
- Los listeners de `diyvape:age-verified` disparan la carga cuando el usuario aprueba.
- En `onEarlyTap` hay un `if (!requested && !isAgeVerified()) return;` — con el gate activo no se retiene ningún toque y el enlace del carrito conserva su navegación nativa a `/cart`, que es lo único que funciona en ese estado.

Si se quita el gate, esa guarda sobra y `initiallyAgeVerified` pasa a ser siempre `true`. Ver cómo quedó en la rama `homesale` antes de reescribirlo desde cero.

## 3. Apps y terceros que son de DIY, no del tema

El loader agrupa los scripts de terceros por `group` y los libera por separado. Lo que hay hoy y por qué:

- **Rapi** y **Judge.me** (`rapi`, `reviews`): bloqueados permanentemente fuera de PDP. Llegan por `content_for_header`, que no se puede filtrar del lado del servidor, así que se interceptan en el cliente.
- **MercadoPago** (`commerce`): se libera al primer clic en algo de carrito o checkout, o a los 10 s.
- **Analytics / web pixels** (`analytics`): se libera en idle a los 2 s.
- **LeadConnector** (`snippets/chat-widget-leadconnector.liquid`): cuenta de DIY.

Para la tienda nueva: revisar app por app cuáles se instalan de verdad y borrar los grupos que no. Dejar reglas de bloqueo para apps que no existen es deuda muerta que confunde al siguiente que lea el archivo.

## 4. Lo que define la marca

Casi todo lo visual vive en datos, no en código:

```
config/settings_data.json   colores, tipografías, esquemas, ajustes globales
templates/*.json            secciones y bloques de cada página
sections/*-group.json       header, footer
locales/*.json              textos
```

El código compartido está en `sections/`, `snippets/` y `assets/`. Esa es la línea divisoria: **arreglos de código se comparten entre tiendas (cherry-pick), la identidad no.**

DIY tiene además plantillas propias que probablemente no sirvan (`templates/page.vape-shop.json`, `page.wholesale.liquid`, `collection.herbales.json`, `page.our-store.json`, `page.store-location.json`) y una PDP propia (`assets/diyvape-pdp-*`, `snippets/diyvape-pdp-*`, `blocks/_product-metadatos.liquid`). Homesale no se llevó ninguno de esos.

Los identificadores `diyvape*` que aparecen por todo el código (`window.diyvapeDeferredAssets`, las clases `diyvape-deferred-*`, los eventos `diyvape:*`) son nombres internos heredados, **no los ve el usuario**. Renombrarlos es un refactor grande y sin retorno; Homesale los dejó igual.

## 5. Rendimiento: lo que ya está resuelto, no lo regreses

Esto es lo que se arregló y que una reescritura descuidada rompe sin darse cuenta.

**Cargador diferido** (`snippets/deferred-assets-loader.liquid`, commit `3729f83`):

- Los scripts se insertan de una vez en lugar de esperar el `onload` del anterior. Con `async = false` igual se ejecutan en orden de inserción. Encadenar las descargas costaba 5 s en móvil 4G.
- La espera a `DOMContentLoaded` va **dentro** de la cadena. Fuera, la cadena quedaba vacía y `diyvape:deferred-assets-loaded` se emitía a ~1 s, antes de que `theme.js` existiera: una señal falsa de la que colgaba todo lo demás.
- El primer toque en carrito, buscador y menú se retiene, arranca la carga y se repite cuando los scripts están listos. Sin esto el toque se perdía en el buscador y en el carrito navegaba a `/cart` en vez de abrir el panel.
- Hay un temporizador de 8 s que libera el toque si la cadena no resolviera (un script colgado no dispara `onload` *ni* `onerror`). Sin él, el botón quedaba atenuado para siempre y el `preventDefault` dejaba al usuario sin forma de llegar al carrito. Está verificado colgando `theme.js` a propósito.

Medido en móvil 1,6 Mbps con CPU 4x, tres corridas: carrito y buscador operativos a **12,2 s contra 16,6 s** de antes.

**Swiper** (`layout/theme.liquid`): se encola en **todas** las páginas. La barra superior es un slider en todas y varias page templates traen carruseles; la lista de `page_type` dejaba fuera `/pages`, `/blogs`, 404 y cuenta, y ahí `global.js` lanzaba `Swiper is not defined` con los slides apilados. Swiper debe encolarse **antes** que `global.js`, que hace `new Swiper`.

**`contact.js`** (`sections/page-contact.liquid`): pasa por la cola diferida. Como `<script defer>` corría antes que `global.js`, lanzaba `PopupBase is not defined` y `<product-addons>` nunca se registraba.

**CSS crítico** (`snippets/critical-base.liquid`): va inline en el `<head>`, no como archivo. Incluye tres reglas base de Swiper que bajaron el CLS de 0,958 a 0,009 en Homesale, la reserva de altura de la barra superior, y el `aria-busy` que atenúa el ícono mientras el toque espera.

En Homesale hay además trabajo de imágenes (971 → 570 KB sin recomprimir) y de CLS, en los commits `52956c3`, `66fb647`, `fe7f91d` y `7181888`.

## 6. Trampas que cuestan horas

**Rechazo silencioso de plantillas.** Un valor inválido en un `templates/*.json` hace que Shopify **rechace la plantilla entera, sin avisar, y no la reintente nunca** — los demás archivos del mismo commit sincronizan normal, así que parece que todo salió bien. Casos reales: `column_gap: 16` cuando el `step` del range es 5, y `content_max_width: 560` cuando el ajuste es un porcentaje con máximo 100. Hay un validador en `.claude/validate-template.py` (existe en local, **no está commiteado**; vale la pena subirlo). Revisa rangos min/max/step, valores de select, tipos de bloque y que el preload del LCP coincida con la imagen del hero.

**Bloques nuevos antes que la plantilla.** Declarar el tipo de bloque en el `schema` de la sección y hacer push **antes** (o en el mismo commit, y después volver a tocar la plantilla) de la plantilla que lo usa.

**`custom-liquid` no acepta Liquid.** Los ajustes de ese bloque son `textarea`. Meter sintaxis Liquid ahí hace que Shopify rechace la plantilla completa, otra vez en silencio.

**Liquid mal formado dentro de un atributo** no rompe la página en runtime (renderiza vacío) pero sí hace fallar `shopify theme push`. Los dos caminos no validan igual.

**CDN de Shopify:** pedir un `width` mayor que el original devuelve la imagen sin transformar, o sea sin WebP. Verificar el tamaño real de origen antes de fijar los `widths`.

**Metafields:** para leerlos desde Liquid, la definición necesita `access: { storefront: PUBLIC_READ }`. Con `NONE` renderizan vacío sin error.

**`?preview_theme_id=` redirige**, y eso destruye el contexto de ejecución en medio de una medición con Puppeteer. Cargarlo una vez para fijar la cookie y después medir sobre la URL limpia.

## 7. Cómo validar antes de publicar

En diyvape `shopify theme push` **no tiene acceso** ("you don't have access to this dev store") y el viejo tema `lh-test #158388027644` fue borrado. La ruta que funciona, vía Admin GraphQL:

1. `shopify store auth --store <tienda>.myshopify.com --scopes read_themes,write_themes`
2. `themeDuplicate(id, name)` sobre el tema vivo — devuelve `newTheme`, no `theme`, y nace en `processing: true`; esperar a `false`.
3. `themeFilesUpsert` con el body en `BASE64`, pasando las variables por `--variable-file`.
4. Probar en `https://<dominio>/?preview_theme_id=<id>`.
5. `themeDelete` al terminar.

En Homesale sí funciona el CLI contra el tema de desarrollo `#176684335268`.

`shopify store execute` necesita `--allow-mutations` para mutaciones, y el stdout trae ruido del spinner: leer siempre de `--output-file`.

Los scripts de prueba con Puppeteer (toque temprano, smoke por tipo de página, simulación de script colgado) quedaron en el scratchpad de la sesión del 22-09-2026, no en el repo. Si se van a usar seguido, conviene commitearlos. Lo mínimo a cubrir en cada validación:

- Errores JS en home, colección, PDP, página y 404.
- Carruseles montados (`.swiper-initialized` contra `slide-section`).
- Que carrito, buscador y menú abran.
- Si hay gate: los dos estados. Sin verificar **no debe cargar ningún asset** y el carrito debe navegar nativo a `/cart`.

## 8. Deuda conocida que se hereda

- Dos errores JS preexistentes en DIY, iguales antes y después del trabajo de rendimiento: `this.closest(...)?.init is not a function` en el home y `Cannot read properties of null (reading 'classList')` en la página sin verificar. Sin diagnosticar.
- `critical.css` sin minificar (~3 KiB) y ~53 KiB de JS sin usar en `theme.js`.
- En el home de DIY se montan 3 de 10 `slide-section`; los otros son paneles de tabs que se inicializan al abrirse. Verificado que es igual en el tema vivo, no es regresión.
- `.claude/validate-template.py` vive solo en local.

## 9. Reglas de trabajo que ya están escritas

No las repito acá; están en `.claude/rules/` y viajan con la rama:

- `code-quality.md` — convenciones de Liquid, naming, commits (asunto imperativo ≤72, cuerpo con el porqué y el impacto medido).
- `frontend.md` — LCP, CSS crítico, prevención de CLS, accesibilidad.
- `security.md` — gate de edad, escapado, PII.

El `CLAUDE.md` del repo y el `CLAUDE.local.md` (privado, gitignored) describen la tienda de la rama en la que estés. Al crear la rama de la tienda nueva, reescribirlos para ella: si quedan describiendo DIY, cada sesión futura va a trabajar con supuestos equivocados.
