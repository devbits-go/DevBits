package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"backend/api/internal/database"
	"backend/api/internal/types"

	"github.com/gin-gonic/gin"
)

// GetProjectById handles GET requests to retrieve project information by its ID.
// It expects the `project_id` parameter in the URL and does not require a request body.
// Returns:
// - 400 Bad Request if the ID is invalid.
// - 404 Not Found if the project does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the project details in JSON format.
func GetProjectById(context *gin.Context) {
	strId := context.Param("project_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		return
	}
	project, err := database.QueryProject(id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to fetch project: %v", err))
		return
	}

	if project == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("Project with id '%v' not found", strId))
		return
	}

	context.JSON(http.StatusOK, project)
}

// GetProjectsByUserId handles GET requests to retrieve projects information by its owning user's id.
// It expects the `user_id` parameter in the URL and does not require a request body.
// Returns:
// - 400 Bad Request if the ID is invalid.
// - 404 Not Found if the user id does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the projects' details in JSON format.
func GetProjectsByUserId(context *gin.Context) {
	strId := context.Param("user_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		return
	}
	project, httpcode, err := database.QueryProjectsByUserId(id)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch projects: %v", err))
		return
	}
	context.JSON(http.StatusOK, project)
}

// GetProjectsByBuilderId handles GET requests to retrieve projects a user can build.
// It expects the `user_id` parameter in the URL.
// Returns:
// - 400 Bad Request if the ID is invalid.
// - 403 Forbidden if auth user does not match.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the projects' details in JSON format.
func GetProjectsByBuilderId(context *gin.Context) {
	strId := context.Param("user_id")
	userId, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse user_id: %v", err))
		return
	}

	authUserID, ok := GetAuthUserID(context)
	if ok && int64(userId) != authUserID {
		RespondWithError(context, http.StatusForbidden, "Forbidden")
		return
	}

	projects, httpcode, err := database.QueryProjectsByBuilderId(userId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch projects: %v", err))
		return
	}
	context.JSON(http.StatusOK, projects)
}

// GetProjectBuilders handles GET requests to retrieve a project's builders.
func GetProjectBuilders(context *gin.Context) {
	strId := context.Param("project_id")
	projectId, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse project_id: %v", err))
		return
	}

	builders, httpcode, err := database.QueryProjectBuilders(projectId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch builders: %v", err))
		return
	}

	context.JSON(http.StatusOK, builders)
}

// AddProjectBuilder handles POST requests to add a builder by username.
func AddProjectBuilder(context *gin.Context) {
	projectId, err := strconv.Atoi(context.Param("project_id"))
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse project_id: %v", err))
		return
	}

	builderUsername := context.Param("username")
	if builderUsername == "" {
		RespondWithError(context, http.StatusBadRequest, "Missing builder username")
		return
	}

	project, err := database.QueryProject(projectId)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to load project: %v", err))
		return
	}
	if project == nil {
		RespondWithError(context, http.StatusNotFound, "Project not found")
		return
	}

	authUserID, ok := GetAuthUserID(context)
	if !ok || project.Owner != authUserID {
		RespondWithError(context, http.StatusForbidden, "Only the owner can manage builders")
		return
	}

	builderId, err := database.GetUserIdByUsername(builderUsername)
	if err != nil || builderId == 0 {
		RespondWithError(context, http.StatusBadRequest, "Builder user not found")
		return
	}

	builderID64 := int64(builderId)
	if builderID64 == project.Owner {
		context.JSON(http.StatusOK, gin.H{"message": "Owner already has access"})
		return
	}

	status, err := database.QueryAddProjectBuilder(projectId, builderID64)
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to add builder: %v", err))
		return
	}

	projectID64 := int64(projectId)
	ownerName, _ := database.GetUsernameById(project.Owner)
	createAndPushNotification(
		builderID64,
		project.Owner,
		"builder_added",
		nil,
		&projectID64,
		nil,
		notificationBody(ownerName, "added you as a builder"),
	)

	context.JSON(http.StatusOK, gin.H{"message": "Builder added"})
}

