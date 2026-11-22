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
	<dl
		:aria-label="ariaLabel"
		:aria-busy="loading || undefined"
		class="grid grid-flow-col auto-cols-[minmax(0,1fr)] md:auto-cols-max"
	>
		<template v-if="loading">
			<div
				v-for="n in placeholderCount"
				:key="`ph-${n}`"
				aria-hidden="true"
				data-placeholder=""
				class="flex min-w-0 flex-col gap-1 border-l border-hairline px-3 first:border-l-0 first:pl-0 last:pr-0 md:px-6"
			>
				<dt class="order-2 py-[3px]">
					<SkeletonBox as="span" class="block h-3.5 w-16 rounded-sm" />
				</dt>
				<dd class="order-1">
					<SkeletonBox as="span" class="block h-7 w-10 rounded-sm" />
				</dd>
			</div>
		</template>
		<template v-else>
			<div
				v-for="item in items"
				:key="item.label"
				class="flex min-w-0 flex-col gap-1 border-l border-hairline px-3 first:border-l-0 first:pl-0 last:pr-0 md:px-6"
			>
				<dt class="order-2 figure-unit text-muted-foreground">{{ item.label }}</dt>
				<dd class="order-1 figure-sm text-foreground">
					<template v-if="presentValue(item.value) === null">
						<span aria-hidden="true">—</span>
						<span class="sr-only">unavailable</span>
					</template>
					<template v-else>
						{{ formatValue(item.value!) }}<span v-if="item.unit" class="ml-0.5 figure-unit text-muted-foreground">{{ item.unit }}</span>
					</template>
				</dd>
			</div>
		</template>
	</dl>
</template>

<script setup lang="ts">
export interface StatStripItem {
	readonly label: string;
	readonly value: number | string | null;
	readonly unit?: string;
}

withDefaults(
	defineProps<{
		items: readonly StatStripItem[];
		loading?: boolean;
		placeholderCount?: number;
		ariaLabel?: string;
	}>(),
	{
		loading: false,
		placeholderCount: 3,
		ariaLabel: "At a glance",
	},
);

const formatter = new Intl.NumberFormat("en-US");

function presentValue(
	value: number | string | null | undefined,
): number | string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	return value.trim() === "" ? null : value;
}

function formatValue(value: number | string): string {
	return typeof value === "number" ? formatter.format(value) : value;
}
</script>
