package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"backend/api/internal/database"
	"backend/api/internal/logger"

	"github.com/gin-gonic/gin"
)

// GetUsernameById handles GET requests to fetch a user by their username.
// It expects the `username` parameter in the URL.
// Returns:
// - 400 Bad Request if the username is invalid.
// - 404 Not Found if no user is found with the given username.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and the user data in JSON format.
func GetUsernameById(context *gin.Context) {
	username := context.Param("username")

	user, err := database.GetUserByUsername(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, "Failed to fetch user")
		return
	}

	if user == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("User with username '%v' not found", username))
		return
	}

	context.JSON(http.StatusOK, user)
}

// GetUserByUsername handles GET requests to fetch a user by their username.
// It expects the `username` parameter in the URL.
// Returns:
// - 400 Bad Request if the username is invalid.
// - 404 Not Found if no user is found with the given username.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and the user data in JSON format.
func GetUserByUsername(context *gin.Context) {
	username := context.Param("username")

	user, err := database.GetUserByUsername(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to get user: %v", err))
		return
	}

	if user == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("User with username '%v' not found", username))
		return
	}

	context.JSON(http.StatusOK, user)
}

// GetUserById handles GET requests to fetch a user by their ID.
// It expects the `user_id` parameter in the URL.
// Returns:
// - 400 Bad Request if the user ID is invalid.
// - 404 Not Found if no user is found with the given ID.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and the user data in JSON format.
func GetUserById(context *gin.Context) {
	strId := context.Param("user_id")
	userId, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse user id: %v", err))
		return
	}

	user, err := database.GetUserById(userId)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to get user: %v", err))
		return
	}

	if user == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("User with id '%v' not found", userId))
		return
	}

	context.JSON(http.StatusOK, user)
}

// GetUsers handles GET requests to fetch all users.
// Returns:
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and the users list in JSON format.
func GetUsers(context *gin.Context) {
	// strStart := context.Query("start")
	// strCount := context.Query("count")
	// start := 0
	// count := 50

	// if strStart != "" {
	// 	parsed, err := strconv.Atoi(strStart)
	// 	if err != nil || parsed < 0 {
	// 		RespondWithError(context, http.StatusBadRequest, "Start must be a non-negative integer")
	// 		return
	// 	}
	// 	start = parsed
	// }

	// if strCount != "" {
	// 	parsed, err := strconv.Atoi(strCount)
	// 	if err != nil || parsed <= 0 {
	// 		RespondWithError(context, http.StatusBadRequest, "Count must be a positive integer")
	// 		return
	// 	}
	// 	if parsed > 100 {
	// 		parsed = 100
	// 	}
	// 	count = parsed
	// }

	users, err := database.GetUsers()
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch users: %v", err))
		return
	}

	context.JSON(http.StatusOK, users)
}

// CreateUser handles POST requests to create a new user.
// It expects a JSON body with the user details.
// Returns:
// - 400 Bad Request if the JSON is invalid or the user details are incomplete.
// - 500 Internal Server Error if an error occurs while creating the user.
// On success, responds with a 201 Created status and a message confirming the user creation.
func CreateUser(context *gin.Context) {
	var newUser database.ApiUser
	err := context.BindJSON(&newUser)

	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to bind to JSON: %v", err))
		return
	}
	_, err = database.CreateUser(&newUser)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to create user: %v", err))
		return
	}
	context.JSON(http.StatusCreated, gin.H{"message": fmt.Sprintf("Created new user: '%s'", newUser.Username)})
}

// DeleteUser handles DELETE requests to delete a user.
// It expects the `username` parameter in the URL.
// Returns:
// - 400 Bad Request if the username is invalid.
// - 404 Not Found if no user is found with the given username.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a message confirming the user deletion.
func DeleteUser(context *gin.Context) {
	username := context.Param("username")
	existingUser, err := database.GetUserByUsername(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to resolve user before delete: %v", err))
		return
	}
	if existingUser == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("User '%v' not found.", username))
		return
	}

	managedUploads, err := collectManagedUploadsForUser(existingUser.Id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to collect user media before delete: %v", err))
		return
	}

	err = database.DeleteUser(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to delete user: %v", err))
		return
	}

	removedFiles := removeManagedUploadFiles(managedUploads)
	removedOwnedOrphans := removeOwnerPrefixedUploadFiles(existingUser.Id, managedUploads)
	context.JSON(http.StatusOK, gin.H{
		"message":                fmt.Sprintf("User '%v' deleted.", username),
		"removed_uploads":        removedFiles,
		"removed_orphan_uploads": removedOwnedOrphans,
	})
}

