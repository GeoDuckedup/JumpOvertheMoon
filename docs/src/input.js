const MOVEMENT_KEYS = Object.freeze({
  ArrowLeft: "left",
  ArrowRight: "right",
});

export class InputController {
  constructor({
    leftButton,
    rightButton,
    actionButton,
    onActionPressed,
    onStartRequested,
    onDirectionPressed,
    onBackPressed,
    onCharacterPressed,
  }) {
    this.leftButton = leftButton;
    this.rightButton = rightButton;
    this.actionButton = actionButton;
    this.onActionPressed = onActionPressed;
    this.onStartRequested = onStartRequested;
    this.onDirectionPressed = onDirectionPressed;
    this.onBackPressed = onBackPressed;
    this.onCharacterPressed = onCharacterPressed;
    this.keyboard = new Set();
    this.pointerControls = new Map();
    this.actionQueued = false;
    this.actionPressCount = 0;

    this.boundKeyDown = (event) => this.#keyDown(event);
    this.boundKeyUp = (event) => this.#keyUp(event);
    this.boundClear = () => this.clear();
    this.boundClearSelection = () => {
      const selection = globalThis.getSelection?.();
      if (selection?.rangeCount) {
        selection.removeAllRanges();
      }
    };

    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
    window.addEventListener("blur", this.boundClear);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.clear();
      }
    });

    this.#bindControl(leftButton, "left");
    this.#bindControl(rightButton, "right");
    this.#bindControl(actionButton, "action");
  }

  get direction() {
    const left =
      this.keyboard.has("left") || this.#pointerHasControl("left");
    const right =
      this.keyboard.has("right") || this.#pointerHasControl("right");
    return Number(right) - Number(left);
  }

  queueAction(source = "test") {
    this.actionQueued = true;
    this.actionPressCount += 1;
    this.onActionPressed?.(source);
  }

  consumeAction() {
    const queued = this.actionQueued;
    this.actionQueued = false;
    return queued;
  }

  clearAction() {
    this.actionQueued = false;
  }

  clear() {
    this.keyboard.clear();
    this.pointerControls.clear();
    this.actionQueued = false;
    this.#syncPressedState();
  }

  getSnapshot() {
    return {
      direction: this.direction,
      left: this.keyboard.has("left") || this.#pointerHasControl("left"),
      right: this.keyboard.has("right") || this.#pointerHasControl("right"),
      actionQueued: this.actionQueued,
      actionPressCount: this.actionPressCount,
      activePointers: this.pointerControls.size,
      directionSwipeEnabled: true,
    };
  }

  #keyDown(event) {
    const target = event.target;
    if (
      target?.matches?.("input, textarea, select") ||
      target?.isContentEditable
    ) {
      return;
    }
    const typedCharacter = event.code.startsWith("Key")
      ? event.code.slice(3)
      : event.code.startsWith("Digit")
        ? event.code.slice(5)
        : "";
    if (
      typedCharacter.length === 1 &&
      !event.repeat &&
      this.onCharacterPressed?.(typedCharacter, "keyboard")
    ) {
      event.preventDefault();
      return;
    }

    const movement = MOVEMENT_KEYS[event.code];
    if (movement) {
      event.preventDefault();
      this.keyboard.add(movement);
      if (!event.repeat) {
        this.onDirectionPressed?.(
          movement === "left" ? -1 : 1,
          "keyboard",
        );
      }
      return;
    }

    if (
      (event.code === "ArrowUp" || event.code === "ArrowDown") &&
      !event.repeat
    ) {
      event.preventDefault();
      this.onDirectionPressed?.(
        event.code === "ArrowDown" ? -1 : 1,
        "keyboard",
      );
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) {
        this.queueAction("keyboard");
      }
      return;
    }

    if (event.code === "Enter" && !event.repeat) {
      event.preventDefault();
      this.onStartRequested?.("keyboard");
      return;
    }

    if (event.code === "KeyR" && !event.repeat) {
      event.preventDefault();
      this.onStartRequested?.("keyboard-r");
      return;
    }

    if (event.code === "Backspace" && !event.repeat) {
      event.preventDefault();
      this.onBackPressed?.("keyboard");
    }
  }

  #keyUp(event) {
    const target = event.target;
    if (
      target?.matches?.("input, textarea, select") ||
      target?.isContentEditable
    ) {
      return;
    }
    const movement = MOVEMENT_KEYS[event.code];
    if (!movement) {
      return;
    }
    event.preventDefault();
    this.keyboard.delete(movement);
  }

  #bindControl(button, control) {
    button.draggable = false;
    const release = (event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      if (!this.pointerControls.has(event.pointerId)) {
        return;
      }
      this.pointerControls.delete(event.pointerId);
      this.#syncPressedState();
    };

    const move = (event) => {
      const activeControl = this.pointerControls.get(event.pointerId);
      if (activeControl !== "left" && activeControl !== "right") {
        return;
      }
      event.preventDefault();
      const nextControl = this.#directionControlAtPoint(
        event.clientX,
        event.clientY,
      );
      if (!nextControl || nextControl === activeControl) {
        return;
      }
      this.pointerControls.set(event.pointerId, nextControl);
      this.onDirectionPressed?.(
        nextControl === "left" ? -1 : 1,
        "touch-swipe",
      );
      this.#syncPressedState();
    };

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.boundClearSelection();
      this.pointerControls.set(event.pointerId, control);
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is a convenience; the control still works without it.
      }
      if (control === "action") {
        this.queueAction("touch");
      } else {
        this.onDirectionPressed?.(
          control === "left" ? -1 : 1,
          "touch",
        );
      }
      this.#syncPressedState();
    });
    button.addEventListener("pointermove", move);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    button.addEventListener("contextmenu", (event) => event.preventDefault());
    button.addEventListener("dragstart", (event) => event.preventDefault());
    button.addEventListener("selectstart", (event) => event.preventDefault());
    const suppressNativeTouch = (event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      this.boundClearSelection();
    };
    button.addEventListener("touchstart", suppressNativeTouch, {
      passive: false,
    });
    button.addEventListener("touchmove", suppressNativeTouch, {
      passive: false,
    });
  }

  #directionControlAtPoint(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    if (element && this.leftButton.contains(element)) {
      return "left";
    }
    if (element && this.rightButton.contains(element)) {
      return "right";
    }
    return null;
  }

  #pointerHasControl(control) {
    return [...this.pointerControls.values()].includes(control);
  }

  #syncPressedState() {
    this.leftButton.dataset.pressed = String(this.#pointerHasControl("left"));
    this.rightButton.dataset.pressed = String(this.#pointerHasControl("right"));
    this.actionButton.dataset.pressed = String(
      this.#pointerHasControl("action"),
    );
  }
}
