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
	<nav
		class="flex h-(--mobile-bar-total) items-center border-t border-hairline bg-canvas/85 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
		aria-label="Mobile navigation"
	>
		<div class="mx-auto flex w-full max-w-md items-center gap-2">
			<button
				ref="triggerRef"
				type="button"
				class="inline-flex h-11 flex-1 cursor-pointer items-center justify-between rounded-full border border-hairline bg-surface-2 px-5 text-body-sm font-medium text-foreground transition-colors duration-(--motion-fast) ease-standard hover:border-hairline-strong hover:bg-surface-3"
				aria-label="Open navigation menu"
				aria-haspopup="dialog"
				:aria-expanded="isOpen"
				aria-controls="mobile-menu-dialog"
				@click="isOpen = true"
			>
				<UIcon name="i-heroicons-bars-3" class="size-[1.125rem] shrink-0" aria-hidden="true" />
				<span>Menu</span>
			</button>

			<button
				type="button"
				:aria-label="PALETTE_SEARCH_LABEL"
				:aria-keyshortcuts="shortcut.keys"
				class="inline-flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-hairline bg-surface-2 px-3 text-foreground transition-colors duration-(--motion-fast) ease-standard hover:border-hairline-strong hover:bg-surface-3"
				@click="togglePalette"
			>
				<UIcon name="i-heroicons-magnifying-glass" class="size-4 shrink-0" aria-hidden="true" />
				<kbd class="font-mono text-meta text-muted-foreground pointer-coarse:hidden">
					{{ shortcut.label }}
				</kbd>
			</button>
		</div>
	</nav>

	<Teleport to="body">
		<div v-if="isOpen">
			<div
				class="fixed inset-0 z-9998 bg-canvas/70 backdrop-blur-sm"
				@click="closeMenu"
			/>

			<div
				id="mobile-menu-dialog"
				ref="dialogRef"
				role="dialog"
				aria-modal="true"
				aria-labelledby="mobile-menu-title"
				class="fixed inset-x-0 bottom-0 z-9999 max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-tile border-t border-hairline bg-surface-1 pb-[env(safe-area-inset-bottom)] shadow-raised"
				@click.stop
			>
				<div
					class="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-surface-1/90 py-3 pr-3 pl-6 backdrop-blur-md"
				>
					<h2 id="mobile-menu-title" class="text-body font-semibold text-foreground">
						Site menu
					</h2>
					<button
						type="button"
						class="inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-hairline bg-surface-2 text-muted-foreground transition-colors duration-(--motion-fast) ease-standard hover:bg-surface-3 hover:text-foreground"
						aria-label="Close menu"
						@click="closeMenu"
					>
						<UIcon name="i-heroicons-x-mark" class="size-[1.125rem]" aria-hidden="true" />
					</button>
				</div>

				<nav class="px-3 pt-3 pb-6" aria-label="Site pages">
					<div class="pb-2">
						<h3 class="label-mono px-3 pb-1.5 text-faint">Console</h3>
						<ul class="grid gap-1 sm:grid-cols-2">
							<li>
								<NuxtLink
									to="/"
									:aria-current="isCurrent('/') ? 'page' : undefined"
									:class="[MENU_ITEM, isCurrent('/') ? MENU_ITEM_CURRENT : MENU_ITEM_IDLE]"
									@click="closeMenu"
								>
									<UIcon name="i-heroicons-home" class="size-4 shrink-0" aria-hidden="true" />
									<span>Home</span>
								</NuxtLink>
							</li>
							<li>
								<NuxtLink
									to="/create"
									:aria-current="isCurrent('/create') ? 'page' : undefined"
									:class="[MENU_ITEM, isCurrent('/create') ? MENU_ITEM_CURRENT : MENU_ITEM_IDLE]"
									@click="closeMenu"
								>
									<UIcon name="i-heroicons-plus-circle" class="size-4 shrink-0" aria-hidden="true" />
									<span>Shorten URL</span>
								</NuxtLink>
							</li>
							<template v-if="isAuthenticated">
								<li>
									<NuxtLink
										to="/dashboard"
										:aria-current="isCurrent('/dashboard') ? 'page' : undefined"
										:class="[MENU_ITEM, isCurrent('/dashboard') ? MENU_ITEM_CURRENT : MENU_ITEM_IDLE]"
										@click="closeMenu"
									>
										<UIcon name="i-heroicons-chart-bar" class="size-4 shrink-0" aria-hidden="true" />
										<span>Dashboard</span>
									</NuxtLink>
								</li>
								<li>
									<NuxtLink
										to="/keys"
										:aria-current="isCurrent('/keys') ? 'page' : undefined"
										:class="[MENU_ITEM, isCurrent('/keys') ? MENU_ITEM_CURRENT : MENU_ITEM_IDLE]"
										@click="closeMenu"
									>
										<UIcon name="i-heroicons-key" class="size-4 shrink-0" aria-hidden="true" />
										<span>API Keys</span>
									</NuxtLink>
								</li>
								<li class="sm:col-span-2">
									<button
										type="button"
										:class="[MENU_ITEM, MENU_ITEM_IDLE, 'cursor-pointer']"
										@click="handleSignOut"
									>
										<UIcon
											name="i-heroicons-arrow-left-on-rectangle"
											class="size-4 shrink-0"
											aria-hidden="true"
										/>
										<span>Sign out</span>
									</button>
								</li>
							</template>
							<li v-else>
								<NuxtLink
									to="/auth"
									:aria-current="isCurrent('/auth') ? 'page' : undefined"
									:class="[MENU_ITEM, isCurrent('/auth') ? MENU_ITEM_CURRENT : MENU_ITEM_IDLE]"
									@click="closeMenu"
								>
									<UIcon name="i-heroicons-user" class="size-4 shrink-0" aria-hidden="true" />
									<span>Sign in</span>
								</NuxtLink>
							</li>
						</ul>
					</div>

					<div class="border-t border-hairline pt-4">
						<h3 class="label-mono px-3 pb-1.5 text-faint">*.mikeodnis.dev</h3>
						<ul class="grid gap-1 sm:grid-cols-2">
							<li v-for="site in networkSites" :key="site.id">
								<NuxtLink
									v-if="site.current"
									to="/"
									aria-current="page"
									:class="[MENU_ITEM, MENU_ITEM_CURRENT]"
									@click="closeMenu"
								>
									<UIcon :name="site.icon" class="size-4 shrink-0" aria-hidden="true" />
									<span class="flex-1 truncate">{{ site.name }}</span>
								</NuxtLink>
								<a
									v-else
									:href="site.url"
									target="_blank"
									rel="noopener noreferrer"
									:class="[MENU_ITEM, MENU_ITEM_IDLE]"
									@click="closeMenu"
								>
									<UIcon :name="site.icon" class="size-4 shrink-0 text-faint" aria-hidden="true" />
									<span class="flex-1 truncate">{{ site.name }}</span>
									<UIcon
										name="i-heroicons-arrow-up-right"
										class="size-3.5 shrink-0 text-faint"
										aria-hidden="true"
									/>
								</a>
							</li>
						</ul>
					</div>

					<div class="mt-4 border-t border-hairline pt-4">
						<h3 class="label-mono px-3 pb-1.5 text-faint">Ventures</h3>
						<ul class="grid gap-1 sm:grid-cols-2">
							<li v-for="site in ventureSites" :key="site.id">
								<a
									:href="site.url"
									target="_blank"
									rel="noopener noreferrer"
									:class="[MENU_ITEM, MENU_ITEM_IDLE]"
									@click="closeMenu"
								>
									<UIcon :name="site.icon" class="size-4 shrink-0 text-faint" aria-hidden="true" />
									<span class="flex-1 truncate">{{ site.name }}</span>
									<UIcon
										name="i-heroicons-arrow-up-right"
										class="size-3.5 shrink-0 text-faint"
										aria-hidden="true"
									/>
								</a>
							</li>
						</ul>
					</div>

					<div class="mt-4 border-t border-hairline pt-3">
						<button
							type="button"
							:class="[MENU_ITEM, MENU_ITEM_IDLE, 'cursor-pointer']"
							aria-label="Open command menu"
							@click="openPaletteFromMenu"
						>
							<UIcon name="i-heroicons-command-line" class="size-4 shrink-0" aria-hidden="true" />
							<span>Command menu</span>
						</button>
					</div>
				</nav>
			</div>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
	PALETTE_SEARCH_LABEL,
	useAuth,
	useCommandPalette,
} from "../composables";
import { ECOSYSTEM_LINKS } from "../constants/app";

