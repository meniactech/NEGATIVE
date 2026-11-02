/**
 * Spatial blur used by the Radial blur and Linear blur modifiers.
 *
 * Point-grade effects can run per pixel. Blur cannot — each pixel needs
 * its neighbours — so this is a whole-buffer pass. A fully blurred copy
 * is mixed back with the sharp buffer using a radial or linear mask.
 */
import type { Modifier } from './types';

type RgbaBuffer = { data: Uint8ClampedArray; width: number; height: number };

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

function boxPass(
	src: Uint8ClampedArray,
	w: number,
	h: number,
	radius: number,
	horizontal: boolean
): Uint8ClampedArray {
	const dst = new Uint8ClampedArray(src.length);
	const r = Math.max(1, radius | 0);
	if (horizontal) {
		const prefix = new Float64Array((w + 1) * 3);
		for (let y = 0; y < h; y++) {
			const row = y * w;
			prefix[0] = prefix[1] = prefix[2] = 0;
			for (let x = 0; x < w; x++) {
				const i = (row + x) * 4;
				const p = (x + 1) * 3;
				prefix[p] = prefix[p - 3] + src[i];
				prefix[p + 1] = prefix[p - 2] + src[i + 1];
				prefix[p + 2] = prefix[p - 1] + src[i + 2];
				dst[i + 3] = src[i + 3];
			}
			for (let x = 0; x < w; x++) {
				const lo = Math.max(0, x - r);
				const hi = Math.min(w, x + r + 1);
				const n = hi - lo;
				const i = (row + x) * 4;
				dst[i] = (prefix[(hi + 1) * 3 - 3] - prefix[lo * 3]) / n;
				dst[i + 1] = (prefix[(hi + 1) * 3 - 2] - prefix[lo * 3 + 1]) / n;
				dst[i + 2] = (prefix[(hi + 1) * 3 - 1] - prefix[lo * 3 + 2]) / n;
			}
		}
	} else {
		const prefix = new Float64Array((h + 1) * 3);
		for (let x = 0; x < w; x++) {
			prefix[0] = prefix[1] = prefix[2] = 0;
			for (let y = 0; y < h; y++) {
				const i = (y * w + x) * 4;
				const p = (y + 1) * 3;
				prefix[p] = prefix[p - 3] + src[i];
				prefix[p + 1] = prefix[p - 2] + src[i + 1];
				prefix[p + 2] = prefix[p - 1] + src[i + 2];
				dst[i + 3] = src[i + 3];
			}
			for (let y = 0; y < h; y++) {
				const lo = Math.max(0, y - r);
				const hi = Math.min(h, y + r + 1);
				const n = hi - lo;
				const i = (y * w + x) * 4;
				dst[i] = (prefix[(hi + 1) * 3 - 3] - prefix[lo * 3]) / n;
				dst[i + 1] = (prefix[(hi + 1) * 3 - 2] - prefix[lo * 3 + 1]) / n;
				dst[i + 2] = (prefix[(hi + 1) * 3 - 1] - prefix[lo * 3 + 2]) / n;
			}
		}
	}
	return dst;
}

/** Three box blurs ≈ a gaussian. Radius is in pixels. */
function softBlur(src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
	const cap = Math.max(1, Math.floor((Math.min(w, h) - 1) / 2));
	const r = Math.min(cap, Math.max(1, Math.round(radius)));
	let cur = src;
	for (let i = 0; i < 3; i++) {
		cur = boxPass(cur, w, h, r, true);
		cur = boxPass(cur, w, h, r, false);
	}
	return cur;
}

/**
 * Mix a blurred copy of `src` back in, weighted by a radial or linear mask.
 * Returns a new buffer. `src` is not mutated.
 */
export function applyMaskedBlur(src: RgbaBuffer, mod: Modifier): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data.length);
	const amount = clamp01(mod.amount);
	if (amount <= 0.001) {
		out.set(data);
		return { data: out, width: w, height: h };
	}

	const minSide = Math.min(w, h);
	const radiusPx = Math.max(1, amount * minSide * 0.055);
	const blurred = softBlur(data, w, h, radiusPx);

	const cx = clamp01(mod.centerX) * (w - 1);
	const cy = clamp01(mod.centerY) * (h - 1);
	const bandScale = mod.type === 'blurLinear' ? 0.5 : 1;
	const inner = Math.max(0, clamp01(mod.radius) * minSide * bandScale);
	const outer = inner + Math.max(2, clamp01(mod.softness) * minSide * 0.9);
	const inv = clamp01(mod.invert);
	const theta = ((mod.angle % 180) * Math.PI) / 180;
	const nx = Math.sin(theta);
	const ny = Math.cos(theta);
	const radial = mod.type === 'blurRadial';
	const span = outer - inner;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const d = radial
				? Math.hypot(x - cx, y - cy)
				: Math.abs((x - cx) * nx + (y - cy) * ny);
			let t = clamp01((d - inner) / span);
			t = t * t * (3 - 2 * t);
			t = t + (1 - 2 * t) * inv;
			const i = (y * w + x) * 4;
			out[i] = data[i] + (blurred[i] - data[i]) * t;
			out[i + 1] = data[i + 1] + (blurred[i + 1] - data[i + 1]) * t;
			out[i + 2] = data[i + 2] + (blurred[i + 2] - data[i + 2]) * t;
			out[i + 3] = data[i + 3];
		}
	}

	return { data: out, width: w, height: h };
}

export function isBlurType(type: Modifier['type']): boolean {
	return type === 'blurRadial' || type === 'blurLinear';
}
