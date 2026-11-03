/**
 * Cheap lateral chromatic smear: R and B sample from opposite offsets.
 */
import type { Modifier } from './types';

type RgbaBuffer = { data: Uint8ClampedArray; width: number; height: number };

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function applyChroma(src: RgbaBuffer, mod: Modifier): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data.length);
	const amount = clamp01(mod.amount);
	if (amount <= 0.001) {
		out.set(data);
		return { data: out, width: w, height: h };
	}

	const minSide = Math.min(w, h);
	const theta = ((mod.angle % 180) * Math.PI) / 180;
	const maxOff = amount * minSide * 0.012;
	const nx = Math.cos(theta);
	const ny = Math.sin(theta);

	for (let y = 0; y < h; y++) {
		const ey = Math.abs(y / Math.max(1, h - 1) - 0.5) * 2;
		for (let x = 0; x < w; x++) {
			const ex = Math.abs(x / Math.max(1, w - 1) - 0.5) * 2;
			const edge = 0.45 + 0.55 * Math.max(ex, ey);
			const off = maxOff * edge;
			const i = (y * w + x) * 4;
			const rx = Math.round(x + nx * off);
			const ry = Math.round(y + ny * off);
			const bx = Math.round(x - nx * off);
			const by = Math.round(y - ny * off);
			const ri =
				((ry < 0 ? 0 : ry > h - 1 ? h - 1 : ry) * w + (rx < 0 ? 0 : rx > w - 1 ? w - 1 : rx)) * 4;
			const bi =
				((by < 0 ? 0 : by > h - 1 ? h - 1 : by) * w + (bx < 0 ? 0 : bx > w - 1 ? w - 1 : bx)) * 4;
			out[i] = data[ri];
			out[i + 1] = data[i + 1];
			out[i + 2] = data[bi + 2];
			out[i + 3] = data[i + 3];
		}
	}
	return { data: out, width: w, height: h };
}

export function isChromaType(type: Modifier['type']): boolean {
	return type === 'chroma';
}
