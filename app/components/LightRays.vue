<!--
 Copyright 2026 Mike Odnis

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

<template>
	<div class="light-rays" aria-hidden="true">
		<i
			v-for="ray in LIGHT_RAYS"
			:key="ray.left"
			:style="rayStyle(ray)"
		/>
	</div>
</template>

<script setup lang="ts">
interface LightRay {
	readonly left: number;
	readonly width: number;
	readonly rotate: number;
	readonly swing: number;
	readonly duration: number;
	readonly delay: number;
	readonly peak: number;
}

const LIGHT_RAYS: readonly LightRay[] = [
	{
		left: 90.5,
		width: 221,
		rotate: -7.9,
		swing: 2.5,
		duration: 12,
		delay: 12.2,
		peak: 0.84,
	},
	{
		left: 21.7,
		width: 272,
		rotate: -24,
		swing: 2,
		duration: 17.2,
		delay: 4.7,
		peak: 0.72,
	},
	{
		left: 38.8,
		width: 307,
		rotate: 10.6,
		swing: 1.1,
		duration: 16.5,
		delay: 11.6,
		peak: 0.73,
	},
	{
		left: 53.5,
		width: 271,
		rotate: 16,
		swing: 1.9,
		duration: 15,
		delay: 2.9,
		peak: 0.86,
	},
	{
		left: 20.6,
		width: 258,
		rotate: 12.4,
		swing: 1.9,
		duration: 15.1,
		delay: 1.3,
		peak: 0.81,
	},
];

function rayStyle(ray: LightRay): Record<string, string | number> {
	return {
		"--ray-left": `${ray.left}%`,
		"--ray-width": `${ray.width}px`,
		"--ray-rotate": `${ray.rotate}deg`,
		"--ray-swing": `${ray.swing}deg`,
		"--ray-duration": `${ray.duration}s`,
		"--ray-delay": `${ray.delay}s`,
		"--ray-peak": ray.peak,
	};
}
</script>
