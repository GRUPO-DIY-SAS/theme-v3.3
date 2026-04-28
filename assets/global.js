"use-strict";
let cachedRoot = null;
let cachedBody = null;
let cachedScrollbarWidth = null;

function getBody() {
  if (!cachedBody) {
    cachedBody = document.body;
  }
  return cachedBody;
}

function getRoot() {
  if (!cachedRoot) {
    cachedRoot = document.documentElement;
  }
  return cachedRoot;
}

function getScrollbarWidth() {
  if (cachedScrollbarWidth !== null) {
    return cachedScrollbarWidth;
  }

  const scrollDiv = document.createElement("div");
  Object.assign(scrollDiv.style, {
    width: "100px",
    height: "100px",
    overflow: "scroll",
    position: "absolute",
    top: "-9999px",
    visibility: "hidden",
  });

  getBody().appendChild(scrollDiv);
  cachedScrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
  getBody().removeChild(scrollDiv);

  return cachedScrollbarWidth;
}

function eventScrollbarWidth() {
  requestAnimationFrame(() => {
    getRoot().style.setProperty(
      "--scrollbar-width",
      getScrollbarWidth() + "px",
    );
    window.addEventListener("resize", () => {
      getRoot().style.setProperty(
        "--scrollbar-width",
        getScrollbarWidth() + "px",
      );
    });
  });
}
eventScrollbarWidth();

var BlsLazyloadImg = (function () {
  return {
    init: function () {
      this.lazyReady();
    },
    lazyReady: function () {
      if (!!window.IntersectionObserver) {
        let observer = new IntersectionObserver(
          (entries, observer) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                const onImageLoad = (e) => {
                  const target = e.currentTarget;
                  setTimeout(() => {
                    target
                      ?.closest("motion-element")
                      ?.classList.remove("bls-loading-image");
                    target?.classList.remove("bls-loading-image");
                  }, 600);
                  e.currentTarget.removeEventListener("load", onImageLoad);
                };
                entry.target.width = entry.boundingClientRect.width;
                entry.target.height = entry.boundingClientRect.height;
                entry.target.sizes = `${entry.boundingClientRect.width}px`;
                entry.target.addEventListener("load", onImageLoad);
                observer.unobserve(entry.target);
              }
            });
          },
          { rootMargin: "10px" }
        );
        document.querySelectorAll(".bls-image-js img").forEach((img) => {
          observer.observe(img);
        });
      }
    },
  };
})();
BlsLazyloadImg.init();
function CloseAllPopup(data) {
  publish("closeCanvas", data);
}

const imageReady = (imageOrArray) => {
  if (!imageOrArray) {
    return Promise.resolve();
  }
  imageOrArray =
    imageOrArray instanceof Element ? [imageOrArray] : Array.from(imageOrArray);
  return Promise.all(
    imageOrArray.map((image) => {
      return new Promise((resolve) => {
        if (
          (image.tagName === "IMG" && image.complete) ||
          !image.offsetParent
        ) {
          setTimeout(() => {
            image
              .closest("motion-element")
              ?.classList.remove("bls-loading-image");
            image.classList.remove("bls-loading-image");
            resolve();
          }, 100);
        } else {
          image.addEventListener("load", (e) => {
            e.currentTarget
              .closest("motion-element")
              ?.classList.remove("bls-loading-image");
            e.currentTarget.classList.remove("bls-loading-image");
            resolve();
          });
        }
      });
    })
  );
};

function pauseAllMedia() {
  document.querySelectorAll(".js-youtube").forEach((video) => {
    video.contentWindow.postMessage(
      '{"event":"command","func":"' + "pauseVideo" + '","args":""}',
      "*"
    );
  });
  document.querySelectorAll(".js-vimeo").forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', "*");
  });
  document.querySelectorAll("video").forEach((video) => video.pause());
  document.querySelectorAll("product-model").forEach((model) => {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  });
}

