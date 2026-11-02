import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 8084,
		strictPort: true,
		host: '127.0.0.1'
	},
	preview: {
		port: 8084,
		host: '127.0.0.1'
	}
});
