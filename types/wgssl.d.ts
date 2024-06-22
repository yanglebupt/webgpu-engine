declare module "*.wgssl" {
  export interface ShaderCode {
    Input: string;
    Resources?: string;
    Global?: string;
    Entry: string;
    Info: {
      Stage: "vertex" | "fragment" | "compute";
      Return?: string;
      Addon: string[];
    };
  }

  const value: ShaderCode;
  export default value;
}
