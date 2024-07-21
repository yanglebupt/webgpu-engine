import { mat4, vec3, Vec3 } from "wgpu-matrix";
import { Sphere } from "./Sphere";
import { Ray } from "./Ray";
import { Plane } from "./Plane";
import { Box3 } from "./Box3";
import { OBB } from "./OBB";
import { Collider } from "../components/colliders/Collider";

const _vector = vec3.create();
const aabb = new Box3();
const _m = mat4.create();
const _im = mat4.create();

type H = { c: Vec3 | null; u: Vec3[]; e: number[] };
const a: H = {
  c: null, // center
  u: [vec3.create(), vec3.create(), vec3.create()], // basis vectors
  e: [], // half width
};

const b: H = {
  c: null, // center
  u: [vec3.create(), vec3.create(), vec3.create()], // basis vectors
  e: [], // half width
};

const R: Array<number[]> = [[], [], []];
const AbsR: Array<number[]> = [[], [], []];
const t: number[] = [];

export type IntersectionPrimitive = Sphere | Ray | Plane | Box3 | OBB;

/*
  intersects 判断是否相交，返回 bool
  intersect 需要求出首次相交点，赋值给 target
  注意参数顺序和函数名顺序保存一致
*/
export class Intersection {
  static [`intersect${Ray.name}${Sphere.name}`](
    ray: Ray,
    sphere: Sphere,
    target: Vec3
  ) {
    vec3.sub(sphere.center, ray.origin, _vector);
    const p = vec3.dot(_vector, ray.direction); // 这个投影是有正负的，当 origin 在 center 的前面，p < 0
    const d2 = vec3.dot(_vector, _vector) - p * p; // 斜边长度-投影长度=垂直长度
    const r2 = sphere.radius * sphere.radius;
    if (d2 > r2) return;

    const l = Math.sqrt(r2 - d2); // 投影点到球边界的长度

    const t0 = p - l; // 相交于前面的点
    const t1 = p + l; // 相交于背面的点（射线起点在球内部）
    /* 
      相切，l == 0
      切点是起点，p == 0  两种情况 t0==t1>=0，因此只需要判断 <0 即可
    */
    if (t1 < 0) return null;
    if (t0 < 0) return ray.at(t1, target);
    else return ray.at(t0, target);
  }

  static [`intersects${Ray.name}${Sphere.name}`](ray: Ray, sphere: Sphere) {
    return (
      ray.distanceSqToPoint(sphere.center) <= sphere.radius * sphere.radius
    );
  }

  static [`intersect${Ray.name}${Plane.name}`](
    ray: Ray,
    plane: Plane,
    target: Vec3
  ) {
    const sig = vec3.dot(ray.direction, plane.normal);
    let t = 0;
    if (sig == 0) {
      // 射线平行于平面
      if (plane.distanceToPoint(ray.origin) === 0) t = 0; // 起点在平面上
      else return null; // 否则不相交
    }

    /* 
      dot( (o+td), n ) + c = 0 求解 t 即可
      dot(o,n) + t*dot(d,n) + c = 0
      t = -(c+dot(o,n)) / dot(d,n)
    */

    t = -(vec3.dot(ray.origin, plane.normal) + plane.constant) / sig;

    if (t >= 0) return ray.at(t, target);
    else return null;
  }

  static [`intersects${Ray.name}${Plane.name}`](ray: Ray, plane: Plane) {
    const distance = plane.distanceToPoint(ray.origin);
    if (distance === 0) return true;

    const dirDistance = vec3.dot(ray.direction, plane.normal) * distance; // 有方向的长度

    if (dirDistance < 0) {
      return true;
    }

    return false;
  }

