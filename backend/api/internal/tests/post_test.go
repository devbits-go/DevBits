package tests

import (
	"net/http"
)

var post_tests = []TestCase{

	{
		Method:         http.MethodGet,
		Endpoint:       "/posts/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"id":1,"user":1,"project":1,"likes":40,"content":"Excited to release the first version of OpenAPI Toolkit!","created_on":"2024-09-13T00:00:00Z"}`,
	},
	{
		Method:         http.MethodGet,
		Endpoint:       "/posts/-1",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Post with id '-1' not found"}`,
	},

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
	{
		Method:         http.MethodPost,
		Endpoint:       "/posts",
		Input:          `{"user":-1,"project":1,"content":"Test content"}`,
		ExpectedStatus: http.StatusBadRequest,
		ExpectedBody:   `{"error":"Bad Request","message":"Failed to verify post ownership. User could not be found"}`,
		AuthAs:         "dev_user1:1",
	},

	{
		Method:         http.MethodPut,
		Endpoint:       "/posts/1",
		Input:          `{"content":"Updated: First version of OpenAPI Toolkit released!"}`,
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"Post updated successfully","post":{"id":1,"user":1,"project":1,"likes":40,"content":"Updated: First version of OpenAPI Toolkit released!","created_on":"2024-09-13T00:00:00Z"}}`,
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

	{
		Method:         http.MethodGet,
		Endpoint:       "/posts/by-user/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"id":1,"user":1,"project":1,"likes":40,"content":"Updated: First version of OpenAPI Toolkit released!","created_on":"2024-09-13T00:00:00Z"}]`,
	},

	{
		Method:         http.MethodGet,
		Endpoint:       "/posts/by-project/2",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"id":2,"user":2,"project":2,"likes":25,"content":"We've archived DocuHelper, but feel free to explore the code.","created_on":"2024-06-13T00:00:00Z"}]`,
	},

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
		ExpectedBody:   `{"error":"Not Found","message":"Failed to delete post: Deletion did not affect any records"}`,
		AuthAs:         "dev_user1:1",
	},

	{
		Method:         http.MethodPost,
		Endpoint:       "/posts/tech_writer2/likes/1",
		ExpectedStatus: http.StatusCreated,
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

	{
		Method:         http.MethodGet,
		Endpoint:       "/posts/does-like/tech_writer2/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"status":false}`,
	},
}
