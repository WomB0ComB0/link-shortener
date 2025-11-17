<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
    <!-- Header -->
    <header class="border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/50 backdrop-blur-sm sticky top-0 z-10">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
              <UIcon name="i-heroicons-link" class="h-6 w-6" />
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900 dark:text-white">LinkShort</h1>
              <p class="text-xs text-gray-500">Secure &amp; Type-Safe</p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <UButton
              v-if="!isAuthenticated"
              @click="showAuthModal = true"
              icon="i-heroicons-user"
              color="primary"
            >
              Login / Sign Up
            </UButton>
            
            <UButton
              v-else
              @click="showUserMenu = !showUserMenu"
              variant="ghost"
              color="neutral"
              :icon="showUserMenu ? 'i-heroicons-x-mark' : 'i-heroicons-user-circle'"
            >
              {{ currentUser?.displayName || currentUser?.email }}
            </UButton>
          </div>
        </div>

        <!-- User Menu Dropdown -->
        <div
          v-if="showUserMenu && isAuthenticated"
          class="border-t border-gray-200 dark:border-gray-800 py-3"
        >
          <UserCard :user="currentUser!" @logout="handleLogout" />
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <!-- Hero Section -->
      <div class="mb-12 text-center">
        <h2 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl mb-4">
          Shorten Your Links,
          <span class="bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text text-transparent">
            Track Everything
          </span>
        </h2>
        <p class="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Create secure, type-safe short links with built-in analytics. Powered by Effect Schema and Railway PostgreSQL.
        </p>
      </div>

      <!-- Create Link Section -->
      <UCard class="mb-8 max-w-3xl mx-auto shadow-xl">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-plus-circle" class="h-5 w-5 text-primary" />
            <h3 class="text-xl font-semibold">Create Short Link</h3>
          </div>
        </template>

        <form @submit.prevent="createLink" class="space-y-6">
          <!-- Auth Toggle -->
          <div v-if="!isAuthenticated" class="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4">
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-information-circle" class="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div class="flex-1">
                <p class="text-sm text-blue-700 dark:text-blue-300 mb-2">
                  You can create links without an account using the master password, or
                  <button
                    type="button"
                    @click="showAuthModal = true"
                    class="font-semibold underline hover:no-underline"
                  >
                    sign up for free
                  </button>
                  to track all your links!
                </p>
              </div>
            </div>
          </div>

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
              />
              <template #help>
                Letters, numbers, hyphens, underscores
              </template>
            </UFormGroup>

            <!-- Expiration Date -->
            <UFormGroup label="Expires At">
              <UInput
                v-model="form.expiresAt"
                type="datetime-local"
                :disabled="loading"
                icon="i-heroicons-clock"
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
          >
            {{ loading ? 'Creating...' : 'Create Short Link' }}
          </UButton>
        </form>

        <!-- Result Display -->
        <div v-if="result" class="mt-6 space-y-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div class="flex items-center gap-2 text-sm font-medium text-primary">
            <UIcon name="i-heroicons-check-circle" class="h-5 w-5" />
            <span>Link created successfully!</span>
          </div>
          
          <div class="flex items-center gap-2">
            <UInput
              :model-value="shortLinkUrl"
              readonly
              class="flex-1"
              size="lg"
            />
            <UButton
              @click="copyResult"
              size="lg"
              :icon="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard-document'"
              :color="copied ? 'success' : 'primary'"
            >
              {{ copied ? 'Copied!' : 'Copy' }}
            </UButton>
          </div>
          
          <div class="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>Created {{ new Date(result.createdAt).toLocaleString() }}</span>
            <a
              :href="shortLinkUrl"
              target="_blank"
              class="flex items-center gap-1 hover:text-primary"
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

      <!-- User's Links (if authenticated) -->
      <div v-if="isAuthenticated && userLinks.length > 0" class="max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-semibold text-gray-900 dark:text-white">Your Links</h3>
          <UBadge color="primary" variant="subtle" size="lg">
            {{ userLinks.length }} {{ userLinks.length === 1 ? 'link' : 'links' }}
          </UBadge>
        </div>
        
        <LinksGrid :links="userLinks" />
      </div>

      <!-- Features Grid -->
      <div class="mt-16 max-w-7xl mx-auto">
        <h3 class="text-2xl font-semibold text-center mb-8 text-gray-900 dark:text-white">
          Why Choose LinkShort?
        </h3>
        
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <UCard>
            <div class="flex flex-col items-center text-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <UIcon name="i-heroicons-shield-check" class="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h4 class="font-semibold">Type-Safe</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Built with Effect Schema for runtime validation and compile-time safety
              </p>
            </div>
          </UCard>

          <UCard>
            <div class="flex flex-col items-center text-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <UIcon name="i-heroicons-chart-bar" class="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 class="font-semibold">Analytics</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Track clicks, locations, referrers, and user agents in real-time
              </p>
            </div>
          </UCard>

          <UCard>
            <div class="flex flex-col items-center text-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                <UIcon name="i-heroicons-bolt" class="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 class="font-semibold">Powered by Railway</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                PostgreSQL + Hasura GraphQL for blazing-fast performance
              </p>
            </div>
          </UCard>

          <UCard>
            <div class="flex flex-col items-center text-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
                <UIcon name="i-heroicons-user-group" class="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h4 class="font-semibold">User Accounts</h4>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Create an account to manage and track all your shortened links
              </p>
            </div>
          </UCard>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="mt-16 border-t border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-950/50 backdrop-blur-sm">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Built with Nuxt, Effect Schema, and Railway
          </p>
          <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>Open Source</span>
            <span>•</span>
            <span>MIT License</span>
          </div>
        </div>
      </div>
    </footer>

    <!-- Auth Modal -->
    <AuthModal
      v-model="showAuthModal"
      @success="handleAuthSuccess"
    />
  </div>
