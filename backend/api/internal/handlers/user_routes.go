package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"backend/api/internal/database"
	"backend/api/internal/types"

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

	user, err := database.QueryUsername(username)
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

	user, err := database.QueryUsername(username)
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

	user, err := database.QueryUserById(userId)
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
	strStart := context.Query("start")
	strCount := context.Query("count")
	start := 0
	count := 50

	if strStart != "" {
		parsed, err := strconv.Atoi(strStart)
		if err != nil || parsed < 0 {
			RespondWithError(context, http.StatusBadRequest, "Start must be a non-negative integer")
			return
		}
		start = parsed
	}

	if strCount != "" {
		parsed, err := strconv.Atoi(strCount)
		if err != nil || parsed <= 0 {
			RespondWithError(context, http.StatusBadRequest, "Count must be a positive integer")
			return
		}
		if parsed > 100 {
			parsed = 100
		}
		count = parsed
	}

	users, err := database.QueryUsersPage(start, count)
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
	var newUser types.User
	err := context.BindJSON(&newUser)

	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to bind to JSON: %v", err))
		return
	}
	err = database.QueryCreateUser(&newUser)
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
	httpCode, err := database.QueryDeleteUser(username)
	if err != nil {
		RespondWithError(context, int(httpCode), fmt.Sprintf("Failed to delete user: %v", err))
		return
	}
	context.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("User '%v' deleted.", username)})
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

	existingUser, err := database.QueryUsername(username)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error fetching user: %v", err))
		return
	}

	if existingUser == nil {
		RespondWithError(context, http.StatusNotFound, fmt.Sprintf("User with name '%v' not found", username))
		return
	}

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
	err = database.QueryUpdateUser(username, updatedData)
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error updating user: %v", err))
		return
	}

	var validUser *types.User
	newUsername, usernameExists := updatedData["username"]
	usernameStr, parseOk := newUsername.(string)

	// if there is a new username provided, ensure it is not empty
	if usernameExists && parseOk && usernameStr != "" {
		validUser, err = database.QueryUsername(usernameStr)
	} else {
		validUser, err = database.QueryUsername(username)
	}
	if err != nil {
		RespondWithError(context, http.StatusInternalServerError, fmt.Sprintf("Error validating updated data: %v", err))
	}
	context.JSON(http.StatusOK, gin.H{"message": "User updated successfully.", "user": validUser})
}

// GetUsersFollowers handles GET requests to fetch the list of user IDs who follow the specified user.
// It expects the `username` parameter in the URL.
// Returns:
// - 404 Not Found if no user is found with the given username.
// - 500 Internal Server Error if a database query fails.
// On success, responds with a 200 OK status and a list of follower IDs in JSON format.
func GetUsersFollowers(context *gin.Context) {
	username := context.Param("username")

	followers, httpcode, err := database.QueryGetUsersFollowers(username)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch followers: %v", err))
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

	following, httpcode, err := database.QueryGetUsersFollowing(username)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch following: %v", err))
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

	followers, httpcode, err := database.QueryGetUsersFollowersUsernames(username)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch followers: %v", err))
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

	following, httpcode, err := database.QueryGetUsersFollowingUsernames(username)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to fetch following: %v", err))
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

	httpcode, err := database.CreateNewUserFollow(username, newFollow)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to add follower: %v", err))
		return
	}

	actorID, _ := database.GetUserIdByUsername(username)
	userID, _ := database.GetUserIdByUsername(newFollow)
	createAndPushNotification(
		int64(userID),
		int64(actorID),
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

	httpcode, err := database.RemoveUserFollow(username, unFollow)
	if err != nil {
		RespondWithError(context, httpcode, fmt.Sprintf("Failed to remove follower: %v", err))
		return
	}
	context.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("%v unfollowed %v", username, unFollow)})
}
