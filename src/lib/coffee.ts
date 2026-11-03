/**
 * Coffee mug rings: a nearly-round hollow stain with pooled thickness,
 * an optional lift-gap, a drip, and a few droplets. Seeded so a batch
 * key keeps them stable but different per photo.
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

/** 0 latte → 1 espresso. Stays in the tan / caramel range of a dried ring. */
function roast(t: number): [number, number, number] {
	const x = clamp01(t);
	return [lerp(0.82, 0.42, x), lerp(0.58, 0.24, x), lerp(0.32, 0.08, x)];
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
	out[i] = out[i] * (1 - a * (1 - cr));
	out[i + 1] = out[i + 1] * (1 - a * (1 - cg));
	out[i + 2] = out[i + 2] * (1 - a * (1 - cb));
}

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
	const vx = bx - ax;
	const vy = by - ay;
	const den = vx * vx + vy * vy;
	const t = den <= 1e-8 ? 0 : clamp01(((px - ax) * vx + (py - ay) * vy) / den);
	return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

function softDisk(d: number, radius: number, feather: number): number {
	if (d >= radius + feather) return 0;
	if (d <= radius) return 1;
	return 1 - smooth01((d - radius) / Math.max(0.001, feather));
}

type Ring = {
	cx: number;
	cy: number;
	r: number;
	a2: number;
	p2: number;
	a3: number;
	p3: number;
	thick: number;
	lobe: number;
	lobeAng: number;
	gap: number;
	gapAng: number;
	gapW: number;
	gain: number;
};

function ringAt(ring: Ring, theta: number): { rad: number; thick: number; open: number } {
	const rad = ring.r * (1 + ring.a2 * Math.cos(2 * theta + ring.p2) + ring.a3 * Math.cos(3 * theta + ring.p3));
	const pool = Math.pow(0.5 + 0.5 * Math.cos(theta - ring.lobeAng), 2.4);
	const thick = ring.thick * (0.72 + ring.lobe * pool);
	let open = 1;
	if (ring.gap > 0.04) {
		let d = theta - ring.gapAng;
		while (d > Math.PI) d -= Math.PI * 2;
		while (d < -Math.PI) d += Math.PI * 2;
		open = smooth01((Math.abs(d) - ring.gapW * 0.35) / Math.max(0.02, ring.gapW));
		open = lerp(1, open, ring.gap);
	}
	return { rad, thick, open };
}

function paintRing(
	out: Uint8ClampedArray,
	w: number,
	h: number,
	ring: Ring,
	amount: number,
	feather: number,
	color: [number, number, number]
): void {
	const pad = ring.r + ring.thick + feather + 4;
	const x0 = Math.max(0, Math.floor(ring.cx - pad));
	const y0 = Math.max(0, Math.floor(ring.cy - pad));
	const x1 = Math.min(w - 1, Math.ceil(ring.cx + pad));
	const y1 = Math.min(h - 1, Math.ceil(ring.cy + pad));

	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			const dx = x - ring.cx;
			const dy = y - ring.cy;
			const theta = Math.atan2(dy, dx);
			const { rad, thick, open } = ringAt(ring, theta);
			if (open <= 0.001) continue;
			const half = thick * 0.5;
			const d = Math.abs(Math.hypot(dx, dy) - rad);
			const cover = softDisk(d, half, feather) * open * ring.gain * amount;
			if (cover <= 0.001) continue;
			stainInto(out, w, h, x, y, cover, color[0], color[1], color[2]);
		}
	}
}

function paintBlob(
	out: Uint8ClampedArray,
	w: number,
	h: number,
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	rot: number,
	amount: number,
	feather: number,
	color: [number, number, number]
): void {
	const pad = Math.max(rx, ry) + feather + 2;
	const x0 = Math.max(0, Math.floor(cx - pad));
	const y0 = Math.max(0, Math.floor(cy - pad));
	const x1 = Math.min(w - 1, Math.ceil(cx + pad));
	const y1 = Math.min(h - 1, Math.ceil(cy + pad));
	const cos = Math.cos(rot);
	const sin = Math.sin(rot);
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			const dx = x - cx;
			const dy = y - cy;
			const lx = (dx * cos + dy * sin) / Math.max(1, rx);
			const ly = (-dx * sin + dy * cos) / Math.max(1, ry);
			const d = Math.hypot(lx, ly);
			const cover = softDisk(d, 1, feather / Math.max(1, Math.min(rx, ry))) * amount;
			if (cover <= 0.001) continue;
			stainInto(out, w, h, x, y, cover, color[0], color[1], color[2]);
		}
	}
}