function runSlideMotionItemsEffect(host, swiper, methodName, options = {}) {
  if (!host || !swiper || host?.dataset?.slideMotionHost !== "true") return;

  const slides = new Set();
  const activeSlide = swiper.slides?.[swiper.activeIndex];
  const realIndex = swiper.realIndex;

  if (activeSlide) {
    slides.add(activeSlide);
  }

  host
    .querySelectorAll(".swiper-slide-active, .swiper-slide-duplicate-active")
    .forEach((slide) => slides.add(slide));

  if (realIndex !== undefined && realIndex !== null) {
    host
      .querySelectorAll(`.swiper-slide[data-swiper-slide-index="${realIndex}"]`)
      .forEach((slide) => slides.add(slide));
  }

  const effects = Array.from(slides).flatMap((slide) =>
    Array.from(slide.querySelectorAll("motion-items-effect[slideshow]"))
  );

  if (!effects.length) return;

  const triggerEffect = () => {
    effects.forEach((effect) => {
      if (typeof effect[methodName] === "function") {
        effect[methodName]();
      }
    });
  };

  const runEffect = options.defer
    ? () => requestAnimationFrame(triggerEffect)
    : triggerEffect;

  if (window.customElements?.get("motion-items-effect")) {
    runEffect();
    return;
  }

  window.customElements?.whenDefined("motion-items-effect").then(runEffect);
}

class SlideSection extends HTMLElement {
  constructor() {
    super();
    this.globalSlide = null;
    this.init();
  }

  init() {
    if (document.body.classList.contains("index")) {
      let pos = window.pageYOffset;
      if (pos > 0 || document.body.classList.contains("swiper-lazy")) {
        this.initSlide();
      } else {
        if (this.classList.contains("lazy-loading-swiper-before")) {
          this.initSlide();
        } else {
          this.classList.add("lazy-loading-swiper-after");
        }
      }
    } else {
      this.initSlide();
    }
  }

