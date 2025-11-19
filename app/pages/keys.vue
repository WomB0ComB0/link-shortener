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
        <NuxtLink to="/dashboard" class="mx-2">
          <UButton
            icon="i-heroicons-link"
            color="neutral"
            variant="soft"
            class="rounded-lg"
          >
            My Links
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

    <main class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <ApiKeys />
    </main>
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from "vue";

const router = useRouter();

onMounted(() => {
	if (process.client) {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			router.push("/auth");
		}
	}
});

function handleLogout() {
	if (process.client) {
		localStorage.removeItem("auth_token");
	}
	router.push("/");
}

useSeoMeta({
	title: "API Keys",
	description: "Manage your API keys for programmatic access",
});
</script>
