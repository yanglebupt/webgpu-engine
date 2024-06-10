import {
  BufferAttribute,
  Geometry,
  VertexAttributeElementSize,
} from "./Geometry";

export class BufferGeometry extends Geometry {
  constructor(attributes: {
    vertices: number[];
    indices?: number[];
    normals?: number[];
    uvs?: number[];
  }) {
    super();
    // build geometry
    this.positions = new BufferAttribute(
      new Float32Array(attributes.vertices),
      VertexAttributeElementSize.POSITION
    );
    if (attributes.normals)
      this.normals = new BufferAttribute(
        new Float32Array(attributes.normals),
        VertexAttributeElementSize.NORMAL
      );
    if (attributes.uvs)
      this.uvs = new BufferAttribute(
        new Float32Array(attributes.uvs),
        VertexAttributeElementSize.UV
      );
    if (attributes.indices)
      this.indices = new BufferAttribute(
        new Uint16Array(attributes.indices),
        VertexAttributeElementSize.INDICE
      );
  }
}
