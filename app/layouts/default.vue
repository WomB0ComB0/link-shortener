<!--
 Copyright 2026 Mike Odnis

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
	<div class="light-glows relative isolate min-h-dvh overflow-x-clip bg-canvas">
		<LightRays />
		<a
			href="#main-content"
			class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:rounded-md focus:border focus:border-hairline-strong focus:bg-surface-2 focus:px-4 focus:py-2 focus:font-medium focus:text-foreground focus:shadow-raised focus:outline-2 focus:outline-offset-2 focus:outline-focus"
			@click.prevent="skipToMain"
		>
			Skip to content
		</a>
		<CommandPalette />
		<SpotlightRoot />

		<header class="fixed inset-y-0 left-0 z-40 hidden w-16 lg:block">
			<AppRail />
		</header>

		<div class="flex min-h-dvh flex-col pb-(--mobile-bar-total) lg:pb-0 lg:pl-16">
			<main
				id="main-content"
				tabindex="-1"
				class="relative mx-auto w-full max-w-shell flex-1 @container/page py-6 outline-none md:py-10"
			>
				<slot />
			</main>
			<AppFooter />
		</div>

		<EdgeHaze :path="route.path" />

		<div class="fixed inset-x-0 bottom-0 z-50 lg:hidden">
			<MobileNavBar />
		</div>
	</div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { useAuth } from "../composables/use-auth";

const route = useRoute();
const { syncFromStorage } = useAuth();

function skipToMain(): void {
	const main = document.getElementById("main-content");
	main?.focus({ preventScroll: false });
	main?.scrollIntoView();
}

onMounted(() => {
	syncFromStorage();
});
</script>