// RemoveProjectBuilder handles DELETE requests to remove a builder by username.
func RemoveProjectBuilder(context *gin.Context) {
	projectId, err := strconv.Atoi(context.Param("project_id"))
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse project_id: %v", err))
		return
	}

	builderUsername := context.Param("username")
	if builderUsername == "" {
		RespondWithError(context, http.StatusBadRequest, "Missing builder username")
		return
	}

	project, err := database.QueryProject(projectId)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to load project: %v", err))
		return
	}
	if project == nil {
		RespondWithError(context, http.StatusNotFound, "Project not found")
		return
	}

	builderId, err := database.GetUserIdByUsername(builderUsername)
	if err != nil || builderId == 0 {
		RespondWithError(context, http.StatusBadRequest, "Builder user not found")
		return
	}

	authUserID, ok := GetAuthUserID(context)
	if !ok {
		RespondWithError(context, http.StatusForbidden, "Forbidden")
		return
	}

	builderID64 := int64(builderId)
	if project.Owner != authUserID && builderID64 != authUserID {
		RespondWithError(context, http.StatusForbidden, "Only the owner can manage builders")
		return
	}

	status, err := database.QueryRemoveProjectBuilder(projectId, builderID64)
	if err != nil {
		RespondWithError(context, status, fmt.Sprintf("Failed to remove builder: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{"message": "Builder removed"})
}

// CreateProject handles POST requests to create a new project.
// It expects a JSON payload that can be bound to a `types.Project` object.
// Validates the provided owner's ID and ensures the user exists.
// Returns:
// - 400 Bad Request if the JSON payload is invalid or the owner cannot be verified.
// - 500 Internal Server Error if there is a database error.
// On success, responds with a 201 Created status and the new project ID in JSON format.
func CreateProject(context *gin.Context) {
	var newProj types.Project
	err := context.BindJSON(&newProj)

	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to bind to JSON: %v", err))
		return
	}

	// verify the owner
	username, err := database.GetUsernameById(newProj.Owner)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to verify project ownership: %v", err))
		return
	}

	if username == "" {
		RespondWithError(context, http.StatusBadRequest, "Failed to verify project ownership. User could not be found")
		return
	}

	authUserID, ok := GetAuthUserID(context)
	if ok && authUserID != newProj.Owner {
		RespondWithError(context, http.StatusForbidden, "Owner does not match auth user")
		return
	}

	id, err := database.QueryCreateProject(&newProj)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to create project: %v", err))
		return
	}
	context.JSON(http.StatusCreated, gin.H{"message": fmt.Sprintf("Project created successfully with id '%v'", id)})
}

// DeleteProject handles DELETE requests to delete a project.
// It expects the `project_id` parameter in the URL.
// Returns:
// - 400 Bad Request if the project_id is invalid.
// - 404 Not Found if no project is found with the given id.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a message confirming the project deletion.
func DeleteProject(context *gin.Context) {
	strId := context.Param("project_id")
	id, err := strconv.Atoi(strId)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse project id: %v", err))
		return
	}

	project, err := database.QueryProject(id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to retrieve project: %v", err))
		return
	}
	if project == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("Project with id '%v' not found", id))
		return
	}

	authUserID, ok := GetAuthUserID(context)
	if ok && authUserID != project.Owner {
		RespondWithError(context, http.StatusForbidden, "Only the owner can delete a stream")
		return
	}

	httpCode, err := database.QueryDeleteProject(id)
	// delete projects can return different errors...
	if err != nil {
		RespondWithError(context, int(httpCode), fmt.Sprintf("Failed to delete project: %v", err))
		return
	}
	context.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Project %v deleted.", id),
	})
}

