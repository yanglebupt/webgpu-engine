import { BufferGeometry } from "../../geometrys/BufferGeometry";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { Mesh } from "../../objects/Mesh";
import { waitUnitCondition } from "../../common";
import { MeshPhysicalMaterial } from "../../materials/MeshPhysicalMaterial";
import { Logger } from "../../helper";
import { Texture } from "../../textures/Texture";
import { Group } from "../../objects/Group";
import { EntityObject } from "../../entitys/EntityObject";

const lossColor = [1, 0, 0, 1];
const defaultColor = [1, 1, 1, 1];

function tryWrapGroup(objects: EntityObject[]) {
  return objects.length > 1 ? new Group(objects) : objects[0];
}

class ObjParser {
  ///////////////////////////////
  public vertexCache: number[][] = [];
  public uvCache: number[][] = [];
  public normCache: number[][] = [];
  public faceCacheMap: Record<string, string[][]> = {};
  public preIndex: number[] = [1, 1, 1];
  public usemtl: string = "";
  ///////////////////////////////

  constructor(public name: string) {}

  addLine(mark: string, ...data: string[]) {
    if (mark === "v") this.vertexCache.push(data.map(parseFloat));
    else if (mark === "vt") this.uvCache.push(data.map(parseFloat));
    else if (mark === "vn") this.normCache.push(data.map(parseFloat));
    else if (mark === "usemtl") {
      this.usemtl = data.join(" ");
    } else if (mark === "f") {
      let faceCache = this.faceCacheMap[this.usemtl];
      if (!faceCache) {
        faceCache = [];
        this.faceCacheMap[this.usemtl] = faceCache;
      }
      faceCache.push(data);
    }
  }

  async load(
    parentPath: string,
    mtlCollection: Record<string, MtlMaterial> | null
  ) {
    const meshes: Mesh[] = [];
    let remapping: Record<string, number> = {};
    let i = 0;

    for (const usemtl in this.faceCacheMap) {
      const faceCache = this.faceCacheMap[usemtl];
      const mtl = mtlCollection && usemtl ? mtlCollection[usemtl] : undefined;
      //////////////////////////////
      const vertices: number[] = [];
      const uvs: number[] = [];
      const normals: number[] = [];
      const indices: number[] = [];
      //////////////////////////////
      remapping = {};
      i = 0;
      for (const face of faceCache) {
        // 有可能是四角面或者三角面
        const preIndices: number[] = [];
        for (let index = 0, len = face.length; index < len; index++) {
          const faceVertex = face[index];
          if (index === 3) {
            indices.push(preIndices[0], preIndices[2]);
          }
          if (remapping[faceVertex] !== undefined) {
            const i = remapping[faceVertex];
            indices.push(i);
            preIndices.push(i);
            continue;
          }
          remapping[faceVertex] = i;
          indices.push(i);
          preIndices.push(i);
          const [vertexIndex, uvIndex, normIndex] = faceVertex
            .split("/")
            .map((s, i) => Number(s) - this.preIndex[i]);
          if (vertexIndex > -1) {
            vertices.push(...this.vertexCache[vertexIndex]);
          }
          if (uvIndex > -1) {
            uvs.push(...this.uvCache[uvIndex]);
          }
          if (normIndex > -1) {
            normals.push(...this.normCache[normIndex]);
          }
          i++;
        }
      }

      const mesh = new Mesh(
        new BufferGeometry({
          vertices,
          indices,
          normals: normals.length > 0 ? normals : undefined,
          uvs: uvs.length > 0 ? uvs : undefined,
          indexFormat: "uint32", //  这里一定要用 uint32，一些大模型肯定会超过 uint16
        }),
        mtl
          ? await this.createMaterialFromMtl(parentPath, mtl)
          : new MeshBasicMaterial({
              color: usemtl ? lossColor : defaultColor,
            })
      );
      mesh.name = usemtl;
      meshes.push(mesh);
    }

    {
      //@ts-ignore
      remapping = null;
      //@ts-ignore
      this.vertexCache = null;
      //@ts-ignore
      this.uvCache = null;
      //@ts-ignore
      this.normCache = null;
      //@ts-ignore
      this.faceCache = null;
    }

    const object = tryWrapGroup(meshes);
    object.name = this.name;

    return object;
  }

