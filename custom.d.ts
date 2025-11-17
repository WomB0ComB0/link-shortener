import type { DefineComponent } from "vue";

declare module "*.png" {
	const component: DefineComponent<{}, {}, any>;
	export const VueComponent: DefineComponent<{}, {}, any>;
	const content: string;
	export default content;
}

declare module "*.webp" {
	const component: DefineComponent<{}, {}, any>;
	export const VueComponent: DefineComponent<{}, {}, any>;
	const content: string;
	export default content;
}

declare module "*.jpg" {
	const component: DefineComponent<{}, {}, any>;
	export const VueComponent: DefineComponent<{}, {}, any>;
	const content: string;
	export default content;
}

declare module "*.svg" {
	const component: DefineComponent<{}, {}, any>;
	export const VueComponent: DefineComponent<{}, {}, any>;
	const src: string;
	export default src;
}

declare module "*.mp4" {
	const component: DefineComponent<{}, {}, any>;
	export const VueComponent: DefineComponent<{}, {}, any>;
	const src: string;
	export default src;
}

declare module "*.mp3" {
	const component: DefineComponent<{}, {}, any>;
	export const VueComponent: DefineComponent<{}, {}, any>;
	const src: string;
	export default src;
}

declare module "*.css" {
	const content: { [className: string]: string };
	export default content;
}

declare module "*.scss" {
	const content: { [className: string]: string };
	export default content;
}

declare module "*.sass" {
	const content: { [className: string]: string };
	export default content;
}

declare module "*.json" {
	const content: { [className: string]: string };
	export default content;
}
