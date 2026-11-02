<script lang="ts">
	/**
	 * One labelled range input. `value` is bindable so the parent GradeSettings
	 * object stays the single source of truth.
	 */
	import { onDestroy } from 'svelte';
	let {
		id,
		label,
		value = $bindable(),
		min,
		max,
		step = 0.01,
		onScrubStart,
		onScrubEnd
	}: {
		id: string;
		label: string;
		value: number;
		min: number;
		max: number;
		step?: number;
		onScrubStart?: () => void;
		onScrubEnd?: () => void;
	} = $props();

	const shown = $derived(step >= 1 ? value.toFixed(0) : value.toFixed(2));

	let holding = false;

	function start() {
		if (holding) return;
		holding = true;
		onScrubStart?.();
		window.addEventListener('pointerup', end);
		window.addEventListener('pointercancel', end);
	}

	function end() {
		if (!holding) return;
		holding = false;
		window.removeEventListener('pointerup', end);
		window.removeEventListener('pointercancel', end);
		onScrubEnd?.();
	}

	onDestroy(end);
</script>

<div class="slider">
	<label for={id}>{label} <span>{shown}</span></label>
	<input {id} type="range" {min} {max} {step} bind:value onpointerdown={start} />
</div>
