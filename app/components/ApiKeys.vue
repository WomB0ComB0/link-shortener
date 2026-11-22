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
	<div class="space-y-4 sm:space-y-5">
		<!-- Toolbar -->
		<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<SkeletonBox
				v-if="loading"
				class="h-4 w-28 rounded-sm"
			/>
			<p v-else class="tile-meta text-muted-foreground">
				{{ apiKeys.length }} {{ apiKeys.length === 1 ? "key" : "keys" }} configured
			</p>
			<button
				type="button"
				class="console-btn console-btn-primary w-full sm:w-auto"
				@click="openCreateModal"
			>
				<UIcon name="i-heroicons-plus" class="size-4 shrink-0" aria-hidden="true" />
				<span>Create API Key</span>
			</button>
		</div>

		<!-- Loading State -->
		<div v-if="loading" class="space-y-3" aria-busy="true">
			<span class="sr-only" role="status">Loading API keys…</span>
			<div
				v-for="n in 3"
				:key="`key-ph-${n}`"
				aria-hidden="true"
				data-placeholder=""
				class="rounded-tile border border-hairline bg-surface-1 p-4 sm:p-5"
			>
				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div class="flex-1 space-y-3">
						<div class="flex items-center gap-2.5">
							<SkeletonBox class="h-5 w-36 rounded-sm" />
							<SkeletonBox class="h-5 w-16 rounded-md" />
						</div>
						<div class="flex items-center gap-2">
							<SkeletonBox class="h-7 w-64 max-w-full rounded-md" />
							<SkeletonBox class="h-8 w-20 rounded-md" />
						</div>
						<div class="flex items-center gap-4">
							<SkeletonBox class="h-3.5 w-32 rounded-sm" />
							<SkeletonBox class="h-3.5 w-28 rounded-sm" />
						</div>
					</div>
					<SkeletonBox class="h-9 w-24 shrink-0 rounded-md" />
				</div>
			</div>
		</div>

		<!-- Error State -->
		<DataErrorCard
			v-else-if="loadError"
			title="Could not load API keys"
			:message="loadError"
			:retrying="loading"
			@retry="fetchApiKeys"
		/>

		<!-- API Keys List -->
		<div v-else-if="apiKeys.length > 0" class="space-y-3">
			<article
				v-for="key in apiKeys"
				:key="key.id"
				data-spotlight=""
				class="spotlight console-tile-lift rounded-tile border border-hairline bg-surface-1 p-4 sm:p-5"
			>
				<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div class="min-w-0 flex-1 space-y-3">
						<div class="flex flex-wrap items-center gap-2.5">
							<h3 class="tile-title truncate text-foreground">
								{{ key.name }}
							</h3>
							<span
								class="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-0.5 tile-label"
								:class="
									key.is_active
										? 'bg-live-tint text-live'
										: 'bg-down-tint text-down'
								"
							>
								<StatusDot :tone="key.is_active ? 'live' : 'down'" />
								<span>{{ key.is_active ? "Active" : "Revoked" }}</span>
							</span>
						</div>

						<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
							<div class="flex min-w-0 items-center gap-2">
								<UIcon name="i-heroicons-key" class="size-4 shrink-0 text-faint" aria-hidden="true" />
								<code
									class="mono-token truncate rounded-md border border-hairline bg-canvas px-2.5 py-1 text-brand-ink"
								>
									{{ key.key }}
								</code>
							</div>
							<button
								type="button"
								class="console-btn console-btn-outline h-8 px-3 text-xs sm:w-auto"
								:disabled="!key.fullKey"
								@click="copyToClipboard(key.fullKey || key.key)"
							>
								<UIcon name="i-heroicons-clipboard-document" class="size-3.5" aria-hidden="true" />
								<span>{{ !key.fullKey ? "Masked" : "Copy" }}</span>
							</button>
						</div>

						<div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 tile-meta text-faint">
							<span class="inline-flex items-center gap-1.5">
								<UIcon name="i-heroicons-calendar" class="size-3.5" aria-hidden="true" />
								<span>Created {{ formatDate(key.created_at) }}</span>
							</span>
							<span v-if="key.expires_at" class="inline-flex items-center gap-1.5">
								<UIcon name="i-heroicons-clock" class="size-3.5" aria-hidden="true" />
								<span>Expires {{ formatDate(key.expires_at) }}</span>
							</span>
							<span v-if="key.last_used_at" class="inline-flex items-center gap-1.5">
								<UIcon name="i-heroicons-arrow-path" class="size-3.5" aria-hidden="true" />
								<span>Last used {{ formatDate(key.last_used_at) }}</span>
							</span>
						</div>
					</div>

					<button
						v-if="key.is_active"
						type="button"
						class="console-btn console-btn-danger shrink-0 sm:w-auto"
						@click="revokeKey(key.id, key.name)"
					>
						<UIcon name="i-heroicons-trash" class="size-4" aria-hidden="true" />
						<span>Revoke</span>
					</button>
				</div>
			</article>
		</div>

		<!-- Empty State -->
		<div
			v-else
			class="rounded-tile border border-hairline bg-surface-1 px-6 py-14 text-center"
		>
			<div
				class="mx-auto mb-4 flex size-12 items-center justify-center rounded-tile border border-hairline bg-surface-2 text-faint"
			>
				<UIcon name="i-heroicons-key" class="size-6" aria-hidden="true" />
			</div>
			<h3 class="tile-title-lg text-foreground">No API keys yet</h3>
			<p class="mx-auto mt-1.5 max-w-[42ch] text-body-sm text-muted-foreground">
				Create your first API key to authenticate programmatic link creation and analytics requests.
			</p>
			<div class="mt-6">
				<button
					type="button"
					class="console-btn console-btn-primary"
					@click="openCreateModal"
				>
					<UIcon name="i-heroicons-plus" class="size-4" aria-hidden="true" />
					<span>Create API Key</span>
				</button>
			</div>
		</div>

		<!-- Create API Key Modal -->
		<UModal
			v-model:open="showCreateModal"
			title="Create API Key"
			description="Give your API key a descriptive name to identify where it is used."
			:ui="{
				overlay: 'bg-canvas/75 backdrop-blur-sm',
				content:
					'rounded-tile border border-hairline bg-surface-2 text-foreground shadow-raised divide-y divide-hairline',
				header: 'px-5 py-4',
				body: 'px-5 py-5',
				footer: 'px-5 py-4',
				title: 'tile-title-lg text-foreground',
				description: 'tile-sub text-muted-foreground mt-1',
			}"
		>
			<template #body>
				<form id="create-api-key-form" class="space-y-4" @submit.prevent="createApiKey">
					<div>
						<div class="mb-1.5 flex flex-wrap items-center justify-between gap-2">
							<label for="keyName" class="tile-label text-foreground">
								Key Name <span class="text-down">*</span>
							</label>
							<div class="flex flex-wrap items-center gap-1.5">
								<button
									v-for="preset in ['Production', 'CI / Actions', 'Local CLI']"
									:key="preset"
									type="button"
									class="console-chip"
									:class="newKeyName === preset && 'console-chip-active'"
									@click="newKeyName = preset"
								>
									{{ preset }}
								</button>
							</div>
						</div>
						<div class="console-field-shell">
							<span class="flex items-center pl-3 text-faint" aria-hidden="true">
								<UIcon name="i-heroicons-key" class="size-4" />
							</span>
							<input
								id="keyName"
								v-model="newKeyName"
								type="text"
								placeholder="e.g., Production API Key"
								:disabled="creating"
							/>
						</div>
					</div>

					<div class="rounded-lg border border-hairline bg-canvas p-3">
						<p class="label-mono text-faint">Usage</p>
						<code class="mt-1 block truncate mono-token text-muted-foreground">
							Authorization: Bearer sk_••••••••••••••••
						</code>
					</div>
				</form>
			</template>

			<template #footer>
				<div class="flex w-full justify-end gap-2">
					<button
						type="button"
						class="console-btn console-btn-outline"
						:disabled="creating"
						@click="showCreateModal = false"
					>
						Cancel
					</button>
					<button
						type="submit"
						form="create-api-key-form"
						class="console-btn console-btn-primary"
						:disabled="creating || !newKeyName.trim()"
					>
						{{ creating ? "Creating..." : "Create Key" }}
					</button>
				</div>
			</template>
		</UModal>

		<!-- New Key Display Modal -->
		<UModal
			v-model:open="showNewKeyModal"
			title="API Key Created"
			description="Copy this key now. For security, it will not be displayed again."
			:ui="{
				overlay: 'bg-canvas/75 backdrop-blur-sm',
				content:
					'rounded-tile border border-hairline bg-surface-2 text-foreground shadow-raised divide-y divide-hairline',
				header: 'px-5 py-4',
				body: 'px-5 py-5',
				footer: 'px-5 py-4',
				title: 'tile-title-lg text-live',
				description: 'tile-sub text-muted-foreground mt-1',
			}"
		>
			<template #body>
				<div class="space-y-4">
					<div
						class="flex items-start gap-2.5 rounded-lg border border-ongoing/30 bg-ongoing-tint p-3.5 text-body-sm text-ongoing"
					>
						<UIcon
							name="i-heroicons-exclamation-triangle"
							class="mt-0.5 size-4 shrink-0"
							aria-hidden="true"
						/>
						<span>Store this secret in a password manager or secrets vault immediately.</span>
					</div>

					<div>
						<span class="mb-1.5 block tile-label text-muted-foreground">Your API Key</span>
						<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
							<code
								class="mono-token flex-1 break-all rounded-md border border-hairline bg-canvas px-3.5 py-2.5 text-brand-ink"
							>
								{{ newApiKey }}
							</code>
							<button
								type="button"
								class="console-btn console-btn-primary shrink-0"
								@click="copyToClipboard(newApiKey)"
							>
								<UIcon name="i-heroicons-clipboard-document" class="size-4" aria-hidden="true" />
								<span>Copy</span>
							</button>
						</div>
					</div>
				</div>
			</template>

			<template #footer>
				<div class="flex w-full justify-end">
					<button
						type="button"
						class="console-btn console-btn-outline"
						@click="closeNewKeyModal"
					>
						Done
					</button>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useFetcher } from "../composables";

