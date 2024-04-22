export function createCubeMap() {
  function generateFace(
    size: number,
    {
      faceColor,
      textColor,
      text,
    }: { faceColor: string; textColor: string; text: string }
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = faceColor;
    ctx.fillRect(0, 0, size, size);
    ctx.font = `${size * 0.7}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = textColor;
    ctx.fillText(text, size / 2, size / 2);
    return canvas;
  }

  const faceSize = 128;
  const faceCanvases = [
    { faceColor: "#F00", textColor: "#0FF", text: "+X" },
    { faceColor: "#FF0", textColor: "#00F", text: "-X" },
    { faceColor: "#0F0", textColor: "#F0F", text: "+Y" },
    { faceColor: "#0FF", textColor: "#F00", text: "-Y" },
    { faceColor: "#00F", textColor: "#FF0", text: "+Z" },
    { faceColor: "#F0F", textColor: "#0F0", text: "-Z" },
  ].map((faceInfo) => generateFace(faceSize, faceInfo));

  return faceCanvases;
}
