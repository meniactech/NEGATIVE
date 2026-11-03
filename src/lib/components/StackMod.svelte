<script lang="ts">
	/**
	 * One row in the modifier stack. Collapsed by default: header only.
	 * Drag the grip to reorder. Click the name to open sliders.
	 */
	import Slider from './Slider.svelte';
	import { infoFor } from '$lib/modifiers';
	import type { Modifier } from '$lib/types';

	let {
		mod = $bindable(),
		index,
		open,
		dragging,
		dropBefore,
		dropAfter,
		onToggle,
		onRemove,
		onDragStart,
		onDragEnd,
		onScrub
	}: {
		mod: Modifier;
		index: number;
		open: boolean;
		dragging: boolean;
		dropBefore: boolean;
		dropAfter: boolean;
		onToggle: () => void;
		onRemove: () => void;
		onDragStart: (e: DragEvent) => void;
		onDragEnd: () => void;
		onScrub?: (field: string | null) => void;
	} = $props();

	const info = $derived(infoFor(mod.type));
</script>

<article
	class="mod"
	class:is-off={!mod.enabled}
	class:is-open={open}
	class:is-dragging={dragging}
	class:is-drop-before={dropBefore}
	class:is-drop-after={dropAfter}
	ondragend={onDragEnd}
>
	<header class="mod-bar">
		<span
			class="mod-grip"
			role="button"
			tabindex="0"
			draggable="true"
			title="Drag to reorder"
			aria-label="Drag to reorder"
			ondragstart={onDragStart}
		>⋮</span>
		<label class="mod-on">
			<input type="checkbox" bind:checked={mod.enabled} aria-label="Enable {info.name}" />
		</label>
		<button type="button" class="mod-name" onclick={onToggle} aria-expanded={open}>
			<strong>{info.name}</strong>
			<span class="mod-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
		</button>
		<button type="button" class="btn btn-icon" onclick={onRemove} aria-label="Remove">×</button>
	</header>
	{#if open}
		{#if info.styles}
			<div class="mod-style">
				<label for={mod.id + '-style'}>Style</label>
				<select
					id={mod.id + '-style'}
					class="mod-style-select"
					value={String(mod.style)}
					onchange={(e) => {
						const next = Number(e.currentTarget.value);
						mod.style = next;
						if (mod.type !== 'border') return;
						if (next === 2 && mod.tint > 0.45) mod.tint = 0.08;
						else if (next !== 2 && mod.tint < 0.45) mod.tint = next === 1 ? 0.94 : 0.9;
					}}
				>
					{#each info.styles as opt (opt.value)}
						<option value={String(opt.value)}>{opt.label}</option>
					{/each}
				</select>
			</div>
		{/if}
		{#if info.text}
			<div class="mod-style">
				<label for={mod.id + '-label'}>Date</label>
				<input
					id={mod.id + '-label'}
					class="mod-style-select"
					type="text"
					maxlength="14"
					bind:value={mod.label}
					spellcheck="false"
				/>
			</div>
		{/if}
		{#each info.sliders as s (s.field)}
			<Slider
				id={mod.id + '-' + s.field}
				label={s.label}
				min={s.min}
				max={s.max}
				step={s.step ?? 0.01}
				bind:value={mod[s.field]}
				onScrubStart={() => onScrub?.(s.field)}
				onScrubEnd={() => onScrub?.(null)}
			/>
		{/each}
		{#if info.rgb}
			<Slider id={mod.id + '-ssr'} label="Shadow R" min={0} max={1} bind:value={mod.splitShadows[0]} />
			<Slider id={mod.id + '-ssg'} label="Shadow G" min={0} max={1} bind:value={mod.splitShadows[1]} />
			<Slider id={mod.id + '-ssb'} label="Shadow B" min={0} max={1} bind:value={mod.splitShadows[2]} />
			<Slider id={mod.id + '-shr'} label="Highlight R" min={0} max={1} bind:value={mod.splitHighlights[0]} />
			<Slider id={mod.id + '-shg'} label="Highlight G" min={0} max={1} bind:value={mod.splitHighlights[1]} />
			<Slider id={mod.id + '-shb'} label="Highlight B" min={0} max={1} bind:value={mod.splitHighlights[2]} />
		{/if}
	{/if}
</article>