function paintDrip(
	out: Uint8ClampedArray,
	w: number,
	h: number,
	ax: number,
	ay: number,
	bx: number,
	by: number,
	startR: number,
	endR: number,
	amount: number,
	feather: number,
	color: [number, number, number]
): void {
	const pad = Math.max(startR, endR) + feather + 2;
	const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - pad));
	const y0 = Math.max(0, Math.floor(Math.min(ay, by) - pad));
	const x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + pad));
	const y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + pad));
	const len = Math.hypot(bx - ax, by - ay) || 1;
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			const vx = bx - ax;
			const vy = by - ay;
			const t = clamp01(((x - ax) * vx + (y - ay) * vy) / (len * len));
			const d = distToSeg(x, y, ax, ay, bx, by);
			const rad = lerp(startR, endR, t * t);
			const cover = softDisk(d, rad, feather) * amount;
			if (cover <= 0.001) continue;
			stainInto(out, w, h, x, y, cover, color[0], color[1], color[2]);
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
	const extrasOn = style === 1 || style === 2;
	const seed = mixSeed(mod.seed, batchKey);
	const minSide = Math.min(w, h);
	const size = 0.1 + clamp01(mod.radius) * 0.32;
	const wear = clamp01(mod.softness);
	const color = roast(clamp01(mod.tint));
	const cx = clamp01(mod.centerX) * (w - 1);
	const cy = clamp01(mod.centerY) * (h - 1);
	const R = minSide * size;
	const feather = Math.max(0.8, R * (0.012 + wear * 0.01));

	if (ringsOn) {
		const count = amount > 0.72 && wear > 0.35 ? 2 : 1;
		for (let i = 0; i < count; i++) {
			const ox = i === 0 ? 0 : (hash2(i, 3, seed) - 0.5) * R * 0.22;
			const oy = i === 0 ? 0 : (hash2(i, 5, seed) - 0.5) * R * 0.22;
			const ring: Ring = {
				cx: cx + ox,
				cy: cy + oy,
				r: R * (i === 0 ? 1 : 0.88 + hash2(i, 7, seed) * 0.18),
				a2: 0.012 + wear * 0.028,
				p2: hash2(i, 11, seed) * Math.PI * 2,
				a3: 0.006 + wear * 0.016,
				p3: hash2(i, 13, seed) * Math.PI * 2,
				thick: R * (0.07 + wear * 0.035),
				lobe: 0.55 + wear * 0.85,
				lobeAng: hash2(i, 17, seed) * Math.PI * 2,
				gap: wear > 0.22 ? 0.55 + wear * 0.4 : 0,
				gapAng: hash2(i, 19, seed) * Math.PI * 2,
				gapW: 0.18 + wear * 0.22,
				gain: (i === 0 ? 0.82 : 0.42) * (0.75 + amount * 0.35)
			};
			paintRing(out, w, h, ring, amount, feather, color);
		}
	}

	if (extrasOn) {
		const dripAng = hash2(4, 23, seed) * Math.PI * 2;
		const { rad, thick } = ringsOn
			? ringAt(
					{
						cx,
						cy,
						r: R,
						a2: 0.012 + wear * 0.028,
						p2: hash2(0, 11, seed) * Math.PI * 2,
						a3: 0.006 + wear * 0.016,
						p3: hash2(0, 13, seed) * Math.PI * 2,
						thick: R * (0.07 + wear * 0.035),
						lobe: 0.55 + wear * 0.85,
						lobeAng: hash2(0, 17, seed) * Math.PI * 2,
						gap: 0,
						gapAng: 0,
						gapW: 0.2,
						gain: 1
					},
					dripAng
				)
			: { rad: R * 0.15, thick: R * 0.08 };
		const ax = cx + Math.cos(dripAng) * (ringsOn ? rad : 0);
		const ay = cy + Math.sin(dripAng) * (ringsOn ? rad : 0);
		const len = R * (ringsOn ? 0.1 + wear * 0.16 : 0.28 + wear * 0.2);
		const bx = ax + Math.cos(dripAng) * len;
		const by = ay + Math.sin(dripAng) * len;
		const startR = ringsOn ? thick * 0.7 : R * 0.07;
		const blobR = R * (ringsOn ? 0.055 + wear * 0.035 : 0.12 + wear * 0.06);
		paintDrip(out, w, h, ax, ay, bx, by, startR, blobR * 0.7, amount * 0.85, feather, color);
		paintBlob(out, w, h, bx, by, blobR, blobR * (0.78 + hash2(6, 29, seed) * 0.28), dripAng, amount * 0.8, feather, color);

		if (!ringsOn) {
			paintBlob(
				out,
				w,
				h,
				cx,
				cy,
				R * (0.22 + wear * 0.08),
				R * (0.16 + wear * 0.08),
				hash2(8, 31, seed) * Math.PI,
				amount * 0.7,
				feather * 1.4,
				color
			);
		}

		const drops = Math.round(2 + amount * 4);
		for (let i = 0; i < drops; i++) {
			const ang = dripAng + (hash2(i, 37, seed) - 0.5) * 1.4;
			const dist = R * (0.72 + hash2(i, 41, seed) * 0.55);
			const dx = cx + Math.cos(ang) * dist;
			const dy = cy + Math.sin(ang) * dist;
			const rr = R * (0.012 + hash2(i, 43, seed) * 0.028);
			paintBlob(out, w, h, dx, dy, rr, rr * (0.7 + hash2(i, 47, seed) * 0.4), ang, amount * 0.7, feather * 0.8, color);
		}
	}

	return { data: out, width: w, height: h };
}

export function isCoffeeType(type: Modifier['type']): boolean {
	return type === 'coffee';
}
