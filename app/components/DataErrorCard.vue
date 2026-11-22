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
	<div
		role="alert"
		class="flex flex-col items-start justify-between gap-4 rounded-tile border border-down/30 bg-surface-1 p-5 sm:flex-row sm:items-center"
	>
		<div class="flex min-w-0 items-start gap-3">
			<span
				class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-down/30 bg-down-tint text-down"
			>
				<UIcon
					name="i-heroicons-exclamation-triangle"
					class="size-4"
					aria-hidden="true"
				/>
			</span>
			<div class="min-w-0">
				<h3 class="tile-title text-foreground">{{ title }}</h3>
				<p class="mt-0.5 text-body-sm text-muted-foreground">
					{{ message }}
				</p>
			</div>
		</div>

		<button
			v-if="showRetry"
			type="button"
			class="console-btn console-btn-outline shrink-0"
			:disabled="retrying"
			@click="emit('retry')"
		>
			<UIcon
				name="i-heroicons-arrow-path"
				class="size-4 shrink-0"
				:class="retrying && 'animate-spin'"
				aria-hidden="true"
			/>
			<span>{{ retrying ? "Retrying…" : "Retry" }}</span>
		</button>
	</div>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		title?: string;
		message: string;
		retrying?: boolean;
		showRetry?: boolean;
	}>(),
	{
		title: "Unable to load data",
		retrying: false,
		showRetry: true,
	},
);

const emit = defineEmits<(e: "retry") => void>();
</script>