type managedMediaItem struct {
	Filename string `json:"filename"`
	URL      string `json:"url"`
}

func GetUserManagedMedia(context *gin.Context) {
	username := context.Param("username")
	existingUser, err := database.GetUserByUsername(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to resolve user: %v", err))
		return
	}
	if existingUser == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("User '%v' not found.", username))
		return
	}

	referenced, err := collectManagedUploadsForUser(existingUser.Id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to collect media references: %v", err))
		return
	}

	owned := collectOwnerPrefixedUploadFilenames(existingUser.Id)
	for filename := range owned {
		referenced[filename] = struct{}{}
	}

	items := make([]managedMediaItem, 0, len(referenced))
	for filename := range referenced {
		items = append(items, managedMediaItem{
			Filename: filename,
			URL:      fmt.Sprintf("/%s/%s", uploadDir, filename),
		})
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].Filename < items[j].Filename
	})

	context.JSON(http.StatusOK, gin.H{
		"items": items,
	})
}

type deleteManagedMediaRequest struct {
	Filenames []string `json:"filenames"`
	DeleteAll bool     `json:"deleteAll"`
}

func DeleteUserManagedMedia(context *gin.Context) {
	username := context.Param("username")
	existingUser, err := database.GetUserByUsername(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to resolve user: %v", err))
		return
	}
	if existingUser == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("User '%v' not found.", username))
		return
	}

	var payload deleteManagedMediaRequest
	if err := context.BindJSON(&payload); err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Invalid request payload: %v", err))
		return
	}

	referenced, err := collectManagedUploadsForUser(existingUser.Id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to collect media references: %v", err))
		return
	}
	owned := collectOwnerPrefixedUploadFilenames(existingUser.Id)
	for filename := range owned {
		referenced[filename] = struct{}{}
	}

	targets := make(map[string]struct{})
	if payload.DeleteAll {
		for filename := range referenced {
			targets[filename] = struct{}{}
		}
	} else {
		for _, raw := range payload.Filenames {
			filename := strings.TrimSpace(raw)
			if filename == "" || strings.Contains(filename, "/") || strings.Contains(filename, `\\`) {
				continue
			}
			if _, ok := referenced[filename]; ok {
				targets[filename] = struct{}{}
			}
		}
	}

	if len(targets) == 0 {
		context.JSON(http.StatusOK, gin.H{
			"message": "No matching media selected.",
			"removed": 0,
		})
		return
	}

	if err := removeMediaReferencesForUser(existingUser.Id, targets); err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to remove media references: %v", err))
		return
	}

	removedFiles := removeManagedUploadFiles(targets)
	context.JSON(http.StatusOK, gin.H{
		"message": "Media removed successfully.",
		"removed": removedFiles,
	})
}

