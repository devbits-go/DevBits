package handlers

import "testing"

func TestIsValidExpoPushToken(t *testing.T) {
	cases := []struct {
		name  string
		token string
		want  bool
	}{
		{name: "legacy token", token: "ExponentPushToken[abc123]", want: true},
		{name: "current token", token: "ExpoPushToken[abc123]", want: true},
		{name: "invalid token", token: "abc123", want: false},
		{name: "empty token", token: "", want: false},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			got := isValidExpoPushToken(testCase.token)
			if got != testCase.want {
				t.Fatalf("isValidExpoPushToken(%q) = %v, want %v", testCase.token, got, testCase.want)
			}
		})
	}
}

func TestShouldDeleteToken(t *testing.T) {
	tests := []struct {
		name string
		body string
		want bool
	}{
		{
			name: "device not registered details",
			body: `{"data":{"status":"error","message":"The recipient device is not registered with FCM","details":{"error":"DeviceNotRegistered"}}}`,
			want: true,
		},
		{
			name: "recipient message only",
			body: `{"data":{"status":"error","message":"is not a registered push notification recipient","details":{"error":""}}}`,
			want: true,
		},
		{
			name: "ok response",
			body: `{"data":{"status":"ok"}}`,
			want: false,
		},
		{
			name: "invalid response",
			body: `not-json`,
			want: false,
		},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			got := shouldDeleteToken([]byte(testCase.body))
			if got != testCase.want {
				t.Fatalf("shouldDeleteToken(%s) = %v, want %v", testCase.name, got, testCase.want)
			}
		})
	}
}
