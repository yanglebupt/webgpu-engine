import {
  ShaderDataDefinitions,
  StructuredView,
  getSizeAndAlignmentOfUnsizedArrayElement,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";
import { Vec3, Vec4 } from "wgpu-matrix";
import { L_NAME, LightGroupBinding } from "../shaders";

export interface Light {
  type: number;
  color: Vec4;
  flux: number;
  dir?: Vec3;
  pos?: Vec3;
}
export class Light {
  static defs: ShaderDataDefinitions;
  static view: (nums: number) => StructuredView;
  static elementByteSize: number;

  static {
    try {
      Light.defs = makeShaderDataDefinitions(LightGroupBinding);
      Light.elementByteSize = getSizeAndAlignmentOfUnsizedArrayElement(
        Light.defs.storages[L_NAME]
      ).size;
      Light.view = (nums: number) =>
        makeStructuredView(
          Light.defs.storages[L_NAME],
          new ArrayBuffer(nums * Light.elementByteSize)
        );
    } catch (error) {}
  }
}

export enum LightType {
  DIRECTION = 1,
  POINT = 2,
}

export class DirectionLight extends Light {
  public type = 1;
  constructor(public dir: Vec3, public color: Vec4, public flux: number) {
    super();
  }
}

export class PointLight extends Light {
  public type = 2;
  constructor(public pos: Vec3, public color: Vec4, public flux: number) {
    super();
  }
}
