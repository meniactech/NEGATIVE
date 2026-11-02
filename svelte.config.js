import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Node adapter: the UI is a browser app, but batch/export need the filesystem.
		adapter: adapter({ out: 'build' })
	}
};

export default config;
