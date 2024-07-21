import { Iter } from "../common";
import { isEqual } from "lodash-es";
import { StaticTextureUtil } from "../utils/StaticTextureUtil";
import { Logger } from "../helper";
import { ShaderContext, ShaderModuleCode } from "../shaders";
import { v4 as uuidv4 } from "uuid";
import { CreateAndSetRecord } from "../loaders";

export function clearEmptyPropertyOfObject(obj: any) {
  Object.keys(obj).forEach((key) => {
    let value = obj[key];
    value && typeof value === "object" && clearEmptyPropertyOfObject(value);
    (value === "" ||
      value === null ||
      value === undefined ||
      value.length === 0 ||
      (typeof value === "object" && Object.keys(value).length === 0)) &&
      delete obj[key];
  });
  return obj;
}

/**
 * 使用 lodash.isEqual 来深度比较两个对象是否一样
 */
export abstract class ObjectStringKeyCache<O extends Object, V, C = any> {
  abstract create(key: O, createOptions?: C): V;
  abstract _default: O | null;
  private cached: Map<Object, V> = new Map<Object, V>();
  constructor(public device: GPUDevice) {}
  get(key: O): V;
  get(key: O, create?: (key: O, createOptions?: C) => V, createOptions?: C): V;
  get(key: O, create?: (key: O, createOptions?: C) => V, createOptions?: C): V {
    // 清除 underfined 属性，确保一致性，考虑 JSON.stringify/JSON.parse 的性能问题，可以自己实现一个清除 underfined 属性的类
    clearEmptyPropertyOfObject(key);
    const fk = Iter.filter(this.cached.keys(), (k) => {
      clearEmptyPropertyOfObject(k);
      return isEqual(k, key);
    });
    if (fk.length == 0) {
      // 新建然后插入，返回
      const value = (create ?? this.create.bind(this))(key, createOptions);
      this.cached.set(key, value);
      return value;
    } else if (fk.length == 1) {
      Logger.log("get from cache", Reflect.get(this, "constructor").name);
      return this.cached.get(fk[0])!;
    } else {
      throw new Error("The key is duplicated");
    }
  }
  clear() {
    this.cached.clear();
  }
  delete(key: O) {
    // return this.cached.delete(JSON.stringify(key)); // TODO
  }
  get default(): V {
    if (!this._default) throw new Error("The default is null, cannot use");
    return this.get(this._default);
  }
}

////////// GPUSamplerCache //////////
export class GPUSamplerCache extends ObjectStringKeyCache<
  GPUSamplerDescriptor,
  GPUSampler
> {
  _default: GPUSamplerDescriptor = {
    addressModeU: "repeat",
    addressModeV: "repeat",
    minFilter: "linear",
    magFilter: "linear",
    mipmapFilter: "linear",
  };
  create(key: GPUSamplerDescriptor) {
    Logger.log(`create sampler: ${JSON.stringify(key)}`);
    return this.device.createSampler(key);
  }
}

////////// SolidColorTextureCache //////////
export type SolidColorTextureType =
  | "opaqueWhiteTexture"
  | "transparentBlackTexture"
  | "defaultNormalTexture";
export type SolidColorTextureCacheKey = {
  format: GPUTextureFormat;
  type: SolidColorTextureType;
};
export const SolidColor: Record<SolidColorTextureType, number[]> = {
  opaqueWhiteTexture: [1, 1, 1, 1],
  transparentBlackTexture: [0, 0, 0, 0],
  defaultNormalTexture: [0.5, 0.5, 1, 1],
};
export class SolidColorTextureCache extends ObjectStringKeyCache<
  SolidColorTextureCacheKey,
  GPUTexture
