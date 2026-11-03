/**
 * Batch and export hit the real filesystem. Only answer requests that come
 * from this machine — NEGATIVE is a local tool, not a public API.
 */
import { error, type RequestEvent } from '@sveltejs/kit';
import { newModifier } from '$lib/modifiers';
import { MODIFIER_TYPES, type GradeSettings, type Modifier, type ModifierType, type Rgb } from '$lib/types';

export function assertLocal(event: RequestEvent): void {
	const addr = event.getClientAddress();
	if (addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1') return;
	error(403, 'NEGATIVE only accepts local requests.');
}

function num(v: unknown, fallback: number): number {
	return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function rgb(v: unknown, fallback: Rgb): Rgb {
	if (!Array.isArray(v) || v.length < 3) return fallback;
	const n = (i: number) => num(v[i], fallback[i]);
	return [n(0), n(1), n(2)];
}

function parseMod(raw: unknown, i: number): Modifier | null {
	if (!raw || typeof raw !== 'object') return null;
	const s = raw as Record<string, unknown>;
	const type = MODIFIER_TYPES.includes(s.type as ModifierType) ? (s.type as ModifierType) : null;
	if (!type) return null;
	const base = newModifier(type);
	return {
		...base,
		id: typeof s.id === 'string' && s.id ? s.id : type + '-' + i,
		enabled: s.enabled !== false,
		amount: num(s.amount, base.amount),
		tint: num(s.tint, base.tint),
		shadows: num(s.shadows, base.shadows),
		highlights: num(s.highlights, base.highlights),
		splitShadows: rgb(s.splitShadows, base.splitShadows),
		splitHighlights: rgb(s.splitHighlights, base.splitHighlights),
		centerX: num(s.centerX, base.centerX),
		centerY: num(s.centerY, base.centerY),
		radius: num(s.radius, base.radius),
		softness: num(s.softness, base.softness),
		angle: num(s.angle, base.angle),
		invert: num(s.invert, base.invert),
		style: num(s.style, base.style),
		seed: num(s.seed, base.seed),
		label: typeof s.label === 'string' ? s.label.slice(0, 24) : base.label
	};
}

/** Slider / stack state from JSON. Missing fields fall back to empty stack. */
export function parseSettings(raw: unknown): GradeSettings {
	if (!raw || typeof raw !== 'object') throw new Error('Missing settings.');
	const s = raw as Record<string, unknown>;
	const stack = Array.isArray(s.stack)
		? s.stack.map(parseMod).filter((m): m is Modifier => m !== null)
		: [];
	return {
		strength: num(s.strength, 1),
		stack
	};
}
