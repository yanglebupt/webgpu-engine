import { EntityObjectComponent } from "../../tools/components/Component";
import { Transform } from "../../tools/components/Transform";
import { Axis, Space } from "../../tools/maths/Axis";
import { Skeleton } from "../../tools/objects/Skeleton";
import { axis } from "../../tools/utils/Dispatch";

interface RotateInfo {
  target?: Transform;
  centerAngle: number;
  angleRange: number;
  phaseOffset: number;
  angle?: number;
}

interface LegOrArmInfo {
  upper: RotateInfo;
  lower: RotateInfo;
  bottom: RotateInfo;
  phase: number;
}

interface BodyInfo {
  spine: RotateInfo;
  chest: RotateInfo;
  neck: RotateInfo;
  head: RotateInfo;
  phase: number;
}

export class SkeletonWalk extends EntityObjectComponent<Skeleton> {
  leftLeg?: LegOrArmInfo;
  rightLeg?: LegOrArmInfo;
  leftArm?: LegOrArmInfo;
  rightArm?: LegOrArmInfo;
  body?: BodyInfo;

  speed: number = 4;
  dt = 0;

  findLeg(legName: string, phase = 0): LegOrArmInfo {
    return {
      upper: {
        target: this.object.getBoneByName(legName, "upper leg")?.transform,
        centerAngle: 0,
        phaseOffset: 0,
        angleRange: Math.PI / 6,
      },
      lower: {
        target: this.object.getBoneByName(legName, "lower leg")?.transform,
        centerAngle: Math.PI / 8,
        phaseOffset: -Math.PI / 2,
        angleRange: Math.PI / 8,
      },
      bottom: {
        target: this.object.getBoneByName(legName, "foot")?.transform,
        centerAngle: 0,
        phaseOffset: 0,
        angleRange: Math.PI / 8,
      },
      phase,
    };
  }

  findArm(armName: string, phase = 0): LegOrArmInfo {
    return {
      upper: {
        target: this.object.getBoneByName(armName, "upper arm")?.transform,
        centerAngle: 0,
        phaseOffset: Math.PI,
        angleRange: Math.PI / 6,
      },
      lower: {
        target: this.object.getBoneByName(armName, "lower arm")?.transform,
        centerAngle: -Math.PI / 8,
        phaseOffset: -Math.PI / 2,
        angleRange: Math.PI / 8,
      },
      bottom: {
        target: this.object.getBoneByName(armName, "palm")?.transform,
        centerAngle: 0,
        phaseOffset: Math.PI,
        angleRange: Math.PI / 16,
      },
      phase,
    };
  }

  findBody(): BodyInfo {
    return {
      spine: {
        target: this.object.getBoneByName("spines", "spine")?.transform,
        phaseOffset: 0,
        centerAngle: Math.PI / 16,
        angleRange: Math.PI / 32,
      },
      chest: {
        target: this.object.getBoneByName("spines", "chest")?.transform,
        phaseOffset: 0,
        centerAngle: 0,
        angleRange: Math.PI / 8,
      },
      neck: {
        target: this.object.getBoneByName("spines", "neck")?.transform,
        phaseOffset: 0,
        centerAngle: Math.PI / 4,
        angleRange: Math.PI / 8,
      },
      head: {
        target: this.object.getBoneByName("spines", "head")?.transform,
        phaseOffset: 0,
        centerAngle: 0,
        angleRange: Math.PI / 4,
      },
      phase: 0,
    };
  }

  protected start() {
    this.leftLeg = this.findLeg("leftLeg", 0);
    this.rightLeg = this.findLeg("rightLeg", Math.PI);

    this.leftArm = this.findArm("leftArm", 0);
    this.rightArm = this.findArm("rightArm", Math.PI);

    this.body = this.findBody();
  }

  protected update(dt: number, t: number) {
    this.dt = dt;

    this.rotateBody(this.body);

    this.rotateLeg(this.leftLeg);
    this.rotateLeg(this.rightLeg);

    this.rotateLeg(this.leftArm);
    this.rotateLeg(this.rightArm);
  }

  rotateBody(body?: BodyInfo) {
    if (!body) return;
    const { spine, chest, neck, head, phase } = body;
    this.rotateAngle(spine, phase);
    this.rotateAngle(neck, phase, Axis.Y);
    this.rotateAngle(head, phase);
    body.phase = phase + this.speed * this.dt;
  }

  rotateLeg(leg?: LegOrArmInfo) {
    if (!leg) return;
    const { upper, lower, bottom, phase } = leg;
    this.rotateAngle(upper, phase);
    this.rotateAngle(lower, phase);
    this.rotateAngle(bottom, phase);
    leg.phase = phase + this.speed * this.dt;
  }

  rotateAngle(info?: RotateInfo, phase: number = 0, axis: Axis = Axis.X) {
    if (!info || (info && !info.target)) return;
    const angle =
      info.centerAngle + Math.sin(phase + info.phaseOffset) * info.angleRange;
    switch (axis) {
      case Axis.X: {
        info.target?.rotateX(angle - (info.angle ?? 0), Space.World);
        break;
      }
      case Axis.Y: {
        info.target?.rotateY(angle - (info.angle ?? 0), Space.World);
        break;
      }
      case Axis.Z: {
        info.target?.rotateZ(angle - (info.angle ?? 0), Space.World);
        break;
      }
    }
    info.angle = angle;
  }
}