  initSlide() {
    const _this = this;
    const isSlideMotionHost = _this?.dataset?.slideMotionHost === "true";
    var autoplaying = _this?.dataset.autoplay === "true";
    const loop = _this?.dataset.loop === "true";
    const itemDesktop = _this?.dataset.desktop ? _this?.dataset.desktop : 4;
    var itemTablet = _this?.dataset.tablet ? _this?.dataset.tablet : "";
    const itemMobile = _this?.dataset.mobile ? _this?.dataset.mobile : 1;
    const direction = _this?.dataset.direction
      ? _this?.dataset.direction
      : "horizontal";
    var autoplaySpeed = _this?.dataset.autoplaySpeed
      ? _this?.dataset.autoplaySpeed * 1000
      : 3000;
    var speed = _this?.dataset.speed ? _this?.dataset.speed : 400;
    const effect = _this?.dataset.effect ? _this?.dataset.effect : "slide";
    const row = _this?.dataset.row ? _this?.dataset.row : 1;
    var spacing = _this?.dataset.spacing ? _this?.dataset.spacing : 30;
    const progressbar = _this?.dataset.paginationProgressbar === "true";
    const autoItem = _this?.dataset.itemMobile === "true";
    const autoHeight =
      isSlideMotionHost && _this?.dataset.autoHeight === "true";
    const paginationCustom = _this?.dataset.customPagination;
    const slideShow = _this?.dataset.slideshow === "true";
    const revealSlideshow = _this?.dataset.revealSlideshow === "true";
    const centeredSlidesAttr = _this?.dataset.centeredSlides;
    const centeredSlidesSetting =
      centeredSlidesAttr === undefined
        ? slideShow && parseFloat(itemDesktop) === 1.5
        : centeredSlidesAttr === "true";
    const customNavigation = _this?.dataset.customNavigation === "true";
    const customPrev = _this?.dataset.customPrev;
    const customNext = _this?.dataset.customNext;
    const arrowCenterimage = _this?.dataset.arrowCenterimage
      ? _this?.dataset.arrowCenterimage
      : 0;
    spacing = Number(spacing);
    autoplaySpeed = Number(autoplaySpeed);
    speed = Number(speed);
    if (autoplaying) {
      autoplaying = { delay: autoplaySpeed };
    }
    if (!itemTablet) {
      if (itemDesktop < 2) {
        itemTablet = 1;
      } else if (itemDesktop < 3) {
        itemTablet = 2;
      } else {
        itemTablet = 3;
      }
    }
    if (direction == "vertical") {
      _this.style.maxHeight = _this.offsetHeight + "px";
    }
    this.globalSlide = new Swiper(_this, {
      slidesPerView: autoItem ? "auto" : itemMobile,
      spaceBetween: spacing >= 15 ? 15 : spacing,
      autoplay: autoplaying,
      direction: direction,
      loop: loop,
      effect: effect,
      autoHeight: autoHeight,
      speed: speed,
      watchSlidesProgress: true,
      watchSlidesVisibility: true,
      grabCursor: true,
      centeredSlides: centeredSlidesSetting,
      grid: {
        rows: row,
        fill: "row",
      },
      navigation: {
        nextEl: customNavigation ? document.querySelector(`.${customNext}`) : _this.querySelector(".swiper-button-next"),
        prevEl: customNavigation ? document.querySelector(`.${customPrev}`) : _this.querySelector(".swiper-button-prev"),
      },
      pagination: {
        clickable: true,
        el: paginationCustom == undefined ? 
          _this.querySelector(".parent-pagination") ||
          _this.querySelector(".swiper-pagination") : _this.querySelector(`.${paginationCustom}`),
        type: progressbar ? "progressbar" : "bullets",
      },
      breakpoints: {
        768: {
          slidesPerView: itemTablet,
          spaceBetween: spacing >= 30 ? 30 : spacing,
          type: progressbar ? "progressbar" : "bullets",
          autoHeight: false,
          centeredSlides: false
        },
        1025: {
          slidesPerView: itemDesktop,
          spaceBetween: spacing,
          type: progressbar ? "progressbar" : "bullets",
          autoHeight: false,
          centeredSlides: centeredSlidesSetting,
        },
      },
      thumbs: {
        swiper: this.thumbnailSlide ? this.thumbnailSlide : null,
      },

      on: {
        init: function (e) {
          var sec__tiktok = _this.closest(".sec__tiktok-video");
          if (isSlideMotionHost) {
            e.__slideMotionLoopReady = false;
          }
          if (e.autoplay?.stop) {
            e.autoplay.stop();
          }
          if (_this?.dataset.autoplay === "true") {
            Motion.inView(
              _this,
              async () => {
                if (e.autoplay?.start) {
                  e.autoplay.start();
                }
              },
              { margin: "0px 0px -50px 0px" }
            );
          }

          if (sec__tiktok) {
            _this.initSecTiktok(sec__tiktok);
            window.addEventListener("resize", function () {
              setTimeout(() => {
                _this.initSecTiktok(sec__tiktok);
              }, 150);
            });
          }
          if (arrowCenterimage) {
            var items_slide = _this.querySelectorAll(
              ".product-item__media--ratio"
            );
            if (items_slide.length != 0) {
              var oH = [];
              items_slide.forEach((e) => {
                oH.push(e.offsetHeight / 2);
              });
              var max = Math.max(...oH);
              var arrowsOffset = "--arrows-offset-top: " + max + "px";
              if (_this.querySelectorAll(".swiper-arrow")) {
                _this.querySelectorAll(".swiper-arrow").forEach((arrow) => {
                  arrow.setAttribute("style", arrowsOffset);
                });
              }
            }
          }
          var video = _this.querySelector("video.slideshow");
          if (video) {
            const handleIntersection = (entries, observer) => {
              if (!entries[0].isIntersecting) return;
              observer.unobserve(_this);
              const videos = _this.querySelectorAll("video");
              videos.forEach((video) => {
                const dataSrc = video.dataset.src;
                if (dataSrc) {
                  video.src = dataSrc;
                  video.removeAttribute("data-src");
                }
              });
            };
            new IntersectionObserver(handleIntersection.bind(_this), {
              rootMargin: "0px 0px 200px 0px",
            }).observe(_this);
          }
          runSlideMotionItemsEffect(_this, e, "refreshAnimationEffect", {
            defer: true,
          });
        },
        slideChange: function () {
          const index_currentSlide = this.realIndex + 1;
          if (_this.closest(".sec__testimonials-single")) {
            const allDots = _this
              .closest(".sec__testimonials-single")
              .querySelectorAll(`single-item`);
            allDots.forEach((dot) => {
              dot.classList.remove("active");
            });
            _this
              .closest(".sec__testimonials-single")
              .querySelector(
                ".testimonials-author-image[data-position='" +
                  index_currentSlide +
                  "']"
              )
              .classList.add("active");
          }
        },
        slideChangeTransitionStart: function () {
          if (!slideShow) return;
          if (isSlideMotionHost) {
            this.__slideMotionLoopReady = true;
            runSlideMotionItemsEffect(_this, this, "refreshAnimationEffect");
          }
          const currentSlide = this.slides[this.activeIndex];
          currentSlide
            .querySelectorAll("motion-element")
            .forEach(async (motion) => {
              await motion.preInitialize();
            });
          if (!isSlideMotionHost) {
            runSlideMotionItemsEffect(_this, this, "prepareAnimationEffect");
          }
        },
        slideChangeTransitionEnd: function () {
          if (!slideShow) return;
          const currentSlide = this.slides[this.activeIndex];
          currentSlide
            .querySelectorAll("motion-element")
            .forEach(async (motion) => {
              motion.classList.remove("animate-delay");
              if (
                isSlideMotionHost &&
                typeof motion.refreshAnimation === "function"
              ) {
                motion.refreshAnimation();
                return;
              }
              await motion.initialize();
            });
          if (!isSlideMotionHost) {
            runSlideMotionItemsEffect(_this, this, "refreshAnimationEffect", {
              defer: true,
            });
          }
        },
        loopFix: function () {
          if (!slideShow) return;
          if (isSlideMotionHost && !this.__slideMotionLoopReady) return;
          runSlideMotionItemsEffect(_this, this, "refreshAnimationEffect", {
            defer: true,
          });
        },
        afterInit: function () {
          if (slideShow && revealSlideshow && itemDesktop <= 3) {
            _this.duplicateSlides(this);
          }
        },
        touchMove: function (swiper, event) {
          const innerWidth = event.view.innerWidth;
          const swiperMedia = swiper.el.classList.contains('swiper-popup-media');
          const slidePopup = document.querySelector("slide-section-popup");
          if (slidePopup && swiperMedia && innerWidth > 767) {
            slidePopup.swiper.allowTouchMove = false;
            slidePopup.swiper.unsetGrabCursor();
          }
        },
        touchEnd: function (swiper, event) {
          const innerWidth = event.view.innerWidth;
          const swiperMedia = swiper.el.classList.contains('swiper-popup-media');
          const slidePopup = document.querySelector("slide-section-popup");
          if (!swiperMedia) return;
          if (slidePopup && innerWidth > 767) {
            slidePopup.swiper.allowTouchMove = true;
            slidePopup.swiper.setGrabCursor();
          }
        }
      },
    });
  }

