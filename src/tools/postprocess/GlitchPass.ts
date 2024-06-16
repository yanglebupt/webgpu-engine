import { rand, randFloat, randInt } from "../math";
import { DataTexture } from "../textures/DataTexture";
import { Uniform } from "../textures/ResourceBuffer";
import { RenderPass } from "./RenderPass";
import DigitalGlitch from "./shaders/DigitalGlitch.wgsl";

function generateHeightmap(dt_size: number) {
  const length = dt_size * dt_size;

  const data_arr = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const val = rand();
    data_arr[i] = val;
  }

  const texture = new DataTexture(data_arr, dt_size, dt_size, {
    format: "r32float",
  });
  return texture;
}

export class GlitchPass extends RenderPass {
  goWild: boolean;
  curF: number;
  randX!: number;
  uniforms: Uniform;
  constructor(dt_size = 64) {
    super(DigitalGlitch, [
      new Uniform("uni", {
        byp: 0, //apply the glitch ?
        amount: 0.08,
        angle: 0.02,
        seed: 0.02,
        seed_x: 0.02, //-1,1
        seed_y: 0.02, //-1,1
        distortion_x: 0.5,
        distortion_y: 0.6,
        col_s: 0.05,
      }),
      generateHeightmap(dt_size),
    ]);
    this.goWild = false;
    this.curF = 0;
    this.generateTrigger();
    this.uniforms = this.resourceViews[0] as Uniform;
  }

  generateTrigger() {
    this.randX = randInt(120, 240);
  }

  update() {
    this.uniforms.value["seed"] = Math.random(); //default seeding
    this.uniforms.value["byp"] = 0;

    if (this.curF % this.randX == 0 || this.goWild == true) {
      this.uniforms.value["amount"] = Math.random() / 30;
      this.uniforms.value["angle"] = randFloat(-Math.PI, Math.PI);
      this.uniforms.value["seed_x"] = randFloat(-1, 1);
      this.uniforms.value["seed_y"] = randFloat(-1, 1);
      this.uniforms.value["distortion_x"] = randFloat(0, 1);
      this.uniforms.value["distortion_y"] = randFloat(0, 1);
      this.curF = 0;
      this.generateTrigger();
    } else if (this.curF % this.randX < this.randX / 5) {
      this.uniforms.value["amount"] = Math.random() / 90;
      this.uniforms.value["angle"] = randFloat(-Math.PI, Math.PI);
      this.uniforms.value["distortion_x"] = randFloat(0, 1);
      this.uniforms.value["distortion_y"] = randFloat(0, 1);
      this.uniforms.value["seed_x"] = randFloat(-0.3, 0.3);
      this.uniforms.value["seed_y"] = randFloat(-0.3, 0.3);
    } else if (this.goWild == false) {
      this.uniforms.value["byp"] = 1;
    }

    this.curF++;
  }
}
