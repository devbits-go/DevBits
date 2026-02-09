// the types package is used for creating types that will be
// used multiple times across many packages, so we can make
// use of all of the types in a single package
//
// Some of the structs that will be used to interface between
// frontend, api, and db. This will allow for good handling of
// types
package types

import (
	"database/sql"
	"encoding/json"
	"time"
)

type User struct {
	ID           int64        `json:"id"`
	Username     string       `json:"username" binding:"required"`
	Bio          string       `json:"bio"`
	Links        []string     `json:"links"`
	CreationDate time.Time    `json:"created_on"`
	Picture      string       `json:"picture"`
	Settings     UserSettings `json:"settings"`
}

type UserSettings struct {
	BackgroundRefreshEnabled bool   `json:"backgroundRefreshEnabled"`
	RefreshIntervalMs        int64  `json:"refreshIntervalMs"`
	ZenMode                  bool   `json:"zenMode"`
	CompactMode              bool   `json:"compactMode"`
	AccentColor              string `json:"accentColor"`
	LinkOpenMode             string `json:"linkOpenMode"`
}

type Project struct {
	ID           int64     `json:"id"`
	Owner        int64     `json:"owner" binding:"required"`
	Name         string    `json:"name" binding:"required"`
	Description  string    `json:"description" binding:"required"`
	AboutMd      string    `json:"about_md"`
	Status       int16     `json:"status"`
	Likes        int64     `json:"likes"`
	Tags         []string  `json:"tags"`
	Links        []string  `json:"links"`
	Media        []string  `json:"media"`
	CreationDate time.Time `json:"creation_date"`
}

type Post struct {
	ID           int64     `json:"id"`
	User         int64     `json:"user" binding:"required"`
	Project      int64     `json:"project" binding:"required"`
	Likes        int64     `json:"likes"`
	Content      string    `json:"content" binding:"required"`
	Media        []string  `json:"media"`
	CreationDate time.Time `json:"created_on"`
}

type Comment struct {
	ID            int64         `json:"id"`
	User          int64         `json:"user" binding:"required"`
	Likes         int64         `json:"likes"`
	ParentComment NullableInt64 `json:"parent_comment" binding:"required"`
	CreationDate  time.Time     `json:"created_on"`
	Content       string        `json:"content" binding:"required"`
	Media         []string      `json:"media"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

type Notification struct {
	ID           int64      `json:"id"`
	UserID       int64      `json:"user_id"`
	ActorID      int64      `json:"actor_id"`
	ActorName    string     `json:"actor_name"`
	ActorPicture string     `json:"actor_picture"`
	Type         string     `json:"type"`
	PostID       *int64     `json:"post_id"`
	ProjectID    *int64     `json:"project_id"`
	CommentID    *int64     `json:"comment_id"`
	CreatedAt    time.Time  `json:"created_at"`
	ReadAt       *time.Time `json:"read_at"`
}

type PushToken struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"user_id"`
	Token     string    `json:"token"`
	Platform  string    `json:"platform"`
	CreatedAt time.Time `json:"created_at"`
}

// we can implement this type...
type NullableInt64 struct {
	sql.NullInt64
}

// ...so that we can create custom functions on it
func (n *NullableInt64) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		n.Valid = false
		return nil
	}

	var number int64
	if err := json.Unmarshal(data, &number); err != nil {
		return err
	}

	n.Int64 = number
	n.Valid = true
	return nil
}

func (n NullableInt64) MarshalJSON() ([]byte, error) {
	if !n.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(n.Int64)
}
