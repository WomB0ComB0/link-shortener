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
  <div class="min-h-screen bg-white">
    <!-- Header -->
    <AppHeader>
      <template #nav>
        <NuxtLink to="/" class="mr-2">
          <UButton
            icon="i-heroicons-home"
            color="primary"
            variant="soft"
            class="rounded-lg"
          >
            Home
          </UButton>
        </NuxtLink>

        <NuxtLink v-if="!isAuthenticated" to="/auth">
          <UButton
            icon="i-heroicons-user"
            color="primary"
            variant="soft"
            class="rounded-lg"
          >
            Login
          </UButton>
        </NuxtLink>

        <template v-else>
          <NuxtLink to="/dashboard">
            <UButton
              variant="soft"
              color="primary"
              icon="i-heroicons-chart-bar"
              class="rounded-lg"
            >
              Dashboard
            </UButton>
          </NuxtLink>
          <UButton
            @click="handleLogout"
            variant="ghost"
            color="neutral"
            class="rounded-lg"
            icon="i-heroicons-arrow-left-on-rectangle"
          >
            Logout
          </UButton>
        </template>
      </template>
    </AppHeader>

    <main class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <!-- Form header -->
      <div class="mb-6 sm:mb-8">
        <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Create Short Link</h1>
        <p class="text-gray-600">Paste a long URL and get a short link instantly</p>
      </div>

      <!-- Form card -->
      <div class="shadow-md bg-white overflow-hidden rounded-xl border border-gray-200 p-6 sm:p-8">
        <form @submit.prevent="createLink" class="space-y-6">
          <!-- Master Password (only if not authenticated) -->
          <div v-if="!isAuthenticated">
            <label for="masterPassword" class="block text-sm font-medium text-gray-700 mb-1">
              Master Password <span class="text-red-500">*</span>
            </label>
            <UInput
              id="masterPassword"
              v-model="form.masterPassword"
              type="password"
              placeholder="Enter master password"
              :disabled="loading"
              icon="i-heroicons-key"
              class="w-full rounded-lg"
              size="md"
            />
            <p class="text-xs text-gray-500 mt-1">
              Required for anonymous link creation
            </p>
          </div>

          <!-- Original URL -->
          <div>
            <label for="originalUrl" class="block text-sm font-medium text-gray-700 mb-1">
              Original URL <span class="text-red-500">*</span>
            </label>
            <UInput
              id="originalUrl"
              v-model="form.originalUrl"
              type="url"
              placeholder="https://example.com/your/very/long/url"
              :disabled="loading"
              icon="i-heroicons-link"
              class="w-full rounded-lg"
              size="md"
            />
          </div>

          <div class="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <!-- Custom Alias -->
            <div>
              <label for="customAlias" class="block text-sm font-medium text-gray-700 mb-1">
                Custom Alias (Optional)
              </label>
              <UInput
                id="customAlias"
                v-model="form.customAlias"
                placeholder="my-custom-link"
                :disabled="loading"
                icon="i-heroicons-tag"
                class="w-full rounded-lg"
                size="md"
              />
              <p class="text-xs text-gray-500 mt-1">
                Letters, numbers, hyphens only
              </p>
            </div>

            <!-- Expiration Date -->
            <div>
              <label for="expiresAt" class="block text-sm font-medium text-gray-700 mb-1">
                Expires At (Optional)
              </label>
              <UInput
                id="expiresAt"
                v-model="form.expiresAt"
                type="datetime-local"
                :disabled="loading"
                icon="i-heroicons-clock"
                class="w-full rounded-lg"
                size="md"
              />
            </div>
          </div>

          <UButton
            type="submit"
            :loading="loading"
            :disabled="(!isAuthenticated && !form.masterPassword) || !form.originalUrl"
            block
            size="lg"
            icon="i-heroicons-sparkles"
            class="font-semibold rounded-lg"
            style="background: var(--primary); color: var(--primary-foreground);"
          >
            {{ loading ? 'Creating...' : 'Create Short Link' }}
          </UButton>
        </form>

        <!-- Result Display -->
        <div
          v-if="result"
          class="mt-6 space-y-4 rounded-xl border border-green-300 bg-green-50 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm"
        >
          <div class="flex items-center gap-2 text-sm font-semibold text-green-700">
            <UIcon name="i-heroicons-check-circle" class="h-5 w-5" />
            <span>Link created successfully!</span>
          </div>

          <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <UInput
              :model-value="shortLinkUrl"
              readonly
              class="flex-1 rounded-lg"
              size="md"
            />
            <UButton
              @click="copyResult"
              size="md"
              :icon="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
              :color="copied ? 'success' : 'primary'"
              class="rounded-lg w-full sm:w-auto"
            >
              {{ copied ? 'Copied!' : 'Copy' }}
            </UButton>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-600">
            <span class="truncate">{{ new Date(result.createdAt).toLocaleString() }}</span>
            <a
              :href="shortLinkUrl"
              target="_blank"
              class="flex items-center gap-1 hover:underline font-medium shrink-0"
              style="color: var(--primary)"
            >
              <span>Test link</span>
              <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-3 w-3" />
            </a>
          </div>
        </div>

        <!-- Error Display -->
        <UAlert
          v-if="error"
          color="error"
          class="mt-4"
          :title="error"
          :close-button="{ icon: 'i-heroicons-x-mark-20-solid', color: 'error', variant: 'link' }"
          @close="error = ''"
        />
      </div>
    </main>

    <!-- Recent Links Section -->
    <section v-if="recentLinks.length > 0" class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 bg-gray-50">
      <div class="mb-6 sm:mb-8">
        <h2 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Recently Created Links</h2>
        <p class="text-gray-600">View all your shortened links</p>
      </div>
      <LinksGrid :links="recentLinks" />
    </section>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import type { CreateShortLinkResponse } from "../../server/schemas";
