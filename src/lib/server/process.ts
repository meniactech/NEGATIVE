/**
 * Server-only image I/O. Decode with sharp, grade with the shared engine,
 * encode back to JPEG/PNG/WebP matching the source extension.
 */
import { extname } from 'node:path';
import sharp from 'sharp';
import { gradeRgba } from '$lib/grade';
import type { GradeSettings } from '$lib/types';

export async function gradeFile(inputPath: string, outputPath: string, settings: GradeSettings): Promise<void> {
	const src = sharp(inputPath).ensureAlpha().rotate(); // honour EXIF orientation
	const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
	if (info.channels !== 4) {
		throw new Error(`Expected RGBA, got ${info.channels} channels`);
	}
	const graded = gradeRgba(
		{ data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height },
		{ ...settings, batchKey: inputPath }
	);
	let out = sharp(Buffer.from(graded.data), {
		raw: { width: graded.width, height: graded.height, channels: 4 }
	});
	const ext = extname(outputPath).toLowerCase();
	if (ext === '.png') out = out.png();
	else if (ext === '.webp') out = out.webp({ quality: 90 });
	else out = out.jpeg({ quality: 92, mozjpeg: true });
	await out.toFile(outputPath);
}

export async function gradeBytes(input: Buffer, settings: GradeSettings, ext: string): Promise<{ bytes: Buffer; mime: string }> {
	const src = sharp(input).ensureAlpha().rotate();
	const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
	const graded = gradeRgba(
		{ data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width: info.width, height: info.height },
		settings
	);
	let out = sharp(Buffer.from(graded.data), {
		raw: { width: graded.width, height: graded.height, channels: 4 }
	});
	const kind = ext.toLowerCase();
	if (kind === '.png' || kind === 'png') {
		return { bytes: await out.png().toBuffer(), mime: 'image/png' };
	}
	if (kind === '.webp' || kind === 'webp') {
		return { bytes: await out.webp({ quality: 90 }).toBuffer(), mime: 'image/webp' };
	}
	return { bytes: await out.jpeg({ quality: 92, mozjpeg: true }).toBuffer(), mime: 'image/jpeg' };
}
