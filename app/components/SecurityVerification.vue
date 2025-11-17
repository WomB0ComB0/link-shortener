<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon
            :name="riskIcon"
            :class="riskIconColor"
            class="h-6 w-6"
          />
          <h3 class="text-lg font-semibold">Security Verification</h3>
        </div>
        <UBadge
          :color="riskBadgeColor"
          variant="subtle"
          size="lg"
        >
          {{ verification.overallRisk.toUpperCase() }}
        </UBadge>
      </div>
    </template>

    <!-- Overall Status -->
    <div class="space-y-6">
      <!-- Risk Score -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium">Risk Score</span>
          <span class="text-sm font-semibold">{{ verification.riskScore }}/100</span>
        </div>
        <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            :class="riskBarColor"
            class="h-full transition-all duration-500"
            :style="{ width: `${verification.riskScore}%` }"
          />
        </div>
      </div>

      <!-- Critical Issues -->
      <div v-if="verification.summary.criticalIssues.length > 0">
        <h4 class="text-sm font-semibold mb-2 flex items-center gap-2">
          <UIcon name="i-heroicons-exclamation-triangle" class="h-4 w-4 text-red-500" />
          Critical Issues
        </h4>
        <ul class="space-y-1">
          <li
            v-for="(issue, index) in verification.summary.criticalIssues"
            :key="index"
            class="text-sm text-red-600 dark:text-red-400 flex items-start gap-2"
          >
            <span class="mt-0.5">•</span>
            <span>{{ issue }}</span>
          </li>
        </ul>
      </div>

      <!-- Recommendations -->
      <div v-if="verification.summary.recommendations.length > 0">
        <h4 class="text-sm font-semibold mb-2 flex items-center gap-2">
          <UIcon name="i-heroicons-light-bulb" class="h-4 w-4 text-yellow-500" />
          Recommendations
        </h4>
        <ul class="space-y-1">
          <li
            v-for="(rec, index) in verification.summary.recommendations"
            :key="index"
            class="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
          >
            <span class="mt-0.5">→</span>
            <span>{{ rec }}</span>
          </li>
        </ul>
      </div>

      <!-- Detailed Checks -->
      <div>
        <h4 class="text-sm font-semibold mb-3">Detailed Checks</h4>
        <div class="space-y-3">
          <!-- URL Validation -->
          <div class="flex items-start gap-3">
            <UIcon
              :name="verification.checks.urlValidation.isValid ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
              :class="verification.checks.urlValidation.isValid ? 'text-green-500' : 'text-red-500'"
              class="h-5 w-5 shrink-0 mt-0.5"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium">URL Validation</div>
              <div class="text-xs text-gray-500">
                Protocol: {{ verification.checks.urlValidation.protocol }} |
                Domain: {{ verification.checks.urlValidation.domain }}
              </div>
              <div v-if="verification.checks.urlValidation.errors.length > 0" class="mt-1 text-xs text-red-600 dark:text-red-400">
                {{ verification.checks.urlValidation.errors.join(', ') }}
              </div>
            </div>
          </div>

          <!-- DNS Check -->
          <div class="flex items-start gap-3">
            <UIcon
              :name="verification.checks.dnsCheck.isValid ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
              :class="verification.checks.dnsCheck.isValid ? 'text-green-500' : 'text-red-500'"
              class="h-5 w-5 shrink-0 mt-0.5"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium">DNS Resolution</div>
              <div class="text-xs text-gray-500">
                A Records: {{ verification.checks.dnsCheck.aRecords.length }} |
                Time: {{ verification.checks.dnsCheck.resolutionTime }}ms
              </div>
              <div v-if="verification.checks.dnsCheck.errors.length > 0" class="mt-1 text-xs text-red-600 dark:text-red-400">
                {{ verification.checks.dnsCheck.errors.join(', ') }}
              </div>
            </div>
          </div>

          <!-- SSL Check -->
          <div class="flex items-start gap-3">
            <UIcon
              :name="verification.checks.sslCheck.isValid ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
              :class="verification.checks.sslCheck.isValid ? 'text-green-500' : 'text-red-500'"
              class="h-5 w-5 shrink-0 mt-0.5"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium">SSL/TLS Certificate</div>
              <div v-if="verification.checks.sslCheck.hasValidCertificate" class="text-xs text-gray-500">
                Issuer: {{ verification.checks.sslCheck.certificateIssuer }} |
                Expires: {{ formatDate(verification.checks.sslCheck.validTo) }}
              </div>
              <div v-else class="text-xs text-gray-500">
                No SSL certificate (HTTP)
              </div>
            </div>
          </div>

          <!-- Phishing Detection -->
          <div class="flex items-start gap-3">
            <UIcon
              :name="verification.checks.phishingCheck.isPhishing ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle'"
              :class="verification.checks.phishingCheck.isPhishing ? 'text-red-500' : 'text-green-500'"
              class="h-5 w-5 shrink-0 mt-0.5"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium">Phishing Detection</div>
              <div class="text-xs text-gray-500">
                Suspicion Score: {{ verification.checks.phishingCheck.suspicionScore }}%
              </div>
              <div v-if="verification.checks.phishingCheck.reasons.length > 0" class="mt-1 text-xs text-orange-600 dark:text-orange-400">
                {{ verification.checks.phishingCheck.reasons.join(', ') }}
              </div>
            </div>
          </div>

          <!-- Malware Check -->
          <div class="flex items-start gap-3">
            <UIcon
              :name="verification.checks.malwareCheck.isSafe ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'"
              :class="verification.checks.malwareCheck.isSafe ? 'text-green-500' : 'text-red-500'"
              class="h-5 w-5 shrink-0 mt-0.5"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium">Malware Scan</div>
              <div class="text-xs text-gray-500">
                Checked by: {{ verification.checks.malwareCheck.checkedBy.join(', ') || 'Local patterns' }}
              </div>
              <div v-if="verification.checks.malwareCheck.threats.length > 0" class="mt-1 space-y-1">
                <div
                  v-for="(threat, index) in verification.checks.malwareCheck.threats"
                  :key="index"
                  class="text-xs text-red-600 dark:text-red-400"
                >
                  {{ threat.threatType }}: {{ threat.description }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Metadata -->
      <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between text-xs text-gray-500">
          <span>Verified: {{ formatDate(verification.metadata.verifiedAt) }}</span>
          <span>Check time: {{ verification.metadata.totalCheckTime }}ms</span>
          <span v-if="verification.metadata.cached" class="flex items-center gap-1">
            <UIcon name="i-heroicons-clock" class="h-3 w-3" />
            Cached
          </span>
        </div>
      </div>
    </div>
  </UCard>
</template>

<script lang="ts" setup>
import type { LinkVerificationResult } from "~/server/security/verification-pipeline";

interface Props {
	verification: LinkVerificationResult;
}

const props = defineProps<Props>();

const riskIcon = computed(() => {
	switch (props.verification.overallRisk) {
		case "safe":
			return "i-heroicons-shield-check";
		case "low":
			return "i-heroicons-shield-check";
		case "medium":
			return "i-heroicons-exclamation-triangle";
		case "high":
			return "i-heroicons-exclamation-circle";
		case "critical":
			return "i-heroicons-x-circle";
		default:
			return "i-heroicons-question-mark-circle";
	}
});

const riskIconColor = computed(() => {
	switch (props.verification.overallRisk) {
		case "safe":
			return "text-green-500";
		case "low":
			return "text-blue-500";
		case "medium":
			return "text-yellow-500";
		case "high":
			return "text-orange-500";
		case "critical":
			return "text-red-500";
		default:
			return "text-gray-500";
	}
});

const riskBadgeColor = computed(() => {
	switch (props.verification.overallRisk) {
		case "safe":
			return "success";
		case "low":
			return "info";
		case "medium":
			return "warning";
		case "high":
			return "warning";
		case "critical":
			return "error";
		default:
			return "neutral";
	}
});

const riskBarColor = computed(() => {
	switch (props.verification.overallRisk) {
		case "safe":
			return "bg-green-500";
		case "low":
			return "bg-blue-500";
		case "medium":
			return "bg-yellow-500";
		case "high":
			return "bg-orange-500";
		case "critical":
			return "bg-red-500";
		default:
			return "bg-gray-500";
	}
});

function formatDate(date: Date | undefined): string {
	if (!date) return "N/A";
	return new Date(date).toLocaleString();
}
</script>