  async createMaterialFromMtl(parentPath: string, mtl: MtlMaterial) {
    const options: Partial<MeshPhysicalMaterial> = {};
    let n: number = 0;
    let texParams: MtlTextureParams;
    for (const prop in mtl) {
      const value = mtl[prop as keyof MtlMaterial];
      switch (prop.toLowerCase()) {
        // Ns is material specular exponent

        case "kd":
          // Diffuse color (color under white light) using RGB values

          options.baseColorFactor = [...(value as number[]), 1];

          break;

        case "ks":
          // Specular color (color when light is reflected from shiny surface) using RGB values
          break;

        case "ke":
          // Emissive using RGB values
          options.emissiveFactor = value as number[];

          break;

        case "map_kd":
          // Diffuse texture map
          texParams = value as MtlTextureParams;
          options.baseColorTexture = await new Texture(
            `${parentPath}/${texParams.url}`
          ).load();

          break;

        case "map_ks":
          // Specular map

          break;

        case "map_ke":
          // Emissive map
          texParams = value as MtlTextureParams;
          options.emissiveTexture = await new Texture(
            `${parentPath}/${texParams.url}`
          ).load();

          break;

        case "norm":
          // Normal map
          texParams = value as MtlTextureParams;
          options.normalTexture = await new Texture(
            `${parentPath}/${texParams.url}`
          ).load();
          options.applyNormalMap = true;
          options.normalScale = texParams.bumpScale ?? 1;

          break;

        case "map_bump":
        case "bump":
          // Bump texture map

          texParams = value as MtlTextureParams;
          options.bumpTexture = await new Texture(
            `${parentPath}/${texParams.url}`
          ).load();
          options.applyNormalMap = true;
          options.bumpScale = texParams.bumpScale ?? 1;

          break;

        case "map_d":
          // Alpha map

          options.alphaTexture = await new Texture(value as string).load();
          options.transparent = true;

          break;

        case "ns":
          // The specular exponent (defines the focus of the specular highlight)
          // A high exponent results in a tight, concentrated highlight. Ns values normally range from 0 to 1000.
          // shinness = 1000 * (1-roughness) * (1-roughness)

          n = value as number;
          options.roughnessFactor = 1 - Math.sqrt(n / 1000);

          break;

        case "d":
          n = value as number;

          if (n < 1) {
            options.opacity = n;
            options.transparent = true;
          }
          break;

        case "tr":
          n = value as number;

          if (n > 0) {
            options.opacity = 1 - n;
            options.transparent = true;
          }

          break;

        default:
          break;
      }
    }
    return new MeshPhysicalMaterial(options);
  }
}

interface MtlTextureParams {
  url: string;
  bumpScale: number;
  scale: number[];
  offset: number[];
}
interface MtlMaterial {
  kd: number[];
  ks: number[];
  ke: number[];
  ns: number;
  ni: number;
  d: number;
  illum: number;
  map_kd: MtlTextureParams;
  map_ks: MtlTextureParams;
  map_ke: MtlTextureParams;
  map_bump: MtlTextureParams;
  map_norm: MtlTextureParams;
  map_d: MtlTextureParams;
}
class MtlMaterial {
  constructor(public name: string) {}

  addLine(_mark: string, ...data: string[]) {
    const mark = _mark.trim().toLowerCase();
    if (mark === "kd" || mark === "ks" || mark === "ke") {
      Reflect.set(this, mark, data.map(parseFloat));
    } else if (
      mark === "map_kd" ||
      mark === "map_ks" ||
      mark === "map_ke" ||
      // alpha 贴图
      mark === "map_d"
    ) {
      Reflect.set(this, mark, this.getTextureParams(data));
    } else if (
      // 法线贴图
      mark === "norm"
    ) {
      Reflect.set(this, "map_norm", this.getTextureParams(data));
    } else if (
      // bump 贴图
      mark === "map_bump" ||
      mark === "bump"
    ) {
      Reflect.set(this, "map_bump", this.getTextureParams(data));
    } else if (mark === "ns" || mark === "ni" || mark === "d") {
      Reflect.set(this, mark, parseFloat(data.join(" ")));
    } else if (mark === "illum") {
      Reflect.set(this, mark, parseInt(data.join(" ")));
    }
  }

