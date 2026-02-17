# Phase 2 & 3: Folder Creation + Photo Upload — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add working folder creation and photo upload to the existing SharePoint folder navigation web form.

**Architecture:** Extend the existing vanilla HTML/CSS/JS app. Add upload UI below the target-folder indicator. Wire "Create Visit" button to Make.com create-folder webhook. Upload photos one-at-a-time to Make.com upload webhook. All three files modified in-place (index.html, app.js, style.css).

**Tech Stack:** Vanilla JS (ES5, IIFE pattern matching existing code), CSS, HTML. No build step. Make.com webhooks for backend.

**Design doc:** `docs/plans/2026-02-17-phase2-3-upload-design.md`

---

### Task 1: Add upload section HTML

**Files:**
- Modify: `index.html:60-77` (after folder-list, replace/extend target-folder and create-visit sections)

**Step 1: Add upload section HTML after the target-folder div**

Add between the `target-folder` div (line 65) and the `create-visit` div (line 68):

```html
<!-- Photo upload section -->
<div id="upload-section" class="upload-section" hidden>
    <div class="upload-section__header">
        <h2 class="upload-section__title">העלאת תמונות</h2>
        <label class="btn btn--secondary btn--add-photos">
            + הוספת תמונות
            <input type="file" id="photo-input" accept="image/*" multiple capture="environment" hidden>
        </label>
    </div>
    <ul id="photo-list" class="photo-list"></ul>
    <button id="upload-btn" class="btn btn--primary btn--upload" type="button" disabled>
        העלאה
    </button>
    <div id="upload-progress" class="upload-progress" hidden>
        <div class="upload-progress__bar">
            <div id="progress-fill" class="upload-progress__fill"></div>
        </div>
        <p id="progress-text" class="upload-progress__text"></p>
    </div>
    <div id="upload-result" class="upload-result" hidden>
        <p id="result-text" class="upload-result__text"></p>
        <button id="result-close-btn" class="btn btn--secondary" type="button">סגור</button>
    </div>
</div>
```

**Step 2: Update the create-visit section**

Replace the existing `create-visit` div (lines 68-77). Change the hint text and add a confirm button:

```html
<!-- Create new visit -->
<div id="create-visit" class="create-visit" hidden>
    <button id="create-visit-btn" class="btn btn--secondary" type="button">
        + יצירת ביקור חדש
    </button>
    <div id="visit-form" class="create-visit__form" hidden>
        <label for="visit-name" class="create-visit__label">שם התיקיה שתיווצר:</label>
        <input type="text" id="visit-name" class="create-visit__input" dir="rtl">
        <button id="confirm-visit-btn" class="btn btn--primary" type="button">צור תיקיה</button>
        <div id="visit-creating" class="create-visit__creating" hidden>
            <div class="loading__spinner loading__spinner--small"></div>
            <span>יוצר תיקיה...</span>
        </div>
        <p id="visit-error" class="create-visit__error" hidden></p>
    </div>
</div>
```

**Step 3: Verify in browser**

Open `index.html` locally, navigate to a visit folder with a תמונות subfolder. The upload section should appear (hidden by default — wiring comes in Task 3). The create-visit form should show the new confirm button.

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add upload section and create-visit confirm button HTML"
```

---

### Task 2: Add upload section CSS

**Files:**
- Modify: `css/style.css` (append new sections)

**Step 1: Add upload section styles**

Append to `css/style.css`, before the `/* Responsive */` media query:

```css
/* ============================================
   Upload Section
   ============================================ */
.upload-section {
    margin-top: 1.25rem;
    background: var(--card);
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    padding: 1.25rem;
}

.upload-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.upload-section__title {
    font-size: 1rem;
    font-weight: 700;
}

.btn--add-photos {
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    width: auto;
    cursor: pointer;
}

.btn--upload {
    width: 100%;
    margin-top: 1rem;
    padding: 1rem;
    font-size: 1.125rem;
}

.btn--upload:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* ============================================
   Photo List
   ============================================ */
.photo-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.photo-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--bg);
    border-radius: 8px;
    animation: slideDown 0.2s ease;
}

.photo-item--error {
    border: 2px solid #dc2626;
    background: #fef2f2;
}

.photo-item--success {
    border: 2px solid var(--success);
    background: var(--success-light);
}

.photo-item__thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
}

