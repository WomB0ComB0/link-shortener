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
	<div :class="['flex flex-col gap-5 md:gap-6', gutter && 'px-(--page-gutter)']">
		<header
			class="grid gap-4 border-b border-hairline pb-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-6 md:pb-5"
		>
			<div class="min-w-0 space-y-2">
				<p v-if="eyebrow" class="tile-label text-muted-foreground">
					{{ eyebrow }}
				</p>
				<h1 class="page-title text-foreground">
					{{ title }}
				</h1>
				<p v-if="description" class="max-w-[60ch] text-body text-muted-foreground">
					{{ description }}
				</p>
			</div>

			<div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
				<slot name="actions" />
			</div>

			<div
				v-if="$slots.stats"
				:class="['min-w-0', $slots.actions && 'md:col-span-2']"
			>
				<slot name="stats" />
			</div>
		</header>

		<slot />
	</div>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		title: string;
		eyebrow?: string;
		description?: string;
		gutter?: boolean;
	}>(),
	{
		gutter: true,
	},
);
</script>
