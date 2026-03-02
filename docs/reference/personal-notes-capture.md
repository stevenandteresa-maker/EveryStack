# EveryStack — Personal Notes & Universal Capture

> **⚠️ POST-MVP FEATURE.** Per GLOSSARY.md, "Personal Notes / Evernote competitor" is explicitly excluded from MVP scope. This entire specification describes post-MVP functionality. Build clean extension points in MVP (e.g., `is_personal` column on `tables`, Notes Quick Panel placeholder), but do not build the features described here until post-MVP phases.

> **Reconciliation: 2026-02-27** — Aligned with GLOSSARY.md (source of truth). Changes: (1) Added post-MVP banner — glossary MVP Scope Summary explicitly excludes "Personal Notes / Evernote competitor". (2) Fixed "board" view reference to "Kanban" per glossary Table View naming. (3) Verified all cross-references use glossary-correct terms (App Designer, Record Thread, Quick Panels, Table View). (4) Confirmed no deprecated naming (Interface Designer, Communications Hub, My Office panels) was present. No content deleted.

> **Sub-document.** Personal notebook architecture, quick capture system, web clipper, file-first notes, Evernote/ENEX import, "My Notes" sidebar section, notebook metaphor mapping, capture-to-structure pipeline.
> Cross-references: `smart-docs.md` (wiki table_type, wiki_table_config, Smart Doc content field, TipTap Editor Env 2, TipTap JSONB schema, rendering pipelines), `my-office.md` (My Office widget grid, personal tasks via `user_tasks`, personal events via `user_events`, right panel tab architecture), `command-bar.md` (slash commands, `/todo`, `/event`, command registry, AI interaction model), `tables-and-views.md` (table_type presets, Table View types, Quick Entry), `mobile.md` (camera capture, voice input, scan-to-record, bulk photo capture, offline architecture), `document-intelligence.md` (file content extraction, OCR, vision analysis, extracted_text, ai_description, ai_tags), `vector-embeddings.md` (embedding pipeline, hybrid search, RRF), `gaps/knowledge-base-live-chat-ai.md` (wiki content chunking, knowledge_embeddings — same pattern reused for personal note search), `permissions.md` (role-based access, personal-scope entities), `files.md` (upload pipeline, storage client, context_types), `data-model.md` (tables, records, canonical_data JSONB), `app-designer.md` (App Designer rendering, block model)
> Last updated: 2026-02-27 — Reconciled with GLOSSARY.md. Marked as post-MVP. Fixed naming drift.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Design Philosophy | 33–46 | Evernote competitor positioning, capture-first approach |
| 1. My Notes — Personal Notebook System | 47–185 | TipTap-based notes, workspace-scoped personal tables, note types |
| 2. Quick Capture System | 186–265 | Rapid capture UI, inbox model, triage workflow |
| 3. Web Clipper | 266–457 | Browser extension, content extraction, page archiving |
| 4. File-First Notes ("Save Anything") | 458–581 | File capture, drag-and-drop, auto-extraction |
| 5. Evernote Import (ENEX Parser) | 582–705 | ENEX file parsing, content migration, tag mapping |
| 6. Note Triage & Organization | 706–758 | Inbox → organized flow, tagging, notebook assignment |
| 7. Search Across Notes | 759–800 | Full-text + embedding search, filters, saved searches |
| 8. Cross-Reference Updates Required | 801–821 | Docs that need updating when this ships |
| 9. Phase Implementation | 822–851 | Delivery timeline and dependencies |
| 10. Competitive Positioning | 852–875 | Feature comparison vs Evernote, Notion, Apple Notes |

---

## Design Philosophy

EveryStack's structured data model — where every note is a record with typed fields, cross-links, automations, and views — is fundamentally more powerful than Evernote's flat note-blob model. But Evernote's daily-use grip comes from **frictionless capture**: think of something, dump it somewhere, organize later. EveryStack's wiki model assumes you know which table and parent page a note belongs to before you create it.

This spec bridges the gap: **capture like Evernote, organize like EveryStack.**

Three principles:

1. **Zero-friction capture.** Creating a note should be faster than opening a new browser tab. No table picker, no parent selector, no field configuration. Just start typing.
2. **Structure is earned, not imposed.** Notes land in a personal inbox. The user triages when they want to — moving notes into team wikis, linking to projects, tagging for retrieval. The system nudges but never blocks.
3. **Notes are records.** Every personal note is a wiki record under the hood. It inherits the full EveryStack capability set: search, AI, cross-links, automations, doc gen, portals. The user discovers this power progressively, not on day one.

---

## 1. My Notes — Personal Notebook System

### Architecture: Personal Notebooks as Private Wiki Tables

A "notebook" is a wiki table scoped to a single user. It uses the existing `table_type = wiki` preset — same `wiki_table_config`, same Smart Doc content field, same page tree sidebar, same TipTap editor, same version history. The only difference is the permission model: the user is the sole Editor, and the table is invisible to other workspace members by default.

Every user gets one **Inbox notebook** auto-created on account setup. Additional notebooks are created on demand.

**Why wiki tables, not a new entity?** Personal notes get the full EveryStack feature set for free: embedding search, knowledge base eligibility, portal publishing, doc gen, backlinks, version history, automations. No new data model. No parallel infrastructure. The investment is in UX surface, not backend architecture.

### Data Model

No new tables. Personal notebooks use the existing `tables` schema with two additions:

```sql
-- New columns on tables
ALTER TABLE tables ADD COLUMN is_personal BOOLEAN DEFAULT false;
ALTER TABLE tables ADD COLUMN owner_user_id UUID REFERENCES users(id);

-- Index for fast personal table lookups
CREATE INDEX idx_tables_personal_owner
  ON tables (owner_user_id, is_personal)
  WHERE is_personal = true;
```

| Column | Purpose |
|--------|---------|
| `is_personal` | Flags this table as a personal notebook. Hides from workspace sidebar, workspace search, team views. |
| `owner_user_id` | The user who owns this notebook. Only this user can see/edit. NULL for team tables. |

