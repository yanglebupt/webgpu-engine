// 轮询直到条件成立
export const waitUnitCondition = (gasp: number, conditionFn: () => boolean) =>
  new Promise((resolve) => {
    const id = setInterval(() => {
      if (conditionFn()) {
        clearInterval(id);
        resolve(true);
      }
    }, gasp);
  });

// 带有进度的 fetch
export const fetchWithProgress = async (
  url: string,
  onProgress?: (percentage: number) => void
) => {
  const response = await fetch(url);
  if (response.status >= 200 && response.status < 400) {
    const reader = response.body?.getReader();
    const contentLength = +(response.headers.get("Content-Length") ?? 0);
    let receivedLength = 0;
    const chunks: Uint8Array[] = [];
    return reader
      ?.read()
      .then(function processChunk({ done, value }): Promise<Blob> | Blob {
        if (done) {
          if (receivedLength !== contentLength)
            throw new Error("received length is not equal to content length");
          const data = new Uint8Array(receivedLength);
          let position = 0;
          for (let chunk of chunks) {
            data.set(chunk, position);
            position += chunk.length;
          }
          return new Blob([data]);
        }
        chunks.push(value!);
        receivedLength += value!.length;
        onProgress && onProgress(receivedLength / contentLength);
        return reader.read().then(processChunk);
      });
  } else {
    throw new Error(`${response.status}: ${response.statusText}`);
  }
};
