export class CreateAndSetRecord {
  // 创建了多少个 pipeline
  public pipelineCount: number = 0;
  // 切换了多少次 pipeline
  public pipelineSets: number = 0;
  // 创建了多少个 bindGroup
  public bindGroupCount: number = 0;
  // 切换了多少次 bindGroup
  public bindGroupSets: number = 0;
  // 切换了多少次 buffers
  public bufferSets: number = 0;
  // 调用了多少次 draw
  public drawCount: number = 0;
}

export interface BuiltRenderPipelineOptions {
  mips?: boolean;
  useEnvMap?: boolean;
  onProgress?: (name: string, percentage: number) => void;
}
