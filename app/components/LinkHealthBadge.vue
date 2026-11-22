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
	<span
		v-if="showWarning && entry && url"
		:data-link-health="entry.status"
		:data-link-health-url="url"
		class="inline-flex w-fit max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md border px-2 py-0.5 tile-meta"
		:class="
			isUnavailable
				? 'border-down/30 bg-down-tint text-down'
				: 'border-ongoing/30 bg-ongoing-tint text-ongoing'
		"
	>
		<StatusDot :tone="isUnavailable ? 'down' : 'ongoing'" />
		<span>{{ isUnavailable ? "Unavailable" : "Temporarily unreachable" }}</span>
		<span aria-hidden="true" class="opacity-60">·</span>
		<time :datetime="entry.checkedAt" class="opacity-80">
			<span aria-hidden="true">Checked {{ formattedCheckedAt }} UTC</span>
			<span class="sr-only">. Last checked {{ utcString }}.</span>
		</time>
	</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useLinkHealth } from "../composables";

const props = defineProps<{
	href: string | null | undefined;
}>();

const checkedDateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
	timeZone: "UTC",
});

const { getEntry } = useLinkHealth();

const resolved = computed(() => getEntry(props.href));
const url = computed(() => resolved.value.url);
const entry = computed(() => resolved.value.entry);

// Quiet when reachable or unknown (matches portfolio's LinkHealthBadge)
const showWarning = computed(
	() =>
		entry.value?.status === "unavailable" ||
		entry.value?.status === "temporary",
);
const isUnavailable = computed(() => entry.value?.status === "unavailable");

const formattedCheckedAt = computed(() => {
	if (!entry.value) return "";
	return checkedDateFormatter.format(new Date(entry.value.checkedAt));
});

const utcString = computed(() => {
	if (!entry.value) return "";
	return new Date(entry.value.checkedAt).toUTCString();
});
</script>
