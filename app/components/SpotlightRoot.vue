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
	<span class="hidden" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

interface SpotPosition {
	readonly host: HTMLElement;
	readonly clientX: number;
	readonly clientY: number;
}

let frame: number | null = null;
let latest: SpotPosition | null = null;

function placeSpot({ host, clientX, clientY }: SpotPosition): void {
	const rect = host.getBoundingClientRect();
	host.style.setProperty("--spot-x", `${clientX - rect.left}px`);
	host.style.setProperty("--spot-y", `${clientY - rect.top}px`);
}

function flush(): void {
	frame = null;
	if (latest) placeSpot(latest);
	latest = null;
}

function onPointerMove(event: PointerEvent): void {
	if ((event.pointerType ?? "mouse") !== "mouse") return;
	if (!(event.target instanceof Element)) return;
	const host = event.target.closest("[data-spotlight]");
	if (!(host instanceof HTMLElement)) return;
	latest = { host, clientX: event.clientX, clientY: event.clientY };
	frame ??= requestAnimationFrame(flush);
}

onMounted(() => {
	document.addEventListener("pointermove", onPointerMove, { passive: true });
});

onBeforeUnmount(() => {
	document.removeEventListener("pointermove", onPointerMove);
	if (frame !== null) cancelAnimationFrame(frame);
});
</script>
