import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/**
 * Custom Vue composable for managing a persisted ID in both session storage and URL query parameters.
 * This composable provides functionality to store, retrieve, clear and generate unique identifiers that
 * persist across page refreshes while maintaining URL state synchronization.
 *
 * @param {string} key - The key used to store the ID in both session storage and URL query parameters.
 *                      This should be a unique string to avoid collisions with other stored values.
 *
 * @returns {Object} An object containing the following properties and methods:
 * @returns {Ref<string|null>} id - The current persisted ID value, or null if no ID is set
 * @returns {Function} clearId - Removes the ID from both session storage and URL query parameters
 * @returns {Function} setPersistedId - Sets a new ID value in both storage locations
 * @returns {Function} generateNewId - Creates and persists a new UUID v4 identifier
 *
 * @example
 * ```vue
 * <script setup>
 * const { id, clearId, setPersistedId, generateNewId } = usePersistedId('user-session');
 * </script>
 * ```
 */
export const usePersistedId = (key: string) => {
  const id = ref<string | null>(null)
  const route = useRoute()
  const router = useRouter()

  // Generate a UUID v4
  const generateUUID = (): string => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  // Set ID in both sessionStorage and URL
  const setPersistedId = (newId: string): void => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(key, newId)
    }
    
    id.value = newId
    
    // Update URL query parameter without reloading the page
    const query = { ...route.query, [key]: newId }
    router.replace({ query })
  }

  // Clear ID from both sessionStorage and URL
  const clearId = (): void => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(key)
    }
    
    id.value = null
    
    // Remove parameter from URL
    const query = { ...route.query }
    delete query[key]
    router.replace({ query })
  }

  // Generate and set a new UUID
  const generateNewId = (): string => {
    const newId = generateUUID()
    setPersistedId(newId)
    return newId
  }

  // Initialize: sync between URL and sessionStorage
  onMounted(() => {
    // Check URL first
    const urlId = route.query[key] as string | undefined
    
    // Then check sessionStorage
    const storedId = typeof window !== 'undefined' ? sessionStorage.getItem(key) : null
    
    if (urlId) {
      // URL parameter takes precedence
      id.value = urlId
      if (typeof window !== 'undefined' && (!storedId || storedId !== urlId)) {
        sessionStorage.setItem(key, urlId)
      }
    } else if (storedId) {
      // If ID exists in sessionStorage but not in URL, update URL
      id.value = storedId
      router.replace({ 
        query: { ...route.query, [key]: storedId } 
      })
    }
  })

  // Watch for URL changes from external sources
  watch(() => route.query[key], (newValue) => {
    if (newValue && newValue !== id.value) {
      id.value = newValue as string
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, newValue as string)
      }
    } else if (!newValue && id.value) {
      id.value = null
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(key)
      }
    }
  })

  return {
    id: computed(() => id.value),
    clearId,
    setPersistedId,
    generateNewId
  }
}