import { useCopyToClipboard, useFetcher } from "../composables";

const { get: fetchGet, post: fetchPost, FetcherError } = useFetcher();
const authToken = ref<string | null>(null);
const currentUser = ref<any>(null);

const form = ref({
	masterPassword: "",
	originalUrl: "",
	customAlias: "",
	expiresAt: "",
});

const loading = ref(false);
const error = ref("");
const result = ref<CreateShortLinkResponse | null>(null);
const recentLinks = ref<any[]>([]);
const { copied, copyToClipboard } = useCopyToClipboard();

const isAuthenticated = computed(
	() => !!authToken.value && !!currentUser.value,
);

const shortLinkUrl = computed(() => {
	if (!result.value) return "";
	const baseUrl = window?.location?.origin || "http://localhost:3000";
	return `${baseUrl}/${result.value.shortUrl}`;
});

onMounted(() => {
	if (process.client) {
		const token = localStorage.getItem("auth_token");
		if (token) {
			authToken.value = token;
			fetchCurrentUser();
		}
	}
	fetchRecentLinks();
});

async function fetchRecentLinks() {
	try {
		const links = await fetchGet(
			"/api/links/public",
			{
				retries: 2,
				timeout: 10000,
			},
			{ limit: 6 },
		);
		recentLinks.value = Array.isArray(links) ? links : [];
	} catch (err) {
		console.error("Failed to fetch recent links:", err);
	}
}

async function fetchCurrentUser() {
	if (!authToken.value) return;

	try {
		const user = await fetchGet("/api/auth/me", {
			headers: {
				Authorization: `Bearer ${authToken.value}`,
			},
			retries: 1,
			timeout: 5000,
		});
		currentUser.value = user;
	} catch (err) {
		handleLogout();
	}
}

function handleLogout() {
	authToken.value = null;
	currentUser.value = null;

	if (process.client) {
		localStorage.removeItem("auth_token");
	}
}

async function createLink() {
	loading.value = true;
	error.value = "";
	result.value = null;

	try {
		const headers: Record<string, string> = {};

		if (authToken.value) {
			headers.Authorization = `Bearer ${authToken.value}`;
		} else if (form.value.masterPassword) {
			headers["x-master-password"] = form.value.masterPassword;
		}

		const response = await fetchPost<CreateShortLinkResponse>(
			"/api/links/create",
			{
				originalUrl: form.value.originalUrl,
				customAlias: form.value.customAlias || undefined,
				expiresAt: form.value.expiresAt || undefined,
			},
			{
				headers,
				retries: 2,
				timeout: 15000,
				onError: (err) => {
					if (err instanceof FetcherError) {
						console.error("Link creation failed:", err.toString());
					}
				},
			},
		);

		result.value = response;
		form.value.originalUrl = "";
		form.value.customAlias = "";
		form.value.expiresAt = "";

		// Refresh the recent links to show the newly created one
		await fetchRecentLinks();
	} catch (err) {
		if (err instanceof FetcherError) {
			error.value =
				String(err.responseData) ||
				err.message ||
				"Failed to create short link";
		} else {
			error.value = err.message || "Failed to create short link";
		}
	} finally {
		loading.value = false;
	}
}

function copyResult() {
	copyToClipboard(shortLinkUrl.value);
}

useSeoMeta({
	title: "Create Short Link",
	description: "Create a fast, secure short link instantly.",
});
</script>
