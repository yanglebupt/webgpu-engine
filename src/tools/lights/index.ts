import {
  ShaderDataDefinitions,
  StructuredView,
  getSizeAndAlignmentOfUnsizedArrayElement,
  makeShaderDataDefinitions,
  makeStructuredView,
} from "webgpu-utils";
import { Vec3, Vec4, vec3 } from "wgpu-matrix";
import { L_NAME, LightGroupBinding } from "../shaders";

export enum LightType {
  DIRECTION = 1,
  POINT = 2,
}

export interface Light {
  type: LightType;
  color: Vec4;
  flux: number;
  dir?: Vec3;
  pos?: Vec3;
}

export class Light {
  static defs: ShaderDataDefinitions;
  static view: (nums: number) => StructuredView;
  static getViewSize: (nums: number) => number;
  static elementByteSize: number;

  static {
    try {
      Light.defs = makeShaderDataDefinitions(LightGroupBinding);
      Light.elementByteSize = getSizeAndAlignmentOfUnsizedArrayElement(
        Light.defs.storages[L_NAME]
      ).size;
      Light.getViewSize = (nums: number) => {
        return Light.defs.storages[L_NAME].size + nums * Light.elementByteSize;
      };
      Light.view = (nums: number) =>
        makeStructuredView(
          Light.defs.storages[L_NAME],
          new ArrayBuffer(Light.getViewSize(nums))
        );
    } catch (error) {}
  }

  getBufferView() {
    return {
      dir: this.dir ?? vec3.zero(),
      pos: this.pos ?? vec3.zero(),
      color: this.color,
      flux: this.flux,
      ltype: this.type,
    };
  }
}

export class DirectionLight extends Light {
  public type = LightType.DIRECTION;
  constructor(public dir: Vec3, public color: Vec4, public flux: number) {
    super();
  }
}

export class PointLight extends Light {
  public type = LightType.POINT;
  constructor(public pos: Vec3, public color: Vec4, public flux: number) {
    super();
  }
}