  static [`intersect${Ray.name}${Box3.name}`](
    ray: Ray,
    box: Box3,
    target: Vec3
  ) {
    let tmin, tmax, tymin, tymax, tzmin, tzmax;

    const invdirx = 1 / ray.direction[0],
      invdiry = 1 / ray.direction[1],
      invdirz = 1 / ray.direction[2];

    const origin = ray.origin;

    if (invdirx >= 0) {
      tmin = (box.min[0] - origin[0]) * invdirx;
      tmax = (box.max[0] - origin[0]) * invdirx;
    } else {
      tmin = (box.max[0] - origin[0]) * invdirx;
      tmax = (box.min[0] - origin[0]) * invdirx;
    }

    if (invdiry >= 0) {
      tymin = (box.min[1] - origin[1]) * invdiry;
      tymax = (box.max[1] - origin[1]) * invdiry;
    } else {
      tymin = (box.max[1] - origin[1]) * invdiry;
      tymax = (box.min[1] - origin[1]) * invdiry;
    }

    if (tmin > tymax || tymin > tmax) return null;

    if (tymin > tmin || isNaN(tmin)) tmin = tymin;

    if (tymax < tmax || isNaN(tmax)) tmax = tymax;

    if (invdirz >= 0) {
      tzmin = (box.min[2] - origin[2]) * invdirz;
      tzmax = (box.max[2] - origin[2]) * invdirz;
    } else {
      tzmin = (box.max[2] - origin[2]) * invdirz;
      tzmax = (box.min[2] - origin[2]) * invdirz;
    }

    if (tmin > tzmax || tzmin > tmax) return null;

    if (tzmin > tmin || tmin !== tmin) tmin = tzmin;

    if (tzmax < tmax || tmax !== tmax) tmax = tzmax;

    //return point closest to the ray (positive side)

    if (tmax < 0) return null;

    return ray.at(tmin >= 0 ? tmin : tmax, target);
  }

  static [`intersects${Ray.name}${Box3.name}`](ray: Ray, box: Box3) {
    return (
      Reflect.get(Intersection, `intersect${Ray.name}${Box3.name}`)(
        ray,
        box,
        _vector
      ) !== null
    );
  }

  static [`intersect${Ray.name}${OBB.name}`](ray: Ray, obb: OBB, target: Vec3) {
    /* 
      OBB 就是 AABB 经过 matrix 变换得到的
      因此我们可以将 ray 通过 inv matrix 变换到 AABB 空间，求出交点
      然后在把交点通过 matrix 变换回去
    */
    obb.getSize(_vector);
    aabb.setFromCenterAndSize(vec3.create(), _vector); // scale 作用于 aabb 的 min/max

    // rotation 和 translate 组成 matrix 作用于 ray
    mat4.fromMat3(obb.rotation, _m);
    mat4.setTranslation(_m, obb.center, _m);

    // 变换 ray
    mat4.inverse(_m, _im);
    const lacalRay = ray.makeCopy();
    lacalRay.applyMatrix4(_im);

    if (
      Reflect.get(Intersection, `intersect${Ray.name}${Box3.name}`)(
        lacalRay,
        aabb,
        target
      ) !== null
    ) {
      // 将交点变换回去
      vec3.transformMat4(target, _m, target);
      return target;
    }

    return null;
  }

  static [`intersects${Ray.name}${OBB.name}`](ray: Ray, obb: OBB) {
    return (
      Reflect.get(Intersection, `intersect${Ray.name}${OBB.name}`)(
        ray,
        obb,
        _vector
      ) !== null
    );
  }

