/**
 * Dreamy: RGB → CMYK, blur the C/M/Y plates, leave K sharp, back to RGB.
 * Color inks spread; the black plate stays crisp.
 */
import { gaussianBlur } from './blur';
import type { Modifier } from './types';

type RgbaBuffer = { data: Uint8ClampedArray; width: number; height: number };

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function applyDreamy(src: RgbaBuffer, mod: Modifier): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data.length);
	const amount = clamp01(mod.amount);
	if (amount <= 0.001) {
		out.set(data);
		return { data: out, width: w, height: h };
	}

	const plates = new Uint8ClampedArray(data.length);
	for (let i = 0; i < data.length; i += 4) {
		const r = data[i] / 255;
		const g = data[i + 1] / 255;
		const b = data[i + 2] / 255;
		const k = 1 - Math.max(r, g, b);
		if (k >= 0.999) {
			plates[i] = 0;
			plates[i + 1] = 0;
			plates[i + 2] = 0;
			plates[i + 3] = 255;
			continue;
		}
		const inv = 1 / (1 - k);
		plates[i] = (1 - r - k) * inv * 255;
		plates[i + 1] = (1 - g - k) * inv * 255;
		plates[i + 2] = (1 - b - k) * inv * 255;
		plates[i + 3] = k * 255;
	}

	const minSide = Math.min(w, h);
	const sigma = Math.max(0.6, amount * minSide * 0.1);
	const blurred = gaussianBlur(plates, w, h, sigma);

	for (let i = 0; i < data.length; i += 4) {
		const c = blurred[i] / 255;
		const m = blurred[i + 1] / 255;
		const y = blurred[i + 2] / 255;
		const k = plates[i + 3] / 255;
		const nk = 1 - k;
		out[i] = (1 - c) * nk * 255;
		out[i + 1] = (1 - m) * nk * 255;
		out[i + 2] = (1 - y) * nk * 255;
		out[i + 3] = data[i + 3];
	}
	return { data: out, width: w, height: h };
}

export function isDreamyType(type: Modifier['type']): boolean {
	return type === 'dreamy';
}
