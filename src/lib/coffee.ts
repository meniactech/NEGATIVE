/**
 * Coffee mug rings and spill stains. Multiply-blended browns, hashed so a
 * seed (and batch key) keeps them stable but different per photo.
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
	return lerp(
		lerp(hash2(x0, y0, seed), hash2(x0 + 1, y0, seed), sx),
		lerp(hash2(x0, y0 + 1, seed), hash2(x0 + 1, y0 + 1, seed), sx),
		sy
	);
}

function fbm(x: number, y: number, seed: number): number {
	let v = 0;
	let a = 0.55;
	let f = 1;
	for (let i = 0; i < 4; i++) {
		v += a * valueNoise(x * f, y * f, seed + i * 17);
		a *= 0.5;
		f *= 2.05;
	}
	return v;
}

/** 0 latte → 1 espresso. */
function roast(t: number): [number, number, number] {
	const x = clamp01(t);
	return [lerp(0.62, 0.16, x), lerp(0.4, 0.07, x), lerp(0.2, 0.035, x)];
}

function stainInto(
	out: Uint8ClampedArray,
	w: number,
	h: number,
	x: number,
	y: number,
	cover: number,
	cr: number,
	cg: number,
	cb: number
): void {
	if (cover <= 0.001 || x < 0 || y < 0 || x >= w || y >= h) return;
	const i = (y * w + x) * 4;
	const a = clamp01(cover);
	out[i] = out[i] * (1 - a) + out[i] * cr * a;
	out[i + 1] = out[i + 1] * (1 - a) + out[i + 1] * cg * a;
	out[i + 2] = out[i + 2] * (1 - a) + out[i + 2] * cb * a;
}

type Mark = {
	cx: number;
	cy: number;
	rx: number;
	ry: number;
	kind: 'ring' | 'spill' | 'drop';
	rot: number;
	seed: number;
	gain: number;
};

function paintMark(
	out: Uint8ClampedArray,
	w: number,
	h: number,
	mark: Mark,
	amount: number,
	soft: number,
	body: [number, number, number],
	rim: [number, number, number]
): void {
	const reach = Math.max(mark.rx, mark.ry) * 1.35;
	const x0 = Math.max(0, Math.floor(mark.cx - reach));
	const y0 = Math.max(0, Math.floor(mark.cy - reach));
	const x1 = Math.min(w - 1, Math.ceil(mark.cx + reach));
	const y1 = Math.min(h - 1, Math.ceil(mark.cy + reach));
	const cos = Math.cos(mark.rot);
	const sin = Math.sin(mark.rot);
	const invX = 1 / Math.max(1, mark.rx);
	const invY = 1 / Math.max(1, mark.ry);
	const nScale = 1 / Math.max(8, Math.min(mark.rx, mark.ry) * 0.35);

	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			const dx = x - mark.cx;
			const dy = y - mark.cy;
			const lx = (dx * cos + dy * sin) * invX;
			const ly = (-dx * sin + dy * cos) * invY;
			const warp = (fbm(x * nScale, y * nScale, mark.seed) - 0.5) * (0.16 + soft * 0.22);
			const d = Math.hypot(lx, ly) + warp;
			let cover = 0;
			let useRim = 0;

			if (mark.kind === 'ring') {
				const thick = 0.07 + soft * 0.08;
				const band = 1 - smooth01(Math.abs(d - 1) / thick);
				const ang = Math.atan2(ly, lx);
				const gap = fbm(Math.cos(ang) * 2.2, Math.sin(ang) * 2.2, mark.seed + 9);
				const broken = gap < 0.28 + soft * 0.18 ? smooth01(gap / 0.32) : 1;
				cover = band * broken;
				useRim = 0.75;
			} else if (mark.kind === 'spill') {
				const fill = 1 - smooth01((d - 0.15) / 0.95);
				const edge = 1 - smooth01(Math.abs(d - 0.82) / (0.16 + soft * 0.12));
				cover = fill * (0.28 + edge * 0.72);
				useRim = clamp01(edge * 1.1);
			} else {
				cover = 1 - smooth01(d / 0.85);
				useRim = 0.35;
			}

			cover *= mark.gain * amount;
			if (cover <= 0.001) continue;
			const cr = lerp(body[0], rim[0], useRim);
			const cg = lerp(body[1], rim[1], useRim);
			const cb = lerp(body[2], rim[2], useRim);
			stainInto(out, w, h, x, y, cover, cr, cg, cb);
		}
	}
}

