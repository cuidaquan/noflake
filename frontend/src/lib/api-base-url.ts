const DEFAULT_API_BASE_URL = "http://127.0.0.1:4000";

export function resolveApiBaseUrl(configuredBaseUrl?: string) {
  const normalizedBaseUrl = configuredBaseUrl?.trim();
  return normalizedBaseUrl && normalizedBaseUrl.length > 0
    ? normalizedBaseUrl
    : DEFAULT_API_BASE_URL;
}