  getTextureParams(items: string[]) {
    const texParams: MtlTextureParams = {
      url: "",
      bumpScale: 1,
      scale: [1, 1],
      offset: [0, 0],
    };

    let pos;

    pos = items.indexOf("-bm");

    if (pos >= 0) {
      texParams.bumpScale = parseFloat(items[pos + 1]);
      items.splice(pos, 2);
    }

    // 3D UVW

    pos = items.indexOf("-s");

    if (pos >= 0) {
      texParams.scale = [
        parseFloat(items[pos + 1]),
        parseFloat(items[pos + 2]),
      ];
      items.splice(pos, 4); // we expect 3 parameters here!
    }

    pos = items.indexOf("-o");

    if (pos >= 0) {
      texParams.offset = [
        parseFloat(items[pos + 1]),
        parseFloat(items[pos + 2]),
      ];
      items.splice(pos, 4); // we expect 3 parameters here!
    }

    texParams.url = items.join(" ").trim();

    return texParams;
  }
}

class MtlLoader {
  async load(filename: string) {
    const content = await (await fetch(filename)).text();
    if (!!!content) return null;
    let lines = content.split("\n");
    const comments: string[] = [];
    const mtlCollection: Record<string, MtlMaterial> = {};
    let currentMtl: MtlMaterial | undefined;

    lines.forEach((line) => {
      const strim = line.trim();
      const [mark, ...data] = strim.split(" ");
      if (mark === "newmtl") {
        if (currentMtl) {
          mtlCollection[currentMtl.name] = currentMtl;
        }
        const name = data.join(" ");
        currentMtl = new MtlMaterial(name);
      } else if (mark === "#") comments.push(data.join(" "));
      else if (currentMtl) {
        currentMtl.addLine(mark, ...data);
      }
    });

    if (currentMtl) mtlCollection[currentMtl.name] = currentMtl;

    {
      //@ts-ignore
      lines = null;
    }

    return mtlCollection;
  }
}

export class ObjLoader {
  async load(filename: string) {
    const content = await (await fetch(filename)).text();
    let lines = content.split("\n");

    const res = filename.match(/^(.*)\/(.*)\.obj/);
    if (!res) {
      throw new Error("Invalid filename path");
    }
    const parentPath = res[1];
    const name = res[2];

    const comments: string[] = [];
    let objects: ObjParser[] = [];
    let mtllib = "";
    let currentObject: ObjParser | undefined;
    const mtlLoader = new MtlLoader();
    let mtlCollection: Record<string, MtlMaterial> | null | undefined;

    lines.forEach((line) => {
      const strim = line.trim();
      const [mark, ...data] = strim.split(" ");
      if (mark === "o") {
        if (currentObject) {
          // 解析上一个
          objects.push(currentObject);
        }
        const preIndex = currentObject
          ? [
              currentObject.vertexCache.length + 1,
              currentObject.uvCache.length + 1,
              currentObject.normCache.length + 1,
            ]
          : [1, 1, 1];
        // 开始一个新的 ObjParse
        currentObject = new ObjParser(data.join(" "));
        currentObject.preIndex = preIndex;
      } else if (mark === "#") {
        comments.push(data.join(" "));
      } else if (mark === "mtllib") {
        mtllib = data.join(" ");
        mtlLoader
          .load(`${parentPath}/${mtllib}`)
          .then((m) => (mtlCollection = m));
      } else {
        if (!currentObject) currentObject = new ObjParser(name);
        currentObject.addLine(mark, ...data);
      }
    });

    if (currentObject) objects.push(currentObject);

    !!mtllib &&
      (await waitUnitCondition(10, () => {
        Logger.log("paser mtl..");
        return mtlCollection !== undefined;
      }));

    const meshs = await Promise.all(
      objects.map((o) => o.load(parentPath, mtlCollection!))
    );

    {
      //@ts-ignore
      lines = null;
      objects = [];
      mtlCollection = null;
    }

    return tryWrapGroup(meshs);
  }
}
