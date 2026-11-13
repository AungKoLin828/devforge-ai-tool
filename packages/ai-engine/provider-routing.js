const RETRYABLE_PROVIDER_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
export function isRetryableProviderStatus(status) {
    return RETRYABLE_PROVIDER_STATUSES.has(status);
}