**Permission model for personal tables:**
- Owner: full Manager-level access (create/edit/delete records, configure fields, manage views)
- All other workspace members: no access (not even Viewer). Table excluded from workspace navigation, search results, and schema descriptor for other users.
- Workspace Admins: can see that personal tables *exist* (for storage quota management) but cannot read content. Exception: legal/compliance hold (see `compliance.md` if relevant).

### Inbox Notebook

Every user has exactly one Inbox notebook per workspace. Auto-created on workspace join (or first quick capture, whichever comes first — lazy creation preferred to avoid creating tables for users who never use notes).

**Inbox notebook configuration:**

```typescript
interface InboxNotebookConfig {
  // Standard wiki_table_config fields
  title_field_id: string;
  content_field_id: string;
  parent_field_id: string;

  // Inbox-specific
  is_inbox: true;                   // Distinguishes from user-created notebooks
  auto_tag_captures: boolean;       // Default true — auto-tag by capture source
  default_sort: 'updated_at';      // Inbox always sorts most-recent-first
}
```

The Inbox is the default destination for all quick captures. It functions as a flat list by default (no page nesting required) but supports nesting for users who want to organize within the inbox.

**Inbox-specific behaviors:**
- Default view: flat list sorted by `updated_at` DESC (most recent first), not page tree
- "Triage" affordance: each note shows a subtle "Move to →" action for sending notes to other notebooks or team wikis
- Notes older than 30 days without edits get a gentle "Archive?" nudge (soft prompt, not auto-action)
- Inbox cannot be deleted or renamed. It's always "Inbox."

### User-Created Notebooks

Users create additional notebooks for topical organization: "Work Ideas," "Meeting Notes," "Reading Notes," "Personal Journal."

**Creation flow:**
- My Notes sidebar → "+" button → "New Notebook" → name it → done
- Or: Command Bar → `/notebook [name]` → creates and navigates to it
- Each notebook is a `table_type = wiki` with `is_personal = true` and `owner_user_id = $me`

**Default fields on a personal notebook (same as wiki preset, plus extras):**

