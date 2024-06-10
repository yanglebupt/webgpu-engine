import { BufferGeometry } from "../../geometrys/BufferGeometry";
import { MeshBasicMaterial } from "../../materials/MeshBasicMaterial";
import { Mesh } from "../../objects/Mesh";

export class ObjLoader {
  async load(filename: string) {
    const content = await (await fetch(filename)).text();
    const lines = content.split("\n");
    ///////////////////////////////
    const vertexCache: number[][] = [];
    const uvCache: number[][] = [];
    const normCache: number[][] = [];
    const faceCache: string[][] = [];
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
    const remapping: Record<string, number> = {};
    let i = 0;
    for (const face of faceCache) {
      for (const faceVertex of face) {
        if (remapping[faceVertex] !== undefined) {
          indices.push(remapping[faceVertex]);
          continue;
        }
        remapping[faceVertex] = i;
        indices.push(i);
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
    const mesh = new Mesh(
      new BufferGeometry({
        vertices,
        indices,
        normals: normals.length > 0 ? normals : undefined,
        uvs: uvs.length > 0 ? uvs : undefined,
        indexFormat: "uint32",
      }),
      new MeshBasicMaterial()
    );
    mesh.name = name;
    mesh.description = comments.join("\n");
    return mesh;
  }
}
