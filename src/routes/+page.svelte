<script lang="ts">
	/**
	 * Designer: looks load a modifier stack. Add / reorder / remove effects.
	 * Only stacked modifiers run. Export and batch send the current stack.
	 */
	import { onMount } from 'svelte';
	import BlurGizmo from '$lib/components/BlurGizmo.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import StackMod from '$lib/components/StackMod.svelte';
	import { MODIFIER_INFO, newModifier } from '$lib/modifiers';
	import { defaultSettings, LOOKS, settingsFromLook } from '$lib/presets';
	import type { GradeSettings, Look, Modifier, ModifierType } from '$lib/types';
	import {
		lookFromSettings,
		loadUserLooks,
		persistUserLooks,
		uniqueLookName
	} from '$lib/userLooks';
	import { PREVIEW_HQ, PREVIEW_LIVE, gradePixels, loadImage, presentOn, rasterize, readPixels } from '$lib/preview';

	let file = $state<File | null>(null);
	let livePixels: ImageData | null = null;
	let hqPixels: ImageData | null = null;
	let liveOut: HTMLCanvasElement | null = null;
	let hqOut: HTMLCanvasElement | null = null;
	let frameCanvas: HTMLCanvasElement | null = null;
	let originalCanvas = $state<HTMLCanvasElement | null>(null);
	let previewCanvas = $state<HTMLCanvasElement | null>(null);
	let viewEl = $state<HTMLCanvasElement | null>(null);
	let showOriginal = $state(false);
	let fileOver = $state(false);
	let dragFrom = $state<number | null>(null);
	/** Insertion index while dragging: 0 = before first, stack.length = after last. */
	let dropSlot = $state<number | null>(null);
	/** Which stack cards have their sliders open. Collapse is UI-only. */
	let expanded = $state<Record<string, boolean>>({});
	let busy = $state(false);
	let status = $state('');
	let statusErr = $state(false);
	let selectedId = $state('negative');
	let addType = $state<ModifierType>('grain');
	let userLooks = $state<Look[]>([]);
	let saveName = $state('');
	let renamingId = $state<string | null>(null);
	let renameValue = $state('');
	/** Blur center gizmo: which slider is held down. */
	let scrub = $state<{ id: string; field: string } | null>(null);

	let settings = $state<GradeSettings>(defaultSettings());
	let sourceFolder = $state('');
	let destFolder = $state('');

	const selectedLook = $derived(
		LOOKS.find((l) => l.id === selectedId) || userLooks.find((l) => l.id === selectedId)
	);
	const lookName = $derived(selectedLook?.name ?? 'Custom');
	const selectedIsMine = $derived(userLooks.some((l) => l.id === selectedId));
	const gizmoMod = $derived.by((): Modifier | null => {
		const s = scrub;
		if (!s || (s.field !== 'centerX' && s.field !== 'centerY')) return null;
		const m = settings.stack.find((x) => x.id === s.id);
		if (!m || (m.type !== 'blurRadial' && m.type !== 'blurLinear')) return null;
		void m.centerX;
		void m.centerY;
		void m.radius;
		void m.angle;
		return m;
	});
	const shown = $derived(showOriginal ? originalCanvas : previewCanvas);
	const usedTypes = $derived(new Set(settings.stack.map((m) => m.type)));
	const addable = $derived(MODIFIER_INFO.filter((m) => !usedTypes.has(m.type)));

	async function openFile(next: File) {
		status = '';
		statusErr = false;
		file = next;
		const img = await loadImage(next);
		const live = rasterize(img, PREVIEW_LIVE);
		const hq = rasterize(img, PREVIEW_HQ);
		livePixels = readPixels(live);
		hqPixels = readPixels(hq);
		originalCanvas = hq;
		liveOut = null;
		hqOut = null;
		frameCanvas = null;
		previewCanvas = null;
		showOriginal = false;
	}

	function frameSize(): { w: number; h: number } | null {
		if (hqPixels) return { w: hqPixels.width, h: hqPixels.height };
		if (shown) return { w: shown.width, h: shown.height };
		return null;
	}

	function paintView() {
		if (!viewEl || !shown) return;
		const size = frameSize();
		if (!size) return;
		if (viewEl.width !== size.w) viewEl.width = size.w;
		if (viewEl.height !== size.h) viewEl.height = size.h;
		viewEl.getContext('2d')?.drawImage(shown, 0, 0, size.w, size.h);
	}

	/** Same canvas is reused, so assignment alone may not redraw. */
	function setPreview(canvas: HTMLCanvasElement) {
		const size = frameSize();
		previewCanvas = size ? presentOn(canvas, frameCanvas, size.w, size.h) : canvas;
		frameCanvas = previewCanvas;
		if (showOriginal || !viewEl) return;
		if (viewEl.width !== previewCanvas.width) viewEl.width = previewCanvas.width;
		if (viewEl.height !== previewCanvas.height) viewEl.height = previewCanvas.height;
		viewEl.getContext('2d')?.drawImage(previewCanvas, 0, 0);
	}

	/**
	 * Slider input fires every tick. Grade a small live frame on the next
	 * animation frame; only run the HQ pass after the slider settles.
	 */
	$effect(() => {
		const snap = JSON.parse(JSON.stringify(settings)) as GradeSettings;
		const live = livePixels;
		const hq = hqPixels;
		void originalCanvas;
		if (!live) return;

		let cancelled = false;
		const raf = requestAnimationFrame(() => {
			if (cancelled) return;
			liveOut = gradePixels(live, snap, liveOut);
			setPreview(liveOut);
		});
		const timer = window.setTimeout(() => {
			if (cancelled || !hq) return;
			hqOut = gradePixels(hq, snap, hqOut);
			setPreview(hqOut);
		}, 90);
		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			clearTimeout(timer);
		};
	});

	$effect(() => {
		void shown;
		void viewEl;
		paintView();
	});

	$effect(() => {
		if (addable.length && !addable.some((m) => m.type === addType)) {
			addType = addable[0].type;
		}
	});

	function onDrop(e: DragEvent) {
		e.preventDefault();
		fileOver = false;
		const next = e.dataTransfer?.files?.[0];
		if (next) openFile(next);
	}

	onMount(() => {
		userLooks = loadUserLooks();
	});

	function findLook(id: string): Look | undefined {
		return LOOKS.find((l) => l.id === id) || userLooks.find((l) => l.id === id);
	}

	function pickLook(id: string) {
		const look = findLook(id);
		if (!look) return;
		selectedId = id;
		settings = settingsFromLook(look);
		saveName = look.name;
		renamingId = null;
		expanded = {};
	}

	function saveMine() {
		const mine = userLooks.find((l) => l.id === selectedId);
		const name = saveName.trim() || mine?.name || selectedLook?.name || 'Untitled';
		if (mine) {
			const next = lookFromSettings(name, settings);
			next.id = mine.id;
			userLooks = userLooks.map((l) => (l.id === mine.id ? next : l));
			saveName = next.name;
		} else {
			const look = lookFromSettings(uniqueLookName(userLooks, name), settings);
			userLooks = [...userLooks, look];
			selectedId = look.id;
			saveName = look.name;
		}
		persistUserLooks(userLooks);
		statusErr = false;
		status = 'Look saved.';
	}

	function duplicateLook(id: string) {
		const look = findLook(id);
		if (!look) return;
		const source = id === selectedId ? settings : { strength: look.strength, stack: look.stack };
		const copy = lookFromSettings(uniqueLookName(userLooks, look.name + ' copy'), source);
		userLooks = [...userLooks, copy];
		persistUserLooks(userLooks);
		pickLook(copy.id);
		statusErr = false;
		status = 'Look duplicated.';
	}

	function startRename(id: string) {
		const look = userLooks.find((l) => l.id === id);
		if (!look) return;
		renamingId = id;
		renameValue = look.name;
	}

	function commitRename() {
		const id = renamingId;
		const name = renameValue.trim();
		renamingId = null;
		if (!id || !name) return;
		userLooks = userLooks.map((l) => (l.id === id ? { ...l, name } : l));
		if (selectedId === id) saveName = name;
		persistUserLooks(userLooks);
	}

	function deleteLook(id: string) {
		const look = userLooks.find((l) => l.id === id);
		if (!look) return;
		if (!confirm(`Delete “${look.name}”?`)) return;
		userLooks = userLooks.filter((l) => l.id !== id);
		persistUserLooks(userLooks);
		if (selectedId === id) pickLook('neutral');
		statusErr = false;
		status = 'Look deleted.';
	}

	function addModifier() {
		if (!addable.some((m) => m.type === addType)) return;
		const next = newModifier(addType);
		settings = { ...settings, stack: [...settings.stack, next] };
		expanded = { ...expanded, [next.id]: true };
	}

	function removeAt(i: number) {
		const id = settings.stack[i]?.id;
		settings = { ...settings, stack: settings.stack.filter((_, n) => n !== i) };
		if (id) {
			const next = { ...expanded };
			delete next[id];
			expanded = next;
		}
	}

	function toggleOpen(id: string) {
		expanded = { ...expanded, [id]: !expanded[id] };
	}

	function onModScrub(id: string, field: string | null) {
		scrub = field ? { id, field } : null;
	}

	function onModDragStart(e: DragEvent, index: number) {
		dragFrom = index;
		dropSlot = index;
		e.dataTransfer?.setData('text/plain', String(index));
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}

	function slotFromPoint(root: HTMLElement, clientY: number): number {
		const cards = root.querySelectorAll('.mod');
		for (let i = 0; i < cards.length; i++) {
			const r = cards[i].getBoundingClientRect();
			if (clientY < r.top + r.height / 2) return i;
		}
		return cards.length;
	}

	function onStackDragOver(e: DragEvent) {
		if (dragFrom === null) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dropSlot = slotFromPoint(e.currentTarget as HTMLElement, e.clientY);
	}

	function onStackDragLeave(e: DragEvent) {
		const root = e.currentTarget as HTMLElement;
		const next = e.relatedTarget;
		if (next instanceof Node && root.contains(next)) return;
		dropSlot = null;
	}

	function onStackDrop(e: DragEvent) {
		e.preventDefault();
		const raw = e.dataTransfer?.getData('text/plain');
		const from = raw !== undefined && raw !== '' ? Number(raw) : dragFrom;
		const to = dropSlot ?? slotFromPoint(e.currentTarget as HTMLElement, e.clientY);
		dragFrom = null;
		dropSlot = null;
		if (from === null || from === undefined || Number.isNaN(from) || to === from || to === from + 1) return;
		const stack = settings.stack.slice();
		const [item] = stack.splice(from, 1);
		stack.splice(from < to ? to - 1 : to, 0, item);
		settings = { ...settings, stack };
	}

	function onModDragEnd() {
		dragFrom = null;
		dropSlot = null;
	}

	async function exportThis() {
		if (!file) return;
		busy = true;
		status = 'Exporting…';
		statusErr = false;
		try {
			const body = new FormData();
			body.set('file', file);
			body.set('settings', JSON.stringify(settings));
			const res = await fetch('/api/export', { method: 'POST', body });
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.error || res.statusText);
			}
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `negative-${file.name}`;
			a.click();
			URL.revokeObjectURL(url);
			status = 'Saved.';
		} catch (e) {
			statusErr = true;
			status = e instanceof Error ? e.message : 'Export failed.';
		} finally {
			busy = false;
		}
	}

	async function batchFolder() {
		busy = true;
		status = 'Batch running…';
		statusErr = false;
		try {
			const res = await fetch('/api/batch', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source: sourceFolder,
					dest: destFolder || undefined,
					settings
				})
			});
			const data = await res.json();
			if (!res.ok || !data.ok) throw new Error(data.error || res.statusText);
			status = `Wrote ${data.count} file${data.count === 1 ? '' : 's'} to\n${data.dest}`;
		} catch (e) {
			statusErr = true;
			status = e instanceof Error ? e.message : 'Batch failed.';
		} finally {
			busy = false;
		}
	}
