/**
 * Print / Polaroid / film rebate border.
 *
 * Whole-buffer pass: the photo is scaled into an inner frame and the
 * remaining pixels become paper or film stock. Output size stays the same
 * so preview, export and the strength mix keep working.
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

function hash2(x: number, y: number, seed: number): number {
	let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
	n = Math.imul(n ^ (n >>> 13), 1274126177);
	return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/** Signed distance to a rounded box. Negative is inside. */
function sdRoundBox(px: number, py: number, cx: number, cy: number, hw: number, hh: number, r: number): number {
	const rr = Math.min(r, hw, hh);
	const dx = Math.abs(px - cx) - (hw - rr);
	const dy = Math.abs(py - cy) - (hh - rr);
	const ax = dx > 0 ? dx : 0;
	const ay = dy > 0 ? dy : 0;
	return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - rr;
}

function sampleBilinear(
	data: Uint8ClampedArray,
	w: number,
	h: number,
	fx: number,
	fy: number
): [number, number, number] {
	const x = fx < 0 ? 0 : fx > w - 1 ? w - 1 : fx;
	const y = fy < 0 ? 0 : fy > h - 1 ? h - 1 : fy;
	const x0 = x | 0;
	const y0 = y | 0;
	const x1 = x0 < w - 1 ? x0 + 1 : x0;
	const y1 = y0 < h - 1 ? y0 + 1 : y0;
	const tx = x - x0;
	const ty = y - y0;
	const i00 = (y0 * w + x0) * 4;
	const i10 = (y0 * w + x1) * 4;
	const i01 = (y1 * w + x0) * 4;
	const i11 = (y1 * w + x1) * 4;
	const r = lerp(lerp(data[i00], data[i10], tx), lerp(data[i01], data[i11], tx), ty);
	const g = lerp(lerp(data[i00 + 1], data[i10 + 1], tx), lerp(data[i01 + 1], data[i11 + 1], tx), ty);
	const b = lerp(lerp(data[i00 + 2], data[i10 + 2], tx), lerp(data[i01 + 2], data[i11 + 2], tx), ty);
	return [r / 255, g / 255, b / 255];
}

function paperColor(tone: number, warmth: number): [number, number, number] {
	const t = clamp01(tone);
	const w = clamp01(warmth);
	return [clamp01(t + w * 0.04), clamp01(t - w * 0.02), clamp01(t - w * 0.16)];
}

/**
 * Scale the photo into a paper or film frame. `src` is not mutated.
 */
