/**
 * Catalogue of addable modifiers: labels, slider ranges, and the values
 * a newly added effect starts with.
 *
 * The engine (`grade.ts`) switches on `type`. This file is UI + defaults only.
 */
import type { GradeSettings, Look, Modifier, ModifierType, Rgb } from './types';

export type SliderSpec = {
	/** Field on Modifier. */
	field:
		| 'amount'
		| 'tint'
		| 'shadows'
		| 'highlights'
		| 'centerX'
		| 'centerY'
		| 'radius'
		| 'softness'
		| 'angle'
		| 'invert'
		| 'seed';
	label: string;
	min: number;
	max: number;
	step?: number;
};

export type StyleChoice = {
	value: number;
	label: string;
};

export type ModifierInfo = {
	type: ModifierType;
	name: string;
	/** Shown in the Add menu. */
	note: string;
	sliders: SliderSpec[];
	/** Extra RGB sliders (split tone). */
	rgb?: boolean;
	/** Discrete look picker (border / leak / stamp / B&W). */
	styles?: StyleChoice[];
	/** Free text (date stamp). */
	text?: boolean;
};

export const MODIFIER_INFO: ModifierInfo[] = [
	{
		type: 'wb',
		name: 'White balance',
		note: 'Temperature and tint',
		sliders: [
			{ field: 'amount', label: 'Temperature', min: -1, max: 1 },
			{ field: 'tint', label: 'Tint', min: -1, max: 1 }
		]
	},
	{
		type: 'saturation',
		name: 'Saturation',
		note: '1 is unchanged',
		sliders: [{ field: 'amount', label: 'Saturation', min: 0, max: 2 }]
	},
	{
		type: 'brightness',
		name: 'Brightness',
		note: '0 is unchanged',
		sliders: [{ field: 'amount', label: 'Brightness', min: -0.5, max: 0.5 }]
	},
	{
		type: 'exposure',
		name: 'Exposure',
		note: 'Stops. 0 is unchanged',
		sliders: [{ field: 'amount', label: 'Exposure', min: -1.5, max: 1.5 }]
	},
	{
		type: 'contrast',
		name: 'Contrast',
		note: '0 is unchanged',
		sliders: [{ field: 'amount', label: 'Contrast', min: -0.4, max: 0.8 }]
	},
	{
		type: 'clarity',
		name: 'Clarity',
		note: 'Midtone structure',
		sliders: [{ field: 'amount', label: 'Clarity', min: -0.4, max: 0.7 }]
	},
	{
		type: 'fade',
		name: 'Fade',
		note: 'Lifted blacks, compressed whites',
		sliders: [{ field: 'amount', label: 'Fade', min: 0, max: 1 }]
	},
	{
		type: 'tone',
		name: 'Tone',
		note: 'Shadow lift and highlight roll-off',
		sliders: [
			{ field: 'shadows', label: 'Shadows', min: -0.25, max: 0.4 },
			{ field: 'highlights', label: 'Highlights', min: -0.15, max: 0.45 }
		]
	},
	{
		type: 'vignette',
		name: 'Vignette',
		note: 'Darken the edges',
		sliders: [{ field: 'amount', label: 'Vignette', min: 0, max: 1.2 }]
	},
	{
		type: 'grain',
		name: 'Grain',
		note: 'Film grain',
		sliders: [
			{ field: 'amount', label: 'Grain', min: 0, max: 1 },
			{ field: 'tint', label: 'Color', min: 0, max: 1 },
			{ field: 'seed', label: 'Seed', min: 0, max: 1 }
		]
	},
	{
		type: 'bw',
		name: 'Black & white',
		note: 'Mix toward a filter',
		sliders: [{ field: 'amount', label: 'Amount', min: 0, max: 1 }],
		styles: [
			{ value: 0, label: 'Luma' },
			{ value: 1, label: 'Red' },
			{ value: 2, label: 'Orange' },
			{ value: 3, label: 'Yellow' },
			{ value: 4, label: 'Green' }
		]
	},
	{
		type: 'split',
		name: 'Split tone',
		note: 'Shadow / highlight colour',
		sliders: [{ field: 'amount', label: 'Amount', min: 0, max: 1 }],
		rgb: true
	},
	{
		type: 'blurRadial',
		name: 'Radial blur',
		note: 'Sharp disc, blur outside — or invert',
		sliders: [
			{ field: 'amount', label: 'Blur', min: 0, max: 1 },
			{ field: 'centerX', label: 'Center X', min: 0, max: 1 },
			{ field: 'centerY', label: 'Center Y', min: 0, max: 1 },
			{ field: 'radius', label: 'Focus', min: 0, max: 1 },
			{ field: 'softness', label: 'Softness', min: 0.05, max: 1 },
			{ field: 'invert', label: 'Invert', min: 0, max: 1 }
		]
	},
	{
		type: 'blurLinear',
		name: 'Linear blur',
		note: 'Tilt-shift band, rotatable',
		sliders: [
			{ field: 'amount', label: 'Blur', min: 0, max: 1 },
			{ field: 'angle', label: 'Angle', min: 0, max: 180, step: 1 },
			{ field: 'centerX', label: 'Shift X', min: 0, max: 1 },
			{ field: 'centerY', label: 'Shift Y', min: 0, max: 1 },
			{ field: 'radius', label: 'Band', min: 0, max: 1 },
			{ field: 'softness', label: 'Softness', min: 0.05, max: 1 },
			{ field: 'invert', label: 'Invert', min: 0, max: 1 }
		]
	},
	{
		type: 'border',
		name: 'Border',
		note: 'Print paper, Polaroid, or film rebate',
		sliders: [
			{ field: 'amount', label: 'Width', min: 0, max: 0.28 },
			{ field: 'tint', label: 'Tone', min: 0, max: 1 },
			{ field: 'shadows', label: 'Warmth', min: 0, max: 1 }
		],
		styles: [
			{ value: 0, label: 'Print' },
			{ value: 1, label: 'Polaroid' },
			{ value: 2, label: 'Film' }
		]
	},
	{
		type: 'leak',
		name: 'Light leak',
		note: 'Fogged film: edge, corner, or streak',
		sliders: [
			{ field: 'amount', label: 'Amount', min: 0, max: 1 },
			{ field: 'tint', label: 'Color', min: 0, max: 1 },
			{ field: 'centerX', label: 'Center X', min: 0, max: 1 },
			{ field: 'centerY', label: 'Center Y', min: 0, max: 1 },
			{ field: 'radius', label: 'Spread', min: 0.08, max: 1 },
			{ field: 'softness', label: 'Softness', min: 0.1, max: 1 },
			{ field: 'angle', label: 'Angle', min: 0, max: 180, step: 1 },
			{ field: 'seed', label: 'Seed', min: 0, max: 1 }
		],
		styles: [
			{ value: 0, label: 'Edge' },
			{ value: 1, label: 'Corner' },
			{ value: 2, label: 'Streak' }
		]
	},
	{
		type: 'halation',
		name: 'Halation',
		note: 'Red glow off bright points',
		sliders: [
			{ field: 'amount', label: 'Amount', min: 0, max: 1 },
			{ field: 'tint', label: 'Color', min: 0, max: 1 },
			{ field: 'radius', label: 'Threshold', min: 0, max: 1 },
			{ field: 'softness', label: 'Spread', min: 0.1, max: 1 }
		]
	},
	{
		type: 'bloom',
		name: 'Bloom',
		note: 'Soft highlight diffusion',
		sliders: [
			{ field: 'amount', label: 'Amount', min: 0, max: 1 },
			{ field: 'radius', label: 'Threshold', min: 0, max: 1 },
			{ field: 'softness', label: 'Spread', min: 0.1, max: 1 }
		]
	},
	{
		type: 'dust',
		name: 'Dust & scratches',
		note: 'Specks and hairs',
		sliders: [
			{ field: 'amount', label: 'Amount', min: 0, max: 1 },
			{ field: 'seed', label: 'Seed', min: 0, max: 1 }
		]
	},
	{
		type: 'stamp',
		name: 'Date stamp',
		note: 'Orange LCD date',
		sliders: [{ field: 'amount', label: 'Opacity', min: 0, max: 1 }],
		styles: [
			{ value: 0, label: 'Top left' },
			{ value: 1, label: 'Top right' },
			{ value: 2, label: 'Bottom right' },
			{ value: 3, label: 'Bottom left' }
		],
		text: true
	},
	{
		type: 'chroma',
		name: 'Chromatic smear',
		note: 'R / B offset, stronger at edges',
		sliders: [
			{ field: 'amount', label: 'Amount', min: 0, max: 1 },
			{ field: 'angle', label: 'Angle', min: 0, max: 180, step: 1 }
		]
	},
	{
		type: 'coffee',
		name: 'Coffee stain',
		note: 'Mug rings and spills',
		sliders: [
			{ field: 'amount', label: 'Amount', min: 0, max: 1 },
			{ field: 'tint', label: 'Roast', min: 0, max: 1 },
			{ field: 'centerX', label: 'Center X', min: 0, max: 1 },
			{ field: 'centerY', label: 'Center Y', min: 0, max: 1 },
			{ field: 'radius', label: 'Size', min: 0.05, max: 1 },
			{ field: 'softness', label: 'Wear', min: 0, max: 1 },
			{ field: 'seed', label: 'Seed', min: 0, max: 1 }
		],
		styles: [
			{ value: 0, label: 'Rings' },
			{ value: 1, label: 'Spills' },
			{ value: 2, label: 'Both' }
		]
	},
	{
		type: 'halftone',
		name: 'Halftone',
		note: 'Newsprint dots or engraved lines',
		sliders: [
			{ field: 'amount', label: 'Amount', min: 0, max: 1 },
			{ field: 'radius', label: 'Pitch', min: 0, max: 1 },
			{ field: 'angle', label: 'Angle', min: 0, max: 180, step: 1 },
			{ field: 'tint', label: 'Ink', min: 0, max: 1 }
		],
		styles: [
			{ value: 0, label: 'Newsprint' },
			{ value: 1, label: 'Line screen' }
		]
	}
];

