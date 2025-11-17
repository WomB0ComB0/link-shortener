<template>
  <div class="min-h-screen        </template>
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
    </AppHeader>   <!-- Header -->
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
            color="gray"
            class="rounded-lg"
            icon="i-heroicons-arrow-left-on-rectangle"
          >
            Logout
          </UButton>
        </template>
      </template>
    </AppHeader>

    <main class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <!-- Hero section -->
      <div class="mb-16 text-center">
        <h1 class="text-5xl md:text-6xl font-bold text-gray-900 mb-4 text-balance">
          Share links, <span class="text-blue-600">shortened</span>
        </h1>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto text-balance mb-8">
          Create fast, secure short links with powerful analytics. Perfect for sharing on social media, messaging, and more.
        </p>
        <NuxtLink to="/create">
          <UButton
            size="lg"
            class="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8"
            icon="i-heroicons-sparkles"
          >
            Get Started
          </UButton>
        </NuxtLink>
      </div>

      <!-- Links grid section -->
      <div>
        <div class="mb-8">
          <h2 class="text-3xl font-bold text-gray-900 mb-2">Recent Links</h2>
          <p class="text-gray-600">Browse the latest short links created on LinkShort</p>
        </div>
        <LinksGrid :links="publicLinks" />
      </div>
    </main>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from "vue";
import AppHeader from "~/components/AppHeader.vue";
import LinksGrid from "~/components/LinksGrid.vue";

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
    const links = await $fetch("/api/links/public");
    publicLinks.value = links || [];
  } catch (err) {
    console.error("Failed to fetch public links:", err);
  }
}

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

function handleLogout() {
  authToken.value = null;
  currentUser.value = null;

  if (process.client) {
    localStorage.removeItem("auth_token");
  }
}

useSeoMeta({
  title: "LinkShort - Secure Link Shortener",
  description: "Create fast, secure short links with powerful analytics.",
});
</script>
