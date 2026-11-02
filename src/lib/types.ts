/**
 * Shared types for NEGATIVE.
 *
 * The grade is a stack of modifiers. Each modifier is one effect with its
 * own sliders. Looks are named stacks. Export and batch send the stack
 * as it currently is — unused effects are simply not on it.
 */

/** RGB in 0..1. Used for split-toning shadows and highlights. */
export type Rgb = [number, number, number];

export type ModifierType =
	| 'wb'
	| 'saturation'
	| 'contrast'
	| 'fade'
	| 'tone'
	| 'vignette'
	| 'grain'
	| 'bw'
	| 'split'
	| 'blurRadial'
	| 'blurLinear'
	| 'border';

/**
 * One effect on the stack. `amount` is the main slider; extra fields are
 * only used by some types (see `src/lib/modifiers.ts`).
 */
export type Modifier = {
	id: string;
	type: ModifierType;
	enabled: boolean;
	/** Meaning depends on type: temperature, saturation, vignette, … */
	amount: number;
	tint: number;
	shadows: number;
	highlights: number;
	splitShadows: Rgb;
	splitHighlights: Rgb;
	/** Blur mask: 0..1, image-relative. */
	centerX: number;
	centerY: number;
	/** Blur: sharp region size (radial radius / linear band). */
	radius: number;
	/** Blur: how wide the sharp→blur falloff is. */
	softness: number;
	/** Linear blur: band rotation in degrees, 0 = horizontal strip. */
	angle: number;
	/** Blur: 0 sharp-in-mask, 1 inverted (blur the focus region). */
	invert: number;
	/** Border look: 0 print, 1 Polaroid, 2 film rebate. */
	style: number;
};

/** What preview / export / batch all consume. */
export type GradeSettings = {
	/** 0 original … 1 full stack. */
	strength: number;
	stack: Modifier[];
};

/** A named snapshot of a stack. */
export type Look = {
	id: string;
	name: string;
	note: string;
	strength: number;
	stack: Modifier[];
};

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;
