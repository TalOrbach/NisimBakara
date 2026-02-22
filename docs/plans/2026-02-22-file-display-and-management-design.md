# File Display & Management — Design Doc

**Date:** 2026-02-22
**Status:** Approved

## Goal

Extend the folder browser to also display files (not just folders), allow rename/delete operations on any file, show thumbnails for images in תמונות folders, and clean up the upload form after successful uploads.

## Changes

### 1. Show Files in Folder Listings

**Current behavior:** `fetchFolders()` filters response to only items with `item.folder`. Files are invisible.

**New behavior:** Return both folders and files. Render them separately:

- **Folders** render at top as usual (navigable cards)
- **Files** appear in a collapsible **"קבצים (N)"** section below the folder list
  - **Collapsed by default** when the folder also has subfolders
  - **Expanded automatically** when the folder has zero subfolders (e.g., inside a תמונות folder that only has image files)
- Search/filter applies to both folders and files

**In תמונות folders:** File cards show a **thumbnail + filename**. Thumbnails loaded lazily via a new Make.com scenario.

**In other folders:** File cards show a **file-type icon + filename** (no thumbnail). Icon based on extension (e.g., 📄 for docs, 📊 for Excel, 🖼️ for images, 📁 fallback).

### 2. File Operations — Rename

Available on every file, in every folder.

**UX flow:**
1. Each file card has a pencil (edit) icon button
2. Tap pencil → filename becomes an editable text input, pencil becomes a **save button** (✓) and a **cancel button** (✕)
3. User edits the name
4. Tap save → calls Rename webhook → on success, update name in place; on error, show inline error message
5. Tap cancel → revert to original name, exit edit mode
6. **No auto-save on blur** — explicit save required

**API:** New Make.com scenario — PATCH `/drive/items/{itemId}` with `{name: newName}`

### 3. File Operations — Delete

Available on every file, in every folder.

**UX flow:**
1. Each file card has a trash icon button
2. Tap trash → button area transforms to inline confirmation: "מחיקה?" with confirm (✓) and cancel (✕) buttons
3. Confirm → calls Delete webhook → on success, remove card from list with animation; on error, show inline error
4. Cancel → revert to normal state

**API:** New Make.com scenario — DELETE `/drive/items/{itemId}`

### 4. Thumbnails for Images

Only for image files (detected by extension: .jpg, .jpeg, .png, .gif, .bmp, .webp, .heic).

**Approach:** New Make.com scenario that proxies Graph API thumbnail endpoint:
- Input: `{itemId}`
- Graph API: `GET /drive/items/{itemId}/thumbnails/0/small/content`
- Returns: binary image data (or base64-encoded)

**Loading strategy:**
- Show a placeholder/skeleton while loading
- Load thumbnails lazily (only for visible items, or in batches)
- Cache thumbnail URLs in memory for the session (no localStorage)
- If thumbnail fails, show generic image icon (🖼️)

### 5. Post-Upload Cleanup

**Current behavior:** After upload completes, all photos remain in the form list regardless of status. User can accidentally re-upload.

**New behavior:**
1. After upload completes, **remove all photos with status "done"** from `state.photos`
2. **Keep photos with status "error"** so user can retry
3. **Refresh the file listing** for the current folder so newly uploaded files appear in the existing files section
4. Update upload button state accordingly
5. If all photos succeeded and none remain, show success message and empty photo list

### 6. New Make.com Scenarios

Three new scenarios needed:

#### Scenario: Rename File
- **Webhook input:** `{"itemId": "<driveItemId>", "newName": "<filename>"}`
- **Graph API:** `PATCH /v1.0/sites/{siteId}/drive/items/{itemId}` with body `{"name": "<newName>"}`
- **Response:** Updated item JSON

#### Scenario: Delete File
- **Webhook input:** `{"itemId": "<driveItemId>"}`
- **Graph API:** `DELETE /v1.0/sites/{siteId}/drive/items/{itemId}`
- **Response:** `{"success": true}` (Graph API returns 204 No Content)

#### Scenario: Get Thumbnail
- **Webhook input:** `{"itemId": "<driveItemId>"}`
- **Graph API:** `GET /v1.0/sites/{siteId}/drive/items/{itemId}/thumbnails/0/small/content`
- **Response:** Binary image data (the webhook responds with the image)

### 7. Code Changes Summary

**`js/app.js`:**
- `fetchFolders()` → rename to `fetchItems()` or stop filtering out non-folder items; separate items into `state.currentFolders` and `state.currentFiles`
- New `renderFiles()` function for the collapsible files section
- New `renameFile(itemId, newName)` and `deleteFile(itemId)` API functions
- New `fetchThumbnail(itemId)` API function
- Modify `startUpload()` completion handler: clear done photos, refresh file listing
- Update search to filter both folders and files

**`index.html`:**
- Add files section container below `folder-list` (collapsible header + file list)

**`css/style.css`:**
- File card styles (thumbnail variant + icon variant)
- Collapsible section header with chevron
- Inline edit mode styles
- Inline delete confirmation styles
- Thumbnail placeholder/skeleton

### 8. Edge Cases

- **Rename to existing name:** Graph API returns 409 Conflict — show error "שם קובץ כבר קיים"
- **Delete last file:** Section collapses/hides, show empty state
- **Large folders:** Graph API `$top=999` should cover most cases; pagination not needed initially
- **Non-image files in תמונות:** Show file-type icon, not thumbnail
- **Upload while files section is open:** Files section refreshes after upload completes
