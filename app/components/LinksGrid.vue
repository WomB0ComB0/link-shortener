<!--
 Copyright 2025 Mike Odnis

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
		:aria-busy="loading || undefined"
		class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4"
	>
		<span v-if="loading" class="sr-only" role="status">Loading links…</span>
		<template v-if="loading">
			<div
				v-for="n in skeletonCount"
				:key="`skeleton-${n}`"
				aria-hidden="true"
				data-placeholder=""
				class="flex flex-col gap-3 rounded-tile border border-hairline bg-surface-1 p-4 md:p-5"
			>
				<!-- Mirrors LinkCard row 1: icon + short code + copy button -->
				<div class="flex items-start justify-between gap-2">
					<div class="flex min-w-0 flex-1 items-center gap-2">
						<SkeletonBox class="size-7 shrink-0 rounded-md" />
						<SkeletonBox class="h-6 w-28 rounded-md" />
					</div>
					<SkeletonBox class="h-7 w-16 shrink-0 rounded-md" />
				</div>
				<!-- Mirrors LinkCard row 2: external icon + destination URL -->
				<div class="flex items-center gap-2">
					<SkeletonBox class="size-3.5 shrink-0 rounded-sm" />
					<SkeletonBox class="h-4 w-4/5 rounded-sm" />
				</div>
				<!-- Mirrors LinkCard row 3: hairline footer with date + clicks -->
				<div class="mt-auto flex items-center justify-between gap-2 border-t border-hairline pt-3">
					<SkeletonBox class="h-3.5 w-20 rounded-sm" />
					<SkeletonBox class="h-3.5 w-16 rounded-sm" />
				</div>
			</div>
		</template>

		<template v-else>
			<LinkCard
				v-for="link in links"
				:key="link.id"
				:link="link"
				:show-analytics="showAnalytics"
				@view-analytics="handleViewAnalytics"
			/>
		</template>

		<LinkAnalytics
			v-if="selectedLink"
			v-model="showAnalyticsModal"
			:link="selectedLink"
		/>
	</div>
</template>

<script lang="ts" setup>
import { ref } from "vue";

withDefaults(
	defineProps<{
		links: Array<{
			id: string;
			shortUrl: string;
			originalUrl: string;
			customAlias?: string | null;
			createdAt: string | Date;
			totalClicks?: number;
		}>;
		showAnalytics?: boolean;
		loading?: boolean;
		skeletonCount?: number;
	}>(),
	{
		showAnalytics: false,
		loading: false,
		skeletonCount: 6,
	},
);

const showAnalyticsModal = ref(false);
const selectedLink = ref<{ id: string; shortUrl: string } | null>(null);

function handleViewAnalytics(link: { id: string; shortUrl: string }) {
	selectedLink.value = link;
	showAnalyticsModal.value = true;
}
</script>
