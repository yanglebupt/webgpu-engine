import { Axis } from "../utils/Dispatch";
import {
  BufferAttribute,
  Geometry,
  VertexAttributeElementSize,
} from "./Geometry";
import { buildPlane } from "./PlaneGeometry";

// modify from https://github.com/mrdoob/three.js/blob/master/src/geometries/BoxGeometry.js

export interface CubeGeometry {
  width: number;
  height: number;
  depth: number;
  widthSegments: number;
  heightSegments: number;
  depthSegments: number;
}
export class CubeGeometry extends Geometry {
  constructor(options?: Partial<CubeGeometry>) {
    super();
    Object.assign(this, {
      width: 1,
      height: 1,
      depth: 1,
      widthSegments: 1,
      heightSegments: 1,
      depthSegments: 1,
      ...options,
    });

    const { width, height, depth } = this;

    // segments

    const widthSegments = Math.floor(this.widthSegments);
    const heightSegments = Math.floor(this.heightSegments);
    const depthSegments = Math.floor(this.depthSegments);

    // buffers

    const attributes = {
      indices: [],
      vertices: [],
      normals: [],
      uvs: [],
      numberOfVertices: 0,
    };

    // build each side of the box geometry

    buildPlane(
      Axis.z,
      Axis.y,
      Axis.x,
      -1,
      -1,
      depth,
      height,
      width,
      depthSegments,
      heightSegments,
      0,
      attributes
    ); // px
    buildPlane(
      Axis.z,
      Axis.y,
      Axis.x,
      1,
      -1,
      depth,
      height,
      -width,
      depthSegments,
      heightSegments,
      1,
      attributes
    ); // nx
    buildPlane(
      Axis.x,
      Axis.z,
      Axis.y,
      1,
      1,
      width,
      depth,
      height,
      widthSegments,
      depthSegments,
      2,
      attributes
    ); // py
    buildPlane(
      Axis.x,
      Axis.z,
      Axis.y,
      1,
      -1,
      width,
      depth,
      -height,
      widthSegments,
      depthSegments,
      3,
      attributes
    ); // ny
    buildPlane(
      Axis.x,
      Axis.y,
      Axis.z,
      1,
      -1,
      width,
      height,
      depth,
      widthSegments,
      heightSegments,
      4,
      attributes
    ); // pz
    buildPlane(
      Axis.x,
      Axis.y,
      Axis.z,
      -1,
      -1,
      width,
      height,
      -depth,
      widthSegments,
      heightSegments,
      5,
      attributes
    ); // nz

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
