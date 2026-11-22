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
	<article
		data-spotlight=""
		class="group/tile spotlight console-tile-lift flex min-w-0 flex-col rounded-tile border border-hairline bg-surface-1 p-4 text-foreground @container md:p-5"
	>
		<div class="flex flex-1 flex-col gap-3">
			<!-- Short URL & actions -->
			<div class="flex items-start justify-between gap-2">
				<div class="flex min-w-0 flex-1 items-center gap-2">
					<span
						class="flex size-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-2 text-brand-ink"
					>
						<UIcon name="i-heroicons-link" class="size-4" aria-hidden="true" />
					</span>
					<code
						class="mono-token truncate rounded-md bg-brand-subtle px-2 py-1 text-brand-ink"
					>
						/{{ link.shortUrl }}
					</code>
				</div>

				<div class="flex shrink-0 items-center gap-1">
					<button
						v-if="showAnalytics"
						type="button"
						class="inline-flex h-7 cursor-pointer items-center justify-center rounded-md px-2 tile-meta text-muted-foreground transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-2 hover:text-foreground"
						aria-label="View link analytics"
						title="View analytics"
						@click="openAnalytics"
					>
						<UIcon name="i-heroicons-chart-bar" class="size-4" aria-hidden="true" />
					</button>
					<button
						type="button"
						class="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-2 tile-meta transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-2"
						:class="copied ? 'text-live' : 'text-muted-foreground hover:text-foreground'"
						@click="copyLink(link.shortUrl)"
					>
						<UIcon
							:name="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
							class="size-3.5 shrink-0"
							aria-hidden="true"
						/>
						<span>{{ copied ? "Copied" : "Copy" }}</span>
					</button>
				</div>
			</div>

			<!-- Original URL -->
			<div class="space-y-1.5">
				<div class="flex min-w-0 items-start gap-2">
					<UIcon
						name="i-heroicons-arrow-top-right-on-square"
						class="mt-0.5 size-3.5 shrink-0 text-faint"
						aria-hidden="true"
					/>
					<a
						:href="link.originalUrl"
						target="_blank"
						rel="noopener noreferrer"
						class="tile-sub min-w-0 flex-1 truncate text-muted-foreground transition-colors duration-(--motion-fast) ease-standard hover:text-brand-ink"
					>
						{{ link.originalUrl }}
					</a>
				</div>
				<LinkHealthBadge :href="link.originalUrl" />
			</div>

			<!-- Metadata -->
			<div
				class="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-3 tile-meta text-faint"
			>
				<div class="flex items-center gap-1.5">
					<UIcon name="i-heroicons-clock" class="size-3.5 shrink-0" aria-hidden="true" />
					<span>{{ formatDate(link.createdAt) }}</span>
				</div>

				<div class="flex items-center gap-2.5">
					<div
						v-if="link.totalClicks !== undefined"
						class="flex items-center gap-1 text-muted-foreground"
					>
						<UIcon
							name="i-heroicons-cursor-arrow-rays"
							class="size-3.5 shrink-0"
							aria-hidden="true"
						/>
						<span>
							{{ formatClicks(link.totalClicks) }}
							{{ link.totalClicks === 1 ? "click" : "clicks" }}
						</span>
					</div>

					<span
						v-if="link.customAlias"
						class="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-2 px-1.5 py-0.5 mono-token text-muted-foreground"
					>
						<UIcon name="i-heroicons-tag" class="size-3 shrink-0" aria-hidden="true" />
						<span>Custom</span>
					</span>
				</div>
			</div>
		</div>
	</article>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useCopyToClipboard } from "../composables";

const props = defineProps<{
	link: {
		id: string;
		shortUrl: string;
		originalUrl: string;
		customAlias?: string | null;
		createdAt: string | Date;
		totalClicks?: number;
	};
	showAnalytics?: boolean;
}>();

const emit =
	defineEmits<
		(e: "viewAnalytics", link: { id: string; shortUrl: string }) => void
	>();

const copied = ref(false);
const { copyToClipboard } = useCopyToClipboard();
const numberFormatter = new Intl.NumberFormat("en-US");

function copyLink(shortUrl: string) {
	const baseUrl = window?.location?.origin || "http://localhost:3000";
	const fullUrl = `${baseUrl}/${shortUrl}`;
	copyToClipboard(fullUrl);

	copied.value = true;
	setTimeout(() => {
		copied.value = false;
	}, 2000);
}

function openAnalytics() {
	emit("viewAnalytics", {
		id: props.link.id,
		shortUrl: props.link.shortUrl,
	});
}

function formatClicks(count: number): string {
	return numberFormatter.format(count);
}

function formatDate(date: string | Date): string {
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
		year: "numeric",
	});
}
</script>
