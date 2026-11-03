/**
 * Print halftone: newsprint dots, engraved lines, a CMYK magazine rosette,
 * or a velvet mezzotint. AM / FM screening, then ink on paper, mixed by amount.
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

function hash2(x: number, y: number, seed: number): number {
	let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
	n = Math.imul(n ^ (n >>> 13), 1274126177);
	return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function edge(dist: number, rad: number, feather: number): number {
	const t = (rad - dist) / feather;
	return t <= 0 ? 0 : t >= 1 ? 1 : smooth01(t);
}

function screenDot(x: number, y: number, angleDeg: number, cell: number, dark: number, feather: number): number {
	const th = (angleDeg * Math.PI) / 180;
	const cos = Math.cos(th);
	const sin = Math.sin(th);
	const sx = x * cos + y * sin;
	const sy = -x * sin + y * cos;
	const d = Math.hypot(wrapCenter(sx, cell), wrapCenter(sy, cell));
	return edge(d, dark * cell * 0.56, feather);
}

function screenLine(x: number, y: number, angleDeg: number, cell: number, dark: number, feather: number): number {
	const th = (angleDeg * Math.PI) / 180;
	const sy = -x * Math.sin(th) + y * Math.cos(th);
	return edge(Math.abs(wrapCenter(sy, cell)), dark * cell * 0.5, feather);
}

function valueNoise(x: number, y: number, seed: number): number {
	const x0 = Math.floor(x);
	const y0 = Math.floor(y);
	const fx = x - x0;
	const fy = y - y0;
	const ux = fx * fx * (3 - 2 * fx);
	const uy = fy * fy * (3 - 2 * fy);
	const a = hash2(x0, y0, seed);
	const b = hash2(x0 + 1, y0, seed);
	const c = hash2(x0, y0 + 1, seed);
	const d = hash2(x0 + 1, y0 + 1, seed);
	return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}

/** Rocker-tooth field: two crossed grain directions. Fine sandpaper, not clouds. */
function mezzField(x: number, y: number, cell: number, cos: number, sin: number): number {
	const rx = (x * cos + y * sin) / cell;
	const ry = (-x * sin + y * cos) / cell;
	return (
		valueNoise(rx * 1.15, ry * 1.7, 7) * 0.2 +
		valueNoise(rx * 2.4, ry * 3.4, 19) * 0.38 +
		valueNoise(rx * 5.1 + 12, ry * 6.2, 31) * 0.42
	);
}

/**
 * Soft FM mezzotint: local ink density tracks tone, plus rocker grain.
 * Narrow thresholds turn a face into paper islands — keep this wide and fine.
 */
function mezzCover(
	x: number,
	y: number,
	cell: number,
	dark: number,
	cos: number,
	sin: number,
	cos2: number,
	sin2: number
): number {
	if (dark <= 0.004) return 0;
	const n = mezzField(x, y, cell, cos, sin) * 0.58 + mezzField(x, y, cell * 1.12, cos2, sin2) * 0.42;
	const tooth = (hash2(x | 0, y | 0, 99) - 0.5) * 0.07;
	const amp = 0.2 + dark * 0.14;
	return clamp01(dark + (n - 0.5) * amp + tooth);
}

function mulInk(r: number, g: number, b: number, cover: number, ir: number, ig: number, ib: number): [number, number, number] {
	const a = clamp01(cover);
	return [r * lerp(1, ir, a), g * lerp(1, ig, a), b * lerp(1, ib, a)];
}

export function applyHalftone(src: RgbaBuffer, mod: Modifier): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data.length);
	const amount = clamp01(mod.amount);
	if (amount <= 0.001) {
		out.set(data);
		return { data: out, width: w, height: h };
	}

	const style = Math.max(0, Math.min(3, Math.round(mod.style)));
	const minSide = Math.min(w, h);
	const cell = Math.max(2.4, 2.6 + clamp01(mod.radius) * minSide * 0.045);
	const angle = mod.angle % 180;
	const inkT = clamp01(mod.tint);
	const inkR = lerp(0.07, 0.24, inkT);
	const inkG = lerp(0.065, 0.13, inkT);
	const inkB = lerp(0.06, 0.06, inkT);
	const paperR = lerp(0.97, 0.93, inkT * 0.55);
	const paperG = lerp(0.96, 0.88, inkT * 0.55);
	const paperB = lerp(0.93, 0.76, inkT * 0.55);
	const feather = Math.max(0.55, cell * 0.12);
	const gain = 1.08;
	const th = (angle * Math.PI) / 180;
	const cosA = Math.cos(th);
	const sinA = Math.sin(th);
	const cosB = Math.cos(th + 1.047);
	const sinB = Math.sin(th + 1.047);
	const mezzCell = Math.max(2.2, cell * 0.4);

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			const sr = data[i] / 255;
			const sg = data[i + 1] / 255;
			const sb = data[i + 2] / 255;
			let pr: number;
			let pg: number;
			let pb: number;

			if (style === 2) {
				const k = 1 - Math.max(sr, sg, sb);
				const ik = 1 - k;
				const c = ik <= 1e-5 ? 0 : (1 - sr - k) / ik;
				const m = ik <= 1e-5 ? 0 : (1 - sg - k) / ik;
				const ye = ik <= 1e-5 ? 0 : (1 - sb - k) / ik;
				let r = paperR;
				let g = paperG;
				let b = paperB;
				[r, g, b] = mulInk(r, g, b, screenDot(x, y, 15 + angle, cell, c * gain, feather), 0.08, 0.62, 0.78);
				[r, g, b] = mulInk(r, g, b, screenDot(x, y, 75 + angle, cell, m * gain, feather), 0.82, 0.08, 0.4);
				[r, g, b] = mulInk(r, g, b, screenDot(x, y, 0 + angle, cell, ye * gain, feather), 0.95, 0.84, 0.08);
				[r, g, b] = mulInk(r, g, b, screenDot(x, y, 45 + angle, cell, k * gain, feather), inkR, inkG, inkB);
				pr = r;
				pg = g;
				pb = b;
			} else {
				const dark = (1 - clamp01(luma(sr, sg, sb))) * gain;
				const cover =
					style === 1
						? screenLine(x, y, angle, cell, dark, feather)
						: style === 3
							? mezzCover(x, y, mezzCell, dark, cosA, sinA, cosB, sinB)
							: screenDot(x, y, angle, cell, dark, feather);
				pr = lerp(paperR, inkR, cover);
				pg = lerp(paperG, inkG, cover);
				pb = lerp(paperB, inkB, cover);
			}

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
