<template>
  <div class="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4">
    <div class="flex items-center gap-3">
      <UAvatar
        :alt="user.displayName || user.email"
        size="md"
      >
        {{ (user.displayName || user.email).charAt(0).toUpperCase() }}
      </UAvatar>
      
      <div class="flex flex-col">
        <span class="text-sm font-medium">{{ user.displayName || 'User' }}</span>
        <span class="text-xs text-gray-500">{{ user.email }}</span>
      </div>
    </div>

    <UButton
      color="primary"
      variant="ghost"
      icon="i-heroicons-arrow-right-on-rectangle"
      @click="emit('logout')"
    >
      Logout
    </UButton>
  </div>
</template>

<script lang="ts" setup>
defineProps<{
	user: {
		email: string;
		displayName?: string | null;
	};
}>();

const emit = defineEmits<{
	logout: [];
}>();
</script>
