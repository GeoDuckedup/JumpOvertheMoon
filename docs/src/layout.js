import {
  DESKTOP_MAX_WIDTH,
  LOGICAL_WIDTH,
} from "./config.js?v=10.2.0";

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isEditableElement = (element) =>
  Boolean(
    element?.matches?.("input, textarea, select") ||
      element?.isContentEditable,
  );

export const resolvePhysicalLandscape = ({
  orientationType,
  screenWidth,
  screenHeight,
  mediaLandscape,
  fallbackWidth,
  fallbackHeight,
} = {}) => {
  if (typeof orientationType === "string") {
    if (orientationType.includes("landscape")) {
      return true;
    }
    if (orientationType.includes("portrait")) {
      return false;
    }
  }
  if (
    Number.isFinite(screenWidth) &&
    Number.isFinite(screenHeight) &&
    screenWidth > 0 &&
    screenHeight > 0 &&
    screenWidth !== screenHeight
  ) {
    return screenWidth > screenHeight;
  }
  if (typeof mediaLandscape === "boolean") {
    return mediaLandscape;
  }
  return Number(fallbackWidth) > Number(fallbackHeight);
};

export class LayoutController {
  constructor({ root, stage, canvas, quality, onChange }) {
    this.root = root;
    this.stage = stage;
    this.canvas = canvas;
    this.quality = quality;
    this.onChange = onChange;
    this.pendingFrame = 0;
    this.state = null;
    this.boundSchedule = () => this.schedule();
  }

  start() {
    document.body.dataset.coarse = String(this.#isCoarsePointer());
    window.addEventListener("resize", this.boundSchedule);
    window.addEventListener("orientationchange", this.boundSchedule);
    document.addEventListener("fullscreenchange", this.boundSchedule);
    document.addEventListener("focusin", this.boundSchedule);
    document.addEventListener("focusout", this.boundSchedule);
    globalThis.visualViewport?.addEventListener("resize", this.boundSchedule);
    globalThis.visualViewport?.addEventListener("scroll", this.boundSchedule);
    globalThis.screen?.orientation?.addEventListener?.(
      "change",
      this.boundSchedule,
    );
    this.measure();
  }

  setQuality(quality) {
    this.quality = quality;
    this.schedule();
  }

  schedule() {
    if (this.pendingFrame) {
      return;
    }
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = 0;
      this.measure();
    });
  }

  measure() {
    const viewport = globalThis.visualViewport;
    const viewportWidth = Math.max(1, Math.round(viewport?.width || window.innerWidth));
    const viewportHeight = Math.max(1, Math.round(viewport?.height || window.innerHeight));
    this.root.style.setProperty("--app-height", `${viewportHeight}px`);
    this.root.style.setProperty(
      "--desktop-fit-width",
      `${Math.max(1, (viewportHeight - 32) * 0.675)}px`,
    );

    const rect = this.stage.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width);
    const cssHeight = Math.max(1, rect.height);
    const logicalHeight = Math.max(1, Math.round((LOGICAL_WIDTH * cssHeight) / cssWidth));
    const deviceDpr = window.devicePixelRatio || 1;
    const effectiveDpr = Math.min(deviceDpr, this.quality.dprCap);
    const backingWidth = Math.max(1, Math.round(cssWidth * effectiveDpr));
    const backingHeight = Math.max(1, Math.round(cssHeight * effectiveDpr));

    if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
    }

    const scale = backingWidth / LOGICAL_WIDTH;
    const computed = getComputedStyle(this.stage);
    const safeArea = {
      top: toNumber(computed.getPropertyValue("--safe-top")),
      right: toNumber(computed.getPropertyValue("--safe-right")),
      bottom: toNumber(computed.getPropertyValue("--safe-bottom")),
      left: toNumber(computed.getPropertyValue("--safe-left")),
    };
    const fullscreen = Boolean(document.fullscreenElement);
    const coarsePointer = this.#isCoarsePointer();
    const editableFocused = isEditableElement(document.activeElement);
    const orientationLandscape = resolvePhysicalLandscape({
      orientationType: globalThis.screen?.orientation?.type,
      screenWidth: Number(globalThis.screen?.width),
      screenHeight: Number(globalThis.screen?.height),
      mediaLandscape:
        globalThis.matchMedia?.("(orientation: landscape)").matches,
      fallbackWidth: window.innerWidth,
      fallbackHeight: window.innerHeight,
    });
    const desktopFramed =
      !fullscreen &&
      this.#isFinePointer() &&
      viewportWidth >= 700 &&
      viewportWidth / viewportHeight >= 4 / 3;
    const orientationBlocked =
      coarsePointer && orientationLandscape && !editableFocused;

    this.state = Object.freeze({
      viewportWidth,
      viewportHeight,
      cssWidth: Math.round(cssWidth * 100) / 100,
      cssHeight: Math.round(cssHeight * 100) / 100,
      logicalWidth: LOGICAL_WIDTH,
      logicalHeight,
      backingWidth,
      backingHeight,
      deviceDpr,
      effectiveDpr,
      scale,
      safeArea: Object.freeze(safeArea),
      desktopMaxWidth: DESKTOP_MAX_WIDTH,
      desktopFramed,
      editableFocused,
      keyboardOpen: coarsePointer && editableFocused,
      orientationLandscape,
      orientationBlocked,
      fullscreen,
    });
    this.onChange?.(this.state);
  }

  #isCoarsePointer() {
    return globalThis.matchMedia?.("(pointer: coarse)").matches ?? false;
  }

  #isFinePointer() {
    return globalThis.matchMedia?.("(pointer: fine)").matches ?? true;
  }
}
