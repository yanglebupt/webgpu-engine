import { vec3, Vec3 } from "wgpu-matrix";
import { Sphere } from "./Sphere";
import { Plane } from "./Plane";
import { Box3 } from "./Box3";

const _vector = vec3.create();

export class Ray {
  constructor(public origin: Vec3, public direction: Vec3) {}

  // 射线前进 t 长度的点
  at(t: number, target: Vec3) {
    vec3.addScaled(this.origin, this.direction, t, target);
    return target;
  }

  /* 
    点到射线的最短距离，注意
      - 如果射线在起点后面，则最短距离就是点到射线起点的距离
      - 否则最短距离就是点到该线的垂直距离
  */
  distanceSqToPoint(point: Vec3) {
    vec3.sub(point, this.origin, _vector);
    const p = vec3.dot(_vector, this.direction); // _vector 在射线上的投影长度
    if (p < 0) return vec3.distanceSq(point, this.origin);
    this.at(p, _vector);
    return vec3.distanceSq(point, _vector);
  }
  /*
    intersects 判断是否相交，返回 bool
    intersect 需要求出首次相交点，赋值给 target
  */
  intersectSphere(sphere: Sphere, target: Vec3) {
    vec3.sub(sphere.center, this.origin, _vector);
    const p = vec3.dot(_vector, this.direction);
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
    if (t0 < 0) return this.at(t1, target);
    else return this.at(t0, target);
  }

  intersectsSphere(sphere: Sphere) {
    return (
      this.distanceSqToPoint(sphere.center) <= sphere.radius * sphere.radius
    );
  }

  intersectPlane(plane: Plane, target: Vec3) {
    const sig = vec3.dot(this.direction, plane.normal);
    let t = 0;
    if (sig == 0) {
      // 射线平行于平面
      if (plane.distanceToPoint(this.origin) === 0) t = 0; // 起点在平面上
      else return null; // 否则不相交
    }

    /* 
      dot( (o+td), n ) + c = 0 求解 t 即可
      dot(o,n) + t*dot(d,n) + c = 0
      t = -(c+dot(o,n)) / dot(d,n)
    */

    t = -(vec3.dot(this.origin, plane.normal) + plane.constant) / sig;

    if (t >= 0) return this.at(t, target);
    else return null; // 没相交，因为相交 sig<0, t>0
  }

  intersectsPlane(plane: Plane) {
    const distance = plane.distanceToPoint(this.origin);
    if (distance === 0) return true;

    const dirDistance = vec3.dot(this.direction, plane.normal) * distance; // 有方向的长度

    if (dirDistance < 0) {
      return true;
    }

    return false;
  }
  intersectTriangle() {}
  intersectBox(box: Box3, target: Vec3) {
    let tmin, tmax, tymin, tymax, tzmin, tzmax;

    const invdirx = 1 / this.direction[0],
      invdiry = 1 / this.direction[1],
      invdirz = 1 / this.direction[2];

    const origin = this.origin;

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

    return this.at(tmin >= 0 ? tmin : tmax, target);
  }
  intersectsBox(box: Box3) {
    return this.intersectBox(box, _vector) !== null;
  }
}
