<template>
  <div class="min-h-screen bg-white flex items-center justify-center px-4">
    <div class="max-w-md w-full text-center">
      <!-- Offline Icon -->
      <div class="mb-8">
        <div class="w-24 h-24 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
          <UIcon name="i-heroicons-wifi" class="h-12 w-12 text-gray-400" />
        </div>
      </div>

      <!-- Heading -->
      <h1 class="text-3xl font-bold text-gray-900 mb-4">You're Offline</h1>
      
      <!-- Description -->
      <p class="text-gray-600 mb-8">
        It looks like you've lost your internet connection. Some features may not be available until you're back online.
      </p>

      <!-- Actions -->
      <div class="space-y-3">
        <UButton
          @click="reload"
          block
          size="lg"
          icon="i-heroicons-arrow-path"
          class="rounded-lg"
          style="background: var(--primary); color: var(--primary-foreground);"
        >
          Try Again
        </UButton>

        <UButton
          @click="goHome"
          block
          size="lg"
          color="neutral"
          variant="soft"
          icon="i-heroicons-home"
          class="rounded-lg"
        >
          Go Home
        </UButton>
      </div>

      <!-- Info -->
      <div class="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div class="flex items-start gap-3">
          <UIcon name="i-heroicons-information-circle" class="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <p class="text-sm text-blue-900 text-left">
            <strong>Offline Mode:</strong> You can still view previously loaded content while offline. Your internet connection will be restored automatically when available.
          </p>
        </div>
      </div>

      <!-- Status -->
      <div class="mt-6">
        <div class="flex items-center justify-center gap-2 text-sm text-gray-500">
          <div
            class="w-2 h-2 rounded-full"
            :class="isOnline ? 'bg-green-500' : 'bg-red-500'"
          />
          <span>{{ isOnline ? 'Online' : 'Offline' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from "vue";

const router = useRouter();
const isOnline = ref(true);

function updateOnlineStatus() {
  isOnline.value = navigator.onLine;
  
  if (isOnline.value) {
    // Auto-redirect to home when back online
    setTimeout(() => {
      router.push("/");
    }, 1000);
  }
}

function reload() {
  window.location.reload();
}

function goHome() {
  router.push("/");
}

onMounted(() => {
  if (process.client) {
    isOnline.value = navigator.onLine;
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
  }
});

onUnmounted(() => {
  if (process.client) {
    window.removeEventListener("online", updateOnlineStatus);
    window.removeEventListener("offline", updateOnlineStatus);
  }
});

useSeoMeta({
  title: "Offline - Links",
  description: "You are currently offline",
  robots: "noindex,nofollow",
});
</script>
