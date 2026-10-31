# Fleet Files (v1)

Phone app (PWA) for the company's shop equipment and vehicles: equipment list, notes, service records. Parts per equipment (with low-stock highlight).

## Run it
```
npm install
FLEET_OWNER_PIN=4321 PORT=8080 node server.js
# or: ./start.sh   (runs in background, log in server.log)
```
Open http://localhost:8080. Data lives in `data/fleet.db` (SQLite via sql.js). Back that file up.

| Setting | Env var | Default |
|---|---|---|
| Owner PIN (Robert – full admin) | `FLEET_OWNER_PIN` | falls back to `FLEET_ACCESS_CODE`, then `fleet2026` |
| Old shared code – only used as the owner-PIN fallback | `FLEET_ACCESS_CODE` | `fleet2026` |
| ~~Admin code~~ – **no longer used (v11)**, safe to delete | `FLEET_ADMIN_CODE` | – |
| Port | `PORT` | `8080` |
| Database file | `DB_FILE` | `data/fleet.db` |

**Set `FLEET_OWNER_PIN` before real use.**

### Render env vars (v11)
- `DATA_DIR=/var/data` (keep as is)
- `FLEET_OWNER_PIN=<Robert's PIN>` – **add this** (any length; numbers recommended). If you skip it, the owner PIN is the current `FLEET_ACCESS_CODE`, so you're never locked out.
- `FLEET_ACCESS_CODE` – may stay (fallback only). Coworkers can no longer get in with it.
- `FLEET_ADMIN_CODE` – no longer used; you can remove it.

## People & Permissions (v11)
- **Sign in = your name + your PIN.** The phone remembers you (a random session token, stored hashed on the server) until you tap Sign Out.
- **Owner (Robert):** type any name + the owner PIN (`FLEET_OWNER_PIN`). That opens the owner account, which is always an Admin and can't be removed or demoted. The first name you type becomes the owner's name.
- **Coworkers:** an admin adds them in ⚙ Settings → **👥 People & Permissions** → ＋ Add Person (name + a 4–8 digit PIN, Member or Admin). Tell them the name and PIN. Names aren't case sensitive.
- In the same screen: change anyone's role (Member/Admin), 🔑 Reset PIN (signs them out everywhere), Remove (their notes/records stay). The owner/last admin can't be removed or demoted.
- **Admins** can do everything. **Members** can always view and edit everything; the switches control adding/deleting. Defaults: parts add ✅ / delete ✅ (Parts page + machine parts), priority items add/delete ❌, notes/service/checklists/inspections/manuals add ✅ delete ❌, equipment add/delete ❌, to-dos add/delete ❌, edit chip lists ❌.
- Why records are add-yes/delete-no: mechanics need to log work as it happens, but the history is the shop's record, so only admins can erase it.
- Enforced on the server (403 "You don't have permission") and the buttons are hidden in the app. Notes/to-dos are stamped with the signed-in person's name; older notes keep their typed-in author.
- PINs are stored scrypt-hashed. 8 wrong tries for one name from one phone → 15-minute wait. Deletes no longer ask for the admin code.
- Additive migration: new tables `users`, `sessions`, `settings`; nothing existing is changed.

Five equipment items named `EXAMPLE – …` are seeded once on first start. Delete them: open item → Edit Details → Delete Equipment (admins).

## Install on a phone (needs an HTTPS URL)
- iPhone: open the URL in **Safari** → Share button → **Add to Home Screen** → Add.
- Android: open in **Chrome** → ⋮ menu → **Install app** (or "Add to Home screen").

## API (all need header `x-session: <token>` from `POST /api/login {name,pin}`; photo/file links use `?t=<token>`)
`GET /api/me`, `POST /api/logout`, admin only: `GET/POST /api/people`, `PUT/DELETE /api/people/:id` (`{role}`, `{pin}`, `{name}`), `PUT /api/permissions` (`{eq_add:true,…}`).
`GET/POST /api/equipment`, `GET/PUT /api/equipment/:id`, `DELETE /api/equipment/:id` (admin or member with permission),
`GET/POST /api/equipment/:id/notes`, `GET/POST /api/equipment/:id/service`, `GET /api/equipment/:id/photo`.
`PUT /api/equipment/:id/photo` (`{photo: dataURL|null}`), `GET /api/parts` (all machine parts with their machine name/unit, used by the Parts page search), `GET/POST /api/equipment/:id/parts`, `GET/PUT/DELETE /api/parts/:id`, `GET /api/parts/:id/photo`.
Parts fields: name, part_number, manufacturer, qty, reorder_level (LOW when qty ≤ reorder_level), bin, supplier, price, url, notes, photo. EXAMPLE parts are seeded once.

