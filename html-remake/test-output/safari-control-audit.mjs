import assert from "node:assert/strict";
import { InputController } from "../src/input.js";

class MockTarget {
  constructor(name) {
    this.name = name;
    this.dataset = {};
    this.listeners = new Map();
    this.draggable = true;
  }

  addEventListener(name, handler) {
    this.listeners.set(name, handler);
  }

  contains(candidate) {
    return candidate === this;
  }

  setPointerCapture() {}
}

const windowTarget = new MockTarget("window");
const documentTarget = new MockTarget("document");
documentTarget.hidden = false;
globalThis.window = windowTarget;
globalThis.document = documentTarget;

const left = new MockTarget("left");
const right = new MockTarget("right");
const action = new MockTarget("action");
let hitTarget = left;
documentTarget.elementFromPoint = () => hitTarget;
const navigation = [];
const typedCharacters = [];
const input = new InputController({
  leftButton: left,
  rightButton: right,
  actionButton: action,
  onDirectionPressed: (direction, source) =>
    navigation.push([direction, source]),
  onCharacterPressed: (character) => {
    typedCharacters.push(character);
    return true;
  },
});

assert(
  !documentTarget.listeners.has("selectionchange"),
  "Native text selection must not be cleared at the document level.",
);

const pointerEvent = (pointerId = 1) => ({
  pointerId,
  clientX: 10,
  clientY: 10,
  preventDefault() {},
});

left.listeners.get("pointerdown")(pointerEvent());
assert.equal(input.direction, -1);
assert.deepEqual(navigation.at(-1), [-1, "touch"]);

hitTarget = right;
left.listeners.get("pointermove")(pointerEvent());
assert.equal(input.direction, 1);
assert.deepEqual(navigation.at(-1), [1, "touch-swipe"]);

left.listeners.get("pointerup")(pointerEvent());
assert.equal(input.direction, 0);

let typingPrevented = false;
windowTarget.listeners.get("keydown")({
  code: "KeyD",
  repeat: false,
  preventDefault: () => {
    typingPrevented = true;
  },
});
assert.deepEqual(typedCharacters, ["D"]);
assert(typingPrevented);

windowTarget.listeners.get("keydown")({
  code: "KeyR",
  repeat: false,
  target: {
    matches: () => true,
    isContentEditable: false,
  },
  preventDefault: () => {
    throw new Error("Native initials input was intercepted.");
  },
});
assert.deepEqual(typedCharacters, ["D"]);

for (const control of [left, right, action]) {
  assert.equal(control.draggable, false);
  for (const eventName of [
    "contextmenu",
    "dragstart",
    "selectstart",
    "touchstart",
    "touchmove",
  ]) {
    let prevented = false;
    control.listeners.get(eventName)({
      cancelable: true,
      preventDefault: () => {
        prevented = true;
      },
    });
    assert(prevented, `${control.name} ${eventName} was not prevented`);
  }
}

console.log(
  JSON.stringify({
    heldDirection: true,
    swipeDirectionSwitch: true,
    directInitialsKeyRouting: true,
    nativeInputTypingNotIntercepted: true,
    nativeInputSelectionPreserved: true,
    nativeContextDragSelectionAndTouchPrevented: true,
  }),
);
