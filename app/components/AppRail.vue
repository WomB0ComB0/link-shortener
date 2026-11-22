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
	<div
		class="flex h-full w-16 flex-col items-center gap-3 border-r border-hairline bg-canvas/80 py-6 backdrop-blur-md"
	>
		<nav
			class="flex w-full flex-1 flex-col items-center gap-2 px-2"
			aria-label="Main navigation"
		>
			<NuxtLink
				v-for="item in navItems"
				:key="item.to"
				:to="item.to"
				:aria-label="item.label"
				:aria-current="isCurrent(item.to) ? 'page' : undefined"
				:class="[
					RAIL_ITEM,
					isCurrent(item.to) ? RAIL_ITEM_CURRENT : RAIL_ITEM_IDLE,
					'group/rail',
				]"
			>
				<UIcon :name="item.icon" class="size-[1.125rem] shrink-0" aria-hidden="true" />
				<span aria-hidden="true" :class="TOOLTIP_CLASS">
					{{ item.label }}
				</span>
			</NuxtLink>

			<!-- Ecosystem / Network Flyout Group -->
			<div ref="flyoutContainerRef" class="relative flex w-full flex-col items-center">
				<button
					ref="flyoutTriggerRef"
					type="button"
					:class="[
						RAIL_ITEM,
						networkOpen ? RAIL_ITEM_OPEN : RAIL_ITEM_IDLE,
						'group/rail cursor-pointer',
					]"
					aria-label="Network section"
					:aria-expanded="networkOpen"
					aria-controls="nav-flyout-network"
					@click="networkOpen = !networkOpen"
				>
					<UIcon name="i-heroicons-globe-alt" class="size-[1.125rem] shrink-0" aria-hidden="true" />
					<span v-if="!networkOpen" aria-hidden="true" :class="TOOLTIP_CLASS">
						*.mikeodnis.dev
					</span>
				</button>

				<div
					v-if="networkOpen"
					id="nav-flyout-network"
					class="absolute top-0 left-full z-50 ml-4 min-w-60 rounded-tile border border-hairline bg-surface-2 p-1.5 shadow-raised"
				>
					<div id="nav-flyout-network-label" class="label-mono px-2.5 pt-2 pb-1 text-faint">
						*.mikeodnis.dev
					</div>
					<ul aria-labelledby="nav-flyout-network-label" class="flex flex-col gap-0.5">
						<li v-for="site in networkSites" :key="site.id">
							<NuxtLink
								v-if="site.current"
								to="/"
								aria-current="page"
								:class="[FLYOUT_LINK, FLYOUT_LINK_CURRENT]"
								@click="networkOpen = false"
							>
								<UIcon :name="site.icon" class="size-4 shrink-0" aria-hidden="true" />
								<span class="flex-1 truncate">{{ site.name }}</span>
								<span class="mono-token text-brand-ink">here</span>
							</NuxtLink>
							<a
								v-else
								:href="site.url"
								target="_blank"
								rel="noopener noreferrer"
								:class="[FLYOUT_LINK, FLYOUT_LINK_IDLE]"
								@click="networkOpen = false"
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

					<div class="my-1.5 h-px bg-hairline" aria-hidden="true" />

					<div id="nav-flyout-ventures-label" class="label-mono px-2.5 pt-1 pb-1 text-faint">
						Ventures
					</div>
					<ul aria-labelledby="nav-flyout-ventures-label" class="flex flex-col gap-0.5">
						<li v-for="site in ventureSites" :key="site.id">
							<a
								:href="site.url"
								target="_blank"
								rel="noopener noreferrer"
								:class="[FLYOUT_LINK, FLYOUT_LINK_IDLE]"
								@click="networkOpen = false"
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
			</div>

			<div aria-hidden="true" class="my-1 h-px w-8 bg-hairline" />

			<!-- Command Palette trigger (matches portfolio PaletteRailButton) -->
			<button
				type="button"
				:class="[RAIL_ITEM, RAIL_ITEM_IDLE, 'group/rail cursor-pointer']"
				aria-label="Open command menu"
				:aria-keyshortcuts="shortcut.keys"
				@click="openPalette"
			>
				<UIcon name="i-heroicons-command-line" class="size-[1.125rem] shrink-0" aria-hidden="true" />
				<span aria-hidden="true" :class="TOOLTIP_CLASS">
					<span>Command menu</span>
					<kbd class="font-mono text-label text-muted-foreground">{{ shortcut.label }}</kbd>
				</span>
			</button>

			<NuxtLink
				v-if="!isAuthenticated"
				to="/auth"
				aria-label="Account"
				:aria-current="isCurrent('/auth') ? 'page' : undefined"
				:class="[
					RAIL_ITEM,
					isCurrent('/auth') ? RAIL_ITEM_CURRENT : RAIL_ITEM_IDLE,
					'group/rail',
				]"
			>
				<UIcon name="i-heroicons-user" class="size-[1.125rem] shrink-0" aria-hidden="true" />
				<span aria-hidden="true" :class="TOOLTIP_CLASS">
					Sign in
				</span>
			</NuxtLink>

			<button
				v-else
				type="button"
				aria-label="Sign out"
				:class="[RAIL_ITEM, RAIL_ITEM_IDLE, 'group/rail cursor-pointer']"
				@click="handleSignOut"
			>
				<UIcon
					name="i-heroicons-arrow-left-on-rectangle"
					class="size-[1.125rem] shrink-0"
					aria-hidden="true"
				/>
				<span aria-hidden="true" :class="TOOLTIP_CLASS">
					Sign out
				</span>
			</button>
		</nav>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useAuth, useCommandPalette } from "../composables";
