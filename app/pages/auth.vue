<template>
  <div class="min-h-screen bg-white flex flex-col">
    <!-- Header -->
    <AppHeader>
      <template #nav>
        <NuxtLink to="/">
          <UButton
            icon="i-heroicons-home"
            color="neutral"
            variant="soft"
            class="rounded-lg"
          >
            Home
          </UButton>
        </NuxtLink>
      </template>
    </AppHeader>

    <!-- Auth Form Container -->
    <div class="flex-1 flex items-center justify-center px-4 py-12">
      <div class="w-full max-w-md">
        <UCard class="shadow-lg border border-gray-200">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-xl font-bold text-gray-900">
                {{ isLogin ? 'Welcome Back' : 'Create Account' }}
              </h3>
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
                class="rounded-lg"
              />
            </UFormGroup>

            <UFormGroup label="Password" required>
              <UInput
                v-model="form.password"
                type="password"
                placeholder="••••••••"
                :disabled="loading"
                autocomplete="current-password"
                class="rounded-lg"
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
                class="rounded-lg"
              />
            </UFormGroup>

            <UAlert v-if="error" color="error" :title="error" class="mb-4" />

            <div class="flex flex-col gap-3">
              <UButton
                type="submit"
                :loading="loading"
                :disabled="!form.email || !form.password"
                block
                class="bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
              >
                {{ isLogin ? 'Login' : 'Create Account' }}
              </UButton>

              <UButton
                color="primary"
                variant="ghost"
                @click="toggleMode"
                :disabled="loading"
                block
                class="rounded-lg"
              >
                {{ isLogin ? "Don't have an account? Sign up" : 'Already have an account? Login' }}
              </UButton>
            </div>
          </form>
        </UCard>

        <!-- Back to home link -->
        <div class="text-center mt-6">
          <NuxtLink to="/" class="text-blue-600 hover:underline text-sm font-medium">
            ← Back to home
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import AppHeader from "~/components/AppHeader.vue";

const router = useRouter();
const isLogin = ref(true);
const loading = ref(false);
const error = ref("");

const form = ref({
  email: "",
  password: "",
  displayName: "",
});

function toggleMode() {
  isLogin.value = !isLogin.value;
  error.value = "";
}

async function handleSubmit() {
  loading.value = true;
  error.value = "";

  try {
    const endpoint = isLogin.value ? "/api/auth/login" : "/api/auth/register";

    const response = await $fetch<{ user: any; token: string }>(endpoint, {
      method: "POST",
      body: isLogin.value
        ? { email: form.value.email, password: form.value.password }
        : {
            email: form.value.email,
            password: form.value.password,
            displayName: form.value.displayName || undefined,
          },
    });

    // Save token
    if (process.client) {
      localStorage.setItem("auth_token", response.token);
    }

    // Redirect to dashboard
    router.push("/dashboard");
  } catch (err: any) {
    error.value = err.data?.message || err.message || "Authentication failed";
  } finally {
    loading.value = false;
  }
}

useSeoMeta({
  title: "Authentication - LinkShort",
  description: "Login or create an account to manage your short links.",
});
</script>
