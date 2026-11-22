/**
 * Copyright 2026 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { onMounted, ref } from "vue";

export interface PaletteShortcut {
	readonly label: string;
	readonly keys: string;
	readonly modifier: string;
}

const APPLE_SHORTCUT: PaletteShortcut = {
	label: "⌘K",
	keys: "Meta+K",
	modifier: "⌥",
};

const OTHER_SHORTCUT: PaletteShortcut = {
	label: "Ctrl K",
	keys: "Control+K",
	modifier: "Alt",
};

const APPLE_PLATFORM = /Mac|iPhone|iPad|iPod/;

export const PALETTE_SEARCH_LABEL = "Search pages and commands";

export function useCommandPalette() {
	const isOpen = useState<boolean>("command_palette_open", () => false);
	const shortcut = ref<PaletteShortcut>(APPLE_SHORTCUT);

	onMounted(() => {
		if (
			typeof navigator !== "undefined" &&
			!APPLE_PLATFORM.test(navigator.platform)
		) {
			shortcut.value = OTHER_SHORTCUT;
		}
	});

	function open(): void {
		isOpen.value = true;
	}

	function close(): void {
		isOpen.value = false;
	}

	function toggle(): void {
		isOpen.value = !isOpen.value;
	}

	return {
		isOpen,
		shortcut,
		open,
		close,
		toggle,
	};
}
