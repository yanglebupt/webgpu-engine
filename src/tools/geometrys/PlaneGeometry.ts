import { vec3 } from "wgpu-matrix";
import { Axis } from "../utils/Dispatch";
import {
  BufferAttribute,
  Geometry,
  VertexAttributeElementSize,
} from "./Geometry";

// modify from https://github.com/mrdoob/three.js/blob/master/src/geometries/PlaneGeometry.js

export function buildPlane(
  u: Axis,
  v: Axis,
  w: Axis,
  udir: number,
  vdir: number,
  width: number,
  height: number,
  depth: number,
  gridX: number,
  gridY: number,
  materialIndex: number,
  attributes: {
    indices: number[];
    vertices: number[];
    normals: number[];
    uvs: number[];
    numberOfVertices: number;
  }
) {
  // buffers
  const { indices, vertices, normals, uvs, numberOfVertices } = attributes;

  const segmentWidth = width / gridX;
  const segmentHeight = height / gridY;

  const widthHalf = width / 2;
  const heightHalf = height / 2;
  const depthHalf = depth / 2;

  const gridX1 = gridX + 1;
  const gridY1 = gridY + 1;

  let vertexCounter = 0;

  const vector = vec3.zero();

  // generate vertices, normals and uvs

  for (let iy = 0; iy < gridY1; iy++) {
    const y = iy * segmentHeight - heightHalf;

    for (let ix = 0; ix < gridX1; ix++) {
      const x = ix * segmentWidth - widthHalf;

      // set values to correct vector component

      vector[u] = x * udir;
      vector[v] = y * vdir;
      vector[w] = depthHalf;

      // now apply vector to vertex buffer

      vertices.push(...vector);

      // set values to correct vector component

      vector[u] = 0;
      vector[v] = 0;
      vector[w] = depth > 0 ? 1 : -1;

      // now apply vector to normal buffer

      normals.push(...vector);

      // uvs

      uvs.push(ix / gridX);
      uvs.push(1 - iy / gridY);

      // counters

      vertexCounter += 1;
    }
  }

  // indices

  // 1. you need three indices to draw a single face
  // 2. a single segment consists of two faces
  // 3. so we need to generate six (2*3) indices per segment

  for (let iy = 0; iy < gridY; iy++) {
    for (let ix = 0; ix < gridX; ix++) {
      const a = numberOfVertices + ix + gridX1 * iy;
      const b = numberOfVertices + ix + gridX1 * (iy + 1);
      const c = numberOfVertices + (ix + 1) + gridX1 * (iy + 1);
      const d = numberOfVertices + (ix + 1) + gridX1 * iy;

      // modify faces

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // update total number of vertices

  attributes.numberOfVertices += vertexCounter;
}

export interface PlaneGeometry {
  width: number;
  height: number;
  widthSegments: number;
  heightSegments: number;
}
export class PlaneGeometry extends Geometry {
  constructor(options?: Partial<PlaneGeometry>) {
    super();
    Object.assign(this, {
      width: 1,
      height: 1,
      widthSegments: 1,
      heightSegments: 1,
      ...options,
    });

    const { width, height } = this;

    // segments

    const widthSegments = Math.floor(this.widthSegments);
    const heightSegments = Math.floor(this.heightSegments);

    // buffers

    const attributes = {
      indices: [],
      vertices: [],
      normals: [],
      uvs: [],
      numberOfVertices: 0,
    };

    buildPlane(
      Axis.x,
      Axis.z,
      Axis.y,
      1,
      1,
      width,
      height,
      0,
      widthSegments,
      heightSegments,
      0,
      attributes
    );

    // build geometry
    this.positions = new BufferAttribute(
      new Float32Array(attributes.vertices),
      VertexAttributeElementSize.POSITION
    );
    this.normals = new BufferAttribute(
      new Float32Array(attributes.normals),
      VertexAttributeElementSize.NORMAL
    );
    this.uvs = new BufferAttribute(
      new Float32Array(attributes.uvs),
      VertexAttributeElementSize.UV
    );
    this.indices = new BufferAttribute(
      new Uint16Array(attributes.indices),
      VertexAttributeElementSize.INDICE
    );
  }
}
