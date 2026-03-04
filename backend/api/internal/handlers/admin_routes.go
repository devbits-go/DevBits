package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"backend/api/internal/database"

	"github.com/gin-gonic/gin"
)

type AdminUserRow struct {
	ID           int        `json:"id"`
	Username     string     `json:"username"`
	Picture      string     `json:"picture"`
	Bio          string     `json:"bio"`
	CreationDate string     `json:"creation_date"`
	IsAdmin      bool       `json:"is_admin"`
	BanReason    string     `json:"ban_reason,omitempty"`
	BanUntil     *time.Time `json:"ban_until,omitempty"`
}

// AdminListUsers returns all users (admin-only)
func AdminListUsers(c *gin.Context) {
	q := c.Query("q")
	var users []*database.ApiUser
	var err error
	if strings.TrimSpace(q) != "" {
		users, err = database.QueryUsersByFilter(q)
	} else {
		users, err = database.GetUsers()
	}
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch users: %v", err))
		return
	}

	rows := make([]AdminUserRow, 0, len(users))
	for _, user := range users {
		if user == nil {
			continue
		}

		isAdmin, err := database.IsUserAdmin(int64(user.Id))
		if err != nil {
			RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to resolve admin status: %v", err))
			return
		}

		row := AdminUserRow{
			ID:           user.Id,
			Username:     user.Username,
			Picture:      user.Picture,
			Bio:          user.Bio,
			CreationDate: user.CreationDate,
			IsAdmin:      isAdmin,
		}

		activeBan, err := database.GetActiveBanByUserID(int64(user.Id))
		if err != nil {
			RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to resolve ban status: %v", err))
			return
		}
		if activeBan != nil {
			row.BanReason = activeBan.Reason
			banUntil := activeBan.BannedUntil
			row.BanUntil = &banUntil
		}

		rows = append(rows, row)
	}

	c.JSON(http.StatusOK, rows)
}

type setAdminRequest struct {
	IsAdmin bool `json:"is_admin"`
}

func AdminSetUserAdmin(c *gin.Context) {
	username := strings.TrimSpace(c.Param("username"))
	if username == "" {
		RespondWithError(c, http.StatusBadRequest, "Missing username")
		return
	}

	target, err := database.GetUserByUsername(username)
	if err != nil || target == nil {
		RespondWithError(c, http.StatusNotFound, "User not found")
		return
	}

	var payload setAdminRequest
	if err := c.BindJSON(&payload); err != nil {
		RespondWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid payload: %v", err))
		return
	}

	var grantedBy *int64
	if authUserID, ok := GetAuthUserID(c); ok {
		grantedBy = &authUserID
	}

	if err := database.SetUserAdmin(int64(target.Id), grantedBy, payload.IsAdmin); err != nil {
		RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to update admin status: %v", err))
		return
	}

	state := "removed"
	if payload.IsAdmin {
		state = "granted"
	}
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Admin access %s for %s", state, target.Username)})
}

type banUserRequest struct {
	Reason          string `json:"reason"`
	DurationMinutes int    `json:"duration_minutes"`
}

func AdminBanUser(c *gin.Context) {
	username := strings.TrimSpace(c.Param("username"))
	if username == "" {
		RespondWithError(c, http.StatusBadRequest, "Missing username")
		return
	}

	target, err := database.GetUserByUsername(username)
	if err != nil || target == nil {
		RespondWithError(c, http.StatusNotFound, "User not found")
		return
	}

	var payload banUserRequest
	if err := c.BindJSON(&payload); err != nil {
		RespondWithError(c, http.StatusBadRequest, fmt.Sprintf("Invalid payload: %v", err))
		return
	}
	if payload.DurationMinutes <= 0 {
		RespondWithError(c, http.StatusBadRequest, "duration_minutes must be > 0")
		return
	}

	bannedUntil := time.Now().UTC().Add(time.Duration(payload.DurationMinutes) * time.Minute)
	var bannedBy *int64
	if authUserID, ok := GetAuthUserID(c); ok {
		bannedBy = &authUserID
	}

	if err := database.CreateUserBan(int64(target.Id), strings.TrimSpace(payload.Reason), bannedUntil, bannedBy); err != nil {
		RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to ban user: %v", err))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      fmt.Sprintf("User %s banned", target.Username),
		"reason":       strings.TrimSpace(payload.Reason),
		"banned_until": bannedUntil.Format(time.RFC3339),
	})
}

