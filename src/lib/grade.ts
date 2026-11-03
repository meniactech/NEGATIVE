/**
 * Pixel-grade engine for NEGATIVE.
 *
 * Applies `settings.stack` in order. Point effects run per pixel; blur,
 * border, leak, glow, dust, stamp, chroma, dreamy, coffee, halftone, crop and clarity are
 * whole-buffer passes. Unused effects are simply not on the stack. Crop always
 * frames the source first so the look, strength mix and export share one window.
 *
 * This file has no DOM and no Node APIs. Preview, export and batch all
 * call `gradeRgba` with the same settings object.
 *
 * Working space is display-referred sRGB 0..1 (JPEG in / JPEG out).
 *
 * The inner loop mutates locals in place. Returning a new [r,g,b] array
 * per modifier per pixel will freeze the UI while a slider is dragged.
 */
import { applyBorder, isBorderType } from './border';
import { applyMaskedBlur, isBlurType } from './blur';
import { applyChroma, isChromaType } from './chroma';
import { applyClarity, isClarityType } from './clarity';
import { applyCoffee, isCoffeeType } from './coffee';
import { applyCrop, isCropApplied, isCropType, isIdentityCrop } from './crop';
import { applyDreamy, isDreamyType } from './dreamy';
import { applyDust, isDustType } from './dust';
import { applyGlow, isGlowType } from './glow';
import { applyHalftone, isHalftoneType } from './halftone';
import { mixSeed } from './hash';
import { applyLightLeak, isLeakType } from './leak';
import { applyStamp, isStampType } from './stamp';
import type { GradeSettings, Modifier, Rgb } from './types';

export type RgbaBuffer = {
	data: Uint8ClampedArray;
	width: number;
	height: number;
};

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function luma(r: number, g: number, b: number): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hash2(x: number, y: number, seed: number): number {
	let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 982451653);
	n = Math.imul(n ^ (n >>> 13), 1274126177);
	return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function toneCurve(v: number, shadows: number, highlights: number): number {
	let x = clamp01(v + shadows * (1 - v) * 0.85);
	const t = x * x * (3 - 2 * x);
	x = lerp(x, t, 0.35);
	return clamp01(x - highlights * x * x * x * 0.65);
}

function vigMap(width: number, height: number, amount: number): Float32Array {
	const map = new Float32Array(width * height);
	const iw = 1 / Math.max(1, width - 1);
	const ih = 1 / Math.max(1, height - 1);
	const gain = amount * 0.9;
	for (let y = 0; y < height; y++) {
		const ny = (y * ih - 0.5) * 2;
		const ny2 = ny * ny;
		for (let x = 0; x < width; x++) {
			const nx = (x * iw - 0.5) * 2;
			const d = Math.sqrt(nx * nx + ny2);
			const t = clamp01((d - 0.12) / 1.18);
			const fall = t * t * (3 - 2 * t);
			map[y * width + x] = clamp01(1 - fall * gain);
		}
	}
	return map;
}