.photo-item__name {
    flex: 1;
    min-width: 0;
    padding: 0.5rem;
    border: 1.5px solid var(--border);
    border-radius: 6px;
    font-size: 0.875rem;
    background: var(--card);
    color: var(--text);
    outline: none;
}

.photo-item__name:focus {
    border-color: var(--primary);
}

.photo-item__remove {
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    color: #dc2626;
    font-size: 1.25rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
}

.photo-item__remove:active {
    background: #fef2f2;
}

.photo-item__status {
    font-size: 0.75rem;
    flex-shrink: 0;
    min-width: 20px;
    text-align: center;
}

/* ============================================
   Upload Progress
   ============================================ */
.upload-progress {
    margin-top: 1rem;
}

.upload-progress__bar {
    height: 8px;
    background: var(--border);
    border-radius: 4px;
    overflow: hidden;
}

.upload-progress__fill {
    height: 100%;
    background: var(--primary);
    border-radius: 4px;
    transition: width 0.3s ease;
    width: 0%;
}

.upload-progress__text {
    margin-top: 0.5rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    text-align: center;
}

/* ============================================
   Upload Result
   ============================================ */
.upload-result {
    margin-top: 1rem;
    text-align: center;
}

.upload-result__text {
    font-size: 0.9375rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
}

.upload-result__text--success {
    color: var(--success);
}

.upload-result__text--partial {
    color: var(--amber);
}

.upload-result__text--error {
    color: #dc2626;
}

/* ============================================
   Create Visit (additions)
   ============================================ */
