package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"backend/api/internal/database"
	"backend/api/internal/types"

	"github.com/gin-gonic/gin"
)

// GetPostById handles GET requests to retrieve project information by its ID.
// It expects the `comment_id` parameter in the URL and does not require a request body.
// Returns:
// - 400 Bad Request if the ID is invalid.
// - 404 Not Found if the post does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the post details in JSON format.
func GetCommentById(context *gin.Context) {
	strId := context.Param("comment_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse comment_id: %v", err))
		return
	}
	comment, err := database.QueryComment(id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch comment: %v", err))
		return
	}

	if comment == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("Comment with id %v not found", strId))
		return
	}

	context.JSON(http.StatusOK, comment)
}

// GetCommentsByUserId handles GET requests to retrieve comments information by its owning user.
// It expects the `user_id` parameter in the URL and does not require a request body.
// Returns:
// - 400 Bad Request if the ID is invalid.
// - 404 Not Found if the user does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the comments” details in JSON format.
func GetCommentsByUserId(context *gin.Context) {
	strId := context.Param("user_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse user_id: %v", err))
		return
	}
	comments, httpcode, err := database.QueryCommentsByUserId(id)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch comments: %v", err))
		return
	}
	context.JSON(http.StatusOK, comments)
}

// GetCommentsByProjectId handles GET requests to retrieve comments information by its owning project.
// It expects the `project_id` parameter in the URL and does not require a request body.
// Returns:
// - 400 Bad Request if the ID is invalid.
// - 404 Not Found if the project does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the comments details in JSON format.
func GetCommentsByProjectId(context *gin.Context) {
	strId := context.Param("project_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse project_id: %v", err))
		return
	}
	comments, httpcode, err := database.QueryCommentsByProjectId(id)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch comments: %v", err))
		return
	}
	context.JSON(http.StatusOK, comments)
}

// GetCommentsByPostId handles GET requests to retrieve comments information by its owning post.
// It expects the `post_id` parameter in the URL and does not require a request body.
// Returns:
// - 400 Bad Request if the ID is invalid.
// - 404 Not Found if the post does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the comments details in JSON format.
func GetCommentsByPostId(context *gin.Context) {
	strId := context.Param("post_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse post_id: %v", err))
		return
	}
	comments, httpcode, err := database.QueryCommentsByPostId(id)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch comments: %v", err))
		return
	}
	context.JSON(http.StatusOK, comments)
}

// GetCommentsByCommentId handles GET requests to retrieve comments information by its owning comment.
// It expects the `comment_id` parameter in the URL and does not require a request body.
// Returns:
// - 400 Bad Request if the ID is invalid.
// - 404 Not Found if the comment does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the comments details in JSON format.
func GetCommentsByCommentId(context *gin.Context) {
	strId := context.Param("comment_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse comment_id: %v", err))
		return
	}
	comments, httpcode, err := database.QueryCommentsByCommentId(id)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch comments: %v", err))
		return
	}
	context.JSON(http.StatusOK, comments)
}

// CreateCommentOnPost handles POST requests to create a new comment on a post
// It expects a JSON payload that can be bound to a `types.Comment` object.
// Validates the provided owner's ID, verifies the post, and ensures the user exists.
// Returns:
// - 400 Bad Request if the JSON payload is invalid or the user/post cannot be verified.
// - 500 Internal Server Error if there is a database error.
// On success, responds with a 201 Created status and the new comment ID in JSON format.
func CreateCommentOnPost(context *gin.Context) {
	var newComment types.Comment
	err := context.BindJSON(&newComment)
	authUserID, ok := GetAuthUserID(context)
	if ok && authUserID != newComment.User {
		RespondWithError(context, http.StatusForbidden, "Comment user does not match auth user")
		return
	}

	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to bind to JSON: %v", err))
		return
	}

	strId := context.Param("post_id")
	postId, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse post id: %v", err))
		return
	}

	// Verify the owner
	username, err := database.GetUsernameById(newComment.User)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to verify comment ownership: %v", err))
		return
	}

	if username == "" {
		RespondWithError(context, http.StatusBadRequest, "Failed to verify comment ownership. User could not be found")
		return
	}

	// Verify the post
	post, err := database.QueryPost(postId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to verify post: %v", err))
		return
	}

	if post == nil {
		RespondWithError(context, http.StatusBadRequest, "Failed to verify post. Post could not be found")
		return
	}

	// Create the comment
	id, err := database.QueryCreateCommentOnPost(newComment, postId)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to create comment on post: %v", err))
		return
	}

	if post.User != newComment.User {
		postID64 := int64(post.ID)
		commentID64 := int64(id)
		actorName, _ := database.GetUsernameById(newComment.User)
		createAndPushNotification(
			int64(post.User),
			int64(newComment.User),
			"comment_post",
			&postID64,
			nil,
			&commentID64,
			notificationBody(actorName, "commented on your byte"),
		)
	}

	context.JSON(http.StatusCreated, gin.H{"message": fmt.Sprintf("Comment created successfully with id %v", id)})
}