## Parts page (shop parts, v7)
The main screen has an **Equipment | Parts** switch under the header. The **Parts** page holds loose spare parts lying around the shop that aren't tied to a machine: name, part #, brand, category, qty on hand, low-stock level, location/bin, which machines it fits, supplier, notes, and a photo (resized on the phone and stored in the DB like equipment photos).
- Filter chips by category and All / In stock / Low stock. Tap a part for big **− / +** quantity buttons; Edit to change details; Delete needs permission (admins by default).
- The search bar on this page searches **any** part: shop parts plus every machine's parts (shown under "On Equipment" with the machine name and unit #). Tapping a machine part opens that machine's Parts tab with the part highlighted. The Equipment page search is equipment-only.
- Stored in the new table `loose_parts` (`CREATE TABLE IF NOT EXISTS`). Four `EXAMPLE` shop parts are seeded once (flag file `fleet.db.loose-seeded`), so they don't come back after you delete them.
- API: `GET/POST /api/loose`, `GET/PUT/DELETE /api/loose/:id` (DELETE needs `x-admin-code`), `POST /api/loose/:id/qty` (`{delta:+1|-1}`), `GET /api/loose/:id/photo`.

## Priority page (v12)
- 4th main tab **Priority** (always red, with a red ❗ icon and a yellow count of open items, shown on every main page). A separate list for urgent things (safety, breakdowns, parts needed) – its own table `priority_items`, not a filter of the To Do List.
- Same layout as the other pages: search bar, editable chip rows **Status** (Open / In progress / Done) and **Category** (Safety / Breakdown / Parts needed / Other), cards with tap-to-mark-done, ＋ Add Priority Item, detail view, optional machine (tap to open it), optional due date (red when overdue), who added it and when.
- Deleting a status moves items to Open; deleting a category leaves items with no category. Deleting a machine keeps its priority items, just unlinked.
- Permissions: new switches **Add priority items** / **Delete priority items** (Members off by default, like to-dos). Members can still view, edit and mark done.
- Additive migration: new table `priority_items`, lists seeded once (flag `fleet.db.lists4-seeded`). API: `GET/POST /api/priority`, `GET/PUT/DELETE /api/priority/:id`, `PUT /api/priority/:id/done {done}`; list kinds `pri_status`, `pri_category`.

## To Do List (v10)
- Third main tab next to Equipment and Parts (`#/todo`). Own search (to-dos only: title, details, machine, who added), two editable chip rows: **Status** (Open / In progress / Done) and **Priority** (High / Normal / Low), each with ✎ Edit; “All” is fixed.
- A to-do has title, details, status, priority, optional machine (tap it on the card to open that machine), optional due date (overdue shows red), who added it (your name from sign-in), created/updated/done times.
- Tap the round check on a card (or ✓ Mark Done in the detail) to mark done / reopen. “Done” and “Open” keep working if renamed (roles).
- Deleting a to-do Delete needs permission (admins by default). Deleting a status/priority in use moves those to-dos to Open / Normal (or the first left). Deleting a machine keeps its to-dos, just unlinked.
- Additive: new `todos` table (`CREATE TABLE IF NOT EXISTS`), lists seeded once via `fleet.db.lists3-seeded`. API: `GET/POST /api/todos`, `GET/PUT /api/todos/:id`, `PUT /api/todos/:id/done {done}`, `DELETE /api/todos/:id` (admin). List kinds `todo_status`, `priority`.

