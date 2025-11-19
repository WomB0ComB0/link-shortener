<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <AppHeader>
      <template #nav>
        <NuxtLink to="/">
          <UButton
            icon="i-heroicons-home"
            color="neutral"
            variant="soft"
            class="rounded-lg"
          >
            Home
          </UButton>
        </NuxtLink>
        <NuxtLink to="/create" class="mx-2">
          <UButton
            icon="i-heroicons-plus"
            color="primary"
            variant="soft"
            class="rounded-lg"
          >
            Create Link
          </UButton>
        </NuxtLink>
        <NuxtLink to="/keys" class="mx-2">
          <UButton
            icon="i-heroicons-key"
            color="neutral"
            variant="soft"
            class="rounded-lg"
          >
            API Keys
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
    </AppHeader>

    <main class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <!-- Dashboard header -->
      <div class="mb-8 sm:mb-12">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">Your Links</h1>
            <p class="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Manage and track all your shortened links</p>
          </div>
          <UBadge color="primary" variant="soft" size="lg" class="rounded-full shrink-0">
            {{ userLinks.length }} {{ userLinks.length === 1 ? 'link' : 'links' }}
          </UBadge>
        </div>

        <!-- Links Grid -->
        <LinksGrid v-if="userLinks.length > 0" :links="userLinks" :show-analytics="true" />

        <!-- Empty State -->
        <div v-else class="text-center py-16">
          <UIcon name="i-heroicons-link-slash" class="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 class="text-lg font-semibold text-gray-900 mb-2">No links yet</h3>
          <p class="text-gray-600 mb-6">Create your first short link to get started</p>
          <NuxtLink to="/create">
            <UButton
              icon="i-heroicons-plus"
              color="primary"
              class="rounded-lg"
            >
              Create Link
            </UButton>
          </NuxtLink>
        </div>
      </div>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useFetcher } from "../composables";

const { get: fetchGet } = useFetcher();
const router = useRouter();
const authToken = ref<string | null>(null);
const userLinks = ref<any[]>([]);

onMounted(() => {
	if (process.client) {
		const token = localStorage.getItem("auth_token");
		if (token) {
			authToken.value = token;
			fetchUserLinks();
		} else {
			router.push("/auth");
		}
	}
});

async function fetchUserLinks() {
	if (!authToken.value) return;

	try {
		const links = await fetchGet("/api/links/me", {
			headers: {
				Authorization: `Bearer ${authToken.value}`,
			},
			retries: 2,
			timeout: 10000,
		});
		userLinks.value = Array.isArray(links) ? links : [];
	} catch (err) {
		console.error("Failed to fetch user links:", err);
		handleLogout();
	}
}

function handleLogout() {
	authToken.value = null;
	userLinks.value = [];

	if (process.client) {
		localStorage.removeItem("auth_token");
	}

	router.push("/");
}

useSeoMeta({
	title: "Dashboard",
	description: "Manage your short links and view analytics.",
});
</script>