/** Run a stretch of per-pixel modifiers on one buffer. Returns a new buffer. */
function applyPointRun(src: RgbaBuffer, mods: Modifier[], batchKey?: string): RgbaBuffer {
	const { width, height, data } = src;
	const out = new Uint8ClampedArray(data.length);

	let vignette: Float32Array | null = null;
	let grainScale = 1;
	let grainSeed = 11;
	let grainChroma = 0;
	for (const m of mods) {
		if (m.type === 'vignette') vignette = vigMap(width, height, m.amount);
		if (m.type === 'grain') {
			grainScale = Math.max(1, Math.min(width, height) / 1100);
			grainSeed = 11 + mixSeed(m.seed, batchKey);
			grainChroma = clamp01(m.tint);
		}
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			let r = data[i] / 255;
			let g = data[i + 1] / 255;
			let b = data[i + 2] / 255;

			for (let m = 0; m < mods.length; m++) {
				const mod = mods[m];
				switch (mod.type) {
					case 'wb': {
						const warm = mod.amount;
						const tint = mod.tint;
						r = clamp01(r * (1 + warm * 0.28) - tint * 0.04);
						g = clamp01(g * (1 - Math.abs(tint) * 0.06) + tint * 0.1);
						b = clamp01(b * (1 - warm * 0.32) - tint * 0.02);
						break;
					}
					case 'saturation': {
						const yv = luma(r, g, b);
						r = lerp(yv, r, mod.amount);
						g = lerp(yv, g, mod.amount);
						b = lerp(yv, b, mod.amount);
						break;
					}
					case 'brightness': {
						const lift = mod.amount * 0.45;
						r = clamp01(r + lift);
						g = clamp01(g + lift);
						b = clamp01(b + lift);
						break;
					}
					case 'exposure': {
						const gain = 2 ** mod.amount;
						r = clamp01(r * gain);
						g = clamp01(g * gain);
						b = clamp01(b * gain);
						break;
					}
					case 'contrast': {
						const c = 1 + mod.amount * 1.4;
						r = clamp01((r - 0.5) * c + 0.5);
						g = clamp01((g - 0.5) * c + 0.5);
						b = clamp01((b - 0.5) * c + 0.5);
						break;
					}
					case 'fade': {
						const lo = mod.amount * 0.16;
						const hi = 1 - mod.amount * 0.1;
						r = lerp(lo, hi, r);
						g = lerp(lo, hi, g);
						b = lerp(lo, hi, b);
						break;
					}
					case 'tone': {
						r = toneCurve(r, mod.shadows, mod.highlights);
						g = toneCurve(g, mod.shadows, mod.highlights);
						b = toneCurve(b, mod.shadows, mod.highlights);
						break;
					}
					case 'vignette': {
						if (vignette) {
							const v = vignette[y * width + x];
							r *= v;
							g *= v;
							b *= v;
						}
						break;
					}
					case 'grain': {
						const gx = Math.floor(x / grainScale);
						const gy = Math.floor(y / grainScale);
						const n = hash2(gx, gy, grainSeed) - 0.5;
						const nr = hash2(gx, gy, grainSeed + 17) - 0.5;
						const ng = hash2(gx, gy, grainSeed + 29) - 0.5;
						const nb = hash2(gx, gy, grainSeed + 41) - 0.5;
						const yv = luma(r, g, b);
						const gain = mod.amount * 0.18 * (1.15 - yv * 0.7);
						const ch = grainChroma;
						r = clamp01(r + (n * (1 - ch) + nr * ch) * gain);
						g = clamp01(g + (n * (1 - ch) + ng * ch) * gain * 0.96);
						b = clamp01(b + (n * (1 - ch) + nb * ch) * gain * 0.9);
						break;
					}
					case 'bw': {
						const filt = Math.max(0, Math.min(4, Math.round(mod.style)));
						const wr = filt === 1 ? 0.82 : filt === 2 ? 0.58 : filt === 3 ? 0.42 : filt === 4 ? 0.12 : 0.2126;
						const wg = filt === 1 ? 0.14 : filt === 2 ? 0.38 : filt === 3 ? 0.5 : filt === 4 ? 0.78 : 0.7152;
						const wb = filt === 1 ? 0.04 : filt === 2 ? 0.04 : filt === 3 ? 0.08 : filt === 4 ? 0.1 : 0.0722;
						const yv = wr * r + wg * g + wb * b;
						r = lerp(r, yv, mod.amount);
						g = lerp(g, yv, mod.amount);
						b = lerp(b, yv, mod.amount);
						break;
					}
					case 'split': {
						if (mod.amount <= 0) break;
						const yv = luma(r, g, b);
						const sh: Rgb = mod.splitShadows;
						const hi: Rgb = mod.splitHighlights;
						const shadowMix = (1 - yv) * 0.22 * mod.amount;
						const highMix = yv * 0.16 * mod.amount;
						r = clamp01(r * (1 - shadowMix) + sh[0] * shadowMix * yv * 2 + (hi[0] - 1) * highMix * r);
						g = clamp01(g * (1 - shadowMix) + sh[1] * shadowMix * yv * 2 + (hi[1] - 1) * highMix * g);
						b = clamp01(b * (1 - shadowMix) + sh[2] * shadowMix * yv * 2 + (hi[2] - 1) * highMix * b);
						break;
					}
					default:
						break;
				}
			}

			out[i] = Math.round(r * 255);
			out[i + 1] = Math.round(g * 255);
			out[i + 2] = Math.round(b * 255);
			out[i + 3] = data[i + 3];
		}
	}

	return { data: out, width, height };
}