## Editable types & categories (v8)
- The **Types** chips (Equipment page) and **Category** chips (Parts page) end in a dashed **✎ Edit** chip. It opens a sheet to add, rename (type in the box), move ↑/↓, or delete.
- Renaming updates every machine / shop part that uses the old name. Renaming onto an existing name merges them.
- Deleting Delete needs permission (admins by default). The sheet first says how many records use it; machines move to “other”, shop parts become blank (no category). Nothing else is deleted.
- Add/Edit forms pick from these lists; “＋ New type…/New category…” lets you type a new one, which is added to the list automatically.
- Stored in a new `lists` table (additive). Seeded once (`fleet.db.lists-seeded`) from the built-in defaults plus any types/categories already used.
- **Status & stock (v9)** are editable the same way (✎ Edit at the end of the Status row on the Equipment page and the Stock row on the Parts page; the “All” chip is fixed).
  - Status: the add/edit form and the status buttons on a machine use the list. Built-in statuses keep their colors when renamed (green / orange / red); new ones are blue. Deleting a status in use moves those machines to “in service” (or the first status left); at least one status must remain.
  - Stock: defaults In stock / Low stock / Out of stock are **automatic** from qty and “Low at” (renaming keeps them automatic). A part can also be set to a stock status by hand in its form (e.g. “On order”); “Automatic (from qty)” is the default. Deleting a stock status in use puts those parts back to Automatic. Note: qty 0 now shows under “Out of stock” (before v9 it was under “Low stock”); the orange LOW warning is unchanged.
  - Additive migration: `lists.role` and `loose_parts.stock` columns (ADD COLUMN only), seeded once via `fleet.db.lists2-seeded`. `kind` in the API can also be `status` or `stock`.
- API: `GET /api/lists`, `POST /api/lists/:kind {value}`, `PUT /api/lists/:kind {from,to}`, `PUT /api/lists/:kind/order {values}`, `GET /api/lists/:kind/usage?value=`, `DELETE /api/lists/:kind?value=&replace=` (admin). `kind` = `type` or `category`.
- Custom types use the generic “other” stock photo until a unit photo is added.

