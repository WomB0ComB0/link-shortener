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
	<div class="flex flex-1 items-center justify-center px-(--page-gutter) py-12 md:py-20">
		<section
			aria-labelledby="offline-title"
			class="w-full max-w-md rounded-tile border border-hairline bg-surface-1 p-6 text-center shadow-raised sm:p-8"
		>
			<div
				class="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border border-hairline bg-surface-2 text-muted-foreground"
			>
				<UIcon name="i-heroicons-wifi" class="size-7" aria-hidden="true" />
			</div>

			<h1 id="offline-title" class="page-title text-foreground">You're Offline</h1>

			<p class="mt-3 text-body-sm text-muted-foreground">
				It looks like you've lost your internet connection. Some features may not be available until you're back online.
			</p>

			<div class="mt-6 flex flex-col gap-2.5">
				<button
					type="button"
					class="console-btn console-btn-primary h-10 w-full"
					@click="reload"
				>
					<UIcon name="i-heroicons-arrow-path" class="size-4 shrink-0" aria-hidden="true" />
					<span>Try Again</span>
				</button>

				<button
					type="button"
					class="console-btn console-btn-outline h-10 w-full"
					@click="goHome"
				>
					<UIcon name="i-heroicons-home" class="size-4 shrink-0" aria-hidden="true" />
					<span>Go Home</span>
				</button>
			</div>

			<div
				class="mt-6 flex items-start gap-2.5 rounded-lg border border-info/25 bg-info-tint p-3.5 text-left text-body-sm text-info"
			>
				<UIcon
					name="i-heroicons-information-circle"
					class="mt-0.5 size-4 shrink-0"
					aria-hidden="true"
				/>
				<p class="m-0 leading-relaxed text-info">
					<strong>Offline Mode:</strong> Previously loaded content remains available while offline. Connection will restore automatically.
				</p>
			</div>

			<div class="mt-6 flex items-center justify-center gap-2 tile-meta text-muted-foreground">
				<StatusDot :tone="isOnline ? 'live' : 'down'" :pulse="isOnline" />
				<span>{{ isOnline ? "Online" : "Offline" }}</span>
			</div>
		</section>
	</div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref } from "vue";

const router = useRouter();
const isOnline = ref(true);

function updateOnlineStatus() {
	isOnline.value = navigator.onLine;

	if (isOnline.value) {
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
	if (import.meta.client) {
		isOnline.value = navigator.onLine;
		window.addEventListener("online", updateOnlineStatus);
		window.addEventListener("offline", updateOnlineStatus);
	}
});

onUnmounted(() => {
	if (import.meta.client) {
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
