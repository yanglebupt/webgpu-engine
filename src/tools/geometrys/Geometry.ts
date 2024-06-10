import { TypedArray } from "webgpu-utils";

export class BufferAttribute<T extends TypedArray> {
  constructor(public array: T, public itemSize: number) {}

  get length() {
    return this.array.length;
  }

  get count() {
    return this.array.length / this.itemSize;
  }

  get(itemIndex: number) {
    const l = this.itemSize;
    const start = itemIndex * l;
    const res: number[] = [];
    for (let i = 0; i < l; i++) {
      res.push(this.array[start + i]);
    }
    return res;
  }
}

export type VertexAttribute = "POSITION" | "NORMAL" | "UV" | "INDICE";
export const VertexAttributeElementSize: Record<VertexAttribute, number> = {
  POSITION: 3,
  NORMAL: 3,
  UV: 2,
  INDICE: 1,
};

export interface Geometry {
  positions: BufferAttribute<Float32Array>;
  indices?: BufferAttribute<Uint16Array | Uint32Array>;
  normals?: BufferAttribute<Float32Array>;
  uvs?: BufferAttribute<Float32Array>;
  indexFormat?: GPUIndexFormat;
}

export function U16IndicesToU32Indices(uint16Array: Uint16Array) {
  const len = uint16Array.length;
  const uint32Array = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    uint32Array[i] = uint16Array[i];
  }
  return uint32Array;
}

/**
 * 与 build 有关，需要完成具体的 build 逻辑，当然你也可以
 * 将 Geometry 认为是一个组件，然后由 EntityObject 来 build
 */
export abstract class Geometry {
  indexFormat?: GPUIndexFormat = "uint16";
  constructor() {
    this.checkConsistentLength();
  }

  getCount(attributeName: VertexAttribute) {
    const array = Reflect.get(
      this,
      `${attributeName.toLowerCase()}s`
    ) as TypedArray;
    return array ? array.length / VertexAttributeElementSize[attributeName] : 0;
  }

  checkConsistentLength() {
    const vertexCount = this.getCount("POSITION");
    if (this.uvs && this.getCount("UV") !== vertexCount)
      throw new Error("uv count is not equal to position count");
    if (this.normals && this.getCount("NORMAL") !== vertexCount)
      throw new Error("normal count is not equal to position count");
  }

  get attributes() {
    return {
      positions: this.positions.array,
      normals: this.normals ? this.normals.array : undefined,
      uvs: this.uvs ? this.uvs.array : undefined,
      indices: this.indices ? this.indices.array : undefined,
    };
  }
}
