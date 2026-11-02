/**
 * Built-in looks are named stacks. Clicking one copies that stack onto
 * the editor; after that the stack (not the look id) is the source of truth.
 */
import { M } from './modifiers';
import { emptySettings, settingsFromLook } from './modifiers';
import type { GradeSettings, Look } from './types';

export const LOOKS: Look[] = [
	{
		id: 'neutral',
		name: 'Neutral',
		note: 'Empty stack. Add modifiers yourself.',
		strength: 1,
		stack: []
	},
	{
		id: 'negative',
		name: 'Negative',
		note: 'Scanned colour-negative: warm mask, lifted blacks.',
		strength: 1,
		stack: [
			M.wb(0.28, 0.08),
			M.saturation(0.92),
			M.contrast(0.18),
			M.tone(0.12, 0.16),
			M.fade(0.22),
			M.split(1, [0.42, 0.28, 0.18], [1, 0.94, 0.82]),
			M.vignette(0.58),
			M.grain(0.28)
		]
	},
	{
		id: 'portra',
		name: 'Portra',
		note: 'Warm skin, gentle contrast, peach highlights.',
		strength: 1,
		stack: [
			M.wb(0.18, 0.04),
			M.saturation(0.88),
			M.contrast(0.1),
			M.tone(0.08, 0.12),
			M.fade(0.12),
			M.split(1, [0.22, 0.18, 0.16], [1, 0.9, 0.78]),
			M.vignette(0.42),
			M.grain(0.18)
		]
	},
	{
		id: 'kodachrome',
		name: 'Kodachrome',
		note: 'Punchy reds, deep blacks, tight highlights.',
		strength: 1,
		stack: [
			M.wb(0.12, 0.02),
			M.saturation(1.18),
			M.contrast(0.32),
			M.tone(-0.04, 0.08),
			M.fade(0.04),
			M.split(1, [0.08, 0.06, 0.12], [1, 0.92, 0.8]),
			M.vignette(0.52),
			M.grain(0.14)
		]
	},
	{
		id: 'ektar',
		name: 'Ektar',
		note: 'Saturated landscape colour, clean grain.',
		strength: 1,
		stack: [
			M.wb(0.06, -0.04),
			M.saturation(1.28),
			M.contrast(0.22),
			M.tone(0.02, 0.1),
			M.fade(0.04),
			M.split(1, [0.1, 0.14, 0.18], [0.98, 0.96, 0.88]),
			M.vignette(0.44),
			M.grain(0.1)
		]
	},
	{
		id: 'trix',
		name: 'Tri-X',
		note: 'Pushed black-and-white, chunky grain.',
		strength: 1,
		stack: [
			M.bw(1),
			M.contrast(0.38),
			M.tone(-0.06, 0.1),
			M.fade(0.08),
			M.split(0.35, [0.12, 0.12, 0.14], [0.98, 0.97, 0.94]),
			M.vignette(0.6),
			M.grain(0.55)
		]
	},
	{
		id: 'faded70s',
		name: 'Faded 70s',
		note: 'Low contrast, teal shadows, amber highlights.',
		strength: 1,
		stack: [
			M.wb(0.1, -0.06),
			M.saturation(0.78),
			M.contrast(0.04),
			M.tone(0.16, 0.22),
			M.fade(0.38),
			M.split(1, [0.16, 0.28, 0.32], [1, 0.86, 0.62]),
			M.vignette(0.5),
			M.grain(0.32)
		]
	},
	{
		id: 'cross',
		name: 'Cross process',
		note: 'E6-as-C41: sick greens, crushed yellows.',
		strength: 1,
		stack: [
			M.wb(-0.12, -0.18),
			M.saturation(1.22),
			M.contrast(0.28),
			M.tone(0.04, 0.14),
			M.fade(0.1),
			M.split(1, [0.08, 0.28, 0.26], [1, 0.88, 0.55]),
			M.vignette(0.48),
			M.grain(0.22)
		]
	}
];

export function lookById(id: string): Look {
	return LOOKS.find((l) => l.id === id) || LOOKS[0];
}

export function defaultSettings(): GradeSettings {
	return settingsFromLook(lookById('negative'));
}

export { emptySettings, settingsFromLook };
