function arrayKeys<T>(arr: Array<T>): Array<number> {
  var i = 0,
    len = arr.length,
    keys = [];
  while (i < len) {
    keys.push(i++);
  }
  return keys;
}
// 判断变量是否为数组
function isArray(arr: any): boolean {
  return Array.isArray(arr);
}
// 归并排序(过程：从下向上)
function mergeSort<T>(arr: Array<T>, key: Array<T>, order: "desc" | "asc") {
  if (!isArray(arr)) return [];
  var key = isArray(key) ? key : [];
  // 对数组arr做若干次合并：数组arr的总长度为len，将它分为若干个长度为gap的子数组；
  // 将"每2个相邻的子数组" 进行合并排序。
  // len = 数组的长度，gap = 子数组的长度
  function mergeGroups(arr: Array<T>, len: number, gap: number) {
    // 对arr[0..len)做一趟归并排序
    // 将"每2个相邻的子数组"进行合并排序
    for (var i = 0; i + 2 * gap - 1 < len; i += gap * 2) {
      merge(arr, i, i + gap - 1, i + 2 * gap - 1); // 归并长度为len的两个相邻子数组
    }
    // 注意：
    // 若i ≤ len - 1且i + gap - 1 ≥ len - 1时，则剩余一个子数组轮空，无须归并
    // 若i + gap - 1 < len - 1，则剩余一个子数组没有配对
    // 将该子数组合并到已排序的数组中
    if (i + gap - 1 < len - 1) {
      // 尚有两个子文件，其中后一个长度小于len - 1
      merge(arr, i, i + gap - 1, len - 1); // 归并最后两个子数组
    }
  }
  // 核心排序过程
  function merge(arr: Array<T>, start: number, mid: number, end: number) {
    var i = start; // 第1个有序区的索引，遍历区间是：arr数组中的[start..mid]
    var j = mid + 1; // 第2个有序区的索引，遍历区间是：arr数组中的[mid + 1..end]
    var aTmp = []; // 汇总2个有序区临时数组
    var kTmp = [];
    var isAsc = (order + "").toLowerCase() === "desc";
    /* 排序过程开始 */
    while (i <= mid && j <= end) {
      // 遍历2个有序区，当该while循环终止时，2个有序区必然有1个已经遍历并排序完毕
      if ((!isAsc && arr[i] <= arr[j]) || (isAsc && arr[i] >= arr[j])) {
        // 并逐个从2个有序区分别取1个数进行比较，将较小的数存到临时数组aTmp中
        aTmp.push(arr[i]);
        kTmp.push(key[i++]);
      } else {
        aTmp.push(arr[j]);
        kTmp.push(key[j++]);
      }
    }
    // 将剩余有序区的剩余元素添加到临时数组aTmp中
    while (i <= mid) {
      aTmp.push(arr[i]);
      kTmp.push(key[i++]);
    }
    while (j <= end) {
      aTmp.push(arr[j]);
      kTmp.push(key[j++]);
    } /*排序过程结束*/
    var len = aTmp.length,
      k;
    // 此时，aTmp数组是经过排序后的有序数列，然后将其重新整合到数组arr中
    for (k = 0; k < len; k++) {
      arr[start + k] = aTmp[k];
      key[start + k] = kTmp[k];
    }
  }
  // 归并排序(从下往上)
  return (function (arr) {
    // 采用自底向上的方法，对arr[0..len)进行二路归并排序
    var len = arr.length;
    if (len <= 0) return arr;
    for (var i = 1; i < len; i *= 2) {
      // 共log2(len - 1)趟归并
      mergeGroups(arr, len, i); // 有序段长度 ≥ len时终止
    }
  })(arr);
}
function applySort<T>(arr: Array<T>, sort_idxs: Array<number>): Array<T> {
  // if (arr.length !== sort_idxs.length) throw new Error("length not equal");
  const newArr = new Array<T>(arr.length);
  sort_idxs.forEach((sort_idx, idx) => (newArr[sort_idx] = arr[idx]));
  return newArr;
}

/*
  将大整数 num 分解成 count 个小整数相加
*/
function splitCount(num: number, count: number) {
  const arr: number[] = [];
  let sum = 0;
  // 先均分
  for (let i = 0; i < count; i++) {
    const s = Math.floor(num / count);
    arr.push(s);
    sum += s;
  }
  // 补差值
  const diff = num - sum;
  for (let i = 0; i < diff; i++) {
    arr[i] += 1;
  }
  return arr;
}

