/** Stable 0..1 hash from a string. Used to vary grain / leak / dust / coffee per file. */
export function hashString(s: string): number {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	}
	return (h >>> 0) / 4294967295;
}

export function mixSeed(seed: number, batchKey?: string): number {
	const base = typeof seed === 'number' && Number.isFinite(seed) ? seed : 0;
	if (!batchKey) return Math.round(base * 1000);
	return Math.round((base + hashString(batchKey)) * 9973);
}
