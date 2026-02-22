import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import {
  ApiPost,
  ApiProject,
  ApiUser,
  ApiComment,
  ApiDirectMessage,
  ApiNotification,
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthResponse,
  CreateCommentRequest,
  CreateProjectRequest,
  CreatePostRequest,
  UpdateUserRequest,
} from "@/constants/Types";

type ApiUserWire = ApiUser & {
  creation_date?: string;
  links?: unknown;
};

type CachedEntry<T> = {
  value: T;
  cachedAt: number;
};

export type ApiDirectMessageThread = {
  peer_username: string;
  last_content: string;
  last_at: string;
};

const userCache = new Map<number, CachedEntry<ApiUser>>();
const inFlightGetRequests = new Map<string, Promise<unknown>>();
const MAX_USER_CACHE_ENTRIES = 300;
const MAX_INFLIGHT_GET_ENTRIES = 200;
const USER_CACHE_TTL_MS = 5_000;
let authToken: string | null = null;
const REQUEST_TIMEOUT_MS = 120000;
const UPLOAD_TIMEOUT_MS = 30000;
const HEALTHCHECK_TIMEOUT_MS = 4000;
const LARGE_REQUEST_TIMEOUT_MS = 300000;
const MAX_INLINE_MEDIA_FALLBACK_BYTES = 64 * 1024 * 1024;
const REFRESH_READ_WINDOW_MS = 2500;
let forceFreshReadsUntil = 0;

type RequestOptions = {
  timeoutMs?: number;
  forceFresh?: boolean;
};

const trimMapToSize = <K, V>(map: Map<K, V>, maxEntries: number) => {
  if (map.size <= maxEntries) {
    return;
  }
  const excess = map.size - maxEntries;
  let removed = 0;
  for (const key of map.keys()) {
    map.delete(key);
    removed += 1;
    if (removed >= excess) {
      break;
    }
  }
};

const setWithLimit = <K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number) => {
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  trimMapToSize(map, maxEntries);
};

const getFreshUserCache = (userId: number) => {
  const cached = userCache.get(userId);
  if (!cached) {
    return null;
  }
  if (Date.now() - cached.cachedAt > USER_CACHE_TTL_MS) {
    userCache.delete(userId);
    return null;
  }
  return cached.value;
};

const setUserCache = (user: ApiUser) => {
  if (typeof user?.id !== "number" || !Number.isFinite(user.id)) {
    return;
  }
  setWithLimit(
    userCache,
    user.id,
    {
      value: user,
      cachedAt: Date.now(),
    },
    MAX_USER_CACHE_ENTRIES,
  );
};

export const upsertCachedUser = (user: ApiUser | null | undefined) => {
  if (!user) {
    return;
  }
  setUserCache(user);
};

export const invalidateCachedUserById = (userId: number) => {
  userCache.delete(userId);
};

export const setAuthToken = (token: string | null) => {
  const changed = authToken !== token;
  authToken = token;
  if (changed) {
    clearApiCache();
    inFlightGetRequests.clear();
  }
};

export const clearApiCache = () => {
  userCache.clear();
  inFlightGetRequests.clear();
};

export const beginFreshReadWindow = (durationMs = REFRESH_READ_WINDOW_MS) => {
  const windowMs = Math.max(300, durationMs);
  forceFreshReadsUntil = Date.now() + windowMs;
  inFlightGetRequests.clear();
};

const isFreshReadWindowActive = () => Date.now() <= forceFreshReadsUntil;

const getHostFromUri = (uri?: string | null) => {
  if (!uri) {
    return null;
  }
  const withoutProtocol = uri.replace(/^[a-z]+:\/\//i, "");
  const host = withoutProtocol.split(":")[0];
  return host || null;
};

const getDefaultBaseUrl = () => {
  // In development, use the local server.
  if (__DEV__) {
    const legacyConstants = Constants as unknown as {
      manifest?: { debuggerHost?: string };
      manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
    };

    const hostUri =
      Constants.expoConfig?.hostUri ??
      legacyConstants.manifest?.debuggerHost ??
      legacyConstants.manifest2?.extra?.expoClient?.hostUri ??
      null;

    const host = getHostFromUri(hostUri);
    if (host) {
      return `http://${host}`;
    }

    if (Platform.OS === "android") {
      return "http://10.0.2.2";
    }

    return "http://localhost";
  }

  // In production, use the live server.
  return "https://devbits.ddns.net";
};

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

export const API_BASE_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_API_URL?.trim() || getDefaultBaseUrl(),
);

