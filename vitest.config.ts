import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		vue({
			features: {
				propsDestructure: true,
				optionsAPI: true,
			},
		}),
		vueJsx(),
	],
	test: {},
});
