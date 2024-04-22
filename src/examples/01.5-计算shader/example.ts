import { Vec3, vec3 } from "wgpu-matrix";

const dispatchCount = [4, 3, 2]; // 多少个 workgroup
const workgroupSize = [2, 3, 4]; // 每个 workgroup 中有多少个 invocation

const arrayProd = (arr: number[]) =>
  arr.reduce((a: number, b: number) => a * b);

// @builtin(num_workgroups) num_workgroups: vec3<u32>
let num_workgroups = dispatchCount;

// @builtin(workgroup_id) workgroup_id : vec3<u32>
let workgroup_id;
// @builtin(local_invocation_id) local_invocation_id : vec3<u32>
let local_invocation_id;
// @builtin(global_invocation_id) global_invocation_id : vec3<u32>
let global_invocation_id;

let workgroup_index = -1;
// @builtin(local_invocation_index) local_invocation_index: u32
let local_invocation_index = -1;
let global_invocation_index = -1;
let dispatch_index = -1;

function dispatchInvocations(workgroup_id: Vec3, ...workgroupSize: number[]) {
  for (let i = 0; i < workgroupSize[2]; i++) {
    for (let j = 0; j < workgroupSize[1]; j++) {
      for (let k = 0; k < workgroupSize[0]; k++) {
        local_invocation_id = vec3.create(k, j, i);
        global_invocation_id = vec3.add(
          local_invocation_id,
          vec3.mul(workgroup_id, workgroupSize)
        );
        global_invocation_index++;
        local_invocation_index =
          local_invocation_id[0] +
          local_invocation_id[1] * workgroupSize[0] +
          local_invocation_id[2] * workgroupSize[0] * workgroupSize[1];
        console.log(
          global_invocation_index ===
            workgroup_index * arrayProd(workgroupSize) + local_invocation_index
        );
      }
    }
  }
}

function dispatchWorkgroups(...dispatchCount: number[]) {
  for (let i = 0; i < dispatchCount[2]; i++) {
    for (let j = 0; j < dispatchCount[1]; j++) {
      for (let k = 0; k < dispatchCount[0]; k++) {
        workgroup_id = vec3.create(k, j, i);
        workgroup_index =
          workgroup_id[0] +
          workgroup_id[1] * dispatchCount[0] +
          workgroup_id[2] * dispatchCount[0] * dispatchCount[1];
        dispatch_index++;
        console.log(workgroup_index === dispatch_index);
        dispatchInvocations(workgroup_id, ...workgroupSize);
      }
    }
  }
}

dispatchWorkgroups(...dispatchCount);

console.log(workgroup_index === arrayProd(dispatchCount) - 1);
console.log(local_invocation_index === arrayProd(workgroupSize) - 1);
console.log(
  global_invocation_index ===
    arrayProd(workgroupSize) * arrayProd(dispatchCount) - 1
);
