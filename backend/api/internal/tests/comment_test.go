package tests

import (
	"net/http"
)

var comment_tests = []TestCase{
	// GET comment by ID – response now includes media field
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"content":"This is a fantastic project! Can't wait to contribute.","created_on":"2024-12-23T00:00:00Z","id":1,"likes":5,"media":[],"parent_comment":null,"user":1}`,
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
	// UPDATE comment – response now includes media field (null when not set)
	{
		Method:         http.MethodPut,
		Endpoint:       "/comments/15",
		Input:          `{"content":"Updated comment content"}`,
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `{"comment":{"content":"Updated comment content","id":15,"likes":0,"media":null,"parent_comment":1,"user":3},"message":"Comment updated successfully"}`,
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
	// DELETE comments (soft-delete sets user=-1 and content="This comment was deleted.")
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
	// GET comments by user – only returns comments belonging to user 1
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/by-user/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"content":"This is a fantastic project! Can't wait to contribute.","created_on":"2024-12-23T00:00:00Z","id":1,"likes":1,"media":[],"parent_comment":null,"user":1},{"content":"Looking forward to testing it!","created_on":"2024-12-23T00:00:00Z","id":12,"likes":2,"media":[],"parent_comment":3,"user":1}]`,
	},
	// GET comments by post – now includes media:[] on every comment
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/by-post/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"content":"Awesome update! I'll try it out.","created_on":"2024-12-23T00:00:00Z","id":7,"likes":2,"media":[],"parent_comment":null,"user":4},{"content":"Thanks for sharing! Will this feature be extended soon?","created_on":"2024-12-23T00:00:00Z","id":8,"likes":1,"media":[],"parent_comment":null,"user":3},{"content":"Great work, looking forward to more updates!","created_on":"2024-12-23T00:00:00Z","id":9,"likes":4,"media":[],"parent_comment":null,"user":5},{"content":"Will this be compatible with earlier versions of OpenAPI?","created_on":"2024-12-23T00:00:00Z","id":10,"likes":1,"media":[],"parent_comment":2,"user":2},{"content":"I hope the next update addresses performance improvements.","created_on":"2024-12-23T00:00:00Z","id":11,"likes":3,"media":[],"parent_comment":1,"user":3},{"content":"Looking forward to testing it!","created_on":"2024-12-23T00:00:00Z","id":12,"likes":2,"media":[],"parent_comment":3,"user":1},{"content":"This comment was deleted.","created_on":"1970-01-01T00:00:00Z","id":13,"likes":0,"media":[],"parent_comment":null,"user":-1}]`,
	},
	// GET comments by project – includes soft-deleted comment 14
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/by-project/1",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"content":"This is a fantastic project! Can't wait to contribute.","created_on":"2024-12-23T00:00:00Z","id":1,"likes":5,"media":[],"parent_comment":null,"user":1},{"content":"I love the concept, but I think the documentation could be improved.","created_on":"2024-12-23T00:00:00Z","id":2,"likes":3,"media":[],"parent_comment":null,"user":2},{"content":"Great to see more open-source tools for API development!","created_on":"2024-12-23T00:00:00Z","id":3,"likes":4,"media":[],"parent_comment":null,"user":4},{"content":"I agree, but the API specs seem a bit too complex for beginners.","created_on":"2024-12-23T00:00:00Z","id":4,"likes":2,"media":[],"parent_comment":3,"user":3},{"content":"I hope this toolkit will integrate with other Go tools soon!","created_on":"2024-12-23T00:00:00Z","id":5,"likes":1,"media":[],"parent_comment":1,"user":5},{"content":"I agree, the documentation is lacking in detail.","created_on":"2024-12-23T00:00:00Z","id":6,"likes":1,"media":[],"parent_comment":2,"user":3},{"content":"This comment was deleted.","created_on":"1970-01-01T00:00:00Z","id":14,"likes":0,"media":[],"parent_comment":null,"user":-1}]`,
	},
	// GET replies to comment 3 – comments 4 and 12 have parent_comment_id=3
	{
		Method:         http.MethodGet,
		Endpoint:       "/comments/by-comment/3",
		ExpectedStatus: http.StatusOK,
		ExpectedBody:   `[{"content":"I agree, but the API specs seem a bit too complex for beginners.","created_on":"2024-12-23T00:00:00Z","id":4,"likes":2,"media":[],"parent_comment":3,"user":3},{"content":"Looking forward to testing it!","created_on":"2024-12-23T00:00:00Z","id":12,"likes":2,"media":[],"parent_comment":3,"user":1}]`,
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
	// auth mismatch: user in body (99) doesn't match auth user (1)
	{
		Method:         http.MethodPost,
		Endpoint:       "/comments/for-post/1",
		Input:          `{"user":99,"content":"comment by wrong user","parent_comment":null}`,
		ExpectedStatus: http.StatusForbidden,
		ExpectedBody:   `{"error":"Forbidden","message":"Comment user does not match auth user"}`,
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