</template>

<script lang="ts" setup>
import type { CreateShortLinkResponse } from "~/server/types/index.js";

const showAuthModal = ref(false);
const showUserMenu = ref(false);
const authToken = ref<string | null>(null);
const currentUser = ref<any>(null);
const userLinks = ref<any[]>([]);

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

const isAuthenticated = computed(() => !!authToken.value && !!currentUser.value);

const shortLinkUrl = computed(() => {
  if (!result.value) return "";
  const baseUrl = window?.location?.origin || "http://localhost:3000";
  return `${baseUrl}/${result.value.shortUrl}`;
});

// Load auth state from localStorage
onMounted(() => {
  if (process.client) {
    const token = localStorage.getItem('auth_token');
    if (token) {
      authToken.value = token;
      fetchCurrentUser();
    }
  }
});

async function fetchCurrentUser() {
  if (!authToken.value) return;

  try {
    const user = await $fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${authToken.value}`,
      },
    });
    
    currentUser.value = user;
    await fetchUserLinks();
  } catch (err) {
    // Token invalid, clear auth
    handleLogout();
  }
}

async function fetchUserLinks() {
  if (!authToken.value) return;

  try {
    // TODO: Implement user links endpoint
    // For now, we'll just show the links created in this session
    userLinks.value = [];
  } catch (err) {
    console.error('Failed to fetch user links:', err);
  }
}

function handleAuthSuccess(token: string) {
  authToken.value = token;
  if (process.client) {
    localStorage.setItem('auth_token', token);
  }
  fetchCurrentUser();
  showUserMenu.value = true;
}

function handleLogout() {
  authToken.value = null;
  currentUser.value = null;
  userLinks.value = [];
  showUserMenu.value = false;
  
  if (process.client) {
    localStorage.removeItem('auth_token');
  }
}

async function createLink() {
  loading.value = true;
  error.value = "";
  result.value = null;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add auth header if authenticated
    if (authToken.value) {
      headers.Authorization = `Bearer ${authToken.value}`;
    } else if (form.value.masterPassword) {
      headers['x-master-password'] = form.value.masterPassword;
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

    // Add to user links if authenticated
    if (isAuthenticated.value) {
      userLinks.value.unshift(response);
    }

    // Reset form
    form.value.originalUrl = "";
    form.value.customAlias = "";
    form.value.expiresAt = "";
  } catch (err: any) {
    error.value = err.data?.message || err.message || "Failed to create short link";
  } finally {
    loading.value = false;
  }
}

function copyResult() {
  copyToClipboard(shortLinkUrl.value);
}

useSeoMeta({
  title: "LinkShort - Secure Link Shortener",
  description: "Create secure, type-safe short links with built-in analytics. Powered by Effect Schema and Railway PostgreSQL.",
});
</script>