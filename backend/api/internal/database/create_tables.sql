-- UserLoginInfo
CREATE TABLE IF NOT EXISTS userlogininfo (
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    PRIMARY KEY(username)
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    picture TEXT,
    bio TEXT,
    links JSON,
    settings JSON,
    creation_date TIMESTAMP NOT NULL
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
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
    FOREIGN KEY (owner) REFERENCES users(id) ON DELETE CASCADE
);

-- Project Builders (Collaborators)
CREATE TABLE IF NOT EXISTS projectbuilders (
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    parent_comment_id INTEGER,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    media JSON,
    likes INTEGER DEFAULT 0,
    creation_date TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Project Comments Table (Normalizing comments relationship)
CREATE TABLE IF NOT EXISTS projectcomments (
    project_id INTEGER NOT NULL,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, comment_id)
);

-- Posts Table
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    media JSON,
    project_id INTEGER,
    creation_date TIMESTAMP NOT NULL,
    user_id INTEGER NOT NULL,
    likes INTEGER DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Post Comments Table (Normalizing comments relationship)
CREATE TABLE IF NOT EXISTS postcomments (
    post_id INTEGER NOT NULL,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, comment_id)
);

-- User Follows Table
CREATE TABLE IF NOT EXISTS userfollows (
    follower_id INTEGER NOT NULL,
    followed_id INTEGER NOT NULL,
    PRIMARY KEY (follower_id, followed_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Project Likes Table
CREATE TABLE IF NOT EXISTS projectlikes (
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, project_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Project Follows Table
CREATE TABLE IF NOT EXISTS projectfollows (
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, project_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Post Likes Table
CREATE TABLE IF NOT EXISTS postlikes (
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- Comment Likes Table
CREATE TABLE IF NOT EXISTS commentlikes (
    user_id INTEGER NOT NULL,
    comment_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, comment_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Post Saves Table
CREATE TABLE IF NOT EXISTS postsaves (
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- Direct Messages Table
CREATE TABLE IF NOT EXISTS directmessages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    creation_date TIMESTAMP NOT NULL,
    read_at TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    actor_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    post_id INTEGER,
    project_id INTEGER,
    comment_id INTEGER,
    created_at TIMESTAMP NOT NULL,
    read_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- User Push Tokens Table
CREATE TABLE IF NOT EXISTS userpushtokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    platform TEXT,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_project_id ON posts(project_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_userfollows_follower_id ON userfollows(follower_id);
CREATE INDEX IF NOT EXISTS idx_userfollows_followed_id ON userfollows(followed_id);
CREATE INDEX IF NOT EXISTS idx_projectlikes_project_id ON projectlikes(project_id);
CREATE INDEX IF NOT EXISTS idx_projectfollows_project_id ON projectfollows(project_id);
CREATE INDEX IF NOT EXISTS idx_postlikes_post_id ON postlikes(post_id);
CREATE INDEX IF NOT EXISTS idx_commentlikes_comment_id ON commentlikes(comment_id);
CREATE INDEX IF NOT EXISTS idx_directmessages_sender_recipient ON directmessages(sender_id, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_at ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_userpushtokens_user_id ON userpushtokens(user_id);
