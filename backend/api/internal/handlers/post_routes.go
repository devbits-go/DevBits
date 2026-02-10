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
// It expects the `post_id` parameter in the URL and does not require a request body.
// Returns:
// - 400 Bad Request if the ID is invalid.
// - 404 Not Found if the post does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the post details in JSON format.
func GetPostById(context *gin.Context) {
	strId := context.Param("post_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse post_id: %v", err))
		return
	}
	post, err := database.QueryPost(id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch post: %v", err))
		return
	}

	if post == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("Post with id '%v' not found", strId))
		return
	}

	context.JSON(http.StatusOK, post)
}

// GetPostByUserId handles GET requests to retrieve project information by its owning user.
// It expects the `user_id` parameter in the URL and does not require a request body.
// Returns:
// - 400 Bad Request if the ID is invalid.
// - 404 Not Found if the user does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the posts' details in JSON format.
func GetPostsByUserId(context *gin.Context) {
	strId := context.Param("user_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse user_id: %v", err))
		return
	}
	posts, httpcode, err := database.QueryPostsByUserId(id)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch posts: %v", err))
		return
	}
	context.JSON(http.StatusOK, posts)
}

// GetPostByProjectId handles GET requests to retrieve project information by the owning projecg.
// It expects the `post_id` parameter in the URL and does not require a request body.
// Returns:
// - 400 Bad Request if the ID is invalid.
// - 404 Not Found if the project does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the posts' details in JSON format.
func GetPostsByProjectId(context *gin.Context) {
	strId := context.Param("project_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse project_id: %v", err))
		return
	}
	posts, httpcode, err := database.QueryPostsByProjectId(id)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch posts: %v", err))
		return
	}
	context.JSON(http.StatusOK, posts)
}

// CreatePost handles POST requests to create a new post
// It expects a JSON payload that can be bound to a `types.Post` object.
// Validates the provided owner's ID and ensures the user and project exist.
// Returns:
// - 400 Bad Request if the JSON payload is invalid or the owner/project cannot be verified.
// - 500 Internal Server Error if there is a database error.
// On success, responds with a 201 Created status and the new post ID in JSON format.
func CreatePost(context *gin.Context) {
	var newPost types.Post
	err := context.BindJSON(&newPost)

	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to bind to JSON: %v", err))
		return
	}

	authUserID, ok := GetAuthUserID(context)
	if ok && authUserID != newPost.User {
		RespondWithError(context, http.StatusForbidden, "Post user does not match auth user")
		return
	}

	// verify the owner
	username, err := database.GetUsernameById(newPost.User)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to verify post ownership: %v", err))
		return
	}

	if username == "" {
		RespondWithError(context, http.StatusBadRequest, "Failed to verify post ownership. User could not be found")
		return
	}

	// verify the project
	project, err := database.QueryProject(int(newPost.Project))
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to verify post ownership: %v", err))
		return
	}

	if project == nil {
		RespondWithError(context, http.StatusBadRequest, "Failed to verify post ownership. Owning project could not be found")
		return
	}

	if ok && project.Owner != authUserID {
		isBuilder, err := database.QueryIsProjectBuilder(int(project.ID), authUserID)
		if err != nil {
			RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to check builder access: %v", err))
			return
		}
		if !isBuilder {
			RespondWithError(context, http.StatusForbidden, "You are not a builder on this stream")
			return
		}
	}

	id, err := database.QueryCreatePost(&newPost)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to create project: %v", err))
		return
	}
	context.JSON(http.StatusCreated, gin.H{"message": fmt.Sprintf("Post created successfully with id '%v'", id)})
}

// DeletePost handles DELETE requests to delete a post.
// It expects the `post_id` parameter in the URL.
// Returns:
// - 400 Bad Request if the post_id is invalid.
// - 404 Not Found if no post is found with the given id.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a message confirming the post deletion.
func DeletePost(context *gin.Context) {
	strId := context.Param("post_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse post id: %v", err))
		return
	}

	post, err := database.QueryPost(id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch post: %v", err))
		return
	}
	if post == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("Post with id '%v' not found", id))
		return
	}

	authUserID, ok := GetAuthUserID(context)
	if ok && authUserID != post.User {
		RespondWithError(context, http.StatusForbidden, "Forbidden")
		return
	}

	httpCode, err := database.QueryDeletePost(id)
	// delete posts can return different errors...
	if err != nil {
		RespondWithError(context, int(httpCode), fmt.Sprintf("Failed to delete post: %v", err))
		return
	}
	context.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Post %v deleted.", id),
	})
}

