-- Drop tables if they already exist
DROP TABLE IF EXISTS UserLoginInfo;

DROP TABLE IF EXISTS Users;
DROP TABLE IF EXISTS UserFollows;

DROP TABLE IF EXISTS Projects;
DROP TABLE IF EXISTS ProjectLikes;
DROP TABLE IF EXISTS ProjectFollows;
DROP TABLE IF EXISTS ProjectComments;

DROP TABLE IF EXISTS Posts;
DROP TABLE IF EXISTS PostLikes;
DROP TABLE IF EXISTS PostComments;

DROP TABLE IF EXISTS Comments;
DROP TABLE IF EXISTS CommentLikes;

DROP TABLE IF EXISTS PostSaves;
DROP TABLE IF EXISTS Notifications;
DROP TABLE IF EXISTS UserPushTokens;

-- UserLoginInfo
CREATE TABLE UserLoginInfo (
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    PRIMARY KEY(username)
);

-- Users Table
CREATE TABLE Users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    picture TEXT,
    bio TEXT,
    links JSON,
    settings JSON,
    creation_date TIMESTAMP NOT NULL
);

-- Projects Table
CREATE TABLE Projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    about_md TEXT,
    status INTEGER,
    likes INTEGER DEFAULT 0,
    links JSON,
    tags JSON,
    media JSON,
    owner INTEGER NOT NULL,
    creation_date TIMESTAMP NOT NULL,
    FOREIGN KEY (owner) REFERENCES Users(id) ON DELETE CASCADE
);

-- Project Builders (Collaborators)
CREATE TABLE ProjectBuilders (
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Project Comments Table (Normalizing comments relationship)
CREATE TABLE ProjectComments (
    project_id INTEGER NOT NULL,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES Comments(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, comment_id)
);

-- Posts Table
CREATE TABLE Posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    media JSON,
    project_id INTEGER NOT NULL,
    creation_date TIMESTAMP NOT NULL,
    user_id INTEGER NOT NULL,
    likes INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Project Comments Table (Normalizing comments relationship)
CREATE TABLE PostComments (
    post_id INTEGER NOT NULL,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES Comments(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, comment_id)
);

-- Comments Table
CREATE TABLE Comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    media JSON,
    parent_comment_id INTEGER,
    likes INTEGER DEFAULT 0,
    creation_date TIMESTAMP NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (parent_comment_id) REFERENCES Comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Likes for Projects
CREATE TABLE ProjectLikes (
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Likes for Posts
CREATE TABLE PostLikes (
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Likes for Comments
CREATE TABLE CommentLikes (
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (comment_id, user_id),
    FOREIGN KEY (comment_id) REFERENCES Comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Saved Posts
CREATE TABLE PostSaves (
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    creation_date TIMESTAMP NOT NULL,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Notifications
CREATE TABLE Notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    actor_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    post_id INTEGER,
    project_id INTEGER,
    comment_id INTEGER,
    created_at TIMESTAMP NOT NULL,
    read_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES Posts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES Comments(id) ON DELETE CASCADE
);

-- Push tokens for notifications
CREATE TABLE UserPushTokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    platform TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Follows between Users (User Following)
CREATE TABLE UserFollows (
    follower_id INTEGER NOT NULL,
    follows_id INTEGER NOT NULL,
    PRIMARY KEY (follower_id, follows_id),
    FOREIGN KEY (follower_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (follows_id) REFERENCES Users(id) ON DELETE CASCADE,
    CHECK (follower_id != follows_id)
);

-- Follows for Projects (User Following a Project)
CREATE TABLE ProjectFollows (
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Indexes for scalability
CREATE INDEX IF NOT EXISTS idx_users_creation_date ON Users(creation_date DESC);

CREATE INDEX IF NOT EXISTS idx_projects_creation_date ON Projects(creation_date DESC);
CREATE INDEX IF NOT EXISTS idx_projects_likes ON Projects(likes DESC);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON Projects(owner);
CREATE INDEX IF NOT EXISTS idx_project_builders_project ON ProjectBuilders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_builders_user ON ProjectBuilders(user_id);

CREATE INDEX IF NOT EXISTS idx_posts_creation_date ON Posts(creation_date DESC);
CREATE INDEX IF NOT EXISTS idx_posts_likes ON Posts(likes DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON Posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_project_id ON Posts(project_id);

CREATE INDEX IF NOT EXISTS idx_comments_creation_date ON Comments(creation_date DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON Comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON Comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON UserFollows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follows ON UserFollows(follows_id);

CREATE INDEX IF NOT EXISTS idx_project_follows_project ON ProjectFollows(project_id);
CREATE INDEX IF NOT EXISTS idx_project_follows_user ON ProjectFollows(user_id);

CREATE INDEX IF NOT EXISTS idx_project_likes_user ON ProjectLikes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON PostLikes(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON CommentLikes(user_id);

CREATE INDEX IF NOT EXISTS idx_post_saves_user ON PostSaves(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON Notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON Notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON UserPushTokens(user_id);
