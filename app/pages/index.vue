<template>
  <div class="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
    <!-- Header -->
    <header class="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg">
              <UIcon name="i-heroicons-link" class="h-6 w-6" />
            </div>
            <div>
              <h1 class="text-lg font-bold text-foreground">LinkShort</h1>
              <p class="text-xs text-muted-foreground">Fast & Secure</p>
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
              color="primary"
              :icon="showUserMenu ? 'i-heroicons-x-mark' : 'i-heroicons-user-circle'"
            >
              {{ currentUser?.displayName || currentUser?.email }}
            </UButton>
          </div>
        </div>

        <!-- User Menu Dropdown -->
        <div
          v-if="showUserMenu && isAuthenticated"
          class="border-t border-border/50 py-3"
        >
          <UserCard :user="currentUser!" @logout="handleLogout" />
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <!-- Hero Section -->
      <div class="mb-16 text-center">
        <!-- Improved typography with better hierarchy and sizing -->
        <h2 class="text-5xl sm:text-6xl font-bold tracking-tight text-foreground mb-4 text-balance">
          Shorten Links,
          <span class="bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">
            Track Impact
          </span>
        </h2>
        <p class="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Create fast, secure short links with powerful analytics. Type-safe, reliable, and built for performance.
        </p>
      </div>

      <!-- Create Link Section -->
      <!-- Enhanced card styling with better shadow and spacing -->
      <UCard class="mb-12 max-w-3xl mx-auto shadow-xl border border-border/50">
        <template #header>
          <div class="flex items-center gap-3">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <UIcon name="i-heroicons-plus-circle" class="h-5 w-5 text-primary" />
            </div>
            <h3 class="text-xl font-semibold text-foreground">Create Short Link</h3>
          </div>
        </template>

        <form @submit.prevent="createLink" class="space-y-6">
          <!-- Auth Toggle -->
          <div v-if="!isAuthenticated" class="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <div class="flex items-start gap-3">
              <UIcon name="i-heroicons-information-circle" class="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div class="flex-1">
                <p class="text-sm text-foreground mb-2">
                  Use the master password or
                  <button
                    type="button"
                    @click="showAuthModal = true"
                    class="font-semibold text-primary hover:underline"
                  >
                    sign up for free
                  </button>
                  to track your links!
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
            class="font-semibold"
          >
            {{ loading ? 'Creating...' : 'Create Short Link' }}
          </UButton>
        </form>

        <!-- Result Display -->
        <!-- Improved success message styling -->
        <div v-if="result" class="mt-6 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div class="flex items-center gap-2 text-sm font-semibold text-primary">
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
          
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>Created {{ new Date(result.createdAt).toLocaleString() }}</span>
            <a
              :href="shortLinkUrl"
              target="_blank"
              class="flex items-center gap-1 text-primary hover:underline"
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
      <div v-if="isAuthenticated && userLinks.length > 0" class="max-w-7xl mx-auto mb-12">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-2xl font-bold text-foreground">Your Links</h3>
          <UBadge color="primary" variant="subtle" size="lg">
            {{ userLinks.length }} {{ userLinks.length === 1 ? 'link' : 'links' }}
          </UBadge>
        </div>
        
        <LinksGrid :links="userLinks" />
      </div>

      <!-- Features Grid -->
      <!-- Redesigned features section with better cards and typography -->
      <div class="mt-20 max-w-7xl mx-auto">
        <h3 class="text-3xl font-bold text-center mb-12 text-foreground">
          Why Choose LinkShort?
        </h3>
        
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <UCard class="border border-border/50 hover:border-primary/30 transition-colors">
            <div class="flex flex-col items-center text-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <UIcon name="i-heroicons-shield-check" class="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 class="font-semibold text-foreground mb-2">Type-Safe</h4>
                <p class="text-sm text-muted-foreground">
                  Built with Effect Schema for runtime validation
                </p>
              </div>
            </div>
          </UCard>

          <UCard class="border border-border/50 hover:border-primary/30 transition-colors">
            <div class="flex flex-col items-center text-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <UIcon name="i-heroicons-chart-bar" class="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 class="font-semibold text-foreground mb-2">Real-time Analytics</h4>
                <p class="text-sm text-muted-foreground">
                  Track clicks, locations, and referrers instantly
                </p>
              </div>
            </div>
          </UCard>

          <UCard class="border border-border/50 hover:border-primary/30 transition-colors">
            <div class="flex flex-col items-center text-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <UIcon name="i-heroicons-bolt" class="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 class="font-semibold text-foreground mb-2">Lightning Fast</h4>
                <p class="text-sm text-muted-foreground">
                  PostgreSQL + GraphQL for blazing performance
                </p>
              </div>
            </div>
          </UCard>

          <UCard class="border border-border/50 hover:border-primary/30 transition-colors">
            <div class="flex flex-col items-center text-center gap-4">
              <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <UIcon name="i-heroicons-user-group" class="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 class="font-semibold text-foreground mb-2">User Accounts</h4>
                <p class="text-sm text-muted-foreground">
                  Manage and track all your shortened links
                </p>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <!-- Refined footer styling -->
    <footer class="mt-20 border-t border-border/50 bg-background/50">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>Built with Nuxt, Effect Schema, and Railway</p>
          <div class="flex items-center gap-4">
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
import { computed, onMounted, ref } from "vue";
import type { CreateShortLinkResponse } from "../../server/schemas";
import { useCopyToClipboard } from "../composables";

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

const isAuthenticated = computed(
	() => !!authToken.value && !!currentUser.value,
);

const shortLinkUrl = computed(() => {
	if (!result.value) return "";
	const baseUrl = window?.location?.origin || "http://localhost:3000";
	return `${baseUrl}/${result.value.shortUrl}`;
});

// Load auth state from localStorage
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
		console.error("Failed to fetch user links:", err);
	}
}

function handleAuthSuccess(token: string) {
	authToken.value = token;
	if (process.client) {
		localStorage.setItem("auth_token", token);
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

		// Add auth header if authenticated
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

		// Add to user links if authenticated
		if (isAuthenticated.value) {
			userLinks.value.unshift(response);
		}

		// Reset form
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
	description:
		"Create fast, secure short links with powerful analytics. Type-safe, reliable, and built for performance.",
});
</script>
