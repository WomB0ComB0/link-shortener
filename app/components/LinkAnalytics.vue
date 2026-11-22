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
	<UModal
		v-model:open="isOpen"
		title="Link Analytics"
		:description="`/${link.shortUrl}`"
		:ui="{
			overlay: 'bg-canvas/75 backdrop-blur-sm',
			content:
				'rounded-tile border border-hairline bg-surface-2 text-foreground shadow-raised divide-y divide-hairline',
			header: 'px-5 py-4',
			body: 'px-5 py-5',
			title: 'tile-title-lg text-foreground',
			description: 'mono-token text-brand-ink mt-1',
		}"
	>
		<template #body>
			<div v-if="loading" aria-busy="true" class="space-y-5">
				<span class="sr-only" role="status">Loading link analytics…</span>
				<!-- Overview Stats Skeleton -->
				<div class="grid grid-cols-2 gap-3" aria-hidden="true">
					<div class="rounded-tile border border-hairline bg-surface-1 p-4">
						<SkeletonBox class="h-3.5 w-20 rounded-sm" />
						<SkeletonBox class="mt-3 h-7 w-14 rounded-sm" />
					</div>
					<div class="rounded-tile border border-hairline bg-surface-1 p-4">
						<SkeletonBox class="h-3.5 w-14 rounded-sm" />
						<SkeletonBox class="mt-3.5 h-6 w-20 rounded-md" />
					</div>
				</div>

				<!-- Link Details Skeleton -->
				<div class="space-y-3 rounded-tile border border-hairline bg-surface-1 p-4" aria-hidden="true">
					<div class="space-y-2">
						<SkeletonBox class="h-3 w-20 rounded-sm" />
						<SkeletonBox class="h-4 w-5/6 rounded-sm" />
					</div>
					<div class="grid grid-cols-2 gap-4 border-t border-hairline pt-3">
						<div class="space-y-1.5">
							<SkeletonBox class="h-3 w-14 rounded-sm" />
							<SkeletonBox class="h-4 w-24 rounded-sm" />
						</div>
						<div class="space-y-1.5">
							<SkeletonBox class="h-3 w-20 rounded-sm" />
							<SkeletonBox class="h-4 w-20 rounded-sm" />
						</div>
					</div>
				</div>

				<!-- Recent Clicks Skeleton -->
				<div class="space-y-2.5" aria-hidden="true">
					<SkeletonBox class="h-3.5 w-24 rounded-sm" />
					<div
						v-for="n in 3"
						:key="`click-sk-${n}`"
						class="space-y-2 rounded-lg border border-hairline bg-surface-1 p-3"
					>
						<div class="flex items-center justify-between gap-2">
							<SkeletonBox class="h-3.5 w-20 rounded-sm" />
							<SkeletonBox class="h-3.5 w-24 rounded-sm" />
						</div>
						<SkeletonBox class="h-3 w-3/4 rounded-sm" />
					</div>
				</div>
			</div>

			<div v-else-if="analytics" class="space-y-5">
				<!-- Overview Stats -->
				<div class="grid grid-cols-2 gap-3">
					<div class="rounded-tile border border-hairline bg-surface-1 p-4">
						<p class="tile-label text-muted-foreground">Total clicks</p>
						<p class="mt-2 figure-md text-foreground">
							{{ formatNumber(analytics.totalClicks ?? 0) }}
						</p>
					</div>
					<div class="rounded-tile border border-hairline bg-surface-1 p-4">
						<p class="tile-label text-muted-foreground">Status</p>
						<div class="mt-3">
							<span
								class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 tile-label"
								:class="
									analytics.isActive
										? 'bg-live-tint text-live'
										: 'bg-down-tint text-down'
								"
							>
								<StatusDot
									:tone="analytics.isActive ? 'live' : 'down'"
									:pulse="analytics.isActive"
								/>
								<span>{{ analytics.isActive ? "Active" : "Inactive" }}</span>
							</span>
						</div>
					</div>
				</div>

				<!-- Link Details -->
				<div class="space-y-3 rounded-tile border border-hairline bg-surface-1 p-4">
					<div>
						<div class="tile-label text-faint">Original URL</div>
						<a
							:href="analytics.originalUrl"
							target="_blank"
							rel="noopener noreferrer"
							class="mt-1 block truncate tile-sub text-brand-ink hover:underline"
						>
							{{ analytics.originalUrl }}
						</a>
					</div>

					<div class="grid grid-cols-2 gap-4 border-t border-hairline pt-3">
						<div>
							<div class="tile-label text-faint">Created</div>
							<div class="mt-1 tile-meta text-foreground">
								{{ formatDate(analytics.createdAt) }}
							</div>
						</div>
						<div v-if="analytics.expiresAt">
							<div class="tile-label text-faint">Expires</div>
							<div class="mt-1 tile-meta text-foreground">
								{{ formatDate(analytics.expiresAt) }}
							</div>
						</div>
						<div v-if="analytics.customAlias">
							<div class="tile-label text-faint">Custom alias</div>
							<div class="mt-1 mono-token text-brand-ink">
								{{ analytics.customAlias }}
							</div>
						</div>
					</div>
				</div>

				<!-- Recent Clicks -->
				<div v-if="analytics.clicks && analytics.clicks.length > 0">
					<h4 class="tile-label mb-2.5 text-muted-foreground">Recent clicks</h4>
					<div class="max-h-64 space-y-2 overflow-y-auto pr-1">
						<div
							v-for="click in analytics.clicks"
							:key="click.id"
							class="rounded-lg border border-hairline bg-surface-1 p-3 tile-meta"
						>
							<div class="mb-1.5 flex items-center justify-between gap-2">
								<span class="font-medium text-foreground">
									{{ formatClickDate(click.timestamp) }}
								</span>
								<span
									v-if="click.country"
									class="inline-flex items-center gap-1 text-muted-foreground"
								>
									<UIcon name="i-heroicons-map-pin" class="size-3.5" aria-hidden="true" />
									<span>{{ click.country }}{{ click.city ? `, ${click.city}` : "" }}</span>
								</span>
							</div>

							<div v-if="click.referrer" class="truncate text-muted-foreground">
								<span class="text-faint">Referrer:</span> {{ click.referrer }}
							</div>

							<div v-if="click.userAgent" class="truncate text-muted-foreground">
								<span class="text-faint">Agent:</span> {{ click.userAgent }}
							</div>
						</div>
					</div>
				</div>

				<div
					v-else
					class="rounded-tile border border-hairline bg-surface-1 py-8 text-center"
				>
					<UIcon
						name="i-heroicons-cursor-arrow-rays-slash"
						class="mx-auto mb-2 size-8 text-faint"
						aria-hidden="true"
					/>
					<p class="tile-sub text-muted-foreground">No clicks recorded yet</p>
				</div>
			</div>

			<DataErrorCard
				v-else-if="error"
				title="Failed to load analytics"
				:message="error"
				:retrying="loading"
				@retry="fetchAnalytics"
			/>
		</template>
	</UModal>
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import { useFetcher } from "../composables";

