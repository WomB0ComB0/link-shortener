/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