  duplicateSlides(swiper) {
    const _this = this;
    const swiperWrapper = _this.querySelector('.swiper-wrapper');
    const originalSlides = swiperWrapper.querySelectorAll('.swiper-slide');
    const paginationEl = _this.querySelector('.swiper-pagination');
    
    if (paginationEl) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === 1 && node.classList.contains('swiper-pagination-bullet')) {
                const allBullets = paginationEl.querySelectorAll('.swiper-pagination-bullet');
                const bulletIndex = Array.from(allBullets).indexOf(node);
                if (bulletIndex >= originalSlides.length) {
                  node.classList.add('swiper-pagination-duplicate');
                }
              }
            });
          }
        });
        observer.disconnect();
      });
      
      observer.observe(paginationEl, { childList: true });
    }
    
    originalSlides.forEach((slide) => {
        const clonedSlide = slide.cloneNode(true);
        clonedSlide.classList.add('swiper-slide-duplicate');
        swiperWrapper.appendChild(clonedSlide);
    });
    
    swiper.update();
  }

  initSecTiktok(sec) {
    sec.querySelectorAll(".swiper-slide").forEach((arrow) => {
      const tiktok = arrow.querySelector(".section_tiktok-image");
      let width = "--item-width: " + arrow.offsetWidth;
      tiktok.setAttribute("style", width);
    });
  }
}
customElements.define("slide-section", SlideSection);

class PopupBase extends HTMLElement {
  constructor() {
    super();
    this.customClass = this.dataset.customClass;
    this.modal = null;
  }

  initPopup(content, text, customClass, modalWidth) {
    const _this = this;
    this.modal = new tingle.modal({
      footer: false,
      stickyFooter: false,
      closeMethods: ["overlay", "button", "escape"],
      cssClass: [this.customClass || customClass],
      onOpen: function () {
        const modalBoxContent = this.modal.querySelector(".tingle-modal-box");
        if (modalWidth) {
          modalBoxContent.style.setProperty("--popup-max-width", modalWidth);
        }
        document.dispatchEvent(new CustomEvent("modal:opened"));
        document.documentElement.classList.add("open-popup");
        root.style.setProperty(
          "padding-right",
          getScrollBarWidth.init() + "px"
        );
        const video = this.modalBox.querySelector("video");
        if (!video) return;
        video.play();
        if (this.modal.classList.contains("shopable-video")) {
          video.muted = false;
        }
      },
      onClose: function () {
        document.dispatchEvent(new CustomEvent("modal:closed"));
        document.documentElement.classList.remove("open-popup");
        root.style.removeProperty("padding-right");
      },
      beforeClose: function () {
        _this.onCloseEvent();
        document.documentElement.classList.remove("open-popup");
        root.style.removeProperty("padding-right");
        return true;
      },
    });
    this.modal.setHeader = function (content) {
      let popup_content = this.modalBoxContent;
      let popup_header = document.createElement("div");
      popup_header.classList.add("tingle-modal-box__header");
      popup_header.innerHTML = content;
      let parentElement = popup_content.parentNode;
      parentElement.insertBefore(popup_header, popup_content);
    };
    if (text) {
      this.modal.setHeader(text);
    }

    this.modal.setContent(content);
    this.modal.open();
  }