| Field | Type | Purpose |
|-------|------|---------|
| Title | `text` (primary) | Note title |
| Content | `smart_doc` (wiki mode) | Rich text body — full TipTap editor |
| Parent | `self_referential` | Page nesting (optional) |
| Tags | `multi_select` | User-defined tags for categorization |
| Source | `single_select` | Auto-populated: `manual`, `web_clip`, `email`, `voice`, `file`, `import` |
| Captured At | `datetime` | When the note was created (distinct from record created_at for imports) |
| Pinned | `checkbox` | Pin to top of notebook |
| Status | `single_select` | Default options: Active, Archived. (Not Draft/Published — that's for team wikis.) |

**Why Tags as multi_select, not a separate tag entity?** Multi-select fields are already first-class in EveryStack with color coding, autocomplete, and filter support. A global tag taxonomy across notebooks comes from cross-notebook search, not a shared tag table. Keeps it simple. If power users want a tag taxonomy later, they can create a Tags table and cross-link — the building blocks exist.

### Navigation: "My Notes" Sidebar Section

My Notes surfaces as a **dedicated section in the workspace sidebar**, below the workspace bases/tables and above Settings.

```
┌─────────────────────────────┐
│ 🏢 Workspace Name      [▼] │
│                             │
│ 📊 Bases                    │
│   CRM                       │
│   Projects                  │
│   Finance                   │
│                             │
│ ─────────────────────────── │
│                             │
│ 📝 My Notes            [+] │
│   📥 Inbox          (12)   │
│   📓 Work Ideas             │
│   📓 Meeting Notes          │
│   📓 Reading List           │
│                             │
│ ─────────────────────────── │
│                             │
│ ⚙️ Settings                 │
└─────────────────────────────┘
```

**Sidebar behaviors:**
- "My Notes" section is collapsible (default: expanded)
- Inbox always first, with unread/untriaged count badge
- Other notebooks in alphabetical order (user can drag to reorder)
- "+" button creates a new notebook
- Right-click notebook: rename, change icon, archive, delete (with confirmation)
- Clicking a notebook opens it in the main panel with the standard wiki two-panel layout (page tree + editor)
- The section is **per-user** — each user sees only their own notebooks. Team members never see each other's My Notes section.

**Mobile navigation:** My Notes appears as a tab in the bottom navigation bar (or in the "More" overflow if screen space is constrained). Tap → notebook list → tap notebook → page list/editor. Quick capture is accessible from any screen via the floating action overlay.

### My Notes Widget (My Office Integration)

A new platform widget for the My Office grid:

**"Notes" widget (1×1 default size):**
- Shows 5 most recent notes across all personal notebooks
- Each item: title (truncated), first line of content preview, notebook name badge, timestamp
- Quick-create bar at bottom: type a title, press Enter → creates note in Inbox
- Expand button → opens full My Notes view (all notebooks, search, triage)

Added to the My Office widget catalog under Platform Widgets. Not in the default layout — users who want notes prominently opt in. Quick capture from Command Bar and keyboard shortcuts covers the "I need to jot something down" use case without requiring the widget.

---

## 2. Quick Capture System

### The Capture Paradigm

Quick Capture is the zero-friction entry point. It creates a note in the user's Inbox with as little interaction as possible. Four capture modes, all producing the same output — a wiki record in the Inbox notebook:

| Mode | Trigger | Input | What's Created |
|------|---------|-------|----------------|
| **Keyboard** | `⌘+Shift+N` (global) or `/note [text]` in Command Bar | Text (title + optional body) | Note with title; if body provided, content populated |
| **Voice** | Long-press microphone icon (mobile) or `/voice-note` | Speech → transcription | Note with AI-transcribed content, title auto-generated from first sentence |
| **Photo/File** | Drag-and-drop onto capture zone, mobile camera icon, or `/clip-file` | File(s) | Note with file attached, title from filename, extracted text in content |
| **Web Clip** | Browser extension button or right-click context menu | Page content, selection, or screenshot | Note with clipped content as TipTap JSON, source URL preserved |

### Command Bar Integration

New slash commands registered in the command registry:

| Command | Syntax | Behavior |
|---------|--------|----------|
| `/note` | `/note [title]` | Create note in Inbox. If title provided, create and open. If no title, open blank note in Inbox. |
| `/note [title] > [notebook]` | `/note Meeting recap > Work Ideas` | Create note in specified notebook. Fuzzy-matches notebook name. |
| `/voice-note` | `/voice-note` | Activates voice capture → transcription → new note in Inbox. Uses same speech-to-text pipeline as `mobile.md` voice input. AI `standard` tier, 2–3 credits for transcription + title generation. |
| `/clip-file` | `/clip-file` | Opens file picker → selected file becomes a new note (see File-First Notes). |
| `/notebook` | `/notebook [name]` | Create a new personal notebook with given name. |
| `/search-notes` | `/search-notes [query]` | Full-text + semantic search across all personal notebooks. Results in Command Bar modal. |

**`⌘+Shift+N` — Global Quick Capture Shortcut:**

This is the highest-priority capture path. Pressing the shortcut from anywhere in EveryStack (or from a browser extension, if installed) opens a **capture popover** — a lightweight modal that does not navigate away from the current page.

```
┌──────────────────────────────────────────────┐
│  📝 Quick Note                    📥 Inbox ▼ │
│ ─────────────────────────────────────────────│
│  Title: _                                    │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │                                          ││
│  │  Start typing... (rich text editor)      ││
│  │                                          ││
│  │                                          ││
│  └──────────────────────────────────────────┘│
│                                              │
│  [🏷️ Tags]  [📎 Attach]  [🔗 Link Record]   │
│                                              │
│  ⏎ Save & Close    ⌘⏎ Save & Open          │
└──────────────────────────────────────────────┘
```

**Capture popover behaviors:**
- Opens instantly (no network request — creates record on save, not on open)
- Title field auto-focused. Pressing Enter with text in title moves focus to body.
- Body uses a simplified TipTap editor: bold, italic, bullet list, numbered list, checkbox, link. No slash commands, no headings, no images (those go in the full editor after save). Same restricted extension set as Smart Doc in Forms (`smart-docs.md`).
- "Inbox ▼" dropdown lets user pick a different notebook as destination. Defaults to Inbox. Remembers last-used notebook per session.
- Tags: inline multi-select with autocomplete from existing tags across all personal notebooks
- Attach: opens file picker. File uploaded to the note's record as an attachment field value.
- Link Record: searches workspace records. Creates a cross-link field value on the note, connecting it to a project, client, task, or any other record. This is the "notes are records" bridge.
- `⏎ Save & Close`: creates the record, closes the popover, user stays on current page. Subtle toast: "Note saved to Inbox ✓"
- `⌘⏎ Save & Open`: creates the record and navigates to it in the full wiki editor for continued writing.
- `Escape`: closes without saving (if content present, asks "Discard note?")

**Contextual capture:** When the user opens Quick Capture from within a record view, the "Link Record" is pre-populated with the current record. A note captured while viewing "Client: Acme Corp" automatically links to that client record. This is automatic context attachment — the user doesn't have to do anything.

### Mobile Quick Capture

On mobile, Quick Capture is triggered by:

1. **Floating action button overlay:** persistent "+" icon in bottom-right corner (above the bottom nav). Tap → capture mode picker (Note, Voice, Photo, Scan). Selecting "Note" opens a full-screen simplified editor. Selecting "Voice" starts recording immediately. Selecting "Photo" opens the camera.
2. **Share sheet (PWA/Capacitor):** "Share to EveryStack" appears in the OS share sheet. Text, URLs, images, and files shared from other apps create notes in the Inbox. Requires Capacitor wrapping for full share sheet integration; PWA receives shared URLs via Web Share Target API.
3. **Home screen shortcut:** PWA manifest shortcuts (already specified in `mobile.md` Post-MVP — Comms & Polish):
   ```json
   { "name": "Quick Note", "url": "/quick/note", "icons": [...] }
   ```
   Replaces the "New Record" shortcut with a more universally useful capture action.
4. **Notification action:** "Reply with note" on notifications — creates a note linked to the record that triggered the notification.

**Offline capture:** Notes created offline are queued in the offline action queue (`mobile.md` offline architecture). On reconnection, they're synced to the Inbox. The note is usable locally immediately — the wiki record creation is the sync event, not the authoring event.

---

## 3. Web Clipper

### Why This Matters

The web clipper is Evernote's #1 daily-use hook and acquisition channel. Users install it for one "I need to save this article" moment and then use it 5–10 times a day. It's the habit loop that makes the note-taking app sticky. EveryStack needs this.

### Browser Extension Architecture

**Manifest V3 Chrome extension** (also compatible with Firefox, Edge, Safari via polyfill). Extension ID registered on Chrome Web Store.

**Extension components:**

| Component | Purpose |
|-----------|---------|
| `popup.html/tsx` | Quick clip UI — appears when clicking the extension icon |
| `content-script.ts` | Injected into web pages for selection capture and article extraction |
| `background.ts` (service worker) | Handles auth, API calls to EveryStack backend, offline queue |
| `options.html/tsx` | Settings: default notebook, auto-tag behavior, clip format preferences |

### Clip Modes

| Mode | Trigger | What's Captured | TipTap Output |
|------|---------|-----------------|---------------|
| **Simplified Article** | Extension icon → "Clip Article" (default) | Article content extracted via Readability.js — title, author, published date, body text, inline images | Clean TipTap JSON: heading (title) + paragraphs + images. Metadata in record fields. |
| **Full Page** | Extension icon → "Clip Full Page" | Complete page HTML → sanitized and converted to TipTap JSON | Best-effort conversion. Complex layouts simplified to linear blocks. |
| **Selection** | Select text → right-click → "Clip to EveryStack" (or extension icon auto-detects selection) | Selected HTML fragment | Converted to TipTap JSON preserving formatting (bold, italic, links, lists). Quoted with source URL attribution. |
| **Screenshot** | Extension icon → "Clip Screenshot" → area selector | Visible viewport or user-selected region as PNG | Note with image attachment. OCR runs via `document-intelligence.md` pipeline for searchable text. |
| **Bookmark** | Extension icon → "Clip Bookmark" | URL + page title + meta description + OpenGraph image (if available) | Minimal note: title as heading, URL as link, description as paragraph, OG image as attachment. Lightweight — for "save for later" use cases. |

### HTML-to-TipTap Conversion Pipeline

This is the core technical challenge. Web page HTML needs to become clean TipTap JSON that renders properly in the Smart Doc editor.

**Library: Turndown (HTML → Markdown) + custom Markdown → TipTap JSON converter.**

Why the two-step approach? Direct HTML → TipTap JSON conversion is fragile because web HTML is messy (nested divs, inline styles, table layouts). Turndown is battle-tested for extracting semantic content from arbitrary HTML. The Markdown intermediate representation strips layout noise while preserving content structure. Then a custom parser converts clean Markdown into TipTap's JSON schema (which is well-defined and predictable).

```
Web HTML → Readability.js (article extraction) → Turndown (HTML → Markdown)
  → custom markdownToTipTap() → TipTap JSONB → stored in record.canonical_data
```

**`markdownToTipTap()` conversion rules:**

| Markdown Element | TipTap Node |
|-----------------|-------------|
| `# Heading` | `{ type: "heading", attrs: { level: 1 }, content: [...] }` |
| `**bold**` | `{ type: "text", marks: [{ type: "bold" }], text: "..." }` |
| `*italic*` | `{ type: "text", marks: [{ type: "italic" }], text: "..." }` |
| `[link](url)` | `{ type: "text", marks: [{ type: "link", attrs: { href: "..." } }], text: "..." }` |
| `- list item` | `{ type: "bulletList", content: [{ type: "listItem", ... }] }` |
| `1. list item` | `{ type: "orderedList", content: [{ type: "listItem", ... }] }` |
| `` `code` `` | `{ type: "text", marks: [{ type: "code" }], text: "..." }` |
| `> blockquote` | `{ type: "blockquote", content: [...] }` |
| `---` | `{ type: "horizontalRule" }` |
| `![alt](src)` | `{ type: "image", attrs: { src: "...", alt: "..." } }` |
| `- [ ] task` | `{ type: "taskList", content: [{ type: "taskItem", attrs: { checked: false }, ... }] }` |
| tables | `{ type: "table", content: [{ type: "tableRow", ... }] }` |

**Image handling on clip:**
1. Images referenced in the article are downloaded by the extension's service worker
2. Uploaded to EveryStack's file storage (R2/S3) via the standard upload pipeline
3. TipTap JSON references the EveryStack-hosted URL, not the original source
4. This prevents broken images when the source page changes or goes offline
5. Large images (>5MB) are skipped with a placeholder: "[Image too large to clip]"
6. Rate limit: max 20 images per clip to prevent abuse

**Implementation location:**

```
packages/shared/clipper/
├── readability-extract.ts    -- Wraps @mozilla/readability for article extraction
├── html-to-markdown.ts       -- Wraps turndown with custom rules
├── markdown-to-tiptap.ts     -- Custom Markdown → TipTap JSON converter
├── sanitize.ts               -- HTML sanitization (DOMPurify) before processing
├── image-collector.ts        -- Finds, downloads, and re-hosts images
└── clip-metadata.ts          -- Extracts page metadata (title, author, date, OG data)
```

The conversion pipeline lives in `packages/shared` so it can be used by both the browser extension (for preview) and the backend (for final processing and storage).

### Clip Popup UI

When the user clicks the extension icon:

```
┌──────────────────────────────────────┐
│  EveryStack Clipper                  │
│ ─────────────────────────────────────│
│                                      │
│  📄 How to Build a Better Widget    │
│  techblog.example.com · 6 min read   │
│                                      │
│ ─────────────────────────────────────│
│                                      │
│  Clip as:                            │
│  [📰 Article]  [📋 Full Page]       │
│  [✂️ Selection] [📸 Screenshot]     │
│  [🔖 Bookmark]                      │
│                                      │
│  Save to: 📥 Inbox              [▼] │
│  Tags:    [productivity] [+]        │
│  Link to: [🔍 Search records...]    │
│                                      │
│      [Cancel]        [✓ Clip]       │
└──────────────────────────────────────┘
```

**Popup behaviors:**
- Auto-detects page title and reading time
- If text is selected when popup opens, defaults to "Selection" mode with preview
- "Save to" dropdown lists user's notebooks (Inbox default, remembers last choice)
- Tags autocomplete from existing tags across all personal notebooks
- "Link to" opens a search modal that queries workspace records — connects the clipped note to a client, project, or task
- "Clip" button saves and shows confirmation toast: "Clipped to Inbox ✓ [Open]"
- Offline: clip queued locally with timestamp, synced on next connection

### Authentication

The extension authenticates with EveryStack via the existing session:

1. User logs into EveryStack in the browser → session cookie set for `*.everystack.io`
2. Extension's service worker checks for valid session via `GET /api/v1/auth/session`
3. If no session: extension popup shows "Sign in to EveryStack" with a link to the login page
4. All clip API calls include the session cookie — same auth path as the web app
5. Multi-workspace: if user belongs to multiple workspaces, the popup shows a workspace picker (remembered per session)

### Backend: Clip Ingestion Endpoint

```
POST /api/v1/notes/clip
Authorization: session cookie

{
  "mode": "article" | "full_page" | "selection" | "screenshot" | "bookmark",
  "title": "How to Build a Better Widget",
  "content_html": "<article>...</article>",          // Raw HTML (sanitized server-side)
  "content_markdown": "# How to...",                  // Turndown output (extension pre-processes)
  "source_url": "https://techblog.example.com/...",
  "source_domain": "techblog.example.com",
  "source_author": "Jane Smith",                      // Extracted from meta tags
  "source_published_at": "2026-02-20T...",            // From article metadata
  "target_notebook_id": "tbl_...",                    // Destination notebook table
  "tags": ["productivity", "engineering"],
  "linked_record_ids": ["rec_..."],                   // Optional cross-links
  "images": [                                         // Pre-uploaded image references
    { "original_url": "https://...", "file_id": "file_..." }
  ],
  "screenshot_file_id": "file_..."                    // For screenshot mode
}
```

**Backend processing:**
1. Validate session, resolve workspace and user
2. If `content_markdown` provided, run `markdownToTipTap()` server-side (don't trust client-side conversion alone)
3. If only `content_html` provided, run full pipeline: sanitize → Readability → Turndown → markdownToTipTap
4. Create wiki record in target notebook table with:
   - Title field: `title`
   - Content field: TipTap JSON from conversion
   - Source field: `web_clip`
   - Tags field: provided tags
   - Captured At: now
   - Plus: `clip_metadata` stored in record's `canonical_data` under a reserved key

```typescript
// Clip metadata stored alongside the record
interface ClipMetadata {
  source_url: string;
  source_domain: string;
  source_author?: string;
  source_published_at?: string;
  clip_mode: 'article' | 'full_page' | 'selection' | 'screenshot' | 'bookmark';
  clipped_at: string;            // ISO 8601
  original_html_hash: string;    // For dedup — warn if user clips same URL twice
}
```

5. If `linked_record_ids` provided, create cross-link field values
6. Trigger standard post-creation pipeline: search indexing, embedding generation
7. Return `{ record_id, notebook_id, url }` for the extension to show "Open" link

### Duplicate Detection

When a user clips a URL that's already been clipped:

1. Check `clip_metadata.source_url` across all personal notebooks for this user
2. If match found: popup shows "You clipped this page on [date] → [note title]. Clip again?"
3. User can: open the existing note, clip as new note anyway, or cancel
4. Implemented as a pre-flight check: `GET /api/v1/notes/clip/check?url={encoded_url}`

---

## 4. File-First Notes ("Save Anything")

### Concept

Drop a file → get a note. No forms, no field mapping, no decisions. The file becomes the note, with everything extractable made searchable.

This addresses a core Evernote behavior: users "save" PDFs, images, audio recordings, and random files into Evernote as a personal filing cabinet. The file IS the note.

### Flow

```
User drops a file onto any capture surface
  (Quick Capture popover, My Notes sidebar drop zone, mobile share sheet)
         │
         ▼
┌─────────────────────────────────────────────┐
│ 1. CREATE NOTE                              │
│    - Record created in Inbox notebook       │
│    - Title: filename (without extension)    │
│    - File attached via standard upload      │
│      pipeline (files.md)                    │
│    - Source field: "file"                   │
│    - Captured At: now                       │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ 2. EXTRACT (async, background)              │
│    - document-intelligence.md pipeline:     │
│      file.extract_metadata (EXIF, props)    │
│      file.extract_content (PDF text, etc.)  │
│    - Extracted text injected into the note's│
│      Smart Doc content field as a collapsed │
│      "Extracted Text" toggle block          │
│    - AI description stored in file metadata │
└────────────────┬────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│ 3. INDEX                                    │
│    - Record search vector updated with      │
│      filename + extracted text              │
│    - Embedding generated for semantic search│
│    - File content searchable via Command Bar│
└─────────────────────────────────────────────┘
```

**Result:** User drops `project-proposal-v3.pdf` → gets a note titled "project-proposal-v3" with the PDF attached and its full text searchable. The note is immediately findable by searching for any text inside the PDF.

### Content Injection

When file content extraction completes, the note's Smart Doc content field is updated with a structured preview:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        {
          "type": "fileAttachment",
          "attrs": {
            "fileUrl": "https://...",
            "fileName": "project-proposal-v3.pdf",
            "fileType": "application/pdf",
            "fileSize": 2457600
          }
        }
      ]
    },
    {
      "type": "toggle",
      "attrs": { "open": false },
      "content": [
        {
          "type": "heading",
          "attrs": { "level": 3 },
          "content": [{ "type": "text", "text": "Extracted Content" }]
        },
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "[First 2000 chars of extracted text...]" }
          ]
        }
      ]
    }
  ]
}
```

The extracted text lives in a Notion-style toggle block — collapsed by default so the note feels clean, expandable for reference. The user can edit the note freely above or below this block, adding their own annotations, tags, and context.

### Multi-File Notes

Dragging multiple files creates **one note per file** (not one note with multiple files). Rationale: each file likely represents a distinct item the user wants to find later. A batch of 5 receipts becomes 5 searchable notes, not one blob. The user sees a toast: "5 notes created in Inbox ✓" with an "Undo" option (deletes all 5).

**Exception:** if the user explicitly opens the Quick Capture popover first and then attaches multiple files, they're added to the same note. The distinction is intent: drag-and-drop onto a surface = "save these files"; compose a note and attach files = "this note has these attachments."

### Image Notes

Images get special treatment because they're visual:

1. Note title: filename (same as other files)
2. Content: image rendered inline (not as a download card) using the TipTap `image` node
3. AI vision analysis runs (if workspace has credits): description and tags populated in file metadata
4. AI description injected below the image as a paragraph (editable — user can refine)
5. If OCR detects text in the image: extracted text added in a toggle block (same as PDF extraction)

**Photo notes from mobile camera:** When "Photo" is selected from the Quick Capture FAB, the camera opens. After capture, the photo becomes an image note in the Inbox. If the user captures multiple photos in bulk mode, each becomes a separate note.

### Audio Notes

Voice recordings (from `/voice-note` or mobile voice capture):

1. Audio file attached to note
2. AI transcription runs (same pipeline as `mobile.md` voice input, `standard` tier, 2–3 credits)
3. Transcribed text becomes the note's content body
4. Title auto-generated from first sentence of transcription (AI, `fast` tier, 0 credits — platform UX)
5. Audio playback inline in the note via HTML5 `<audio>` element

---

## 5. Evernote Import (ENEX Parser)

### Why

Import is the migration bridge. Users won't switch note-taking apps without bringing their existing notes. Evernote exports as `.enex` (XML-based format). A working ENEX importer is a table-stakes requirement for competitive positioning.

### ENEX Format

ENEX files are XML containers holding one or more notes:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd">
<en-export export-date="20260222T120000Z" application="Evernote">
  <note>
    <title>Meeting Notes - Project Alpha</title>
    <content><![CDATA[<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">
      <en-note>
        <div>Meeting attendees: Sarah, John, Mike</div>
        <div><b>Action items:</b></div>
        <ul>
          <li>Review budget proposal</li>
          <li>Schedule follow-up</li>
        </ul>
        <en-media type="image/jpeg" hash="abc123def456..." />
      </en-note>
    ]]></content>
    <created>20260115T143000Z</created>
    <updated>20260118T091500Z</updated>
    <tag>meeting</tag>
    <tag>project-alpha</tag>
    <note-attributes>
      <source>web.clip</source>
      <source-url>https://example.com/article</source-url>
      <author>Sarah Connor</author>
      <latitude>37.7749</latitude>
      <longitude>-122.4194</longitude>
    </note-attributes>
    <resource>
      <data encoding="base64">/* base64 file data */</data>
      <mime>image/jpeg</mime>
      <resource-attributes>
        <file-name>meeting-whiteboard.jpg</file-name>
      </resource-attributes>
    </resource>
  </note>
</en-export>
```

