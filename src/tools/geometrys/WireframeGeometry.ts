import {
  BufferAttribute,
  Geometry,
  VertexAttributeElementSize,
} from "./Geometry";

// https://github.com/mrdoob/three.js/blob/master/src/geometries/WireframeGeometry.js

function isUniqueEdge(start: number[], end: number[], edges: Set<string>) {
  const hash1 = `${start[0]},${start[1]},${start[2]}-${end[0]},${end[1]},${end[2]}`;
  const hash2 = `${end[0]},${end[1]},${end[2]}-${start[0]},${start[1]},${start[2]}`; // coincident edge

  if (edges.has(hash1) === true || edges.has(hash2) === true) {
    return false;
  } else {
    edges.add(hash1);
    edges.add(hash2);
    return true;
  }
}

function isUniqueVertex(vertex: number[], vertices: Array<number[]>) {
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
  constructor(geometry: Geometry) {
    super();
    const { positions, indices } = geometry;

    // buffer

    const vertices: Array<[number, number, number]> = [];
    const _indices: number[] = [];
    const edges = new Set<string>();

    // create a data structure that contains all edges without duplicates

    if (indices) {
      for (let i = 0, l = indices.length; i < l; i += 3) {
        // face

        const a = indices.get(i)[0];
        const b = indices.get(i + 1)[0];
        const c = indices.get(i + 2)[0];

        const p1 = positions.get(a);
        const p2 = positions.get(b);
        const p3 = positions.get(c);

        // lines
        (
          [
            [p1, p2],
            [p2, p3],
            [p3, p1],
          ] as Array<[number[], number[]]>
        ).forEach(([start, end]) => {
          if (isUniqueEdge(start, end, edges) === true) {
            _indices.push(isUniqueVertex(start, vertices));
            _indices.push(isUniqueVertex(end, vertices));
          }
        });
      }
    } else {
      for (let i = 0, l = positions.count; i < l; i += 3) {
        // face
        const p1 = positions.get(i);
        const p2 = positions.get(i + 1);
        const p3 = positions.get(i + 2);

        // lines
        (
          [
            [p1, p2],
            [p2, p3],
            [p3, p1],
          ] as Array<[number[], number[]]>
        ).forEach(([start, end]) => {
          if (isUniqueEdge(start, end, edges) === true) {
            _indices.push(isUniqueVertex(start, vertices));
            _indices.push(isUniqueVertex(end, vertices));
          }
        });
      }
    }

    this.positions = new BufferAttribute(
      new Float32Array(vertices.flat()),
      VertexAttributeElementSize.POSITION
    );
    this.indices = new BufferAttribute(
      new Uint16Array(_indices),
      VertexAttributeElementSize.INDICE
    );

    edges.clear();
  }
}
