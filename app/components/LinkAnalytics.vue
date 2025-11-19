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
  <UModal v-model="isOpen">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-bold text-gray-900">Link Analytics</h3>
            <p class="text-sm text-gray-600 mt-1">{{ link.shortUrl }}</p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-x-mark"
            @click="closeModal"
          />
        </div>
      </template>

      <div v-if="loading" class="flex items-center justify-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-primary" />
      </div>

      <div v-else-if="analytics" class="space-y-6">
        <!-- Overview Stats -->
        <div class="grid grid-cols-2 gap-4">
          <div class="rounded-lg border border-border/50 bg-gray-50 p-4">
            <div class="text-xs text-muted-foreground mb-1">Total Clicks</div>
            <div class="text-2xl font-bold text-gray-900">{{ analytics.totalClicks }}</div>
          </div>
          <div class="rounded-lg border border-border/50 bg-gray-50 p-4">
            <div class="text-xs text-muted-foreground mb-1">Status</div>
            <div class="flex items-center gap-2">
              <UBadge :color="analytics.isActive ? 'success' : 'error'" variant="soft">
                {{ analytics.isActive ? 'Active' : 'Inactive' }}
              </UBadge>
            </div>
          </div>
        </div>

        <!-- Link Details -->
        <div class="space-y-3">
          <div>
            <div class="text-xs text-muted-foreground mb-1">Original URL</div>
            <a
              :href="analytics.originalUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-primary hover:underline truncate block"
            >
              {{ analytics.originalUrl }}
            </a>
          </div>

          <div v-if="analytics.customAlias" class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-xs text-muted-foreground mb-1">Custom Alias</div>
              <div class="text-sm font-mono">{{ analytics.customAlias }}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-xs text-muted-foreground mb-1">Created</div>
              <div class="text-sm">{{ formatDate(analytics.createdAt) }}</div>
            </div>
            <div v-if="analytics.expiresAt">
              <div class="text-xs text-muted-foreground mb-1">Expires</div>
              <div class="text-sm">{{ formatDate(analytics.expiresAt) }}</div>
            </div>
          </div>
        </div>

        <!-- Recent Clicks -->
        <div v-if="analytics.clicks && analytics.clicks.length > 0">
          <h4 class="text-sm font-semibold text-gray-900 mb-3">Recent Clicks</h4>
          <div class="space-y-2 max-h-64 overflow-y-auto">
            <div
              v-for="click in analytics.clicks"
              :key="click.id"
              class="rounded-lg border border-border/50 bg-gray-50 p-3 text-xs"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="font-medium text-gray-900">
                  {{ formatClickDate(click.timestamp) }}
                </div>
                <div v-if="click.country" class="flex items-center gap-1 text-muted-foreground">
                  <UIcon name="i-heroicons-map-pin" class="h-3 w-3" />
                  <span>{{ click.country }}{{ click.city ? `, ${click.city}` : '' }}</span>
                </div>
              </div>

              <div v-if="click.referrer" class="text-muted-foreground truncate mb-1">
                <span class="font-medium">Referrer:</span> {{ click.referrer }}
              </div>

              <div v-if="click.userAgent" class="text-muted-foreground truncate">
                <span class="font-medium">User Agent:</span> {{ click.userAgent }}
              </div>
            </div>
          </div>
        </div>

        <!-- No clicks message -->
        <div v-else class="text-center py-8 text-muted-foreground">
          <UIcon name="i-heroicons-cursor-arrow-rays-slash" class="h-12 w-12 mx-auto mb-2 opacity-30" />
          <p class="text-sm">No clicks recorded yet</p>
        </div>
      </div>

      <UAlert v-else-if="error" color="error" :title="error" />
    </UCard>
  </UModal>
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import { useFetcher } from "../composables";

const props = defineProps<{
	link: {
		id: string;
		shortUrl: string;
	};
	modelValue: boolean;
}>();

const emit = defineEmits<(e: "update:modelValue", value: boolean) => void>();

const { get: fetchGet } = useFetcher();
const isOpen = ref(props.modelValue);
const loading = ref(false);
const error = ref("");
const analytics = ref<any>(null);

watch(
	() => props.modelValue,
	(newValue) => {
		isOpen.value = newValue;
		if (newValue) {
			fetchAnalytics();
		}
	},
);

watch(isOpen, (newValue) => {
	emit("update:modelValue", newValue);
});

async function fetchAnalytics() {
	loading.value = true;
	error.value = "";
	analytics.value = null;

	try {
		const authToken = process.client
			? localStorage.getItem("auth_token")
			: null;
		const headers: Record<string, string> = {};

		if (authToken) {
			headers.Authorization = `Bearer ${authToken}`;
		}

		const data = await fetchGet(
			"/api/links/analytics",
			{
				headers,
				retries: 2,
				timeout: 10000,
			},
			{
				shortLinkId: props.link.id,
			},
		);

		analytics.value = data;
	} catch (err: any) {
		error.value = err.message || "Failed to fetch analytics";
	} finally {
		loading.value = false;
	}
}

function closeModal() {
	isOpen.value = false;
}

function formatDate(date: string | Date): string {
	const d = new Date(date);
	return d.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatClickDate(date: string | Date): string {
	const d = new Date(date);
	const now = new Date();
	const diffMs = now.getTime() - d.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}
</script>
