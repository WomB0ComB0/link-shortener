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
    v-if="showInstallPrompt"
    class="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300"
  >
    <div class="bg-white border border-purple-200 rounded-xl shadow-lg p-4 sm:p-5">
      <div class="flex items-start gap-3">
        <div class="shrink-0">
          <div class="w-12 h-12 rounded-xl bg-linear-to-br from-purple-500 to-purple-600 flex items-center justify-center">
            <UIcon name="i-heroicons-arrow-down-tray" class="h-6 w-6 text-white" />
          </div>
        </div>
        
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-gray-900 mb-1">Install Links App</h3>
          <p class="text-sm text-gray-600 mb-3">
            Install Links on your device for quick access and offline support.
          </p>
          
          <div class="flex gap-2">
            <UButton
              @click="install"
              size="sm"
              class="rounded-lg"
              style="background: var(--primary); color: var(--primary-foreground);"
            >
              Install
            </UButton>
            <UButton
              @click="dismiss"
              size="sm"
              color="neutral"
              variant="ghost"
              class="rounded-lg"
            >
              Not now
            </UButton>
          </div>
        </div>
        
        <button
          @click="dismissPermanently"
          class="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue";

const showInstallPrompt = ref(false);
let deferredPrompt: any = null;

onMounted(() => {
  if (process.client) {
    // Check if already dismissed permanently
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) return;

    // Listen for the beforeinstallprompt event
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Show the prompt after a short delay
      setTimeout(() => {
        showInstallPrompt.value = true;
      }, 3000);
    });

    // Listen for successful installation
    window.addEventListener("appinstalled", () => {
      showInstallPrompt.value = false;
      deferredPrompt = null;
    });
  }
});

async function install() {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === "accepted") {
    console.log("PWA installed");
  }

  deferredPrompt = null;
  showInstallPrompt.value = false;
}

function dismiss() {
  showInstallPrompt.value = false;
}

function dismissPermanently() {
  if (process.client) {
    localStorage.setItem("pwa-install-dismissed", "true");
  }
  showInstallPrompt.value = false;
}
</script>
