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
	<PageShell
		eyebrow="links.mikeodnis.dev"
		title="Links"
		description="Fast, verified short links with click analytics and programmatic API access."
	>
		<template #actions>
			<NuxtLink to="/create" class="console-btn console-btn-primary">
				<UIcon name="i-heroicons-plus" class="size-4 shrink-0" aria-hidden="true" />
				<span>Create Link</span>
			</NuxtLink>

			<NuxtLink
				v-if="!isAuthenticated"
				to="/auth"
				class="console-btn console-btn-outline"
			>
				<UIcon name="i-heroicons-user" class="size-4 shrink-0" aria-hidden="true" />
				<span>Login</span>
			</NuxtLink>

			<template v-else>
				<NuxtLink to="/dashboard" class="console-btn console-btn-outline">
					<UIcon name="i-heroicons-chart-bar" class="size-4 shrink-0" aria-hidden="true" />
					<span>Dashboard</span>
				</NuxtLink>
				<button
					type="button"
					class="console-btn console-btn-ghost"
					@click="handleLogout"
				>
					<UIcon
						name="i-heroicons-arrow-left-on-rectangle"
						class="size-4 shrink-0"
						aria-hidden="true"
					/>
					<span>Logout</span>
				</button>
			</template>
		</template>

		<template #stats>
			<StatStrip
				aria-label="Public links overview"
				:loading="loading"
				:placeholder-count="3"
				:items="statItems"
			/>
		</template>

		<section aria-labelledby="public-links-heading" class="space-y-4">
			<div class="flex items-center justify-between gap-4">
				<h2 id="public-links-heading" class="tile-label text-muted-foreground">
					Recent public links
				</h2>
				<span
					class="tile-label inline-flex items-center gap-1.5"
					:class="fetchError ? 'text-down' : 'text-live'"
				>
					<StatusDot :tone="fetchError ? 'down' : 'live'" :pulse="!fetchError" />
					<span>{{ fetchError ? "Degraded" : "Live" }}</span>
				</span>
			</div>

			<DataErrorCard
				v-if="fetchError && !loading"
				title="Could not load public links"
				:message="errorMessage"
				:retrying="loading"
				@retry="refresh()"
			/>

			<LinksGrid
				v-else-if="loading || publicLinks.length > 0"
				:links="publicLinks"
				:loading="loading"
				:skeleton-count="6"
			/>

			<div
				v-else
				class="rounded-tile border border-hairline bg-surface-1 px-6 py-14 text-center"
			>
				<div
					class="mx-auto mb-4 flex size-12 items-center justify-center rounded-tile border border-hairline bg-surface-2 text-faint"
				>
					<UIcon name="i-heroicons-link" class="size-6" aria-hidden="true" />
				</div>
				<h3 class="tile-title-lg text-foreground">No public links yet</h3>
				<p class="mx-auto mt-1.5 max-w-[42ch] text-body-sm text-muted-foreground">
					Shorten a URL to publish your first verified redirect here.
				</p>
			</div>
		</section>
	</PageShell>
</template>

<script lang="ts" setup>
import { computed, onMounted } from "vue";
import { useAuth } from "../composables";

interface PublicLink {
	id: string;
	shortUrl: string;
	originalUrl: string;
	customAlias?: string | null;
	createdAt: string;
	totalClicks?: number;
}

const { isAuthenticated, syncFromStorage, logout } = useAuth();

const {
	data,
	status,
	error: fetchError,
	refresh,
} = useLazyFetch<PublicLink[]>("/api/links/public", {
	key: "public-links",
	query: { limit: 12 },
	default: () => [],
});

const publicLinks = computed(() => (Array.isArray(data.value) ? data.value : []));
const loading = computed(
	() => status.value === "pending" || status.value === "idle",
);

const errorMessage = computed(
	() =>
		fetchError.value?.data?.message ||
		fetchError.value?.message ||
		"Failed to reach the links feed. Please try again.",
);

const totalClicks = computed(() =>
	publicLinks.value.reduce(
		(sum, link) =>
			sum + (typeof link.totalClicks === "number" ? link.totalClicks : 0),
		0,
	),
);

const customAliases = computed(
	() => publicLinks.value.filter((link) => Boolean(link.customAlias)).length,
);

const statItems = computed(() => [
	{
		label: "public links",
		value: fetchError.value ? null : publicLinks.value.length,
	},
	{
		label: "total clicks",
		value: fetchError.value ? null : totalClicks.value,
	},
	{
		label: "custom aliases",
		value: fetchError.value ? null : customAliases.value,
	},
]);

onMounted(() => {
	syncFromStorage();
});

function handleLogout() {
	logout();
}

usePageSeo({
	title: "Links — Mike Odnis",
	description:
		"Fast, security-verified short links with click analytics on links.mikeodnis.dev.",
	path: "/",
	useSiteCard: true,
});
</script>
