class SlideshowSection extends HTMLElement {
  constructor() {
    super();
    this.globalSlide = null;
    this.init();
  }
  init() {
    const isHome = document.body.classList.contains("index");
    const isLazy = this.classList.contains("lazy-loading-swiper-before");

    if (!isHome) return this.initSlide();

    const pos = window.pageYOffset;
    if (pos > 0 || document.body.classList.contains("swiper-lazy") || isLazy) {
      this.initSlide();
    } else {
      this.classList.add("lazy-loading-swiper-after");
    }
  }
  getData() {
    const d = this.dataset;
    return {
      autoplay: d.autoplay === "true",
      loop: d.loop === "true",
      desktop: +d.desktop || 4,
      tablet: +d.tablet || null,
      mobile: +d.mobile || 1,
      direction: d.direction || "horizontal",
      autoplaySpeed: (+d.autoplaySpeed || 3) * 1000,
      speed: +d.speed || 400,
      effect: d.effect || "slide",
      row: +d.row || 1,
      spacing: +d.spacing || 30,
      progressbar: d.paginationProgressbar === "true",
      autoItem: d.itemMobile === "true",
      autoHeight: d.autoHeight === "true",
      customPagination: d.customPagination,
      slideShow: d.slideshow === "true",
      reveal: d.revealSlideshow === "true",
      centered: d.centeredSlides,
      customNav: d.customNavigation === "true",
      prev: d.customPrev,
      next: d.customNext,
    };
  }
  initSlide() {
    const el = this;
    const data = this.getData();

    const itemTablet =
      data.tablet ?? (data.desktop < 2 ? 1 : data.desktop < 3 ? 2 : 3);

    const autoplay = data.autoplay ? { delay: data.autoplaySpeed } : false;

    const centeredSlides =
      data.centered === undefined
        ? data.slideShow && data.desktop === 1.5
        : data.centered === "true";

    const baseOption = {
      slidesPerView: data.autoItem ? "auto" : data.mobile,
      spaceBetween: Math.min(data.spacing, 15),
      autoplay,
      direction: data.direction,
      loop: data.loop,
      effect: data.effect,
      autoHeight: data.autoHeight,
      speed: data.speed,
      centeredSlides,
      grid: { rows: data.row, fill: "row" },
      navigation: this.getNavigation(data),
      pagination: this.getPagination(data),
      breakpoints: {
        768: {
          slidesPerView: itemTablet,
          spaceBetween:
            data.effect === "parallax" ? 0 : Math.min(data.spacing, 30),
          centeredSlides: false,
        },
        1025: {
          slidesPerView: data.desktop,
          spaceBetween: data.effect === "parallax" ? 0 : data.spacing,
          centeredSlides,
        },
      },
      on: this.getEvents(data),
    };
    const option =
      data.effect === "parallax"
        ? {
            ...baseOption,
            speed: 1100,
            spaceBetween: 0,
            parallax: true,
            mousewheel: false,
          }
        : baseOption;

    this.globalSlide = new Swiper(el, option);
  }
  getNavigation(data) {
    return {
      nextEl: data.customNav
        ? document.querySelector(`.${data.next}`)
        : this.querySelector(".swiper-button-next"),
      prevEl: data.customNav
        ? document.querySelector(`.${data.prev}`)
        : this.querySelector(".swiper-button-prev"),
    };
  }

  getPagination(data) {
    return {
      clickable: true,
      el: data.customPagination
        ? this.querySelector(`.${data.customPagination}`)
        : this.querySelector(".parent-pagination") ||
          this.querySelector(".swiper-pagination"),
      type: data.progressbar ? "progressbar" : "bullets",
    };
  }

  getEvents(data) {
    const el = this;

    return {
      init(swiper) {
        if (data.autoplay) {
          swiper.autoplay.stop();
          Motion.inView(el, () => swiper.autoplay.start(), {
            margin: "0px 0px -50px 0px",
          });
        }

        if (data.effect === "parallax") {
          swiper.slides.forEach((slide) => {
            const inner = slide.querySelector(".banner__media");
            if (inner) {
              inner.setAttribute("data-swiper-parallax", 0.75 * swiper.width);
            }
          });
        }

        const videos = el.querySelectorAll("video[data-src]");
        if (!videos.length) return;

        new IntersectionObserver((entries, obs) => {
          if (!entries[0].isIntersecting) return;
          obs.disconnect();

          videos.forEach((v) => {
            v.src = v.dataset.src;
            v.removeAttribute("data-src");
          });
        }).observe(el);
      },

      slideChangeTransitionStart() {
        if (!data.slideShow) return;

        this.slides[this.activeIndex]
          .querySelectorAll("motion-element")
          .forEach((m) => m.preInitialize());
      },

      slideChangeTransitionEnd() {
        if (!data.slideShow) return;

        this.slides[this.activeIndex]
          .querySelectorAll("motion-element")
          .forEach((m) => {
            m.classList.remove("animate-delay");
            m.initialize();
          });
      },

      afterInit(swiper) {
        if (data.slideShow && data.reveal && data.desktop <= 3) {
          el.duplicateSlides(swiper);
        }
      },
    };
  }

  duplicateSlides(swiper) {
    const wrapper = this.querySelector(".swiper-wrapper");
    const slides = wrapper.querySelectorAll(".swiper-slide");

    slides.forEach((s) => {
      const clone = s.cloneNode(true);
      clone.classList.add("swiper-slide-duplicate");
      wrapper.appendChild(clone);
    });

    swiper.update();
  }
}

customElements.define("slideshow-section", SlideshowSection);
