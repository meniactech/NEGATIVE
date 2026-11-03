/**
 * Highlight glow: bloom (soft white) and halation (red/orange rim on brights).
 */
import { softBlur } from './blur';
import type { Modifier } from './types';

type RgbaBuffer = { data: Uint8ClampedArray; width: number; height: number };

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function applyGlow(src: RgbaBuffer, mod: Modifier): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data.length);
	const amount = clamp01(mod.amount);
	if (amount <= 0.001) {
		out.set(data);
		return { data: out, width: w, height: h };
	}

	const halation = mod.type === 'halation';
	const minSide = Math.min(w, h);
	const thresh = 0.55 + clamp01(mod.radius) * 0.32;
	const rad = Math.max(1, clamp01(mod.softness) * minSide * (halation ? 0.045 : 0.035));
	const hi = new Uint8ClampedArray(data.length);
	for (let i = 0; i < data.length; i += 4) {
		const y = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
		const m = y < thresh ? 0 : ((y - thresh) / (1 - thresh + 0.0001)) ** 1.35;
		hi[i] = data[i] * m;
		hi[i + 1] = data[i + 1] * m;
		hi[i + 2] = data[i + 2] * m;
		hi[i + 3] = 255;
	}
	const blurred = softBlur(hi, w, h, rad);
	const tint = clamp01(mod.tint);
	const cr = halation ? 1 : 1;
	const cg = halation ? 0.28 + (1 - tint) * 0.35 : 0.92;
	const cb = halation ? 0.08 + tint * 0.12 : 0.86;

	for (let i = 0; i < data.length; i += 4) {
		const glow = (blurred[i] * 0.3 + blurred[i + 1] * 0.5 + blurred[i + 2] * 0.2) / 255;
		const g = glow * amount * (halation ? 1.15 : 0.85);
		let r = data[i] / 255;
		let gch = data[i + 1] / 255;
		let b = data[i + 2] / 255;
		r = 1 - (1 - r) * (1 - cr * g);
		gch = 1 - (1 - gch) * (1 - cg * g);
		b = 1 - (1 - b) * (1 - cb * g);
		if (halation) {
			r = clamp01(r + cr * g * 0.22);
			gch = clamp01(gch + cg * g * 0.08);
		}
		out[i] = Math.round(clamp01(r) * 255);
		out[i + 1] = Math.round(clamp01(gch) * 255);
		out[i + 2] = Math.round(clamp01(b) * 255);
		out[i + 3] = data[i + 3];
	}
	return { data: out, width: w, height: h };
}

export function isGlowType(type: Modifier['type']): boolean {
	return type === 'halation' || type === 'bloom';
}
