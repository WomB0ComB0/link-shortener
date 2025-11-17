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
