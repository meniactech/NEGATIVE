/**
 * User looks live in localStorage. Built-in looks in presets.ts are never
 * overwritten. Save / rename / duplicate / delete only touch this list.
 */
import { infoFor, newModifier } from './modifiers';
import type { GradeSettings, Look, Modifier, ModifierType, Rgb } from './types';

const KEY = 'negative.looks.v1';

const TYPES: ModifierType[] = [
	'wb',
	'saturation',
	'contrast',
	'fade',
	'tone',
	'vignette',
	'grain',
	'bw',
	'split',
	'blurRadial',
	'blurLinear'
];

function asRgb(value: unknown, fallback: Rgb): Rgb {
	if (!Array.isArray(value) || value.length < 3) return [...fallback] as Rgb;
	return [
		clampNum(value[0], fallback[0]),
		clampNum(value[1], fallback[1]),
		clampNum(value[2], fallback[2])
	];
}

function clampNum(n: unknown, fallback: number): number {
	return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function sanitizeMod(raw: unknown): Modifier | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const type = o.type as ModifierType;
	if (!TYPES.includes(type)) return null;
	const base = newModifier(type);
	return {
		...base,
		id: typeof o.id === 'string' && o.id ? o.id : base.id,
		enabled: o.enabled !== false,
		amount: clampNum(o.amount, base.amount),
		tint: clampNum(o.tint, base.tint),
		shadows: clampNum(o.shadows, base.shadows),
		highlights: clampNum(o.highlights, base.highlights),
		splitShadows: asRgb(o.splitShadows, base.splitShadows),
		splitHighlights: asRgb(o.splitHighlights, base.splitHighlights),
		centerX: clampNum(o.centerX, base.centerX),
		centerY: clampNum(o.centerY, base.centerY),
		radius: clampNum(o.radius, base.radius),
		softness: clampNum(o.softness, base.softness),
		angle: clampNum(o.angle, base.angle),
		invert: clampNum(o.invert, base.invert)
	};
}

function sanitizeLook(raw: unknown): Look | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	if (typeof o.id !== 'string' || !o.id) return null;
	if (typeof o.name !== 'string' || !o.name.trim()) return null;
	const stackRaw = Array.isArray(o.stack) ? o.stack : [];
	const stack: Modifier[] = [];
	for (const item of stackRaw) {
		const mod = sanitizeMod(item);
		if (mod) stack.push(mod);
	}
	return {
		id: o.id,
		name: o.name.trim(),
		note: typeof o.note === 'string' ? o.note : 'Saved look',
		strength: clampNum(o.strength, 1),
		stack
	};
}

export function loadUserLooks(): Look[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
		const list = Array.isArray(raw) ? raw : raw?.looks;
		if (!Array.isArray(list)) return [];
		const out: Look[] = [];
		for (const item of list) {
			const look = sanitizeLook(item);
			if (look) out.push(look);
		}
		return out;
	} catch {
		return [];
	}
}

export function persistUserLooks(looks: Look[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(KEY, JSON.stringify(looks));
}

export function newLookId(): string {
	return 'mine-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
}

export function uniqueLookName(looks: Look[], base: string): string {
	const names = new Set(looks.map((l) => l.name.toLowerCase()));
	const root = base.trim() || 'Untitled';
	if (!names.has(root.toLowerCase())) return root;
	let n = 2;
	while (names.has(`${root} ${n}`.toLowerCase())) n++;
	return `${root} ${n}`;
}

export function lookFromSettings(name: string, settings: GradeSettings): Look {
	return {
		id: newLookId(),
		name: name.trim() || 'Untitled',
		note: settings.stack.length
			? settings.stack.map((m) => infoFor(m.type).name).join(' · ')
			: 'Empty stack',
		strength: settings.strength,
		stack: settings.stack.map((m) => ({
			...m,
			splitShadows: [...m.splitShadows] as Rgb,
			splitHighlights: [...m.splitHighlights] as Rgb
		}))
	};
}
