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
		class="fixed right-4 bottom-[calc(var(--mobile-bar-total)+1rem)] left-4 z-50 sm:left-auto sm:max-w-md lg:bottom-4"
	>
		<div
			class="rounded-tile border border-hairline bg-surface-2 p-4 shadow-raised sm:p-5"
		>
			<div class="flex items-start gap-3">
				<div
					class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-hairline bg-brand-subtle text-brand-ink"
				>
					<UIcon name="i-heroicons-arrow-down-tray" class="size-5" aria-hidden="true" />
				</div>

				<div class="min-w-0 flex-1">
					<h3 class="tile-title text-foreground">Install Links</h3>
					<p class="mt-1 tile-sub text-muted-foreground">
						Install Links on your device for quick access and offline support.
					</p>

					<div class="mt-3 flex gap-2">
						<button
							type="button"
							class="console-btn console-btn-primary h-8 px-3 text-xs"
							@click="install"
						>
							Install
						</button>
						<button
							type="button"
							class="console-btn console-btn-ghost h-8 px-3 text-xs"
							@click="dismiss"
						>
							Not now
						</button>
					</div>
				</div>

				<button
					type="button"
					class="shrink-0 cursor-pointer rounded-md p-1 text-faint transition-colors hover:bg-surface-3 hover:text-foreground"
					aria-label="Dismiss install prompt"
					@click="dismissPermanently"
				>
					<UIcon name="i-heroicons-x-mark" class="size-4" aria-hidden="true" />
				</button>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";

const showInstallPrompt = ref(false);
let deferredPrompt: any = null;

onMounted(() => {
	if (import.meta.client) {
		const dismissed = localStorage.getItem("pwa-install-dismissed");
		if (dismissed) return;

		window.addEventListener("beforeinstallprompt", (e) => {
			e.preventDefault();
			deferredPrompt = e;

			setTimeout(() => {
				showInstallPrompt.value = true;
			}, 3000);
		});

		window.addEventListener("appinstalled", () => {
			showInstallPrompt.value = false;
			deferredPrompt = null;
		});
	}
});

async function install() {
	if (!deferredPrompt) return;

	deferredPrompt.prompt();
	await deferredPrompt.userChoice;

	deferredPrompt = null;
	showInstallPrompt.value = false;
}

function dismiss() {
	showInstallPrompt.value = false;
}

function dismissPermanently() {
	if (import.meta.client) {
		localStorage.setItem("pwa-install-dismissed", "true");
	}
	showInstallPrompt.value = false;
}
</script>
