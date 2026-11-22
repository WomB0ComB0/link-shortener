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
	<div ref="hazeRef" class="edge-haze" aria-hidden="true">
		<div class="t">
			<i v-for="n in 8" :key="`t-${n}`" class="l" />
			<i class="tn" />
			<i class="cap" />
		</div>
		<div class="b">
			<i v-for="n in 8" :key="`b-${n}`" class="l" />
			<i class="tn" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
	pauseAnimationsUnderEdge,
	type UnderEdgeWatch,
} from "../utils/pause-under-edge";

const props = defineProps<{
	path: string;
}>();

const hazeRef = ref<HTMLDivElement | null>(null);
let watchHandle: UnderEdgeWatch | null = null;
let cleanupFallback: (() => void) | null = null;

function ramp(distance: number, height: number): number {
	if (height <= 0) return distance > 0 ? 1 : 0;
	return Math.min(1, Math.max(0, distance / height));
}

function supportsScrollTimeline(): boolean {
	return (
		typeof CSS !== "undefined" &&
		typeof CSS.supports === "function" &&
		CSS.supports("animation-timeline: scroll()")
	);
}

onMounted(() => {
	const haze = hazeRef.value;
	if (!haze) return;

	watchHandle = pauseAnimationsUnderEdge(haze);

	if (!supportsScrollTimeline()) {
		const top = haze.querySelector<HTMLElement>(".t");
		const bottom = haze.querySelector<HTMLElement>(".b");
		if (top && bottom) {
			let frame = 0;
			const update = () => {
				frame = 0;
				const maxScroll =
					document.documentElement.scrollHeight - window.innerHeight;
				if (maxScroll <= 0) {
					haze.style.setProperty("--edge-haze-top-opacity", "0");
					haze.style.setProperty("--edge-haze-bottom-opacity", "0");
					return;
				}
				const topOpacity = ramp(window.scrollY, top.offsetHeight);
				const bottomOpacity = ramp(
					maxScroll - window.scrollY,
					bottom.offsetHeight,
				);
				haze.style.setProperty("--edge-haze-top-opacity", String(topOpacity));
				haze.style.setProperty(
					"--edge-haze-bottom-opacity",
					String(bottomOpacity),
				);
			};
			const schedule = () => {
				if (frame === 0) frame = requestAnimationFrame(update);
			};

			const resize =
				typeof ResizeObserver === "function"
					? new ResizeObserver(schedule)
					: null;
			resize?.observe(document.body);
			window.addEventListener("scroll", schedule, { passive: true });
			window.addEventListener("resize", schedule);
			update();

			cleanupFallback = () => {
				window.removeEventListener("scroll", schedule);
				window.removeEventListener("resize", schedule);
				resize?.disconnect();
				cancelAnimationFrame(frame);
			};
		}
	}
});

watch(
	() => props.path,
	() => {
		watchHandle?.sweep();
	},
);

onBeforeUnmount(() => {
	watchHandle?.stop();
	watchHandle = null;
	cleanupFallback?.();
	cleanupFallback = null;
});
</script>
