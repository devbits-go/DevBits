/* Created with https://stirlingmarketinggroup.github.io/go2ts/*/

export interface UserProps {
    id?: number;
    username: string;
    bio: string;
    links: string[];
    created_on: string;
    picture: string;
}

export interface ProjectProps {
    id: number;
    owner: number;
    name: string;
    description: string;
    about_md?: string;
    status: number;
    likes: number;
    saves?: number;
    tags: string[];
    links: string[];
    media?: string[];
    creation_date: string;
}

export interface PostProps {
    id: number;
    user: number;
    project: number;
    likes: number;
    saves?: number;
    content: string;
    media?: string[];
    comments: number[];
    created_on: string;
}

export interface CommentProps {
    id: number;
    user: number;
    post: number;
    likes: number;
    parent_comment: number;
    created_on: string;
    content: string;
    media?: string[];
}

export interface ErrorResponseProps {
    error: string;
    message: string;
}

export interface AuthRegisterRequest {
    username: string;
    password: string;
    bio?: string;
    links?: string[];
    picture?: string;
}

export interface UserSettings {
    backgroundRefreshEnabled: boolean;
    refreshIntervalMs: number;
    zenMode: boolean;
    compactMode: boolean;
    accentColor: string;
    linkOpenMode: "asTyped" | "promptScheme";
}

export interface AuthLoginRequest {
    username: string;
    password: string;
}

export interface AuthResponse {
    token: string;
    user: ApiUser;
}

export interface CreatePostRequest {
    user: number;
    project: number;
    content: string;
    media?: string[];
}

export interface CreateProjectRequest {
    owner: number;
    name: string;
    description: string;
    about_md?: string;
    status?: number;
    tags?: string[];
    links?: string[];
    media?: string[];
}

export interface CreateCommentRequest {
    user: number;
    content: string;
    parent_comment?: number | null;
    media?: string[];
}

export interface UpdateUserRequest {
    username?: string;
    bio?: string;
    links?: string[];
    picture?: string;
    settings?: UserSettings;
}

export interface ApiUser {
    id: number;
    username: string;
    bio: string;
    links: string[];
    created_on: string;
    picture: string;
    settings?: UserSettings;
}

export interface ApiProject {
    id: number;
    owner: number;
    name: string;
    description: string;
    about_md?: string;
    status: number;
    likes: number;
    saves: number;
    tags: string[];
    links: string[];
    media?: string[];
    creation_date: string;
}

export interface ApiPost {
    id: number;
    user: number;
    project: number;
    likes: number;
    saves: number;
    content: string;
    media?: string[];
    created_on: string;
}

export interface ApiComment {
    id: number;
    user: number;
    likes: number;
    parent_comment: number | null;
    created_on: string;
    content: string;
    media?: string[];
}

export interface ApiNotification {
    id: number;
    user_id: number;
    actor_id: number;
    actor_name: string;
    actor_picture: string;
    type: string;
    post_id?: number | null;
    project_id?: number | null;
    comment_id?: number | null;
    created_at: string;
    read_at?: string | null;
}

export interface ApiDirectMessage {
    id: number;
    sender_id: number;
    recipient_id: number;
    sender_name: string;
    recipient_name: string;
    content: string;
    created_at: string;
}

export interface UiPost {
    id: number;
    username: string;
    userPicture?: string;
    userId: number;
    projectName: string;
    projectStage: string;
    likes: number;
    saves: number;
    comments: number;
    content: string;
    media?: string[];
    created_on: string;
    tags: string[];
}

export interface UiProject {
    id: number;
    ownerId: number;
    name: string;
    summary: string;
    about_md?: string;
    stage: string;
    likes: number;
    saves: number;
    contributors: number;
    tags: string[];
    media?: string[];
    updated_on: string;
}

export interface UiPerson {
    id: number;
    name: string;
    title: string;
    focus: string;
    picture?: string;
}