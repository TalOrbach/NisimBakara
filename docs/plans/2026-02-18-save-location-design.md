# Save Location Feature — Design

## Overview
Auto-save the inspector's current folder location so they can resume uploading without re-navigating the folder tree each time.

## Behavior

### Saving
Every time the inspector lands on a folder with a detected target (תמונות found or visit folder detected), the full navigation state is auto-saved to `localStorage`. Each new save overwrites the previous one.

### Data Format
```json
{
  "breadcrumbs": [{"name": "תיקים לבקרה", "id": "root"}, ...],
  "targetFolder": {"name": "תמונות", "id": "...", "create": true},
  "targetFolderExists": true,
  "savedAt": 1739900000000
}
```
Key: `nisim_saved_location`

### Restoring (on app load)
If a valid, non-expired saved location exists:
1. Show a "continue" card at the top with the saved path
2. Below it, a "בחר תיקיה אחרת" link
3. No project list loads until inspector chooses
4. Tapping "continue" restores breadcrumbs + target state and fetches the saved folder to verify it still exists
5. Tapping "choose different" dismisses the card and loads the normal project list

### Expiry
10 hours from save time. Expired entries are silently cleared on load.

## Files Changed
- **js/app.js**: `saveLocation()` / `loadSavedLocation()` functions, modify `loadRoot()` to check saved state, add save calls in `showTargetFolder()`
- **index.html**: Add `saved-location` card section (hidden by default)
- **css/style.css**: Style the saved location card