// CreateCommentOnProject handles POST requests to create a new comment on a project
// It expects a JSON payload that can be bound to a `types.Comment` object.
// Validates the provided owner's ID, verifies the project, and ensures the user exists.
// Returns:
// - 400 Bad Request if the JSON payload is invalid or the user/project cannot be verified.
// - 500 Internal Server Error if there is a database error.
// On success, responds with a 201 Created status and the new comment ID in JSON format.
func CreateCommentOnProject(context *gin.Context) {
	var newComment types.Comment
	err := context.BindJSON(&newComment)
	authUserID, ok := GetAuthUserID(context)
	if ok && authUserID != newComment.User {
		RespondWithError(context, http.StatusForbidden, "Comment user does not match auth user")
		return
	}

	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to bind to JSON: %v", err))
		return
	}

	strId := context.Param("project_id")
	projId, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse project id: %v", err))
		return
	}

	// Verify the owner
	username, err := database.GetUsernameById(newComment.User)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to verify comment ownership: %v", err))
		return
	}

	if username == "" {
		RespondWithError(context, http.StatusBadRequest, "Failed to verify comment ownership. User could not be found")
		return
	}

	// Verify the project
	project, err := database.QueryProject(projId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to verify project: %v", err))
		return
	}

	if project == nil {
		RespondWithError(context, http.StatusBadRequest, "Failed to verify project. Project could not be found")
		return
	}

	// Create the comment
	id, err := database.QueryCreateCommentOnProject(newComment, projId)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to create comment on project: %v", err))
		return
	}

	context.JSON(http.StatusCreated, gin.H{"message": fmt.Sprintf("Comment created successfully with id %v", id)})
}

// CreateCommentOnComment handles POST requests to create a new reply (comment) to another comment
// It expects a JSON payload that can be bound to a `types.Comment` object.
// Validates the provided owner's ID, verifies the parent comment, and ensures the user exists.
// Returns:
// - 400 Bad Request if the JSON payload is invalid or the user/parent comment cannot be verified.
// - 500 Internal Server Error if there is a database error.
// On success, responds with a 201 Created status and the new reply (comment) ID in JSON format.
func CreateCommentOnComment(context *gin.Context) {
	var newComment types.Comment
	err := context.BindJSON(&newComment)
	authUserID, ok := GetAuthUserID(context)
	if ok && authUserID != newComment.User {
		RespondWithError(context, http.StatusForbidden, "Comment user does not match auth user")
		return
	}

	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to bind to JSON: %v", err))
		return
	}

	strId := context.Param("comment_id")
	commId, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse post id: %v", err))
		return
	}

	// Verify the owner
	username, err := database.GetUsernameById(newComment.User)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to verify comment ownership: %v", err))
		return
	}

	if username == "" {
		RespondWithError(context, http.StatusBadRequest, "Failed to verify comment ownership. User could not be found")
		return
	}

	// Verify the parent comment
	parentComment, err := database.QueryComment(commId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to verify parent comment: %v", err))
		return
	}

	if parentComment == nil {
		RespondWithError(context, http.StatusBadRequest, "Failed to verify parent comment. Comment could not be found")
		return
	}

	// Create the reply (comment)
	id, err := database.QueryCreateCommentOnComment(newComment, commId)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to create reply to comment: %v", err))
		return
	}

	context.JSON(http.StatusCreated, gin.H{"message": fmt.Sprintf("Reply created successfully with id %v", id)})
}

// DeleteComment handles DELETE requests to delete a post.
// It expects the `comment_id` parameter in the URL.
// Returns:
// - 400 Bad Request if the post_id is invalid.
// - 404 Not Found if no post is found with the given id.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a message confirming the post deletion.
func DeleteComment(context *gin.Context) {
	strId := context.Param("comment_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse comment id: %v", err))
		return
	}

	existingComment, err := database.QueryComment(id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to retrieve comment: %v", err))
		return
	}
	if existingComment == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("Comment with id %v not found", id))
		return
	}

	authUserID, ok := GetAuthUserID(context)
	if ok && authUserID != existingComment.User {
		RespondWithError(context, http.StatusForbidden, "Forbidden")
		return
	}

	httpCode, err := database.QueryDeleteComment(id)
	if err != nil {
		RespondWithError(context, int(httpCode), fmt.Sprintf("Failed to delete comment: %v", err))
		return
	}
	context.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Comment %v soft deleted.", id),
	})
}

