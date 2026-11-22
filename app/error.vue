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

<script setup lang="ts">
import type { NuxtError } from "nuxt/app";

const props = defineProps<{
	error: NuxtError;
}>();

const is404 = computed(() => props.error?.statusCode === 404);

function handleHome() {
	clearError({ redirect: "/" });
}

function handleRetry() {
	clearError();
}

useSeoMeta({
	title: is404.value ? "404 - Page not found" : "Something went wrong",
	description: "We are sorry, this page could not be loaded.",
});

useHead({
	htmlAttrs: {
		lang: "en",
		class: "dark",
	},
});
</script>

<template>
	<UApp>
		<div class="light-glows relative isolate flex min-h-dvh flex-col overflow-x-clip bg-canvas">
			<LightRays />
			<main class="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-8 px-6 py-20 text-center">
				<template v-if="is404">
					<div class="flex flex-col items-center">
						<p
							aria-hidden="true"
							class="select-none bg-linear-to-b from-primary/70 via-primary/25 to-transparent bg-clip-text text-[clamp(6rem,3rem+14vw,10rem)] leading-none font-black tracking-tighter text-transparent tabular-nums"
						>
							404
						</p>
						<h1 class="-mt-4 text-3xl text-foreground sm:-mt-6 sm:text-4xl">
							Page not found
						</h1>
						<p class="mt-3 text-muted-foreground">
							This page doesn't exist, or it moved.
						</p>
					</div>
				</template>

				<template v-else>
					<div class="flex flex-col items-center gap-3">
						<span
							aria-hidden="true"
							class="mb-2 grid size-14 place-items-center rounded-2xl border border-hairline bg-surface-1 text-muted-foreground shadow-tile"
						>
							<UIcon name="i-heroicons-exclamation-triangle" class="size-6" />
						</span>
						<h1 class="text-3xl text-foreground sm:text-4xl">
							Something went wrong
						</h1>
						<p class="text-muted-foreground">
							{{ error?.statusMessage || "This page didn't load, but the rest of the site still works." }}
						</p>
					</div>
				</template>

				<div class="flex flex-wrap justify-center gap-3">
					<button
						type="button"
						class="console-btn console-btn-primary h-10 px-6"
						@click="handleHome"
					>
						<UIcon name="i-heroicons-home" class="size-4 shrink-0" aria-hidden="true" />
						<span>Home</span>
					</button>
					<button
						v-if="!is404"
						type="button"
						class="console-btn console-btn-outline h-10 px-6"
						@click="handleRetry"
					>
						<UIcon name="i-heroicons-arrow-path" class="size-4 shrink-0" aria-hidden="true" />
						<span>Try again</span>
					</button>
				</div>

				<p v-if="error?.statusCode && !is404" class="mono-token text-faint">
					Error {{ error.statusCode }}
				</p>
			</main>
		</div>
	</UApp>
</template>