// UpdatePostInfo handles PATCH requests to update post information.
// It expects the `post_id` parameter in the URL and a JSON payload with update fields.
// Validates the post ID, checks for the existence of the post, and ensures the fields being updated are allowed.
// Returns:
// - 400 Bad Request for invalid input or disallowed fields.
// - 404 Not Found if the post does not exist.
// - 500 Internal Server Error for database errors.
// On success, responds with a 200 OK status and the updated post details in JSON format.
func UpdatePostInfo(context *gin.Context) {
	var updateData map[string]interface{}

	// Parse post ID from the URL
	id, err := strconv.Atoi(context.Param("post_id"))
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse post id: %v", err))
		return
	}

	err = context.BindJSON(&updateData)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse update data: %v", err))
		return
	}

	existingPost, err := database.QueryPost(id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to retrieve post: %v", err))
		return
	}
	if existingPost == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("Post with id '%v' not found", id))
		return
	}

	authUserID, ok := GetAuthUserID(context)
	if ok && authUserID != existingPost.User {
		RespondWithError(context, http.StatusForbidden, "Forbidden")
		return
	}

	// validate new owner if provided in update data
	if newOwner, ok := updateData["user"]; ok {
		ownerID, ok := newOwner.(float64) // Assuming JSON numbers are decoded as float64
		if !ok {
			RespondWithError(context, http.StatusBadRequest, "Invalid owner id format")
			return
		}
		username, err := database.GetUsernameById(int64(ownerID))
		if err != nil || username == "" {
			RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Invalid owner id: %v", ownerID))
			return
		}
	}

	// validate new owner if provided in update data
	if newProject, ok := updateData["project"]; ok {
		projectID, ok := newProject.(float64) // Assuming JSON numbers are decoded as float64
		if !ok {
			RespondWithError(context, http.StatusBadRequest, "Invalid project id format")
			return
		}
		existingProject, err := database.QueryProject(int(projectID))
		if err != nil || existingProject == nil {
			RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Invalid project id: %v", projectID))
			return
		}
	}

	updatedData := make(map[string]interface{})
	for key, value := range updateData {
		if IsFieldAllowed(existingPost, key) {
			updatedData[key] = value
		} else {
			RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Field '%v' is not allowed for updates", key))
			return
		}
	}

	err = database.QueryUpdatePost(id, updatedData)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error updating post: %v", err))
		return
	}

	updatedPost, err := database.QueryPost(id)

	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error validating updated post: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{
		"message": "Post updated successfully",
		"post":    updatedPost,
	})
}

// LikePost handles POST requests to like a post.
// It expects the `username` and `post_id` parameters in the URL.
// Returns:
// - Appropriate error code (404 if missing data, 500 if error) for database failures or invalid input.
// On success, responds with a 200 OK status and a confirmation message.
func LikePost(context *gin.Context) {
	username := context.Param("username")
	postId := context.Param("post_id")

	httpcode, err := database.CreatePostLike(username, postId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to like post: %v", err))
		return
	}
	context.JSON(http.StatusCreated, gin.H{"message": fmt.Sprintf("%v likes post %v", username, postId)})
}

// UnlikePost handles POST requests to unlike a post.
// It expects the `username` and `post_id` parameters in the URL.
// Returns:
// - Appropriate error code (404 if missing data, 500 if error) for database failures or invalid input.
// On success, responds with a 200 OK status and a confirmation message.
func UnlikePost(context *gin.Context) {
	username := context.Param("username")
	postId := context.Param("post_id")

	httpcode, err := database.RemovePostLike(username, postId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to unlike post: %v", err))
		return
	}
	context.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("%v unliked post %v", username, postId)})
}

// IsPostLiked handles GET requests to query for a post like.
// It expects the `username` and `post_id` parameters in the URL.
// Returns:
// - Appropriate error code for database failures or invalid input.
// On success, responds with a 200 OK status and a status message.
func IsPostLiked(context *gin.Context) {
	username := context.Param("username")
	postId := context.Param("post_id")

	httpcode, exists, err := database.QueryPostLike(username, postId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to query for post like: %v", err))
		return
	}
	context.JSON(httpcode, gin.H{"status": exists})
}

// SavePost handles POST requests to save a post.
func SavePost(context *gin.Context) {
	username := context.Param("username")
	postId := context.Param("post_id")

	httpcode, err := database.QuerySavePost(username, postId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to save post: %v", err))
		return
	}

	postInt, _ := strconv.Atoi(postId)
	post, _ := database.QueryPost(postInt)
	actorID, _ := database.GetUserIdByUsername(username)
	if post != nil {
		postID64 := int64(post.ID)
		createAndPushNotification(
			int64(post.User),
			int64(actorID),
			"save_post",
			&postID64,
			nil,
			nil,
			notificationBody(username, "saved your byte"),
		)
	}

	context.JSON(httpcode, gin.H{"message": fmt.Sprintf("%v saved post %v", username, postId)})
}

// UnsavePost handles POST requests to unsave a post.
func UnsavePost(context *gin.Context) {
	username := context.Param("username")
	postId := context.Param("post_id")

	httpcode, err := database.QueryUnsavePost(username, postId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to unsave post: %v", err))
		return
	}

	postInt, _ := strconv.Atoi(postId)
	post, _ := database.QueryPost(postInt)
	actorID, _ := database.GetUserIdByUsername(username)
	if post != nil {
		postID64 := int64(post.ID)
		_, _ = database.DeleteNotificationByReference(
			int64(post.User),
			int64(actorID),
			"save_post",
			&postID64,
			nil,
		)
	}

	context.JSON(httpcode, gin.H{"message": fmt.Sprintf("%v unsaved post %v", username, postId)})
}

// GetSavedPosts handles GET requests to list saved posts for a user.
func GetSavedPosts(context *gin.Context) {
	username := context.Param("username")

	posts, httpcode, err := database.QuerySavedPostsByUser(username)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch saved posts: %v", err))
		return
	}

	context.JSON(http.StatusOK, posts)
}
