/**
 * Sparse dust specks and hair-like scratches, hashed so a seed (and batch
 * key) makes each frame look different but stable.
 */
import { mixSeed } from './hash';
import type { Modifier } from './types';

type RgbaBuffer = { data: Uint8ClampedArray; width: number; height: number };

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

function hash2(x: number, y: number, seed: number): number {
	let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
	n = Math.imul(n ^ (n >>> 13), 1274126177);
	return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function applyDust(src: RgbaBuffer, mod: Modifier, batchKey?: string): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data);
	const amount = clamp01(mod.amount);
	if (amount <= 0.001) return { data: out, width: w, height: h };

	const seed = mixSeed(mod.seed, batchKey);
	const minSide = Math.min(w, h);
	const specks = Math.round(12 + amount * 90);
	const hairs = Math.round(2 + amount * 14);

	for (let n = 0; n < specks; n++) {
		const hx = hash2(n, 3, seed);
		const hy = hash2(n, 9, seed + 4);
		const x = Math.floor(hx * w);
		const y = Math.floor(hy * h);
		const dark = hash2(n, 17, seed) > 0.35;
		const rad = 1 + Math.floor(hash2(n, 21, seed) * (minSide * 0.004 + 1.5));
		const tone = dark ? 0.08 + hash2(n, 31, seed) * 0.18 : 0.78 + hash2(n, 33, seed) * 0.2;
		for (let dy = -rad; dy <= rad; dy++) {
			for (let dx = -rad; dx <= rad; dx++) {
				if (dx * dx + dy * dy > rad * rad) continue;
				const px = x + dx;
				const py = y + dy;
				if (px < 0 || py < 0 || px >= w || py >= h) continue;
				const i = (py * w + px) * 4;
				const a = 0.55 + hash2(px, py, seed) * 0.4;
				out[i] = out[i] + (tone * 255 - out[i]) * a;
				out[i + 1] = out[i + 1] + (tone * 240 - out[i + 1]) * a;
				out[i + 2] = out[i + 2] + (tone * 220 - out[i + 2]) * a;
			}
		}
	}

	for (let n = 0; n < hairs; n++) {
		const x0 = hash2(n, 41, seed + 8) * w;
		const y0 = hash2(n, 43, seed + 8) * h;
		const ang = hash2(n, 47, seed + 8) * Math.PI;
		const len = minSide * (0.04 + hash2(n, 53, seed) * 0.22);
		const steps = Math.max(4, Math.round(len));
		const thick = hash2(n, 59, seed) > 0.7 ? 1.4 : 0.7;
		for (let s = 0; s <= steps; s++) {
			const t = s / steps;
			const wobble = (hash2(n, s, seed) - 0.5) * 1.8;
			const x = Math.round(x0 + Math.cos(ang) * t * len + wobble);
			const y = Math.round(y0 + Math.sin(ang) * t * len + wobble * 0.4);
			const rad = thick;
			for (let dy = -1; dy <= 1; dy++) {
				for (let dx = -1; dx <= 1; dx++) {
					if (Math.hypot(dx, dy) > rad) continue;
					const px = x + dx;
					const py = y + dy;
					if (px < 0 || py < 0 || px >= w || py >= h) continue;
					const i = (py * w + px) * 4;
					const a = 0.45;
					out[i] = out[i] * (1 - a) + 18;
					out[i + 1] = out[i + 1] * (1 - a) + 16;
					out[i + 2] = out[i + 2] * (1 - a) + 14;
				}
			}
		}
	}

	return { data: out, width: w, height: h };
}

export function isDustType(type: Modifier['type']): boolean {
	return type === 'dust';
}
