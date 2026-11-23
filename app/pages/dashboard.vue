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
		eyebrow="Workspace"
		title="Your Links"
		description="Manage your shortened links and inspect real-time click analytics."
	>
		<template #actions>
			<NuxtLink to="/create" class="console-btn console-btn-primary">
				<UIcon name="i-heroicons-plus" class="size-4 shrink-0" aria-hidden="true" />
				<span>Create Link</span>
			</NuxtLink>
			<NuxtLink to="/keys" class="console-btn console-btn-outline">
				<UIcon name="i-heroicons-key" class="size-4 shrink-0" aria-hidden="true" />
				<span>API Keys</span>
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

		<template #stats>
			<StatStrip
				aria-label="Your links summary"
				:loading="loading"
				:placeholder-count="3"
				:items="statItems"
			/>
		</template>

		<!-- Error State -->
		<DataErrorCard
			v-if="loadError && !loading"
			title="Could not load your links"
			:message="loadError"
			:retrying="loading"
			@retry="reloadUserLinks"
		/>

		<!-- Links Grid -->
		<LinksGrid
			v-else-if="loading || userLinks.length > 0"
			:links="userLinks"
			:show-analytics="true"
			:loading="loading"
			:skeleton-count="6"
		/>

		<!-- Empty State -->
		<div
			v-else
			class="rounded-tile border border-hairline bg-surface-1 px-6 py-16 text-center"
		>
			<div
				class="mx-auto mb-4 flex size-12 items-center justify-center rounded-tile border border-hairline bg-surface-2 text-faint"
			>
				<UIcon name="i-heroicons-link-slash" class="size-6" aria-hidden="true" />
			</div>
			<h2 class="tile-title-lg text-foreground">No links yet</h2>
			<p class="mx-auto mt-1.5 max-w-[42ch] text-body-sm text-muted-foreground">
				Create your first short link to start tracking clicks and referrers.
			</p>
			<div class="mt-6">
				<NuxtLink to="/create" class="console-btn console-btn-primary">
					<UIcon name="i-heroicons-plus" class="size-4 shrink-0" aria-hidden="true" />
					<span>Create Link</span>
				</NuxtLink>
			</div>
		</div>
	</PageShell>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useAuth, useFetcher } from "../composables";

const { get: fetchGet, FetcherError } = useFetcher();
const { isAuthenticated, logout, syncFromStorage } = useAuth();
const router = useRouter();
const userLinks = ref<any[]>([]);
const loading = ref(true);
const loadError = ref("");

const totalClicks = computed(() =>
	userLinks.value.reduce(
		(sum, link) =>
			sum + (typeof link.totalClicks === "number" ? link.totalClicks : 0),
		0,
	),
);

const customAliases = computed(
	() => userLinks.value.filter((link) => Boolean(link.customAlias)).length,
);

const statItems = computed(() => [
	{
		label: userLinks.value.length === 1 ? "link" : "links",
		value: loadError.value ? null : userLinks.value.length,
	},
	{
		label: "total clicks",
		value: loadError.value ? null : totalClicks.value,
	},
	{
		label: "custom aliases",
		value: loadError.value ? null : customAliases.value,
	},
]);

onMounted(async () => {
	if (import.meta.client) {
		await syncFromStorage();
		if (isAuthenticated.value) {
			await fetchUserLinks();
		} else {
			loading.value = false;
			router.push("/auth");
		}
	}
});

async function reloadUserLinks() {
	await fetchUserLinks();
}

async function fetchUserLinks() {
	loading.value = true;
	loadError.value = "";
	try {
		const links = await fetchGet("/api/links/me", {
			retries: 2,
			timeout: 10000,
		});
		userLinks.value = Array.isArray(links) ? links : [];
	} catch (err: any) {
		console.error("Failed to fetch user links:", err);
		if (err instanceof FetcherError && err.status === 401) {
			await handleLogout();
			return;
		}
		loadError.value =
			err?.message || "Failed to load your links. Please try again.";
	} finally {
		loading.value = false;
	}
}

async function handleLogout() {
	userLinks.value = [];
	await logout();
	router.push("/");
}

usePageSeo({
	title: "Dashboard",
	description:
		"Manage your short links, monitor destination health, and inspect click analytics.",
	path: "/dashboard",
	noIndex: true,
});
</script>
