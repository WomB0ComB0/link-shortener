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

    <main class="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12">
      <!-- Form header -->
      <div class="mb-8">
        <h1 class="text-4xl font-bold text-gray-900 mb-2">Create Short Link</h1>
        <p class="text-gray-600">Paste a long URL and get a short link instantly</p>
      </div>

      <!-- Form card -->
      <UCard class="shadow-lg border border-gray-200 bg-white">
        <form @submit.prevent="createLink" class="space-y-6">
          <!-- Master Password (only if not authenticated) -->
          <UFormGroup v-if="!isAuthenticated" label="Master Password" required>
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
            <UFormGroup label="Custom Alias (Optional)">
              <UInput
                v-model="form.customAlias"
                placeholder="my-custom-link"
                :disabled="loading"
                icon="i-heroicons-tag"
                class="rounded-lg"
              />
              <template #help>
                Letters, numbers, hyphens only
              </template>
            </UFormGroup>

            <!-- Expiration Date -->
            <UFormGroup label="Expires At (Optional)">
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
        <div
          v-if="result"
          class="mt-6 space-y-4 rounded-lg border border-green-200 bg-green-50 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
        >
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

          <div class="flex items-center justify-between text-xs text-gray-600">
            <span>{{ new Date(result.createdAt).toLocaleString() }}</span>
            <a
              :href="shortLinkUrl"
              target="_blank"
              class="flex items-center gap-1 text-blue-600 hover:underline font-medium"
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
      </UCard>
    </main>

    <!-- Recent Links Section -->
    <section v-if="recentLinks.length > 0" class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 bg-gray-50">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900 mb-2">Recently Created Links</h2>
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
    const links = await fetchGet("/api/links/public", {
      retries: 2,
      timeout: 10000,
    }, { limit: 6 });
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
      error.value = String(err.responseData) || err.message || "Failed to create short link";
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
  title: "Create Short Link - LinkShort",
  description: "Create a fast, secure short link instantly.",
});
</script>