const API_FALLBACK_URL = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_API_FALLBACK_URL?.trim() || "https://devbits.ddns.net",
);

const API_UPLOAD_BASE_URLS =
  API_FALLBACK_URL && API_FALLBACK_URL !== API_BASE_URL
    ? [API_BASE_URL, API_FALLBACK_URL]
    : [API_BASE_URL];

const isTransientUploadError = (error: unknown) => {
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("network") ||
    message.includes("timed out") ||
    message.includes("failed to fetch") ||
    message.includes("connection")
  );
};

const fetchUploadWithFallback = async (
  path: string,
  init: RequestInit,
) => {
  let lastError: unknown = null;

  for (const baseUrl of API_UPLOAD_BASE_URLS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
      // Return even non-2xx responses — let callers handle status codes.
      return response;
    } catch (error) {
      lastError = error;
      // Always try the next URL before giving up.
      continue;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastError instanceof Error && lastError.name === "AbortError") {
    throw new Error(
      `Upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s. Check API connectivity to ${API_BASE_URL}.`,
    );
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Upload failed while connecting to ${API_BASE_URL}: ${detail}`);
};

const uploadMultipartWithFallback = async (
  path: string,
  body: FormData,
  headers: Headers,
) => {
  let lastError: unknown = null;

  for (const baseUrl of API_UPLOAD_BASE_URLS) {
    const targetUrl = `${baseUrl}${path}`;

    try {
      const result = await new Promise<{
        status: number;
        responseText: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        let settled = false;
        let watchdog: ReturnType<typeof setTimeout> | null = null;

        const finalize = (
          callback: () => void,
        ) => {
          if (settled) {
            return;
          }
          settled = true;
          if (watchdog) {
            clearTimeout(watchdog);
            watchdog = null;
          }
          xhr.onload = null;
          xhr.onerror = null;
          xhr.ontimeout = null;
          xhr.onabort = null;
          callback();
        };

        xhr.open("POST", targetUrl);
        xhr.timeout = UPLOAD_TIMEOUT_MS;

        headers.forEach((value, key) => {
          if (key.toLowerCase() !== "content-type") {
            xhr.setRequestHeader(key, value);
          }
        });

        xhr.onload = () =>
          finalize(() => {
            resolve({
              status: xhr.status,
              responseText: xhr.responseText ?? "",
            });
          });

        xhr.onerror = () =>
          finalize(() => reject(new Error(`Upload network error for ${targetUrl}`)));
        xhr.ontimeout = () =>
          finalize(() =>
            reject(
              new Error(
                `Upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s. Check API connectivity to ${baseUrl}.`,
              ),
            ),
          );
        xhr.onabort = () => finalize(() => reject(new Error(`Upload aborted for ${targetUrl}`)));

        watchdog = setTimeout(() => {
          try {
            xhr.abort();
          } catch {
            // Ignore abort errors; we still reject below.
          }
          finalize(() =>
            reject(
              new Error(
                `Upload watchdog timeout after ${UPLOAD_TIMEOUT_MS / 1000}s for ${baseUrl}.`,
              ),
            ),
          );
        }, UPLOAD_TIMEOUT_MS + 1500);

        xhr.send(body);
      });

      return result;
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Upload failed while connecting to ${API_BASE_URL}: ${detail}`);
};

const guessMimeTypeFromFilename = (name: string, fallbackType: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return fallbackType || "application/octet-stream";
};