// UpdateProjectInfo handles PATCH requests to update project information.
// It expects the `project_id` parameter in the URL and a JSON payload with update fields.
// Validates the project ID, checks for the existence of the project, and ensures the fields being updated are allowed.
// Returns:
// - 400 Bad Request for invalid input or disallowed fields.
// - 404 Not Found if the project does not exist.
// - 500 Internal Server Error for database errors.
// On success, responds with a 200 OK status and the updated project details in JSON format.
func UpdateProjectInfo(context *gin.Context) {
	var updateData map[string]interface{}

	// Parse project ID from the URL
	id, err := strconv.Atoi(context.Param("project_id"))
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse project id: %v", err))
		return
	}

	// Parse incoming JSON
	err = context.BindJSON(&updateData)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse update data: %v", err))
		return
	}

	// Check if the project exists
	existingProj, err := database.QueryProject(id)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Failed to retrieve project: %v", err))
		return
	}
	if existingProj == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("Project with id '%v' not found", id))
		return
	}

	authUserID, ok := GetAuthUserID(context)
	if ok && authUserID != existingProj.Owner {
		isBuilder, err := database.QueryIsProjectBuilder(id, authUserID)
		if err != nil {
			RespondWithError(context, http.StatusInternalServerError, "Failed to verify builder permissions")
			return
		}
		if !isBuilder {
			RespondWithError(context, http.StatusForbidden, "Forbidden")
			return
		}
	}

	// Validate new owner if provided in update data
	if newOwner, ok := updateData["owner"]; ok {
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

	// Filter and validate update fields
	updatedData := make(map[string]interface{})
	for key, value := range updateData {
		if IsFieldAllowed(existingProj, key) {
			updatedData[key] = value
		} else {
			RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Field '%v' is not allowed for updates", key))
			return
		}
	}

	// Update the project in the database
	err = database.QueryUpdateProject(id, updatedData)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error updating project: %v", err))
		return
	}

	updatedProj, err := database.QueryProject(id)

	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error validating updated project: %v", err))
		return
	}

	context.JSON(http.StatusOK, gin.H{
		"message": "Project updated successfully",
		"project": updatedProj,
	})
}

// GetProjectFollowers handles GET requests to fetch a list of users following a project.
// It expects the `project_id` parameter in the URL.
// Returns:
// - 400 Bad Request if the project ID is invalid.
// - Appropriate error code (404 if missing data, 500 if error) for database query failures.
// On success, responds with a 200 OK status and a list of followers in JSON format.
func GetProjectFollowers(context *gin.Context) {
	projectId := context.Param("project_id")
	intProjectId, err := strconv.Atoi(projectId)

	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse project id: %V", err))
	}

	followers, httpcode, err := database.QueryGetProjectFollowers(intProjectId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch followers: %v", err))
		return
	}

	context.JSON(http.StatusOK, followers)
}

// GetProjectFollowing handles GET requests to fetch a list of projects followed by a user.
// It expects the `username` parameter in the URL.
// Returns:
// - Appropriate error code (404 if missing data, 500 if error) for database query failures.
// On success, responds with a 200 OK status and a list of followed projects in JSON format.
func GetProjectFollowing(context *gin.Context) {
	username := context.Param("username")

	following, httpcode, err := database.QueryGetProjectFollowing(username)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch following: %v", err))
		return
	}

	context.JSON(http.StatusOK, following)
}

// GetProjectFollowersUsernames handles GET requests to fetch the usernames of users following a project.
// It expects the `project_id` parameter in the URL.
// Returns:
// - 400 Bad Request if the project ID is invalid.
// - Appropriate error code (404 if missing data, 500 if error) for database query failures.
// On success, responds with a 200 OK status and a list of usernames in JSON format.
func GetProjectFollowersUsernames(context *gin.Context) {
	projectId := context.Param("project_id")
	intProjectId, err := strconv.Atoi(projectId)

	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse project id: %V", err))
	}

	followers, httpcode, err := database.QueryGetProjectFollowersUsernames(intProjectId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch followers: %v", err))
		return
	}

	context.JSON(http.StatusOK, followers)
}

