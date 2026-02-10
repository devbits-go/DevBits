package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"backend/api/internal/database"
	"backend/api/internal/types"
	"github.com/gin-gonic/gin"
)

// GetPostsFeed handles GET requests to retrieve a set of posts for the feed
// It expects the URL parameters of `type`, `start`, and `count`
// Returns:
// - 400 Bad Request if the inputs are invalid.
// - 404 Not Found if the post does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the post feed in JSON format.
func GetPostsFeed(context *gin.Context) {
	feedType := context.Query("type")
	strStart := context.Query("start")
	strCount := context.Query("count")

	const maxCount = 50

	if feedType == "" || strStart == "" || strCount == "" {
		RespondWithError(context, http.StatusBadRequest, "Missing one or more required url query parameters: type, start, or count")
		return
	}

	start, err := strconv.Atoi(strStart)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse starting int: %v", err))
		return
	}
	if start < 0 {
		RespondWithError(context, http.StatusBadRequest, "Start must be 0 or greater")
		return
	}

	count, err := strconv.Atoi(strCount)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse count int: %v", err))
		return
	}
	if count <= 0 {
		RespondWithError(context, http.StatusBadRequest, "Count must be greater than 0")
		return
	}
	if count > maxCount {
		count = maxCount
	}
	var posts []types.Post = []types.Post{}
	var code int
	switch feedType {
	case "time":
		posts, code, err = database.GetPostByTimeFeed(start, count)
	case "likes":
		posts, code, err = database.GetPostByLikesFeed(start, count)
	default:
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Invalid feed type passed: %v", feedType))
		return
	}
	if err != nil {
		RespondWithError(context, code, fmt.Sprintf("An error occurred getting feed: %v", err))
		return
	}
	context.JSON(http.StatusOK, posts)
}

// GetProjectsFeed handles GET requests to retrieve a set of projects for the feed
// It expects the URL parameters of `type`, `start`, and `count`
// Returns:
// - 400 Bad Request if the inputs are invalid.
// - 404 Not Found if the post does not exist.
// - 500 Internal Server Error if the database query fails.
// On success, responds with a 200 OK status and the post feed in JSON format.
func GetProjectsFeed(context *gin.Context) {
	feedType := context.Query("type")
	strStart := context.Query("start")
	strCount := context.Query("count")

	const maxCount = 50

	if feedType == "" || strStart == "" || strCount == "" {
		RespondWithError(context, http.StatusBadRequest, "Missing one or more required url query parameters: type, start, or count")
		return
	}

	start, err := strconv.Atoi(strStart)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse starting int: %v", err))
		return
	}
	if start < 0 {
		RespondWithError(context, http.StatusBadRequest, "Start must be 0 or greater")
		return
	}

	count, err := strconv.Atoi(strCount)
	if err != nil {
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Failed to parse count int: %v", err))
		return
	}
	if count <= 0 {
		RespondWithError(context, http.StatusBadRequest, "Count must be greater than 0")
		return
	}
	if count > maxCount {
		count = maxCount
	}
	var projects []types.Project = []types.Project{}
	var code int
	switch feedType {
	case "time":
		projects, code, err = database.GetProjectByTimeFeed(start, count)
	case "likes":
		projects, code, err = database.GetProjectByLikesFeed(start, count)
	default:
		RespondWithError(context, http.StatusBadRequest, fmt.Sprintf("Invalid feed type passed: %v", feedType))
		return
	}
	if err != nil {
		RespondWithError(context, code, fmt.Sprintf("An error occurred getting feed: %v", err))
		return
	}
	context.JSON(http.StatusOK, projects)
}