const buildInlineMediaFallback = async (file: {
  uri: string;
  name: string;
  type: string;
}) => {
  const normalizedUri = normalizeUploadUri(file.uri);
  if (!/^file:|^content:/i.test(normalizedUri)) {
    throw new Error("Inline fallback requires a local file URI");
  }

  const info = await FileSystem.getInfoAsync(normalizedUri);
  if (!info.exists) {
    throw new Error("Inline fallback source file not found");
  }

  const fileSize = typeof (info as { size?: number }).size === "number"
    ? (info as { size?: number }).size
    : undefined;

  if (typeof fileSize === "number" && fileSize > MAX_INLINE_MEDIA_FALLBACK_BYTES) {
    throw new Error(
      `Media file too large for inline fallback (${Math.round(fileSize / (1024 * 1024))}MB).`,
    );
  }

  const base64 = await FileSystem.readAsStringAsync(normalizedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const mimeType = guessMimeTypeFromFilename(file.name, file.type);
  return {
    url: `data:${mimeType};base64,${base64}`,
    filename: file.name,
    contentType: mimeType,
    size: fileSize,
  };
};

const toLocalAwareApiUrl = (input: string) => {
  try {
    const parsed = new URL(input);
    const apiBase = new URL(API_BASE_URL);
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
    if (!localHosts.has(parsed.hostname.toLowerCase())) {
      return input;
    }

    parsed.protocol = apiBase.protocol;
    parsed.hostname = apiBase.hostname;
    parsed.port = apiBase.port;
    return parsed.toString();
  } catch {
    return input;
  }
};

export const checkApiConnection = async (): Promise<void> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Health check failed (${response.status})`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Cannot reach API (${API_BASE_URL}). Health check timed out after ${HEALTHCHECK_TIMEOUT_MS / 1000}s.`,
      );
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot reach API (${API_BASE_URL}): ${detail}`);
  } finally {
    clearTimeout(timeoutId);
  }
};

export const resolveMediaUrl = (value?: string | null) => {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return toLocalAwareApiUrl(trimmed);
  }

  // Treat leading-slash paths as server-root references and return
  // an absolute URL so consumers (Image, fetch, WebView) receive
  // a valid absolute URL instead of a bare path like `/image/foo.svg`.
  if (trimmed.startsWith("/")) {
    return `${API_BASE_URL}${trimmed}`;
  }

  const normalized = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  if (normalized.startsWith("uploads/")) {
    return `${API_BASE_URL}/${normalized}`;
  }

  return trimmed;
};

const request = async <T>(
  path: string,
  init?: RequestInit,
  options?: RequestOptions,
): Promise<T> => {
  const method = (init?.method ?? "GET").toUpperCase();
  const isGetRequest = method === "GET" && !init?.body;
  const forceFresh = !!options?.forceFresh || isFreshReadWindowActive();
  const requestPath =
    forceFresh && isGetRequest
      ? `${path}${path.includes("?") ? "&" : "?"}_rf=${Date.now()}`
      : path;
  const inFlightKey = `${authToken ?? ""}::${path}`;
  const timeoutMs =
    typeof options?.timeoutMs === "number"
      ? Math.max(0, options.timeoutMs)
      : REQUEST_TIMEOUT_MS;

  if (isGetRequest && !forceFresh) {
    const existing = inFlightGetRequests.get(inFlightKey);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const execute = async (): Promise<T> => {
    const headers = new Headers(init?.headers as HeadersInit | undefined);
    // Only set JSON content-type for requests with a body that is not FormData
    const hasBody = !!init?.body;
    const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
    if (hasBody && !isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }
    if (isGetRequest) {
      headers.set("Cache-Control", "no-cache");
      headers.set("Pragma", "no-cache");
    }

    const controller = new AbortController();
    const timeoutId =
      timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const requestBaseUrls =
      API_FALLBACK_URL && API_FALLBACK_URL !== API_BASE_URL
        ? [API_BASE_URL, API_FALLBACK_URL]
        : [API_BASE_URL];

    let response: Response | null = null;
    let lastError: unknown = null;

    for (const baseUrl of requestBaseUrls) {
      try {
        response = await fetch(`${baseUrl}${requestPath}`, {
          ...init,
          headers,
          signal: controller.signal,
        });
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!response) {
      if (lastError instanceof Error && lastError.name === "AbortError") {
        throw new Error(
          `Request timed out after ${timeoutMs / 1000}s. Check API connectivity to ${API_BASE_URL}.`,
        );
      }
      const detail =
        lastError instanceof Error ? lastError.message : String(lastError);
      throw new Error(`Network error connecting to ${API_BASE_URL}: ${detail}`);
    }

    const text = await response.text();

    if (!response.ok) {
      throw new Error(text || `Request failed (${response.status})`);
    }

    if (!text) {
      return (null as unknown) as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Invalid JSON response: ${text}`);
    }
  };

  if (!isGetRequest || forceFresh) {
    return execute();
  }

  const pending = execute().finally(() => {
    inFlightGetRequests.delete(inFlightKey);
  });
  setWithLimit(
    inFlightGetRequests,
    inFlightKey,
    pending as Promise<unknown>,
    MAX_INFLIGHT_GET_ENTRIES,
  );
  return pending;
};