func collectManagedUploadsForUser(userID int) (map[string]struct{}, error) {
	uploads := make(map[string]struct{})

	addFromPath := func(path string) {
		if filename, ok := extractManagedUploadFilename(path); ok {
			uploads[filename] = struct{}{}
		}
	}

	addFromJSON := func(raw []byte) {
		if len(raw) == 0 {
			return
		}
		var media []string
		if err := json.Unmarshal(raw, &media); err != nil {
			return
		}
		for _, item := range media {
			addFromPath(item)
		}
	}

	var picture sql.NullString
	if err := database.DB.QueryRow("SELECT picture FROM users WHERE id = $1", userID).Scan(&picture); err == nil && picture.Valid {
		addFromPath(picture.String)
	}

	queries := []string{
		"SELECT COALESCE(media, '[]') FROM projects WHERE owner = $1",
		`SELECT COALESCE(p.media, '[]')
		 FROM posts p
		 WHERE p.user_id = $1 OR p.project_id IN (SELECT id FROM projects WHERE owner = $1)`,
		`SELECT COALESCE(c.media, '[]')
		 FROM comments c
		 WHERE c.user_id = $1 OR c.id IN (
		 	SELECT pc.comment_id
		 	FROM postcomments pc
		 	JOIN posts p ON p.id = pc.post_id
		 	WHERE p.user_id = $1 OR p.project_id IN (SELECT id FROM projects WHERE owner = $1)
		 	UNION
		 	SELECT prc.comment_id
		 	FROM projectcomments prc
		 	JOIN projects pr ON pr.id = prc.project_id
		 	WHERE pr.owner = $1
		 )`,
	}

	for _, query := range queries {
		rows, err := database.DB.Query(query, userID)
		if err != nil {
			return nil, err
		}

		for rows.Next() {
			var raw []byte
			if scanErr := rows.Scan(&raw); scanErr != nil {
				rows.Close()
				return nil, scanErr
			}
			addFromJSON(raw)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
	}

	return uploads, nil
}

func removeManagedUploadFiles(uploads map[string]struct{}) int {
	removed := 0
	for filename := range uploads {
		filePath := filepath.Join(uploadDir, filename)
		if err := os.Remove(filePath); err != nil {
			if os.IsNotExist(err) {
				continue
			}
			logger.Log.WithFields(map[string]interface{}{
				"path": filePath,
				"err":  err.Error(),
			}).Warn("Failed to remove managed upload after user delete")
			continue
		}
		removed += 1
	}
	return removed
}

func collectOwnerPrefixedUploadFilenames(userID int) map[string]struct{} {
	result := make(map[string]struct{})
	prefix := fmt.Sprintf("u%d_", userID)

	entries, err := os.ReadDir(uploadDir)
	if err != nil {
		return result
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasPrefix(name, prefix) {
			result[name] = struct{}{}
		}
	}

	return result
}

func removeMediaReferencesForUser(userID int, targets map[string]struct{}) error {
	if len(targets) == 0 {
		return nil
	}

	var picture sql.NullString
	if err := database.DB.QueryRow("SELECT picture FROM users WHERE id = $1", userID).Scan(&picture); err == nil && picture.Valid {
		if filename, ok := extractManagedUploadFilename(picture.String); ok {
			if _, shouldRemove := targets[filename]; shouldRemove {
				if _, updateErr := database.DB.Exec("UPDATE users SET picture = '' WHERE id = $1", userID); updateErr != nil {
					return updateErr
				}
			}
		}
	}

	if err := pruneMediaColumnRows("projects", "owner", userID, targets); err != nil {
		return err
	}
	if err := pruneMediaColumnRows("posts", "user_id", userID, targets); err != nil {
		return err
	}
	if err := pruneMediaColumnRows("comments", "user_id", userID, targets); err != nil {
		return err
	}

	return nil
}

func pruneMediaColumnRows(tableName, userColumn string, userID int, targets map[string]struct{}) error {
	query := fmt.Sprintf("SELECT id, COALESCE(media, '[]') FROM %s WHERE %s = $1", tableName, userColumn)
	rows, err := database.DB.Query(query, userID)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var id int
		var raw []byte
		if scanErr := rows.Scan(&id, &raw); scanErr != nil {
			return scanErr
		}

		var media []string
		if unmarshalErr := json.Unmarshal(raw, &media); unmarshalErr != nil {
			continue
		}

		filtered := make([]string, 0, len(media))
		changed := false
		for _, item := range media {
			filename, managed := extractManagedUploadFilename(item)
			if managed {
				if _, shouldRemove := targets[filename]; shouldRemove {
					changed = true
					continue
				}
			}
			filtered = append(filtered, item)
		}

		if !changed {
			continue
		}

		payload, marshalErr := json.Marshal(filtered)
		if marshalErr != nil {
			return marshalErr
		}

		updateQuery := fmt.Sprintf("UPDATE %s SET media = $1 WHERE id = $2", tableName)
		if _, execErr := database.DB.Exec(updateQuery, payload, id); execErr != nil {
			return execErr
		}
	}

	return rows.Err()
}

func removeOwnerPrefixedUploadFiles(userID int, alreadyConsidered map[string]struct{}) int {
	prefix := fmt.Sprintf("u%d_", userID)
	entries, err := os.ReadDir(uploadDir)
	if err != nil {
		logger.Log.WithFields(map[string]interface{}{
			"dir": uploadDir,
			"err": err.Error(),
		}).Warn("Failed to scan uploads directory for owner-prefixed cleanup")
		return 0
	}

	removed := 0
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		if !strings.HasPrefix(name, prefix) {
			continue
		}
		if _, exists := alreadyConsidered[name]; exists {
			continue
		}

		filePath := filepath.Join(uploadDir, name)
		if err := os.Remove(filePath); err != nil {
			if os.IsNotExist(err) {
				continue
			}
			logger.Log.WithFields(map[string]interface{}{
				"path": filePath,
				"err":  err.Error(),
			}).Warn("Failed to remove owner-prefixed orphan upload after user delete")
			continue
		}

		removed += 1
	}

	return removed
}