## Procedures tab (v4)
Each equipment piece has a **Procedures** tab next to Notes / Service / Parts:
- **Inspection checklists** – make a named list (one item per line), tap **Start Inspection**, mark each item Pass/Fail with an optional note, save. Past inspections (who, date, pass/fail) are listed under the checklist. Deleting a checklist or inspection Delete needs permission (admins by default).
- **Manuals & documents** – upload a PDF, photo, or Office file (max **25 MB**) with a title; tap to open (PDFs open in Safari's viewer), rename, or delete (admin code).
- Files are stored on disk in `DATA_DIR/docs/` (e.g. `/var/data/docs` on Render) with random names, **not** in the database. Back up that folder along with `fleet.db`.
- API: `GET/POST /api/equipment/:id/checklists`, `GET/PUT/DELETE /api/checklists/:id`, `GET/POST /api/checklists/:id/inspections`, `DELETE /api/inspections/:id`,
  `GET /api/equipment/:id/docs`, `POST /api/equipment/:id/docs?title=&filename=&type=` (raw file body), `GET /api/docs/:id/file`, `PUT/DELETE /api/docs/:id`.
- New tables (`checklists`, `inspections`, `documents`) are created with `CREATE TABLE IF NOT EXISTS`; existing data is untouched. No new env vars or dependencies.

## Permanent hosting (recommended)
The app needs an always-on server with a persistent disk (for the SQLite file). A `Dockerfile` is included (stores DB at `/data/fleet.db`).
- **Fly.io (cheapest):** smallest always-on machine shared-cpu-1x/256MB ≈ **$2.19/mo** + 1 GB volume **$0.15/mo** + egress $0.02/GB (fly.io/pricing, checked Oct 2026). No free tier; credit card required after trial. `fly launch`, `fly volumes create data --size 1`, mount at `/data`, `fly secrets set FLEET_ACCESS_CODE=… FLEET_ADMIN_CODE=…`.
- **Render (simplest dashboard):** Starter web service **$7/mo** + persistent disk **$0.25/GB/mo** (render.com/pricing, checked Oct 2026). Free tier cannot attach a disk, so data would be lost on restart — don't use free.
Both give a permanent HTTPS URL, so the home-screen app keeps working.

## CREDITS (photos)
All photos are from Wikimedia Commons, resized/cropped only, stored in `public/photos/`. Also shown in the app under Settings → Photo Credits.

- **background (pit)**: U.S. Department of Agriculture, photo by Lance Cheung, Public domain (US federal government work). Electric shovel loading a Cat haul truck in an open-pit coal mine near Wright, Wyoming — https://commons.wikimedia.org/wiki/File:20190802-OSEC-LSC-0598_(48443511726).jpg (cropped/resized to `public/photos/pit-mobile.webp` and `pit-desktop.webp`; used as the fixed full-screen app background)
- **header photo** (`header-semis.webp`, top bar behind “Fleet Files” on every page, v13): Leif Skoogfors / FEMA, Public domain (US federal government work) — “Trucks lined up at a FEMA staging area in Houston, TX”, Sept 20, 2008. https://commons.wikimedia.org/wiki/File:FEMA_-_38565_-_Trucks_lined_up_at_a_FEMA_staging_area_in_Houston,_TX.jpg — cropped to a wide strip, 1290×322 WebP (~54 KB) with a dark gradient for readability; cached offline by the service worker.
- **app icon** (`apple-touch-icon.png`, `icon-192/512.png`, `favicon.*`): NPS Photo (U.S. National Park Service, via NPGallery), Public domain — square crop of “A line of construction equipment rests on a sunny Sunday” — https://commons.wikimedia.org/wiki/File:A_line_of_construction_equipment_rests_on_a_sunny_Sunday_(ae83b17d-7fe8-4085-9b0e-cd91accd36c3).JPG
- **hero**: Tiia Monto, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Excavator_and_mountains.jpg
- **excavator**: Isaac Wedin, CC BY 2.0 — https://commons.wikimedia.org/wiki/File:Excavating_in_Soldotna.jpg
- **loader**: Syced, CC0 — https://commons.wikimedia.org/wiki/File:Komatsu_WA500_wheel_loader_for_gravel_mining.jpg
- **dozer**: Timothy A. Gonsalves, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Bulldozer_Snow_Clearance_Shinko_La_Lungnak_Jun24_A7CR_00326.jpg
- **dump-truck**: Wikideas1, CC0 — https://commons.wikimedia.org/wiki/File:Articulated_hauler.jpg
- **truck**: Tony Webster, CC BY 2.0 — https://commons.wikimedia.org/wiki/File:Ford_F-150_Pickup_Truck_in_the_Wyoming_Mountains.jpg
- **trailer**: BLM Oregon & Washington, CC BY 2.0 — https://commons.wikimedia.org/wiki/File:Heavy_Equipment-_Bulldozer_-_52358097054.jpg
- **generator**: Bryansfiles, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Caterpillar_Diesel_Generators.JPG
- **other**: Oregon Department of Transportation, CC BY 2.0 — https://commons.wikimedia.org/wiki/File:Ashland_Emergency_Ramp_Construction_(51845828325).jpg

CC BY-SA / CC BY photos require attribution (given above and in the app).

## Fonts
Title/wordmark font: **Oxanium** (600/700), self-hosted in `public/fonts/` from the @fontsource/oxanium package, SIL Open Font License 1.1 (`public/fonts/OFL-oxanium.txt`).

Test images in `test/` were drawn with Python/Pillow for testing (not real photos).

## Known limitations (v1)
- Logins are name + PIN (no email/password reset); a forgotten PIN is reset by an admin, the owner PIN by changing `FLEET_OWNER_PIN`.
- Offline mode is view-only (data cached from last online visit); adding/editing needs a connection.
- Photos (equipment and parts) are resized to max 1280px JPEG (~50 KB) on the phone and and stored in the database (fine for a small fleet).
- No automated backups — copy `data/fleet.db`.

## Demo mode
- **In-app:** tap **▶ Try Demo** on the login screen. It loads the EXAMPLE data, and all changes stay in this browser's localStorage, so the server DB is never touched. Use **Reset demo** or **Exit** in the yellow banner.
- **Standalone file:** `demo/FleetFiles-Demo.html` is a single offline file of about 1.65 MB that needs no server. Open it from Files, a chat attachment, or any computer. Rebuild it with `python3 build-demo.py`.
