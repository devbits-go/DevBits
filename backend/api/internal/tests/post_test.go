package tests

import (
	"net/http"
)

var post_tests = []TestCase{

	// GET post – response now includes media:[] and saves fields; likes is counted from postlikes table
	{
		Method:         http.MethodGet,
		Endpoint:       "/posts/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"content":"Excited to release the first version of OpenAPI Toolkit!","created_on":"2024-09-13T00:00:00Z","id":1,"likes":1,"media":[],"project":1,"saves":0,"user":1}`,
	},
	{
		Method:         http.MethodGet,
		Endpoint:       "/posts/-1",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Post with id '-1' not found"}`,
	},

	// CREATE post – dev_user1 is owner of project 1 so the builder check passes
	// 3 posts exist in test data (IDs 1-3) so the new post gets ID 4
	{
		Method:         http.MethodPost,
		Endpoint:       "/posts",
		Input:          `{"user":1,"project":1,"content":"New feature announcement!"}`,
		ExpectedStatus: http.StatusCreated,
		ExpectedBody:   `{"message":"Post created successfully with id '4'"}`,
		AuthAs:         "dev_user1:1",
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/posts",
		Input:          `{"user":1,"project":1,"content":""}`,
		ExpectedStatus: http.StatusBadRequest,
		ExpectedBody:   `{"error":"Bad Request","message":"Failed to bind to JSON: Key: 'Post.Content' Error:Field validation for 'Content' failed on the 'required' tag"}`,
		AuthAs:         "dev_user1:1",
	},
	// user=-1 doesn't match auth user (1) so auth check fires first
	{
		Method:         http.MethodPost,
		Endpoint:       "/posts",
		Input:          `{"user":-1,"project":1,"content":"Test content"}`,
		ExpectedStatus: http.StatusForbidden,
		ExpectedBody:   `{"error":"Forbidden","message":"Post user does not match auth user"}`,
		AuthAs:         "dev_user1:1",
	},

	// PUT update post – response includes media:[] and saves fields
	{
		Method:         http.MethodPut,
		Endpoint:       "/posts/1",
		Input:          `{"content":"Updated: First version of OpenAPI Toolkit released!"}`,
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"Post updated successfully","post":{"content":"Updated: First version of OpenAPI Toolkit released!","created_on":"2024-09-13T00:00:00Z","id":1,"likes":1,"media":[],"project":1,"saves":0,"user":1}}`,
		AuthAs:         "dev_user1:1",
	},
	{
		Method:         http.MethodPut,
		Endpoint:       "/posts/9999",
		Input:          `{"content":"Non-existent Post"}`,
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Post with id '9999' not found"}`,
		AuthAs:         "dev_user1:1",
	},

	// GET posts by user/project – responses include media:[] and saves
	// by-user/1 returns post 1 and the newly created post 4 (skip body check due to dynamic created_on)
	{
		Method:         http.MethodGet,
		Endpoint:       "/posts/by-user/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   "",
	},

	{
		Method:         http.MethodGet,
		Endpoint:       "/posts/by-project/2",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"content":"We've archived DocuHelper, but feel free to explore the code.","created_on":"2024-06-13T00:00:00Z","id":2,"likes":1,"media":[],"project":2,"saves":0,"user":2}]`,
	},

	// DELETE posts – post 4 was created above; post 9999 doesn't exist
	{
		Method:         http.MethodDelete,
		Endpoint:       "/posts/4",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"Post 4 deleted."}`,
		AuthAs:         "dev_user1:1",
	},
	{
		Method:         http.MethodDelete,
		Endpoint:       "/posts/9999",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Post with id '9999' not found"}`,
		AuthAs:         "dev_user1:1",
	},

	// LIKE / UNLIKE post
	{
		Method:         http.MethodPost,
		Endpoint:       "/posts/tech_writer2/likes/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"tech_writer2 likes post 1"}`,
		AuthAs:         "tech_writer2:2",
	},
	{
		Method:         http.MethodPost,
		Endpoint:       "/posts/tech_writer2/unlikes/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"tech_writer2 unliked post 1"}`,
		AuthAs:         "tech_writer2:2",
	},
	// after unlike, tech_writer2 no longer likes post 1
	{
		Method:         http.MethodGet,
		Endpoint:       "/posts/does-like/tech_writer2/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"status":false}`,
	},
}
