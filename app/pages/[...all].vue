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
// Single-segment short codes are redirected directly in a single hop by
// `server/middleware/02-shortlink-redirect.ts` before Vue SSR runs.
// Any request reaching this catch-all page is a genuine 404.
</script>

<template>
	<section
		aria-labelledby="not-found-title"
		class="mx-auto flex w-full max-w-xl flex-col items-center gap-8 px-6 py-20 text-center sm:py-28"
	>
		<div class="flex flex-col items-center">
			<p
				aria-hidden="true"
				class="select-none bg-linear-to-b from-primary/70 via-primary/25 to-transparent bg-clip-text text-[clamp(6rem,3rem+14vw,10rem)] leading-none font-black tracking-tighter text-transparent tabular-nums"
			>
				404
			</p>
			<h1
				id="not-found-title"
				class="-mt-4 text-3xl text-foreground sm:-mt-6 sm:text-4xl"
			>
				Page not found
			</h1>
			<p class="mt-3 text-muted-foreground">
				This short link doesn't exist, expired, or moved.
			</p>
		</div>

		<div class="flex flex-wrap justify-center gap-3">
			<NuxtLink to="/" class="console-btn console-btn-primary h-10 px-6">
				<UIcon name="i-heroicons-home" class="size-4 shrink-0" aria-hidden="true" />
				<span>Home</span>
			</NuxtLink>
			<NuxtLink to="/create" class="console-btn console-btn-outline h-10 px-6">
				<UIcon name="i-heroicons-plus" class="size-4 shrink-0" aria-hidden="true" />
				<span>Create Link</span>
			</NuxtLink>
		</div>

		<p class="text-body-sm text-muted-foreground">
			Press
			<kbd class="rounded border border-hairline bg-surface-3 px-1.5 py-0.5 font-mono text-label text-foreground">⌘K</kbd>
			(<kbd class="rounded border border-hairline bg-surface-3 px-1.5 py-0.5 font-mono text-label text-foreground">Ctrl K</kbd> on Windows and Linux) to search
		</p>
	</section>
</template>
