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
// 迭代器装封装数组方法

export class Iter {
  static list<T>(iter: IterableIterator<T>) {
    const list: T[] = [];
    let _done: boolean | undefined = false;
    while (!_done) {
      const { value, done } = iter.next();
      !done && list.push(value);
      _done = done;
    }
    return list;
  }
  static filter<T>(iter: IterableIterator<T>, filter: (value: T) => boolean) {
    const list: T[] = [];
    let _done: boolean | undefined = false;
    while (!_done) {
      const { value, done } = iter.next();
      !done && filter(value) && list.push(value);
      _done = done;
    }
    return list;
  }
  static map<T, B>(iter: IterableIterator<T>, map: (value: T) => B) {
    const list: B[] = [];
    let _done: boolean | undefined = false;
    while (!_done) {
      const { value, done } = iter.next();
      !done && list.push(map(value));
      _done = done;
    }
    return list;
  }
}

// 带有进度的 fetch
export const fetchWithProgress = async (
  url: string,
  onProgress?: (percentage: number) => void
) => {
  const response = await fetch(url);
  if (response.status >= 200 && response.status < 400) {
    const reader = response.body?.getReader();
    const contentLength = +(
      response.headers.get("Content-Length") ?? 100 * 1024 * 1024
    );
    let receivedLength = 0;
    const chunks: Uint8Array[] = [];
    return reader
      ?.read()
      .then(function processChunk({ done, value }): Promise<Blob> | Blob {
        if (done) {
          onProgress && onProgress(1.0);
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
