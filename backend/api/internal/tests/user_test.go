package tests

import (
	"net/http"
)

var user_tests = []TestCase{

	// get by existing user – response now includes id, settings, and creation_date
	{
		Method:         http.MethodGet,
		Endpoint:       "/users/dev_user1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"bio":"Full-stack developer passionate about open-source projects.","creation_date":"2023-12-13T00:00:00Z","id":1,"links":["https://github.com/dev_user1","https://devuser1.com"],"picture":"https://example.com/dev_user1.jpg","settings":{"accentColor":"","backgroundRefreshEnabled":false,"compactMode":false,"refreshIntervalMs":120000,"zenMode":false},"username":"dev_user1"}`,
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/users/dev_user1",
		ExpectedStatus: http.StatusMethodNotAllowed,
		ExpectedBody:   `405 method not allowed`,
	},

	// get by non-existent user
	{
		Method:         http.MethodGet,
		Endpoint:       "/users/non_dev_user1",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"User with username 'non_dev_user1' not found"}`,
	},

	// create user
	{
		Method:         http.MethodPost,
		Endpoint:       "/users",
		Input:          `{"username":"new_user","bio":"This is a test user.","links":["https://example.com","https://another-link.com"],"picture":"https://example.com/profile.jpg"}`,
		ExpectedStatus: http.StatusCreated,
		ExpectedBody:   `{"message":"Created new user: 'new_user'"}`,
		AuthAs:         "dev_user1:1",
	},

	// creating same user again – UNIQUE constraint error
	{
		Method:         http.MethodPost,
		Endpoint:       "/users",
		Input:          `{"username":"new_user","bio":"This is a test user.","links":["https://example.com","https://another-link.com"],"picture":"https://example.com/profile.jpg"}`,
		ExpectedStatus: http.StatusInternalServerError,
		ExpectedBody:   `{"error":"Internal Server Error","message":"Failed to create user: failed to insert user: constraint failed: UNIQUE constraint failed: users.username (2067)"}`,
		AuthAs:         "dev_user1:1",
	},

	// creating user with empty username – binding:"required" rejects blank usernames
	{
		Method:         http.MethodPost,
		Endpoint:       "/users",
		Input:          `{"username":"","bio":"This is a test user.","links":["https://example.com","https://another-link.com"],"picture":"https://example.com/profile.jpg"}`,
		ExpectedStatus: http.StatusBadRequest,
		ExpectedBody:   `{"error":"Bad Request","message":"Failed to bind to JSON: Key: 'ApiUser.Username' Error:Field validation for 'Username' failed on the 'required' tag"}`,
		AuthAs:         "dev_user1:1",
	},

	// updating user – empty username in body is silently ignored; other fields are updated
	// (creation_date and picture are not part of the update input so they retain their original values)
	{
		Method:         http.MethodPut,
		Endpoint:       "/users/new_user",
		Input:          `{"username":"","bio":"Updated bio for new_user.","links":["https://example.com","https://another-link.com"]}`,
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   "",
		AuthAs:         "new_user",
	},

	// username updates are not supported
	{
		Method:         http.MethodPut,
		Endpoint:       "/users/dev_user1",
		Input:          `{"username":"tech_writer2"}`,
		ExpectedStatus: http.StatusBadRequest,
		ExpectedBody:   `{"error":"Bad Request","message":"Username updates are not supported"}`,
		AuthAs:         "dev_user1:1",
	},

	// update bio and links successfully
	{
		Method:         http.MethodPut,
		Endpoint:       "/users/dev_user1",
		Input:          `{"bio":"Updated developer bio.","links":["https://github.com/dev_user1","https://devuser1.com"]}`,
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"User updated successfully.","user":{"bio":"Updated developer bio.","creation_date":"2023-12-13T00:00:00Z","id":1,"links":["https://github.com/dev_user1","https://devuser1.com"],"picture":"https://example.com/dev_user1.jpg","settings":{"accentColor":"","backgroundRefreshEnabled":false,"compactMode":false,"refreshIntervalMs":120000,"zenMode":false},"username":"dev_user1"}}`,
		AuthAs:         "dev_user1:1",
	},

	// update non-existent user
	{
		Method:         http.MethodPut,
		Endpoint:       "/users/not_a_user",
		Input:          `{"bio":"bio"}`,
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"User with name 'not_a_user' not found"}`,
		AuthAs:         "not_a_user",
	},

	// delete test user – response now includes removed_uploads counts
	{
		Method:         http.MethodDelete,
		Endpoint:       "/users/new_user",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"User 'new_user' deleted.","removed_orphan_uploads":0,"removed_uploads":0}`,
		AuthAs:         "new_user",
	},

	// delete non-existent user
	{
		Method:         http.MethodDelete,
		Endpoint:       "/users/not_a_user",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"User 'not_a_user' not found."}`,
		AuthAs:         "not_a_user",
	},

	// follow / unfollow
	{
		Method:         http.MethodPost,
		Endpoint:       "/users/dev_user1/follow/tech_writer2",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"dev_user1 now follows tech_writer2"}`,
		AuthAs:         "dev_user1:1",
	},
	// non-existent followee
	{
		Method:         http.MethodPost,
		Endpoint:       "/users/tech_writer2/follow/dev",
		ExpectedStatus: http.StatusInternalServerError,
		ExpectedBody:   `{"error":"Internal Server Error","message":"Failed to add follower: followed user not found"}`,
		AuthAs:         "tech_writer2:2",
	},
	// non-existent follower
	{
		Method:         http.MethodPost,
		Endpoint:       "/users/tech/follow/dev_user1",
		ExpectedStatus: http.StatusInternalServerError,
		ExpectedBody:   `{"error":"Internal Server Error","message":"Failed to add follower: follower not found"}`,
		AuthAs:         "tech",
	},
	// follows now returns full user objects
	{
		Method:         http.MethodGet,
		Endpoint:       "/users/dev_user1/follows",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"bio":"Technical writer and Python enthusiast.","creation_date":"2022-12-13T00:00:00Z","id":2,"links":["https://blog.techwriter.com"],"picture":"https://example.com/tech_writer2.jpg","settings":{"accentColor":"","backgroundRefreshEnabled":false,"compactMode":false,"refreshIntervalMs":120000,"zenMode":false},"username":"tech_writer2"},{"bio":"Data scientist with a passion for machine learning.","creation_date":"2023-06-13T00:00:00Z","id":3,"links":["https://github.com/data_scientist3","https://datascientist3.com"],"picture":"https://example.com/data_scientist3.jpg","settings":{"accentColor":"","backgroundRefreshEnabled":false,"compactMode":false,"refreshIntervalMs":120000,"zenMode":false},"username":"data_scientist3"}]`,
	},
	// followers now returns full user objects
	{
		Method:         http.MethodGet,
		Endpoint:       "/users/dev_user1/followers",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"bio":"Backend expert specializing in scalable systems.","creation_date":"2024-01-15T00:00:00Z","id":4,"links":["https://github.com/backend_guru4"],"picture":"https://example.com/backend_guru4.jpg","settings":{"accentColor":"","backgroundRefreshEnabled":false,"compactMode":false,"refreshIntervalMs":120000,"zenMode":false},"username":"backend_guru4"}]`,
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/users/dev_user1/unfollow/tech_writer2",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"dev_user1 unfollowed tech_writer2"}`,
		AuthAs:         "dev_user1:1",
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/users/backend_guru4/unfollow/dev_user1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"backend_guru4 unfollowed dev_user1"}`,
		AuthAs:         "backend_guru4:4",
	},
	// non-existent followee unfollow
	{
		Method:         http.MethodPost,
		Endpoint:       "/users/tech_writer2/unfollow/dev",
		ExpectedStatus: http.StatusInternalServerError,
		ExpectedBody:   `{"error":"Internal Server Error","message":"Failed to remove follower: followed user not found"}`,
		AuthAs:         "tech_writer2:2",
	},
	// non-existent follower unfollow
	{
		Method:         http.MethodPost,
		Endpoint:       "/users/tech/unfollow/dev_user1",
		ExpectedStatus: http.StatusInternalServerError,
		ExpectedBody:   `{"error":"Internal Server Error","message":"Failed to remove follower: follower not found"}`,
		AuthAs:         "tech",
	},
	// after unfollow tech_writer2, only data_scientist3 remains
	{
		Method:         http.MethodGet,
		Endpoint:       "/users/dev_user1/follows",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"bio":"Data scientist with a passion for machine learning.","creation_date":"2023-06-13T00:00:00Z","id":3,"links":["https://github.com/data_scientist3","https://datascientist3.com"],"picture":"https://example.com/data_scientist3.jpg","settings":{"accentColor":"","backgroundRefreshEnabled":false,"compactMode":false,"refreshIntervalMs":120000,"zenMode":false},"username":"data_scientist3"}]`,
	},
	// after backend_guru4 unfollowed dev_user1, followers list is empty
	{
		Method:         http.MethodGet,
		Endpoint:       "/users/dev_user1/followers",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `null`,
	},
}
