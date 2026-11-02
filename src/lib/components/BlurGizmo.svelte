<script lang="ts">
	/**
	 * Overlay on the preview while a blur Center/Shift slider is dragged.
	 * Geometry matches `blur.ts` (radial disc / linear band through the centre).
	 */
	import type { Modifier } from '$lib/types';

	let { mod, width, height }: { mod: Modifier; width: number; height: number } = $props();

	const w = $derived(Math.max(1, width));
	const h = $derived(Math.max(1, height));
	const cx = $derived(mod.centerX * (w - 1));
	const cy = $derived(mod.centerY * (h - 1));
	const minSide = $derived(Math.min(w, h));
	const arm = $derived(Math.max(10, minSide * 0.04));
	const mark = $derived(Math.max(5, minSide * 0.01));
	const inner = $derived(
		Math.max(0, mod.radius * minSide * (mod.type === 'blurLinear' ? 0.5 : 1))
	);
	const theta = $derived(((mod.angle % 180) * Math.PI) / 180);
	const nx = $derived(Math.sin(theta));
	const ny = $derived(Math.cos(theta));
	const span = $derived(Math.hypot(w, h));
	const bx = $derived(-ny * span);
	const by = $derived(nx * span);
</script>

<svg class="blur-gizmo" viewBox="0 0 {w} {h}" preserveAspectRatio="none" aria-hidden="true">
	<g class="gizmo-shadow">
		<line x1={cx - arm} y1={cy} x2={cx + arm} y2={cy} />
		<line x1={cx} y1={cy - arm} x2={cx} y2={cy + arm} />
		<circle class="gizmo-dot" cx={cx} cy={cy} r={mark} />
		{#if mod.type === 'blurRadial'}
			<circle {cx} {cy} r={Math.max(mark * 1.2, inner)} />
		{:else}
			<line x1={cx - bx} y1={cy - by} x2={cx + bx} y2={cy + by} />
		{/if}
	</g>
	<g class="gizmo-stroke">
		<line x1={cx - arm} y1={cy} x2={cx + arm} y2={cy} />
		<line x1={cx} y1={cy - arm} x2={cx} y2={cy + arm} />
		<circle class="gizmo-dot" cx={cx} cy={cy} r={mark} />
		{#if mod.type === 'blurRadial'}
			<circle {cx} {cy} r={Math.max(mark * 1.2, inner)} />
		{:else}
			<line x1={cx - bx} y1={cy - by} x2={cx + bx} y2={cy + by} />
		{/if}
	</g>
</svg>
