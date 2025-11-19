<!--
 Copyright 2025 Mike Odnis

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
-->

<template>
  <div
    v-if="showUpdatePrompt"
    class="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-in slide-in-from-top-5 duration-300"
  >
    <div class="bg-white border border-blue-200 rounded-xl shadow-lg p-4">
      <div class="flex items-start gap-3">
        <div class="shrink-0">
          <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 text-blue-600" />
          </div>
        </div>
        
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-gray-900 mb-1">Update Available</h3>
          <p class="text-sm text-gray-600 mb-3">
            A new version of Links is available. Refresh to get the latest updates.
          </p>
          
          <div class="flex gap-2">
            <UButton
              @click="update"
              size="sm"
              color="primary"
              class="rounded-lg"
            >
              Update Now
            </UButton>
            <UButton
              @click="dismiss"
              size="sm"
              color="neutral"
              variant="ghost"
              class="rounded-lg"
            >
              Later
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";

const showUpdatePrompt = ref(false);
let registration: ServiceWorkerRegistration | null = null;

onMounted(() => {
  if (process.client && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      registration = reg;
      
      // Check for updates periodically
      setInterval(() => {
        reg.update();
      }, 60000); // Check every minute
      
      // Listen for waiting service worker
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdatePrompt.value = true;
          }
        });
      });
    });

    // Also check on page load
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        showUpdatePrompt.value = true;
      }
    });
  }
});

function update() {
  if (registration?.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    
    // Reload after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 500);
  }
}

function dismiss() {
  showUpdatePrompt.value = false;
}
</script>
