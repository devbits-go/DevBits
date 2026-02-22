package handlers

import (
	"backend/api/internal/database"
)

func createAndPushNotification(userID int64, actorID int64, nType string, postID *int64, projectID *int64, commentID *int64, body string) {
	notification, _, err := database.CreateNotification(database.NotificationInsert{
		UserID:    userID,
		ActorID:   actorID,
		Type:      nType,
		PostID:    postID,
		ProjectID: projectID,
		CommentID: commentID,
	})
	if err != nil || notification == nil {
		return
	}

	go SendNotificationPush(userID, notification, body)
}

func notificationBody(actorName string, text string) string {
	if actorName == "" {
		return text
	}
	return actorName + " " + text
}
