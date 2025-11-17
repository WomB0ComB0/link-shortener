<script setup lang="ts">
const route = useRoute();

// Extract the code from the route params
const code = Array.isArray(route.params.all) 
  ? route.params.all[0] 
  : route.params.all;

// If we have a code, try to redirect via the API
if (code) {
  // Navigate to the API endpoint which will handle the redirect
  await navigateTo(`/api/${code}`, {
    external: true,
    redirectCode: 302
  });
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <h1 class="text-6xl font-bold text-primary mb-4">404</h1>
      <p class="text-xl text-muted-foreground mb-8">Page not found</p>
      <UButton to="/" color="primary">
        Go Home
      </UButton>
    </div>
  </div>
</template>