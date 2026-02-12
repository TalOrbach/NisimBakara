# SharePoint Folder Structure Extraction - Work Log

## Goal
Extract the entire folder structure (projects > locations) from SharePoint site `bakara10.sharepoint.com/sites/minhala` to use in the web form's cascading dropdowns.

## Environment
- **Make.com org:** "אפיון מכון ובקרה - שוקר" on eu1.make.com (team 569545, org 5869450)
- **Existing SharePoint connection:** "My Microsoft connection (...)" - works, has delegated permissions
- **Scenario used for testing:** ID `4433840` ("Integration Microsoft SharePoint Online" > "Make an API Call")
- **No direct Azure/Entra access** - can't create or modify app registrations

---

## What Was Tried

### 1. Make.com SharePoint "Make an API Call" module
The module sends requests to `https://graph.microsoft.com` + the URL you provide.

| URL | Result |
|-----|--------|
| `/v1.0/sites/root` | **200 OK** - Graph API works, auth is valid |
| `/v1.0/sites?search=minhala` | **200 OK** - Site found (couldn't read response body) |
| `/v1.0/sites/bakara10.sharepoint.com:/sites/minhala:/drive/root/children` | **400 "Url specified is invalid"** - Colons break it |
| (not yet tested) `/v1.0/sites/bakara10.sharepoint.com%3A/sites/minhala%3A/drive/root/children` | URL-encoded colons - was about to test |

### 2. Reading execution output from Make.com
- **UI expansion:** Clicking "Body" in the output panel didn't expand the response data reliably
- **Make.com API (`/api/v2/scenarios/.../logs`):** Failed with CSRF token validation error
- **Conclusion:** Need to use the Make.com UI to read output, or find another way

### 3. Direct API access (not viable)
- App registration "Make App" (`1bdc68b4-ec20-45b8-a16a-8b579b4724b8`) exists but has no Graph API application permissions
- No access to Azure Entra to add permissions
- Client IT would need to grant `Sites.Read.All` for direct server-to-server access

---

## Workplan (Next Session)

### Approach A: Fix the URL format in Make.com (most promising)
1. **Try URL-encoded colons:** `/v1.0/sites/bakara10.sharepoint.com%3A/sites/minhala%3A/drive/root/children`
2. **If that fails, get site ID first:**
   - Run `/v1.0/sites?search=minhala`
   - Read the response body (try expanding in UI, or use the download button at top-right of execution results)
   - Extract the `id` field (format: `tenantId,siteId,webId`)
   - Use it as `/v1.0/sites/{siteId}/drive/root/children` (no colons needed)
3. **Once root children work, get full recursive tree:**
   - Option 1: `/v1.0/sites/{siteId}/drive/root/delta` - returns ALL items with paths in one call
   - Option 2: `/v1.0/sites/{siteId}/drive/root/search(q='*')` with `$filter=folder ne null`
   - Option 3: Recursive iteration using Make.com's iterator module (slower, uses more credits)

### Approach B: Use Make.com HTTP module with Microsoft OAuth
If the SharePoint module keeps mangling URLs:
1. Add an **HTTP > Make a request** module instead
2. Set up OAuth 2.0 authorization using the existing connection's credentials
3. Full URL: `https://graph.microsoft.com/v1.0/sites/bakara10.sharepoint.com:/sites/minhala:/drive/root/children`
4. This avoids any URL processing by the SharePoint module

### Approach C: Use SharePoint REST API instead of Graph
1. URL format: `https://bakara10.sharepoint.com/sites/minhala/_api/web/GetFolderByServerRelativeUrl('/sites/minhala')/Folders`
2. Might work if the connection's OAuth token has SharePoint scope
3. Returns folders in SharePoint's own format (not Graph)

### After getting the folder structure:
1. Parse the JSON response into a clean project > location tree
2. Store as JSON in Vercel/Netlify env variable (check size limits: Vercel 4KB, Netlify 8KB)
3. Set up a Make.com webhook scenario for the "Refresh Projects" button
4. Set up scheduled sync (daily/hourly) to keep the folder list updated

---

## Tips for Next Session (Browser Automation)
- Use **JavaScript `document.execCommand`** to edit Make.com's contenteditable URL fields (regular typing/form_input doesn't work reliably)
- The **Escape** key closes Make.com's result/edit dialogs
- The **download icon** (top-right of execution results panel) might be useful for getting raw output data
- Make.com uses **CSRF tokens** for its internal API - `fetch()` calls from browser console won't work without them
