import { vec2, vec3 } from "wgpu-matrix";
import {
  BufferAttribute,
  Geometry,
  VertexAttributeElementSize,
} from "./Geometry";

// modify from https://github.com/mrdoob/three.js/blob/master/src/geometries/CircleGeometry.js

export interface CircleGeometry {
  radius: number;
  segments: number;
  thetaStart: number;
  thetaLength: number;
}
export class CircleGeometry extends Geometry {
  constructor(options?: Partial<CircleGeometry>) {
    super();
    Object.assign(this, {
      radius: 1,
      segments: 32,
      thetaStart: 0,
      thetaLength: Math.PI * 2,
      ...options,
    });

    const { radius, thetaStart, thetaLength } = this;
    const segments = Math.max(3, this.segments);

    // buffers

    const indices: number[] = [];
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    // helper variables

    const vertex = vec3.zero();
    const uv = vec2.zero();

    // center point

    vertices.push(0, 0, 0);
    normals.push(0, 1, 0);
    uvs.push(0.5, 0.5);

    for (let s = 0, i = 3; s <= segments; s++, i += 3) {
      const segment = thetaStart + (s / segments) * thetaLength;

      // vertex

      vertex[2] = radius * Math.cos(segment);
      vertex[0] = radius * Math.sin(segment);

      vertices.push(...vertex);

      // normal

      normals.push(0, 1, 0);

      // uvs

      uv[0] = (vertices[i] / radius + 1) / 2;
      uv[1] = (vertices[i + 1] / radius + 1) / 2;

      uvs.push(...uv);
    }

    // indices

    for (let i = 1; i <= segments; i++) {
      indices.push(i, i + 1, 0);
    }

    // build geometry
    this.positions = new BufferAttribute(
      new Float32Array(vertices),
      VertexAttributeElementSize.POSITION
    );
    this.normals = new BufferAttribute(
      new Float32Array(normals),
      VertexAttributeElementSize.NORMAL
    );
    this.uvs = new BufferAttribute(
      new Float32Array(uvs),
      VertexAttributeElementSize.UV
    );
    this.indices = new BufferAttribute(
      new Uint16Array(indices),
      VertexAttributeElementSize.INDICE
    );
  }
}
