import { vec3 } from "wgpu-matrix";
import {
  BufferAttribute,
  Geometry,
  VertexAttributeElementSize,
} from "./Geometry";

// modify from https://github.com/mrdoob/three.js/blob/master/src/geometries/TorusGeometry.js

export interface TorusGeometry {
  radius: number;
  tube: number;
  radialSegments: number;
  tubularSegments: number;
  arc: number;
}
export class TorusGeometry extends Geometry {
  constructor(options?: Partial<TorusGeometry>) {
    super();
    Object.assign(this, {
      radius: 1.0,
      tube: 0.1,
      radialSegments: 12,
      tubularSegments: 48,
      arc: Math.PI * 2,
      ...options,
    });

    const { radius, tube, arc } = this;
    const radialSegments = Math.floor(this.radialSegments);
    const tubularSegments = Math.floor(this.tubularSegments);

    // buffers

    const indices: number[] = [];
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    // helper variables

    const center = vec3.create();
    const vertex = vec3.create();
    const normal = vec3.create();

    // generate vertices, normals and uvs

    for (let j = 0; j <= radialSegments; j++) {
      for (let i = 0; i <= tubularSegments; i++) {
        const u = (i / tubularSegments) * arc;
        const v = (j / radialSegments) * Math.PI * 2;

        // vertex

        vertex[0] = (radius + tube * Math.cos(v)) * Math.cos(u);
        vertex[1] = (radius + tube * Math.cos(v)) * Math.sin(u);
        vertex[2] = tube * Math.sin(v);

        vertices.push(...vertex);

        // normal

        center[0] = radius * Math.cos(u);
        center[1] = radius * Math.sin(u);
        vec3.normalize(vec3.subtract(vertex, center, normal), normal);

        normals.push(...normal);

        // uv

        uvs.push(i / tubularSegments);
        uvs.push(j / radialSegments);
      }
    }

    // generate indices

    for (let j = 1; j <= radialSegments; j++) {
      for (let i = 1; i <= tubularSegments; i++) {
        // indices

        const a = (tubularSegments + 1) * j + i - 1;
        const b = (tubularSegments + 1) * (j - 1) + i - 1;
        const c = (tubularSegments + 1) * (j - 1) + i;
        const d = (tubularSegments + 1) * j + i;

        // faces

        indices.push(a, b, d);
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
      new Uint16Array(indices),
      VertexAttributeElementSize.INDICE
    );
  }
}