// UpdateUserInfo handles PUT requests to update a user's information.
// It expects the `username` parameter in the URL and a JSON body with the updated data.
// Returns:
// - 400 Bad Request if the data is invalid or contains unallowed fields.
// - 404 Not Found if no user is found with the given username.
// - 500 Internal Server Error if an error occurs while updating the user data.
// On success, responds with a 200 OK status and a message confirming the update.
func UpdateUserInfo(context *gin.Context) {
	// we dont want to create a whole new user, that is
	// why we dont use a user type here...
	// maybe could change later, so we can use
	// an empty mapped interface
	var updateData map[string]interface{}
	username := context.Param("username")

	// Bind the incoming JSON data to a map
	err := context.BindJSON(&updateData)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Invalid request data: %v", err))
		return
	}

	existingUser, err := database.GetUserByUsername(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error fetching user: %v", err))
		return
	}

	if existingUser == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("User with name '%v' not found", username))
		return
	}

	oldPicture := strings.TrimSpace(existingUser.Picture)

	updatedData := make(map[string]interface{})

	// Iterate through the fields of the existing user and map the request data to those fields
	for key, value := range updateData {
		// use helper to check if the field exists in existingUser
		if IsFieldAllowed(existingUser, key) {
			updatedData[key] = value
		} else {
			RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Field '%s' is not allowed to be updated", key))
			return
		}
	}

	if picture, ok := updatedData["picture"]; ok {
		pictureStr, parseOK := picture.(string)
		if !parseOK {
			RespondWithError(context, http.StatusBadRequest, "Invalid picture format")
			return
		}
		if strings.TrimSpace(pictureStr) == "" {
			existingUser.Picture = ""
		} else {
			storedPicture, ingestErr := materializeMediaReference(pictureStr)
			if ingestErr != nil {
				RespondWithError(context, http.StatusBadRequest, "Invalid picture media reference")
				return
			}
			existingUser.Picture = storedPicture
		}
	}

	if bio, ok := updatedData["bio"]; ok {
		bioStr, parseOK := bio.(string)
		if !parseOK {
			RespondWithError(context, http.StatusBadRequest, "Invalid bio format")
			return
		}
		existingUser.Bio = bioStr
	}

	if links, ok := updatedData["links"]; ok {
		linksMap, parseOK := links.(map[string]interface{})
		if parseOK {
			existingUser.Links = linksMap
		} else if linksArray, parseArray := links.([]interface{}); parseArray {
			normalized := make(map[string]interface{}, len(linksArray))
			for index, item := range linksArray {
				link, isString := item.(string)
				if !isString {
					RespondWithError(context, http.StatusBadRequest, "Invalid links format")
					return
				}
				normalized[fmt.Sprintf("link_%d", index)] = link
			}
			existingUser.Links = normalized
		} else {
			RespondWithError(context, http.StatusBadRequest, "Invalid links format")
			return
		}
	}

	if settings, ok := updatedData["settings"]; ok {
		settingsMap, parseOK := settings.(map[string]interface{})
		if !parseOK {
			RespondWithError(context, http.StatusBadRequest, "Invalid settings format")
			return
		}
		existingUser.Settings = settingsMap
	}

	if usernameValue, ok := updatedData["username"]; ok {
		usernameStr, parseOK := usernameValue.(string)
		if !parseOK {
			RespondWithError(context, http.StatusBadRequest, "Invalid username format")
			return
		}
		if usernameStr != "" && usernameStr != existingUser.Username {
			RespondWithError(context, http.StatusBadRequest, "Username updates are not supported")
			return
		}
	}

	err = database.UpdateUser(existingUser)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error updating user: %v", err))
		return
	}

	cleanupReplacedProfileUpload(oldPicture, existingUser.Picture)

	validUser, err := database.GetUserByUsername(existingUser.Username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error validating updated data: %v", err))
	}
	context.JSON(http.StatusOK, gin.H{"message": "User updated successfully.", "user": validUser})
}