// GetProjectFollowingNames handles GET requests to fetch the names of projects followed by a user.
// It expects the `username` parameter in the URL.
// Returns:
// - Appropriate error code (404 if missing data, 500 if error) for database query failures.
// On success, responds with a 200 OK status and a list of project names in JSON format.
func GetProjectFollowingNames(context *gin.Context) {
	username := context.Param("username")

	following, httpcode, err := database.QueryGetProjectFollowingNames(username)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch following: %v", err))
		return
	}

	context.JSON(http.StatusOK, following)
}

// FollowProject handles POST requests to follow a project.
// It expects the `username` and `project_id` parameters in the URL.
// Returns:
// - Appropriate error code (404 if missing data, 500 if error) for database failures or invalid input.
// On success, responds with a 200 OK status and a confirmation message.
func FollowProject(context *gin.Context) {
	username := context.Param("username")
	projectId := context.Param("project_id")

	httpcode, err := database.CreateNewProjectFollow(username, projectId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to add follower: %v", err))
		return
	}

	projectInt, _ := strconv.Atoi(projectId)
	project, _ := database.QueryProject(projectInt)
	actorID, _ := database.GetUserIdByUsername(username)
	if project != nil {
		projectID64 := int64(project.ID)
		createAndPushNotification(
			project.Owner,
			int64(actorID),
			"save_project",
			nil,
			&projectID64,
			nil,
			notificationBody(username, "saved your stream"),
		)
	}
	context.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("%v now follows project %v", username, projectId)})
}

// UnfollowProject handles DELETE requests to unfollow a project.
// It expects the `username` and `project_id` parameters in the URL.
// Returns:
// - Appropriate error code (404 if missing data, 500 if error) for database failures or invalid input.
// On success, responds with a 200 OK status and a confirmation message.
func UnfollowProject(context *gin.Context) {
	username := context.Param("username")
	projectId := context.Param("project_id")

	httpcode, err := database.RemoveProjectFollow(username, projectId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to remove follower: %v", err))
		return
	}

	projectInt, _ := strconv.Atoi(projectId)
	project, _ := database.QueryProject(projectInt)
	actorID, _ := database.GetUserIdByUsername(username)
	if project != nil {
		projectID64 := int64(project.ID)
		_, _ = database.DeleteNotificationByReference(
			project.Owner,
			int64(actorID),
			"save_project",
			nil,
			&projectID64,
		)
	}
	context.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("%v unfollowed project %v", username, projectId)})
}

// LikeProject handles POST requests to like a project.
// It expects the `username` and `project_id` parameters in the URL.
// Returns:
// - Appropriate error code (404 if missing data, 500 if error) for database failures or invalid input.
// On success, responds with a 200 OK status and a confirmation message.
func LikeProject(context *gin.Context) {
	username := context.Param("username")
	projectId := context.Param("project_id")

	httpcode, err := database.CreateProjectLike(username, projectId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to like project: %v", err))
		return
	}
	context.JSON(httpcode, gin.H{"message": fmt.Sprintf("%v likes project %v", username, projectId)})
}

// UnlikeProject handles POST requests to unlike a project.
// It expects the `username` and `project_id` parameters in the URL.
// Returns:
// - Appropriate error code (404 if missing data, 500 if error) for database failures or invalid input.
// On success, responds with a 200 OK status and a confirmation message.
func UnlikeProject(context *gin.Context) {
	username := context.Param("username")
	projectId := context.Param("project_id")

	httpcode, err := database.RemoveProjectLike(username, projectId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to unlike project: %v", err))
		return
	}
	context.JSON(httpcode, gin.H{"message": fmt.Sprintf("%v unliked project %v", username, projectId)})
}

// IsProjectLiked handles GET requests to query for a project like.
// It expects the `username` and `project_id` parameters in the URL.
// Returns:
// - Appropriate error code for database failures or invalid input.
// On success, responds with a 200 OK status and a status message.
func IsProjectLiked(context *gin.Context) {
	username := context.Param("username")
	projectId := context.Param("project_id")

	httpcode, exists, err := database.QueryProjectLike(username, projectId)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to query for project like: %v", err))
		return
	}
	context.JSON(httpcode, gin.H{"status": exists})
}