export function infoFor(type: ModifierType): ModifierInfo {
	return MODIFIER_INFO.find((m) => m.type === type) || MODIFIER_INFO[0];
}

function rgb(r: number, g: number, b: number): Rgb {
	return [r, g, b];
}

function blank(type: ModifierType, amount: number, extra: Partial<Modifier> = {}): Modifier {
	return {
		id: extra.id || type,
		type,
		enabled: extra.enabled !== false,
		amount,
		tint: extra.tint ?? 0,
		shadows: extra.shadows ?? 0,
		highlights: extra.highlights ?? 0,
		splitShadows: extra.splitShadows ? ([...extra.splitShadows] as Rgb) : rgb(0.2, 0.2, 0.2),
		splitHighlights: extra.splitHighlights ? ([...extra.splitHighlights] as Rgb) : rgb(1, 1, 1),
		centerX: extra.centerX ?? 0.5,
		centerY: extra.centerY ?? 0.5,
		radius: extra.radius ?? 0.28,
		softness: extra.softness ?? 0.4,
		angle: extra.angle ?? 0,
		invert: extra.invert ?? 0,
		style: extra.style ?? 0,
		seed: extra.seed ?? 0,
		label: extra.label ?? ''
	};
}

/** Starting values when the user adds an effect from the menu. */
export function newModifier(type: ModifierType): Modifier {
	const id = type + '-' + Math.random().toString(36).slice(2, 8);
	switch (type) {
		case 'wb':
			return blank(type, 0.12, { id, tint: 0 });
		case 'saturation':
			return blank(type, 1.1, { id });
		case 'brightness':
			return blank(type, 0.08, { id });
		case 'exposure':
			return blank(type, 0.15, { id });
		case 'contrast':
			return blank(type, 0.18, { id });
		case 'clarity':
			return blank(type, 0.22, { id });
		case 'fade':
			return blank(type, 0.2, { id });
		case 'tone':
			return blank(type, 0, { id, shadows: 0.08, highlights: 0.1 });
		case 'vignette':
			return blank(type, 0.5, { id });
		case 'grain':
			return blank(type, 0.28, { id, tint: 0.2, seed: 0.15 });
		case 'bw':
			return blank(type, 1, { id, style: 0 });
		case 'split':
			return blank(type, 1, {
				id,
				splitShadows: rgb(0.22, 0.16, 0.28),
				splitHighlights: rgb(1, 0.9, 0.72)
			});
		case 'blurRadial':
			return blank(type, 0.55, { id, radius: 0.22, softness: 0.45 });
		case 'blurLinear':
			return blank(type, 0.55, { id, angle: 0, radius: 0.16, softness: 0.4 });
		case 'border':
			return blank(type, 0.1, { id, tint: 0.9, shadows: 0.22, style: 0 });
		case 'leak':
			return blank(type, 0.62, {
				id,
				tint: 0.28,
				style: 0,
				centerX: 0.04,
				centerY: 0.4,
				radius: 0.4,
				softness: 0.55,
				angle: 12,
				seed: 0.2
			});
		case 'halation':
			return blank(type, 0.45, { id, tint: 0.55, radius: 0.42, softness: 0.55 });
		case 'bloom':
			return blank(type, 0.35, { id, radius: 0.35, softness: 0.5 });
		case 'dust':
			return blank(type, 0.35, { id, seed: 0.4 });
		case 'stamp':
			return blank(type, 0.85, { id, style: 2, label: '94 08 12' });
		case 'chroma':
			return blank(type, 0.28, { id, angle: 0 });
		case 'coffee':
			return blank(type, 0.72, {
				id,
				tint: 0.28,
				style: 2,
				centerX: 0.7,
				centerY: 0.72,
				radius: 0.42,
				softness: 0.32,
				seed: 0.28
			});
		case 'halftone':
			return blank(type, 0.82, { id, style: 0, radius: 0.34, angle: 45, tint: 0.22 });
	}
}

