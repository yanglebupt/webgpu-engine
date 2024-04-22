export function createFVertexs(device: GPUDevice) {
  const position = new Float32Array([
    // left column
    -50, 75, 15, -20, 75, 15, -50, -75, 15, -20, -75, 15,

    // top rung
    -20, 75, 15, 50, 75, 15, -20, 45, 15, 50, 45, 15,

    // middle rung
    -20, 15, 15, 20, 15, 15, -20, -15, 15, 20, -15, 15,

    // left column back
    -50, 75, -15, -20, 75, -15, -50, -75, -15, -20, -75, -15,

    // top rung back
    -20, 75, -15, 50, 75, -15, -20, 45, -15, 50, 45, -15,

    // middle rung back
    -20, 15, -15, 20, 15, -15, -20, -15, -15, 20, -15, -15,
  ]);
  const vertexNums = position.length / 3;
  // 2D 下顺逆没影响
  const indexData = new Uint32Array([
    0,
    2,
    1,
    2,
    3,
    1, // left column
    4,
    6,
    5,
    6,
    7,
    5, // top run
    8,
    10,
    9,
    10,
    11,
    9, // middle run

    12,
    13,
    14,
    14,
    13,
    15, // left column back
    16,
    17,
    18,
    18,
    17,
    19, // top run back
    20,
    21,
    22,
    22,
    21,
    23, // middle run back

    0,
    5,
    12,
    12,
    5,
    17, // top
    5,
    7,
    17,
    17,
    7,
    19, // top rung right
    6,
    18,
    7,
    18,
    19,
    7, // top rung bottom
    6,
    8,
    18,
    18,
    8,
    20, // between top and middle rung
    8,
    9,
    20,
    20,
    9,
    21, // middle rung top
    9,
    11,
    21,
    21,
    11,
    23, // middle rung right
    10,
    22,
    11,
    22,
    23,
    11, // middle rung bottom
    10,
    3,
    22,
    22,
    3,
    15, // stem right
    2,
    14,
    3,
    14,
    15,
    3, // bottom
    0,
    12,
    2,
    12,
    14,
    2, // left
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
