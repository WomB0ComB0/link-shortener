<template>
  <div class="min-h-screen bg-white">
    <!-- Header -->
    <header class="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
      <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <NuxtLink to="/" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 text-white shadow-md">
              <UIcon name="i-heroicons-link" class="h-6 w-6" />
            </div>
            <div>
              <h1 class="text-lg font-bold text-gray-900">LinkShort</h1>
            </div>
          </NuxtLink>

          <div class="flex items-center gap-3">
            <NuxtLink to="/create">
              <UButton
                icon="i-heroicons-plus"
                color="primary"
                variant="soft"
                class="rounded-lg"
              >
                Create Link
              </UButton>
            </NuxtLink>
            
            <!-- Link to auth page instead of showing modal -->
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
                color="secondary"
                class="rounded-lg"
                icon="i-heroicons-arrow-left-on-rectangle"
              >
                Logout
              </UButton>
            </template>
          </div>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12">
      <!-- Link Shortener Form -->
      <div class="w-full">
        <div class="mb-8">
          <h2 class="text-4xl font-bold text-gray-900 mb-2">Shorten a Link</h2>
          <p class="text-gray-600">Create a short, shareable link instantly</p>
        </div>

        <UCard class="shadow-lg border border-gray-200 bg-white">
          <form @submit.prevent="createLink" class="space-y-6">
            <!-- Master Password (only if not authenticated) -->
            <UFormGroup
              v-if="!isAuthenticated"
              label="Master Password"
              required
            >
              <UInput
                v-model="form.masterPassword"
                type="password"
                placeholder="Enter master password"
                :disabled="loading"
                icon="i-heroicons-key"
                class="rounded-lg"
              />
              <template #help>
                Required for anonymous link creation
              </template>
            </UFormGroup>

            <!-- Original URL -->
            <UFormGroup label="Original URL" required>
              <UInput
                v-model="form.originalUrl"
                type="url"
                placeholder="https://example.com/your/very/long/url"
                :disabled="loading"
                icon="i-heroicons-link"
                size="lg"
                class="rounded-lg"
              />
            </UFormGroup>

            <div class="grid gap-4 sm:grid-cols-2">
              <!-- Custom Alias -->
              <UFormGroup label="Custom Alias">
                <UInput
                  v-model="form.customAlias"
                  placeholder="my-custom-link"
                  :disabled="loading"
                  icon="i-heroicons-tag"
                  class="rounded-lg"
                />
                <template #help>
                  Letters, numbers, hyphens
                </template>
              </UFormGroup>

              <!-- Expiration Date -->
              <UFormGroup label="Expires At">
                <UInput
                  v-model="form.expiresAt"
                  type="datetime-local"
                  :disabled="loading"
                  icon="i-heroicons-clock"
                  class="rounded-lg"
                />
              </UFormGroup>
            </div>

            <UButton
              type="submit"
              :loading="loading"
              :disabled="(!isAuthenticated && !form.masterPassword) || !form.originalUrl"
              block
              size="lg"
              icon="i-heroicons-sparkles"
              class="font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
            >
              {{ loading ? 'Creating...' : 'Create Short Link' }}
            </UButton>
          </form>

          <!-- Result Display -->
          <div v-if="result" class="mt-6 space-y-3 rounded-lg border border-green-200 bg-green-50 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div class="flex items-center gap-2 text-sm font-semibold text-green-700">
              <UIcon name="i-heroicons-check-circle" class="h-5 w-5" />
              <span>Link created successfully!</span>
            </div>
            
            <div class="flex items-center gap-2">
              <UInput
                :model-value="shortLinkUrl"
                readonly
                class="flex-1 rounded-lg"
                size="lg"
              />
              <UButton
                @click="copyResult"
                size="lg"
                :icon="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
                :color="copied ? 'success' : 'primary'"
                class="rounded-lg"
              >
                {{ copied ? 'Copied!' : 'Copy' }}
              </UButton>
            </div>
            
            <div class="flex items-center justify-between text-xs text-gray-500">
              <span>{{ new Date(result.createdAt).toLocaleString() }}</span>
              <a
                :href="shortLinkUrl"
                target="_blank"
                class="flex items-center gap-1 text-blue-600 hover:underline font-medium"
              >
                <span>Test</span>
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
        </UCard>
      </div>

      <!-- Display links grid as the main content -->
      <div class="mb-8 mt-12">
        <h2 class="text-3xl font-bold text-gray-900 mb-2">Recent Links</h2>
        <p class="text-gray-600">Browse recently created short links</p>
      </div>

      <LinksGrid :links="publicLinks" />
    </main>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import type { CreateShortLinkResponse } from "../../server/schemas";
import LinksGrid from "../components/LinksGrid.vue";
import { useCopyToClipboard } from "../composables";

const showAuthModal = ref(false);
const authToken = ref<string | null>(null);
const currentUser = ref<any>(null);
const publicLinks = ref<any[]>([]);
const form = ref({
	masterPassword: "",
	originalUrl: "",
	customAlias: "",
	expiresAt: "",
});

const loading = ref(false);
const error = ref("");
const result = ref<CreateShortLinkResponse | null>(null);
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
});

async function fetchCurrentUser() {
	if (!authToken.value) return;

	try {
		const user = await $fetch("/api/auth/me", {
			headers: {
				Authorization: `Bearer ${authToken.value}`,
			},
		});

		currentUser.value = user;
	} catch (err) {
		handleLogout();
	}
}

function handleAuthSuccess(token: string) {
	authToken.value = token;
	if (process.client) {
		localStorage.setItem("auth_token", token);
	}
	fetchCurrentUser();
	showAuthModal.value = false;
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
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
		};

		if (authToken.value) {
			headers.Authorization = `Bearer ${authToken.value}`;
		} else if (form.value.masterPassword) {
			headers["x-master-password"] = form.value.masterPassword;
		}

		const response = await $fetch<CreateShortLinkResponse>(
			"/api/links/create",
			{
				method: "POST",
				headers,
				body: {
					originalUrl: form.value.originalUrl,
					customAlias: form.value.customAlias || undefined,
					expiresAt: form.value.expiresAt || undefined,
				},
			},
		);

		result.value = response;
		form.value.originalUrl = "";
		form.value.customAlias = "";
		form.value.expiresAt = "";
	} catch (err: any) {
		error.value =
			err.data?.message || err.message || "Failed to create short link";
	} finally {
		loading.value = false;
	}
}

function copyResult() {
	copyToClipboard(shortLinkUrl.value);
}

useSeoMeta({
	title: "LinkShort - Secure Link Shortener",
	description: "Create fast, secure short links instantly.",
});
</script>
