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
	<Teleport to="body">
		<div
			v-if="isOpen"
			class="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-canvas/70 px-4 pt-[14vh] pb-4 backdrop-blur-sm select-none pointer-coarse:pt-[calc(0.75rem+env(safe-area-inset-top))]"
			@click="close"
		>
			<div
				role="dialog"
				aria-modal="true"
				:aria-label="PALETTE_SEARCH_LABEL"
				class="w-full max-w-[40rem] overflow-hidden rounded-tile border border-hairline bg-surface-2 text-foreground shadow-raised focus-within:border-hairline-strong"
				@click.stop
			>
				<div class="relative flex items-center border-b border-hairline">
					<UIcon
						name="i-heroicons-magnifying-glass"
						class="pointer-events-none ml-4 size-4 shrink-0 text-faint"
						aria-hidden="true"
					/>
					<input
						ref="inputRef"
						v-model="query"
						type="text"
						role="combobox"
						aria-expanded="true"
						aria-controls="command-palette-results"
						:aria-activedescendant="activeItem ? `palette-item-${activeItem.id}` : undefined"
						:aria-label="PALETTE_SEARCH_LABEL"
						placeholder="Type a command or search..."
						class="w-full bg-transparent px-3.5 py-4 text-body text-foreground outline-none placeholder:text-faint"
						@keydown="onInputKeyDown"
					/>
					<button
						v-if="query"
						type="button"
						class="mr-3 cursor-pointer rounded-md p-1 text-faint transition-colors hover:bg-surface-3 hover:text-foreground"
						aria-label="Clear search"
						@click="query = ''"
					>
						<UIcon name="i-heroicons-x-mark" class="size-4" aria-hidden="true" />
					</button>
				</div>

				<div
					id="command-palette-results"
					role="listbox"
					class="max-h-[min(25rem,58dvh)] overflow-y-auto py-1.5"
				>
					<template v-if="groupedSections.length > 0">
						<div v-for="section in groupedSections" :key="section.label">
							<div class="label-mono px-5 pt-3 pb-1 text-faint">
								{{ section.label }}
							</div>
							<button
								v-for="item in section.items"
								:id="`palette-item-${item.id}`"
								:key="item.id"
								type="button"
								role="option"
								:aria-selected="activeIndex === item.flatIndex"
								class="relative mx-2 flex w-[calc(100%-1rem)] cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-body-sm transition-colors duration-(--motion-instant) ease-standard"
								:class="
									activeIndex === item.flatIndex
										? 'bg-surface-3 text-foreground before:absolute before:top-2 before:bottom-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand'
										: 'text-muted-foreground hover:bg-surface-3/60 hover:text-foreground'
								"
								@mouseenter="activeIndex = item.flatIndex"
								@click="executeItem(item)"
							>
								<div class="flex min-w-0 items-center gap-3">
									<UIcon
										:name="item.icon"
										class="size-4 shrink-0"
										:class="activeIndex === item.flatIndex ? 'text-brand-ink' : 'text-faint'"
										aria-hidden="true"
									/>
									<div class="flex min-w-0 flex-col">
										<span class="truncate">{{ item.name }}</span>
										<span v-if="item.subtitle" class="truncate text-label text-faint">
											{{ item.subtitle }}
										</span>
									</div>
								</div>

								<div class="flex shrink-0 items-center gap-1.5">
									<span
										v-if="item.badge"
										class="rounded bg-brand-subtle px-1.5 py-0.5 mono-token text-brand-ink"
									>
										{{ item.badge }}
									</span>
									<UIcon
										v-else-if="item.external"
										name="i-heroicons-arrow-up-right"
										class="size-3.5 text-faint"
										aria-hidden="true"
									/>
								</div>
							</button>
						</div>
					</template>

					<div v-else class="px-5 py-10 text-center text-body-sm text-faint">
						No matching pages or commands.
					</div>
				</div>

				<div
					aria-hidden="true"
					class="flex gap-4 border-t border-hairline px-5 py-2 font-mono text-label text-faint pointer-coarse:hidden"
				>
					<span>↑↓ navigate</span>
					<span>↵ open</span>
					<span>esc close</span>
				</div>
			</div>
		</div>
	</Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
	PALETTE_SEARCH_LABEL,
	useAuth,
	useCommandPalette,
	useCopyToClipboard,
} from "../composables";
import { ECOSYSTEM_LINKS } from "../constants/app";

interface PaletteItem {
	readonly id: string;
	readonly section: string;
	readonly name: string;
	readonly subtitle?: string;
	readonly keywords?: string;
	readonly icon: string;
	readonly external?: boolean;
	readonly badge?: string;
	readonly perform: () => void;
}

const router = useRouter();
const toast = useToast();
const { isOpen, close, toggle } = useCommandPalette();
const { isAuthenticated, logout } = useAuth();
const { copyToClipboard } = useCopyToClipboard();

const query = ref("");
const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

