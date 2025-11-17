<template>
  <header class="border-b border-gray-200 bg-white/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 text-white shadow-md">
            <UIcon name="i-heroicons-link" class="h-6 w-6" />
          </div>
          <h1 class="text-lg font-bold text-gray-900">LinkShort</h1>
        </NuxtLink>

        <!-- Navigation -->
        <nav class="flex items-center gap-2">
          <slot name="nav" />
        </nav>
      </div>
    </div>
  </header>
</template>
