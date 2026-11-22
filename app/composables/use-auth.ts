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

import { computed } from "vue";
import { useFetcher } from "./use-fetcher";

export interface AuthUser {
	id: string;
	email: string;
	displayName?: string | null;
	photoUrl?: string | null;
	createdAt?: string;
}

export function useAuth() {
	const currentUser = useState<AuthUser | null>("auth_user", () => null);
	const sessionChecked = useState<boolean>("auth_checked", () => false);
	const { get: fetchGet, post: fetchPost, FetcherError } = useFetcher();

	const isAuthenticated = computed(() => Boolean(currentUser.value));

	async function refreshUser(): Promise<AuthUser | null> {
		if (!import.meta.client) return currentUser.value;

		try {
			const user = await fetchGet<AuthUser>("/api/auth/me", {
				retries: 0,
				timeout: 5000,
			});
			currentUser.value = user;
			sessionChecked.value = true;
			return user;
		} catch (err) {
			if (err instanceof FetcherError && err.status === 401) {
				currentUser.value = null;
			}
			sessionChecked.value = true;
			return null;
		}
	}

	async function syncFromStorage(): Promise<void> {
		if (!import.meta.client) return;
		// Purge any legacy client-side token from older sessions
		localStorage.removeItem("auth_token");
		if (!currentUser.value && !sessionChecked.value) {
			await refreshUser();
		}
	}

	function setSession(user: AuthUser | null): void {
		currentUser.value = user;
		sessionChecked.value = true;
		if (import.meta.client) {
			localStorage.removeItem("auth_token");
		}
	}

	async function logout(): Promise<void> {
		currentUser.value = null;
		sessionChecked.value = true;
		if (import.meta.client) {
			localStorage.removeItem("auth_token");
			try {
				await fetchPost("/api/auth/logout", {}, { retries: 0, timeout: 5000 });
			} catch {
				// Best-effort cookie clear
			}
		}
	}

	return {
		currentUser,
		isAuthenticated,
		syncFromStorage,
		refreshUser,
		setSession,
		logout,
	};
}
