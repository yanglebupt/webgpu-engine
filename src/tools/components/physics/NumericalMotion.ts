import { vec3, Vec3 } from "wgpu-matrix";

const _midpoint = vec3.create();
const _prepoint = vec3.create();
const __pre = Symbol("__pre");
const __mid = Symbol("__mid");

export interface MotionParticle {
  id: number;
  mass: number;
  invMass: number;
  position: Vec3;
  velocity: Vec3; // no relationship with position
  acceleration: Vec3; // no relationship with position
}

/**
 * 为什么需要数值法，求解 ODE（常微分方程）？
 * 因为位置 s(t) 、速度 v(t)、加速度 a(t) 之间是满足常微分方程的
 * v(t) = s'(t) （一阶 ODE）  and a(t) = s''(t) = v'(t) （二阶 ODE）
 * 而在物理引擎中，我们的目的就是根据 速度/加速度 求解 粒子的位置 s(t)，并且我们已知粒子的初始位置，这就是一个典型的常微分求解问题
 * 但通常无法得到解析解，因为解析解依赖于积分，而积分通常是一件很难的事，例如钟摆运动等等
 * 因此需要数值解 (numerical integration，也称数值积分)，而数值解大部分只需要微分（泰勒公式）迭代即可，而微分恰好在常微分方程中是已知的
 *
 *
 * error 为估计的误差，次数越小，误差越大，对应要求的步长 Δ𝑡 越小
 * 换句话说就是，误差越小，在大步长下也可以得到一个更精确的结果
 * Obviously a smaller Δ𝑡 would result in a better approximation, and a larger Δ𝑡 in a worse approximation.
 *
 * Sinc the number of steps over the whole interval is proportional to 1/Δ𝑡 (or O(Δ𝑡^-1))
 * we might expect the global error to be the local error*O(Δ𝑡^-1)  全局的误差随迭代次数不断增加
 */

// https://lpsa.swarthmore.edu/NumInt/NumIntIntro.html

/**
 * try to associated with position, such as  s'(t) = v(t) = f(t, s(t))
 * this function supports symbolic relationship such velocity = `t + position`
 * parse and return t + mp.position
 */
// 尝试支持符号表达式
export function updateCurrentValueAssociatedWithPosition(
  mp: MotionParticle,
  t: number,
  ...names: Array<keyof MotionParticle>
) {}

/**
 * Kernel of Euler Integration
 * 𝑓(𝑡 + Δ𝑡) ≈ 𝑓(𝑡) + Δ𝑡𝑓′(𝑡)
 * local error is O(Δ𝑡²) and global error is O(Δ𝑡) so it is a first-order method
 * @param f current time function value 𝑓(𝑡)
 * @param df current time derivative function 𝑓′(𝑡)
 * @param dt Δ𝑡
 * @returns 𝑓(𝑡 + Δ𝑡) estimate funtion value at next time
 */
export function __EulerIntegrationKernel__(
  f: Vec3,
  df: Vec3,
  dt: number,
  dst: Vec3
): Vec3 {
  vec3.addScaled(f, df, dt, dst);
  return dst;
}

/**
 * assume already calculate right acceleration and velocity by user (yes/no associated with position depends on user)
 * assume acceleration (force) is constant in one frame
 *
 * Euler 方法以时间步长 Δ𝑡 推进，但仅在区间开始时使用导数信息，因此该方法的精度有限，其解往往不稳定
 * Midpoint Euler Integration (Second Order)
 * use the midpoint velocity during the interval to obtain the new position.
 * v(𝑡 + Δ𝑡) = v(𝑡) + a(𝑡)Δ𝑡
 * x(𝑡 + Δ𝑡) = x(𝑡) + 0.5 * ( v(𝑡 + Δ𝑡) + v(𝑡) ) * Δ𝑡    global error is O(Δ𝑡²)
 * same as
 * v(𝑡 + Δ𝑡/2) = v(𝑡) + a(𝑡)Δ𝑡/2
 * x(𝑡 + Δ𝑡) = x(𝑡) + v(𝑡 + Δ𝑡/2) * Δ𝑡
 * v(𝑡 + Δ𝑡) = v(𝑡 + Δ𝑡/2) + a(𝑡)Δ𝑡/2
 * also same as Second Order Runge-Kutta Algorithm (assume acceleration (force) is constant in one frame)
 * see difference between Euler (https://www.physics.udel.edu/~bnikolic/teaching/phys660/numerical_ode/node1.html)
 * and Euler-Cromer (https://www.physics.udel.edu/~bnikolic/teaching/phys660/numerical_ode/node2.html)
 * see Second Order Runge-Kutta Algorithm (https://lpsa.swarthmore.edu/NumInt/NumIntSecond.html##section15)
 */
