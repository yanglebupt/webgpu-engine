export function createAnimCanvas(size: number = 256) {
  const half = size / 2;

  const ctx = document
    .createElement("canvas")
    .getContext("2d") as CanvasRenderingContext2D;
  ctx.canvas.width = size;
  ctx.canvas.height = size;

  const hsl = (h: number, s: number, l: number) =>
    `hsl(${(h * 360) | 0}, ${s * 100}%, ${(l * 100) | 0}%)`;

  function update(time: number) {
    time *= 0.0005;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(half, half);
    const num = 20;
    for (let i = 0; i < num; ++i) {
      ctx.fillStyle = hsl((i / num) * 0.2 + time * 0.1, 1, (i % 2) * 0.5);
      ctx.fillRect(-half, -half, size, size);
      ctx.rotate(time * 0.5);
      ctx.scale(0.85, 0.85);
      ctx.translate(size / 16, 0);
    }
    ctx.restore();
  }

  return { canvas: ctx.canvas, update };
}

export function startPlayingAndWaitForVideo(video: HTMLVideoElement) {
  return new Promise((resolve, reject) => {
    video.addEventListener("error", reject);
    if ("requestVideoFrameCallback" in video) {
      video.requestVideoFrameCallback(resolve);
    } else {
      const timeWatcher = () => {
        if ((video as HTMLVideoElement).currentTime > 0) {
          resolve("");
        } else {
          requestAnimationFrame(timeWatcher);
        }
      };
      timeWatcher();
    }
    video.play().catch(reject);
  });
}
export function createVideo(url: string) {
  const video = document.createElement("video") as HTMLVideoElement;
  video.src = url;
  video.muted = true;
  video.preload = "auto";
  video.loop = true;
  return { video };
}
