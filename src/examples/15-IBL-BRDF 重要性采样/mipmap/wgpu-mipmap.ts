import shaderSource from "./mipmap.wgsl?raw";

/**
 * The result of the mipmaps and images.
 */
export interface TextureImagesResult {
  gpuTexture: GPUTexture;
  imageElements: HTMLImageElement[];
}

/**
 * Generates mipmaps for a texture.
 * @param device The GPU device.
 * @param texture The texture to generate mipmaps for.
 */
export const wgpuGenerateTextureMipmap = (
  device: GPUDevice,
  texture: GPUTexture
) => {
  new WGPUMipmapGenerator(device).generateMipmaps(texture);
};

/**
 * The WebGPU Mipmap class.
 * Responsible for creating mipmaps for a @see GPUTexture , @see HTMLImageElement or an @see ArrayBuffer.
 */
export class WGPUMipmapGenerator {
  private _bindGroupLayout!: GPUBindGroupLayout;
  private _bindGroup!: GPUBindGroup;
  private _pipelineLayout!: GPUPipelineLayout;
  private _pipeline!: GPUComputePipeline;
  private _texture!: GPUTexture;

  private _textureMipSizes: GPUExtent3DDict[] = [];
  private _textureViews: GPUTextureView[] = [];

  /**
   * The constructor.
   * @param _device The GPU device.
   */
  constructor(private readonly _device: GPUDevice) {}

  /**
   * Generates the mipmaps for the texture.
   * @param source The source. Can be an HTMLImageElement, GPUTexture or ArrayBuffer.
   * @param width The width of the texture. Must be passed if source is a buffer.
   * @param height The height of the texture. Must be passed if source is a buffer.
   * @returns The texture with mipmaps.
   */
  public generateMipmaps(
    source: HTMLImageElement | GPUTexture | ArrayBuffer,
    width: number = 0,
    height: number = 0
  ): GPUTexture {
    // Validate if texture.
    if (source instanceof GPUTexture) {
      if (source.dimension !== "2d") {
        throw new Error("Only 2D textures are supported.");
      }
    }

    // Validate if buffer.
    if (source instanceof ArrayBuffer) {
      if (width <= 0 || height <= 0) {
        throw new Error(
          "Width and height must be passed if imageOrBuffer is a buffer."
        );
      }
    }

    // Initialize the texture.
    if (source instanceof HTMLImageElement || source instanceof ArrayBuffer) {
      this._initTexture(source, width, height);
    } else if (source instanceof GPUTexture) {
      this._texture = source;
    }

    // Initialize the texture views.
    this._initTextureViews();

    // Initialize the bind group layout.
    this._initBindGroupLayout();

    // Initialize the pipeline and layout.
    this._initPipeline();

    // Submit queue so that everything is written to resources.
    this._device.queue.submit([]);

    // Compute pass.
    this._computePass();

    return this._texture;
  }

  /**
   * This function generates mipmaps and creates images for each level.
   * @param source The subject. Can be an HTMLImageElement, GPUTexture or ArrayBuffer.
   * @param width The width of the texture. Must be passed if source is a buffer.
   * @param height The height of the texture. Must be passed if source is a buffer.
   * @returns The mipmaps and images.
   */
  public async generateMipmapsAndCreateImages(
    source: HTMLImageElement | GPUTexture | ArrayBuffer,
    width: number = 0,
    height: number = 0
  ): Promise<TextureImagesResult> {
    // Generate mipmaps.
    const texture = this.generateMipmaps(source, width, height);

    // Create images.
    const images: HTMLImageElement[] = [];
    for (let i = 0; i < this._textureMipSizes.length; i++) {
      const image = await this._createImage(i);
      images.push(image);
    }

    return { gpuTexture: texture, imageElements: images };
  }

