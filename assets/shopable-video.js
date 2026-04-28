// js for shopable video
class ShopableVideo extends PopupBase {
  constructor() {
    super();
    this.popupDiv = this.querySelector(".video-item__popup");
    this.init();
  }
  init() {
    if (this.popupDiv || !this.classList.contains("instagram-item")) {
      window.addEventListener("resize", this.responsive.bind(this));
      window.addEventListener("load", this.responsive.bind(this));
      this.addEventListener("click", this.onClick.bind(this));
      this.connectedCallback();
    }
  }
  onClick() {
    const template = this.closest(".shopable-video-section").querySelector(
      "template"
    );
    if (template) {
      const content =
        template.content.firstElementChild.cloneNode(true).outerHTML;
      const nav = `<div class="swiper-arrow swiper-prev-modal transition swiper-button-prev bg-white btn-hover inline-flex content-center border rounded-50 overflow-hidden">
            <svg width="6" height="11" fill="none">
              <use href="#icon-back"></use>
            </svg>
          </div>
          <div class="swiper-arrow swiper-next-modal transition swiper-button-next bg-white btn-hover inline-flex content-center border rounded-50 overflow-hidden">
            <svg width="6" height="11" fill="none">
              <use href="#icon-next"></use>
            </svg>
          </div>`;
      this.initPopup(content, nav);
      this.findActiveSlideModal();
      const modal = this.modal;
      if (!modal) return;
      const productPopupDiv = modal.modalBoxContent.querySelectorAll(
        ".video-item__product-mobile"
      );
      if (productPopupDiv.length > 0){
        productPopupDiv.forEach((div) => {
          div.addEventListener(
            "click",
            this.onClickMobile.bind(this)
          );
        });
      }
    }
  }

  findActiveSlideModal() {
    const modal = this.modal;
    if (!modal) return;
    const swiperContainer = modal.modalBoxContent.querySelector(
      "slide-section-popup"
    );
    if (!swiperContainer) return;
    const position = this.dataset.position;
    if (!position) return;
    if (position !== null && !isNaN(parseInt(position))) {
      const slideIndex = parseInt(position);
      swiperContainer.swiper.slideTo(slideIndex, 0, false);
    } else {
      swiperContainer.swiper.slideTo(0, 0, false);
    }
  }

  onCloseEvent() {
    const popup = document.querySelector(".tingle-modal.shopable-video");
    if (!popup) return;
    const productInformation = popup.querySelector(
      ".shopable-video__product-information"
    );
    if (!productInformation) return;
    productInformation.classList.add("hidden");
  }
  connectedCallback() {
    const handleIntersection = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.unobserve(this);
      const videos = this.querySelectorAll("video");
      videos.forEach((video) => {
        const dataSrc = video.dataset.src;
        if (dataSrc) {
          video.src = dataSrc;
          video.removeAttribute("data-src");
        }
      });
    };

    new IntersectionObserver(handleIntersection.bind(this), {
      rootMargin: "0px 0px 200px 0px",
    }).observe(this);
  }
  responsive() {
    const productDivs = document.querySelectorAll(
      ".shopable-video__product-information"
    );
    if (productDivs.length != 0) {
      if (window.innerWidth >= 768) {
        const flexDiv = this.popupDiv?.querySelector(
          ".video-item__popup--flex"
        );
        if (!flexDiv) return;
        productDivs.forEach((div) => {
          div.classList.remove("hidden");
        });
      } else {
        const flexDiv = this.popupDiv?.querySelector(
          ".video-item__popup--flex"
        );
        if (!flexDiv) return;
        productDivs.forEach((div) => {
          div.classList.add("hidden");
        });
      }
    }
  }
  onClickMobile(event) {
    const _this = this;
    const currentTarget = event.currentTarget;
    const popup = currentTarget.closest(".video-item__popup");
    if (!popup) return;
    const productInformation = popup.querySelector(
      ".shopable-video__product-information"
    );
    if (!productInformation) return;
    const slidePopup = document.querySelector("slide-section-popup");
    slidePopup.swiper.allowTouchMove = false;
    slidePopup.swiper.unsetGrabCursor();
    productInformation.classList.remove("hidden");
    popup.classList.add("open");
    _this.modal.modalCloseBtn.style.display = "none";
  }
}
customElements.define("shopable-video", ShopableVideo);

class SlideSectionPopup extends SlideSection {
  constructor() {
    super();
  }
}
customElements.define("slide-section-popup", SlideSectionPopup);

class ShopableOverlay extends ShopableVideo {
  constructor() {
    super();
    this.addEventListener("click", this.onClick.bind(this));
  }

  onClick(event) {
    const currentTarget = event.currentTarget;
    const modal = currentTarget.closest(".shopable-video");
    const popup = currentTarget?.closest(".video-item__popup");
    if (!popup) return;
    const productInformation = popup.querySelector(
      ".shopable-video__product-information"
    );
    const modalCloseBtn = modal?.querySelector(".tingle-modal__close");
    if (!productInformation) return;
    const slidePopup = document.querySelector("slide-section-popup");
    slidePopup.swiper.allowTouchMove = true;
    slidePopup.swiper.setGrabCursor();
    productInformation.classList.add("hidden");
    popup.classList.remove("open");
    modalCloseBtn.removeAttribute("style");
  }
}
customElements.define("shopable-overlay", ShopableOverlay);

class ButtonCloseShopable extends ShopableOverlay {
  constructor() {
    super();
    this.addEventListener("click", this.onClick.bind(this));
  }
}
customElements.define("button-close-shopable", ButtonCloseShopable);