/**
 * Grade one uploaded image and send the file back.
 * Used by the UI “Export this photo” button.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { gradeBytes } from '$lib/server/process';
import { assertLocal, parseSettings } from '$lib/server/localhost';

export const POST: RequestHandler = async (event) => {
	assertLocal(event);
	const form = await event.request.formData();
	const file = form.get('file');
	const settingsRaw = form.get('settings');
	if (!(file instanceof File)) error(400, 'No file.');
	if (typeof settingsRaw !== 'string') error(400, 'No settings.');
	let settings;
	try {
		settings = parseSettings(JSON.parse(settingsRaw));
	} catch (e) {
		error(400, e instanceof Error ? e.message : 'Bad settings.');
	}
	const name = file.name || 'export.jpg';
	const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '.jpg';
	try {
		const { bytes, mime } = await gradeBytes(Buffer.from(await file.arrayBuffer()), settings, ext);
		return new Response(new Uint8Array(bytes), {
			headers: {
				'Content-Type': mime,
				'Content-Disposition': `attachment; filename="negative-${name}"`
			}
		});
	} catch (e) {
		return json({ ok: false, error: e instanceof Error ? e.message : 'Export failed' }, { status: 500 });
	}
};