  onClose() {
    this.modal.close();
  }
  onCloseEvent() {}
}

class SwatchInit extends HTMLElement {
  constructor() {
    super();
    this.options = null;
    this.init();
  }

  init() {
    const _this = this;
    this.querySelectorAll(".product__color-swatches--js").forEach((btn) => {
      _this.checkSwatches(btn);
    });
  }
  checkSwatches(e) {
    const { color, image, customValue, swatchType, optionSwatchValue } =
      e.dataset;
    if (color) {
      if (swatchType != "variant_images") {
        if (optionSwatchValue.length == 0 || optionSwatchValue == null) {
          if (this.checkColor(color)) {
            e.style.backgroundColor = color;
            e.classList.add(customValue);
          } else {
            e.classList.add(customValue);
            if (image) {
              e.classList.add("color__" + color.replace(" ", "-"));
              e.style.backgroundColor = null;
              e.style.backgroundImage = "url('" + image + "')";
              e.style.backgroundSize = "cover";
              e.style.backgroundRepeat = "no-repeat";
            }
          }
        } else {
          e.style.setProperty("--swatch--background", optionSwatchValue);
        }
      } else {
        if (optionSwatchValue == null || optionSwatchValue.length == 0) {
          if (image) {
            e.classList.add("color__" + color.replace(" ", "-"));
            e.style.backgroundColor = null;
            e.style.backgroundImage = "url('" + image + "')";
            e.style.backgroundSize = "cover";
            e.style.backgroundRepeat = "no-repeat";
          } else if (this.checkColor(color)) {
            e.style.backgroundColor = color;
            e.classList.add(customValue);
          } else {
            e.classList.add(customValue);
          }
        } else {
          e.style.setProperty("--swatch--background", optionSwatchValue);
        }
      }
    }
  }
  checkColor(strColor) {
    var s = new Option().style;
    s.color = strColor;
    return s.color == strColor;
  }
  updateOptions() {
    this.options = Array.from(
      this.querySelectorAll(".product__color-swatches--js.active"),
      (select) => select.getAttribute("data-value")
    );
    this.variantData.find((variant) => {
      if (this.options.length == 1) {
        const variantOptions = {
          1: variant.option1,
          2: variant.option2,
          3: variant.option3,
        };
        if (variantOptions[this.position_swatch] === this.options[0]) {
          this.options = variant.options;
        }
      }
    });
  }
  updateMasterId(variantData) {
    return (this.currentVariant = variantData.find((variant) => {
      return !variant.options
        .map((option, index) => {
          return this.options[index] === option;
        })
        .includes(false);
    }));
  }
}

// js for 3d product - not done yet
class DeferredMedia extends HTMLElement {
  constructor() {
    super();
    const poster = this.querySelector('[id^="Deferred-Poster-"]');
    if (!poster) return;
    poster.addEventListener("click", this.loadContent.bind(this));
  }

  loadContent(focus = true) {
    pauseAllMedia();
    if (!this.getAttribute("loaded")) {
      const content = document.createElement("div");
      content.appendChild(
        this.querySelector("template").content.firstElementChild.cloneNode(true)
      );

      this.setAttribute("loaded", true);
      const deferredElement = this.appendChild(
        content.querySelector("video, model-viewer, iframe")
      );
      if (focus) deferredElement.focus();
      if (
        deferredElement.nodeName == "VIDEO" &&
        deferredElement.getAttribute("autoplay")
      ) {
        deferredElement.play();
      }
    }
  }
}

