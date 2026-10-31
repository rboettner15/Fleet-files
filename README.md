# Fleet Files (v1)

Phone app (PWA) for the company's shop equipment and vehicles: equipment list, notes, service records. Parts per equipment (with low-stock highlight).

## Run it
```
npm install
FLEET_ACCESS_CODE=fleet2026 FLEET_ADMIN_CODE=admin-anchorpoint PORT=8080 node server.js
# or: ./start.sh   (runs in background, log in server.log)
```
Open http://localhost:8080. Data lives in `data/fleet.db` (SQLite via sql.js). Back that file up.

| Setting | Env var | Default |
|---|---|---|
| Company access code (everyone) | `FLEET_ACCESS_CODE` | `fleet2026` |
| Admin code (delete equipment/notes/records) | `FLEET_ADMIN_CODE` | `admin-anchorpoint` |
| Port | `PORT` | `8080` |
| Database file | `DB_FILE` | `data/fleet.db` |

**Change both codes before real use.**

Five equipment items named `EXAMPLE – …` are seeded once on first start. Delete them: open item → Edit Details → Delete Equipment → enter admin code.

## Install on a phone (needs an HTTPS URL)
- iPhone: open the URL in **Safari** → Share button → **Add to Home Screen** → Add.
- Android: open in **Chrome** → ⋮ menu → **Install app** (or "Add to Home screen").

## API (all need header `x-access-code`)
`GET/POST /api/equipment`, `GET/PUT /api/equipment/:id`, `DELETE /api/equipment/:id` (+ `x-admin-code`),
`GET/POST /api/equipment/:id/notes`, `GET/POST /api/equipment/:id/service`, `GET /api/equipment/:id/photo`.
`PUT /api/equipment/:id/photo` (`{photo: dataURL|null}`), `GET /api/parts` (all machine parts with their machine name/unit, used by the Parts page search), `GET/POST /api/equipment/:id/parts`, `GET/PUT/DELETE /api/parts/:id`, `GET /api/parts/:id/photo`.
Parts fields: name, part_number, manufacturer, qty, reorder_level (LOW when qty ≤ reorder_level), bin, supplier, price, url, notes, photo. EXAMPLE parts are seeded once.

## Parts page (shop parts, v7)
The main screen has an **Equipment | Parts** switch under the header. The **Parts** page holds loose spare parts lying around the shop that aren't tied to a machine: name, part #, brand, category, qty on hand, low-stock level, location/bin, which machines it fits, supplier, notes, and a photo (resized on the phone and stored in the DB like equipment photos).
- Filter chips by category and All / In stock / Low stock. Tap a part for big **− / +** quantity buttons; Edit to change details; Delete needs the admin code.
- The search bar on this page searches **any** part: shop parts plus every machine's parts (shown under "On Equipment" with the machine name and unit #). Tapping a machine part opens that machine's Parts tab with the part highlighted. The Equipment page search is equipment-only.
- Stored in the new table `loose_parts` (`CREATE TABLE IF NOT EXISTS`). Four `EXAMPLE` shop parts are seeded once (flag file `fleet.db.loose-seeded`), so they don't come back after you delete them.
- API: `GET/POST /api/loose`, `GET/PUT/DELETE /api/loose/:id` (DELETE needs `x-admin-code`), `POST /api/loose/:id/qty` (`{delta:+1|-1}`), `GET /api/loose/:id/photo`.

## Editable types & categories (v8)
- The **Types** chips (Equipment page) and **Category** chips (Parts page) end in a dashed **✎ Edit** chip. It opens a sheet to add, rename (type in the box), move ↑/↓, or delete.
- Renaming updates every machine / shop part that uses the old name. Renaming onto an existing name merges them.
- Deleting needs the admin code. The sheet first says how many records use it; machines move to “other”, shop parts become blank (no category). Nothing else is deleted.
- Add/Edit forms pick from these lists; “＋ New type…/New category…” lets you type a new one, which is added to the list automatically.
- Stored in a new `lists` table (additive). Seeded once (`fleet.db.lists-seeded`) from the built-in defaults plus any types/categories already used.
- **Status** (in service / in shop / down) stays fixed on purpose: it drives the colors, badges and status buttons.
- API: `GET /api/lists`, `POST /api/lists/:kind {value}`, `PUT /api/lists/:kind {from,to}`, `PUT /api/lists/:kind/order {values}`, `GET /api/lists/:kind/usage?value=`, `DELETE /api/lists/:kind?value=&replace=` (admin). `kind` = `type` or `category`.
- Custom types use the generic “other” stock photo until a unit photo is added.

## Procedures tab (v4)
Each equipment piece has a **Procedures** tab next to Notes / Service / Parts:
- **Inspection checklists** – make a named list (one item per line), tap **Start Inspection**, mark each item Pass/Fail with an optional note, save. Past inspections (who, date, pass/fail) are listed under the checklist. Deleting a checklist or inspection needs the admin code.
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
- Shared access code, no individual logins; names are self-entered.
- Offline mode is view-only (data cached from last online visit); adding/editing needs a connection.
- Photos (equipment and parts) are resized to max 1280px JPEG (~50 KB) on the phone and and stored in the database (fine for a small fleet).
- No automated backups — copy `data/fleet.db`.

## Demo mode
- **In-app:** tap **▶ Try Demo** on the login screen. It loads the EXAMPLE data, and all changes stay in this browser's localStorage, so the server DB is never touched. Use **Reset demo** or **Exit** in the yellow banner.
- **Standalone file:** `demo/FleetFiles-Demo.html` is a single offline file of about 1.65 MB that needs no server. Open it from Files, a chat attachment, or any computer. Rebuild it with `python3 build-demo.py`.
