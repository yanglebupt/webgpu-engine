import { vec3, Vec3 } from "wgpu-matrix";
import { EntityObjectComponent } from "../Component";
import { eulerMidpointMotion, MotionParticle } from "./NumericalMotion";
import { WireframeGeometry } from "../../geometrys/WireframeGeometry";
import { Object3D } from "../../objects/Object3D";
import { DistanceConstraint, MotionConstraint } from "./Constraint";
import { EPSILON } from "../../maths/Constant";

/**
 * 不要使用 Transform 来操作带有 RigidBody 组件物体的位置等
 */
export class RigidBody extends EntityObjectComponent<Object3D> {
  // 传递到每个顶点上
  mass: number = 1;
  velocity: Vec3 = vec3.create();
  acceleration: Vec3 = vec3.create();

  // hyper-parameters
  substeps: number = 2;
  stiffness: number = 0.1;

  // helper for motion
  private posEdge: WireframeGeometry;
  private particles: MotionParticle[] = [];
  private constraints: MotionConstraint[] = [];

  constructor(object: Object3D) {
    super(object);
    if (!this.getGeometry())
      throw new Error("Can not add RigidBody to an object without geometry!!");
    // 提取顶点和边 这个很耗时？？？
    this.posEdge = new WireframeGeometry(this.getGeometry());
  }

  protected start() {
    this.transform.update();
    this.createParticles();
    console.log(
      "number of particle:",
      this.particles.length,
      "number of constraints:",
      this.constraints.length
    );
  }

  // 创建粒子和约束
  createParticles() {
    const { indices } = this.posEdge;
    if (!indices) return;
    for (let i = 0, l = indices.count; i < l; i += 2) {
      const startIdx = indices.get(i)[0];
      const endIdx = indices.get(i + 1)[0];
      this.constraints.push(
        new DistanceConstraint([
          this.getParticle(startIdx),
          this.getParticle(endIdx),
        ])
      );
    }
  }

  // 获取粒子，不存在则新建
  getParticle(idx: number) {
    let particle = this.particles[idx];
    if (!particle) {
      particle = this.createParticle(idx);
      this.particles[idx] = particle;
    }
    return particle;
  }

  createParticle(idx: number) {
    const relativePos = this.posEdge.positions.ref(idx);
    // apply transform
    vec3.transformMat4(relativePos, this.transform.worldMatrix, relativePos);
    return {
      id: idx,
      mass: this.mass,
      invMass: 1 / this.mass,
      position: relativePos,
      velocity: vec3.copy(this.velocity),
      acceleration: vec3.copy(this.acceleration),
    };
  }

  // position based dynamic
  pbd(dt: number) {
    dt /= this.substeps;
    const lastPosition: Vec3[] = [];
    for (let i = 0, l = this.substeps; i < l; i++) {
      // step 1: get a potential position use explicit integration step
      this.particles.forEach((particle, idx) => {
        lastPosition[idx] = vec3.copy(particle.position);
        eulerMidpointMotion(particle, dt);
      });

      // step 2: solve constraints
      this.constraints.forEach((constraint) => {
        // compute scalar value λ
        const inputs = constraint.inputs;
        const con = constraint.compute();
        const gradients = constraint.gradient();
        const denominator = gradients.reduce((grad_sum, grad, idx) => {
          return grad_sum + inputs[idx].invMass * vec3.lengthSq(grad);
        }, 0);
        const lambda = -con / (denominator + EPSILON);

        constraint.gradient().forEach((grad, idx) => {
          const target = inputs[idx];
          // step 3: update new position for satisfing constraint
          vec3.addScaled(
            target.position,
            grad,
            this.stiffness * lambda * target.invMass,
            target.position
          );
        });
      });

      // step 4: update new velocity
      this.particles.forEach((particle, idx) => {
        vec3.sub(particle.position, lastPosition[idx], particle.velocity);
        vec3.divScalar(particle.velocity, dt, particle.velocity);
        // TODO: collision detection
        if (particle.position[1] <= 0) particle.velocity[1] = 0;
      });
    }
  }

  protected update(dt: number) {
    this.pbd(dt);
    // 通过更改顶点位置，然后重新上传 buffer
    this.object.updateVertexAll(this.posEdge);
  }
}
