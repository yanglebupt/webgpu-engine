import { Vec3, vec3 } from "wgpu-matrix";
import { MotionParticle } from "./NumericalMotion";

export interface MotionConstraint {
  inputs: MotionParticle[];
  compute(): number;
  gradient(): Vec3[];
}

export class DistanceConstraint implements MotionConstraint {
  public retlen: number;
  constructor(public inputs: MotionParticle[]) {
    const [particleA, particleB] = this.inputs;
    this.retlen = vec3.dist(particleA.position, particleB.position);
  }
  compute() {
    const [particleA, particleB] = this.inputs;
    return vec3.dist(particleA.position, particleB.position) - this.retlen;
  }
  // return 每个 input 对应的梯度
  gradient() {
    const [particleA, particleB] = this.inputs;

    const gradA = vec3.sub(particleA.position, particleB.position);
    vec3.normalize(gradA, gradA);

    const gradB = vec3.negate(gradA);

    return [gradA, gradB];
  }
}