  /**
   * Reference: OBB-OBB Intersection in Real-Time Collision Detection
   * by Christer Ericson (chapter 4.4.1)
   *
   */
  static [`intersects${OBB.name}${OBB.name}`](
    o1: OBB,
    o2: OBB,
    epsilon = Number.EPSILON
  ) {
    // prepare data structures (the code uses the same nomenclature like the reference)

    a.c = o1.center;
    a.e[0] = o1.halfSize[0];
    a.e[1] = o1.halfSize[1];
    a.e[2] = o1.halfSize[2];
    o1.extractBasis(a.u[0], a.u[1], a.u[2]);

    b.c = o2.center;
    b.e[0] = o2.halfSize[0];
    b.e[1] = o2.halfSize[1];
    b.e[2] = o2.halfSize[2];
    o2.extractBasis(b.u[0], b.u[1], b.u[2]);

    // compute rotation matrix expressing b in a's coordinate frame

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        R[i][j] = vec3.dot(a.u[i], b.u[j]);
      }
    }

    // compute translation vector

    vec3.sub(b.c, a.c, _vector);

    // bring translation into a's coordinate frame

    t[0] = vec3.dot(_vector, a.u[0]);
    t[1] = vec3.dot(_vector, a.u[1]);
    t[2] = vec3.dot(_vector, a.u[2]);

    // compute common subexpressions. Add in an epsilon term to
    // counteract arithmetic errors when two edges are parallel and
    // their cross product is (near) null

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        AbsR[i][j] = Math.abs(R[i][j]) + epsilon;
      }
    }

    let ra, rb;

    // test axes L = A0, L = A1, L = A2

    for (let i = 0; i < 3; i++) {
      ra = a.e[i];
      rb = b.e[0] * AbsR[i][0] + b.e[1] * AbsR[i][1] + b.e[2] * AbsR[i][2];
      if (Math.abs(t[i]) > ra + rb) return false;
    }

    // test axes L = B0, L = B1, L = B2

    for (let i = 0; i < 3; i++) {
      ra = a.e[0] * AbsR[0][i] + a.e[1] * AbsR[1][i] + a.e[2] * AbsR[2][i];
      rb = b.e[i];
      if (Math.abs(t[0] * R[0][i] + t[1] * R[1][i] + t[2] * R[2][i]) > ra + rb)
        return false;
    }

    // test axis L = A0 x B0

    ra = a.e[1] * AbsR[2][0] + a.e[2] * AbsR[1][0];
    rb = b.e[1] * AbsR[0][2] + b.e[2] * AbsR[0][1];
    if (Math.abs(t[2] * R[1][0] - t[1] * R[2][0]) > ra + rb) return false;

    // test axis L = A0 x B1

    ra = a.e[1] * AbsR[2][1] + a.e[2] * AbsR[1][1];
    rb = b.e[0] * AbsR[0][2] + b.e[2] * AbsR[0][0];
    if (Math.abs(t[2] * R[1][1] - t[1] * R[2][1]) > ra + rb) return false;

    // test axis L = A0 x B2

    ra = a.e[1] * AbsR[2][2] + a.e[2] * AbsR[1][2];
    rb = b.e[0] * AbsR[0][1] + b.e[1] * AbsR[0][0];
    if (Math.abs(t[2] * R[1][2] - t[1] * R[2][2]) > ra + rb) return false;

    // test axis L = A1 x B0

    ra = a.e[0] * AbsR[2][0] + a.e[2] * AbsR[0][0];
    rb = b.e[1] * AbsR[1][2] + b.e[2] * AbsR[1][1];
    if (Math.abs(t[0] * R[2][0] - t[2] * R[0][0]) > ra + rb) return false;

    // test axis L = A1 x B1

    ra = a.e[0] * AbsR[2][1] + a.e[2] * AbsR[0][1];
    rb = b.e[0] * AbsR[1][2] + b.e[2] * AbsR[1][0];
    if (Math.abs(t[0] * R[2][1] - t[2] * R[0][1]) > ra + rb) return false;

    // test axis L = A1 x B2

    ra = a.e[0] * AbsR[2][2] + a.e[2] * AbsR[0][2];
    rb = b.e[0] * AbsR[1][1] + b.e[1] * AbsR[1][0];
    if (Math.abs(t[0] * R[2][2] - t[2] * R[0][2]) > ra + rb) return false;

    // test axis L = A2 x B0

    ra = a.e[0] * AbsR[1][0] + a.e[1] * AbsR[0][0];
    rb = b.e[1] * AbsR[2][2] + b.e[2] * AbsR[2][1];
    if (Math.abs(t[1] * R[0][0] - t[0] * R[1][0]) > ra + rb) return false;

    // test axis L = A2 x B1

    ra = a.e[0] * AbsR[1][1] + a.e[1] * AbsR[0][1];
    rb = b.e[0] * AbsR[2][2] + b.e[2] * AbsR[2][0];
    if (Math.abs(t[1] * R[0][1] - t[0] * R[1][1]) > ra + rb) return false;

    // test axis L = A2 x B2

    ra = a.e[0] * AbsR[1][2] + a.e[1] * AbsR[0][2];
    rb = b.e[0] * AbsR[2][1] + b.e[1] * AbsR[2][0];
    if (Math.abs(t[1] * R[0][2] - t[0] * R[1][2]) > ra + rb) return false;

    // since no separating axis is found, the OBBs must be intersecting

    return true;
  }

  static [`intersects${Box3.name}${OBB.name}`](box: Box3, obb: OBB) {
    const obb1 = new OBB();
    obb1.fromBox3(box);
    return Reflect.get(Intersection, `intersects${OBB.name}${OBB.name}`)(
      obb,
      obb1
    );
  }

  static [`intersects${Sphere.name}${OBB.name}`](sphere: Sphere, obb: OBB) {
    // Find the point on the OBB closest to the sphere center.
    const r = (obb.clampPoint(sphere.center, _vector), sphere.radius);
    return vec3.distanceSq(_vector, sphere.center) <= r * r;
  }

  static [`intersects${Box3.name}${Sphere.name}`](box: Box3, sphere: Sphere) {
    // Find the point on the AABB closest to the sphere center.
    const r = (box.clampPoint(sphere.center, _vector), sphere.radius);
    return vec3.distanceSq(_vector, sphere.center) <= r * r;
  }

  static [`intersects${Sphere.name}${Sphere.name}`](s1: Sphere, s2: Sphere) {
    const sumRadius = s1.radius + s2.radius;
    return vec3.distanceSq(s1.center, s2.center) <= sumRadius * sumRadius;
  }

  static [`intersects${Box3.name}${Box3.name}`](b1: Box3, b2: Box3) {
    // 排除不相交的情况
    return !(
      b1.min[0] > b2.max[0] ||
      b1.max[0] < b2.min[0] ||
      b1.min[1] > b2.max[1] ||
      b1.max[1] < b2.min[1] ||
      b1.min[2] > b2.max[2] ||
      b1.max[2] < b2.min[2]
    );
  }

  // 根据不同的 collisionPrimitive 调用不同的检测方法
  static intersects(
    o1: IntersectionPrimitive | Collider<IntersectionPrimitive>,
    o2: IntersectionPrimitive | Collider<IntersectionPrimitive>
  ) {
    const { name: name_1, primitive: primitive_1 } =
      getIntersectionPrimitiveName(o1);
    const { name: name_2, primitive: primitive_2 } =
      getIntersectionPrimitiveName(o2);

    const fn1 = Reflect.get(Intersection, `intersects${name_1}${name_2}`);
    if (fn1 && typeof fn1 === "function") return fn1(primitive_1, primitive_2);

    const fn2 = Reflect.get(Intersection, `intersects${name_2}${name_1}`);
    if (fn2 && typeof fn2 === "function") return fn2(primitive_2, primitive_1);

    return false;
  }

  static intersect(
    o1: IntersectionPrimitive | Collider<IntersectionPrimitive>,
    o2: IntersectionPrimitive | Collider<IntersectionPrimitive>,
    target: Vec3
  ) {
    const { name: name_1, primitive: primitive_1 } =
      getIntersectionPrimitiveName(o1);
    const { name: name_2, primitive: primitive_2 } =
      getIntersectionPrimitiveName(o2);

    const fn1 = Reflect.get(Intersection, `intersect${name_1}${name_2}`);
    if (fn1 && typeof fn1 === "function")
      return fn1(primitive_1, primitive_2, target);

    const fn2 = Reflect.get(Intersection, `intersect${name_2}${name_1}`);
    if (fn2 && typeof fn2 === "function")
      return fn2(primitive_2, primitive_1, target);

    return false;
  }
}

function getIntersectionPrimitiveName(
  o: IntersectionPrimitive | Collider<IntersectionPrimitive>
) {
  let name = o.constructor.name;
  let primitive = o;
  if (name.includes(Collider.name)) {
    primitive = (o as Collider<IntersectionPrimitive>).collisionPrimitive;
    name = primitive.constructor.name;
  }
  return { name, primitive };
}