const normalizeLinks = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (value && typeof value === "object") {
    return Object.values(value).filter(
      (item): item is string => typeof item === "string",
    );
  }
  return [];
};

const normalizeUserIdList = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const toId = (entry: unknown) => {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      return Math.trunc(entry);
    }
    if (entry && typeof entry === "object") {
      const raw = (entry as { id?: unknown }).id;
      if (typeof raw === "number" && Number.isFinite(raw)) {
        return Math.trunc(raw);
      }
      if (typeof raw === "string" && raw.trim()) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          return Math.trunc(parsed);
        }
      }
    }
    return null;
  };

  const ids = value
    .map(toId)
    .filter((id): id is number => typeof id === "number" && id > 0);

  return Array.from(new Set(ids));
};

const normalizeUser = (user: ApiUserWire): ApiUser => {
  const created =
    (typeof user.created_on === "string" && user.created_on) ||
    (typeof user.creation_date === "string" && user.creation_date) ||
    "";

  return {
    ...user,
    created_on: created,
    links: normalizeLinks(user.links),
  };
};

const normalizeAuthResponse = (response: AuthResponse): AuthResponse => ({
  ...response,
  user: normalizeUser(response.user as ApiUserWire),
});

export type FeedSort = "time" | "likes" | "new" | "recent" | "popular" | "hot";

export const getPostsFeed = (type: FeedSort, start = 0, count = 10) =>
  request<ApiPost[]>(`/feed/posts?type=${type}&start=${start}&count=${count}`);

export const getFollowingPostsFeed = (
  username: string,
  start = 0,
  count = 10,
  sort: FeedSort = "recent",
) =>
  request<ApiPost[]>(
    `/feed/posts/following/${username}?start=${start}&count=${count}&sort=${sort}`,
  );

export const getSavedPostsFeed = (
  username: string,
  start = 0,
  count = 10,
  sort: FeedSort = "recent",
) =>
  request<ApiPost[]>(`/feed/posts/saved/${username}?start=${start}&count=${count}&sort=${sort}`);

export const registerUser = async (payload: AuthRegisterRequest) => {
  const response = await request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeAuthResponse(response);
};

export const loginUser = async (payload: AuthLoginRequest) => {
  const response = await request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return normalizeAuthResponse(response);
};

export const getMe = async () => {
  const user = await request<ApiUserWire>("/auth/me");
  const normalized = normalizeUser(user);
  setUserCache(normalized);
  return normalized;
};

export const getProjectsFeed = (
  type: FeedSort,
  start = 0,
  count = 10
) => request<ApiProject[]>(`/feed/projects?type=${type}&start=${start}&count=${count}`);

export const getFollowingProjectsFeed = (
  username: string,
  start = 0,
  count = 10,
  sort: FeedSort = "recent",
) =>
  request<ApiProject[]>(
    `/feed/projects/following/${username}?start=${start}&count=${count}&sort=${sort}`,
  );

export const getSavedProjectsFeed = (
  username: string,
  start = 0,
  count = 10,
  sort: FeedSort = "recent",
) =>
  request<ApiProject[]>(
    `/feed/projects/saved/${username}?start=${start}&count=${count}&sort=${sort}`,
  );

export const getUserByUsername = async (username: string) => {
  const user = await request<ApiUserWire>(`/users/${username}`);
  const normalized = normalizeUser(user);
  setUserCache(normalized);
  return normalized;
};

