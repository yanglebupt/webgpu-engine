import { BufferGeometry } from "../geometrys/BufferGeometry";
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial";
import { Mesh } from "./Mesh";

export class SkeletonMesh extends Mesh<BufferGeometry, MeshBasicMaterial> {
  bonesLength: number[] = [];
  constructor(
    geometry: BufferGeometry,
    material: MeshBasicMaterial,
    instanceCount = 1
  ) {
    super(geometry, material, instanceCount);
  }

  buildWireframe(device: GPUDevice) {
    super.buildWireframe(device);
    this.modifyGeometryBuildResult(device);
  }

  buildGeometry(device: GPUDevice) {
    if (this.material.wireframe) return this.buildWireframe(device);
    super.buildGeometry(device);
    this.modifyGeometryBuildResult(device);
  }

  modifyGeometryBuildResult(device: GPUDevice) {
    this.geometryBuildResult.vertex.context.isSkeleton = true;
    const bindings = this.geometryBuildResult.bindGroupLayoutEntries;
    this.geometryBuildResult.bindGroupLayoutEntries.push({
      binding: bindings[bindings.length - 1].binding + 1,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: "read-only-storage" },
    });
    const buffer = device.createBuffer({
      size: this.bonesLength.length * Uint32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE,
      mappedAtCreation: true,
    });
    this.geometryBuildResult.resources.push(buffer);
    new Float32Array(buffer.getMappedRange()).set(this.bonesLength);
    buffer.unmap();
  }
}
