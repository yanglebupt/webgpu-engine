export enum BlendingPreset {
  SourceIn = 1,
  SourceOver,
  SourceOut,
  SourceAtop,
  DestinationIn,
  DestinationOver,
  DestinationOut,
  DestinationAtop,
  Additive,
}

export const BlendPresetMap: Record<BlendingPreset, Partial<GPUBlendState>> = {
  [BlendingPreset.SourceOver]: {
    color: {
      operation: "add",
      srcFactor: "one",
      dstFactor: "one-minus-src-alpha",
    },
  },
  [BlendingPreset.DestinationOver]: {
    color: {
      operation: "add",
      srcFactor: "one-minus-dst-alpha",
      dstFactor: "one",
    },
  },
  [BlendingPreset.SourceIn]: {
    color: {
      operation: "add",
      srcFactor: "dst-alpha",
      dstFactor: "zero",
    },
  },
  [BlendingPreset.DestinationIn]: {
    color: {
      operation: "add",
      srcFactor: "zero",
      dstFactor: "src-alpha",
    },
  },
  [BlendingPreset.SourceOut]: {
    color: {
      operation: "add",
      srcFactor: "one-minus-dst-alpha",
      dstFactor: "zero",
    },
  },
  [BlendingPreset.DestinationOut]: {
    color: {
      operation: "add",
      srcFactor: "zero",
      dstFactor: "one-minus-src-alpha",
    },
  },
  [BlendingPreset.SourceAtop]: {
    color: {
      operation: "add",
      srcFactor: "dst-alpha",
      dstFactor: "one-minus-src-alpha",
    },
  },
  [BlendingPreset.DestinationAtop]: {
    color: {
      operation: "add",
      srcFactor: "one-minus-dst-alpha",
      dstFactor: "src-alpha",
    },
  },
  [BlendingPreset.Additive]: {
    color: {
      operation: "add",
      srcFactor: "one",
      dstFactor: "one",
    },
  },
};

export function getBlendFromPreset(
  blendingPreset: BlendingPreset
): GPUBlendState {
  const b = BlendPresetMap[blendingPreset];
  return { color: b.color ?? {}, alpha: b.alpha ?? b.color ?? {} };
}