export const getUserById = async (userId: number) => {
  const cached = isFreshReadWindowActive() ? null : getFreshUserCache(userId);
  if (cached) {
    return cached;
  }
  const wireUser = await request<ApiUserWire>(`/users/id/${userId}`, undefined, {
    forceFresh: isFreshReadWindowActive(),
  });
  const user = normalizeUser(wireUser);
  setUserCache(user);
  return user;
};

export type ManagedMediaItem = {
  filename: string;
  url: string;
};

export const getMyManagedMedia = (username: string) =>
  request<{ items: ManagedMediaItem[] }>(`/users/${username}/media`);

export const deleteMyManagedMedia = (
  username: string,
  payload: { filenames?: string[]; deleteAll?: boolean },
) =>
  request<{ message: string; removed: number }>(`/users/${username}/media`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });

export const getAllUsers = async (start = 0, count = 50) => {
  const users = await request<ApiUserWire[]>(`/users?start=${start}&count=${count}`);
  return users.map(normalizeUser);
};

export const getProjectById = async (projectId: number) => {
  return request<ApiProject>(`/projects/${projectId}`);
};

export const getProjectsByUserId = (userId: number) =>
  request<ApiProject[]>(`/projects/by-user/${userId}`);

export const getProjectsByBuilderId = (userId: number) =>
  request<ApiProject[]>(`/projects/by-builder/${userId}`);

export const getPostsByUserId = (userId: number) =>
  request<ApiPost[]>(`/posts/by-user/${userId}`);

export const getPostsByProjectId = (projectId: number) =>
  request<ApiPost[]>(`/posts/by-project/${projectId}`);

