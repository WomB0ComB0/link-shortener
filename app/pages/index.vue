<template>
  <div class="min-h-screen bg-white">
    <!-- Header -->
    <AppHeader>
      <template #nav>
        <NuxtLink to="/create" class="mr-2">
          <UButton
            icon="i-heroicons-plus"
            color="primary"
            variant="soft"
            class="rounded-lg"
          >
            Create Link
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

    <main class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
      <!-- Links grid section -->
        <LinksGrid :links="publicLinks" />
    </main>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useFetcher } from "../composables";

const { get: fetchGet } = useFetcher();

const authToken = ref<string | null>(null);
const currentUser = ref<any>(null);
const publicLinks = ref<any[]>([]);

const isAuthenticated = computed(
	() => !!authToken.value && !!currentUser.value,
);

onMounted(() => {
	if (process.client) {
		const token = localStorage.getItem("auth_token");
		if (token) {
			authToken.value = token;
			fetchCurrentUser();
		}
	}
	fetchPublicLinks();
});

async function fetchPublicLinks() {
	try {
		const links = await fetchGet(
			"/api/links/public",
			{
				retries: 2,
				timeout: 10000,
				onError: (error) => {
					console.error("Failed to fetch public links:", error);
				},
			},
			{ limit: 12 },
		);
		publicLinks.value = Array.isArray(links) ? links : [];
	} catch (err) {
		console.error("Failed to fetch public links:", err);
		publicLinks.value = [];
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

useSeoMeta({
	title: "Links - URL Shortener",
	description: "Create fast, secure short links with powerful analytics.",
});
</script>
