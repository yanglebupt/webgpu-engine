import {
  BufferAttribute,
  Geometry,
  VertexAttributeElementSize,
} from "./Geometry";

// modify from https://github.com/mrdoob/three.js/blob/master/src/geometries/WireframeGeometry.js

export function isUniqueEdge(
  start: number[],
  end: number[],
  edges: Set<string>
) {
  const hash1 = `${start[0]},${start[1]},${start[2]}-${end[0]},${end[1]},${end[2]}`;
  const hash2 = `${end[0]},${end[1]},${end[2]}-${start[0]},${start[1]},${start[2]}`; // coincident edge

  if (edges.has(hash1) || edges.has(hash2)) {
    return false;
  } else {
    edges.add(hash1);
    edges.add(hash2);
    return true;
  }
}

export function isUniqueVertex(vertex: number[], vertices: Array<number[]>) {
  const hash = vertex.join(",");
  const idx = vertices.findIndex((v) => v.join(",") === hash);
  if (idx >= 0) {
    return idx;
  } else {
    vertices.push(vertex);
    return vertices.length - 1;
  }
}

export class WireframeGeometry extends Geometry {
  // 可以通过 vertexMapping 来找到点与点的对应关系
  vertexMapping: Array<Set<number>> = [];
  constructor(geometry: Geometry) {
    super();
    const { positions, indices } = geometry;

    // buffer

    const vertices: Array<[number, number, number]> = [];
    const _indices: number[] = [];
    const edges = new Set<string>();

    // create a data structure that contains all edges without duplicates

    const handleFace = (a: number, b: number, c: number) => {
      const p1 = positions.get(a);
      const p2 = positions.get(b);
      const p3 = positions.get(c);

      // lines
      (
        [
          [p1, p2, a, b],
          [p2, p3, b, c],
          [p3, p1, c, a],
        ] as Array<[number[], number[], number, number]>
      ).forEach(([start, end, startIdx, endIdx]) => {
        const _isUniqueEdge = isUniqueEdge(start, end, edges);

        let idx = isUniqueVertex(start, vertices);
        _isUniqueEdge && _indices.push(idx);
        this.pushVertexMapping(idx, startIdx);

        idx = isUniqueVertex(end, vertices);
        _isUniqueEdge && _indices.push(idx);
        this.pushVertexMapping(idx, endIdx);
      });
    };

    if (indices) {
      for (let i = 0, l = indices.length; i < l; i += 3) {
        // face
        const a = indices.get(i)[0];
        const b = indices.get(i + 1)[0];
        const c = indices.get(i + 2)[0];

        handleFace(a, b, c);
      }
    } else {
      for (let i = 0, l = positions.count; i < l; i += 3) {
        // face
        handleFace(i, i + 1, i + 2);
      }
    }

    edges.clear();

    this.positions = new BufferAttribute(
      new Float32Array(vertices.flat()),
      VertexAttributeElementSize.POSITION
    );
    this.indices = new BufferAttribute(
      new (this.indexFormat === "uint16" ? Uint16Array : Uint32Array)(_indices),
      VertexAttributeElementSize.INDICE
    );
  }

  private pushVertexMapping(idx: number, ridx: number) {
    let ridxs = this.vertexMapping[idx];
    if (!ridxs) {
      ridxs = new Set();
      this.vertexMapping[idx] = ridxs;
    }
    ridxs.add(ridx);
  }
}
