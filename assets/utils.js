"use-strict";
function getCookie(cname) {
  let name = cname + "=";
  let decodedCookie = decodeURIComponent(document.cookie);
  let ca = decodedCookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ") {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function deleteCookie(cname) {
  document.cookie = cname + "=;expires=Thu, 01 Jan 1970 00:00:01 GMT;";
}

function setCookie(cname, cvalue, exdays) {
  const date = new Date();
  date.setTime(date.getTime() + exdays * 24 * 60 * 60 * 1000);
  let expires = "expires=" + date.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function fetchConfig(type = "json") {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: `application/${type}`,
    },
  };
}

let parser = new DOMParser();

const ON_CHANGE_DEBOUNCE_TIMER = 300;

const PUB_SUB_EVENTS = {
  cartUpdate: "cart-update",
  quantityUpdate: "quantity-update",
  variantChange: "variant-change",
};

let subscribers = {};
var root = document.body;

Shopify.bind = function (fn, scope) {
  return function () {
    return fn.apply(scope, arguments);
  };
};

Shopify.setSelectorByValue = function (selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

Shopify.addListener = function (target, eventName, callback) {
  target?.addEventListener
    ? target.addEventListener(eventName, callback, false)
    : target.attachEvent("on" + eventName, callback);
};

Shopify.postLink = function (path, options) {
  options = options || {};
  var method = options["method"] || "post";
  var params = options["parameters"] || {};

  var form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for (var key in params) {
    var hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", key);
    hiddenField.setAttribute("value", params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function (
  country_domid,
  province_domid,
  options
) {
  this.countryEl = document.getElementById(country_domid);
  this.provinceEl = document.getElementById(province_domid);
  this.provinceContainer = document.getElementById(
    options["hideElement"] || province_domid
  );

  Shopify.addListener(
    this.countryEl,
    "change",
    Shopify.bind(this.countryHandler, this)
  );

  this.initCountry();
  this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function () {
    var value = this.countryEl.getAttribute("data-default");
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function () {
    var value = this.provinceEl.getAttribute("data-default");
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function (e) {
    var opt = this.countryEl.options[this.countryEl.selectedIndex];
    var raw = opt.getAttribute("data-provinces");
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length == 0) {
      this.provinceContainer.style.display = "none";
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement("option");
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }

      this.provinceContainer.style.display = "";
    }
  },

  clearOptions: function (selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function (selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement("option");
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  },
};

Shopify.formatMoney = function (cents, format) {
  if (typeof cents == "string") {
    cents = cents.replace(".", "");
  }
  var value = "";
  var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
  var formatString = format || this.money_format;

  function defaultOption(opt, def) {
    return typeof opt == "undefined" ? def : opt;
  }

  function formatWithDelimiters(number, precision, thousands, decimal) {
    precision = defaultOption(precision, 2);
    thousands = defaultOption(thousands, ",");
    decimal = defaultOption(decimal, ".");
    if (isNaN(number) || number == null) {
      return 0;
    }

    number = (number / 100.0).toFixed(precision);

    var parts = number.split("."),
      dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1" + thousands),
      cents = parts[1] ? decimal + parts[1] : "";
    return dollars + cents;
  }

  switch (formatString.match(placeholderRegex)[1]) {
    case "amount":
      value = formatWithDelimiters(cents, 2);
      break;
    case "amount_no_decimals":
      value = formatWithDelimiters(cents, 0);
      break;
    case "amount_with_comma_separator":
      value = formatWithDelimiters(cents, 2, ".", ",");
      break;
    case "amount_no_decimals_with_comma_separator":
      value = formatWithDelimiters(cents, 0, ".", ",");
      break;
  }
  return formatString.replace(placeholderRegex, value);
};
var getScrollBarWidth = (function () {
  return {
    init: function () {
      var scrollDiv = document.createElement("div");
      scrollDiv.style.width = "100px";
      scrollDiv.style.height = "100px";
      scrollDiv.style.overflow = "scroll";
      scrollDiv.style.position = "absolute";
      scrollDiv.style.top = "-9999px";
      document.body.appendChild(scrollDiv);
      var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
      document.body.removeChild(scrollDiv);
      return scrollbarWidth;
    },
  };
})();
function subscribe(eventName, callback) {
  if (subscribers[eventName] === undefined) {
    subscribers[eventName] = [];
  }

  subscribers[eventName] = [...subscribers[eventName], callback];

  return function unsubscribe() {
    subscribers[eventName] = subscribers[eventName].filter((cb) => {
      return cb !== callback;
    });
  };
}

function publish(eventName, data) {
  if (subscribers[eventName]) {
    subscribers[eventName].forEach((callback) => {
      if (data) {
        callback(data);
      } else {
        callback();
      }
    });
  }
}
function loadLazyVideo(el) {
  if (!el || el.dataset.videoLoaded === "true") return;

  const poster = el.dataset.poster;
  const src = el.dataset.src;
  let hasSource = false;

  if (poster) {
    el.setAttribute("poster", poster);
    el.removeAttribute("data-poster");
  }

  if (src) {
    el.setAttribute("src", src);
    el.removeAttribute("data-src");
    hasSource = true;
  }

  el.querySelectorAll("source").forEach((source) => {
    const sourceSrc = source.dataset.src;
    if (sourceSrc) {
      source.setAttribute("src", sourceSrc);
      source.removeAttribute("data-src");
      hasSource = true;
    }
  });

  if (!hasSource && !poster) return;

  el.dataset.videoLoaded = "true";
  el.classList.remove("lazy-video", "lazy-video-item");
  el.load?.();

  if (el.hasAttribute("autoplay")) {
    el.play?.().catch(() => {});
  }
}

function runWhenIdle(callback) {
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 3500 });
    return;
  }

  setTimeout(callback, 2500);
}

function bindInteractionVideos(videos) {
  if (!videos.length) return;

  let loaded = false;
  const loadVideos = () => {
    if (loaded) return;

    loaded = true;
    videos.forEach(loadLazyVideo);
  };

  ["pointerdown", "keydown", "touchstart", "touchmove", "wheel", "scroll"].forEach((eventName) => {
    window.addEventListener(eventName, loadVideos, {
      once: true,
      passive: true,
    });
  });

  if (window.matchMedia("(min-width: 990px)").matches) {
    runWhenIdle(loadVideos);
  }
}

function initLazyload() {
  const videos = Array.from(
    document.querySelectorAll("video.lazy-video, video.lazy-video-item, video[data-video-load][data-src]")
  ).filter((video) => video.dataset.videoBound !== "true");

  if (!videos.length) return;

  const visibleVideos = [];
  const interactionVideos = [];

  videos.forEach((video) => {
    video.dataset.videoBound = "true";

    if (video.dataset.videoLoad === "interaction") {
      interactionVideos.push(video);
    } else {
      visibleVideos.push(video);
    }
  });

  bindInteractionVideos(interactionVideos);

  if (!visibleVideos.length) return;

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          loadLazyVideo(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "250px 0px", threshold: 0.01 }
    );

    visibleVideos.forEach((video) => observer.observe(video));
    return;
  }

  const loadVisibleVideos = () => visibleVideos.forEach(loadLazyVideo);
  window.addEventListener("scroll", loadVisibleVideos, { once: true, passive: true });
  runWhenIdle(loadVisibleVideos);
}

initLazyload();
document.addEventListener("shopify:section:load", initLazyload);