### Import Pipeline

```
User: Settings → Import → "Import from Evernote"
  → Upload .enex file(s) (or drag-and-drop)
  → Preview: "Found 847 notes in 12 notebooks. 342 attachments (1.8 GB)."
  → Options:
    • Create one notebook per Evernote notebook? [Yes/No]
      (Yes = separate personal wiki tables; No = everything into Inbox)
    • Import tags? [Yes] → mapped to Tags multi-select field
    • Import attachments? [Yes] → uploaded to EveryStack file storage
  → [Start Import]
```

**BullMQ job: `import.evernote`**

Processing steps per note:

1. **Parse XML:** Extract title, content (ENML), created/updated timestamps, tags, attributes, resources
2. **Convert ENML → TipTap JSON:**
   - ENML is a subset of XHTML with Evernote-specific elements
   - `<en-note>` → TipTap `doc` root
   - `<div>`, `<p>` → TipTap `paragraph`
   - `<b>`, `<strong>` → TipTap `bold` mark
   - `<i>`, `<em>` → TipTap `italic` mark
   - `<u>` → TipTap `underline` mark
   - `<ul>`, `<ol>`, `<li>` → TipTap `bulletList`/`orderedList`/`listItem`
   - `<h1>`–`<h6>` → TipTap `heading`
   - `<table>` → TipTap `table`
   - `<en-todo>` → TipTap `taskItem` (with checked state)
   - `<en-media>` → matched to `<resource>` by hash → uploaded to R2/S3 → TipTap `image` or `fileAttachment` node
   - `<a href>` → TipTap `link` mark
   - `<br>` → TipTap `hardBreak`
   - `<hr>` → TipTap `horizontalRule`
   - Encrypted content (`<en-crypt>`) → preserved as a callout block: "⚠️ This section was encrypted in Evernote and could not be imported."
