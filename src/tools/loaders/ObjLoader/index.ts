import { BufferGeometry } from "../../geometrys/BufferGeometry";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { Mesh } from "../../objects/Mesh";

export class ObjLoader {
  async load(filename: string) {
    const content = await (await fetch(filename)).text();
    let lines = content.split("\n");
    ///////////////////////////////
    let vertexCache: number[][] = [];
    let uvCache: number[][] = [];
    let normCache: number[][] = [];
    let faceCache: string[][] = [];
    ///////////////////////////////
    let name = filename.split("/").at(-1) ?? "";
    const comments: string[] = [];
    lines.forEach((line) => {
      const strim = line.trim();
      const [mark, ...data] = strim.split(" ");
      if (mark === "#") {
        comments.push(data.join(" "));
      } else if (mark === "o") name = data.join(" ");
      else if (mark === "v") vertexCache.push(data.map(parseFloat));
      else if (mark === "vt") uvCache.push(data.map(parseFloat));
      else if (mark === "vn") normCache.push(data.map(parseFloat));
      else if (mark === "f") faceCache.push(data);
      else {
      }
    });

    //////////////////////////////
    const vertices: number[] = [];
    const uvs: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    //////////////////////////////
    let remapping: Record<string, number> = {};
    let i = 0;
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
          .map((s) => Number(s) - 1);
        if (vertexIndex > -1) {
          vertices.push(...vertexCache[vertexIndex]);
        }
        if (normIndex > -1) {
          normals.push(...normCache[normIndex]);
        }
        if (uvIndex > -1) {
          uvs.push(...uvCache[uvIndex]);
        }
        i++;
      }
    }
    {
      //@ts-ignore
      remapping = null;
      //@ts-ignore
      vertexCache = null;
      //@ts-ignore
      uvCache = null;
      //@ts-ignore
      normCache = null;
      //@ts-ignore
      faceCache = null;
      //@ts-ignore
      lines = null;
    }
    console.log(vertices.length, indices.length);
    const mesh = new Mesh(
      new BufferGeometry({
        vertices,
        indices,
        normals: normals.length > 0 ? normals : undefined,
        uvs: uvs.length > 0 ? uvs : undefined,
        indexFormat: "uint32", //  这里一定要用 uint32，一些大模型肯定会超过 uint16
      }),
      new MeshBasicMaterial()
    );
    mesh.name = name;
    mesh.description = comments.join("\n");
    return mesh;
  }
}
