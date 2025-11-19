<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <PwaInstallPrompt />
    <PwaUpdatePrompt />
  </div>
</template>

<script setup lang="ts">
// PWA reload prompt
if (process.client) {
  const updateSW = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
  };

  // Listen for updates
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    window.location.reload();
  });
}
</script>
