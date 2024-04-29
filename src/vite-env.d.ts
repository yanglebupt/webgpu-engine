/// <reference types="vite/client" />

declare module "wgsl-preprocessor" {
  export function wgsl(
    strings: string | TemplateStringsArray,
    ...values: any[]
  ): string;
}
