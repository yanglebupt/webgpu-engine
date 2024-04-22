import { Vec2, vec2 } from "wgpu-matrix";

/* The controller can register callbacks for various events on a canvas:
 *
 * mousemove: function(prevMouse, curMouse, evt)
 *     receives both regular mouse events, and single-finger drags (sent as a left-click),
 *
 * press: function(curMouse, evt)
 *     receives mouse click and touch start events
 *
 * wheel: function(amount)
 *     mouse wheel scrolling
 *
 * pinch: function(amount)
 *     two finger pinch, receives the distance change between the fingers
 *
 * twoFingerDrag: function(dragVector)
 *     two finger drag, receives the drag movement amount
 */
export type MousePoint = [number, number];
export interface BtnEvent extends UIEvent {
  buttons?: number;
}
export default class Controller {
  public mousemove:
    | ((prevMouse: MousePoint, curMouse: MousePoint, evt: BtnEvent) => void)
    | null = null;
  public press: ((curMouse: MousePoint, evt: BtnEvent) => void) | null = null;
  public wheel: ((amount: number) => void) | null = null;
  public twoFingerDrag: ((dragVector: Vec2) => void) | null = null;
  public pinch: ((amount: number) => void) | null = null;

  registerForCanvas(canvas: HTMLCanvasElement) {
    let prevMouse: MousePoint;
    canvas.addEventListener("mousemove", (evt) => {
      evt.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const curMouse = [
        evt.clientX - rect.left,
        evt.clientY - rect.top,
      ] as MousePoint;
      if (!prevMouse) {
        prevMouse = [
          evt.clientX - rect.left,
          evt.clientY - rect.top,
        ] as MousePoint;
      } else if (this.mousemove) {
        this.mousemove(prevMouse, curMouse, evt);
      }
      prevMouse = curMouse;
    });

    canvas.addEventListener("mousedown", (evt) => {
      evt.preventDefault();
      let rect = canvas.getBoundingClientRect();
      let curMouse = [
        evt.clientX - rect.left,
        evt.clientY - rect.top,
      ] as MousePoint;
      if (this.press) {
        this.press(curMouse, evt);
      }
    });

    canvas.addEventListener("wheel", (evt) => {
      evt.preventDefault();
      if (this.wheel) {
        this.wheel(-evt.deltaY);
      }
    });

    canvas.oncontextmenu = function (evt) {
      evt.preventDefault();
    };

    const touches: Record<number, MousePoint> = {};
    canvas.addEventListener("touchstart", (evt) => {
      const rect = canvas.getBoundingClientRect();
      evt.preventDefault();
      for (let i = 0; i < evt.changedTouches.length; ++i) {
        const t = evt.changedTouches[i];
        touches[t.identifier] = [t.clientX - rect.left, t.clientY - rect.top];
        if (evt.changedTouches.length == 1 && this.press) {
          this.press(touches[t.identifier], evt);
        }
      }
    });

    canvas.addEventListener("touchmove", (evt) => {
      evt.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const numTouches = Object.keys(touches).length;
      // Single finger to rotate the camera
      if (numTouches == 1) {
        if (this.mousemove) {
          const t = evt.changedTouches[0];
          const prevTouch = touches[t.identifier];
          const curTouch = [
            t.clientX - rect.left,
            t.clientY - rect.top,
          ] as MousePoint;
          (evt as BtnEvent).buttons = 1;
          this.mousemove(prevTouch, curTouch, evt);
        }
      } else {
        const curTouches: Record<number, MousePoint> = {};
        for (let i = 0; i < evt.changedTouches.length; ++i) {
          let t = evt.changedTouches[i];
          curTouches[t.identifier] = [
            t.clientX - rect.left,
            t.clientY - rect.top,
          ];
        }

        // If some touches didn't change make sure we have them in
        // our curTouches list to compute the pinch distance
        // Also get the old touch points to compute the distance here
        let oldTouches = [];
        for (const t in touches) {
          if (!(t in curTouches)) {
            curTouches[t] = touches[t];
          }
          oldTouches.push(touches[t]);
        }

        let newTouches = [];
        for (const t in curTouches) {
          newTouches.push(curTouches[t]);
        }

        // Determine if the user is pinching or panning
        let motionVectors = [
          vec2.set(
            newTouches[0][0] - oldTouches[0][0],
            newTouches[0][1] - oldTouches[0][1]
          ),
          vec2.set(
            newTouches[1][0] - oldTouches[1][0],
            newTouches[1][1] - oldTouches[1][1]
          ),
        ];
        let motionDirs = [vec2.create(), vec2.create()];
        vec2.normalize(motionDirs[0], motionVectors[0]);
        vec2.normalize(motionDirs[1], motionVectors[1]);

        let pinchAxis = vec2.set(
          oldTouches[1][0] - oldTouches[0][0],
          oldTouches[1][1] - oldTouches[0][1]
        );
        vec2.normalize(pinchAxis, pinchAxis);

        let panAxis = vec2.lerp(motionVectors[0], motionVectors[1], 0.5);
        vec2.normalize(panAxis, panAxis);

        let pinchMotion = [
          vec2.dot(pinchAxis, motionDirs[0]),
          vec2.dot(pinchAxis, motionDirs[1]),
        ];
        let panMotion = [
          vec2.dot(panAxis, motionDirs[0]),
          vec2.dot(panAxis, motionDirs[1]),
        ];

        // If we're primarily moving along the pinching axis and in the opposite direction with
        // the fingers, then the user is zooming.
        // Otherwise, if the fingers are moving along the same direction they're panning
        if (
          this.pinch &&
          Math.abs(pinchMotion[0]) > 0.5 &&
          Math.abs(pinchMotion[1]) > 0.5 &&
          Math.sign(pinchMotion[0]) != Math.sign(pinchMotion[1])
        ) {
          // Pinch distance change for zooming
          let oldDist = vec2.distance(oldTouches[0], oldTouches[1]);
          let newDist = vec2.distance(newTouches[0], newTouches[1]);
          this.pinch(newDist - oldDist);
        } else if (
          this.twoFingerDrag &&
          Math.abs(panMotion[0]) > 0.5 &&
          Math.abs(panMotion[1]) > 0.5 &&
          Math.sign(panMotion[0]) == Math.sign(panMotion[1])
        ) {
          // Pan by the average motion of the two fingers
          let panAmount = vec2.lerp(motionVectors[0], motionVectors[1], 0.5);
          panAmount[1] = -panAmount[1];
          this.twoFingerDrag(panAmount);
        }
      }

      // Update the existing list of touches with the current positions
      for (let i = 0; i < evt.changedTouches.length; ++i) {
        let t = evt.changedTouches[i];
        touches[t.identifier] = [t.clientX - rect.left, t.clientY - rect.top];
      }
    });

    let touchEnd = function (evt: TouchEvent) {
      evt.preventDefault();
      for (let i = 0; i < evt.changedTouches.length; ++i) {
        let t = evt.changedTouches[i];
        delete touches[t.identifier];
      }
    };
    canvas.addEventListener("touchcancel", touchEnd);
    canvas.addEventListener("touchend", touchEnd);
  }
}
