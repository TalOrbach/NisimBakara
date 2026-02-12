# SharePoint Photo Upload Tool - Project Context

## Project Overview
A mobile-friendly web form for construction site inspectors to upload photos directly to the correct SharePoint folder, organized by project and location.

## Client
"מכון בקרה ניסים שוקר" (Nisim Bakara Inspection Institute) - a construction inspection company.

## SharePoint Details
- **Host:** bakara10.sharepoint.com
- **Site:** /sites/minhala
- **Site ID (Graph API):** `bakara10.sharepoint.com,135b077f-3699-46cc-adf5-77ec3cbb0761,eea9adeb-59a7-4bc2-b412-514bc8bc8298`
- **Document Library:** Default drive (מסמכים)
- **Projects Root Folder:** `תיקים לבקרה` (391 items as of Feb 2026)
- **Structure:** UNPREDICTABLE - Not all project folders have the same internal structure. Some have locations directly, some have them in a subfolder (often "דוחות ביקור" but not always), some have no locations at all. The original assumption of Project → Location → Photos is too rigid.

## Authentication Status
**Direct API access not available.** The client's IT has not granted application-level permissions to the app registration. We must use Make.com as middleware, which already has working delegated permissions.

### Working Credentials (via Make.com only)
- Client ID: `1bdc68b4-ec20-45b8-a16a-8b579b4724b8`
- Tenant ID: `9b205b11-840a-47da-8d38-f2e5b77f4946`
- App Name: "Make App"
- Note: These credentials authenticate successfully but have no Graph API roles assigned for direct server-to-server access.

## Architecture Decision
```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Web Form      │──────│   Make.com      │──────│   SharePoint    │
│ (Vercel/Netlify)│      │   Scenarios     │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │
        ▼                        │
  Serverless fn  ◄───────────────┘
  (reads env var)      (updates env var via API)
```

## Make.com Scenarios
1. **Photo Upload** (TODO) - Webhook receives photos + metadata, uploads to correct SharePoint folder
2. **Browse SharePoint Folders** (DONE) - Scenario 4455830, ACTIVE
   - Lazy-load folder browser via webhook
   - Webhook URL: `https://hook.eu1.make.com/9jkw4vo5taer3ewajbu6t1c5tvrkgs2k`
   - Input: `{"folderId": "root"}` for top-level, `{"folderId": "<driveItemId>"}` for subfolders
   - Output: Graph API JSON with `name`, `id`, `folder` fields
   - Modules: Webhook trigger (2) → SharePoint "Make an API Call" (4) → Webhook response (6)
   - URL formula uses `if(2.folderId = "root"; ...)` to route between root path and item-by-ID path
   - Query params: `$select=name,id,folder&$top=999`

## Folder Structure Storage
**Chosen approach:** Lazy-load on demand via Make.com webhook (no storage needed)
- Web form calls webhook with folderId, gets back folder children as JSON
- No env var or KV storage required — avoids Vercel 4KB limit entirely
- Each request returns one level of the folder tree

## Web Form Requirements
- Mobile-first, works on iOS and Android browsers
- **Folder navigation: Free browsing** - Inspector should be able to navigate the folder tree freely (not just Project → Location, since structure is unpredictable)
- Photo upload with camera capture option (`<input type="file" capture="environment">`)
- Free text naming field for each photo
- Support multiple photos per submission
- LocalStorage persistence: Remember folder selection for 10 hours
- "Refresh Projects" button to manually trigger folder sync

## Open Questions
- [ ] Is the project/location list confidential? (Awaiting client response - affects whether we need token auth on the serverless function)
- [x] ~~Exact SharePoint path to the projects root folder~~ → RESOLVED: `/תיקים לבקרה` in the default drive
- [x] ~~Folder structure JSON size~~ → RESOLVED: Using lazy-load webhook, no storage needed
- [x] ~~How to handle free folder browsing~~ → RESOLVED: Lazy-load subfolders on demand via Make.com webhook (scenario 4455830)

## Make.com Progress (as of Feb 2026)
- **Org:** 569545 on eu1.make.com
- **Connection:** "My Microsoft connection" — working, authenticated via delegated permissions
- **Scenario 4433840** (original testing scenario):
  - Working API calls: sites search, drive root children, project folder listing
- **Scenario 4455830** ("Browse SharePoint Folders") — ACTIVE:
  - Webhook: `https://hook.eu1.make.com/9jkw4vo5taer3ewajbu6t1c5tvrkgs2k`
  - Tested successfully: root folder listing returns all 391 project folders with `name`, `id`, `folder.childCount`
  - Subfolder browsing also tested and working
  - Activated with "Immediately" scheduling

## Graph API URL Patterns (for reference)
```
# Site by hostname
/v1.0/sites/bakara10.sharepoint.com:/sites/minhala:

# Site by ID (preferred, no colon encoding issues)
/v1.0/sites/bakara10.sharepoint.com,135b077f-3699-46cc-adf5-77ec3cbb0761,eea9adeb-59a7-4bc2-b412-514bc8bc8298

# Drive root children
{site}/drive/root/children

# Subfolder by path
{site}/drive/root:/תיקים לבקרה:/children

# With field selection (tested and working via scenario 4455830)
{site}/drive/root:/תיקים לבקרה:/children?$select=name,id,folder&$top=999

# Subfolder by ID (tested and working)
{site}/drive/items/{driveItemId}/children?$select=name,id,folder&$top=999
```

## Files in This Directory
- `SHAREPOINT CREDS.jpeg` - Screenshot of credentials (for reference)
- `SCRNSHOT.jpeg` - Screenshot of SharePoint site showing folder structure