interface ApiKey {
	id: string;
	name: string;
	key: string;
	fullKey?: string;
	created_at: string;
	is_active: boolean;
	expires_at: string | null;
	last_used_at: string | null;
}

const { get: fetchGet, post: fetchPost } = useFetcher();
const toast = useToast();

const apiKeys = ref<ApiKey[]>([]);
const loading = ref(true);
const loadError = ref("");
const showCreateModal = ref(false);
const showNewKeyModal = ref(false);
const newKeyName = ref("");
const newApiKey = ref("");
const creating = ref(false);

onMounted(() => {
	fetchApiKeys();
});

async function fetchApiKeys() {
	loading.value = true;
	loadError.value = "";
	try {
		const response = await fetchGet<{ success: boolean; apiKeys: ApiKey[] }>(
			"/api/keys/list",
			{
				retries: 2,
				timeout: 10000,
			},
		);

		if (response.success) {
			apiKeys.value = response.apiKeys;
		}
	} catch (err: any) {
		console.error("Failed to fetch API keys:", err);
		loadError.value =
			err?.message || "Failed to load API keys. Please try again.";
		toast.add({
			title: "Error",
			description: "Failed to load API keys",
			color: "error",
		});
	} finally {
		loading.value = false;
	}
}

function openCreateModal() {
	newKeyName.value = "";
	showCreateModal.value = true;
}

