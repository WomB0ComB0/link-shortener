<template>
  <UModal v-model="isOpen">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-semibold">
            {{ isLogin ? 'Login' : 'Create Account' }}
          </h3>
          <UButton
            color="primary"
            variant="ghost"
            icon="i-heroicons-x-mark-20-solid"
            @click="isOpen = false"
          />
        </div>
      </template>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <UFormGroup label="Email" required>
          <UInput
            v-model="form.email"
            type="email"
            placeholder="you@example.com"
            :disabled="loading"
            autocomplete="email"
          />
        </UFormGroup>

        <UFormGroup label="Password" required>
          <UInput
            v-model="form.password"
            type="password"
            placeholder="••••••••"
            :disabled="loading"
            autocomplete="current-password"
          />
          <template v-if="!isLogin" #help>
            At least 8 characters with uppercase, lowercase, and number
          </template>
        </UFormGroup>

        <UFormGroup v-if="!isLogin" label="Display Name">
          <UInput
            v-model="form.displayName"
            placeholder="Your Name"
            :disabled="loading"
            autocomplete="name"
          />
        </UFormGroup>

        <UAlert v-if="error" color="error" :title="error" class="mb-4" />

        <div class="flex flex-col gap-3">
          <UButton
            type="submit"
            :loading="loading"
            :disabled="!form.email || !form.password"
            block
          >
            {{ isLogin ? 'Login' : 'Create Account' }}
          </UButton>

          <UButton
            color="primary"
            variant="ghost"
            @click="toggleMode"
            :disabled="loading"
            block
          >
            {{ isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login' }}
          </UButton>
        </div>
      </form>
    </UCard>
  </UModal>
</template>

<script lang="ts" setup>
const isOpen = defineModel<boolean>({ required: true });
const emit = defineEmits<{
  success: [token: string];
}>();

const isLogin = ref(true);
const loading = ref(false);
const error = ref('');

const form = ref({
  email: '',
  password: '',
  displayName: '',
});

function toggleMode() {
  isLogin.value = !isLogin.value;
  error.value = '';
}

async function handleSubmit() {
  loading.value = true;
  error.value = '';

  try {
    const endpoint = isLogin.value ? '/api/auth/login' : '/api/auth/register';
    
    const response = await $fetch<{ user: any; token: string }>(endpoint, {
      method: 'POST',
      body: isLogin.value
        ? { email: form.value.email, password: form.value.password }
        : {
            email: form.value.email,
            password: form.value.password,
            displayName: form.value.displayName || undefined,
          },
    });

    // Save token and emit success
    emit('success', response.token);
    
    // Reset form
    form.value = { email: '', password: '', displayName: '' };
    isOpen.value = false;
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Authentication failed';
  } finally {
    loading.value = false;
  }
}

watch(isOpen, (value) => {
  if (!value) {
    error.value = '';
    form.value = { email: '', password: '', displayName: '' };
  }
});
</script>
