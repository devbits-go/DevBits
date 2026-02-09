package database

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"backend/api/internal/types"
)

type NotificationInsert struct {
	UserID    int64
	ActorID   int64
	Type      string
	PostID    *int64
	ProjectID *int64
	CommentID *int64
}

func CreateNotification(input NotificationInsert) (*types.Notification, int, error) {
	if input.UserID == input.ActorID {
		return nil, http.StatusOK, nil
	}

	createdAt := time.Now().UTC()
	query := `INSERT INTO Notifications
		(user_id, actor_id, type, post_id, project_id, comment_id, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?);`

	res, err := DB.Exec(
		query,
		input.UserID,
		input.ActorID,
		input.Type,
		input.PostID,
		input.ProjectID,
		input.CommentID,
		createdAt,
	)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to create notification: %v", err)
	}

	id, err := res.LastInsertId()
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("failed to fetch notification id: %v", err)
	}

	actorName, _ := GetUsernameById(input.ActorID)
	actorPicture := ""
	if actorName != "" {
		user, err := QueryUsername(actorName)
		if err == nil && user != nil {
			actorPicture = user.Picture
		}
	}

	notification := &types.Notification{
		ID:           id,
		UserID:       input.UserID,
		ActorID:      input.ActorID,
		ActorName:    actorName,
		ActorPicture: actorPicture,
		Type:         input.Type,
		PostID:       input.PostID,
		ProjectID:    input.ProjectID,
		CommentID:    input.CommentID,
		CreatedAt:    createdAt,
		ReadAt:       nil,
	}

	return notification, http.StatusCreated, nil
}

func QueryNotificationsByUser(userID int64, start int, count int) ([]types.Notification, int, error) {
	query := `SELECT n.id, n.user_id, n.actor_id, u.username, u.picture, n.type,
		 n.post_id, n.project_id, n.comment_id, n.created_at, n.read_at
		FROM Notifications n
		JOIN Users u ON u.id = n.actor_id
		WHERE n.user_id = ?
		ORDER BY n.created_at DESC
		LIMIT ? OFFSET ?;`

	rows, err := DB.Query(query, userID, count, start)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	defer rows.Close()

	list := []types.Notification{}
	for rows.Next() {
		var item types.Notification
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
	query := `UPDATE Notifications SET read_at = ? WHERE id = ? AND user_id = ?;`
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
	query := `DELETE FROM Notifications WHERE id = ? AND user_id = ?;`
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
	query := `DELETE FROM Notifications WHERE user_id = ?;`
	_, err := DB.Exec(query, userID)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	return http.StatusOK, nil
}

func DeleteNotificationByReference(userID int64, actorID int64, nType string, postID *int64, projectID *int64) (int, error) {
	query := `DELETE FROM Notifications WHERE user_id = ? AND actor_id = ? AND type = ?
		AND (post_id IS ? OR post_id = ?) AND (project_id IS ? OR project_id = ?);`
	_, err := DB.Exec(query, userID, actorID, nType, postID, postID, projectID, projectID)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	return http.StatusOK, nil
}

func GetUnreadNotificationCount(userID int64) (int64, int, error) {
	query := `SELECT COUNT(*) FROM Notifications WHERE user_id = ? AND read_at IS NULL;`
	row := DB.QueryRow(query, userID)
	var count int64
	if err := row.Scan(&count); err != nil {
		return 0, http.StatusInternalServerError, err
	}
	return count, http.StatusOK, nil
}

func UpsertPushToken(userID int64, token string, platform string) (int, error) {
	query := `INSERT INTO UserPushTokens (user_id, token, platform, created_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, platform = excluded.platform;`
	_, err := DB.Exec(query, userID, token, platform, time.Now().UTC())
	if err != nil {
		return http.StatusInternalServerError, err
	}
	return http.StatusOK, nil
}

func QueryPushTokens(userID int64) ([]types.PushToken, int, error) {
	query := `SELECT id, user_id, token, platform, created_at FROM UserPushTokens WHERE user_id = ?;`
	rows, err := DB.Query(query, userID)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	defer rows.Close()

	list := []types.PushToken{}
	for rows.Next() {
		var item types.PushToken
		if err := rows.Scan(&item.ID, &item.UserID, &item.Token, &item.Platform, &item.CreatedAt); err != nil {
			return nil, http.StatusInternalServerError, err
		}
		list = append(list, item)
	}
	return list, http.StatusOK, nil
}
