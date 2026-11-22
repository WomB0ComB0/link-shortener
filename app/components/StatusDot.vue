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
	<span
		aria-hidden="true"
		data-status-dot=""
		:data-tone="tone"
		:class="[
			'inline-block size-2 shrink-0 rounded-full',
			toneClass,
			pulse && tone === 'live' && 'motion-safe:animate-live-pulse',
		]"
	/>
</template>

<script setup lang="ts">
import { computed } from "vue";

export type StatusTone = "live" | "ongoing" | "down" | "info" | "idle";

const props = withDefaults(
	defineProps<{
		tone: StatusTone;
		pulse?: boolean;
	}>(),
	{
		pulse: false,
	},
);

const TONE_CLASS: Record<StatusTone, string> = {
	live: "bg-live",
	ongoing: "bg-ongoing",
	down: "bg-down",
	info: "bg-info",
	idle: "bg-faint",
};

const toneClass = computed(() => TONE_CLASS[props.tone]);
</script>
