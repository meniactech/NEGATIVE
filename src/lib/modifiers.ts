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
		| 'invert';
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
	/** Discrete look picker (border). */
	styles?: StyleChoice[];
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
		type: 'contrast',
		name: 'Contrast',
		note: '0 is unchanged',
		sliders: [{ field: 'amount', label: 'Contrast', min: -0.4, max: 0.8 }]
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
		sliders: [{ field: 'amount', label: 'Grain', min: 0, max: 1 }]
	},
	{
		type: 'bw',
		name: 'Black & white',
		note: 'Mix toward luma',
		sliders: [{ field: 'amount', label: 'Amount', min: 0, max: 1 }]
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
			{ field: 'angle', label: 'Angle', min: 0, max: 180, step: 1 }
		],
		styles: [
			{ value: 0, label: 'Edge' },
			{ value: 1, label: 'Corner' },
			{ value: 2, label: 'Streak' }
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
		style: extra.style ?? 0
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
		case 'contrast':
			return blank(type, 0.18, { id });
		case 'fade':
			return blank(type, 0.2, { id });
		case 'tone':
			return blank(type, 0, { id, shadows: 0.08, highlights: 0.1 });
		case 'vignette':
			return blank(type, 0.5, { id });
		case 'grain':
			return blank(type, 0.28, { id });
		case 'bw':
			return blank(type, 1, { id });
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
				angle: 12
			});
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
			splitHighlights: [...m.splitHighlights] as Rgb
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
	contrast: (n: number) => blank('contrast', n),
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