/** Deep-copy a look’s stack so the UI can edit it without mutating the catalogue. */
export function settingsFromLook(look: Look): GradeSettings {
	return {
		strength: look.strength,
		stack: look.stack.map((m) => ({
			...m,
			id: m.type + '-' + Math.random().toString(36).slice(2, 8),
			splitShadows: [...m.splitShadows] as Rgb,
			splitHighlights: [...m.splitHighlights] as Rgb,
			label: m.label || ''
		}))
	};
}

export function emptySettings(): GradeSettings {
	return { strength: 1, stack: [] };
}

/** Build a modifier for a preset (stable ids = type, cloned on load). */
export const M = {
	wb: (temperature: number, tint: number) => blank('wb', temperature, { tint }),
	saturation: (n: number) => blank('saturation', n),
	brightness: (n: number) => blank('brightness', n),
	exposure: (n: number) => blank('exposure', n),
	contrast: (n: number) => blank('contrast', n),
	clarity: (n: number) => blank('clarity', n),
	fade: (n: number) => blank('fade', n),
	tone: (shadows: number, highlights: number) => blank('tone', 0, { shadows, highlights }),
	vignette: (n: number) => blank('vignette', n),
	grain: (n: number) => blank('grain', n),
	bw: (n: number) => blank('bw', n),
	split: (amount: number, shadows: Rgb, highlights: Rgb) =>
		blank('split', amount, { splitShadows: shadows, splitHighlights: highlights }),
	border: (width: number, tone: number, warmth = 0.22, style = 0) =>
		blank('border', width, { tint: tone, shadows: warmth, style }),
	leak: (amount: number, color = 0.28, style = 0) =>
		blank('leak', amount, {
			tint: color,
			style,
			centerX: 0.04,
			centerY: 0.4,
			radius: 0.4,
			softness: 0.55,
			angle: 12
		})
};
