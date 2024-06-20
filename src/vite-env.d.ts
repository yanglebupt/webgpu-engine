/// <reference types="vite/client" />
/// <reference types="../types/wgssl" />

declare module "wgsl-preprocessor" {
  export function wgsl(
    strings: string | TemplateStringsArray,
    ...values: any[]
  ): string;
}

interface GPUBindGroupLayout {
  id: string;
}