const allItems = computed<readonly PaletteItem[]>(() => {
	const pages: PaletteItem[] = [
		{
			id: "page-home",
			section: "Console",
			name: "Home",
			subtitle: "Public links directory and telemetry",
			keywords: "links directory public home",
			icon: "i-heroicons-home",
			perform: () => router.push("/"),
		},
		{
			id: "page-create",
			section: "Console",
			name: "Shorten URL",
			subtitle: "Create a verified short link",
			keywords: "create new shorten url link",
			icon: "i-heroicons-plus-circle",
			perform: () => router.push("/create"),
		},
	];

	if (isAuthenticated.value) {
		pages.push(
			{
				id: "page-dashboard",
				section: "Console",
				name: "Dashboard",
				subtitle: "Manage your links and analytics",
				keywords: "dashboard analytics my links",
				icon: "i-heroicons-chart-bar",
				perform: () => router.push("/dashboard"),
			},
			{
				id: "page-keys",
				section: "Console",
				name: "API Keys",
				subtitle: "Create and revoke programmatic API keys",
				keywords: "api keys tokens developer",
				icon: "i-heroicons-key",
				perform: () => router.push("/keys"),
			},
		);
	} else {
		pages.push({
			id: "page-auth",
			section: "Console",
			name: "Sign in",
			subtitle: "Login or create an account",
			keywords: "login auth register account",
			icon: "i-heroicons-user",
			perform: () => router.push("/auth"),
		});
	}

	const actions: PaletteItem[] = [
		{
			id: "action-copy-url",
			section: "Actions",
			name: "Copy current page URL",
			subtitle: "Copy this page address to clipboard",
			keywords: "copy share clipboard url",
			icon: "i-heroicons-clipboard-document",
			perform: () => {
				if (import.meta.client) {
					copyToClipboard(window.location.href);
					toast.add({
						title: "Copied",
						description: "Page URL copied to clipboard",
						color: "success",
					});
				}
			},
		},
	];

	if (isAuthenticated.value) {
		actions.push({
			id: "action-logout",
			section: "Actions",
			name: "Sign out",
			subtitle: "Clear your local session token",
			keywords: "logout signout exit",
			icon: "i-heroicons-arrow-left-on-rectangle",
			perform: () => {
				logout();
				router.push("/");
			},
		});
	}

	const network: PaletteItem[] = ECOSYSTEM_LINKS.map((site) => ({
		id: `eco-${site.id}`,
		section: site.group === "network" ? "*.mikeodnis.dev" : "Ventures",
		name: site.name,
		subtitle: `${site.host} · ${site.description}`,
		keywords: `${site.host} ${site.description} ${site.id}`,
		icon: site.icon,
		external: !site.current,
		badge: site.current ? "Current" : undefined,
		perform: () => {
			if (site.current) {
				router.push("/");
			} else if (import.meta.client) {
				window.open(site.url, "_blank", "noopener,noreferrer");
			}
		},
	}));

	return [...pages, ...actions, ...network];
});

const filteredItems = computed(() => {
	const needle = query.value.trim().toLowerCase();
	if (!needle) return allItems.value;
	return allItems.value.filter((item) => {
		const haystack =
			`${item.name} ${item.subtitle ?? ""} ${item.keywords ?? ""} ${item.section}`.toLowerCase();
		return haystack.includes(needle);
	});
});

interface IndexedPaletteItem extends PaletteItem {
	readonly flatIndex: number;
}

const groupedSections = computed(() => {
	const sections: Array<{ label: string; items: IndexedPaletteItem[] }> = [];
	const byLabel = new Map<string, IndexedPaletteItem[]>();

	filteredItems.value.forEach((item, flatIndex) => {
		let bucket = byLabel.get(item.section);
		if (!bucket) {
			bucket = [];
			byLabel.set(item.section, bucket);
			sections.push({ label: item.section, items: bucket });
		}
		bucket.push({ ...item, flatIndex });
	});

	return sections;
});

const activeItem = computed(() => filteredItems.value[activeIndex.value] ?? null);

watch(filteredItems, () => {
	activeIndex.value = 0;
});

watch(isOpen, async (open) => {
	if (open) {
		query.value = "";
		activeIndex.value = 0;
		await nextTick();
		inputRef.value?.focus();
	}
});

function executeItem(item: PaletteItem): void {
	close();
	item.perform();
}

function onInputKeyDown(event: KeyboardEvent): void {
	const total = filteredItems.value.length;
	if (event.key === "Escape") {
		event.preventDefault();
		close();
		return;
	}
	if (total === 0) return;

	if (event.key === "ArrowDown") {
		event.preventDefault();
		activeIndex.value = (activeIndex.value + 1) % total;
	} else if (event.key === "ArrowUp") {
		event.preventDefault();
		activeIndex.value = (activeIndex.value - 1 + total) % total;
	} else if (event.key === "Home") {
		event.preventDefault();
		activeIndex.value = 0;
	} else if (event.key === "End") {
		event.preventDefault();
		activeIndex.value = total - 1;
	} else if (event.key === "Enter" && activeItem.value) {
		event.preventDefault();
		executeItem(activeItem.value);
	}
}

function onGlobalKeyDown(event: KeyboardEvent): void {
	if (
		(event.metaKey || event.ctrlKey) &&
		!event.shiftKey &&
		!event.altKey &&
		event.key.toLowerCase() === "k"
	) {
		event.preventDefault();
		toggle();
	}
}

onMounted(() => {
	window.addEventListener("keydown", onGlobalKeyDown);
});

onBeforeUnmount(() => {
	window.removeEventListener("keydown", onGlobalKeyDown);
});
</script>
