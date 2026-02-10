// The handlers package includes all of the functionality to
// process http requests through the use of gin and its contexts
// in order for the workflow to process through to the database
// efficiently and effectively.
//
// it mainly uses net/http and gin-gonic/gin as packages to
// efficiently process http requests
package handlers

import (
	"net/http"
	"reflect"
	"strings"

	"backend/api/internal/logger"
	"backend/api/internal/types"

	"github.com/gin-gonic/gin"
)

func IsFieldAllowed(existingData interface{}, fieldName string) bool {
	// existingUser should be a pointer to the struct, so get the type of the struct
	val := reflect.ValueOf(existingData)

	// data insurance
	// If it's a pointer, dereference it to get the value
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}
	if val.Kind() != reflect.Struct {
		return false
	}

	// Loop through all fields of the struct
	for i := 0; i < val.NumField(); i++ {
		// Get the field and its JSON tag
		field := val.Type().Field(i)
		jsonTag := field.Tag.Get("json")

		// If the JSON tag matches the fieldName, return true
		if strings.EqualFold(jsonTag, fieldName) {
			return true
		}
	}

	return false
}

func RespondWithError(context *gin.Context, status int, message string) {
	logger.Log.Infof("Error: %s", message)
	response := types.ErrorResponse{
		Error:   http.StatusText(status),
		Message: message,
	}
	context.JSON(status, response)
}

func GetAuthUserID(context *gin.Context) (int64, bool) {
	value, ok := context.Get(authUserIDKey)
	if !ok || value == nil {
		return 0, false
	}
	userID, ok := value.(int64)
	return userID, ok
}
