<script lang="ts">
	import { version } from '../../package.json';
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>NEGATIVE by MENiAC</title>
</svelte:head>

<div class="app">
	<header class="top">
		<div class="brand"><span>NEGATIVE</span> <em class="by">by MENiAC</em> <em class="ver">{version}</em></div>
		<div class="tag">Film looks · JPEG / PNG / WebP · local folder batch</div>
	</header>
	{@render children()}
</div>
