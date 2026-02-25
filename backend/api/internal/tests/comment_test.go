package tests

import (
	"net/http"
)

var comment_tests = []TestCase{
	// GET comment by ID
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"id":1,"user":1,"likes":5,"parent_comment":null,"created_on":"2024-12-23T00:00:00Z","content":"This is a fantastic project! Can't wait to contribute."}`,
	},
	// GET non-existent comment
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/-9999",
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Comment with id -9999 not found"}`,
	},
	// CREATE comment on post
	{
		Method:         http.MethodPost,
		Endpoint:       "/comments/for-post/1",
		Input:          `{"user":1,"content":"New comment on post","parent_comment":null}`,
		ExpectedStatus: http.StatusCreated,
		ExpectedBody:   `{"message":"Comment created successfully with id 13"}`,
		AuthAs:         "dev_user1:1",
	},
	// CREATE comment on project
	{
		Method:         http.MethodPost,
		Endpoint:       "/comments/for-project/1",
		Input:          `{"user":2,"content":"New comment on project","parent_comment":null}`,
		ExpectedStatus: http.StatusCreated,
		ExpectedBody:   `{"message":"Comment created successfully with id 14"}`,
		AuthAs:         "tech_writer2:2",
	},
	// CREATE reply to comment
	{
		Method:         http.MethodPost,
		Endpoint:       "/comments/for-comment/1",
		Input:          `{"user":3,"content":"Reply to existing comment","parent_comment":1}`,
		ExpectedStatus: http.StatusCreated,
		ExpectedBody:   `{"message":"Reply created successfully with id 15"}`,
		AuthAs:         "data_scientist3:3",
	},
	// UPDATE comment
	{
		Method:         http.MethodPut,
		Endpoint:       "/comments/15",
		Input:          `{"content":"Updated comment content"}`,
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"comment":{"content":"Updated comment content","id":15,"likes":0,"parent_comment":1,"user":3},"message":"Comment updated successfully"}`,
		AuthAs:         "data_scientist3:3",
	},
	// UPDATE old comment (should fail — past edit window)
	{
		Method:         http.MethodPut,
		Endpoint:       "/comments/1",
		Input:          `{"content":"Updated comment content"}`,
		ExpectedStatus: http.StatusBadRequest,
		ExpectedBody:   `{"error":"Bad Request","message":"Error updating comment: Cannot update comment. More than 2 minutes have passed since posting."}`,
		AuthAs:         "dev_user1:1",
	},
	// DELETE comments
	{
		Method:         http.MethodDelete,
		Endpoint:       "/comments/13",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"Comment 13 soft deleted."}`,
		AuthAs:         "dev_user1:1",
	},
	{
		Method:         http.MethodDelete,
		Endpoint:       "/comments/14",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"Comment 14 soft deleted."}`,
		AuthAs:         "tech_writer2:2",
	},
	{
		Method:         http.MethodDelete,
		Endpoint:       "/comments/15",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"Comment 15 soft deleted."}`,
		AuthAs:         "data_scientist3:3",
	},
	// GET comments by user
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/by-user/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"id":1,"user":1,"likes":1,"parent_comment":null,"created_on":"2024-12-23T00:00:00Z","content":"This is a fantastic project! Can't wait to contribute."},{"id":2,"user":2,"likes":0,"parent_comment":null,"created_on":"2024-12-23T00:00:00Z","content":"I love the concept, but I think the documentation could be improved."},{"id":3,"user":4,"likes":1,"parent_comment":null,"created_on":"2024-12-23T00:00:00Z","content":"Great to see more open-source tools for API development!"},{"id":4,"user":3,"likes":1,"parent_comment":3,"created_on":"2024-12-23T00:00:00Z","content":"I agree, but the API specs seem a bit too complex for beginners."},{"id":5,"user":5,"likes":0,"parent_comment":1,"created_on":"2024-12-23T00:00:00Z","content":"I hope this toolkit will integrate with other Go tools soon!"},{"id":6,"user":3,"likes":0,"parent_comment":2,"created_on":"2024-12-23T00:00:00Z","content":"I agree, the documentation is lacking in detail."},{"id":14,"user":-1,"likes":0,"parent_comment":null,"created_on":"1970-01-01T00:00:00Z","content":"This comment was deleted."},{"id":12,"user":1,"likes":2,"parent_comment":3,"created_on":"2024-12-23T00:00:00Z","content":"Looking forward to testing it!"}]`,
	},
	// GET comments by post
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/by-post/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"id":7,"user":4,"likes":2,"parent_comment":null,"created_on":"2024-12-23T00:00:00Z","content":"Awesome update! I'll try it out."},{"id":8,"user":3,"likes":1,"parent_comment":null,"created_on":"2024-12-23T00:00:00Z","content":"Thanks for sharing! Will this feature be extended soon?"},{"id":9,"user":5,"likes":4,"parent_comment":null,"created_on":"2024-12-23T00:00:00Z","content":"Great work, looking forward to more updates!"},{"id":10,"user":2,"likes":1,"parent_comment":2,"created_on":"2024-12-23T00:00:00Z","content":"Will this be compatible with earlier versions of OpenAPI?"},{"id":11,"user":3,"likes":3,"parent_comment":1,"created_on":"2024-12-23T00:00:00Z","content":"I hope the next update addresses performance improvements."},{"id":12,"user":1,"likes":2,"parent_comment":3,"created_on":"2024-12-23T00:00:00Z","content":"Looking forward to testing it!"},{"id":13,"user":-1,"likes":0,"parent_comment":null,"created_on":"1970-01-01T00:00:00Z","content":"This comment was deleted."}]`,
	},
	// GET comments by project
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/by-project/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"id":1,"user":1,"likes":5,"parent_comment":null,"created_on":"2024-12-23T00:00:00Z","content":"This is a fantastic project! Can't wait to contribute."},{"id":2,"user":2,"likes":3,"parent_comment":null,"created_on":"2024-12-23T00:00:00Z","content":"I love the concept, but I think the documentation could be improved."},{"id":3,"user":4,"likes":4,"parent_comment":null,"created_on":"2024-12-23T00:00:00Z","content":"Great to see more open-source tools for API development!"},{"id":4,"user":3,"likes":2,"parent_comment":3,"created_on":"2024-12-23T00:00:00Z","content":"I agree, but the API specs seem a bit too complex for beginners."},{"id":5,"user":5,"likes":1,"parent_comment":1,"created_on":"2024-12-23T00:00:00Z","content":"I hope this toolkit will integrate with other Go tools soon!"},{"id":6,"user":3,"likes":1,"parent_comment":2,"created_on":"2024-12-23T00:00:00Z","content":"I agree, the documentation is lacking in detail."},{"id":14,"user":-1,"likes":0,"parent_comment":null,"created_on":"1970-01-01T00:00:00Z","content":"This comment was deleted."}]`,
	},
	// GET replies to comment
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/by-comment/3",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"id":8,"user":3,"likes":1,"parent_comment":null,"created_on":"2024-12-23T00:00:00Z","content":"Thanks for sharing! Will this feature be extended soon?"},{"id":11,"user":3,"likes":3,"parent_comment":1,"created_on":"2024-12-23T00:00:00Z","content":"I hope the next update addresses performance improvements."}]`,
	},
	// LIKE comment
	{
		Method:         http.MethodPost,
		Endpoint:       "/comments/dev_user1/likes/2",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"dev_user1 likes comment 2"}`,
		AuthAs:         "dev_user1:1",
	},
	// UNLIKE comment
	{
		Method:         http.MethodPost,
		Endpoint:       "/comments/dev_user1/unlikes/2",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"message":"dev_user1 unliked comment 2"}`,
		AuthAs:         "dev_user1:1",
	},
	// CHECK if comment is liked
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/does-like/tech_writer2/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"status":true}`,
	},
	// invalid inputs
	{
		Method:         http.MethodPost,
		Endpoint:       "/comments/for-post/1",
		Input:          `{"invalid":"json"}`,
		ExpectedStatus: http.StatusBadRequest,
		ExpectedBody:   `{"error":"Bad Request","message":"Failed to bind to JSON: Key: 'Comment.User' Error:Field validation for 'User' failed on the 'required' tag\nKey: 'Comment.Content' Error:Field validation for 'Content' failed on the 'required' tag"}`,
		AuthAs:         "dev_user1:1",
	},
	{
		Method:         http.MethodPut,
		Endpoint:       "/comments/-9999",
		Input:          `{"content":"Update non-existent comment"}`,
		ExpectedStatus: http.StatusNotFound,
		ExpectedBody:   `{"error":"Not Found","message":"Comment with id -9999 not found"}`,
		AuthAs:         "dev_user1:1",
	},
}
