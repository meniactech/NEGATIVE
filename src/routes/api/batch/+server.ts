/**
 * Grade every image in a local folder into a destination folder.
 * Paths are absolute (or resolved from the process cwd) on this machine.
 */
import { dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { absPath, destFor, ensureDest, listImages, mustBeDir } from '$lib/server/folders';
import { gradeFile } from '$lib/server/process';
import { assertLocal, parseSettings } from '$lib/server/localhost';

export const POST: RequestHandler = async (event) => {
	assertLocal(event);
	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		error(400, 'Expected JSON.');
	}
	let settings;
	try {
		settings = parseSettings(body.settings);
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Bad settings.');
	}
	const source = absPath(String(body.source || ''));
	const dest = absPath(String(body.dest || '') || source + '/negative');
	if (source === dest) error(400, 'Pick a different destination folder so originals stay untouched.');
	try {
		await mustBeDir(source);
		await ensureDest(dest);
		const files = await listImages(source, dest);
		const written: string[] = [];
		for (const file of files) {
			const out = destFor(source, dest, file);
			await mkdir(dirname(out), { recursive: true });
			await gradeFile(file, out, settings);
			written.push(out);
		}
		return json({ ok: true, count: written.length, dest, files: written });
	} catch (e) {
		return json({ ok: false, error: e instanceof Error ? e.message : 'Batch failed' }, { status: 500 });
	}
};
