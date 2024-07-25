import { EntityObjectComponent } from "../../tools/components/Component";
import { Transform } from "../../tools/components/Transform";
import { Space } from "../../tools/maths/Axis";
import { Skeleton } from "../../tools/objects/Skeleton";

interface RotateInfo {
  target?: Transform;
  centerAngle: number;
  angleRange: number;
  phaseOffset: number;
  angle?: number;
}

interface LegInfo {
  upperLeg: RotateInfo;
  lowerLeg: RotateInfo;
  foot: RotateInfo;
  phase: number;
}

export class SkeletonWalk extends EntityObjectComponent<Skeleton> {
  leftLeg?: LegInfo;
  rightLeg?: LegInfo;

  speed: number = 4;
  dt = 0;

  findLeg(legName: string, phase = 0): LegInfo {
    return {
      upperLeg: {
        target: this.object.getBoneByName(legName, "upper leg")?.transform,
        centerAngle: 0,
        phaseOffset: 0,
        angleRange: Math.PI / 4,
      },
      lowerLeg: {
        target: this.object.getBoneByName(legName, "lower leg")?.transform,
        centerAngle: 0.7,
        phaseOffset: -1.5,
        angleRange: 0.87,
      },
      foot: {
        target: this.object.getBoneByName(legName, "foot")?.transform,
        centerAngle: 0,
        phaseOffset: 0,
        angleRange: Math.PI / 16,
      },
      phase,
    };
  }

  protected start() {
    this.leftLeg = this.findLeg("leftLeg", 0);
    this.rightLeg = this.findLeg("rightLeg", Math.PI);
  }

  protected update(dt: number) {
    this.dt = dt;
    this.rotateLeg(this.leftLeg);
    this.rotateLeg(this.rightLeg);
  }

  rotateLeg(leg?: LegInfo) {
    if (!leg) return;
    const { upperLeg, lowerLeg, foot, phase = 0 } = leg;
    this.rotateAngle(upperLeg, phase);
    this.rotateAngle(lowerLeg, phase);
    this.rotateAngle(foot, phase);
    leg.phase = phase + this.speed * this.dt;
  }

  rotateAngle(info?: RotateInfo, phase: number = 0) {
    if (!info || (info && !info.target)) return;
    const angle =
      (info.centerAngle ?? 0) +
      Math.sin(phase + info.phaseOffset) * info.angleRange;
    info.target!.rotateX(angle - (info.angle ?? 0), Space.World);
    info.angle = angle;
  }
}