3. **Process resources:** Base64 decode each `<resource>` → upload to EveryStack file storage → replace `<en-media hash="...">` references with EveryStack file URLs in TipTap JSON
4. **Create wiki record:**
   - Title: `<title>` text
   - Content: converted TipTap JSON
   - Tags: `<tag>` elements → multi-select values (created if new)
   - Captured At: `<created>` timestamp
   - Source: `import`
   - `clip_metadata` if `source-url` present (preserves web clip origin)
5. **Assign to notebook:**
   - If "one notebook per Evernote notebook": create personal wiki table named after the Evernote notebook, place note there
   - If all-to-Inbox: place in user's Inbox notebook
6. **Post-processing:** Standard pipeline — search indexing, embedding generation, content extraction on attachments

**ENML conversion implementation:**

```
packages/shared/import/
├── enex-parser.ts            -- XML stream parser for .enex files
├── enml-to-tiptap.ts         -- ENML → TipTap JSON converter
├── resource-uploader.ts      -- Base64 resource → R2/S3 upload + URL mapping
├── notebook-mapper.ts        -- Groups notes by Evernote notebook for table creation
└── import-progress.ts        -- Progress tracking for large imports (SSE to client)
```

**Progress UX:** Large imports (500+ notes) run as background jobs. A progress indicator in the My Notes section shows: "Importing: 342/847 notes (41%) · 12 minutes remaining" with a cancel button. On completion: "Import complete: 847 notes imported into 12 notebooks. [View]"