  /**
   * Initialize the bind group layout.
   */
  private _initBindGroupLayout() {
    this._bindGroupLayout = this._device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: {
            sampleType: "float",
            viewDimension: "2d",
          },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: "write-only",
            format: "rgba8unorm",
            viewDimension: "2d",
          },
        },
      ],
    });
  }

  /**
   * Initialize the bind group.
   */
  private _initBindGroup(nextMipLevel: number) {
    const desc: GPUBindGroupDescriptor = {
      layout: this._bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: this._textureViews[nextMipLevel - 1],
        },
        {
          binding: 1,
          resource: this._textureViews[nextMipLevel],
        },
      ],
    };

    this._bindGroup = this._device.createBindGroup(desc);
  }

  /**
   * Initialize the pipeline and layout.
   */
  private _initPipeline() {
    // - SHADER MODULE
    const shaderModule = this._device.createShaderModule({
      label: "Mipmap generator shader module",
      code: shaderSource,
    });

    // - PIPELINE LAYOUT
    const pipelineLayoutDesc: GPUPipelineLayoutDescriptor = {
      bindGroupLayouts: [this._bindGroupLayout],
    };
    this._pipelineLayout =
      this._device.createPipelineLayout(pipelineLayoutDesc);

    // - PIPELINE
    const computePipelineDesc: GPUComputePipelineDescriptor = {
      layout: this._pipelineLayout,
      compute: {
        module: shaderModule,
        entryPoint: "generateMipmap",
      },
    };
    this._pipeline = this._device.createComputePipeline(computePipelineDesc);
  }

  /**
   * Get the array buffer of the image.
   * @param image The image to get the buffer from.
   * @returns The array buffer of the image.
   */
  private _imageToBuffer(image: HTMLImageElement): ArrayBuffer {
    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");
    canvas.width = image.width;
    canvas.height = image.height;
    context!.drawImage(image, 0, 0);
    const canvasBuffer = context!.getImageData(
      0,
      0,
      image.width,
      image.height
    ).data;

    // Create a new buffer with the same data.
    const buffer = new ArrayBuffer(canvasBuffer.byteLength);
    const view = new Uint8Array(buffer);
    view.set(canvasBuffer);

    canvas.remove();
    return buffer;
  }

  /**
   * Create a texture from an image.
   * @param imageOrBuffer The image or buffer to create the texture from.
   * @param width The width of the texture. Must be passed if imageOrBuffer is a buffer.
   * @param height The height of the texture. Must be passed if imageOrBuffer is a buffer.
   */
  private _initTexture(
    imageOrBuffer: HTMLImageElement | ArrayBuffer,
    width: number = 0,
    height: number = 0
  ) {
    // - DATA
    let dataBuffer: ArrayBuffer;
    if (imageOrBuffer instanceof HTMLImageElement) {
      dataBuffer = this._imageToBuffer(imageOrBuffer);
      width = imageOrBuffer.width;
      height = imageOrBuffer.height;
    } else {
      if (width <= 0 || height <= 0) {
        throw new Error(
          "Width and height must be passed if imageOrBuffer is a buffer."
        );
      }
      dataBuffer = imageOrBuffer;
    }

    // - TEXTURE
    const size: GPUExtent3D = {
      width: width,
      height: height,
      depthOrArrayLayers: 1,
    };

    // Need to upload/save input data and read/write in shader.
    const usage =
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.STORAGE_BINDING |
      GPUTextureUsage.TEXTURE_BINDING;

    const desc: GPUTextureDescriptor = {
      dimension: "2d",
      size: size,
      format: "rgba8unorm",
      sampleCount: 1,
      usage: usage,
    };

    // Find the number of mip levels. Use max of width and height and find the log2 of that.
    const maxDimension = Math.max(width, height);
    const maxMip = Math.floor(Math.log2(maxDimension) + 1);
    desc.mipLevelCount = maxMip;

    // Save Size
    this._textureMipSizes = new Array(maxMip);
    this._textureMipSizes[0] = size;

    // Create the texture.
    this._texture = this._device.createTexture(desc);

    // - COPY DATA
    const destination: GPUImageCopyTexture = {
      texture: this._texture,
      origin: { x: 0, y: 0, z: 0 },
      aspect: "all",
      mipLevel: 0,
    };
    const source: GPUImageDataLayout = {
      offset: 0,
      bytesPerRow: 4 * width,
      rowsPerImage: height,
    };

    this._device.queue.writeTexture(destination, dataBuffer, source, size);
  }

  /**
   * Initialize the texture views.
   */
  private _initTextureViews() {
    const desc: GPUTextureViewDescriptor = {
      format: "rgba8unorm",
      dimension: "2d",
      aspect: "all",
      baseArrayLayer: 0,
      arrayLayerCount: 1,
      baseMipLevel: 0,
      mipLevelCount: 1,
    };

    for (let i = 0; i < this._textureMipSizes.length; i++) {
      desc.baseMipLevel = i;
      desc.label = `Mip level ${i}`;
      this._textureViews.push(this._texture.createView(desc));

      if (i > 0) {
        const previousSize = this._textureMipSizes[i - 1];
        this._textureMipSizes[i] = {
          width: Math.max(1, Math.floor(previousSize.width / 2)),
          height: Math.max(1, Math.floor(previousSize.height! / 2)),
          depthOrArrayLayers: 1,
        };
      }
    }
  }

  /**
   * The compute pass. Must be called after the texture is initialized.
   */
  private async _computePass() {
    const queue = this._device.queue;

    // - COMMAND ENCODER
    const commandEncoder = this._device.createCommandEncoder();

    // - COMPUTE PASS
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this._pipeline);

    for (
      let nextMipLevel = 1;
      nextMipLevel < this._textureMipSizes.length;
      nextMipLevel++
    ) {
      // -- BIND
      this._initBindGroup(nextMipLevel);
      computePass.setBindGroup(0, this._bindGroup);

      // -- DISPATCH
      const size = this._textureMipSizes[nextMipLevel];
      const workgroupSizePerDimension = 8;
      const workgroupCountX =
        (size.width + workgroupSizePerDimension - 1) /
        workgroupSizePerDimension;
      const workgroupCountY =
        (size.height! + workgroupSizePerDimension - 1) /
        workgroupSizePerDimension;

      computePass.dispatchWorkgroups(
        Math.floor(workgroupCountX),
        Math.floor(workgroupCountY),
        1
      );
    }

    // - END PASS
    computePass.end();

    // - SUBMIT
    queue.submit([commandEncoder.finish()]);
  }

  /**
   * Creates the image for the level.
   * @param mipLevel The level to save the image for.
   * @returns The image.
   */
  private async _createImage(mipLevel: number): Promise<HTMLImageElement> {
    const size = this._textureMipSizes[mipLevel];

    // - SET INFO
    const bytesPerRow = 4 * size.width;
    let paddedBytesPerRow = Math.max(bytesPerRow, 256);
    paddedBytesPerRow = paddedBytesPerRow + (256 - (paddedBytesPerRow % 256)); // must be multiple of 256

    // - BUFFER TO GET PIXELS
    const pixelsBufferDesc: GPUBufferDescriptor = {
      label: `Mip level ${mipLevel} buffer`,
      size: paddedBytesPerRow * size.height!,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
      mappedAtCreation: false,
    };
    const pixelBuffer = this._device.createBuffer(pixelsBufferDesc);

    // - START ENCODING
    const commandEncoder = this._device.createCommandEncoder();

    // - COPY TEXTURE TO BUFFER
    const srcView: GPUImageCopyTexture = {
      texture: this._texture,
      mipLevel: mipLevel,
      origin: { x: 0, y: 0, z: 0 },
    };

    const destBuffer: GPUImageCopyBuffer = {
      buffer: pixelBuffer,
      bytesPerRow: paddedBytesPerRow,
      rowsPerImage: size.height!,
    };

    commandEncoder.copyTextureToBuffer(srcView, destBuffer, size);

    // Submit command.
    this._device.queue.submit([commandEncoder.finish()]);

    // - SUBMIT
    await pixelBuffer.mapAsync(GPUMapMode.READ);

    // Get the pixels.
    const pixels = pixelBuffer.getMappedRange();

    // - CREATE IMAGE
    // Write pixels to canvas, so that we can create an image. Canvas is needed to create an image.
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height!;
    const context = canvas.getContext("2d");

    // Draw the image to canvas.
    const data = new Uint8ClampedArray(pixels);
    const imageData = new ImageData(data, paddedBytesPerRow / 4, size.height!);
    context!.putImageData(imageData, 0, 0);
    context!.drawImage(canvas, 0, 0);

    // Create the image.
    const image = new Image();
    image.src = canvas.toDataURL("image/png");

    // - CLEANUP
    pixelBuffer.unmap();
    canvas.remove();

    this._device.queue.submit([]);

    pixelBuffer.destroy();

    return image;
  }
}
