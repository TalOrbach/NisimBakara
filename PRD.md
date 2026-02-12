# Product Requirements Document
## SharePoint Photo Upload Tool for Construction Inspectors

### Problem Statement
Construction site inspectors need to upload photos from inspections to the correct project/location folder in SharePoint. Currently there's no streamlined mobile-friendly way to do this, leading to misfiled photos or manual sorting.

### Solution
A simple web-based form that allows inspectors to:
1. Select a project and location from dropdowns
2. Take or upload photos
3. Name each photo
4. Submit directly to the correct SharePoint folder

### Users
Construction site inspectors using mobile devices (mix of iPhone and Android)

---

## Functional Requirements

### FR1: Project/Location Selection
- Display projects in a searchable dropdown
- After selecting a project, display its locations in a second dropdown
- Selections persist for 10 hours (stored in browser LocalStorage)
- User can change selection at any time

### FR2: Photo Capture & Upload
- Support camera capture directly from the form
- Support selecting existing photos from device
- Support multiple photos in a single submission
- Each photo requires a name/description (free text)

### FR3: Session Persistence
- Remember selected project and location for 10 hours
- On return visit within 10 hours, pre-populate the dropdowns
- Clear persistence after 10 hours or if user manually changes selection

### FR4: Folder List Refresh
- "Refresh Projects" button to manually update the folder list
- Automatic scheduled refresh (daily or hourly)
- Handle case where selected project/location no longer exists after refresh

### FR5: Upload to SharePoint
- Photos uploaded to: `/{Project}/{Location}/{filename}`
- Filename based on user-provided name
- Handle duplicates (append number or timestamp)
- Show upload progress and success/failure status

---

## Non-Functional Requirements

### NFR1: Cross-Platform Compatibility
- Works on iOS Safari
- Works on Android Chrome
- Responsive design optimized for mobile

### NFR2: Performance
- Form loads in under 2 seconds
- Folder list loads in under 1 second
- Photo upload provides progress feedback

### NFR3: Offline Handling
- Gracefully handle loss of connectivity
- Show clear error messages
- Do not lose entered data on transient failures

---

## Technical Architecture

### Components

#### 1. Web Form (Static Site)
- **Host:** Vercel or Netlify
- **Tech:** HTML/CSS/JavaScript (vanilla or lightweight framework)
- **Key features:**
  - Fetches folder list from serverless function
  - Submits photos to Make.com webhook
  - LocalStorage for session persistence

#### 2. Serverless Function
- **Host:** Same as web form (Vercel/Netlify)
- **Purpose:** Read folder structure JSON from environment variable
- **Endpoint:** `GET /api/folders`
- **Optional:** Token authentication if list is confidential

#### 3. Make.com Scenarios

**Scenario A: Photo Upload**
- Trigger: Webhook
- Input: Photo file(s), project name, location name, photo name(s)
- Action: Upload to SharePoint via Microsoft 365 SharePoint module
- Output: Success/failure response

**Scenario B: Folder Sync**
- Trigger: Scheduled (hourly/daily) OR Webhook (manual refresh)
- Action:
  1. HTTP request to Microsoft Graph API to list folders
  2. Build JSON structure of projects → locations
  3. Update Vercel/Netlify environment variable via their API
- Output: Updated folder structure

### Data Flow

```
[Inspector opens form]
        │
        ▼
[Form calls /api/folders]
        │
        ▼
[Serverless fn reads env var, returns JSON]
        │
        ▼
[Inspector selects project/location, takes photos, names them]
        │
        ▼
[Form submits to Make.com webhook]
        │
        ▼
[Make.com uploads to SharePoint]
        │
        ▼
[Success/failure shown to inspector]
```

---

## Open Items

| Item | Status | Notes |
|------|--------|-------|
| Confidentiality of folder list | Waiting on client | Affects whether serverless function needs auth |
| Size of folder structure | To be tested | Must fit in env variable (4-8KB limit) |
| Exact SharePoint folder path | To be confirmed | Root path for project folders |
| Make.com plan limits | Confirmed paid | No operation limits concern |

---

## Future Considerations (Out of Scope for V1)
- View existing photos in folders
- Delete/rename uploaded photos
- Offline queue for uploads when no connectivity
- Push notifications for upload status
- Admin interface for managing projects/locations
