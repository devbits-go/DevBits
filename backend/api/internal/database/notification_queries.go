package database

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"
	"time"
)

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

type NotificationInsert struct {
	UserID    int64
	ActorID   int64
	Type      string
	PostID    *int64
	ProjectID *int64
	CommentID *int64
}

func CreateNotification(input NotificationInsert) (*Notification, int, error) {
	if input.UserID == input.ActorID {
		return nil, http.StatusOK, nil
	}

	createdAt := time.Now().UTC()
	query := `INSERT INTO notifications
		(user_id, actor_id, type, post_id, project_id, comment_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id;`

	var id int64
	err := DB.QueryRow(
		query,
		input.UserID,
		input.ActorID,
		input.Type,
		input.PostID,
		input.ProjectID,
		input.CommentID,
		createdAt,
	).Scan(&id)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create notification: %v", err)
	}

	actor, err := GetUserById(int(input.ActorID))
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to fetch actor: %v", err)
	}

	notification := &Notification{
		ID:           id,
		UserID:       input.UserID,
		ActorID:      input.ActorID,
		ActorName:    actor.Username,
		ActorPicture: actor.Picture,
		Type:         input.Type,
		PostID:       input.PostID,
		ProjectID:    input.ProjectID,
		CommentID:    input.CommentID,
		CreatedAt:    createdAt,
		ReadAt:       nil,
	}

	return notification, http.StatusCreated, nil
}

func QueryNotificationsByUser(userID int64, start int, count int) ([]Notification, int, error) {
	query := `SELECT n.id, n.user_id, n.actor_id, u.username, u.picture, n.type,
		 n.post_id, n.project_id, n.comment_id, n.created_at, n.read_at
		FROM notifications n
		JOIN users u ON u.id = n.actor_id
		WHERE n.user_id = $1
		ORDER BY n.created_at DESC
		LIMIT $2 OFFSET $3;`

	rows, err := DB.Query(query, userID, count, start)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	defer rows.Close()

	list := []Notification{}
	for rows.Next() {
		var item Notification
		var postID sql.NullInt64
		var projectID sql.NullInt64
		var commentID sql.NullInt64
		var readAt sql.NullTime
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.ActorID,
			&item.ActorName,
			&item.ActorPicture,
			&item.Type,
			&postID,
			&projectID,
			&commentID,
			&item.CreatedAt,
			&readAt,
		); err != nil {
			return nil, http.StatusInternalServerError, err
		}
		if postID.Valid {
			value := postID.Int64
			item.PostID = &value
		}
		if projectID.Valid {
			value := projectID.Int64
			item.ProjectID = &value
		}
		if commentID.Valid {
			value := commentID.Int64
			item.CommentID = &value
		}
		if readAt.Valid {
			value := readAt.Time
			item.ReadAt = &value
		}
		list = append(list, item)
	}

	return list, http.StatusOK, nil
}

func MarkNotificationRead(userID int64, notificationID int64) (int, error) {
	query := `UPDATE notifications SET read_at = $1 WHERE id = $2 AND user_id = $3;`
	rowsAffected, err := ExecUpdate(query, time.Now().UTC(), notificationID, userID)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	if rowsAffected == 0 {
		return http.StatusNotFound, fmt.Errorf("notification not found")
	}
	return http.StatusOK, nil
}

func DeleteNotification(userID int64, notificationID int64) (int, error) {
	query := `DELETE FROM notifications WHERE id = $1 AND user_id = $2;`
	rowsAffected, err := ExecUpdate(query, notificationID, userID)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	if rowsAffected == 0 {
		return http.StatusNotFound, fmt.Errorf("notification not found")
	}
	return http.StatusOK, nil
}

func ClearNotifications(userID int64) (int, error) {
	query := `DELETE FROM notifications WHERE user_id = $1;`
	_, err := DB.Exec(query, userID)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	return http.StatusOK, nil
}

func DeleteNotificationByReference(userID int64, actorID int64, nType string, postID *int64, projectID *int64) (int, error) {
	query := `DELETE FROM notifications WHERE user_id = $1 AND actor_id = $2 AND type = $3
		AND (($4::bigint IS NULL AND post_id IS NULL) OR post_id = $4)
		AND (($5::bigint IS NULL AND project_id IS NULL) OR project_id = $5);`
	_, err := DB.Exec(query, userID, actorID, nType, postID, projectID)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	return http.StatusOK, nil
}

func GetUnreadNotificationCount(userID int64) (int64, int, error) {
	query := `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL;`
	row := DB.QueryRow(query, userID)
	var count int64
	if err := row.Scan(&count); err != nil {
		return 0, http.StatusInternalServerError, err
	}
	return count, http.StatusOK, nil
}

func UpsertPushToken(userID int64, token string, platform string) (int, error) {
	token = strings.TrimSpace(token)
	platform = strings.ToLower(strings.TrimSpace(platform))
	if token == "" {
		return http.StatusBadRequest, fmt.Errorf("token is required")
	}
	query := `INSERT INTO userpushtokens (user_id, token, platform, created_at)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform;`
	_, err := DB.Exec(query, userID, token, platform, time.Now().UTC())
	if err != nil {
		return http.StatusInternalServerError, err
	}
	return http.StatusOK, nil
}

func DeletePushToken(token string) (int, error) {
	query := `DELETE FROM userpushtokens WHERE token = $1;`
	_, err := DB.Exec(query, strings.TrimSpace(token))
	if err != nil {
		return http.StatusInternalServerError, err
	}
	return http.StatusOK, nil
}

func QueryPushTokens(userID int64) ([]PushToken, int, error) {
	query := `SELECT id, user_id, token, platform, created_at FROM userpushtokens WHERE user_id = $1;`
	rows, err := DB.Query(query, userID)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	defer rows.Close()

	list := []PushToken{}
	for rows.Next() {
		var item PushToken
		if err := rows.Scan(&item.ID, &item.UserID, &item.Token, &item.Platform, &item.CreatedAt); err != nil {
			return nil, http.StatusInternalServerError, err
		}
		list = append(list, item)
	}
	return list, http.StatusOK, nil
}