export const createPost = (payload: CreatePostRequest) =>
  request<{ message: string }>("/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const createProject = (payload: CreateProjectRequest) =>
  request<{ message: string }>("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateProject = (
  projectId: number,
  payload: Partial<CreateProjectRequest>,
) =>
  request<{ message: string; project: ApiProject }>(`/projects/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteProject = (projectId: number) =>
  request<{ message: string }>(`/projects/${projectId}`, {
    method: "DELETE",
  });

export const getPostById = (postId: number) =>
  request<ApiPost>(`/posts/${postId}`);

export const likePost = (username: string, postId: number) =>
  request<{ message: string }>(`/posts/${username}/likes/${postId}`, {
    method: "POST",
  });

export const unlikePost = (username: string, postId: number) =>
  request<{ message: string }>(`/posts/${username}/unlikes/${postId}`, {
    method: "POST",
  });

export const isPostLiked = (username: string, postId: number) =>
  request<{ status: boolean }>(`/posts/does-like/${username}/${postId}`);

export const getCommentsByPostId = (postId: number) =>
  request<ApiComment[]>(`/comments/by-post/${postId}`);

export const createCommentOnPost = (postId: number, payload: CreateCommentRequest) =>
  request<{ message: string }>(`/comments/for-post/${postId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const likeComment = (username: string, commentId: number) =>
  request<{ message: string }>(`/comments/${username}/likes/${commentId}`, {
    method: "POST",
  });

export const unlikeComment = (username: string, commentId: number) =>
  request<{ message: string }>(`/comments/${username}/unlikes/${commentId}`, {
    method: "POST",
  });

export const isCommentLiked = (username: string, commentId: number) =>
  request<{ status: boolean }>(`/comments/does-like/${username}/${commentId}`);

export const getUsersFollowers = async (username: string) => {
  const response = await request<unknown>(`/users/${username}/followers`);
  return normalizeUserIdList(response);
};

export const getUsersFollowing = async (username: string) => {
  const response = await request<unknown>(`/users/${username}/follows`);
  return normalizeUserIdList(response);
};

export const getUsersFollowersUsernames = async (username: string) => {
  const response = await request<{ followers?: string[] }>(
    `/users/${username}/followers/usernames`,
  );
  return response?.followers ?? [];
};

export const getUsersFollowingUsernames = async (username: string) => {
  const response = await request<{ following?: string[] }>(
    `/users/${username}/follows/usernames`,
  );
  return response?.following ?? [];
};

export const getProjectFollowing = (username: string) =>
  request<number[]>(`/projects/follows/${username}`);

export const followUser = (username: string, target: string) =>
  request<{ message: string }>(`/users/${username}/follow/${target}`, {
    method: "POST",
  });

export const unfollowUser = (username: string, target: string) =>
  request<{ message: string }>(`/users/${username}/unfollow/${target}`, {
    method: "POST",
  });

export const followProject = (username: string, projectId: number) =>
  request<{ message: string }>(`/projects/user/${username}/follow/${projectId}`, {
    method: "POST",
  });

export const unfollowProject = async (username: string, projectId: number) => {
  try {
    return await request<{ message: string }>(
      `/projects/user/${username}/unfollow/${projectId}`,
      {
        method: "POST",
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("User is not following this project")) {
      return { message: "User is not following this project" };
    }
    throw error;
  }
};

export const likeProject = (username: string, projectId: number) =>
  request<{ message: string }>(`/projects/user/${username}/likes/${projectId}`, {
    method: "POST",
  });

export const unlikeProject = (username: string, projectId: number) =>
  request<{ message: string }>(`/projects/user/${username}/unlikes/${projectId}`, {
    method: "POST",
  });

export const isProjectLiked = (username: string, projectId: number) =>
  request<{ status: boolean }>(`/projects/does-like/${username}/${projectId}`);

export const updateUser = async (username: string, payload: UpdateUserRequest) => {
  const pictureValue = typeof payload.picture === "string" ? payload.picture.trim() : "";
  const timeoutMs = pictureValue.startsWith("data:")
    ? LARGE_REQUEST_TIMEOUT_MS
    : REQUEST_TIMEOUT_MS;
  // Use POST /users/:username/update instead of PUT /users/:username
  // because iOS CFNetwork intermittently drops PUT request bodies,
  // causing silent 400 errors.  POST bodies are delivered reliably.
  const response = await request<{ message: string; user: ApiUserWire }>(`/users/${username}/update`, {
    method: "POST",
    body: JSON.stringify(payload),
  }, { timeoutMs });
  const normalizedUser = normalizeUser(response.user);
  setUserCache(normalizedUser);
  return {
    ...response,
    user: normalizedUser,
  };
};

export const deleteUser = (username: string) =>
  request<{ message: string }>(`/users/${username}`, {
    method: "DELETE",
  });

export const getProjectBuilders = (projectId: number) =>
  request<string[]>(`/projects/${projectId}/builders`);

export const addProjectBuilder = (projectId: number, username: string) =>
  request<{ message: string }>(`/projects/${projectId}/builders/${username}`, {
    method: "POST",
  });

export const removeProjectBuilder = (projectId: number, username: string) =>
  request<{ message: string }>(`/projects/${projectId}/builders/${username}`, {
    method: "DELETE",
  });

export const updatePost = (
  postId: number,
  payload: {
    content?: string;
    project?: number;
    user?: number;
    media?: string[];
  },
) =>
  request<{ message: string; post: ApiPost }>(`/posts/${postId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deletePost = (postId: number) =>
  request<{ message: string }>(`/posts/${postId}`, {
    method: "DELETE",
  });

export const updateComment = (
  commentId: number,
  payload: { content: string; media?: string[] },
) =>
  request<{ message: string; comment: ApiComment }>(`/comments/${commentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteComment = (commentId: number) =>
  request<{ message: string }>(`/comments/${commentId}`, {
    method: "DELETE",
  });

export const savePost = (username: string, postId: number) =>
  request<{ message: string }>(`/posts/${username}/save/${postId}`, {
    method: "POST",
  });

export const unsavePost = (username: string, postId: number) =>
  request<{ message: string }>(`/posts/${username}/unsave/${postId}`, {
    method: "POST",
  });

export const getSavedPosts = (username: string) =>
  request<number[]>(`/posts/saved/${username}`);

export const registerPushToken = (payload: {
  token: string;
  platform: string;
}) =>
  request<{ message: string }>("/notifications/push-token", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getNotifications = (start = 0, count = 50) =>
  request<ApiNotification[]>(`/notifications?start=${start}&count=${count}`);

export const getNotificationCount = () =>
  request<{ count: number }>("/notifications/unread-count");

export const markNotificationRead = (notificationId: number) =>
  request<{ message: string }>(`/notifications/${notificationId}/read`, {
    method: "POST",
  });

export const deleteNotification = (notificationId: number) =>
  request<{ message: string }>(`/notifications/${notificationId}`, {
    method: "DELETE",
  });

export const clearNotifications = () =>
  request<{ message: string }>("/notifications", {
    method: "DELETE",
  });

export const getDirectChatPeers = async (username: string) => {
  const response = await request<{ message?: string; peers?: string[] }>(
    `/messages/${username}/peers`,
  );
  return response?.peers ?? [];
};

export const getDirectMessageThreads = async (
  username: string,
  start = 0,
  count = 50,
) => {
  const response = await request<{
    message?: string;
    threads?: ApiDirectMessageThread[];
  }>(`/messages/${username}/threads?start=${start}&count=${count}`);
  return response?.threads ?? [];
};

export const getDirectMessages = (
  username: string,
  other: string,
  start = 0,
  count = 100,
) =>
  request<ApiDirectMessage[]>(
    `/messages/${username}/with/${other}?start=${start}&count=${count}`,
  );

export const createDirectMessage = (
  username: string,
  other: string,
  content: string,
) =>
  request<{ message: string; direct_message: ApiDirectMessage }>(
    `/messages/${username}/with/${other}`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    },
  );

const normalizeUploadUri = (uri: string) => {
  const source = uri.trim();
  if (!source) {
    return source;
  }
  if (/^file:\/\/\/var\/mobile\//i.test(source)) {
    return encodeURI(source);
  }
  if (/^file:\/var\/mobile\//i.test(source)) {
    const normalized = source.replace(/^file:\/+/, "");
    return encodeURI(`file:///${normalized}`);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(source)) {
    return /^file:/i.test(source) ? encodeURI(source) : source;
  }
  if (source.startsWith("//")) {
    return `file:${source}`;
  }
  if (source.startsWith("/")) {
    return `file://${source}`;
  }
  return source;
};

export const uploadMedia = async (file: {
  uri: string;
  name: string;
  type: string;
}): Promise<{
  url: string;
  filename: string;
  contentType?: string;
  size?: number;
}> => {
  const normalizedUri = normalizeUploadUri(file.uri);

  const headers = new Headers();
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  headers.set("Accept", "application/json");

  // Retry a few times for transient network issues only.
  const MAX_RETRIES = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const body = new FormData();
    (body as any).append("file", {
      uri: normalizedUri,
      name: file.name,
      type: file.type,
    });

    try {
      const response = await uploadMultipartWithFallback("/media/upload", body, headers);

      const text = response.responseText;
      if (response.status < 200 || response.status >= 300) {
        const detail = text || `Upload failed (${response.status})`;
        const retryable = response.status >= 500 || response.status === 429;
        const error = new Error(detail) as Error & { retryable?: boolean };
        error.retryable = retryable;
        throw error;
      }
      if (!text) {
        throw new Error("Empty upload response");
      }
      const parsed = JSON.parse(text) as {
        url: string;
        filename: string;
        contentType?: string;
        size?: number;
      };
      return {
        ...parsed,
        url: resolveMediaUrl(parsed.url),
      };
    } catch (err) {
      lastError = err;
      const retryableError =
        (err as { retryable?: boolean } | null)?.retryable === true ||
        isTransientUploadError(err);

      if (attempt < MAX_RETRIES && retryableError) {
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }

      break;
    }
  }

  try {
    return await buildInlineMediaFallback(file);
  } catch (fallbackError) {
    const primaryDetail =
      lastError instanceof Error ? (lastError as Error).message : String(lastError);
    const fallbackDetail =
      fallbackError instanceof Error
        ? fallbackError.message
        : String(fallbackError);
    throw new Error(
      `Upload failed. Multipart: ${primaryDetail}. Fallback: ${fallbackDetail}`,
    );
  }
};
