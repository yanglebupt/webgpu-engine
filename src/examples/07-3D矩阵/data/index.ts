export function createFVertexs(device: GPUDevice) {
  const position = new Float32Array([
    // left column
    0, 0, 0, 30, 0, 0, 0, 150, 0, 30, 150, 0,

    // top rung
    30, 0, 0, 100, 0, 0, 30, 30, 0, 100, 30, 0,

    // middle rung
    30, 60, 0, 70, 60, 0, 30, 90, 0, 70, 90, 0,

    // left column back
    0, 0, 30, 30, 0, 30, 0, 150, 30, 30, 150, 30,

    // top rung back
    30, 0, 30, 100, 0, 30, 30, 30, 30, 100, 30, 30,

    // middle rung back
    30, 60, 30, 70, 60, 30, 30, 90, 30, 70, 90, 30,
  ]);
  const vertexNums = position.length / 3;
  // 2D 下顺逆没影响
  const indexData = new Uint32Array([
    // front
    0,
    1,
    2,
    2,
    1,
    3, // left column
    4,
    5,
    6,
    6,
    5,
    7, // top run
    8,
    9,
    10,
    10,
    9,
    11, // middle run

    // back
    12,
    14,
    13,
    14,
    15,
    13, // left column back
    16,
    18,
    17,
    18,
    19,
    17, // top run back
    20,
    22,
    21,
    22,
    23,
    21, // middle run back

    0,
    12,
    5,
    12,
    17,
    5, // top
    5,
    17,
    7,
    17,
    19,
    7, // top rung right
    6,
    7,
    18,
    18,
    7,
    19, // top rung bottom
    6,
    18,
    8,
    18,
    20,
    8, // between top and middle rung
    8,
    20,
    9,
    20,
    21,
    9, // middle rung top
    9,
    21,
    11,
    21,
    23,
    11, // middle rung right
    10,
    11,
    22,
    22,
    11,
    23, // middle rung bottom
    10,
    22,
    3,
    22,
    15,
    3, // stem right
    2,
    3,
    14,
    14,
    3,
    15, // bottom
    0,
    2,
    12,
    12,
    2,
    14, // left
  ]);
  const indexFormat: GPUIndexFormat = "uint32";
  const indexNums = indexData.length;
  // 颜色
  const quadColors = [
    200,
    70,
    120, // left column front
    200,
    70,
    120, // top rung front
    200,
    70,
    120, // middle rung front

    80,
    70,
    200, // left column back
    80,
    70,
    200, // top rung back
    80,
    70,
    200, // middle rung back

    70,
    200,
    210, // top
    160,
    160,
    220, // top rung right
    90,
    130,
    110, // top rung bottom
    200,
    200,
    70, // between top and middle rung
    210,
    100,
    70, // middle rung top
    210,
    160,
    70, // middle rung right
    70,
    180,
    210, // middle rung bottom
    100,
    70,
    210, // stem right
    76,
    210,
    100, // bottom
    140,
    210,
    80, // left
  ];

  const vertexData = new Float32Array(indexNums * (3 + 1)); // xyz + color
  const colorData = new Uint8Array(vertexData.buffer);

  for (let i = 0; i < indexNums; ++i) {
    const positionNdx = indexData[i] * 3;
    const pos = position.slice(positionNdx, positionNdx + 3);
    vertexData.set(pos, i * 4);

    const quadNdx = ((i / 6) | 0) * 3;
    const color = quadColors.slice(quadNdx, quadNdx + 3);
    colorData.set(color, i * 16 + 12); // set RGB
    colorData[i * 16 + 15] = 255; // set A
  }

  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);
  const description: Iterable<GPUVertexBufferLayout | null> = [
    {
      arrayStride: 4 * 4,
      stepMode: "vertex",
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 3 * 4, format: "unorm8x4" },
      ],
    },
  ];
  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX,
  });
  device.queue.writeBuffer(indexBuffer, 0, indexData);
  return {
    vertexData,
    indexData,
    vertexNums,
    indexNums,
    vertexBuffer,
    indexBuffer,
    indexFormat,
    description,
  };
}
