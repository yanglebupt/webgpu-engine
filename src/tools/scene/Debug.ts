import { Vec3 } from "wgpu-matrix";
import { BufferGeometry } from "../geometrys/BufferGeometry";
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial";
import { Group } from "../objects/Group";
import { Line } from "../objects/Line";
import { WatchAction } from "../objects/Object3D";
import {
  BufferAttribute,
  VertexAttributeElementSize,
} from "../geometrys/Geometry";

export type DebugLine = [Vec3 | number[], Vec3 | number[]];

// Debug 辅助类
export class Debug extends Group {
  static material: MeshBasicMaterial;
  static {
    Debug.material = new MeshBasicMaterial({
      color: [1, 1, 0, 1],
      wireframe: true,
    });
  }
  constructor() {
    super([new Line(new BufferGeometry({ vertices: [] }), Debug.material)]);
  }

  drawLines(...lines: DebugLine[]) {
    let vertices: number[] = [];
    lines.forEach(([start, end]) => {
      vertices.push(...start);
      vertices.push(...end);
    });
    const lineInstance = this.getFirstChildByType(Line);
    lineInstance.geometry.positions = new BufferAttribute(
      new Float32Array(vertices),
      VertexAttributeElementSize.POSITION
    );
    lineInstance.buildGeometry(
      (lineInstance.getArgumentsList(WatchAction.Geometry) as GPUDevice[])[0]
    );
    //@ts-ignore
    vertices = null;
  }

  destroy() {
    super.destroy();
  }
}