function isSpatialType(type: Modifier['type']): boolean {
	return (
		isBlurType(type) ||
		isBorderType(type) ||
		isLeakType(type) ||
		isGlowType(type) ||
		isDustType(type) ||
		isStampType(type) ||
		isChromaType(type) ||
		isDreamyType(type) ||
		isClarityType(type) ||
		isCoffeeType(type) ||
		isHalftoneType(type)
	);
}

function mixStrength(src: RgbaBuffer, graded: RgbaBuffer, strength: number): RgbaBuffer {
	const { width, height, data } = src;
	const out = new Uint8ClampedArray(data.length);
	for (let i = 0; i < data.length; i += 4) {
		out[i] = Math.round(lerp(data[i], graded.data[i], strength));
		out[i + 1] = Math.round(lerp(data[i + 1], graded.data[i + 1], strength));
		out[i + 2] = Math.round(lerp(data[i + 2], graded.data[i + 2], strength));
		out[i + 3] = data[i + 3];
	}
	return { data: out, width, height };
}

/**
 * Grade one 8-bit RGBA buffer (always returns a copy).
 * Alpha is copied through unchanged. Stack order is the apply order.
 */
export function gradeRgba(src: RgbaBuffer, settings: GradeSettings): RgbaBuffer {
	const strength = clamp01(settings.strength);
	const active: Modifier[] = [];
	let crop: Modifier | null = null;
	for (const m of settings.stack) {
		if (!m.enabled) continue;
		if (isCropType(m.type)) {
			if (!crop) crop = m;
			continue;
		}
		active.push(m);
	}

	let mixBase = src;
	let work: RgbaBuffer;
	if (crop && isCropApplied(crop) && !isIdentityCrop(crop)) {
		work = applyCrop(src, crop);
		mixBase = work;
	} else {
		work = {
			data: new Uint8ClampedArray(src.data),
			width: src.width,
			height: src.height
		};
	}

	const batchKey = settings.batchKey;
	let i = 0;
	while (i < active.length) {
		const t = active[i].type;
		if (isBlurType(t)) {
			work = applyMaskedBlur(work, active[i]);
			i++;
		} else if (isBorderType(t)) {
			work = applyBorder(work, active[i]);
			i++;
		} else if (isLeakType(t)) {
			work = applyLightLeak(work, active[i], batchKey);
			i++;
		} else if (isGlowType(t)) {
			work = applyGlow(work, active[i]);
			i++;
		} else if (isDustType(t)) {
			work = applyDust(work, active[i], batchKey);
			i++;
		} else if (isStampType(t)) {
			work = applyStamp(work, active[i]);
			i++;
		} else if (isChromaType(t)) {
			work = applyChroma(work, active[i]);
			i++;
		} else if (isDreamyType(t)) {
			work = applyDreamy(work, active[i]);
			i++;
		} else if (isClarityType(t)) {
			work = applyClarity(work, active[i]);
			i++;
		} else if (isCoffeeType(t)) {
			work = applyCoffee(work, active[i], batchKey);
			i++;
		} else if (isHalftoneType(t)) {
			work = applyHalftone(work, active[i]);
			i++;
		} else {
			const run: Modifier[] = [];
			while (i < active.length && !isSpatialType(active[i].type)) {
				run.push(active[i]);
				i++;
			}
			work = applyPointRun(work, run, batchKey);
		}
	}

	if (strength < 0.999) return mixStrength(mixBase, work, strength);
	return work;
}
