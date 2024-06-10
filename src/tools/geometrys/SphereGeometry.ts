import { vec2, vec3 } from "wgpu-matrix";
import {
  BufferAttribute,
  Geometry,
  VertexAttributeElementSize,
} from "./Geometry";

// modify from https://github.com/mrdoob/three.js/blob/master/src/geometries/SphereGeometry.js

export interface SphereGeometry {
  radius: number;
  widthSegments: number;
  heightSegments: number;
  phiStart: number;
  phiLength: number;
  thetaStart: number;
  thetaLength: number;
}
export class SphereGeometry extends Geometry {
  constructor(options?: Partial<SphereGeometry>) {
    super();
    Object.assign(this, {
      radius: 1,
      widthSegments: 32,
      heightSegments: 32,
      phiStart: 0,
      phiLength: Math.PI * 2,
      thetaStart: 0,
      thetaLength: Math.PI,
      ...options,
    });

    const { radius, thetaStart, thetaLength, phiStart, phiLength } = this;
    const widthSegments = Math.max(3, Math.floor(this.widthSegments));
    const heightSegments = Math.max(2, Math.floor(this.heightSegments));

    const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI);

    let index = 0;
    const grid = [];

    const vertex = vec3.zero();
    const normal = vec3.zero();

    // buffers

    const indices = [];
    const vertices = [];
    const normals = [];
    const uvs = [];

    // generate vertices, normals and uvs

    for (let iy = 0; iy <= heightSegments; iy++) {
      const verticesRow = [];

      const v = iy / heightSegments;

      // special case for the poles

      let uOffset = 0;

      if (iy === 0 && thetaStart === 0) {
        uOffset = 0.5 / widthSegments;
      } else if (iy === heightSegments && thetaEnd === Math.PI) {
        uOffset = -0.5 / widthSegments;
      }

      for (let ix = 0; ix <= widthSegments; ix++) {
        const u = ix / widthSegments;

        // vertex

        vertex[0] =
          -radius *
          Math.cos(phiStart + u * phiLength) *
          Math.sin(thetaStart + v * thetaLength);
        vertex[1] = radius * Math.cos(thetaStart + v * thetaLength);
        vertex[2] =
          radius *
          Math.sin(phiStart + u * phiLength) *
          Math.sin(thetaStart + v * thetaLength);

        vertices.push(...vertex);

        // normal

        vec3.normalize(vec3.copy(vertex, normal), normal);
        normals.push(...normal);

        // uv

        uvs.push(u + uOffset, 1 - v);

        verticesRow.push(index++);
      }

      grid.push(verticesRow);
    }

    // indices

    for (let iy = 0; iy < heightSegments; iy++) {
      for (let ix = 0; ix < widthSegments; ix++) {
        const a = grid[iy][ix + 1];
        const b = grid[iy][ix];
        const c = grid[iy + 1][ix];
        const d = grid[iy + 1][ix + 1];

        if (iy !== 0 || thetaStart > 0) indices.push(a, b, d);
        if (iy !== heightSegments - 1 || thetaEnd < Math.PI)
          indices.push(b, c, d);
      }
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
      new (this.indexFormat === "uint16" ? Uint16Array : Uint32Array)(indices),
      VertexAttributeElementSize.INDICE
    );
  }
}