> {
  _default: SolidColorTextureCacheKey = {
    format: StaticTextureUtil.textureFormat.split("-")[0] as GPUTextureFormat,
    type: "transparentBlackTexture",
  };
  create({ format, type }: SolidColorTextureCacheKey): GPUTexture {
    Logger.log("creat texture", format, type);
    const data = new Uint8Array(SolidColor[type].map((v) => v * 255));
    const texture = this.device.createTexture({
      size: [1, 1],
      format: format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.device.queue.writeTexture(
      { texture: texture },
      data,
      {},
      { width: 1, height: 1 }
    );
    return texture;
  }
}

////////// GPUShaderModuleCache //////////
class GPUShaderCodeCache extends ObjectStringKeyCache<
  ShaderContext,
  GPUShaderModule
> {
  _default: ShaderContext = {};
  id: string;
  constructor(device: GPUDevice, public code: ShaderModuleCode) {
    super(device);
    this.id = uuidv4();
  }
  create(key: ShaderContext): GPUShaderModule {
    Logger.log("create shader module", key);
    return this.device.createShaderModule({
      code: this.code(key),
    });
  }
}
type GPURenderPipelineCacheShaderKey = { id: string; context: ShaderContext };
export type GPUShaderModuleCacheKey<T = Record<string, any>> = {
  code: ShaderModuleCode<T>;
  context: ShaderContext;
};
type GPUShaderModuleCacheReturn = { id: string; module: GPUShaderModule };
export class GPUShaderModuleCache {
  private cached: Map<ShaderModuleCode, GPUShaderCodeCache> = new Map();
  constructor(public device: GPUDevice) {}
  get<T>(options: GPUShaderModuleCacheKey<T>): GPUShaderModuleCacheReturn;
  get<T>(options: GPURenderPipelineCacheShaderKey): GPUShaderModuleCacheReturn;
  get<T>(
    code: ShaderModuleCode,
    context: ShaderContext
  ): GPUShaderModuleCacheReturn;
  get<T>(id: string, context: ShaderContext): GPUShaderModuleCacheReturn;
  get<T>(
    _code:
      | ShaderModuleCode
      | string
      | GPURenderPipelineCacheShaderKey
      | GPUShaderModuleCacheKey<T>,
    _context?: ShaderContext
  ) {
    let code: ShaderModuleCode | undefined;
    let context: ShaderContext | undefined;
    let id: string | undefined;
    if (typeof _code === "string") {
      id = _code;
      context = _context ?? {};
    } else if (typeof _code === "function") {
      code = _code;
      context = _context ?? {};
    } else if (Reflect.has(_code, "code")) {
      code = (_code as GPUShaderModuleCacheKey).code;
      context = (_code as GPUShaderModuleCacheKey).context;
    } else if (Reflect.has(_code, "id")) {
      id = (_code as GPURenderPipelineCacheShaderKey).id;
      context = (_code as GPUShaderModuleCacheKey).context;
    } else {
      throw new Error("Unsupported parameters");
    }
    let shaderCodeCached: GPUShaderCodeCache | undefined;
    if (code != undefined) {
      const res = this.cached.get(code);
      if (!res) {
        shaderCodeCached = new GPUShaderCodeCache(this.device, code);
        this.cached.set(code, shaderCodeCached);
      } else {
        shaderCodeCached = res;
      }
    } else if (id != undefined) {
      const res = Iter.filter(this.cached.values(), (v) => v.id == id);
      if (res.length == 0) throw new Error("Shader code id not found");
      if (res.length > 1) throw new Error("Shader code id duplicated");
      shaderCodeCached = res[0];
    }
    if (shaderCodeCached == undefined)
      throw new Error("Shader code cached not found");
    return { id: shaderCodeCached.id, module: shaderCodeCached.get(context) };
  }
}

////////// GPUBindGroupLayoutCache //////////
export class GPUBindGroupLayoutCache extends ObjectStringKeyCache<
  GPUBindGroupLayoutEntry[],
  GPUBindGroupLayout
> {
  // 补充一些常见的 GPUBindGroupLayout
  _default: GPUBindGroupLayoutEntry[] = [
    {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: "read-only-storage" },
    },
  ];
  create(key: GPUBindGroupLayoutEntry[]): GPUBindGroupLayout {
    const bindGroup = this.device.createBindGroupLayout({ entries: key });
    bindGroup.id = uuidv4();
    return bindGroup;
  }
}

////////// GPURenderPipelineCache //////////
export type BlendMode = "OPAQUE" | "MASK" | "BLEND";
type GPURenderPipelineCacheArgsKey = {
  format: GPUTextureFormat;
  primitive: GPUPrimitiveState;
  depthStencil?: GPUDepthStencilState;
  multisample?: GPUMultisampleState;
  alphaMode?: BlendMode;
  doubleSided?: boolean;
  bufferLayout?: GPUVertexBufferLayout[];
  blending?: GPUBlendState;
};
type GPURenderPipelineCacheKey = {
  vertex: GPURenderPipelineCacheShaderKey;
  fragment: GPURenderPipelineCacheShaderKey;
  args: GPURenderPipelineCacheArgsKey;
  bindGroupLayouts: string[];
};
type GPURenderPipelineCreateOptions = {
  vertexModule: GPUShaderModule;
  fragmentModule: GPUShaderModule;
  bindGroupLayouts: GPUBindGroupLayout[];
  record?: CreateAndSetRecord;
};
export class GPURenderPipelineCache extends ObjectStringKeyCache<
  GPURenderPipelineCacheKey,
  GPURenderPipeline,
  GPURenderPipelineCreateOptions
> {
  _default = null;
  private shaderCached: GPUShaderModuleCache;
  constructor(device: GPUDevice) {
    super(device);
    this.shaderCached = new GPUShaderModuleCache(device);
  }

  private getBlend(alphaMode?: BlendMode) {
    switch (alphaMode) {
      case "BLEND":
        return {
          color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
          alpha: { srcFactor: "one", dstFactor: "one" },
        } as GPUBlendState;
    }
  }

  create(
    { args }: GPURenderPipelineCacheKey,
    {
      vertexModule,
      fragmentModule,
      bindGroupLayouts,
      record,
    }: GPURenderPipelineCreateOptions
  ): GPURenderPipeline {
    const blend = this.getBlend(args.alphaMode) ?? args.blending;
    record && record.pipelineCount++;
    Logger.log("create pipeline");
    return this.device.createRenderPipeline({
      layout: this.device.createPipelineLayout({ bindGroupLayouts }),
      vertex: {
        module: vertexModule,
        entryPoint: "main",
        buffers: args.bufferLayout,
      },
      fragment: {
        module: fragmentModule,
        entryPoint: "main",
        targets: [{ format: args.format, blend }],
      },
      primitive: {
        cullMode: !!args.doubleSided ? "none" : "back",
        ...args.primitive,
      },
      depthStencil: args.depthStencil,
      multisample: args.multisample,
    });
  }

  // @ts-ignore
  get<T, B>(
    vertex: GPUShaderModuleCacheKey<T>,
    fragment: GPUShaderModuleCacheKey<B>,
    args: GPURenderPipelineCacheArgsKey,
    // 后面很多情况需要自己手动创建 layout，可以通过 label 来标识唯一但很难使用
    // 还是需要自己来标识唯一
    bindGroupLayouts: GPUBindGroupLayout[],
    createOptions?: {
      record?: CreateAndSetRecord;
    }
  ) {
    // 构建 key
    const { id: vertexId, module: vertexModule } =
      this.shaderCached.get(vertex);
    const { id: fragmentId, module: fragmentModule } =
      this.shaderCached.get(fragment);
    const key: GPURenderPipelineCacheKey = {
      vertex: { id: vertexId, context: vertex.context },
      fragment: { id: fragmentId, context: fragment.context },
      args,
      bindGroupLayouts: bindGroupLayouts.map((b) => b.id),
    };
    return super.get(
      key,
      this.create.bind(this) as (
        key: GPURenderPipelineCacheKey,
        createOptions?: GPURenderPipelineCreateOptions
      ) => GPURenderPipeline,
      {
        vertexModule,
        fragmentModule,
        bindGroupLayouts,
        ...createOptions,
      }
    );
  }
}
