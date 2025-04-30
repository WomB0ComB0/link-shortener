/**
 * Custom Vue composable that provides functionality for copying text to the clipboard.
 *
 * This composable uses the modern Clipboard API when available, falling back to a manual
 * approach for older browsers. It maintains a reactive state indicating whether text was recently copied
 * and automatically resets this state after 3 seconds.
 *
 * @example
 * ```vue
 * <script setup>
 * const { copied, copyToClipboard } = useCopyToClipboard();
 * </script>
 * 
 * <template>
 *   <button @click="copyToClipboard('Text to copy')">
 *     {{ copied ? "Copied!" : "Copy" }}
 *   </button>
 * </template>
 * ```
 *
 * @returns {Object} An object containing:
 *   @returns {Ref<boolean>} copied - Reactive state indicating if text was recently copied
 *   @returns {(text: string) => Promise<void>} copyToClipboard - Function to copy text to clipboard
 *
 * @throws {Error} When clipboard access is denied or copying fails
 */
export const useCopyToClipboard = () => {
  const copied = ref(false);

  const copyToClipboard = async (text: string): Promise<void> => {
    if ('clipboard' in navigator) {
      try {
        await navigator.clipboard.writeText(text);
        copied.value = true;
      } catch (error) {
        throw new Error(`${error instanceof Error ? error.message : error}`);
      } finally {
        setTimeout(() => {
          copied.value = false;
        }, 3000);
      }
    } else {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        copied.value = true;
      } catch (error) {
        throw new Error(`Failed to copy: ${error instanceof Error ? error.message : error}`);
      } finally {
        document.body.removeChild(textArea);
        setTimeout(() => {
          copied.value = false;
        }, 3000);
      }
    }
  };

  return { 
    copied: computed(() => copied.value), 
    copyToClipboard 
  };
};
