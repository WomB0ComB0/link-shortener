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
		eyebrow="Developer"
		title="API Keys"
		description="Manage scoped API keys for programmatic link shortening and analytics access."
	>
		<template #actions>
			<NuxtLink to="/dashboard" class="console-btn console-btn-outline">
				<UIcon name="i-heroicons-link" class="size-4 shrink-0" aria-hidden="true" />
				<span>My Links</span>
			</NuxtLink>
			<NuxtLink to="/create" class="console-btn console-btn-outline">
				<UIcon name="i-heroicons-plus" class="size-4 shrink-0" aria-hidden="true" />
				<span>Create Link</span>
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

		<ApiKeys />
	</PageShell>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";
import { useAuth } from "../composables";

const router = useRouter();
const { isAuthenticated, logout, syncFromStorage } = useAuth();

onMounted(async () => {
	if (import.meta.client) {
		await syncFromStorage();
		if (!isAuthenticated.value) {
			router.push("/auth");
		}
	}
});

async function handleLogout() {
	await logout();
	router.push("/");
}

useSeoMeta({
	title: "API Keys",
	description: "Manage your API keys for programmatic access",
});
</script>