func AdminUnbanUser(c *gin.Context) {
	username := strings.TrimSpace(c.Param("username"))
	if username == "" {
		RespondWithError(c, http.StatusBadRequest, "Missing username")
		return
	}

	target, err := database.GetUserByUsername(username)
	if err != nil || target == nil {
		RespondWithError(c, http.StatusNotFound, "User not found")
		return
	}

	if err := database.LiftUserBan(int64(target.Id)); err != nil {
		RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to lift ban: %v", err))
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Ban lifted for %s", target.Username)})
}

func AdminMe(c *gin.Context) {
	authMode, _ := c.Get("adminAuthMode")
	response := gin.H{
		"mode": authMode,
	}

	if username := c.GetString(authUsernameKey); username != "" {
		response["username"] = username
	}

	c.JSON(http.StatusOK, response)
}

// AdminDeleteUser deletes a user by username (admin-only). It mirrors the normal DeleteUser logic
// but is callable by an admin key.
func AdminDeleteUser(c *gin.Context) {
	username := c.Param("username")
	existingUser, err := database.GetUserByUsername(username)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to resolve user before delete: %v", err))
		return
	}
	if existingUser == nil {
		RespondWithError(c, http.StatusNotFound, fmt.Sprintf("User '%v' not found.", username))
		return
	}

	managedUploads, err := collectManagedUploadsForUser(existingUser.Id)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to collect user media before delete: %v", err))
		return
	}

	err = database.DeleteUser(username)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to delete user: %v", err))
		return
	}

	removedFiles := removeManagedUploadFiles(managedUploads)
	removedOwnedOrphans := removeOwnerPrefixedUploadFiles(existingUser.Id, managedUploads)
	c.JSON(http.StatusOK, gin.H{
		"message":                fmt.Sprintf("User '%v' deleted.", username),
		"removed_uploads":        removedFiles,
		"removed_orphan_uploads": removedOwnedOrphans,
	})
}

// AdminDeletePost deletes a post by id (admin-only)
func AdminDeletePost(c *gin.Context) {
	strId := c.Param("post_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(c, http.StatusBadRequest, fmt.Sprintf("Failed to parse post id: %v", err))
		return
	}
	httpCode, err := database.QueryDeletePost(id)
	if err != nil {
		RespondWithError(c, int(httpCode), fmt.Sprintf("Failed to delete post: %v", err))
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Post %v deleted.", id)})
}

// AdminListPosts lists posts, optionally filtered by `q` (content substring)
func AdminListPosts(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	posts, err := database.QueryPostsByFilter(q)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to search posts: %v", err))
		return
	}
	c.JSON(http.StatusOK, posts)
}

// AdminListProjects lists projects/streams by name filter
func AdminListProjects(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	projects, err := database.QueryProjectsByFilter(q)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to search projects: %v", err))
		return
	}
	c.JSON(http.StatusOK, projects)
}

// AdminDeleteProject deletes a project/stream by id (admin-only)
func AdminDeleteProject(c *gin.Context) {
	strId := c.Param("project_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(c, http.StatusBadRequest, fmt.Sprintf("Failed to parse project id: %v", err))
		return
	}
	httpCode, err := database.QueryDeleteProject(id)
	if err != nil {
		RespondWithError(c, int(httpCode), fmt.Sprintf("Failed to delete project: %v", err))
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Project %v deleted.", id)})
}

func AdminListComments(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	comments, err := database.QueryCommentsByFilter(q)
	if err != nil {
		RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed to search comments: %v", err))
		return
	}
	c.JSON(http.StatusOK, comments)
}

func AdminDeleteComment(c *gin.Context) {
	strId := c.Param("comment_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(c, http.StatusBadRequest, fmt.Sprintf("Failed to parse comment id: %v", err))
		return
	}
	httpCode, err := database.QueryDeleteComment(id)
	if err != nil {
		RespondWithError(c, int(httpCode), fmt.Sprintf("Failed to delete comment: %v", err))
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("Comment %v deleted.", id)})
}

func AdminOverview(c *gin.Context) {
	type counts struct {
		Users    int `json:"users"`
		Posts    int `json:"posts"`
		Projects int `json:"projects"`
		Comments int `json:"comments"`
	}

	var payload counts
	var dbNow sql.NullTime

	queries := []struct {
		stmt string
		out  *int
	}{
		{stmt: "SELECT COUNT(*) FROM users", out: &payload.Users},
		{stmt: "SELECT COUNT(*) FROM posts", out: &payload.Posts},
		{stmt: "SELECT COUNT(*) FROM projects", out: &payload.Projects},
		{stmt: "SELECT COUNT(*) FROM comments", out: &payload.Comments},
	}

	for _, query := range queries {
		if err := database.DB.QueryRow(query.stmt).Scan(query.out); err != nil {
			RespondWithError(c, http.StatusInternalServerError, fmt.Sprintf("Failed running admin overview query: %v", err))
			return
		}
	}

	if err := database.DB.QueryRow("SELECT CURRENT_TIMESTAMP").Scan(&dbNow); err != nil {
		dbNow = sql.NullTime{Valid: false}
	}

	response := gin.H{
		"counts":      payload,
		"server_time": time.Now().UTC().Format(time.RFC3339),
	}
	if dbNow.Valid {
		response["db_time"] = dbNow.Time.UTC().Format(time.RFC3339)
	}

	c.JSON(http.StatusOK, response)
}
