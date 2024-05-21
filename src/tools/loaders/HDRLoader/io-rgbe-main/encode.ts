import { HDRImageData } from "./HDRImageData";

/**
 * Encodes the HDRImageData or ImageData (LDR) to the RGBE file format.
 */
export function encodeRGBE(imageData: HDRImageData | ImageData): ArrayBuffer
{
	const hdriData: HDRImageData = imageData instanceof ImageData ? convertToHDRIData(imageData) : imageData;
	const { width, height, data } = hdriData;
	const encoded: number[] = [];
	const hasAlpha = data.length === width * height * data.BYTES_PER_ELEMENT * 4;

	let header =
		"#?RADIANCE\n# Made with derschmale/io-rgbe\n" +
		"EXPOSURE=" + hdriData.exposure + "\n" +
		"GAMMA=" + hdriData.gamma + "\n" +
		"PRIMARIES=0 0 0 0 0 0 0 0\nFORMAT=32-bit_rle_rgbe\n\n";

	header += "-Y " + height + " +X " + width + "\n";

	for (let i = 0; i < header.length; ++i) {
		encoded.push(header.charCodeAt(i));
	}

	let i = 0;

	for (let y = 0; y < height; ++y) {
		// 0x0202 and 16-bit for width
		encoded.push(0x02, 0x02, (width & 0xff00) >> 8, width & 0xff);

		const scanline: number[][] = [ [], [], [], [] ];

		for (let x = 0; x < width; ++x) {
			// gamma to linear
			const r = data[i++];
			const g = data[i++];
			const b = data[i++];
			// skip alpha channel if present
			if (hasAlpha) i++;

			const maxComp = Math.max(r, g, b) / 256.0;
			const e = clamp(Math.ceil(Math.log2(maxComp)) + 136, 0.0, 0xff);
			const sc = 1.0 / Math.pow(2, e - 136);

			scanline[0].push(clamp(r * sc, 0, 0xff));
			scanline[1].push(clamp(g * sc, 0, 0xff));
			scanline[2].push(clamp(b * sc, 0, 0xff));
			scanline[3].push(e);
		}

		scanline.forEach(s => encodeRLE(s, encoded));
	}

	return new Uint8Array(encoded).buffer;
}

/**
 * @ignore
 */
function convertToHDRIData(img: ImageData): HDRImageData
{
	const data = new Float32Array(img.width * img.height * 3);

	for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
		data[i] = Math.pow(img.data[j] / 0xff, 2.2);
		data[i + 1] = Math.pow(img.data[j + 1] / 0xff, 2.2);
		data[i + 2] = Math.pow(img.data[j + 2] / 0xff, 2.2);
	}

	return {
		data,
		exposure: 1,
		gamma: 1,
		width: img.width,
		height: img.height
	};
}

/**
 * @ignore
 */
function clamp(x: number, min: number, max: number)
{
	return Math.max(Math.min(x, max), min);
}

/**
 * Straight port from https://www.graphics.cornell.edu/~bjw/rgbe/rgbe.c
 * @ignore
 */
function encodeRLE(data: number[], encoded: number[])
{
	const minRunLen = 4;
	const len = data.length;
	let i = 0;

	while (i < len) {
		let runStart = i;

		// find next run of length at least 4 if one exists
		let runCount = 0;
		let prevRunCount = 0;

		while ((runCount < minRunLen) && (runStart < len)) {
			runStart += runCount;
			prevRunCount = runCount;
			runCount = 1;
			while (
				(runStart + runCount < len) && (runCount < 127)
				&& (data[runStart] == data[runStart + runCount]))
				runCount++;
		}
		// if data before next big run is a short run then write it as such
		if ((prevRunCount > 1) && (prevRunCount == runStart - i)) {
			encoded.push(128 + prevRunCount, data[i]);
			i = runStart;
		}
		// write out bytes until we reach the start of the next run
		while (i < runStart) {
			let count = runStart - i;
			if (count > 128)
				count = 128;

			encoded.push(count);

			for (let d = 0; d < count; ++d)
				encoded.push(data[i + d]);

			i += count;
		}

		/* write out next run if one was found */
		if (runCount >= minRunLen) {
			encoded.push(128 + runCount, data[runStart]);
			i += runCount;
		}
	}
}
