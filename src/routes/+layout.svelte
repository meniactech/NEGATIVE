<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>NEGATIVE by MENiAC</title>
</svelte:head>

<div class="app">
	<header class="top">
		<div class="brand"><span>NEGATIVE</span> <em class="by">by MENiAC</em></div>
		<div class="tag">Film looks · JPEG / PNG / WebP · local folder batch</div>
	</header>
	{@render children()}
</div>