/* 
  maxInvocations 必须是 2 的幂次
*/
export function dispatch(
  target: number[],
  maxInvocationXYZ: [number, number, number] | number[],
  maxInvocations: number
) {
  const count_2 = Math.floor(Math.log2(maxInvocations)); // 去除非2次幂部分
  // invocation 需要从大到小排序，但我们需要获取对应索引
  const sort_idxs = arrayKeys(maxInvocationXYZ);
  mergeSort(maxInvocationXYZ, sort_idxs, "desc"); // 降序
  const invocation_2 = maxInvocationXYZ.map((maxInvocation) =>
    Math.floor(Math.log2(maxInvocation))
  );
  const chunkSize = [1, 1, 1];
  const dispatchSize = [1, 1, 1];
  const usage = target.length;
  const splitedCount = splitCount(count_2, usage);
  if (usage === 0) throw new Error("target length must greater than 1");
  else if (usage >= 1 && usage <= 3) {
    for (let i = 0; i < usage; i++) {
      chunkSize[i] = Math.min(
        target[i],
        Math.pow(2, Math.min(invocation_2[i], splitedCount[i]))
      );
      const left = splitedCount[i] - Math.ceil(Math.log2(chunkSize[i]));
      splitedCount[i + 1] += left;
      dispatchSize[i] = Math.ceil(target[i] / chunkSize[i]); // dispatch 可能会超过，需要在 compute shader 中判断
    }
  } else throw new Error("target length must less than 3");
  return {
    chunkSize: applySort(chunkSize, sort_idxs),
    dispatchSize: applySort(dispatchSize, sort_idxs),
    order: sort_idxs as IDX[],
  };
}

export const axis = ["x", "y", "z"];
export type IDX = 0 | 1 | 2;

export function dispatchImageAndSampler(
  image: [number, number],
  samplers: number,
  dispatchLeft: boolean, // false
  maxSampleChunk: number,
  maxInvocationXYZ: [number, number, number] | number[],
  maxInvocations: number
) {
  // invocation 需要从大到小排序，但我们需要获取对应索引
  const sort_idxs = arrayKeys(maxInvocationXYZ);
  mergeSort(maxInvocationXYZ, sort_idxs, "desc");
  const chunkSize = new Array<number>(3).fill(1);
  const dispatchSize = new Array<number>(3).fill(1);
  const sampler_idx = sort_idxs[0] as IDX;
  chunkSize[sampler_idx] = Math.min(
    Math.min(maxSampleChunk, maxInvocations),
    Math.min(samplers, maxInvocationXYZ[0])
  );
  dispatchSize[sampler_idx] = Math.ceil(samplers / chunkSize[sampler_idx]);

  if (dispatchLeft) {
    const res = dispatch(
      image,
      [maxInvocationXYZ[1], maxInvocationXYZ[2]],
      Math.floor(maxInvocations / chunkSize[sampler_idx])
    );

    chunkSize[sort_idxs[1]] = res.chunkSize[res.order[0]];
    chunkSize[sort_idxs[2]] = res.chunkSize[res.order[1]];

    dispatchSize[sort_idxs[1]] = res.dispatchSize[res.order[0]];
    dispatchSize[sort_idxs[2]] = res.dispatchSize[res.order[1]];
  } else {
    dispatchSize[sort_idxs[1]] = image[0];
    dispatchSize[sort_idxs[2]] = image[1];
  }

  return {
    chunkSize,
    dispatchSize,
    order: [sort_idxs[1], sort_idxs[2], sort_idxs[0]] as IDX[],
  };
}

export class DispatchCompute {
  static limit(device: GPUDevice) {
    const maxComputeWorkgroupLimits = [
      device.limits.maxComputeWorkgroupSizeX,
      device.limits.maxComputeWorkgroupSizeY,
      device.limits.maxComputeWorkgroupSizeZ,
    ];
    const maxComputeInvocationsPerWorkgroup =
      device.limits.maxComputeInvocationsPerWorkgroup;

    return {
      maxComputeWorkgroupLimits,
      maxComputeInvocationsPerWorkgroup,
    };
  }
  static dispatch(device: GPUDevice, size: number[]) {
    const { maxComputeWorkgroupLimits, maxComputeInvocationsPerWorkgroup } =
      DispatchCompute.limit(device);
    return dispatch(
      size,
      maxComputeWorkgroupLimits,
      maxComputeInvocationsPerWorkgroup
    );
  }

  static dispatchImageAndSampler(
    device: GPUDevice,
    image: [number, number],
    samplers: number,
    dispatchLeft: boolean = false,
    maxSampleChunk?: number
  ) {
    const { maxComputeWorkgroupLimits, maxComputeInvocationsPerWorkgroup } =
      DispatchCompute.limit(device);
    return dispatchImageAndSampler(
      image,
      samplers,
      dispatchLeft,
      maxSampleChunk ?? maxComputeInvocationsPerWorkgroup,
      maxComputeWorkgroupLimits,
      maxComputeInvocationsPerWorkgroup
    );
  }
}