export function applyBorder(src: RgbaBuffer, mod: Modifier): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data.length);
	const amount = clamp01(mod.amount);
	if (amount <= 0.001) {
		out.set(data);
		return { data: out, width: w, height: h };
	}

	const style = Math.max(0, Math.min(2, Math.round(mod.style)));
	const film = style === 2;
	const polaroid = style === 1;
	const minSide = Math.min(w, h);
	const portrait = h > w;
	const side = Math.max(2, amount * minSide);
	const top = polaroid ? side * 0.92 : side;
	const bottom = polaroid ? side * 2.35 : side;
	let left = side;
	let right = side;
	let topM = top;
	let botM = bottom;
	if (film) {
		const rail = Math.max(6, amount * minSide * 1.15);
		const rebate = Math.max(3, rail * 0.38);
		if (portrait) {
			left = rail;
			right = rail;
			topM = rebate;
			botM = rebate;
		} else {
			left = rebate;
			right = rebate;
			topM = rail;
			botM = rail;
		}
	}

	const maxInsetX = w * 0.38;
	const maxInsetY = h * 0.38;
	left = Math.min(left, maxInsetX);
	right = Math.min(right, maxInsetX);
	topM = Math.min(topM, maxInsetY);
	botM = Math.min(botM, maxInsetY);

	const innerL = left;
	const innerT = topM;
	const innerR = w - right;
	const innerB = h - botM;
	const innerW = Math.max(2, innerR - innerL);
	const innerH = Math.max(2, innerB - innerT);
	const cx = (innerL + innerR) * 0.5;
	const cy = (innerT + innerB) * 0.5;
	const hw = innerW * 0.5;
	const hh = innerH * 0.5;
	const corner = polaroid ? Math.min(hw, hh) * 0.035 : film ? 1.2 : Math.min(hw, hh) * 0.012;
	const feather = film ? 1.1 : polaroid ? 1.6 : 2.2;
	const paper = paperColor(mod.tint, mod.shadows);
	const holeFill: [number, number, number] = film
		? [
				clamp01(paper[0] + (0.92 - paper[0]) * 0.94),
				clamp01(paper[1] + (0.9 - paper[1]) * 0.94),
				clamp01(paper[2] + (0.86 - paper[2]) * 0.94)
			]
		: paper;

	const rail = portrait ? left : topM;
	const holeW = rail * (portrait ? 0.48 : 0.78);
	const holeH = rail * (portrait ? 0.72 : 0.48);
	const pitch = (portrait ? holeH : holeW) * 2.05;
	const holeR = Math.min(holeW, holeH) * 0.16;
	const holeRun = portrait ? innerH : innerW;
	const holeCount = Math.max(1, Math.floor((holeRun - pitch * 0.4) / pitch) + 1);
	const holeSpan = (holeCount - 1) * pitch;
	const holeStart = ((portrait ? innerT + innerB : innerL + innerR) - holeSpan) * 0.5;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 4;
			const wobble = film
				? (hash2(x, y >> 3, 19) - 0.5) * 1.15 + (hash2(x >> 2, y, 41) - 0.5) * 0.7
				: (hash2(x, y, 7) - 0.5) * 0.55;
			const sd = sdRoundBox(x, y, cx, cy, hw, hh, corner) + wobble;
			const photoT = smooth01((-sd + 0.4) / feather);

			let br = paper[0];
			let bg = paper[1];
			let bb = paper[2];

			if (film) {
				const speckle = (hash2(x >> 1, y >> 1, 73) - 0.5) * 0.045;
				br = clamp01(br + speckle);
				bg = clamp01(bg + speckle * 0.9);
				bb = clamp01(bb + speckle * 0.75);

				const inRail = portrait
					? x < innerL - 1.2 || x > innerR + 1.2
					: y < innerT - 1.2 || y > innerB + 1.2;
				if (inRail && holeCount > 0) {
					const along = portrait ? y : x;
					const idx = Math.round((along - holeStart) / pitch);
					if (idx >= 0 && idx < holeCount) {
						const ha = holeStart + idx * pitch;
						const hx = portrait ? (x < w * 0.5 ? left * 0.5 : w - right * 0.5) : ha;
						const hy = portrait ? ha : y < h * 0.5 ? topM * 0.5 : h - botM * 0.5;
						const holeSd = sdRoundBox(x, y, hx, hy, holeW * 0.5, holeH * 0.5, holeR);
						const holeT = smooth01((-holeSd + 0.35) / 1.15);
						if (holeT > 0) {
							br = lerp(br, holeFill[0], holeT);
							bg = lerp(bg, holeFill[1], holeT);
							bb = lerp(bb, holeFill[2], holeT);
						}
					}
				}
			}

			if (photoT > 0) {
				const u = (x - innerL) / innerW;
				const v = (y - innerT) / innerH;
				const [pr, pg, pb] = sampleBilinear(data, w, h, u * (w - 1), v * (h - 1));
				let r = pr;
				let g = pg;
				let b = pb;
				if (polaroid || !film) {
					const recess = smooth01((-sd + 2.8) / 3.2) * (1 - smooth01((-sd + 0.2) / 1.4));
					const shade = recess * (polaroid ? 0.16 : 0.08);
					r *= 1 - shade;
					g *= 1 - shade;
					b *= 1 - shade * 0.9;
				}
				br = lerp(br, r, photoT);
				bg = lerp(bg, g, photoT);
				bb = lerp(bb, b, photoT);
			} else if (film) {
				const line = smooth01((Math.abs(sd) - 0.2) / 1.4);
				const hair = (1 - line) * 0.18;
				br = clamp01(br + hair * (0.55 - br));
				bg = clamp01(bg + hair * (0.5 - bg));
				bb = clamp01(bb + hair * (0.42 - bb));
			}

			out[i] = Math.round(br * 255);
			out[i + 1] = Math.round(bg * 255);
			out[i + 2] = Math.round(bb * 255);
			out[i + 3] = data[i + 3];
		}
	}

	return { data: out, width: w, height: h };
}

export function isBorderType(type: Modifier['type']): boolean {
	return type === 'border';
}