.create-visit__creating {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.75rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.loading__spinner--small {
    width: 20px;
    height: 20px;
    border-width: 2px;
}

.create-visit__error {
    margin-top: 0.75rem;
    color: #dc2626;
    font-size: 0.875rem;
}

.create-visit .btn--primary {
    width: 100%;
    margin-top: 0.75rem;
}
```

**Step 2: Verify in browser**

Temporarily remove `hidden` from the upload section in HTML to visually check layout. Restore `hidden` after.

**Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: add upload section and photo list CSS"
```

---

### Task 3: Wire up upload section visibility and photo management (app.js)

**Files:**
- Modify: `js/app.js`

**Step 1: Add webhook URLs and state properties**

In the Constants section (after line 8), add:

```javascript
var CREATE_FOLDER_WEBHOOK = 'https://hook.eu1.make.com/ryl1lrkm2tb9re6kgbdh1frud3ityhqy';
var UPLOAD_WEBHOOK = 'https://hook.eu1.make.com/a9rz1tlo9t4q6ki8nlrx1qpr4teafimb';
```

In the state object (after `searchQuery`), add:

```javascript
photos: [],           // [{file, name, status}] — status: pending|uploading|done|error
uploading: false,
uploadTargetId: null, // driveItemId of the folder to upload into
```

**Step 2: Add DOM references**

In the `dom` object, add:

```javascript
uploadSection: document.getElementById('upload-section'),
photoInput: document.getElementById('photo-input'),
photoList: document.getElementById('photo-list'),
uploadBtn: document.getElementById('upload-btn'),
uploadProgress: document.getElementById('upload-progress'),
progressFill: document.getElementById('progress-fill'),
progressText: document.getElementById('progress-text'),
uploadResult: document.getElementById('upload-result'),
resultText: document.getElementById('result-text'),
resultCloseBtn: document.getElementById('result-close-btn'),
confirmVisitBtn: document.getElementById('confirm-visit-btn'),
visitCreating: document.getElementById('visit-creating'),
visitError: document.getElementById('visit-error'),
```

**Step 3: Add photo management functions**

Add a new section after the "Create Visit Name" section:

```javascript
// ============================================
// Photo Management
// ============================================
function addPhotos(files) {
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var ext = file.name.substring(file.name.lastIndexOf('.'));
        state.photos.push({
            file: file,
            name: 'תמונה ' + (state.photos.length + 1),
            ext: ext,
            status: 'pending',
            thumbUrl: URL.createObjectURL(file),
        });
    }
    renderPhotos();
    updateUploadBtn();
}

function removePhoto(index) {
    URL.revokeObjectURL(state.photos[index].thumbUrl);
    state.photos.splice(index, 1);
    // Renumber default names
    state.photos.forEach(function (p, i) {
        if (/^תמונה \d+$/.test(p.name)) {
            p.name = 'תמונה ' + (i + 1);
        }
    });
    renderPhotos();
    updateUploadBtn();
}

function renderPhotos() {
    dom.photoList.innerHTML = '';
    state.photos.forEach(function (photo, index) {
        var li = document.createElement('li');
        li.className = 'photo-item';
        if (photo.status === 'error') li.className += ' photo-item--error';
        if (photo.status === 'done') li.className += ' photo-item--success';

        var thumb = document.createElement('img');
        thumb.className = 'photo-item__thumb';
        thumb.src = photo.thumbUrl;
        thumb.alt = '';

        var nameInput = document.createElement('input');
        nameInput.className = 'photo-item__name';
        nameInput.type = 'text';
        nameInput.value = photo.name;
        nameInput.dir = 'rtl';
        nameInput.disabled = state.uploading;
        (function (idx) {
            nameInput.addEventListener('input', function () {
                state.photos[idx].name = nameInput.value;
            });
        })(index);

        li.appendChild(thumb);
        li.appendChild(nameInput);

        if (state.uploading) {
            var status = document.createElement('span');
            status.className = 'photo-item__status';
            if (photo.status === 'done') status.textContent = '\u2705';
            else if (photo.status === 'error') status.textContent = '\u274C';
            else if (photo.status === 'uploading') status.textContent = '\u23F3';
            li.appendChild(status);
        } else {
            var removeBtn = document.createElement('button');
            removeBtn.className = 'photo-item__remove';
            removeBtn.type = 'button';
            removeBtn.textContent = '\u00D7';
            removeBtn.title = 'הסר';
            (function (idx) {
                removeBtn.addEventListener('click', function () { removePhoto(idx); });
            })(index);
            li.appendChild(removeBtn);
        }

        dom.photoList.appendChild(li);
    });
}

function updateUploadBtn() {
    var hasPhotos = state.photos.length > 0;
    var allNamed = state.photos.every(function (p) { return p.name.trim() !== ''; });
    dom.uploadBtn.disabled = !hasPhotos || !allNamed || state.uploading;
    dom.uploadBtn.textContent = hasPhotos
        ? 'העלאה (' + state.photos.length + ' תמונות)'
        : 'העלאה';
}
```

**Step 4: Show/hide upload section based on target folder**

Modify `showTargetFolder()` — after the existing logic that shows the green box, add at the end:

```javascript
// Show upload section when we have a target
if (state.targetFolder) {
    dom.uploadSection.hidden = false;
    state.uploadTargetId = state.targetFolderExists
        ? state.targetFolder.id
        : null; // will be set after folder creation
} else {
    dom.uploadSection.hidden = true;
}
```

Also, in `fetchAndDisplay` where it resets UI (around line 115), add:

```javascript
dom.uploadSection.hidden = true;
state.photos = [];
state.uploading = false;
state.uploadTargetId = null;
```

**Step 5: Add photo input and button event handlers**

In the Event Handlers section:

```javascript
dom.photoInput.addEventListener('change', function () {
    if (dom.photoInput.files.length > 0) {
        addPhotos(dom.photoInput.files);
    }
    dom.photoInput.value = ''; // allow re-selecting same files
});

dom.resultCloseBtn.addEventListener('click', function () {
    dom.uploadResult.hidden = true;
});
```

**Step 6: Verify in browser**

Navigate to a folder with תמונות detected. The upload section should appear. Adding photos via file picker should show thumbnails with name inputs. Removing should work. Upload button should show count.

**Step 7: Commit**

```bash
git add js/app.js
git commit -m "feat: add photo management UI — add, name, remove photos"
```

---

### Task 4: Implement folder creation (Create Visit button)

**Files:**
- Modify: `js/app.js`

**Step 1: Add createFolder API function**

In the API section:

```javascript
function createFolder(parentId, folderName) {
    return fetch(CREATE_FOLDER_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: parentId, folderName: folderName }),
    })
        .then(function (response) {
            if (!response.ok) {
                throw new Error('שגיאה ביצירת תיקיה: ' + response.status);
            }
            return response.json();
        });
}
```

**Step 2: Wire up the confirm-visit button**

Replace the existing `createVisitBtn` click handler with:

```javascript
dom.createVisitBtn.addEventListener('click', function () {
    var name = generateVisitName();
    dom.visitName.value = name;
    dom.visitForm.hidden = false;
    dom.visitError.hidden = true;
});

dom.confirmVisitBtn.addEventListener('click', function () {
    var visitName = dom.visitName.value.trim();
    if (!visitName) return;

    var parentId = state.breadcrumbs[state.breadcrumbs.length - 1].id;

    dom.confirmVisitBtn.hidden = true;
    dom.visitCreating.hidden = false;
    dom.visitError.hidden = true;
    dom.visitName.disabled = true;

    // Step 1: Create visit folder
    createFolder(parentId, visitName)
        .then(function (visitFolder) {
            // Step 2: Create תמונות inside it
            return createFolder(visitFolder.id, 'תמונות')
                .then(function (photosFolder) {
                    return { visitFolder: visitFolder, photosFolder: photosFolder };
                });
        })
        .then(function (result) {
            // Success: update breadcrumbs and set target
            state.breadcrumbs.push({ name: result.visitFolder.name, id: result.visitFolder.id });
            state.breadcrumbs.push({ name: 'תמונות', id: result.photosFolder.id });
            state.targetFolder = result.photosFolder;
            state.targetFolderExists = true;
            state.uploadTargetId = result.photosFolder.id;

            // Update UI
            renderBreadcrumbs();
            dom.createVisit.hidden = true;
            dom.folderList.innerHTML = '';
            dom.empty.hidden = true;
            showTargetFolder();
        })
        .catch(function (err) {
            dom.visitError.textContent = err.message || 'שגיאה ביצירת תיקיה';
            dom.visitError.hidden = false;
        })
        .then(function () {
            // Always reset form state
            dom.confirmVisitBtn.hidden = false;
            dom.visitCreating.hidden = true;
            dom.visitName.disabled = false;
        });
});
```

**Step 3: Verify in browser**

Navigate to a project's דוחות folder. Click "Create Visit". Type a name. Click "Create Folder". Should call webhook, create visit + תמונות, update breadcrumbs, and show upload section.

**Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: wire create-visit button to Make.com folder creation webhook"
```

---

### Task 5: Implement photo upload

**Files:**
- Modify: `js/app.js`

**Step 1: Add uploadFile API function**

In the API section:

```javascript
function uploadFile(folderId, fileName, file) {
    var formData = new FormData();
    formData.append('folderId', folderId);
    formData.append('fileName', fileName);
    formData.append('file', file, fileName);

    return fetch(UPLOAD_WEBHOOK, {
        method: 'POST',
        body: formData,
    })
        .then(function (response) {
            if (!response.ok) {
                throw new Error('שגיאה בהעלאת קובץ: ' + response.status);
            }
            return response.json();
        });
}
```

**Step 2: Add the upload orchestration function**

```javascript
// ============================================
// Upload
// ============================================
function startUpload() {
    var targetId = state.uploadTargetId;
    if (!targetId || state.photos.length === 0) return;

    state.uploading = true;
    dom.uploadBtn.disabled = true;
    dom.uploadProgress.hidden = false;
    dom.uploadResult.hidden = true;
    dom.progressFill.style.width = '0%';

    var total = state.photos.length;
    var done = 0;
    var failed = 0;

    function uploadNext(index) {
        if (index >= total) {
            // All done
            state.uploading = false;
            dom.uploadProgress.hidden = true;
            showUploadResult(done, failed, total);
            renderPhotos();
            updateUploadBtn();
            return;
        }

        var photo = state.photos[index];
        photo.status = 'uploading';
        renderPhotos();
        dom.progressText.textContent = 'מעלה ' + (index + 1) + ' מתוך ' + total + '...';
        dom.progressFill.style.width = ((index + 1) / total * 100) + '%';

        var fileName = photo.name.trim() + photo.ext;
        uploadFile(targetId, fileName, photo.file)
            .then(function () {
                photo.status = 'done';
                done++;
            })
            .catch(function () {
                photo.status = 'error';
                failed++;
            })
            .then(function () {
                uploadNext(index + 1);
            });
    }

    uploadNext(0);
}

function showUploadResult(done, failed, total) {
    dom.uploadResult.hidden = false;
    if (failed === 0) {
        dom.resultText.textContent = 'כל ' + total + ' התמונות הועלו בהצלחה!';
        dom.resultText.className = 'upload-result__text upload-result__text--success';
    } else if (done === 0) {
        dom.resultText.textContent = 'ההעלאה נכשלה. נסה שוב.';
        dom.resultText.className = 'upload-result__text upload-result__text--error';
    } else {
        dom.resultText.textContent = done + ' מתוך ' + total + ' הועלו. ' + failed + ' נכשלו.';
        dom.resultText.className = 'upload-result__text upload-result__text--partial';
    }
}
```

**Step 3: Wire upload button**

In event handlers:

```javascript
dom.uploadBtn.addEventListener('click', function () {
    startUpload();
});
```

**Step 4: Handle target folder creation during upload**

Modify `startUpload` — if `state.uploadTargetId` is null but `state.targetFolder` exists with `create: true`, create תמונות first:

At the top of `startUpload`, replace the simple guard with:

```javascript
function startUpload() {
    if (state.photos.length === 0) return;

    state.uploading = true;
    dom.uploadBtn.disabled = true;
    dom.uploadProgress.hidden = false;
    dom.uploadResult.hidden = true;
    dom.progressFill.style.width = '0%';
    dom.progressText.textContent = 'מכין העלאה...';
    renderPhotos();

    var prepareTarget;
    if (state.uploadTargetId) {
        prepareTarget = Promise.resolve(state.uploadTargetId);
    } else if (state.targetFolder && state.targetFolder.create) {
        // Need to create תמונות folder first
        dom.progressText.textContent = 'יוצר תיקיית תמונות...';
        prepareTarget = createFolder(state.targetFolder.id, 'תמונות')
            .then(function (folder) {
                state.uploadTargetId = folder.id;
                state.targetFolderExists = true;
                return folder.id;
            });
    } else {
        state.uploading = false;
        return;
    }

    prepareTarget
        .then(function (targetId) {
            // proceed with sequential uploads (same logic as above)
            var total = state.photos.length;
            var done = 0;
            var failed = 0;

            function uploadNext(index) {
                if (index >= total) {
                    state.uploading = false;
                    dom.uploadProgress.hidden = true;
                    showUploadResult(done, failed, total);
                    renderPhotos();
                    updateUploadBtn();
                    return;
                }

                var photo = state.photos[index];
                photo.status = 'uploading';
                renderPhotos();
                dom.progressText.textContent = 'מעלה ' + (index + 1) + ' מתוך ' + total + '...';
                dom.progressFill.style.width = ((index + 1) / total * 100) + '%';

                var fileName = photo.name.trim() + photo.ext;
                uploadFile(targetId, fileName, photo.file)
                    .then(function () {
                        photo.status = 'done';
                        done++;
                    })
                    .catch(function () {
                        photo.status = 'error';
                        failed++;
                    })
                    .then(function () {
                        uploadNext(index + 1);
                    });
            }

            uploadNext(0);
        })
        .catch(function (err) {
            state.uploading = false;
            dom.uploadProgress.hidden = true;
            dom.uploadResult.hidden = false;
            dom.resultText.textContent = err.message || 'שגיאה ביצירת תיקיה';
            dom.resultText.className = 'upload-result__text upload-result__text--error';
            renderPhotos();
            updateUploadBtn();
        });
}
```

Note: This replaces the simpler version from Step 2 — use this version only.

**Step 5: Verify in browser**

Navigate to a visit folder, add photos, upload. Check that:
- Progress bar advances
- Each photo shows status emoji
- Final result message appears
- Photos uploaded to correct SharePoint folder

**Step 6: Commit**

```bash
git add js/app.js
git commit -m "feat: implement photo upload with progress and error handling"
```

---

### Task 6: Deploy and verify

**Step 1: Test full flow end-to-end locally**

1. Open index.html, navigate to a project
2. Click "Create Visit" → confirm → verify folder created in SharePoint
3. Add 2-3 test photos, name them
4. Upload → verify they appear in SharePoint תמונות folder

**Step 2: Deploy to Cloudflare Pages**

```bash
npx wrangler pages deploy /Users/talorbach/Code/NisimBakara --project-name nisim-bakara
```

**Step 3: Test on production URL**

Open https://nisim-bakara.pages.dev on mobile. Full flow test.

**Step 4: Final commit with all files**

```bash
git add -A
git commit -m "feat: Phase 2 & 3 complete — folder creation and photo upload"
git push
```
