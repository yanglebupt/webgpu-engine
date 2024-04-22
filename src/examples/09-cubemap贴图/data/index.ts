export function createCubeVertex(device: GPUDevice) {
  const vertexData = new Float32Array([
    // front face
    -1, 1, 1, -1, -1, 1, 1, 1, 1, 1, -1, 1,
    // right face
    1, 1, -1, 1, 1, 1, 1, -1, -1, 1, -1, 1,
    // back face
    1, 1, -1, 1, -1, -1, -1, 1, -1, -1, -1, -1,
    // left face
    -1, 1, 1, -1, 1, -1, -1, -1, 1, -1, -1, -1,
    // bottom face
    1, -1, 1, -1, -1, 1, 1, -1, -1, -1, -1, -1,
    // top face
    -1, 1, 1, 1, 1, 1, -1, 1, -1, 1, 1, -1,
  ]);

  const indexFormat: GPUIndexFormat = "uint16";
  const indexData = new Uint16Array([
    0,
    1,
    2,
    2,
    1,
    3, // front
    4,
    5,
    6,
    6,
    5,
    7, // right
    8,
    9,
    10,
    10,
    9,
    11, // back
    12,
    13,
    14,
    14,
    13,
    15, // left
    16,
    17,
    18,
    18,
    17,
    19, // bottom
    20,
    21,
    22,
    22,
    21,
    23, // top
  ]);

  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX,
  });
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  const discription: Iterable<GPUVertexBufferLayout | null> = [
    {
      arrayStride: 3 * 4,
      stepMode: "vertex",
      attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
    },
  ];

  return {
    vertexData,
    indexData,
    vertexBuffer,
    indexBuffer,
    discription,
    numVertices: indexData.length,
    indexFormat,
  };
}