function handleErrorMessagePopup(errorMessage = false) {
  const url = `${window.location.pathname}?section_id=form-message`;
  fetch(url)
    .then((response) => response.text())
    .then((responseText) => {
      const html = new DOMParser().parseFromString(responseText, "text/html");
      const elementErrorMessage = html.querySelector(
        ".product-form__error-message-wrapper"
      );
      const elementMessage = elementErrorMessage.querySelector(
        ".product-form__error-message"
      );
      elementMessage.textContent = errorMessage;
      showToast(elementErrorMessage.innerHTML, 5000, "modal-error");
    })
    .catch((e) => {
      throw e;
    });
}

function showToast(message, duration = 3000, customClass = "") {
  let toastContainer = document.getElementById("toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.className = `toast show ${customClass}`;
  toast.innerHTML = message;
  toastContainer.appendChild(toast);

  Motion.animate(
    toast,
    {
      opacity: [0, 1],
      scale: [0.3, 1],
    },
    {
      duration: 0.3,
      easing: "ease-out",
    }
  );

  setTimeout(() => {
    closeToast(toast);
  }, duration);
}

function closeToast(toast) {
  Motion.animate(
    toast,
    { opacity: 0, scale: 0.5 },
    { duration: 0.2, easing: "ease-in" }
  ).then(() => {
    toast.remove();
  });
}

class SlideLazyLoad {
  constructor(e) {
    (this.triggerEventsJs = e),
      (this.eventOptionsJs = { passive: !0 }),
      (this.userEventListenerJs = this.triggerListenerJs.bind(this)),
      (this.delayedScriptsJs = { normal: [], async: [], defer: [] });
  }
  triggerListenerJs() {
    this._removeUserInteractionListenerJs(this),
      "loading" === document.readyState
        ? document.addEventListener(
            "DOMContentLoaded",
            this._loadEverythingReadyNow.bind(this)
          )
        : this._loadEverythingReadyNow();
  }
  _removeUserInteractionListenerJs(e) {
    this.triggerEventsJs.forEach((t) =>
      window.removeEventListener(t, e.userEventListenerJs, e.eventOptionsJs)
    );
  }
  _addUserInteractionListenerJs(e) {
    this.triggerEventsJs.forEach((t) =>
      window.addEventListener(t, e.userEventListenerJs, e.eventOptionsJs)
    );
  }
  _preloadAllScriptsJs() {
    document.body.classList.add("swiper-lazy");
    document.body.classList.add("review-lazy");
    const loadingSwiper = document.querySelectorAll(
      ".lazy-loading-swiper-after"
    );
    loadingSwiper.forEach((el) => {
      el.classList.remove("lazy-loading-swiper-after");
      this.initSlide(el);
    });
    const reviewProduct = document.querySelectorAll(".review-product-added");
    reviewProduct.forEach((el) => {
      el.classList.remove("review-product-added");
      el.innerHTML = el.querySelector(".product-review-json").innerHTML;
      el.classList.remove("inline-loading");
    });
  }

  initSlide(el) {
    const _this = el;
    const isSlideMotionHost = _this?.dataset?.slideMotionHost === "true";
    var autoplaying = _this?.dataset.autoplay === "true";
    const loop = _this?.dataset.loop === "true";
    const itemDesktop = _this?.dataset.desktop ? _this?.dataset.desktop : 4;
    var itemTablet = _this?.dataset.tablet ? _this?.dataset.tablet : "";
    const itemMobile = _this?.dataset.mobile ? _this?.dataset.mobile : 1;
    const direction = _this?.dataset.direction
      ? _this?.dataset.direction
      : "horizontal";
    var autoplaySpeed = _this?.dataset.autoplaySpeed
      ? _this?.dataset.autoplaySpeed * 1000
      : 3000;
    var speed = _this?.dataset.speed ? _this?.dataset.speed : 400;
    const effect = _this?.dataset.effect ? _this?.dataset.effect : "slide";
    const row = _this?.dataset.row ? _this?.dataset.row : 1;
    var spacing = _this?.dataset.spacing ? _this?.dataset.spacing : 30;
    const progressbar = _this?.dataset.paginationProgressbar === "true";
    const autoItem = _this?.dataset.itemMobile === "true";
    const autoHeight =
      isSlideMotionHost && _this?.dataset.autoHeight === "true";
    const slideShow = _this?.dataset.slideshow === "true";
    const arrowCenterimage = _this?.dataset.arrowCenterimage
      ? _this?.dataset.arrowCenterimage
      : 0;
    spacing = Number(spacing);
    autoplaySpeed = Number(autoplaySpeed);
    speed = Number(speed);
    if (autoplaying) {
      autoplaying = { delay: autoplaySpeed };
    }
    if (!itemTablet) {
      if (itemDesktop < 2) {
        itemTablet = 1;
      } else if (itemDesktop < 3) {
        itemTablet = 2;
      } else {
        itemTablet = 3;
      }
    }
    if (direction == "vertical") {
      _this.style.maxHeight = _this.offsetHeight + "px";
    }
    _this.globalSlide = new Swiper(el, {
      slidesPerView: autoItem ? "auto" : itemMobile,
      spaceBetween: spacing >= 15 ? 15 : spacing,
      autoplay: autoplaying,
      direction: direction,
      loop: loop,
      effect: effect,
      autoHeight: autoHeight,
      speed: speed,
      watchSlidesProgress: true,
      watchSlidesVisibility: true,
      grid: {
        rows: row,
        fill: "row",
      },
      navigation: {
        nextEl: _this.querySelector(".swiper-button-next"),
        prevEl: _this.querySelector(".swiper-button-prev"),
      },
      pagination: {
        clickable: true,
        el:
          _this.querySelector(".parent-pagination") ||
          _this.querySelector(".swiper-pagination"),
        type: progressbar ? "progressbar" : "bullets",
      },
      breakpoints: {
        768: {
          slidesPerView: itemTablet,
          spaceBetween: spacing >= 30 ? 30 : spacing,
          pagination: {
            type: progressbar ? "progressbar" : "bullets",
          },
        },
        1025: {
          slidesPerView: itemDesktop,
          spaceBetween: spacing,
          pagination: {
            type: progressbar ? "progressbar" : "bullets",
          },
        },
      },
      thumbs: {
        swiper: this.thumbnailSlide ? this.thumbnailSlide : null,
      },

      on: {
        init: function (e) {
          if (isSlideMotionHost) {
            e.__slideMotionLoopReady = false;
          }
          if (e.autoplay?.stop) {
            e.autoplay.stop();
          }
          if (_this?.dataset.autoplay === "true") {
            Motion.inView(
              _this,
              async () => {
                if (e.autoplay?.start) {
                  e.autoplay.start();
                }
              },
              { margin: "0px 0px -50px 0px" }
            );
          }
          var sec__tiktok = _this.closest(".sec__tiktok-video");
          if (sec__tiktok) {
            _this.initSecTiktok(sec__tiktok);
            window.addEventListener("resize", function () {
              setTimeout(() => {
                _this.initSecTiktok(sec__tiktok);
              }, 150);
            });
          }
          if (arrowCenterimage) {
            var items_slide = _this.querySelectorAll(
              ".product-item__media--ratio"
            );
            if (items_slide.length != 0) {
              var oH = [];
              items_slide.forEach((e) => {
                oH.push(e.offsetHeight / 2);
              });
              var max = Math.max(...oH);
              var arrowsOffset = "--arrows-offset-top: " + max + "px";
              if (_this.querySelectorAll(".swiper-arrow")) {
                _this.querySelectorAll(".swiper-arrow").forEach((arrow) => {
                  arrow.setAttribute("style", arrowsOffset);
                });
              }
            }
          }
          runSlideMotionItemsEffect(_this, e, "refreshAnimationEffect", {
            defer: true,
          });
        },
        realIndexChange: function (swiper) {
          var slide_visibles = _this.querySelectorAll(
            ".swiper-slide motion-element:not([data-image])"
          );
          slide_visibles?.forEach((slide) => {
            if (!slide.hasAttribute("hold")) {
              slide?.setAttribute("hold", true);
            }
          });
        },
        slideChangeTransitionStart: function () {
          if (!slideShow) return;
          if (isSlideMotionHost) {
            this.__slideMotionLoopReady = true;
            runSlideMotionItemsEffect(_this, this, "refreshAnimationEffect");
          }
          const currentSlide = this.slides[this.activeIndex];
          currentSlide
            .querySelectorAll("motion-element")
            .forEach(async (motion) => {
              await motion.preInitialize();
            });
          if (!isSlideMotionHost) {
            runSlideMotionItemsEffect(_this, this, "prepareAnimationEffect");
          }
        },
        slideChangeTransitionEnd: function () {
          if (!slideShow) return;
          const currentSlide = this.slides[this.activeIndex];
          currentSlide
            .querySelectorAll("motion-element")
            .forEach(async (motion) => {
              motion.classList.remove("animate-delay");
              if (
                isSlideMotionHost &&
                typeof motion.refreshAnimation === "function"
              ) {
                motion.refreshAnimation();
                return;
              }
              await motion.initialize();
            });
          if (!isSlideMotionHost) {
            runSlideMotionItemsEffect(_this, this, "refreshAnimationEffect", {
              defer: true,
            });
          }
        },
        loopFix: function () {
          if (!slideShow) return;
          if (isSlideMotionHost && !this.__slideMotionLoopReady) return;
          runSlideMotionItemsEffect(_this, this, "refreshAnimationEffect", {
            defer: true,
          });
        },
        slideChange: function () {
          const index_currentSlide = this.realIndex + 1;
          if (_this.closest(".sec__testimonials-single")) {
            const allDots = _this
              .closest(".sec__testimonials-single")
              .querySelectorAll(`single-item`);
            allDots.forEach((dot) => {
              dot.classList.remove("active");
            });
            _this
              .closest(".sec__testimonials-single")
              .querySelector(
                ".testimonials-author-image[data-position='" +
                  index_currentSlide +
                  "']"
              )
              .classList.add("active");
          }
        },
      },
    });
  }

  async _loadEverythingReadyNow() {
    this._preloadAllScriptsJs(),
      await this._loadScriptsFromListJs(this.delayedScriptsJs.normal),
      await this._loadScriptsFromListJs(this.delayedScriptsJs.defer),
      await this._loadScriptsFromListJs(this.delayedScriptsJs.async),
      await this._triggerDOMContentLoadedJs(),
      await this._triggerWindowLoadJs(),
      window.dispatchEvent(new Event("glozinspeed-allScriptsLoaded"));
  }
  async _loadScriptsFromListJs(e) {
    const t = e.shift();
    return t
      ? (await this._transformScript(t), this._loadScriptsFromListJs(e))
      : Promise.resolve();
  }
  async _transformScript(e) {
    return (
      await this._requestAnimFrame(),
      new Promise((t) => {
        const s = document.createElement("script");
        let n;
        [...e.attributes].forEach((e) => {
          let t = e.nodeName;
          "type" !== t &&
            ("data-glozinlazy-type" === t && ((t = "type"), (n = e.nodeValue)),
            s.setAttribute(t, e.nodeValue));
        }),
          e.hasAttribute("src")
            ? (s.addEventListener("load", t), s.addEventListener("error", t))
            : ((s.text = e.text), t()),
          e.parentNode.replaceChild(s, e);
      })
    );
  }
  async _triggerDOMContentLoadedJs() {
    (this.domReadyFired = !0),
      await this._requestAnimFrame(),
      document.dispatchEvent(new Event("glozinspeed-DOMContentLoaded")),
      await this._requestAnimFrame(),
      window.dispatchEvent(new Event("glozinspeed-DOMContentLoaded")),
      await this._requestAnimFrame(),
      document.dispatchEvent(new Event("glozinspeed-readystatechange")),
      await this._requestAnimFrame(),
      document.glozinonreadystatechange && document.glozinonreadystatechange();
  }
  async _triggerWindowLoadJs() {
    await this._requestAnimFrame(),
      window.dispatchEvent(new Event("glozinspeed-load")),
      await this._requestAnimFrame(),
      window.glozinonload && window.glozinonload(),
      await this._requestAnimFrame(),
      window.dispatchEvent(new Event("glozinspeed-pageshow")),
      await this._requestAnimFrame(),
      window.glozinonpageshow && window.glozinonpageshow();
  }
  async _requestAnimFrame() {
    return new Promise((e) => requestAnimationFrame(e));
  }
  static run() {
    const e = new SlideLazyLoad([
      "keydown",
      "mousemove",
      "touchmove",
      "touchstart",
      "touchend",
      "wheel",
    ]);
    e._addUserInteractionListenerJs(e);
  }
}
SlideLazyLoad.run();

// js for copy button
class CopyButton extends HTMLElement {
  constructor() {
    super();
    this.content = this.dataset.content;
    this.init();
  }
  init() {
    if (this.content) {
      this.addEventListener("click", this.onClick.bind(this));
    }
  }
  onClick() {
    navigator.clipboard.writeText(this.content);
    this.classList.add("copied");
  }
  updateUrl(newContent) {
    this.content = newContent;
  }
}
customElements.define("copy-button", CopyButton);
