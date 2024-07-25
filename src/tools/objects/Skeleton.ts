import { BufferGeometry } from "../geometrys/BufferGeometry";
import { MeshBasicMaterial } from "../materials/MeshBasicMaterial";
import { Bone } from "./Bone";
import { Mesh } from "./Mesh";
import { Transform } from "../components/Transform";
import { BuildOptions } from "../scene/types";
import { EmptyObject } from "../entitys/EmptyObject";

interface BoneGeometry {
  width: number;
  height: number;
  startLength: number;
  endLength: number;
}

function createBoneVertexData(options?: Partial<BoneGeometry>) {
  const {
    width = 0.15,
    height = 0.15,
    startLength = 0.2,
    endLength = 0.8,
  } = options ?? {};

  const halfWidth = width / 2;
  const halfHeight = height / 2;
  // 骨骼默认朝向 Z 轴
  const vertices = [
    0,
    0,
    0,
    -halfWidth,
    -halfHeight,
    startLength,
    -halfWidth,
    halfHeight,
    startLength,
    halfWidth,
    halfHeight,
    startLength,
    halfWidth,
    -halfHeight,
    startLength,
    0,
    0,
    startLength + endLength,
  ];

  const indices = [
    0, 4, 1, 0, 1, 2, 0, 2, 3, 0, 3, 4,

    1, 2, 4, 2, 3, 4,

    5, 1, 4, 5, 2, 1, 5, 3, 2, 5, 4, 3,
  ];

  return { vertices, indices };
}

export interface NamedBones {
  [key: string]: Bone[];
}

export class Skeleton extends EmptyObject {
  static material: MeshBasicMaterial;
  static {
    Skeleton.material = new MeshBasicMaterial({
      color: [0.8, 0.8, 0.8, 1],
      wireframe: true,
    });
  }
  type: string = "Skeleton";
  name: string = "Skeleton";
  namedBones: NamedBones;
  visibleObject?: Mesh;
  private instancesTransform: Transform[];
  constructor(namedBones: NamedBones, visible = false) {
    super();
    this.namedBones = namedBones;
    this.instancesTransform = Object.values(namedBones).reduce(
      //@ts-ignore
      (pre, bones) => pre.concat(bones.map((bone) => bone.transform)),
      []
    ) as any as Transform[];
    if (visible) {
      // 可视化和主体逻辑分开，不要放在一个对象上
      this.visibleObject = new Mesh(
        new BufferGeometry(createBoneVertexData()),
        Skeleton.material,
        this.instancesTransform.length
      );
      this.visibleObject.instancesTransform = this.instancesTransform;
    }
  }

  build(options: BuildOptions) {
    this.visibleObject?.build(options);
    super.build(options);
  }

  render(renderPass: GPURenderPassEncoder, device: GPUDevice) {
    this.visibleObject?.render(renderPass, device);
    this.instancesTransform.forEach((transform) => {
      transform.update();
    });
  }

  getBonesByName(part: string) {
    return this.namedBones[part];
  }

  getBoneByName(part: string, name: string) {
    return this.namedBones[part].find((b) => b.name === name);
  }
}
