/**
 * Local-folder helpers for batch convert.
 *
 * This is a single-user lab tool. We still refuse path tricks (empty, relative
 * traversal junk) and never write back over the source tree unless the user
 * picked a distinct destination.
 */
import { mkdir, readdir, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { IMAGE_EXTENSIONS } from '$lib/types';

export function isImageName(name: string): boolean {
	const ext = extname(name).toLowerCase();
	return (IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

/** Absolute, normalised path. Throws if the string is empty. */
export function absPath(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) throw new Error('Folder path is empty.');
	return resolve(trimmed);
}

export async function mustBeDir(path: string): Promise<void> {
	const s = await stat(path);
	if (!s.isDirectory()) throw new Error(`Not a folder: ${path}`);
}

function isInside(parent: string, child: string): boolean {
	const p = parent.endsWith(sep) ? parent : parent + sep;
	return child === parent || child.startsWith(p);
}

/**
 * Collect image files under `source`. If `dest` lives inside `source`, that
 * folder is skipped so a previous export does not get graded again.
 */
export async function listImages(source: string, dest: string): Promise<string[]> {
	const out: string[] = [];
	async function walk(dir: string): Promise<void> {
		if (isInside(dest, dir) && dir !== source) return;
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (entry.name.startsWith('.')) continue;
				await walk(full);
			} else if (entry.isFile() && isImageName(entry.name)) {
				out.push(full);
			}
		}
	}
	await walk(source);
	out.sort();
	return out;
}

export async function ensureDest(dest: string): Promise<void> {
	await mkdir(dest, { recursive: true });
}

/** Mirror source/relpath into dest/relpath. */
export function destFor(source: string, dest: string, file: string): string {
	const rel = file.slice(source.length).replace(/^[\\/]/, '');
	return join(dest, rel);
}
