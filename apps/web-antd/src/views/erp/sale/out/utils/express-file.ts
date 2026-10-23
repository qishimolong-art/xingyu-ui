const ADMIN_API_PREFIX = '/admin-api';

function stripHash(url: string) {
  const hashIndex = url.indexOf('#');
  return hashIndex === -1 ? url : url.slice(0, hashIndex);
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function isAbsoluteHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function buildApiUrl(apiURL: string, pathWithAdminApi: string) {
  const normalizedApiURL = trimTrailingSlash(apiURL.trim());
  if (!isAbsoluteHttpUrl(normalizedApiURL)) {
    return pathWithAdminApi;
  }
  const pathAfterAdminApi = pathWithAdminApi.startsWith(`${ADMIN_API_PREFIX}/`)
    ? pathWithAdminApi.slice(ADMIN_API_PREFIX.length)
    : pathWithAdminApi;
  return `${normalizedApiURL}${pathAfterAdminApi}`;
}

export function resolveSaleOutExpressFileUrl(source: string, apiURL = '') {
  const url = stripHash(source.trim());
  if (!url) return '';
  if (url.startsWith(`${ADMIN_API_PREFIX}/`)) {
    return buildApiUrl(apiURL, url);
  }
  if (url.startsWith('/infra/file/')) {
    return buildApiUrl(apiURL, `${ADMIN_API_PREFIX}${url}`);
  }
  if (!isAbsoluteHttpUrl(url)) {
    return url;
  }

  const parsedUrl = new URL(url);
  if (parsedUrl.pathname.startsWith(`${ADMIN_API_PREFIX}/`)) {
    return buildApiUrl(apiURL, `${parsedUrl.pathname}${parsedUrl.search}`);
  }
  return url;
}
