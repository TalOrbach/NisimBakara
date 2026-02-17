# Phase 2 & 3: Folder Creation + Photo Upload

## Summary

Add folder creation and photo upload to the existing folder navigation web form. Inspectors navigate to a target folder, add photos with custom names, and upload everything in one action. Visit folders + תמונות subfolders are auto-created when needed.

## User Flow

1. Inspector navigates folder tree (existing Phase 1)
2. Target folder detected (green box) → upload section appears below it
3. Inspector adds photos (camera or gallery), types a custom name for each
4. Hits "Upload" → app:
   - Creates visit folder if needed (POST to create-folder webhook)
   - Creates תמונות subfolder if needed (another POST)
   - Uploads all photos sequentially (one per request to upload webhook)
5. Progress shown per photo, final success/error summary

## Upload Mechanism

- One file per webhook call to existing scenario 4509913
- Sequential uploads (not parallel) to avoid overwhelming Make.com
- Each call: `fetch` with `FormData` containing binary file + JSON metadata (`folderId`, `fileName`)
- File name = user-typed custom name + original file extension
- 3 Make.com operations per photo (webhook + API call + response)

## UI Changes

### Upload Section (below target folder green box)
- "Add Photos" button → file picker (`accept="image/*"`, `multiple`, `capture="environment"`)
- Photo list: each shows thumbnail, editable name input, remove button
- "Upload All" button — disabled until at least 1 photo added
- Progress indicator during upload: "Uploading 2/5..." with per-file status

### Create Visit Button
- Now actually calls create-folder webhook (scenario 4509894)
- Auto-creates תמונות subfolder inside new visit folder
- Sets תמונות as target folder and shows upload area

## Folder Creation Flow (when needed)

1. POST `{"parentId": "<currentFolderId>", "folderName": "ביקור N DD-MM-YYYY"}` → returns new folder ID
2. POST `{"parentId": "<newVisitFolderId>", "folderName": "תמונות"}` → returns תמונות folder ID
3. Use תמונות folder ID as upload target

## Error Handling

- Folder creation fails → show error, don't proceed to upload
- Individual photo upload fails → mark red, continue with remaining photos
- End summary: "4/5 uploaded successfully, 1 failed" with retry option for failed ones

## What's NOT Included

- No LocalStorage persistence (Phase 4)
- No client-side photo compression/resize
- No drag-and-drop (mobile-first)

## Existing Make.com Scenarios (no changes needed)

- **Create folder**: Scenario 4509894, webhook `https://hook.eu1.make.com/ryl1lrkm2tb9re6kgbdh1frud3ityhqy`
- **Upload file**: Scenario 4509913, webhook `https://hook.eu1.make.com/a9rz1tlo9t4q6ki8nlrx1qpr4teafimb`

## Files Modified

- `index.html` — add upload section HTML
- `js/app.js` — add folder creation, photo management, upload logic
- `css/style.css` — add upload section styles
