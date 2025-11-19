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
  <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
    <LinkCard
      v-for="link in links"
      :key="link.id"
      :link="link"
      :show-analytics="showAnalytics"
      @view-analytics="handleViewAnalytics"
    />

    <!-- Analytics Modal -->
    <LinkAnalytics
      v-if="selectedLink"
      v-model="showAnalyticsModal"
      :link="selectedLink"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";

defineProps<{
	links: Array<{
		id: string;
		shortUrl: string;
		originalUrl: string;
		customAlias?: string | null;
		createdAt: string | Date;
		totalClicks?: number;
	}>;
	showAnalytics?: boolean;
}>();

const showAnalyticsModal = ref(false);
const selectedLink = ref<{ id: string; shortUrl: string } | null>(null);

function handleViewAnalytics(link: { id: string; shortUrl: string }) {
	selectedLink.value = link;
	showAnalyticsModal.value = true;
}
</script>