export function applyCoffee(src: RgbaBuffer, mod: Modifier, batchKey?: string): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data);
	const amount = clamp01(mod.amount);
	if (amount <= 0.001) return { data: out, width: w, height: h };

	const style = Math.max(0, Math.min(2, Math.round(mod.style)));
	const ringsOn = style === 0 || style === 2;
	const spillsOn = style === 1 || style === 2;
	const seed = mixSeed(mod.seed, batchKey);
	const minSide = Math.min(w, h);
	const size = 0.08 + clamp01(mod.radius) * 0.28;
	const soft = clamp01(mod.softness);
	const body = roast(clamp01(mod.tint));
	const rim: [number, number, number] = [
		clamp01(body[0] * 0.55),
		clamp01(body[1] * 0.48),
		clamp01(body[2] * 0.4)
	];

	const marks: Mark[] = [];
	const originX = clamp01(mod.centerX) * (w - 1);
	const originY = clamp01(mod.centerY) * (h - 1);

	if (ringsOn) {
		const n = 1 + (amount > 0.55 ? 1 : 0);
		for (let i = 0; i < n; i++) {
			const ox = (hash2(i, 3, seed) - 0.5) * minSide * (i === 0 ? 0.04 : 0.22);
			const oy = (hash2(i, 7, seed) - 0.5) * minSide * (i === 0 ? 0.04 : 0.2);
			const rx = minSide * size * (0.85 + hash2(i, 11, seed) * 0.35);
			const ry = rx * (0.86 + hash2(i, 13, seed) * 0.22);
			marks.push({
				cx: originX + ox,
				cy: originY + oy,
				rx,
				ry,
				kind: 'ring',
				rot: (hash2(i, 17, seed) - 0.5) * 0.45,
				seed: seed + i * 31,
				gain: 0.72 + hash2(i, 19, seed) * 0.28
			});
		}
	}

	if (spillsOn) {
		const n = 1 + Math.round(amount * 2);
		for (let i = 0; i < n; i++) {
			const drip = i === 0;
			const ox = drip ? minSide * size * 0.18 : (hash2(i, 23, seed) - 0.35) * minSide * 0.28;
			const oy = drip ? minSide * size * 0.62 : (hash2(i, 29, seed) - 0.25) * minSide * 0.26;
			const rx = minSide * size * (drip ? 0.42 : 0.45 + hash2(i, 31, seed) * 0.7);
			const ry = rx * (drip ? 0.72 : 0.55 + hash2(i, 37, seed) * 0.7);
			marks.push({
				cx: originX + ox,
				cy: originY + oy,
				rx,
				ry,
				kind: 'spill',
				rot: drip ? 0.35 : hash2(i, 41, seed) * Math.PI,
				seed: seed + 80 + i * 19,
				gain: (drip ? 0.62 : 0.48) + hash2(i, 43, seed) * 0.28
			});
		}
	}

	const drops = Math.round(2 + amount * 7);
	for (let i = 0; i < drops; i++) {
		const ox = (hash2(i, 47, seed) - 0.5) * minSide * 0.34;
		const oy = (hash2(i, 53, seed) - 0.5) * minSide * 0.32;
		const r = minSide * (0.008 + hash2(i, 59, seed) * 0.028);
		marks.push({
			cx: originX + ox,
			cy: originY + oy,
			rx: r,
			ry: r * (0.7 + hash2(i, 61, seed) * 0.5),
			kind: 'drop',
			rot: hash2(i, 67, seed) * Math.PI,
			seed: seed + 140 + i * 11,
			gain: 0.5 + hash2(i, 71, seed) * 0.4
		});
	}

	for (const mark of marks) paintMark(out, w, h, mark, amount, soft, body, rim);
	return { data: out, width: w, height: h };
}

export function isCoffeeType(type: Modifier['type']): boolean {
	return type === 'coffee';
}
