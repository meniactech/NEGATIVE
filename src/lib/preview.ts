/**
 * Browser preview: downscale the original, then run the same grade engine
 * the server uses. Full-resolution work stays on export / batch.
 *
 * While a slider is moving we grade a small live raster. After the pointer
 * settles we grade the larger HQ raster.
 */
import { gradeRgba } from './grade';
import type { GradeSettings } from './types';

export const PREVIEW_HQ = 1400;
export const PREVIEW_LIVE = 640;

export function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			URL.revokeObjectURL(url);
			resolve(img);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('Could not read that image.'));
		};
		img.src = url;
	});
}

/** Draw the photo onto a canvas no larger than `longEdge`. */
export function rasterize(img: HTMLImageElement, longEdge: number): HTMLCanvasElement {
	const scale = Math.min(1, longEdge / Math.max(img.naturalWidth, img.naturalHeight));
	const w = Math.max(1, Math.round(img.naturalWidth * scale));
	const h = Math.max(1, Math.round(img.naturalHeight * scale));
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('No 2D canvas.');
	ctx.drawImage(img, 0, 0, w, h);
	return canvas;
}

export function readPixels(canvas: HTMLCanvasElement): ImageData {
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('No 2D canvas.');
	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** Grade cached pixels into `dest` (reused when the size matches). */
export function gradePixels(
	pixels: ImageData,
	settings: GradeSettings,
	dest: HTMLCanvasElement | null
): HTMLCanvasElement {
	const graded = gradeRgba(
		{ data: pixels.data, width: pixels.width, height: pixels.height },
		settings
	);
	const out = dest ?? document.createElement('canvas');
	if (out.width !== graded.width || out.height !== graded.height) {
		out.width = graded.width;
		out.height = graded.height;
	}
	const octx = out.getContext('2d');
	if (!octx) throw new Error('No 2D canvas.');
	const image = new ImageData(graded.width, graded.height);
	image.data.set(graded.data);
	octx.putImageData(image, 0, 0);
	return out;
}

/** Composite two grades with a vertical split at `t` (0..1). Left is current. */
export function presentSplit(
	left: HTMLCanvasElement,
	right: HTMLCanvasElement,
	dest: HTMLCanvasElement | null,
	width: number,
	height: number,
	t: number
): HTMLCanvasElement {
	const out = presentOn(left, dest, width, height);
	const other = presentOn(right, null, width, height);
	const ctx = out.getContext('2d');
	if (!ctx) throw new Error('No 2D canvas.');
	const x = Math.max(0, Math.min(width, Math.round(width * t)));
	if (x < width) ctx.drawImage(other, x, 0, width - x, height, x, 0, width - x, height);
	ctx.fillStyle = '#e8a15a';
	ctx.fillRect(Math.max(0, x - 1), 0, 2, height);
	return out;
}

/**
 * Draw `source` into a canvas of `width`×`height`. Live grades are smaller
 * than HQ; presenting them at the HQ size stops the preview jumping.
 * Aspect is preserved — a crop is never stretched to the original frame.
 */
export function presentOn(
	source: HTMLCanvasElement,
	dest: HTMLCanvasElement | null,
	width: number,
	height: number
): HTMLCanvasElement {
	const out = dest ?? document.createElement('canvas');
	if (out.width !== width || out.height !== height) {
		out.width = width;
		out.height = height;
	}
	const ctx = out.getContext('2d');
	if (!ctx) throw new Error('No 2D canvas.');
	drawContained(ctx, source, width, height);
	return out;
}

export function drawContained(
	ctx: CanvasRenderingContext2D | null,
	source: HTMLCanvasElement,
	width: number,
	height: number
): void {
	if (!ctx) return;
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	const srcA = source.width / Math.max(1, source.height);
	const dstA = width / Math.max(1, height);
	if (Math.abs(srcA - dstA) <= 0.02) {
		ctx.drawImage(source, 0, 0, width, height);
		return;
	}
	ctx.clearRect(0, 0, width, height);
	const s = Math.min(width / source.width, height / source.height);
	const dw = source.width * s;
	const dh = source.height * s;
	ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh);
}
