<template>
  <div
    class="group relative overflow-hidden rounded-xl border border-gray-200 bg-white hover:border-purple-200 transition-all hover:shadow-lg p-4"
  >
    <div class="flex flex-col gap-3">
      <!-- Short URL -->
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-link" class="h-5 w-5 text-primary shrink-0" />
            <code class="text-sm font-mono font-semibold text-primary truncate">
              {{ link.shortUrl }}
            </code>
          </div>
        </div>
        
        <div class="flex items-center gap-1">
          <UButton
            v-if="showAnalytics"
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-heroicons-chart-bar"
            @click="openAnalytics"
          />
          <UButton
            color="primary"
            variant="ghost"
            size="xs"
            icon="i-heroicons-clipboard-document"
            @click="copyLink(link.shortUrl)"
          >
            {{ copied ? 'Copied!' : 'Copy' }}
          </UButton>
        </div>
      </div>

      <!-- Original URL -->
      <div class="flex items-start gap-2">
        <UIcon name="i-heroicons-arrow-top-right-on-square" class="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <a
          :href="link.originalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-muted-foreground hover:text-primary transition-colors truncate flex-1 min-w-0"
        >
          {{ link.originalUrl }}
        </a>
      </div>

      <!-- Metadata -->
      <div class="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-gray-100">
        <div class="flex items-center gap-1">
          <UIcon name="i-heroicons-clock" class="h-3 w-3" />
          <span>{{ formatDate(link.createdAt) }}</span>
        </div>
        
        <div class="flex items-center gap-3">
          <div v-if="link.totalClicks !== undefined" class="flex items-center gap-1">
            <UIcon name="i-heroicons-cursor-arrow-rays" class="h-3 w-3" />
            <span>{{ link.totalClicks }} {{ link.totalClicks === 1 ? 'click' : 'clicks' }}</span>
          </div>
          
          <div v-if="link.customAlias" class="flex items-center gap-1">
            <UIcon name="i-heroicons-tag" class="h-3 w-3" />
            <span>Custom</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useCopyToClipboard } from "../composables";

const props = defineProps<{
	link: {
		id: string;
		shortUrl: string;
		originalUrl: string;
		customAlias?: string | null;
		createdAt: string | Date;
		totalClicks?: number;
	};
	showAnalytics?: boolean;
}>();

const emit =
	defineEmits<
		(e: "viewAnalytics", link: { id: string; shortUrl: string }) => void
	>();

const copied = ref(false);
const { copyToClipboard } = useCopyToClipboard();

function copyLink(shortUrl: string) {
	const baseUrl = window?.location?.origin || "http://localhost:3000";
	const fullUrl = `${baseUrl}/${shortUrl}`;
	copyToClipboard(fullUrl);

	copied.value = true;
	setTimeout(() => {
		copied.value = false;
	}, 2000);
}

function openAnalytics() {
	emit("viewAnalytics", {
		id: props.link.id,
		shortUrl: props.link.shortUrl,
	});
}

function formatDate(date: string | Date): string {
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

	return d.toLocaleDateString();
}
</script>
