/**
 * Midtone structure: unsharp mask that mostly leaves deep shadows and
 * blown highlights alone.
 */
import { softBlur } from './blur';
import type { Modifier } from './types';

type RgbaBuffer = { data: Uint8ClampedArray; width: number; height: number };

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function applyClarity(src: RgbaBuffer, mod: Modifier): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data.length);
	const amount = Math.max(-1, Math.min(1, mod.amount));
	if (Math.abs(amount) <= 0.001) {
		out.set(data);
		return { data: out, width: w, height: h };
	}

	const minSide = Math.min(w, h);
	const blurred = softBlur(data, w, h, Math.max(1, minSide * 0.018));
	const gain = amount * 1.35;

	for (let i = 0; i < data.length; i += 4) {
		const y = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
		const mid = clamp01(1 - Math.abs(y - 0.5) * 2.15);
		const t = mid * mid * (3 - 2 * mid);
		out[i] = data[i] + (data[i] - blurred[i]) * gain * t;
		out[i + 1] = data[i + 1] + (data[i + 1] - blurred[i + 1]) * gain * t;
		out[i + 2] = data[i + 2] + (data[i + 2] - blurred[i + 2]) * gain * t;
		out[i + 3] = data[i + 3];
	}
	return { data: out, width: w, height: h };
}

export function isClarityType(type: Modifier['type']): boolean {
	return type === 'clarity';
}
