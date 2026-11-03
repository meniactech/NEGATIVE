/**
 * Source crop: a rectangle on the photo, applied only after Crop.
 * Preview, export and batch all run this through gradeRgba.
 *
 * Modifier fields: centerX/Y = left/top, radius = width, softness = height
 * (all 0..1 of the source). invert >= 0.5 means the crop is applied.
 */
import type { Modifier } from './types';

type RgbaBuffer = { data: Uint8ClampedArray; width: number; height: number };

export type CropRect = { x: number; y: number; w: number; h: number };

/** Smallest window, as a fraction of the source. */
export const CROP_MIN = 0.05;

export const CROP_DEFAULT: CropRect = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };

function clamp01(n: number): number {
	return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function cropRect(mod: Modifier): CropRect {
	return normalizeRect({
		x: mod.centerX,
		y: mod.centerY,
		w: mod.radius,
		h: mod.softness
	});
}

export function normalizeRect(rect: CropRect): CropRect {
	let w = clamp01(rect.w);
	let h = clamp01(rect.h);
	if (w < CROP_MIN) w = CROP_MIN;
	if (h < CROP_MIN) h = CROP_MIN;
	let x = clamp01(rect.x);
	let y = clamp01(rect.y);
	if (x + w > 1) x = 1 - w;
	if (y + h > 1) y = 1 - h;
	return { x, y, w, h };
}

export function writeCropRect(mod: Modifier, rect: CropRect): void {
	const next = normalizeRect(rect);
	mod.centerX = next.x;
	mod.centerY = next.y;
	mod.radius = next.w;
	mod.softness = next.h;
}

export function isCropApplied(mod: Modifier): boolean {
	return mod.invert >= 0.5;
}

export function isIdentityCrop(mod: Modifier): boolean {
	const r = cropRect(mod);
	return r.x <= 0.002 && r.y <= 0.002 && r.x + r.w >= 0.998 && r.y + r.h >= 0.998;
}

export function applyCropMod(mod: Modifier): void {
	mod.invert = 1;
}

export function resetCropMod(mod: Modifier): void {
	mod.invert = 0;
	writeCropRect(mod, CROP_DEFAULT);
}

export function applyCrop(src: RgbaBuffer, mod: Modifier): RgbaBuffer {
	const { width: w, height: h, data } = src;
	if (!isCropApplied(mod) || isIdentityCrop(mod)) {
		return { data: new Uint8ClampedArray(data), width: w, height: h };
	}
	const r = cropRect(mod);
	const x0 = Math.max(0, Math.min(w - 1, Math.round(r.x * w)));
	const y0 = Math.max(0, Math.min(h - 1, Math.round(r.y * h)));
	const x1 = Math.max(x0 + 1, Math.min(w, Math.round((r.x + r.w) * w)));
	const y1 = Math.max(y0 + 1, Math.min(h, Math.round((r.y + r.h) * h)));
	const outW = x1 - x0;
	const outH = y1 - y0;
	const out = new Uint8ClampedArray(outW * outH * 4);
	for (let y = 0; y < outH; y++) {
		const srcOff = ((y0 + y) * w + x0) * 4;
		out.set(data.subarray(srcOff, srcOff + outW * 4), y * outW * 4);
	}
	return { data: out, width: outW, height: outH };
}

export function isCropType(type: Modifier['type']): boolean {
	return type === 'crop';
}
