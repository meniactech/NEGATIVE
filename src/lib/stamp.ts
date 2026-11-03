/**
 * Orange LCD date stamp, like a compact camera burned it into the frame.
 */
import type { Modifier } from './types';

type RgbaBuffer = { data: Uint8ClampedArray; width: number; height: number };

const SEG: Record<string, number> = {
	'0': 0b1111110,
	'1': 0b0110000,
	'2': 0b1101101,
	'3': 0b1111001,
	'4': 0b0110011,
	'5': 0b1011011,
	'6': 0b1011111,
	'7': 0b1110000,
	'8': 0b1111111,
	'9': 0b1111011
};

function paint(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, r: number, g: number, b: number) {
	if (x < 0 || y < 0 || x >= w || y >= h) return;
	const i = (y * w + x) * 4;
	data[i] = r;
	data[i + 1] = g;
	data[i + 2] = b;
}

function hbar(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, len: number, thick: number, rgb: [number, number, number]) {
	for (let t = 0; t < thick; t++) {
		for (let i = 0; i < len; i++) paint(data, w, h, x + i, y + t, rgb[0], rgb[1], rgb[2]);
	}
}

function vbar(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, len: number, thick: number, rgb: [number, number, number]) {
	for (let t = 0; t < thick; t++) {
		for (let i = 0; i < len; i++) paint(data, w, h, x + t, y + i, rgb[0], rgb[1], rgb[2]);
	}
}

function digit(
	data: Uint8ClampedArray,
	w: number,
	h: number,
	ox: number,
	oy: number,
	ch: string,
	dw: number,
	dh: number,
	thick: number,
	rgb: [number, number, number]
) {
	const bits = SEG[ch];
	if (!bits) return;
	const mid = (dh / 2) | 0;
	if (bits & 0b1000000) hbar(data, w, h, ox + thick, oy, dw - thick * 2, thick, rgb);
	if (bits & 0b0100000) vbar(data, w, h, ox + dw - thick, oy + thick, mid - thick, thick, rgb);
	if (bits & 0b0010000) vbar(data, w, h, ox + dw - thick, oy + mid, mid - thick, thick, rgb);
	if (bits & 0b0001000) hbar(data, w, h, ox + thick, oy + dh - thick, dw - thick * 2, thick, rgb);
	if (bits & 0b0000100) vbar(data, w, h, ox, oy + mid, mid - thick, thick, rgb);
	if (bits & 0b0000010) vbar(data, w, h, ox, oy + thick, mid - thick, thick, rgb);
	if (bits & 0b0000001) hbar(data, w, h, ox + thick, oy + mid - (thick >> 1), dw - thick * 2, thick, rgb);
}

export function applyStamp(src: RgbaBuffer, mod: Modifier): RgbaBuffer {
	const { width: w, height: h, data } = src;
	const out = new Uint8ClampedArray(data);
	const amount = Math.max(0, Math.min(1, mod.amount));
	if (amount <= 0.001) return { data: out, width: w, height: h };

	const text = (mod.label || '94 08 12').replace(/[^0-9 ]/g, ' ').slice(0, 14);
	const minSide = Math.min(w, h);
	const dh = Math.max(10, Math.round(minSide * 0.045));
	const dw = Math.max(6, Math.round(dh * 0.58));
	const thick = Math.max(1, Math.round(dh * 0.14));
	const gap = Math.max(2, Math.round(dw * 0.28));
	const chars = [...text];
	const totalW = chars.reduce((n, ch) => n + (ch === ' ' ? dw * 0.55 : dw) + gap, 0);
	const pad = Math.round(minSide * 0.045);
	const corner = Math.max(0, Math.min(3, Math.round(mod.style)));
	let x = corner === 1 || corner === 2 ? w - pad - totalW : pad;
	let y = corner >= 2 ? h - pad - dh : pad;
	const rgb: [number, number, number] = [
		Math.round(255 * (0.85 + amount * 0.15)),
		Math.round(90 + amount * 40),
		Math.round(12 + amount * 16)
	];

	for (const ch of chars) {
		if (ch === ' ') {
			x += dw * 0.55 + gap;
			continue;
		}
		digit(out, w, h, Math.round(x), Math.round(y), ch, dw, dh, thick, rgb);
		x += dw + gap;
	}
	return { data: out, width: w, height: h };
}

export function isStampType(type: Modifier['type']): boolean {
	return type === 'stamp';
}
