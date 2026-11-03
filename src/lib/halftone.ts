/**
 * Print halftone: newsprint dots or an engraved line screen.
 * AM screening on luma, then ink on paper, mixed by amount.
 */
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

function luma(r: number, g: number, b: number): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function wrapCenter(v: number, cell: number): number {
	const m = v - Math.floor(v / cell) * cell;
	return m - cell * 0.5;
}

export function applyHalftone(src: RgbaBuffer, mod: Modifier): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data.length);
	const amount = clamp01(mod.amount);
	if (amount <= 0.001) {
		out.set(data);
		return { data: out, width: w, height: h };
	}

	const lines = Math.round(mod.style) === 1;
	const minSide = Math.min(w, h);
	const cell = Math.max(2.4, 2.6 + clamp01(mod.radius) * minSide * 0.045);
	const theta = ((mod.angle % 180) * Math.PI) / 180;
	const cos = Math.cos(theta);
	const sin = Math.sin(theta);
	const inkT = clamp01(mod.tint);
	const inkR = lerp(0.07, 0.24, inkT);
	const inkG = lerp(0.065, 0.13, inkT);
	const inkB = lerp(0.06, 0.06, inkT);
	const paperR = lerp(0.97, 0.93, inkT * 0.55);
	const paperG = lerp(0.96, 0.88, inkT * 0.55);
	const paperB = lerp(0.93, 0.76, inkT * 0.55);
	const gain = 1.08;
	const feather = Math.max(0.55, cell * 0.12);

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			const sr = data[i] / 255;
			const sg = data[i + 1] / 255;
			const sb = data[i + 2] / 255;
			const yv = clamp01(luma(sr, sg, sb));
			const sx = x * cos + y * sin;
			const sy = -x * sin + y * cos;
			const dark = (1 - yv) * gain;
			let cover: number;
			if (lines) {
				const d = Math.abs(wrapCenter(sy, cell));
				const half = dark * cell * 0.5;
				const t = (half - d) / feather;
				cover = t <= 0 ? 0 : t >= 1 ? 1 : smooth01(t);
			} else {
				const dx = wrapCenter(sx, cell);
				const dy = wrapCenter(sy, cell);
				const d = Math.hypot(dx, dy);
				const rad = dark * cell * 0.56;
				const t = (rad - d) / feather;
				cover = t <= 0 ? 0 : t >= 1 ? 1 : smooth01(t);
			}
			const pr = lerp(paperR, inkR, cover);
			const pg = lerp(paperG, inkG, cover);
			const pb = lerp(paperB, inkB, cover);
			out[i] = Math.round(lerp(sr, pr, amount) * 255);
			out[i + 1] = Math.round(lerp(sg, pg, amount) * 255);
			out[i + 2] = Math.round(lerp(sb, pb, amount) * 255);
			out[i + 3] = data[i + 3];
		}
	}

	return { data: out, width: w, height: h };
}

export function isHalftoneType(type: Modifier['type']): boolean {
	return type === 'halftone';
}