</script>

<main class="workspace">
	<nav class="rail" aria-label="Looks">
		<h2>Looks</h2>
		<p class="tag">Loads a modifier stack.</p>
		{#each LOOKS as item (item.id)}
			<button class="look" class:is-on={item.id === selectedId} type="button" onclick={() => pickLook(item.id)}>
				<strong>{item.name}</strong>
				<em>{item.note}</em>
			</button>
		{/each}

		<h2 class="rail-split">Mine</h2>
		<p class="tag">Saved in this browser.</p>
		<div class="mine-bar">
			<input
				type="text"
				placeholder="Look name"
				aria-label="Look name"
				bind:value={saveName}
			/>
			<button class="btn btn-primary" type="button" onclick={saveMine}>
				{selectedIsMine ? 'Save' : 'Save as'}
			</button>
			<button class="btn" type="button" onclick={() => duplicateLook(selectedId)}>Copy</button>
		</div>
		{#each userLooks as item (item.id)}
			<div class="look-card" class:is-on={item.id === selectedId}>
				{#if renamingId === item.id}
					<input
						class="look-rename"
						type="text"
						aria-label="Rename look"
						bind:value={renameValue}
						onkeydown={(e) => {
							if (e.key === 'Enter') commitRename();
							if (e.key === 'Escape') renamingId = null;
						}}
						onblur={commitRename}
					/>
				{:else}
					<button class="look" class:is-on={item.id === selectedId} type="button" onclick={() => pickLook(item.id)}>
						<strong>{item.name}</strong>
						<em>{item.note}</em>
					</button>
				{/if}
				<div class="look-tools">
					<button class="btn" type="button" onclick={() => startRename(item.id)}>Rename</button>
					<button class="btn" type="button" onclick={() => duplicateLook(item.id)}>Copy</button>
					<button class="btn" type="button" onclick={() => deleteLook(item.id)}>Delete</button>
				</div>
			</div>
		{/each}
		{#if !userLooks.length}
			<p class="tag">Save the current stack to keep it.</p>
		{/if}
	</nav>

	<section class="stage">
		<div class="stage-bar">
			<label class="btn">
				Open photo
				<input
					class="hidden-file"
					type="file"
					accept="image/jpeg,image/png,image/webp"
					onchange={(e) => {
						const next = e.currentTarget.files?.[0];
						if (next) openFile(next);
					}}
				/>
			</label>
			<div class="toggle">
				<button class="btn" class:is-on={!showOriginal} type="button" onclick={() => (showOriginal = false)}>Look</button>
				<button class="btn" class:is-on={showOriginal} type="button" onclick={() => (showOriginal = true)}>Original</button>
			</div>
			<button class="btn btn-primary" type="button" disabled={!file || busy} onclick={exportThis}>Export this photo</button>
			{#if file}
				<span class="tag">{file.name} · {lookName}</span>
			{/if}
		</div>
		<div
			class="stage-view"
			ondragover={(e) => {
				e.preventDefault();
				fileOver = true;
			}}
			ondragleave={() => (fileOver = false)}
			ondrop={onDrop}
			role="region"
			aria-label="Preview"
		>
			{#if shown}
				<div class="stage-frame">
					<canvas bind:this={viewEl}></canvas>
					{#if gizmoMod && originalCanvas}
						<BlurGizmo mod={gizmoMod} width={originalCanvas.width} height={originalCanvas.height} />
					{/if}
				</div>
			{:else}
				<div class="drop" class:is-over={fileOver}>
					Drop a JPEG, PNG or WebP here — or use Open photo.
				</div>
			{/if}
		</div>
	</section>

	<aside class="side">
		<div class="side-block">
			<h2>Mix</h2>
			<Slider id="s-strength" label="Strength" min={0} max={1} bind:value={settings.strength} />
			<h2>Stack</h2>
			<p class="tag">Applied top to bottom. Drag the grip to reorder. Click a name to open.</p>
		</div>
		<div
			class="stack-scroll"
			class:is-reordering={dragFrom !== null}
			role="list"
			aria-label="Modifier stack"
			ondragover={onStackDragOver}
			ondragleave={onStackDragLeave}
			ondrop={onStackDrop}
		>
			{#each settings.stack as _mod, i (_mod.id)}
				<StackMod
					bind:mod={settings.stack[i]}
					index={i}
					open={!!expanded[_mod.id]}
					dragging={dragFrom === i}
					dropBefore={dragFrom !== null && dropSlot === i}
					dropAfter={dragFrom !== null && dropSlot === i + 1 && i === settings.stack.length - 1}
					onToggle={() => toggleOpen(_mod.id)}
					onRemove={() => removeAt(i)}
					onDragStart={(e) => onModDragStart(e, i)}
					onDragEnd={onModDragEnd}
					onScrub={(field) => onModScrub(_mod.id, field)}
				/>
			{/each}
		</div>
		<div class="side-block foot">
			{#if addable.length}
				<div class="add-row">
					<select class="add-select" bind:value={addType} aria-label="Modifier to add">
						{#each addable as m (m.type)}
							<option value={m.type}>{m.name}</option>
						{/each}
					</select>
					<button class="btn" type="button" onclick={addModifier}>Add</button>
				</div>
			{:else}
				<p class="tag">All modifiers are on the stack.</p>
			{/if}

			<h2>Folder batch</h2>
			<p class="tag">Uses this stack. Originals are not overwritten.</p>
			<div class="field">
				<label for="src">Source folder</label>
				<input id="src" type="text" placeholder="/home/you/photos" bind:value={sourceFolder} />
			</div>
			<div class="field">
				<label for="dst">Destination (blank = source/negative)</label>
				<input id="dst" type="text" placeholder="/home/you/photos/negative" bind:value={destFolder} />
			</div>
			<button class="btn btn-primary" type="button" disabled={!sourceFolder || busy} onclick={batchFolder}>
				Apply look to folder
			</button>
			{#if status}
				<p class="status" class:is-err={statusErr}>{status}</p>
			{/if}
		</div>
	</aside>
</main>