**Limits:** Max 10,000 notes per import batch. Max 10 GB total attachments per import. These limits prevent abuse and keep import jobs within reasonable processing times. Users with larger archives can import in batches.

### Google Keep & Apple Notes Import (Future)

Architecture supports additional importers by adding new parsers to the `packages/shared/import/` directory:

- **Google Keep:** Google Takeout exports Keep notes as HTML files + JSON metadata. Similar pipeline: HTML → Turndown → TipTap JSON.
- **Apple Notes:** No standard export format. iCloud export as PDF is lossy. Programmatic access requires macOS-specific integrations. Lowest priority.
- **Notion:** Notion exports as Markdown + CSV. Markdown → TipTap JSON is already built for the web clipper. High-value import path.
- **Markdown files:** Direct — `markdownToTipTap()` already exists. Support drag-and-drop of `.md` files as note import.

---

## 6. Note Triage & Organization

### The Inbox Workflow

The Inbox is a staging area, not a permanent home. Notes captured quickly need a path to organization.

**Triage Bar (Inbox view only):**

When viewing the Inbox notebook, each note in the list view has an inline action bar on hover:

```
┌─────────────────────────────────────────────────────────┐
│ 📝 Meeting recap with Acme Corp                        │
│ "Discussed pricing for Q2, Sarah will follow up on..." │
│ 🏷️ meeting, acme  ·  📥 Web Clip  ·  2 hours ago      │
│                                                         │
│    [📓 Move to...]  [🔗 Link...]  [📌 Pin]  [🗑️ Archive]│
└─────────────────────────────────────────────────────────┘
```

| Action | Behavior |
|--------|----------|
| **Move to** | Dropdown: list of personal notebooks + team wiki tables the user has Manager+ access to. Moving to a team wiki converts the note from `is_personal` scope to team-visible. Confirmation prompt: "This note will become visible to your team. Continue?" |
| **Link** | Search workspace records → create cross-link. "Link to a client, project, or task." |
| **Pin** | Pins note to top of Inbox. Useful for notes that need action but don't have a home yet. |
| **Archive** | Sets status to "Archived." Note remains searchable but drops from default Inbox view. Archived view accessible via filter toggle. |

