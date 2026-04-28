class MotionElement extends HTMLElement {
  constructor() {
    super();
  }
  connectedCallback() {
    if (this.isHold) return;
    this.preInitialize();
    if (this.dataset.noview) {
      return;
    }
    if (!this.isConnected || !document.body.contains(this)) {
      setTimeout(() => {
        this.connectedCallback();
      }, 100);
      return;
    }

    var _this = this;
    let custom_margin = this.dataset.margin || "0px 0px -5px 0px";
    let rootElement = {};
    if (this.dataset.parent) {
      var parent = this.closest(`.${this.dataset.parent}`);
      rootElement = { root: parent };
      custom_margin = "0px 0px 0px 0px";
    }
    Motion.inView(
      _this,
      async () => {
        if (
          !this.isInstant &&
          this.mediaElements &&
          this.hasAttribute("data-image")
        ) {
          await imageReady(this.mediaElements);
        }
        setTimeout(() => {
          _this.initialize();
        }, 50);
      },
      { margin: custom_margin, ...rootElement },
    );
  }

  get isHold() {
    return this.hasAttribute("hold");
  }

  get slideElement() {
    return this.hasAttribute("slideshow") ? true : false;
  }

  get Transition() {
    let transition = this.getAttribute("data-transition")
      ?.split(",")
      .map(Number);
    return transition || [0.22, 0.61, 0.36, 1];
  }

  get isInstant() {
    return this.hasAttribute("data-instantly");
  }

  get mediaElements() {
    return Array.from(this.querySelectorAll("img, iframe, svg"));
  }

  get animationType() {
    return this.dataset.motion || "fade-up";
  }

  get animationDelay() {
    return parseInt(this.dataset.motionDelay || 0) / 1000;
  }

  set animationDelay(value) {
    this.dataset.motionDelay = value;
  }

  get delayLoad() {
    return this.classList.contains("animate-delay");
  }

  preInitialize() {
    if (window.innerWidth < 768 && !this.slideElement) return;
    if (this.isHold) return;
    switch (this.animationType) {
      case "fade-in":
        Motion.animate(this, { opacity: 0 }, { duration: 0 });
        break;
      case "fade-in-left":
        Motion.animate(
          this,
          { transform: "translateX(-10rem)", opacity: 0 },
          { duration: 0 },
        );
        break;
      case "highlighted-text":
        const svg = this.querySelectorAll("svg");
        svg.forEach((el) => {
          el.classList.remove("animate");
        });
        break;
      case "fade-in-right":
        Motion.animate(
          this,
          { transform: "translateX(10rem)", opacity: 0 },
          { duration: 0 },
        );
        break;
      case "fade-up":
        Motion.animate(
          this,
          { transform: "translateY(2.5rem)", opacity: 0 },
          { duration: 0 },
        );
        break;

      case "fade-up-sm":
        Motion.animate(
          this,
          { transform: "translateY(1rem)", opacity: 0 },
          { duration: 0 },
        );
        break;

      case "fade-up-lg":
        Motion.animate(
          this,
          { transform: "translateY(3rem)", opacity: 0 },
          { duration: 0 },
        );
        break;
      case "fade-down":
        Motion.animate(
          this,
          { transform: "translateY(-2.5rem)", opacity: 0 },
          { duration: 0 },
        );
        break;  
      case "zoom-in":
        Motion.animate(this, { transform: "scale(0.8)", opacity: 0 }, { duration: 0 });
        break;
      case "zoom-in-lg":
        Motion.animate(this, { transform: "scale(0)", opacity: 0 }, { duration: 0 });
        break;

      case "zoom-out":
        Motion.animate(this, { transform: "scale(1.07)", opacity: 0 }, { duration: 0 });
        break;

      case "zoom-out-sm":
        Motion.animate(this, { transform: "scale(1.07)", opacity: 0 }, { duration: 0 });
        break;
      case "zoom-out-lg":
        Motion.animate(this, { transform: "scale(1.07)", opacity: 0 }, { duration: 0 });
        break;
    }
  }

  async initialize() {
    if (window.innerWidth < 768 && !this.slideElement) return;
    if (this.delayLoad) return;
    if (this.isHold) return;
    switch (this.animationType) {
      case "fade-in":
        await Motion.animate(
          this,
          { opacity: 1 },
          {
            duration: 0.45,
            delay: this.animationDelay,
            easing: this.transition || "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ).finished;
        break;
      case "fade-in-left":
        await Motion.animate(
          this,
          { transform: "translateX(0)", opacity: 1 },
          {
            duration: 0.7,
            delay: this.animationDelay,
            easing: this.transition || "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ).finished;
        break;
      case "fade-in-right":
        await Motion.animate(
          this,
          { transform: "translateX(0)", opacity: 1 },
          {
            duration: 0.7,
            delay: this.animationDelay,
            easing: this.transition || "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ).finished;
        break;
      case "highlighted-text":
        await this.highlightedText();
        break;
      case "fade-up":
        await Motion.animate(
          this,
          { transform: "translateY(0)", opacity: 1 },
          {
            duration: 0.5,
            delay: this.animationDelay,
            easing: this.transition || "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ).finished;
        break;

      case "fade-up-sm":
        await Motion.animate(
          this,
          { transform: "translateY(0)", opacity: 1 },
          {
            duration: 0.3,
            delay: this.animationDelay,
            easing: this.transition || "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ).finished;
        break;

      case "fade-up-lg":
        await Motion.animate(
          this,
          { transform: "translateY(0)", opacity: 1 },
          {
            duration: 0.5,
            delay: this.animationDelay,
            easing: this.transition || "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ).finished;
        break;
      case "fade-down":
        await Motion.animate(
          this,
          { transform: "translateY(0)", opacity: 1 },
          {
            duration: 0.5,
            delay: this.animationDelay,
            easing: this.transition || "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ).finished;
        break;
  
      case "zoom-in":
        await Motion.animate(
          this,
          { transform: "scale(1)", opacity: 1  },
          {
            duration: 1.3,
            delay: this.animationDelay,
            easing: this.transition,
          },
        ).finished;
        break;

      case "zoom-in-lg":
        await Motion.animate(
          this,
          { transform: "scale(1)", opacity: 1  },
          {
            duration: 0.5,
            delay: this.animationDelay,
            easing: this.transition,
          },
        ).finished;
        break;

      case "zoom-out":
        await Motion.animate(
          this,
          { transform: "scale(1)", opacity: 1  },
          {
            duration: 1.5,
            delay: this.animationDelay,
            easing: this.transition,
          },
        ).finished;
        break;

      case "zoom-out-sm":
        await Motion.animate(
          this,
          { transform: "scale(1)", opacity: 1  },
          { duration: 1, delay: this.animationDelay, easing: this.transition },
        ).finished;
        break;
      case "zoom-out-lg":
        await Motion.animate(
          this,
          { transform: "scale(1)", opacity: 1  },
          { duration: 1, delay: this.animationDelay, easing: this.transition },
        ).finished;
        break;
    }
    if (this.slideElement) {
      this.classList.add("animate-delay");
    }
  }
  refreshAnimation() {
    this.removeAttribute("hold");
    this.preInitialize();
    setTimeout(() => {
      this.initialize();
    }, 50); // Delay a bit to make animation re init properly.
  }

  highlightedText() {
    const svg = this.querySelectorAll("svg");
    svg.forEach((el) => {
      el.classList.add("animate");
    });
  }
}
customElements.define("motion-element", MotionElement);

class MotionItemsEffect extends HTMLElement {
  constructor() {
    super();
    this.init();
  }

  init() {
    this.setupInitialAnimation();
    this.setupInViewEffect();
  }

  get allItems() {
    return this.querySelectorAll(".motion-item");
  }

  get visibleItems() {
    const items = Array.from(this.allItems).filter((item) => {
      if (!(item instanceof HTMLElement)) return false;
      return item.offsetParent !== null || item.getClientRects().length > 0;
    });
    return items.length ? items : this.allItems;
  }

  get animationType() {
    return this.dataset.motion || "fade-up";
  }

  get slideElement() {
    return this.hasAttribute("slideshow");
  }

  setupInitialAnimation() {
    if (window.innerWidth < 768 && !this.slideElement) {
      return;
    }
    this.prepareAnimationEffect(this.allItems);
  }

  prepareAnimationEffect(items = this.allItems) {
    if (window.innerWidth < 768 && !this.slideElement) {
      return;
    }
    switch (this.animationType) {
      case "fade-in":
        this.fadeInInit(items);
        break;
      case "fade-in-left":
        this.fadeInLeftInit(items);
        break;
      case "fade-in-right":
        this.fadeInRightInit(items);
        break;
      case "fade-up":
        this.fadeUpInit(items);
        break;
      case "fade-down":
        this.fadeDownInit(items);
        break;
      case "fade-up-lg":
        this.fadeUpLgInit(items);
        break;
      case "zoom-in":
        this.zoomInInit(items);
        break;
      case "zoom-out":
        this.zoomOutInit(items);
        break;
    }
  }

  fadeInInit(items = this.allItems) {
    Motion.animate(
      items,
      {
        opacity: 0,
      },
      {
        duration: 0,
      },
    );
  }

  zoomInInit(items = this.allItems) {
    Motion.animate(
      items,
      {
        opacity: 0,
        scale: 0.8,
      },
      {
        duration: 0,
      },
    );
  }

  zoomOutInit(items = this.allItems) {
    Motion.animate(
      items,
      {
        opacity: 0,
        scale: 1.07,
      },
      {
        duration: 0,
      },
    );
  }

  fadeUpInit(items = this.allItems) {
    Motion.animate(
      items,
      {
        y: 40,
        opacity: 0,
      },
      {
        duration: 0,
      },
    );
  }

  fadeDownInit(items = this.allItems) {
    Motion.animate(
      items,
      {
        y: -40,
        opacity: 0,
      },
      {
        duration: 0,
      },
    );
  }

  fadeInLeftInit(items = this.allItems) {
    Motion.animate(
      items,
      {
        x: -40,
        opacity: 0,
      },
      {
        duration: 0,
      },
    );
  }

  fadeInRightInit(items = this.allItems) {
    Motion.animate(
      items,
      {
        x: 40,
        opacity: 0,
      },
      {
        duration: 0,
      },
    );
  }

  fadeUpLgInit(items = this.allItems) {
    Motion.animate(
      items,
      {
        y: 20,
        opacity: 0,
        visibility: "hidden",
      },
      {
        duration: 0,
      },
    );
  }

  setupInViewEffect() {
    if (this.slideElement) {
      return;
    }
    if (window.innerWidth < 768 && !this.slideElement) {
      return;
    }
    Motion.inView(this, this.animateItems.bind(this), {
      margin: "0px 0px -15px 0px",
    });
  }

  animateItems() {
    switch (this.animationType) {
      case "fade-in":
        this.fadeIn();
        break;
      case "fade-in-left":
        this.fadeInLeft();
        break;
      case "fade-in-right":
        this.fadeInRight();
        break;
      case "fade-up":
        this.fadeUp();
        break;
      case "fade-down":
        this.fadeDown();
        break;
      case "fade-up-lg":
        this.fadeUpLg();
        break;
      case "zoom-in":
        this.zoomIn();
        break;
      case "zoom-out":
        this.zoomOut();
        break;
    }
  }

  fadeIn() {
    Motion.animate(
      this.allItems,
      {
        opacity: [0, 1],
      },
      {
        duration: 0.4,
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  fadeUp() {
    Motion.animate(
      this.allItems,
      {
        y: [40, 0],
        opacity: [0, 1],
      },
      {
        duration: 0.5,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  fadeDown() {
    Motion.animate(
      this.allItems,
      {
        y: [-40, 0],
        opacity: [0, 1],
      },
      {
        duration: 0.5,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  fadeInLeft() {
    Motion.animate(
      this.allItems,
      {
        x: [-40, 0],
        opacity: [0, 1],
      },
      {
        duration: 0.7,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  fadeInRight() {
    Motion.animate(
      this.allItems,
      {
        x: [40, 0],
        opacity: [0, 1],
      },
      {
        duration: 0.7,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  fadeUpLg() {
    Motion.animate(
      this.allItems,
      {
        y: [20, 0],
        opacity: [0, 1],
        visibility: ["hidden", "visible"],
      },
      {
        duration: 0.6,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  zoomIn() {
    Motion.animate(
      this.allItems,
      {
        opacity: [0, 1],
        scale: [0.8, 1],
      },
      {
        duration: 0.6,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  zoomOut() {
    Motion.animate(
      this.allItems,
      {
        opacity: [0, 1],
        scale: [1.07, 1],
      },
      {
        duration: 1.5,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  reloadAnimationEffect() {
    switch (this.animationType) {
      case "fade-in":
        this.fadeInReload();
        break;
      case "fade-in-left":
        this.fadeInLeftReload();
        break;
      case "fade-in-right":
        this.fadeInRightReload();
        break;
      case "fade-up":
        this.fadeUpReload();
        break;
      case "fade-down":
        this.fadeDownReload();
        break;
      case "fade-up-lg":
        this.fadeUpLgReload();
        break;
      case "zoom-in":
        this.zoomInReload();
        break;
      case "zoom-out":
        this.zoomOutReload();
        break;
    }
  }

  refreshAnimationEffect() {
    const host = this.closest("slide-section, slideshow-section");
    if (host?.dataset?.slideMotionHost !== "true") {
      return;
    }
    this.prepareAnimationEffect(this.visibleItems);
    setTimeout(() => {
      this.reloadAnimationEffect();
    }, 50);
  }

  fadeInReload() {
    Motion.animate(
      this.visibleItems,
      {
        opacity: [0, 1],
      },
      {
        duration: 0.4,
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  fadeUpReload() {
    Motion.animate(
      this.visibleItems,
      {
        y: [40, 0],
        opacity: [0, 1],
      },
      {
        duration: 0.5,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  fadeDownReload() {
    Motion.animate(
      this.visibleItems,
      {
        y: [-40, 0],
        opacity: [0, 1],
      },
      {
        duration: 0.5,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  fadeInLeftReload() {
    Motion.animate(
      this.visibleItems,
      {
        x: [-40, 0],
        opacity: [0, 1],
      },
      {
        duration: 0.7,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  fadeInRightReload() {
    Motion.animate(
      this.visibleItems,
      {
        x: [40, 0],
        opacity: [0, 1],
      },
      {
        duration: 0.7,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  fadeUpLgReload() {
    Motion.animate(
      this.visibleItems,
      {
        y: [20, 0],
        opacity: [0, 1],
        visibility: ["hidden", "visible"],
      },
      {
        duration: 0.6,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  zoomInReload() {
    Motion.animate(
      this.visibleItems,
      {
        opacity: [0, 1],
        scale: [0.8, 1],
      },
      {
        duration: 0.6,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }

  zoomOutReload() {
    Motion.animate(
      this.visibleItems,
      {
        opacity: [0, 1],
        scale: [1.07, 1],
      },
      {
        duration: 1.5,
        delay: Motion.stagger(0.15),
        easing: [0.22, 0.61, 0.36, 1],
      },
    ).finished;
  }
}
customElements.define("motion-items-effect", MotionItemsEffect);
