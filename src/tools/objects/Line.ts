import { Geometry } from "../geometrys/Geometry";
import { MeshMaterial } from "../materials/MeshMaterial";
import { BuildOptions } from "../scene/types";
import { Object3D } from "./Object3D";

export class Line<
  G extends Geometry = Geometry,
  M extends MeshMaterial = MeshMaterial
> extends Object3D<G, M> {
  type: string = "Line";

  buildPipeline(options: BuildOptions) {
    const { bufferLayout } = this.geometryBuildResult;
    const { bindGroupLayouts, fragment, vertex } = this.resources;
    this.renderPipeline = options.cached.pipeline.get(
      vertex,
      fragment,
      {
        format: options.format,
        primitive: {
          topology: "line-list",
        },
        depthStencil: {
          format: options.depthFormat,
          depthWriteEnabled: true,
          depthCompare: "less",
        },
        bufferLayout,
      },
      bindGroupLayouts
    );
  }
}
