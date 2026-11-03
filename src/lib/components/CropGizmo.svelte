<script lang="ts">
	/**
	 * Freely sizeable crop rectangle on the photo. Stays inside the frame.
	 * Pointer work stays here so the stage can still pan when zoomed.
	 */
	import { onDestroy } from 'svelte';
	import { CROP_MIN, cropRect, normalizeRect, writeCropRect, type CropRect } from '$lib/crop';
	import type { Modifier } from '$lib/types';

	type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

	let { mod, scale = 1 }: { mod: Modifier; scale?: number } = $props();

	const rect = $derived.by(() => {
		void mod.centerX;
		void mod.centerY;
		void mod.radius;
		void mod.softness;
		return cropRect(mod);
	});

	let root = $state<HTMLElement | null>(null);
	let drag = $state<{ handle: Handle; x: number; y: number; start: CropRect } | null>(null);

	onDestroy(end);

	function begin(e: PointerEvent, handle: Handle) {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		drag = { handle, x: e.clientX, y: e.clientY, start: { ...cropRect(mod) } };
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', end);
		window.addEventListener('pointercancel', end);
	}

	function move(e: PointerEvent) {
		const job = drag;
		if (!job || !root) return;
		e.preventDefault();
		const box = root.getBoundingClientRect();
		if (box.width < 1 || box.height < 1) return;
		const dx = (e.clientX - job.x) / box.width;
		const dy = (e.clientY - job.y) / box.height;
		writeCropRect(mod, resize(job.start, job.handle, dx, dy));
	}

	function end() {
		if (!drag) return;
		drag = null;
		window.removeEventListener('pointermove', move);
		window.removeEventListener('pointerup', end);
		window.removeEventListener('pointercancel', end);
	}

	function resize(start: CropRect, handle: Handle, dx: number, dy: number): CropRect {
		let { x, y, w, h } = start;
		const right = x + w;
		const bottom = y + h;
		if (handle === 'move') {
			return normalizeRect({ x: x + dx, y: y + dy, w, h });
		}
		if (handle.includes('w')) {
			const next = Math.min(right - CROP_MIN, Math.max(0, x + dx));
			w = right - next;
			x = next;
		}
		if (handle.includes('e')) {
			w = Math.min(1 - x, Math.max(CROP_MIN, w + dx));
		}
		if (handle.includes('n')) {
			const next = Math.min(bottom - CROP_MIN, Math.max(0, y + dy));
			h = bottom - next;
			y = next;
		}
		if (handle.includes('s')) {
			h = Math.min(1 - y, Math.max(CROP_MIN, h + dy));
		}
		return normalizeRect({ x, y, w, h });
	}
</script>

<div
	class="crop-gizmo"
	class:is-drag={!!drag}
	style="--view-scale:{Math.max(0.15, scale)}"
	bind:this={root}
	role="presentation"
>
	<div
		class="crop-box"
		style="left:{rect.x * 100}%;top:{rect.y * 100}%;width:{rect.w * 100}%;height:{rect.h * 100}%"
		onpointerdown={(e) => begin(e, 'move')}
		role="presentation"
	>
		<button class="crop-handle nw" type="button" aria-label="Resize crop northwest" onpointerdown={(e) => begin(e, 'nw')}></button>
		<button class="crop-handle n" type="button" aria-label="Resize crop north" onpointerdown={(e) => begin(e, 'n')}></button>
		<button class="crop-handle ne" type="button" aria-label="Resize crop northeast" onpointerdown={(e) => begin(e, 'ne')}></button>
		<button class="crop-handle e" type="button" aria-label="Resize crop east" onpointerdown={(e) => begin(e, 'e')}></button>
		<button class="crop-handle se" type="button" aria-label="Resize crop southeast" onpointerdown={(e) => begin(e, 'se')}></button>
		<button class="crop-handle s" type="button" aria-label="Resize crop south" onpointerdown={(e) => begin(e, 's')}></button>
		<button class="crop-handle sw" type="button" aria-label="Resize crop southwest" onpointerdown={(e) => begin(e, 'sw')}></button>
		<button class="crop-handle w" type="button" aria-label="Resize crop west" onpointerdown={(e) => begin(e, 'w')}></button>
	</div>
</div>
