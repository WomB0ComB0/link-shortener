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
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-gray-900">API Keys</h2>
        <p class="text-sm sm:text-base text-gray-600 mt-1">Manage your API keys for programmatic access</p>
      </div>
      <UButton
        @click="openCreateModal"
        icon="i-heroicons-plus"
        color="primary"
        class="rounded-lg shrink-0 w-full sm:w-auto"
      >
        Create API Key
      </UButton>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-primary-500 animate-spin" />
    </div>

    <!-- API Keys List -->
    <div v-else-if="apiKeys.length > 0" class="space-y-3 sm:space-y-4">
      <div
        v-for="key in apiKeys"
        :key="key.id"
        class="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 hover:shadow-lg hover:border-purple-200 transition-all"
      >
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 sm:mb-2">
              <h3 class="text-base sm:text-lg font-semibold text-gray-900 truncate">{{ key.name }}</h3>
              <UBadge
                :color="key.is_active ? 'success' : 'error'"
                variant="soft"
                size="sm"
                class="shrink-0"
              >
                {{ key.is_active ? 'Active' : 'Inactive' }}
              </UBadge>
            </div>
            
            <div class="space-y-2 text-xs sm:text-sm text-gray-600">
              <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <UIcon name="i-heroicons-key" class="h-4 w-4 shrink-0" />
                  <code class="bg-gray-100 px-2 py-1 rounded font-mono text-xs truncate">{{ key.key }}</code>
                </div>
                <UButton
                  @click="copyToClipboard(key.fullKey || key.key)"
                  icon="i-heroicons-clipboard-document"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :disabled="!key.fullKey"
                  class="shrink-0 w-full sm:w-auto"
                >
                  {{ !key.fullKey ? 'Masked' : 'Copy' }}
                </UButton>
              </div>
              
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-calendar" class="h-4 w-4" />
                <span>Created: {{ formatDate(key.created_at) }}</span>
              </div>
              
              <div v-if="key.expires_at" class="flex items-center gap-2">
                <UIcon name="i-heroicons-clock" class="h-4 w-4" />
                <span>Expires: {{ formatDate(key.expires_at) }}</span>
              </div>
              
              <div v-if="key.last_used_at" class="flex items-center gap-2">
                <UIcon name="i-heroicons-arrow-path" class="h-4 w-4" />
                <span>Last used: {{ formatDate(key.last_used_at) }}</span>
              </div>
            </div>
          </div>
          
          <UButton
            v-if="key.is_active"
            @click="revokeKey(key.id, key.name)"
            icon="i-heroicons-trash"
            color="error"
            variant="soft"
            size="sm"
            class="rounded-lg shrink-0 w-full sm:w-auto"
          >
            Revoke
          </UButton>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-16 bg-white border border-gray-200 rounded-xl">
      <UIcon name="i-heroicons-key" class="h-16 w-16 text-gray-300 mx-auto mb-4" />
      <h3 class="text-lg font-semibold text-gray-900 mb-2">No API keys yet</h3>
      <p class="text-gray-600 mb-6">Create your first API key to access the API programmatically</p>
      <UButton
        @click="openCreateModal"
        icon="i-heroicons-plus"
        color="primary"
        class="rounded-lg"
      >
        Create API Key
      </UButton>
    </div>

    <!-- Create API Key Modal -->
    <UModal v-model="showCreateModal">
      <UCard>
        <template #header>
          <h3 class="text-lg font-semibold text-gray-900">Create API Key</h3>
        </template>

        <form @submit.prevent="createApiKey" class="space-y-4">
          <div>
            <label for="keyName" class="block text-sm font-medium text-gray-700 mb-1">
              Key Name <span class="text-red-500">*</span>
            </label>
            <UInput
              id="keyName"
              v-model="newKeyName"
              placeholder="e.g., Production API Key"
              :disabled="creating"
              class="w-full"
              size="md"
            />
          </div>

          <p class="text-sm text-gray-600">
            Give your API key a descriptive name to help you remember what it's used for.
          </p>
        </form>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton
              @click="showCreateModal = false"
              color="neutral"
              variant="soft"
              :disabled="creating"
            >
              Cancel
            </UButton>
            <UButton
              @click="createApiKey"
              color="primary"
              :loading="creating"
              :disabled="!newKeyName.trim()"
            >
              Create Key
            </UButton>
          </div>
        </template>
      </UCard>
    </UModal>

    <!-- New Key Display Modal -->
    <UModal v-model="showNewKeyModal">
      <UCard>
        <template #header>
          <div class="flex items-center gap-2 text-green-600">
            <UIcon name="i-heroicons-check-circle" class="h-6 w-6" />
            <h3 class="text-lg font-semibold">API Key Created!</h3>
          </div>
        </template>

        <div class="space-y-4">
          <UAlert
            icon="i-heroicons-exclamation-triangle"
            color="warning"
            variant="soft"
            title="Important"
            description="Make sure to copy your API key now. You won't be able to see it again!"
          />

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Your API Key</label>
            <div class="flex items-center gap-2">
              <code class="flex-1 bg-gray-100 px-4 py-3 rounded font-mono text-sm break-all">
                {{ newApiKey }}
              </code>
              <UButton
                @click="copyToClipboard(newApiKey)"
                icon="i-heroicons-clipboard-document"
                color="primary"
                variant="soft"
              >
                Copy
              </UButton>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end">
            <UButton
              @click="closeNewKeyModal"
              color="primary"
            >
              Done
            </UButton>
          </div>
        </template>
      </UCard>
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
	try {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			toast.add({
				title: "Error",
				description: "You must be logged in to view API keys",
				color: "error",
			});
			return;
		}

		const response = await fetchGet<{ success: boolean; apiKeys: ApiKey[] }>(
			"/api/keys/list",
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
				retries: 2,
				timeout: 10000,
			},
		);

		if (response.success) {
			apiKeys.value = response.apiKeys;
		}
	} catch (err: any) {
		console.error("Failed to fetch API keys:", err);
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
		const token = localStorage.getItem("auth_token");
		if (!token) {
			toast.add({
				title: "Error",
				description: "You must be logged in to create API keys",
				color: "error",
			});
			return;
		}

		const response = await fetchPost<{ success: boolean; apiKey: ApiKey }>(
			"/api/keys/create",
			{ name: newKeyName.value.trim() },
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
				retries: 1,
				timeout: 10000,
			},
		);

		if (response.success && response.apiKey) {
			newApiKey.value = response.apiKey.key;
			showCreateModal.value = false;
			showNewKeyModal.value = true;

			// Store the full key temporarily for the newly created key
			const keyWithFullKey = {
				...response.apiKey,
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
		const token = localStorage.getItem("auth_token");
		if (!token) {
			toast.add({
				title: "Error",
				description: "You must be logged in to revoke API keys",
				color: "error",
			});
			return;
		}

		const response = await fetchPost<{ success: boolean }>(
			"/api/keys/revoke",
			{ keyId },
			{
				headers: {
					Authorization: `Bearer ${token}`,
				},
				retries: 1,
				timeout: 10000,
			},
		);

		if (response.success) {
			// Update the local state
			const keyIndex = apiKeys.value.findIndex((k) => k.id === keyId);
			if (keyIndex !== -1) {
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
			title: "Copied!",
			description: "API key copied to clipboard",
			color: "success",
		});
	} catch (err) {
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
