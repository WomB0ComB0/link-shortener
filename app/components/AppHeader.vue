<template>
  <header class="border-b border-gray-200 bg-white/95 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between gap-4">
        <NuxtLink to="/" class="flex items-center gap-2 shrink-0">
          <div class="h-8 w-8 rounded-md flex justify-center items-center" style="background: var(--primary)">
            <img src="/assets/images/logo.png" alt="Link Shortener" class="h-6 w-auto" />
          </div>
          <h1 class="text-lg font-bold text-gray-900 hidden sm:block">Links</h1>
        </NuxtLink>
        <nav class="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
          <slot name="nav" />
        </nav>
      </div>
    </div>
  </header>
</template>