import { ECOSYSTEM_LINKS } from "../constants/app";

const route = useRoute();
const router = useRouter();
const { isAuthenticated, logout } = useAuth();
const { isOpen: paletteOpen, shortcut, toggle: togglePalette } = useCommandPalette();

const networkOpen = ref(false);
const flyoutContainerRef = ref<HTMLDivElement | null>(null);
const flyoutTriggerRef = ref<HTMLButtonElement | null>(null);

const networkSites = ECOSYSTEM_LINKS.filter((s) => s.group === "network");
const ventureSites = ECOSYSTEM_LINKS.filter((s) => s.group === "ventures");

const RAIL_ITEM =
	"relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-(--motion-fast) ease-standard";
const RAIL_ITEM_IDLE =
	"text-muted-foreground hover:bg-surface-2 hover:text-foreground";
const RAIL_ITEM_OPEN = "bg-surface-2 text-foreground";
const RAIL_ITEM_CURRENT =
	"bg-surface-3 text-foreground before:absolute before:-left-2.5 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-brand";
const TOOLTIP_CLASS =
	"pointer-events-none absolute top-1/2 left-full z-50 ml-4 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-body-sm text-foreground opacity-0 shadow-raised transition-opacity duration-(--motion-fast) ease-standard group-hover/rail:opacity-100 group-focus-visible/rail:opacity-100";
const FLYOUT_LINK =
	"flex items-center gap-3 rounded-md px-2.5 py-2 text-body-sm transition-colors duration-(--motion-fast) ease-standard";
const FLYOUT_LINK_IDLE = "text-foreground hover:bg-surface-3";
const FLYOUT_LINK_CURRENT = "bg-brand-subtle font-medium text-brand-ink";

interface RailItem {
	readonly to: string;
	readonly label: string;
	readonly icon: string;
}

const navItems = computed<readonly RailItem[]>(() => {
	const base: RailItem[] = [
		{ to: "/", label: "Home", icon: "i-heroicons-home" },
		{ to: "/create", label: "Shorten URL", icon: "i-heroicons-plus-circle" },
	];
	if (isAuthenticated.value) {
		base.push(
			{ to: "/dashboard", label: "Dashboard", icon: "i-heroicons-chart-bar" },
			{ to: "/keys", label: "API Keys", icon: "i-heroicons-key" },
		);
	}
	return base;
});

function isCurrent(slug: string): boolean {
	if (slug === "/") return route.path === "/";
	return route.path === slug || route.path.startsWith(`${slug}/`);
}

function openPalette(): void {
	networkOpen.value = false;
	togglePalette();
}

function handleSignOut(): void {
	logout();
	router.push("/");
}

watch(
	() => route.path,
	() => {
		networkOpen.value = false;
	},
);

watch(paletteOpen, (open) => {
	if (open) networkOpen.value = false;
});

function onKeyDown(event: KeyboardEvent): void {
	if (!networkOpen.value || event.key !== "Escape" || event.defaultPrevented) return;
	const hadFocus = flyoutContainerRef.value?.contains(document.activeElement);
	networkOpen.value = false;
	if (hadFocus) flyoutTriggerRef.value?.focus();
}

function onPointerDown(event: PointerEvent): void {
	if (!networkOpen.value) return;
	if (
		event.target instanceof Node &&
		flyoutContainerRef.value?.contains(event.target)
	) {
		return;
	}
	networkOpen.value = false;
}

onMounted(() => {
	window.addEventListener("keydown", onKeyDown);
	document.addEventListener("pointerdown", onPointerDown);
});

onBeforeUnmount(() => {
	window.removeEventListener("keydown", onKeyDown);
	document.removeEventListener("pointerdown", onPointerDown);
});
</script>
