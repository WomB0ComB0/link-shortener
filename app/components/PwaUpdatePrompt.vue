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
		class="fixed top-4 right-4 left-4 z-50 sm:left-auto sm:max-w-md"
	>
		<div class="rounded-tile border border-hairline bg-surface-2 p-4 shadow-raised">
			<div class="flex items-start gap-3">
				<div
					class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-hairline bg-info-tint text-info"
				>
					<UIcon name="i-heroicons-arrow-path" class="size-5" aria-hidden="true" />
				</div>

				<div class="min-w-0 flex-1">
					<h3 class="tile-title text-foreground">Update available</h3>
					<p class="mt-1 tile-sub text-muted-foreground">
						A new version of Links is ready. Refresh to load the latest build.
					</p>

					<div class="mt-3 flex gap-2">
						<button
							type="button"
							class="console-btn console-btn-primary h-8 px-3 text-xs"
							@click="update"
						>
							Update Now
						</button>
						<button
							type="button"
							class="console-btn console-btn-ghost h-8 px-3 text-xs"
							@click="dismiss"
						>
							Later
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";

const showUpdatePrompt = ref(false);
let registration: ServiceWorkerRegistration | null = null;

onMounted(() => {
	if (import.meta.client && "serviceWorker" in navigator) {
		navigator.serviceWorker.ready.then((reg) => {
			registration = reg;

			setInterval(() => {
				reg.update();
			}, 60000);

			reg.addEventListener("updatefound", () => {
				const newWorker = reg.installing;

				newWorker?.addEventListener("statechange", () => {
					if (
						newWorker.state === "installed" &&
						navigator.serviceWorker.controller
					) {
						showUpdatePrompt.value = true;
					}
				});
			});
		});

		navigator.serviceWorker.getRegistration().then((reg) => {
			if (reg?.waiting) {
				showUpdatePrompt.value = true;
			}
		});
	}
});

function update() {
	if (registration?.waiting) {
		registration.waiting.postMessage({ type: "SKIP_WAITING" });
		setTimeout(() => {
			window.location.reload();
		}, 500);
	}
}

function dismiss() {
	showUpdatePrompt.value = false;
}
</script>
