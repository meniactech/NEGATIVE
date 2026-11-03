/**
 * Analog light leak: fogged film from an edge, a corner bloom, or a streak.
 *
 * Whole-buffer pass. The leak is a warped distance field (value-noise so the
 * edge is not a clean gradient), then screen-blended with a yellow→red colour
 * that runs hotter in the core.
 */
import { mixSeed } from './hash';
import type { Modifier } from './types';

type RgbaBuffer = { data: Uint8ClampedArray; width: number; height: number };

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function smooth01(t: number): number {
	const x = clamp01(t);
	return x * x * (3 - 2 * x);
}

function hash2(x: number, y: number, seed: number): number {
	let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
	n = Math.imul(n ^ (n >>> 13), 1274126177);
	return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x: number, y: number, seed: number): number {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const tx = x - x0;
	const ty = y - y0;
	const sx = tx * tx * (3 - 2 * tx);
	const sy = ty * ty * (3 - 2 * ty);
	const n00 = hash2(x0, y0, seed);
	const n10 = hash2(x0 + 1, y0, seed);
	const n01 = hash2(x0, y0 + 1, seed);
	const n11 = hash2(x0 + 1, y0 + 1, seed);
	return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy);
}

function fbm(x: number, y: number, seed: number): number {
	let v = 0;
	let a = 0.52;
	let f = 1;
	for (let i = 0; i < 4; i++) {
		v += a * valueNoise(x * f, y * f, seed + i * 19);
		a *= 0.5;
		f *= 2.05;
	}
	return v;
}

/** 0 yellow → orange → red → magenta. */
function leakHue(t: number): [number, number, number] {
	const x = clamp01(t);
	if (x < 0.35) {
		const u = x / 0.35;
		return [1, lerp(0.86, 0.48, u), lerp(0.22, 0.1, u)];
	}
	if (x < 0.7) {
		const u = (x - 0.35) / 0.35;
		return [1, lerp(0.48, 0.16, u), lerp(0.1, 0.07, u)];
	}
	const u = (x - 0.7) / 0.3;
	return [lerp(1, 0.92, u), lerp(0.16, 0.1, u), lerp(0.07, 0.52, u)];
}

function falloff(dist: number, reach: number, softness: number): number {
	if (reach <= 0.0001) return 0;
	const t = dist / reach;
	if (t >= 1) return 0;
	const sharp = 1 - t;
	const soft = 1 - t * t;
	return smooth01(lerp(sharp, soft, clamp01(softness)));
}

/**
 * Paint a light leak onto a copy of `src`. `src` is not mutated.
 */
export function applyLightLeak(src: RgbaBuffer, mod: Modifier, batchKey?: string): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data.length);
	const amount = clamp01(mod.amount);
	if (amount <= 0.001) {
		out.set(data);
		return { data: out, width: w, height: h };
	}

	const style = Math.max(0, Math.min(2, Math.round(mod.style)));
	const cx = clamp01(mod.centerX);
	const cy = clamp01(mod.centerY);
	const spread = Math.max(0.06, clamp01(mod.radius));
	const soft = clamp01(mod.softness);
	const theta = ((mod.angle % 180) * Math.PI) / 180;
	const nxA = Math.sin(theta);
	const nyA = Math.cos(theta);
	const fringe = leakHue(mod.tint);
	const core = leakHue(Math.max(0, mod.tint - 0.22));
	core[0] = clamp01(core[0] + 0.08);
	core[1] = clamp01(core[1] + 0.18);
	core[2] = clamp01(core[2] * 0.7);

	const minSide = Math.min(w, h);
	const reach = spread * minSide;
	const streakReach = reach * 0.42;
	const seed = 29 + Math.round(cx * 40 + cy * 17 + style * 8) + mixSeed(mod.seed, batchKey);
	const warpAmp = reach * (0.18 + soft * 0.22);
	const iw = 1 / Math.max(1, w - 1);
	const ih = 1 / Math.max(1, h - 1);

	const wL = Math.pow(1.001 - cx, 2.4);
	const wR = Math.pow(cx + 0.001, 2.4);
	const wT = Math.pow(1.001 - cy, 2.4);
	const wB = Math.pow(cy + 0.001, 2.4);
	const wSum = wL + wR + wT + wB;

	for (let y = 0; y < h; y++) {
		const ny = y * ih;
		for (let x = 0; x < w; x++) {
			const nx = x * iw;
			const n1 = fbm(x / (minSide * 0.42), y / (minSide * 0.42), seed);
			const n2 = fbm(x / (minSide * 0.16), y / (minSide * 0.18), seed + 51);
			const warp = (n1 - 0.5) * warpAmp;
			const veins = Math.pow(clamp01(n2 * 1.15), 2.2);

			let shape = 0;
			if (style === 2) {
				const d = Math.abs((x - cx * (w - 1)) * nxA + (y - cy * (h - 1)) * nyA) + warp * 0.65;
				shape = falloff(d, streakReach, soft);
				const along = (x - cx * (w - 1)) * -nyA + (y - cy * (h - 1)) * nxA;
				const run = Math.max(w, h) * (0.35 + spread * 0.55);
				shape *= falloff(Math.abs(along) + warp * 0.35, run, 0.7);
			} else if (style === 1) {
				const d = Math.hypot(x - cx * (w - 1), y - cy * (h - 1)) + warp;
				shape = falloff(d, reach * 1.05, soft);
			} else {
				const dL = x + warp;
				const dR = w - 1 - x + warp;
				const dT = y + warp * 0.85;
				const dB = h - 1 - y + warp * 0.85;
				shape =
					(wL * falloff(dL, reach, soft) +
						wR * falloff(dR, reach, soft) +
						wT * falloff(dT, reach, soft) +
						wB * falloff(dB, reach, soft)) /
					wSum;
			}

			const field = clamp01(shape * (0.78 + n1 * 0.34) + veins * shape * 0.28);
			const i = (y * w + x) * 4;
			if (field <= 0.001) {
				out[i] = data[i];
				out[i + 1] = data[i + 1];
				out[i + 2] = data[i + 2];
				out[i + 3] = data[i + 3];
				continue;
			}

			const heat = field * field;
			const lr = lerp(fringe[0], core[0], heat);
			const lg = lerp(fringe[1], core[1], heat);
			const lb = lerp(fringe[2], core[2], heat);
			const veil = field * amount;
			const punch = heat * amount;

			let r = data[i] / 255;
			let g = data[i + 1] / 255;
			let b = data[i + 2] / 255;
			r = 1 - (1 - r) * (1 - lr * veil);
			g = 1 - (1 - g) * (1 - lg * veil);
			b = 1 - (1 - b) * (1 - lb * veil);
			r = clamp01(r + lr * punch * 0.42);
			g = clamp01(g + lg * punch * 0.32);
			b = clamp01(b + lb * punch * 0.18);

			out[i] = Math.round(r * 255);
			out[i + 1] = Math.round(g * 255);
			out[i + 2] = Math.round(b * 255);
			out[i + 3] = data[i + 3];
		}
	}

	return { data: out, width: w, height: h };
}

export function isLeakType(type: Modifier['type']): boolean {
	return type === 'leak';
}