async function createApiKey() {
	if (!newKeyName.value.trim()) return;

	creating.value = true;
	try {
		const response = await fetchPost<{
			success: boolean;
			apiKey: ApiKey & { keyPrefix?: string };
		}>(
			"/api/keys/create",
			{ name: newKeyName.value.trim() },
			{
				retries: 1,
				timeout: 10000,
			},
		);

		if (response.success && response.apiKey) {
			newApiKey.value = response.apiKey.key;
			showCreateModal.value = false;
			showNewKeyModal.value = true;

			const keyWithFullKey: ApiKey = {
				...response.apiKey,
				key: response.apiKey.keyPrefix || response.apiKey.key,
				fullKey: response.apiKey.key,
			};
			apiKeys.value.unshift(keyWithFullKey);

			toast.add({
				title: "Success",
				description: "API key created successfully",
				color: "success",
			});
		}
	} catch (err: any) {
		console.error("Failed to create API key:", err);
		toast.add({
			title: "Error",
			description: err.message || "Failed to create API key",
			color: "error",
		});
	} finally {
		creating.value = false;
	}
}

async function revokeKey(keyId: string, keyName: string) {
	if (
		!confirm(
			`Are you sure you want to revoke "${keyName}"? This action cannot be undone.`,
		)
	) {
		return;
	}

	try {
		const response = await fetchPost<{ success: boolean }>(
			"/api/keys/revoke",
			{ keyId },
			{
				retries: 1,
				timeout: 10000,
			},
		);

		if (response.success) {
			const keyIndex = apiKeys.value.findIndex((k) => k.id === keyId);
			if (keyIndex !== -1 && apiKeys.value[keyIndex]) {
				apiKeys.value[keyIndex].is_active = false;
			}

			toast.add({
				title: "Success",
				description: "API key revoked successfully",
				color: "success",
			});
		}
	} catch (err: any) {
		console.error("Failed to revoke API key:", err);
		toast.add({
			title: "Error",
			description: err.message || "Failed to revoke API key",
			color: "error",
		});
	}
}

function closeNewKeyModal() {
	showNewKeyModal.value = false;
	newApiKey.value = "";
}

async function copyToClipboard(text: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.add({
			title: "Copied",
			description: "API key copied to clipboard",
			color: "success",
		});
	} catch {
		toast.add({
			title: "Error",
			description: "Failed to copy to clipboard",
			color: "error",
		});
	}
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}
</script>
