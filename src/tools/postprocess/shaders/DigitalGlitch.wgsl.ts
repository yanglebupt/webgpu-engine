/**
 * RGB Shift Shader
 * Shifts red and blue channels from center in opposite directions
 * Ported from http://kriss.cx/tom/2009/05/rgb-shift/
 * by Tom Butterworth / http://kriss.cx/tom/
 *
 * amount: shift distance (1 is width of input)
 * angle: shift angle in radians
 */

import { ShaderCode } from "../../shaders";

const DigitalGlitch: ShaderCode = {
  resources: /* wgsl */ `
    struct UniformData {
      byp: u32, //should we apply the glitch ?
      amount: f32,
      angle: f32,
      seed: f32,
      seed_x: f32,
      seed_y: f32,
      distortion_x: f32,
      distortion_y: f32,
      col_s: f32,
    };
    @group(0) @binding(2) var<uniform> uni: UniformData;
    @group(0) @binding(3) var tDisp: texture_2d<f32>;
  `,
  code() {
    return /* wgsl */ `

    fn texture2D(texture: texture_2d<f32>, uv:vec2f) -> vec4f {
      return textureSample(texture, _sampler, uv);
    }

		fn rand(co: vec2f) -> f32 {
			return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
		}

    @fragment
		fn main(@location(0) tc: vec2f, @builtin(position) position: vec4f) -> @location(0) vec4f {
      let byp=uni.byp;
      if(byp < 1) {
        let amount=uni.amount;
        let angle=uni.angle;
        let seed=uni.seed;
        let seed_x=uni.seed_x;
        let seed_y=uni.seed_y;
        let distortion_x=uni.distortion_x;
        let distortion_y=uni.distortion_y;
        let col_s=uni.col_s;

				var p = tc;

				let xs = floor(position.x / 0.5);
				let ys = floor(position.y / 0.5);
				//based on staffantans glitch shader for unity https://github.com/staffantan/unityglitch
				let disp = texture2D(tDisp, p*seed*seed).r;
				if(p.y<distortion_x+col_s && p.y>distortion_x-col_s*seed) {
					if(seed_x>0.){
						p.y = 1. - (p.y + distortion_y);
					}
					else {
						p.y = distortion_y;
					}
				}
				if(p.x<distortion_y+col_s && p.x>distortion_y-col_s*seed) {
					if(seed_y>0.){
						p.x=distortion_x;
					}
					else {
						p.x = 1. - (p.x + distortion_x);
					}
				}
				p.x+=disp*seed_x*(seed/5.);
				p.y+=disp*seed_y*(seed/5.);
				//base from RGB shift shader
				let offset = amount * vec2f( cos(angle), sin(angle));
				let cr = texture2D(inputTexture, p + offset);
				let cga = texture2D(inputTexture, p);
				let cb = texture2D(inputTexture, p - offset);
				var col = vec4f(cr.r, cga.g, cb.b, cga.a);
				//add noise
				let snow = 200.*amount*vec4(rand(vec2f(xs * seed,ys * seed*50.))*0.2);
				col += snow;
        return col;
			}
			else {
				return texture2D(inputTexture, tc);
			}
		}`;
  },
};

export default DigitalGlitch;