// UpdateCommentContent handles PUT requests to delete a post.
// It expects the `comment_id` parameter in the URL.
// Returns:
// - 400 Bad Request if the post_id is invalid.
// - 404 Not Found if no post is found with the given id.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a message confirming the post deletion.
func UpdateCommentContent(context *gin.Context) {
	id, err := strconv.Atoi(context.Param("comment_id"))
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse comment id: %v", err))
		return
	}

	existingComment, err := database.QueryComment(id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to retrieve comment: %v", err))
		return
	}
	if existingComment == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("Comment with id %v not found", id))
		return
	}

	authUserID, ok := GetAuthUserID(context)
	if ok && authUserID != existingComment.User {
		RespondWithError(context, http.StatusForbidden, "Forbidden")
		return
	}

	var requestData struct {
		Content string   `json:"content"`
		Media   []string `json:"media"`
	}

	if err := context.BindJSON(&requestData); err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse request body: %v", err))
		return
	}

	if requestData.Content == "" {
		RespondWithError(context, http.StatusBadRequest, "Content cannot be empty")
		return
	}

	updatedData := map[string]interface{}{
		"content": requestData.Content,
	}
	if requestData.Media != nil {
		updatedData["media"] = requestData.Media
	}

	httpcode, err := database.QueryUpdateComment(id, updatedData)
	if err != nil {
		RespondWithError(context, int(httpcode), fmt.Sprintf("Error updating comment: %v", err))
		return
	}

	updatedComment, err := database.QueryComment(id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error validating updated comment: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{
		"message": "Comment updated successfully",
		"comment": gin.H{
			"id":             updatedComment.ID,
			"user":           updatedComment.User,
			"likes":          updatedComment.Likes,
			"parent_comment": updatedComment.ParentComment,
			"content":        updatedComment.Content,
			"media":          updatedComment.Media,
		},
	})
}

// LikeComment handles POST requests to like a comment.
// It expects the `username` and `comment_id` parameters in the URL.
// Returns:
// - Appropriate error code (404 if missing data, 500 if error) for database failures or invalid input.
// On success, responds with a 200 OK status and a confirmation message.
func LikeComment(context *gin.Context) {
	username := context.Param("username")
	commentId := context.Param("comment_id")

	httpcode, err := database.CreateCommentLike(username, commentId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to like comment: %v", err))
		return
	}
	context.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("%v likes comment %v", username, commentId)})
}

// UnlikeComment handles POST requests to unlike a comment.
// It expects the `username` and `comment_id` parameters in the URL.
// Returns:
// - Appropriate error code (404 if missing data, 500 if error) for database failures or invalid input.
// On success, responds with a 200 OK status and a confirmation message.
func UnlikeComment(context *gin.Context) {
	username := context.Param("username")
	commentId := context.Param("comment_id")

	httpcode, err := database.RemoveCommentLike(username, commentId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to unlike comment: %v", err))
		return
	}
	context.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("%v unliked comment %v", username, commentId)})
}

// IsCommentLiked handles GET requests to query for a comment like.
// It expects the `username` and `comment_id` parameters in the URL.
// Returns:
// - Appropriate error code for database failures or invalid input.
// On success, responds with a 200 OK status and a status message.
func IsCommentLiked(context *gin.Context) {
	username := context.Param("username")
	commentId := context.Param("comment_id")

	httpcode, exists, err := database.QueryCommentLike(username, commentId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to query for comment like: %v", err))
		return
	}
	context.JSON(httpcode, gin.H{"status": exists})
}

// IsCommentLiked handles GET requests to query for a comment like.
// It expects the `comment_id` parameters in the URL.
// Returns:
// - Appropriate error code for database failures or invalid input.
// On success, responds with a 200 OK status and a status message.
func IsCommentEditable(context *gin.Context) {
	commentId := context.Param("comment_id")

	httpcode, exists, err := database.QueryIsCommentEditable(commentId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to query for comment: %v", err))
		return
	}
	context.JSON(httpcode, gin.H{"status": exists})
}
