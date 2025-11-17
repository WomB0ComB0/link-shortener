<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <AppHeader>
      <template #nav>
        <NuxtLink to="/">
          <UButton
            icon="i-heroicons-home"
            color="gray"
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
    </AppHeader>

    <main class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <!-- Dashboard header -->
      <div class="mb-12">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-4xl font-bold text-gray-900">Your Links</h1>
            <p class="text-gray-600 mt-2">Manage and track all your shortened links</p>
          </div>
          <UBadge color="primary" variant="soft" size="lg" class="rounded-full">
            {{ userLinks.length }} {{ userLinks.length === 1 ? 'link' : 'links' }}
          </UBadge>
        </div>

        <!-- Links Grid -->
        <LinksGrid v-if="userLinks.length > 0" :links="userLinks" />

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
import AppHeader from "~/components/AppHeader.vue";
import LinksGrid from "~/components/LinksGrid.vue";

const authToken = ref<string | null>(null);
const userLinks = ref<any[]>([]);
const loading = ref(false);

onMounted(() => {
  if (process.client) {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      navigateTo("/");
      return;
    }
    authToken.value = token;
    fetchUserLinks();
  }
});

async function fetchUserLinks() {
  if (!authToken.value) return;
  loading.value = true;

  try {
    // TODO: Implement user links endpoint
    userLinks.value = [];
  } catch (err) {
    console.error("Failed to fetch user links:", err);
  } finally {
    loading.value = false;
  }
}

function handleLogout() {
  localStorage.removeItem("auth_token");
  navigateTo("/");
}

useSeoMeta({
  title: "Dashboard - LinkShort",
  description: "Manage your shortened links and analytics",
});
</script>
