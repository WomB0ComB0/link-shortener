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
  <div class="min-h-screen bg-white flex flex-col">
    <!-- Header -->
    <AppHeader>
      <template #nav>
        <NuxtLink to="/">
          <UButton
            icon="i-heroicons-home"
            color="primary"
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
        <div class="shadow-md bg-white overflow-hidden rounded-xl border border-gray-200">
          <div class="border-b border-gray-100 px-6 py-5">
            <h3 class="text-xl font-bold text-gray-900">
              {{ isLogin ? 'Welcome Back' : 'Create Account' }}
            </h3>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4 p-6 sm:p-8">
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
                Email <span class="text-red-500">*</span>
              </label>
              <UInput
                id="email"
                v-model="form.email"
                type="email"
                placeholder="you@example.com"
                :disabled="loading"
                autocomplete="email"
                class="w-full rounded-lg"
                size="md"
              />
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-gray-700 mb-1">
                Password <span class="text-red-500">*</span>
              </label>
              <UInput
                id="password"
                v-model="form.password"
                type="password"
                placeholder="••••••••"
                :disabled="loading"
                autocomplete="current-password"
                class="w-full rounded-lg"
                size="md"
              />
              <p v-if="!isLogin" class="text-xs text-gray-500 mt-1">
                At least 8 characters with uppercase, lowercase, and number
              </p>
            </div>

            <div v-if="!isLogin">
              <label for="displayName" class="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <UInput
                id="displayName"
                v-model="form.displayName"
                placeholder="Your Name"
                :disabled="loading"
                autocomplete="name"
                class="w-full rounded-lg"
                size="md"
              />
            </div>

            <UAlert v-if="error" color="error" :title="error" class="mb-4" />

            <div class="flex flex-col gap-3">
              <UButton
                type="submit"
                :loading="loading"
                :disabled="!form.email || !form.password"
                block
                class="rounded-lg font-semibold"
                style="background: var(--primary); color: var(--primary-foreground);"
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
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { useFetcher } from "../composables";

const { post: fetchPost, FetcherError } = useFetcher();
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

		const response = await fetchPost<{ user: any; token: string }>(
			endpoint,
			isLogin.value
				? { email: form.value.email, password: form.value.password }
				: {
						email: form.value.email,
						password: form.value.password,
						displayName: form.value.displayName || undefined,
					},
			{
				retries: 1,
				timeout: 10000,
			},
		);

		// Save token
		if (process.client) {
			localStorage.setItem("auth_token", response.token);
		}

		// Redirect to dashboard
		router.push("/dashboard");
	} catch (err) {
		if (err instanceof FetcherError) {
			error.value =
				String(err.responseData) || err.message || "Authentication failed";
		} else {
			error.value = err.message || "Authentication failed";
		}
	} finally {
		loading.value = false;
	}
}

useSeoMeta({
	title: "Authentication",
	description: "Login or create an account to manage your short links.",
});
</script>