export function eulerMidpointMotion(mp: MotionParticle, dt: number) {
  __EulerIntegrationKernel__(mp.velocity, mp.acceleration, dt / 2, _midpoint);
  __EulerIntegrationKernel__(mp.position, _midpoint, dt, mp.position);
  __EulerIntegrationKernel__(_midpoint, mp.acceleration, dt / 2, mp.velocity);
}

/**
 * Leap-Frog (Half-Step Method) (Second Order)
 * v(𝑡 + Δ𝑡/2) = v(𝑡 - Δ𝑡/2) + a(𝑡)Δ𝑡
 * x(𝑡 + Δ𝑡) = x(𝑡) + v(𝑡 + Δ𝑡/2) * Δ𝑡     global error is O(Δ𝑡²)
 * v(𝑡 + Δ𝑡) = v(𝑡 + Δ𝑡/2) + a(𝑡)Δ𝑡/2
 * see https://www.physics.udel.edu/~bnikolic/teaching/phys660/numerical_ode/node3.html
 * https://www.youtube.com/watch?v=pVudb6-_FaM&list=RDCMUCVzqfbyMjWi_zmag92PKjlw&start_radio=1&rv=pVudb6-_FaM&t=82
 */
export function leapFrogMotion(mp: MotionParticle, dt: number) {
  let mid = Reflect.get(mp, __mid);
  if (!mid) {
    __EulerIntegrationKernel__(mp.velocity, mp.acceleration, dt / 2, _midpoint); // self starting  v(Δ𝑡/2)
    mid = {
      velocity: vec3.copy(_midpoint),
    };
    Reflect.set(mp, __mid, mid);
  } else {
    __EulerIntegrationKernel__(mid.velocity, mp.acceleration, dt, mid.velocity); // update mid velocity
  }
  __EulerIntegrationKernel__(mp.position, mid.velocity, dt, mp.position); // use mid velocity update position
  __EulerIntegrationKernel__(
    mid.velocity,
    mp.acceleration,
    dt / 2,
    mp.velocity
  ); // use mid velocity update velocity
}

/**
 * Kernel of Verlet Integration
 * 𝑓(𝑡 + Δ𝑡) ≈ 2𝑓(𝑡) − 𝑓(𝑡 − Δ𝑡) + Δ𝑡²𝑓″(𝑡)
 * local error is O(Δ𝑡⁴) and global error is O(Δ𝑡³)
 * @param f current time function value 𝑓(𝑡)
 * @param pf previous time function value 𝑓(𝑡 − Δ𝑡)
 * @param ddf current time second derivative function 𝑓″(𝑡)
 * @param dt Δ𝑡
 * @returns 𝑓(𝑡 + Δ𝑡) estimate funtion value at next time
 */
export function __VerletIntegrationKernel__(
  f: Vec3,
  pf: Vec3,
  ddf: Vec3,
  dt: number,
  dst: Vec3
): Vec3 {
  vec3.addScaled(f, pf, -0.5, _midpoint);
  vec3.copy(f, pf); // record last position
  vec3.mulScalar(_midpoint, 2, _midpoint);
  vec3.addScaled(_midpoint, ddf, dt * dt, dst);
  return dst;
}

/**
 * Verlet Integration (Third Order)
 * x(𝑡 + Δ𝑡) = 2x(𝑡) − x(𝑡 − Δ𝑡) + Δ𝑡²a(𝑡)
 * v(𝑡) = (x(𝑡 + Δ𝑡) - x(𝑡 - Δ𝑡)) / (2Δ𝑡)
 * local error is O(Δ𝑡⁴) and global error is O(Δ𝑡³)
 * but can not use velocity to update position !! so if you want to use velocity, please use `Leap Frog Motion` or `Midpoint Euler Integration`
 * which is same as Velocity Verlet method
 * see https://www.physics.udel.edu/~bnikolic/teaching/phys660/numerical_ode/node5.html
 */
export function verletMotion(mp: MotionParticle, dt: number) {
  let pre = Reflect.get(mp, __pre);
  if (!pre) {
    pre = {
      position: vec3.copy(mp.position),
    };
    Reflect.set(mp, __pre, pre);
  }
  vec3.copy(pre.position, _prepoint);
  __VerletIntegrationKernel__(
    mp.position,
    pre.position,
    mp.acceleration,
    dt,
    mp.position
  );
  vec3.sub(mp.position, _prepoint, _midpoint);
  vec3.divScalar(_midpoint, 2 * dt, mp.velocity);
}

/**
 * Fourth Order Runge-Kutta
 * assume using even more estimates of the slope would result in even more accuracy is reasonable
 * so not only use midpoint, we can use even more segmentation point. here we use
 * local error is O(Δ𝑡⁵) and global error is O(Δ𝑡⁴)
 * see https://lpsa.swarthmore.edu/NumInt/NumIntFourth.html##section12
 *
 * but here we assume velocity is constant in one frame and no `explicit relationship` with position
 * so we don't need this method
 */