func cleanupReplacedProfileUpload(previousPicture, nextPicture string) {
	previousFilename, previousManaged := extractManagedUploadFilename(previousPicture)
	if !previousManaged {
		return
	}

	nextFilename, nextManaged := extractManagedUploadFilename(nextPicture)
	if nextManaged && strings.EqualFold(previousFilename, nextFilename) {
		return
	}

	filePath := filepath.Join(uploadDir, previousFilename)
	if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
		logger.Log.WithFields(map[string]interface{}{
			"path": filePath,
			"err":  err.Error(),
		}).Warn("Failed to remove replaced profile image")
	}
}

func extractManagedUploadFilename(picture string) (string, bool) {
	trimmed := strings.TrimSpace(picture)
	if trimmed == "" {
		return "", false
	}

	pathValue := trimmed
	if parsed, err := url.Parse(trimmed); err == nil && parsed.Scheme != "" {
		pathValue = parsed.Path
	}

	normalized := strings.TrimPrefix(pathValue, "/")
	if !strings.HasPrefix(normalized, uploadDir+"/") {
		return "", false
	}

	filename := strings.TrimPrefix(normalized, uploadDir+"/")
	if filename == "" || strings.Contains(filename, "/") || strings.Contains(filename, `\\`) {
		return "", false
	}

	return filename, true
}

// GetUsersFollowers handles GET requests to fetch the list of user IDs who follow the specified user.
// It expects the `username` parameter in the URL.
// Returns:
// - 404 Not Found if no user is found with the given username.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a list of follower IDs in JSON format.
func GetUsersFollowers(context *gin.Context) {
	username := context.Param("username")

	followers, err := database.GetUserFollowers(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch followers: %v", err))
		return
	}

	context.JSON(http.StatusOK, followers)
}

// GetUsersFollowing handles GET requests to fetch the list of user IDs that the specified user follows.
// It expects the `username` parameter in the URL.
// Returns:
// - 404 Not Found if no user is found with the given username.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a list of following user IDs in JSON format.
func GetUsersFollowing(context *gin.Context) {
	username := context.Param("username")

	following, err := database.GetUserFollowing(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch following: %v", err))
		return
	}

	context.JSON(http.StatusOK, following)
}

// GetUsersFollowersUsernames handles GET requests to fetch the usernames of users who follow the specified user.
// It expects the `username` parameter in the URL.
// Returns:
// - 404 Not Found if no user is found with the given username.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a list of follower usernames in JSON format.
func GetUsersFollowersUsernames(context *gin.Context) {
	username := context.Param("username")

	followers, err := database.GetUserFollowersUsernames(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch followers: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{"message": "Successfully got followers", "followers": followers})
}

// GetUsersFollowingUsernames handles GET requests to fetch the usernames of users whom the specified user follows.
// It expects the `username` parameter in the URL.
// Returns:
// - 404 Not Found if no user is found with the given username.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a list of following usernames in JSON format.
func GetUsersFollowingUsernames(context *gin.Context) {
	username := context.Param("username")

	following, err := database.GetUserFollowingUsernames(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch following: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{"message": "Successfully got following", "following": following})
}

// FollowUser handles POST requests to create a follow relationship between a user and another user.
// It expects the `username` and `new_follow` parameters in the URL.
// Returns:
// - 400 Bad Request if the follow operation fails or the user is already following the other user.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a message confirming the follow operation.
func FollowUser(context *gin.Context) {
	username := context.Param("username")
	newFollow := context.Param("new_follow")

	err := database.FollowUser(username, newFollow)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to add follower: %v", err))
		return
	}

	actor, _ := database.GetUserByUsername(username)
	user, _ := database.GetUserByUsername(newFollow)
	createAndPushNotification(
		int64(user.Id),
		int64(actor.Id),
		"follow_user",
		nil,
		nil,
		nil,
		notificationBody(username, "followed you"),
	)
	context.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("%v now follows %v", username, newFollow)})
}

// UnfollowUser handles DELETE requests to remove a follow relationship between a user and another user.
// It expects the `username` and `unfollow` parameters in the URL.
// Returns:
// - 400 Bad Request if the unfollow operation fails or the user is not following the other user.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a message confirming the unfollow operation.
func UnfollowUser(context *gin.Context) {
	username := context.Param("username")
	unFollow := context.Param("unfollow")

	err := database.UnfollowUser(username, unFollow)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to remove follower: %v", err))
		return
	}
	context.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("%v unfollowed %v", username, unFollow)})
}
