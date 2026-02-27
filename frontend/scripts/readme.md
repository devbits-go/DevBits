# React Native ADB Logging Guide

Guide for connecting to an Android device/emulator and capturing logs for debugging React Native apps.

---

## 1. Connect to Device/Emulator

```cmd
adb connect 127.0.0.1:7555
adb devices
```

**Command breakdown:**

- `adb connect <IP:PORT>` – Connects to a device over TCP/IP
- `adb devices` – Lists all connected devices/emulators

**Expected output:**

```
List of devices attached
127.0.0.1:7555  device
```

---

## 2. Capture All Logs

Capture complete system logs with timestamps:

```cmd
adb -s 127.0.0.1:7555 logcat -v time > C:\Temp\crash-full.log
```

**Command breakdown:**

- `-s <device>` – Target a specific device
- `logcat` – Capture Android system logs
- `-v time` – Add timestamps to each log line
- `> <filepath>` – Redirect output to a file

**Stop logging:** Press `Ctrl+C` when done

---

## 3. Capture React Native-Specific Logs

Focus only on React Native logs and critical errors:

```cmd
adb -s 127.0.0.1:7555 logcat -v time ReactNative:V ReactNativeJS:V AndroidRuntime:E *:S > C:\Temp\rn-js.log
```

**Command breakdown:**

- `ReactNative:V` – Verbose logs for React Native tag
- `ReactNativeJS:V` – Verbose logs for React Native JS thread
- `AndroidRuntime:E` – Errors only from Android runtime
- `*:S` – Silence all other tags (reduces noise)

**Stop logging:** Press `Ctrl+C` when done

---

## Quick Reference

| Command                      | Purpose                    |
| ---------------------------- | -------------------------- |
| `adb devices`                | List connected devices     |
| `adb connect 127.0.0.1:7555` | Connect to emulator/device |
| `adb logcat -v time`         | View logs with timestamps  |
| `Ctrl+C`                     | Stop log capture           |

---

## Common Issues

**Command fails with "test is not recognized"**

- Don't use `test` command on Windows (it's Linux/macOS only)

**Command fails with extra text after redirect**

- Don't add extra characters after `>` (e.g., avoid `... > file.log ttt`)
- Windows treats everything after `>` as a filename

**Logs directory doesn't exist**

- Create `C:\Temp\` or use an existing folder
- Or modify the path: `> C:\Users\<Username>\Documents\crash-full.log`

---

## Tips for Debugging

1. **Reproduce the crash** – Run the steps that cause the issue
2. **Capture logs** – Use the appropriate command above
3. **Stop logging** – Press `Ctrl+C` once issue appears
4. **Review logs** – Open the `.log` file to find the error
5. **Filter further** – Add more tags as needed (e.g., `MyApp:V`)

---

## Example Workflow

```cmd
# 1. Connect
adb connect 127.0.0.1:7555
adb devices

# 2. Start capturing React Native logs
adb -s 127.0.0.1:7555 logcat -v time ReactNative:V ReactNativeJS:V AndroidRuntime:E *:S > C:\Temp\rn-js.log

# 3. Reproduce your crash in the app...

# 4. Stop logging (Ctrl+C)

# 5. Review C:\Temp\rn-js.log for errors
```

---