const props = defineProps<{
	link: {
		id: string;
		shortUrl: string;
	};
	modelValue: boolean;
}>();

const emit = defineEmits<(e: "update:modelValue", value: boolean) => void>();

const { get: fetchGet } = useFetcher();
const isOpen = ref(props.modelValue);
const loading = ref(false);
const error = ref("");
const analytics = ref<any>(null);
const numberFormatter = new Intl.NumberFormat("en-US");

watch(
	() => props.modelValue,
	(newValue) => {
		isOpen.value = newValue;
		if (newValue) {
			fetchAnalytics();
		}
	},
	{ immediate: true },
);

watch(isOpen, (newValue) => {
	emit("update:modelValue", newValue);
});

async function fetchAnalytics() {
	loading.value = true;
	error.value = "";
	analytics.value = null;

	try {
		const data = await fetchGet(
			"/api/links/analytics",
			{
				retries: 2,
				timeout: 10000,
			},
			{
				shortLinkId: props.link.id,
			},
		);

		analytics.value = data;
	} catch (err: any) {
		error.value = err.message || "Failed to fetch analytics";
	} finally {
		loading.value = false;
	}
}

function formatNumber(value: number): string {
	return numberFormatter.format(value);
}

function formatDate(date: string | Date): string {
	const d = new Date(date);
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatClickDate(date: string | Date): string {
	const d = new Date(date);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}
</script>
