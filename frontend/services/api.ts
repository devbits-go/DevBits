import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  ApiPost,
  ApiProject,
  ApiUser,
  ApiComment,
  ApiNotification,
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthResponse,
  CreateCommentRequest,
  CreateProjectRequest,
  CreatePostRequest,
  UpdateUserRequest,
} from "@/constants/Types";

const userCache = new Map<number, ApiUser>();
const projectCache = new Map<number, ApiProject>();
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const clearApiCache = () => {
  userCache.clear();
  projectCache.clear();
};

const getHostFromUri = (uri?: string | null) => {
  if (!uri) {
    return null;
  }
  const withoutProtocol = uri.replace(/^[a-z]+:\/\//i, "");
  const host = withoutProtocol.split(":")[0];
  return host || null;
};

const getDefaultBaseUrl = () => {
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
    return `http://${host}:8080`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8080";
  }

  return "http://localhost:8080";
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || getDefaultBaseUrl();

export const resolveMediaUrl = (value?: string | null) => {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return trimmed;
  }
  const normalized = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  if (normalized.startsWith("uploads/")) {
    return `${API_BASE_URL}/${normalized}`;
  }
  return trimmed;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const authHeader = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status})`);
  }

  if (!text) {
    return null as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`Invalid JSON response: ${text}`);
  }
};

export const getPostsFeed = (type: "time" | "likes", start = 0, count = 10) =>
  request<ApiPost[]>(`/feed/posts?type=${type}&start=${start}&count=${count}`);

export const registerUser = (payload: AuthRegisterRequest) =>
  request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const loginUser = (payload: AuthLoginRequest) =>
  request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getMe = () => request<ApiUser>("/auth/me");

export const getProjectsFeed = (
  type: "time" | "likes",
  start = 0,
  count = 10
) => request<ApiProject[]>(`/feed/projects?type=${type}&start=${start}&count=${count}`);

export const getUserByUsername = (username: string) =>
  request<ApiUser>(`/users/${username}`);

export const getUserById = async (userId: number) => {
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }
  const user = await request<ApiUser>(`/users/id/${userId}`);
  userCache.set(userId, user);
  return user;
};

export const getAllUsers = (start = 0, count = 50) =>
  request<ApiUser[]>(`/users?start=${start}&count=${count}`);

export const getProjectById = async (projectId: number) => {
  if (projectCache.has(projectId)) {
    return projectCache.get(projectId)!;
  }
  const project = await request<ApiProject>(`/projects/${projectId}`);
  projectCache.set(projectId, project);
  return project;
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

export const getUsersFollowers = (username: string) =>
  request<number[]>(`/users/${username}/followers`);

export const getUsersFollowing = (username: string) =>
  request<number[]>(`/users/${username}/follows`);

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

export const updateUser = (username: string, payload: UpdateUserRequest) =>
  request<{ message: string; user: ApiUser }>(`/users/${username}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

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

export const uploadMedia = async (file: {
  uri: string;
  name: string;
  type: string;
}) => {
  const authHeader = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const body = new FormData();
  body.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.type,
  } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/media/upload`, {
    method: "POST",
    headers: {
      ...authHeader,
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Request failed (${response.status})`);
  }
  if (!text) {
    return null as {
      url: string;
      filename: string;
      contentType?: string;
      size?: number;
    };
  }
  return JSON.parse(text) as {
    url: string;
    filename: string;
    contentType?: string;
    size?: number;
  };
};
