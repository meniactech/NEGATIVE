<script lang="ts">
	/**
	 * Designer: looks load a modifier stack. Add / reorder / remove effects.
	 * Only stacked modifiers run. Export and batch send the current stack.
	 */
	import { onMount, untrack } from 'svelte';
	import BlurGizmo from '$lib/components/BlurGizmo.svelte';
	import Slider from '$lib/components/Slider.svelte';
	import StackMod from '$lib/components/StackMod.svelte';
	import { MODIFIER_INFO, newModifier } from '$lib/modifiers';
	import { defaultSettings, LOOKS, settingsFromLook } from '$lib/presets';
	import type { GradeSettings, Look, Modifier, ModifierType } from '$lib/types';
	import {
		lookFromSettings,
		loadUserLooks,
		looksFromJson,
		looksToJson,
		newLookId,
		persistUserLooks,
		uniqueLookName
	} from '$lib/userLooks';
	import { PREVIEW_HQ, PREVIEW_LIVE, gradePixels, loadImage, presentOn, presentSplit, rasterize, readPixels } from '$lib/preview';

	let file = $state<File | null>(null);
	let livePixels: ImageData | null = null;
	let hqPixels: ImageData | null = null;
	let liveOut: HTMLCanvasElement | null = null;
	let hqOut: HTMLCanvasElement | null = null;
	let compareLiveOut: HTMLCanvasElement | null = null;
	let compareHqOut: HTMLCanvasElement | null = null;
	let frameCanvas: HTMLCanvasElement | null = null;
	let originalCanvas = $state<HTMLCanvasElement | null>(null);
	let previewCanvas = $state<HTMLCanvasElement | null>(null);
	let viewEl = $state<HTMLCanvasElement | null>(null);
	let stageViewEl = $state<HTMLElement | null>(null);
	let showOriginal = $state(false);
	let holdOriginal = $state(false);
	let compareId = $state('');
	let compareSplit = $state(0.5);
	let gradeGen = $state(0);
	/** 1 = whole photo fits in the stage. */
	let viewZoom = $state(1);
	let viewPanX = $state(0);
	let viewPanY = $state(0);
	let viewBox = $state({ w: 0, h: 0 });
	let panning = $state(false);
	let panActive = false;
	let panLast: { x: number; y: number } | null = null;
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
		if (!m || (m.type !== 'blurRadial' && m.type !== 'blurLinear' && m.type !== 'leak' && m.type !== 'coffee')) {
			return null;
		}
		void m.centerX;
		void m.centerY;
		void m.radius;
		void m.angle;
		return m;
	});
	const shown = $derived(showOriginal || holdOriginal ? originalCanvas : previewCanvas);
	const compareLooks = $derived([...LOOKS, ...userLooks]);
	const usedTypes = $derived(new Set(settings.stack.map((m) => m.type)));
	const addable = $derived(MODIFIER_INFO.filter((m) => !usedTypes.has(m.type)));
	const imgW = $derived(originalCanvas?.width || shown?.width || 0);
	const imgH = $derived(originalCanvas?.height || shown?.height || 0);
	const fitScale = $derived.by(() => {
		if (!imgW || !imgH || !viewBox.w || !viewBox.h) return 1;
		const pad = 32;
		return Math.min((viewBox.w - pad) / imgW, (viewBox.h - pad) / imgH);
	});
	const viewScale = $derived(fitScale * viewZoom);
	const zoomLabel = $derived(`${Math.round(viewZoom * 100)}%`);

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
		compareLiveOut = null;
		compareHqOut = null;
		frameCanvas = null;
		previewCanvas = null;
		showOriginal = false;
		holdOriginal = false;
		resetView();
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
	function setPreview(canvas: HTMLCanvasElement, other: HTMLCanvasElement | null = null) {
		const size = frameSize();
		if (!size) {
			previewCanvas = canvas;
			return;
		}
		previewCanvas =
			compareId && other
				? presentSplit(canvas, other, frameCanvas, size.w, size.h, compareSplit)
				: presentOn(canvas, frameCanvas, size.w, size.h);
		frameCanvas = previewCanvas;
		if (showOriginal || holdOriginal || !viewEl) return;
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
		const otherId = compareId;
		void originalCanvas;
		if (!live) return;
		const otherLook = otherId ? findLook(otherId) : undefined;
		const otherSnap = otherLook ? settingsFromLook(otherLook) : null;

		let cancelled = false;
		const raf = requestAnimationFrame(() => {
			if (cancelled) return;
			liveOut = gradePixels(live, snap, liveOut);
			compareLiveOut = otherSnap ? gradePixels(live, otherSnap, compareLiveOut) : null;
			gradeGen += 1;
		});
		const timer = window.setTimeout(() => {
			if (cancelled || !hq) return;
			hqOut = gradePixels(hq, snap, hqOut);
			compareHqOut = otherSnap ? gradePixels(hq, otherSnap, compareHqOut) : null;
			gradeGen += 1;
		}, 90);
		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			clearTimeout(timer);
		};
	});

	$effect(() => {
		void gradeGen;
		void compareSplit;
		const current = hqOut || liveOut;
		if (!current) return;
		const other = compareId ? compareHqOut || compareLiveOut : null;
		setPreview(current, other);
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

	$effect(() => {
		const el = stageViewEl;
		if (!el) return;
		const measure = () => {
			viewBox = { w: el.clientWidth, h: el.clientHeight };
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		const onWheel = (e: WheelEvent) => {
			if (!viewEl) return;
			e.preventDefault();
			const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
			zoomAt(e.clientX, e.clientY, viewZoom * factor);
		};
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => {
			ro.disconnect();
			el.removeEventListener('wheel', onWheel);
		};
	});

	$effect(() => {
		void viewBox.w;
		void viewBox.h;
		void viewZoom;
		const cur = untrack(() => ({ x: viewPanX, y: viewPanY }));
		const c = clampPan(cur.x, cur.y, viewZoom);
		if (c.x !== cur.x || c.y !== cur.y) {
			viewPanX = c.x;
			viewPanY = c.y;
		}
	});

	const ZOOM_MIN = 0.25;
	const ZOOM_MAX = 8;

	function clampPan(x: number, y: number, zoom: number): { x: number; y: number } {
		if (!imgW || !imgH || !viewBox.w) return { x: 0, y: 0 };
		const s = Math.min((viewBox.w - 32) / imgW, (viewBox.h - 32) / imgH) * zoom;
		const maxX = Math.max(0, (imgW * s - viewBox.w) / 2 + 16);
		const maxY = Math.max(0, (imgH * s - viewBox.h) / 2 + 16);
		return {
			x: Math.min(maxX, Math.max(-maxX, x)),
			y: Math.min(maxY, Math.max(-maxY, y))
		};
	}

	function resetView() {
		viewZoom = 1;
		viewPanX = 0;
		viewPanY = 0;
	}

	function zoomAt(clientX: number, clientY: number, nextZoom: number) {
		const el = stageViewEl;
		if (!el) return;
		const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
		const rect = el.getBoundingClientRect();
		const mx = clientX - rect.left - rect.width / 2;
		const my = clientY - rect.top - rect.height / 2;
		const k = next / viewZoom;
		const clamped = clampPan(mx - (mx - viewPanX) * k, my - (my - viewPanY) * k, next);
		viewZoom = next;
		viewPanX = clamped.x;
		viewPanY = clamped.y;
	}

	function nudgeZoom(factor: number) {
		const el = stageViewEl;
		if (!el) return;
		const r = el.getBoundingClientRect();
		zoomAt(r.left + r.width / 2, r.top + r.height / 2, viewZoom * factor);
	}

	function onFramePointerDown(e: PointerEvent) {
		if (e.button !== 0 || viewZoom <= 1.001) return;
		e.preventDefault();
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			/* synthetic events may not support capture */
		}
		panActive = true;
		panning = true;
		panLast = { x: e.clientX, y: e.clientY };
	}

	function onFramePointerMove(e: PointerEvent) {
		if (!panActive || !panLast) return;
		const next = clampPan(viewPanX + e.clientX - panLast.x, viewPanY + e.clientY - panLast.y, viewZoom);
		viewPanX = next.x;
		viewPanY = next.y;
		panLast = { x: e.clientX, y: e.clientY };
	}

	function onFramePointerUp() {
		panActive = false;
		panning = false;
		panLast = null;
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		fileOver = false;
		const next = e.dataTransfer?.files?.[0];
		if (next) openFile(next);
	}

	onMount(() => {
		userLooks = loadUserLooks();
		const down = (e: KeyboardEvent) => {
			if (e.code !== 'Space' || e.repeat) return;
			const t = e.target as HTMLElement | null;
			if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) {
				return;
			}
			e.preventDefault();
			holdOriginal = true;
		};
		const up = (e: KeyboardEvent) => {
			if (e.code === 'Space') holdOriginal = false;
		};
		window.addEventListener('keydown', down);
		window.addEventListener('keyup', up);
		return () => {
			window.removeEventListener('keydown', down);
			window.removeEventListener('keyup', up);
		};
	});

	function setHoldOriginal(on: boolean, e?: PointerEvent) {
		holdOriginal = on;
		if (!on || !e) return;
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			/* synthetic events may not support capture */
		}
	}

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

	function exportMine() {
		if (!userLooks.length) return;
		const blob = new Blob([looksToJson(userLooks)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'negative-looks.json';
		a.click();
		URL.revokeObjectURL(url);
		statusErr = false;
		status = 'Looks exported.';
	}

	async function importMine(next: File) {
		try {
			const incoming = looksFromJson(await next.text());
			const merged = userLooks.slice();
			for (const look of incoming) {
				merged.push({
					...look,
					id: newLookId(),
					name: uniqueLookName(merged, look.name)
				});
			}
			userLooks = merged;
			persistUserLooks(userLooks);
			statusErr = false;
			status = `Imported ${incoming.length} look${incoming.length === 1 ? '' : 's'}.`;
		} catch (e) {
			statusErr = true;
			status = e instanceof Error ? e.message : 'Import failed.';
		}
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
		{#each LOOKS as item (item.id)}
			<button
				class="look"
				class:is-on={item.id === selectedId}
				type="button"
				title={item.note}
				onclick={() => pickLook(item.id)}
			>
				<strong>{item.name}</strong>
			</button>
		{/each}

		<h2 class="rail-split">Mine</h2>
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
			<button class="btn" type="button" disabled={!userLooks.length} onclick={exportMine}>Export</button>
			<label class="btn">
				Import
				<input
					class="hidden-file"
					type="file"
					accept="application/json,.json"
					onchange={(e) => {
						const next = e.currentTarget.files?.[0];
						e.currentTarget.value = '';
						if (next) importMine(next);
					}}
				/>
			</label>
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
					<button
						class="look"
						class:is-on={item.id === selectedId}
						type="button"
						title={item.note}
						onclick={() => pickLook(item.id)}
					>
						<strong>{item.name}</strong>
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
				<button class="btn" class:is-on={!showOriginal && !holdOriginal} type="button" onclick={() => (showOriginal = false)}>Look</button>
				<button
					class="btn"
					class:is-on={showOriginal || holdOriginal}
					type="button"
					title="Hold or press Space to peek"
					onpointerdown={(e) => {
						if (e.button === 0) setHoldOriginal(true, e);
					}}
					onpointerup={() => setHoldOriginal(false)}
					onpointercancel={() => setHoldOriginal(false)}
					onclick={() => (showOriginal = true)}
				>Original</button>
			</div>
			<div class="compare-bar">
				<select class="add-select" bind:value={compareId} aria-label="Compare look">
					<option value="">Compare</option>
					{#each compareLooks as item (item.id)}
						<option value={item.id}>{item.name}</option>
					{/each}
				</select>
				{#if compareId}
					<label class="compare-split">
						Split
						<input type="range" min="0" max="1" step="0.01" bind:value={compareSplit} />
					</label>
					<button class="btn" type="button" onclick={() => (compareId = '')}>Exit Compare</button>
				{/if}
			</div>
			<button class="btn btn-primary" type="button" disabled={!file || busy} onclick={exportThis}>Export this photo</button>
			{#if file}
				<span class="tag">{file.name} · {lookName}</span>
			{/if}
			{#if shown}
				<div class="zoom-bar" role="group" aria-label="Preview zoom">
					<button class="btn" type="button" disabled={viewZoom <= 0.25} onclick={() => nudgeZoom(1 / 1.25)} aria-label="Zoom out">−</button>
					<button class="btn zoom-readout" type="button" onclick={resetView} title="Fit photo in view">{zoomLabel}</button>
					<button class="btn" type="button" disabled={viewZoom >= 8} onclick={() => nudgeZoom(1.25)} aria-label="Zoom in">+</button>
				</div>
			{/if}
		</div>
		<div
			class="stage-view"
			class:is-zoomed={viewZoom > 1.001}
			class:is-panning={panning}
			bind:this={stageViewEl}
			ondragover={(e) => {
				e.preventDefault();
				fileOver = true;
			}}
			ondragleave={() => (fileOver = false)}
			ondrop={onDrop}
			onpointerdown={onFramePointerDown}
			onpointermove={onFramePointerMove}
			onpointerup={onFramePointerUp}
			onpointercancel={onFramePointerUp}
			ondblclick={resetView}
			role="region"
			aria-label="Preview"
		>
			{#if shown && imgW && imgH}
				<div
					class="stage-frame"
					style="width:{imgW}px;height:{imgH}px;margin-left:{-imgW / 2}px;margin-top:{-imgH / 2}px;transform:translate({viewPanX}px,{viewPanY}px) scale({viewScale})"
				>
					<canvas bind:this={viewEl} draggable="false"></canvas>
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
			<h2>Modifiers</h2>
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
				<p class="tag">All modifiers are on.</p>
			{/if}
		</div>
		<div
			class="stack-scroll"
			class:is-reordering={dragFrom !== null}
			role="list"
			aria-label="Modifiers"
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