**Bulk triage:** Select multiple notes (checkbox per row) → bulk actions bar: Move all, Tag all, Archive all, Delete all.

### Moving Notes Between Scopes

Notes can move between personal and team contexts:

| Direction | Action | What Happens |
|-----------|--------|-------------|
| **Personal → Personal** | Move from Inbox to another personal notebook | Record moved between personal wiki tables. Simple re-parenting. |
| **Personal → Team Wiki** | Move from personal notebook to team wiki table | Record moved to team table. `is_personal` flag on source table unchanged (it's still a personal table). The record itself transfers tables. Permission model shifts from personal-only to team-visible. Tags, content, attachments preserved. |
| **Team Wiki → Personal** | "Save to My Notes" on any team wiki page | **Copy, not move.** Creates a personal note with a link back to the team page. The team page is unaffected. Reason: moving team content into a personal space would break links and hide content from the team. |

**Technical note on cross-table moves:** Moving a record between tables requires field compatibility. Personal notebooks and team wikis both use the wiki preset, so the core fields (Title, Content, Parent, Tags, Status) are compatible. Custom fields on the destination table that don't exist on the source are left empty. Custom fields on the source that don't exist on the destination are stored in `canonical_data` under a `_migrated_fields` key so data isn't lost.

### Smart Triage Suggestions (AI-Powered)

For Inbox notes that have been sitting untriaged for 3+ days, the system can suggest organization actions:

- **Auto-suggest notebook:** Based on note content and existing notebook names/content, AI suggests: "This looks like it belongs in 'Meeting Notes' → [Move]"
- **Auto-suggest tags:** Based on note content and existing tag usage patterns: "Suggest tags: meeting, acme, pricing → [Apply]"
- **Auto-suggest links:** Based on semantic similarity to existing workspace records: "Related to: Acme Corp (Clients table) → [Link]"

**AI tier:** `fast` — 0 credits (platform UX feature, same as AI actionable messages in chat). Runs as background BullMQ job. Suggestions appear as subtle chips below the note in Inbox view. User can accept (one tap) or dismiss.

---

## 7. Search Across Notes

### Extending Existing Search

Personal notes are wiki records. They already participate in the standard search pipeline:

- **Record search vector (`records.search_vector`):** Title + tags + first 500 tokens of Smart Doc content (flattened)
- **File content search (`files.extracted_text_tsv`):** Attached file content searchable
- **Semantic search (`record_embeddings`):** Note content embedded for similarity search

Two additions for a notes-specific search experience:

### My Notes Search (Dedicated Search Surface)

`/search-notes [query]` in Command Bar, or the search bar in the My Notes section, searches **only personal notebooks** — scoped to tables where `is_personal = true AND owner_user_id = $me`.

This gives users a "search my notes" experience that doesn't mix personal captures with team data. Useful when you know the answer is "somewhere in my notes" but don't want to wade through workspace records.

**Search results include:**
- Note title (highlighted matches)
- Content snippet (with match highlighting)
- Notebook name
- Tags
- Captured date
- Source badge (manual, web clip, voice, file, import)
- Attached file matches (if the search term was found in an attached file's extracted text)

### Full-Content Embedding for Personal Notes

The existing `record_embeddings` only captures the first 500 tokens of display fields. For personal notes, where the full content IS the value, we extend embedding coverage using the same chunking strategy from `gaps/knowledge-base-live-chat-ai.md`:

**When a personal note is saved:**
1. If content ≤ 500 tokens: standard `record_embeddings` suffices
2. If content > 500 tokens: additionally generate chunked embeddings in `knowledge_embeddings` (yes, the same table — personal notes are wiki records, the infrastructure is shared)
3. Scoping: personal note chunks are only searchable by the owning user (filtered by `table_id` which is a personal table with `owner_user_id`)

This means a user can search for a phrase they remember writing in a long personal note, and semantic search will find the specific section — same as how the Live Chat AI finds the relevant paragraph in a help center article.

**No extra AI credit cost.** Embeddings are platform infrastructure, same as record embeddings.

---

## 8. Cross-Reference Updates Required

| Doc | Section | Change |
|-----|---------|--------|
| `data-model.md` | `tables` schema | Add `is_personal` (BOOLEAN, default false) and `owner_user_id` (UUID, nullable) columns. Add index. |
| `smart-docs.md` | Wiki Architecture | Add note: "Wiki tables can be personal notebooks (`is_personal = true`) scoped to a single user. See `personal-notes-capture.md`." |
| `my-office.md` | Widget Catalog | Add "Notes" platform widget to catalog list. |
| `command-bar.md` | Slash Commands table | Add `/note`, `/voice-note`, `/clip-file`, `/notebook`, `/search-notes` commands. |
| `command-bar.md` | Keyboard Shortcuts | Add `⌘+Shift+N` — Quick Capture popover. |
| `mobile.md` | Quick Actions | Replace `/quick/new-record` PWA shortcut with `/quick/note`. Add Quick Capture FAB overlay spec. |
| `mobile.md` | Share Sheet | Add Web Share Target API registration for PWA. Note Capacitor share sheet integration for native wrapper. |
| `tables-and-views.md` | Table Types | Note that `wiki` table_type can be `is_personal` — hidden from workspace navigation, single-user access. |
| `permissions.md` | Personal Scope | Document personal table access model: owner = full access, all others = no access, admins = existence only. |
| `vector-embeddings.md` | What Gets Embedded | Note that personal notes > 500 tokens use chunked embeddings via `knowledge_embeddings` table. |
| `gaps/knowledge-base-live-chat-ai.md` | knowledge_embeddings | Note that the table is shared with personal note chunked embeddings, scoped by `table_id`. |
| `files.md` | Context Types | Add `note_file_capture` as a context_type for files created via Quick Capture file drop. |
| `document-intelligence.md` | File Content Extraction | Note that file-first notes trigger extraction pipeline automatically on creation. |
| `CLAUDE.md` | Navigation | Add My Notes sidebar section. |

---

## 9. Phase Implementation

| Phase | Personal Notes & Capture Work |
|-------|------------------------------|
| **MVP — Core UX** | `is_personal` and `owner_user_id` columns added to `tables` schema. My Notes sidebar section renders (empty state with "Create your first notebook" prompt). Inbox notebook lazy-creation on first use. Quick Capture popover (`⌘+Shift+N`) with simplified TipTap editor — creates notes in Inbox. `/note` and `/notebook` slash commands. Personal notebook CRUD (create, rename, delete, reorder). |
| **Post-MVP — Documents** | File-first notes: drop file → create note with attachment + extracted text. Image notes with inline rendering. Web Clipper browser extension (Chrome — article, selection, bookmark modes). Full-page and screenshot clip modes. Duplicate detection. Clip metadata storage. `markdownToTipTap()` converter in `packages/shared`. My Notes widget for My Office grid. Note triage bar (move, link, pin, archive). Bulk triage. |
| **Post-MVP — Comms & Polish** | Voice notes: `/voice-note` + mobile voice capture → transcription → note. Mobile Quick Capture FAB overlay. Share sheet integration (PWA Web Share Target). Audio note playback. Evernote ENEX import pipeline. Import progress UI. Markdown file import. Cross-scope move (personal → team wiki with permission shift). Smart triage suggestions (AI background job). `/search-notes` dedicated personal search. Chunked embeddings for long personal notes. |
| **Post-MVP — Verticals & Advanced+ (post-MVP)** | Google Keep import. Notion import. Safari/Firefox extension ports. Offline web clipper queue. AI auto-organization (periodic review of Inbox, suggest notebook assignments). Note templates (meeting notes, daily journal, reading notes — presets with field configurations). Shared notebooks (personal table with invited collaborators — middle ground between personal and team). |

### Claude Code Prompt Roadmap

1. **Schema + sidebar shell** — Add `is_personal`/`owner_user_id` to tables. My Notes sidebar section with empty state. Personal table permission filtering in queries.
2. **Inbox notebook** — Lazy creation logic. Inbox-specific `wiki_table_config`. Default fields (Title, Content, Tags, Source, Captured At, Pinned, Status).
3. **Quick Capture popover** — React component: modal with simplified TipTap editor, notebook picker, tag input, link-to-record search. `⌘+Shift+N` keyboard shortcut registration.
4. **`/note` and `/notebook` commands** — Register in command registry. `/note [title]` creates record in Inbox. `/notebook [name]` creates personal wiki table.
5. **Personal notebook CRUD** — Create, rename, delete, reorder notebooks. Sidebar rendering with notebook list, right-click context menu.
6. **File-first notes** — Drop zone on Quick Capture popover and My Notes sidebar. File upload → record creation → extraction pipeline trigger. Content injection (toggle block with extracted text).
7. **Image notes** — Image dropped → inline rendering in TipTap content. AI vision analysis trigger (if credits available).
8. **Web Clipper: shared pipeline** — `packages/shared/clipper/` with Readability, Turndown, `markdownToTipTap()`, image collector, sanitizer. Unit tests with sample HTML pages.
9. **Web Clipper: extension** — Manifest V3 Chrome extension. Popup UI. Content script for selection capture. Service worker for auth + API calls. Clip ingestion endpoint.
10. **Web Clipper: clip modes** — Article (Readability), Selection (HTML fragment), Bookmark (metadata only), Full Page (best-effort), Screenshot (area capture + upload).
11. **My Notes widget** — My Office platform widget. Recent notes list, quick-create bar, expand-to-page.
12. **Triage bar** — Inbox list view with move/link/pin/archive actions per note. Bulk triage. Cross-scope move logic.
13. **ENEX import** — XML stream parser, ENML-to-TipTap converter, resource uploader, notebook mapper, progress tracking.
14. **Voice notes** — `/voice-note` command + mobile FAB voice option. Transcription pipeline integration. Title auto-generation.
15. **Smart triage** — Background AI job for untriaged Inbox notes. Notebook/tag/link suggestions. Accept/dismiss UX.
16. **Dedicated notes search** — `/search-notes` scoped to personal tables. Search results UI with source badges and content snippets. Chunked embedding for long notes.

---

## 10. Competitive Positioning

### What EveryStack Notes Does That Evernote Can't

| Capability | Evernote | EveryStack Notes |
|-----------|----------|-----------------|
| Notes are records with typed fields | ❌ Notes are text blobs | ✅ Every note has title, tags, source, date — plus custom fields |
| Cross-link notes to business data | ❌ Internal note links only | ✅ Link a note to a client, project, task, invoice — any record |
| Automations on notes | ❌ None | ✅ "When a note is tagged 'action-item', create a task in Projects table" |
| Generate documents from notes | ❌ Export only | ✅ Meeting notes → proposal draft via Smart Doc templates |
| Publish notes as help center | ❌ Not possible | ✅ Move personal note → team wiki → portal article in 2 clicks |
| AI-powered search | ❌ Basic keyword | ✅ Semantic search finds notes by meaning, not just words |
| AI document extraction | ❌ Basic OCR | ✅ Drop an invoice → fields auto-extracted into structured data |
| Real-time collaboration | ❌ Conflict-based sync | ✅ Yjs/Hocuspocus live collaboration on shared notes |
| Team + personal in one platform | ❌ Separate products (Personal vs Teams) | ✅ Personal notebooks + team wikis in the same workspace, connected |
| Views beyond list | ❌ List only | ✅ Notes in Grid, Kanban, Gallery, Calendar Table Views (they're records) |

### The Pitch

**"Your notes aren't just notes — they're the connective tissue of your work."**

Start with personal capture. Notes connect to clients, projects, and tasks because they're records with cross-links. Meeting notes auto-link to the meeting record, the client, and the project. AI summarizes your notes, extracts action items into task records, and makes everything searchable. When you need to share, your personal note moves into a team wiki or becomes a help center article with one click.

EveryStack Notes is what Evernote would be if it had been built on a database instead of a file system.