const route = useRoute();
const router = useRouter();
const { isAuthenticated, logout } = useAuth();
const { shortcut, toggle: togglePalette } = useCommandPalette();

const networkSites = ECOSYSTEM_LINKS.filter((s) => s.group === "network");
const ventureSites = ECOSYSTEM_LINKS.filter((s) => s.group === "ventures");

const isOpen = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const dialogRef = ref<HTMLDivElement | null>(null);

const MENU_ITEM =
	"flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-body-sm transition-colors duration-(--motion-fast) ease-standard";
const MENU_ITEM_IDLE = "text-foreground hover:bg-surface-3";
const MENU_ITEM_CURRENT = "bg-brand-subtle font-medium text-brand-ink";

function isCurrent(slug: string): boolean {
	if (slug === "/") return route.path === "/";
	return route.path === slug || route.path.startsWith(`${slug}/`);
}

function closeMenu(): void {
	isOpen.value = false;
	triggerRef.value?.focus();
}

function openPaletteFromMenu(): void {
	isOpen.value = false;
	togglePalette();
}

function handleSignOut(): void {
	logout();
	isOpen.value = false;
	router.push("/");
}

function onKeyDown(event: KeyboardEvent): void {
	if (event.key === "Escape" && isOpen.value) {
		event.preventDefault();
		closeMenu();
	}
}

watch(
	() => route.path,
	() => {
		isOpen.value = false;
	},
);

watch(isOpen, (open) => {
	if (!import.meta.client) return;
	document.body.style.overflow = open ? "hidden" : "";
});

let sidebarMedia: MediaQueryList | null = null;
const onSidebarChange = () => {
	if (sidebarMedia?.matches) isOpen.value = false;
};

onMounted(() => {
	window.addEventListener("keydown", onKeyDown);
	sidebarMedia = window.matchMedia("(min-width: 64rem)");
	sidebarMedia.addEventListener("change", onSidebarChange);
});

onBeforeUnmount(() => {
	window.removeEventListener("keydown", onKeyDown);
	sidebarMedia?.removeEventListener("change", onSidebarChange);
	if (import.meta.client) document.body.style.overflow = "";
});
</script>
