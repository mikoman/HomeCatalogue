# Plan: Container/Item Move Operations + Existing-Container Scan Suggestions

## Goal

Add the ability to move things around the catalogue on the existing two-table model
(`Container` = storage/shelves/drawers/bins; `Item` = things). Two feature areas:

1. **Move operations** — items into/out of/between containers; containers between rooms;
   items between rooms (incl. container→room = clear `container_id`). Same-house only.
2. **Scan-suggestion improvement** — the AI sees the room's *existing* containers and
   proposes placement into them; the user can override each scanned item's destination
   at accept time; proposed container names reuse existing containers instead of
   duplicating them.

No DB migration, no new tables. `room_id`/`container_id` already exist on Item/Container.

## Locked decisions (from planning interview)

- **Storage = Container.** No new entity, no unified item-contains-item model.
- **Container move → re-home the whole subtree** in one transaction: recursively set
  `room_id = target` on the moved container, all descendant sub-containers, and all
  items inside those containers. If the moved container had a `parent_id` (was a
  sub-container), detach it to a root in the new room (`parent_id = null`), since its
  old parent stays in the old room.
- **Item location invariant:** `item.room_id == item.container.room_id`. Assigning a
  container implicitly places the item in that container's room. "Move an item" =
  pick a destination room, then optionally a container in that room (or "loose in
  room" → `container_id = null`).
- **UI = Move button + picker modal.** Items support **multi-select** (select N →
  "Move N items" → one picker). Containers move **one at a time**.
- **API = dedicated `/move` endpoints.** Existing PUT endpoints remain for field edits
  (name/description/category/tags) only.
- **Same-house only.** Enforced on the backend (authoritative) and in the picker (UX
  scoping). `RoomRead.house_id` exists, so the picker fetches the source room once to
  get `house_id`, then lists rooms in that house.
- **Scan suggestions = both AI-aware + manual override.** Pass existing container names
  into the AI prompt; add a per-item destination selector in the review overlay; at
  accept, match proposed names to existing containers first (reuse), create only
  unmatched names.

## Data model (unchanged, for reference)

- `Container`: `id, room_id (NOT NULL), parent_id (nullable, self-ref), name, description, ...`
  - Existing invariant (enforced only at `create_container`): `parent.room_id == container.room_id`
    (nesting is single-room).
- `Item`: `id, room_id (NOT NULL), container_id (nullable), name, category, tags, ...`
  - Intended invariant (NOT currently enforced): `item.room_id == item.container.room_id`.
- `RoomRead` includes `house_id` (verified) — used by the picker.

## Backend changes

### 1. `backend/app/schemas/item.py` — add move schema
- Add:
  ```python
  class ItemMove(BaseModel):
      item_ids: list[int]
      room_id: int
      container_id: int | None = None
  ```
- `ItemUpdate` stays as-is (no `room_id`) — moving is a separate operation.

### 2. `backend/app/schemas/container.py` — add move schema
- Add:
  ```python
  class ContainerMove(BaseModel):
      room_id: int
  ```
- `ContainerUpdate` stays as-is (no `room_id`).

### 3. `backend/app/routers/items.py` — `POST /api/items/move`
- Import `ItemMove`, `Room`, `Container`.
- Logic:
  1. Load target room; 404 if missing.
  2. If `container_id` is given: load that container; 404 if missing; 400 if
     `container.room_id != target_room.id` (container must be in target room).
  3. Load all items in `item_ids` (404 if any missing). For each item:
     - Load the item's current room; **400 if `current_room.house_id !=
       target_room.house_id`** (same-house constraint).
  4. Set each item: `room_id = target_room.id`, `container_id = container_id` (or
     `None`). This normalizes any latent `item.room_id != container.room_id` rows.
  5. Commit; return the updated items (`List[ItemRead]`).
- Place this route **before** `/{item_id}` routes so `/move` isn't shadowed by the
  path param (FastAPI matches in order; define `/move` above `/{item_id}`).

### 4. `backend/app/routers/containers.py` — `POST /api/containers/{container_id}/move`
- Import `ContainerMove`, `Room`.
- Logic:
  1. Load the container; 404 if missing. Load its current room (for house check).
  2. Load target room; 404 if missing. **400 if `current_room.house_id !=
     target_room.house_id`** (same-house).
  3. If `target_room.id == container.room_id`: return the container unchanged (no-op).
  4. Gather the whole subtree: start with `[container]`, recursively append children
     where `parent_id` in the gathered set (one query per depth, or a recursive
     walk). Collect all descendant container ids `S`.
  5. Update all containers in `S`: `room_id = target_room.id`.
  6. Set the moved container's `parent_id = None` (detach to root in new room).
  7. Update all items where `container_id IN S`: `room_id = target_room.id`.
  8. Commit; return the moved container (`ContainerRead`).
- No cycle risk: we only change `room_id` and null `parent_id`; we never reparent into
  the subtree.
- This route can stay alongside existing `/{container_id}` routes (different verb/path
  suffix `/move` is not ambiguous with `/{container_id}` GET/PUT/DELETE).

### 5. `backend/app/routers/scan.py` — pass existing containers to the AI
- In `_run_scan`, before calling `process_image_with_ai`, fetch the room's existing
  containers (id, name, description) using a short-lived session (same pattern as
  `_set_status`). This is the **snapshot at scan-creation time** (avoids races if the
  user adds containers while the scan runs).
- Call `process_image_with_ai(image_path, room_id, existing_containers=...)`.

### 6. `backend/app/services/ai_vision.py` — AI-aware of existing containers
- Change signature: `process_image_with_ai(image_path, room_id, existing_containers=None)`
  where `existing_containers` is a list of `{"name", "description"}` dicts (or None).
- Build a context string once, e.g.:
  ```
  EXISTING_CONTAINERS_CONTEXT = (
      "The room already contains these containers: "
      + ", ".join(f"'{c.name}'" for c in existing_containers)
      + ". When an item belongs in one of these, set its suggested_container to that "
      "exact name and do NOT re-propose it in proposed_containers. Only add a container "
      "to proposed_containers if none of the existing ones fit."
  )
  ```
- Append this to the `system` message (or the user text) in **all four** providers
  (`_process_openai`, `_process_anthropic`, `_process_ollama`, `_process_omlx`) — they
  share `SYSTEM_PROMPT`, so the cleanest is to compose the final system content per
  call. Keep `JSON_SCHEMA` unchanged (`suggested_container` stays a string;
  `proposed_containers` now means NEW containers only).
- No change to `_parse_scan_result`.

## Frontend changes

### 7. `frontend/src/api/client.js` — move endpoints
- Add to `items`:
  ```js
  move: ({ itemIds, roomId, containerId = null }) =>
    request('/items/move', { method: 'POST', body: JSON.stringify({
      item_ids: itemIds, room_id: roomId, container_id: containerId,
    })}),
  ```
- Add to `containers`:
  ```js
  move: (id, { roomId }) =>
    request(`/containers/${id}/move`, { method: 'POST', body: JSON.stringify({ room_id: roomId })}),
  ```
- (`rooms.list(houseId)`, `rooms.get(id)`, `containers.list(roomId)`, `houses.list`
  already exist and supply the picker data.)

### 8. New `frontend/src/components/MovePicker.jsx` — modal
- Props: `{ sourceRoomId, mode, itemIds, containerId, onDone, onClose }`
  - `mode`: `'item'` (uses `itemIds: number[]`) or `'container'` (uses
    `containerId: number`).
  - `sourceRoomId`: used to derive the house to scope targets.
- Flow:
  1. Fetch `roomsApi.get(sourceRoomId)` → `house_id`; fetch `roomsApi.list(house_id)`
     → candidate rooms (same-house). Disable/omit the source room? Keep it (moving within
     same room is allowed for items, e.g. between containers).
  2. User selects a target room. In `item` mode, fetch
     `containersApi.list(targetRoomId)` → containers; render a list + a "Loose in this
     room" option. In `container` mode, no container sub-select (a container becomes a
     root in the target room).
  3. Confirm:
     - `item` mode → `itemsApi.move({ itemIds, roomId: targetRoomId, containerId })`.
     - `container` mode → `containersApi.move(containerId, { roomId: targetRoomId })`.
  4. On success: `onDone()` (caller refreshes data + clears selection), then `onClose()`.
- Styling: match the existing modal pattern (see `HouseDetail` create-room modal:
  `fixed inset-0 bg-black/70 backdrop-blur-sm ... card ...`).

### 9. `frontend/src/components/ItemCard.jsx` — multi-select checkbox
- Add props `selected: boolean` and `onToggleSelect: (id) => void`.
- Render a checkbox in the card header; clicking the card (not the edit/delete buttons)
  toggles selection when a selection is active, or shows the checkbox always. Keep
  existing edit/delete behavior intact.
- Visual: when `selected`, highlight the card border (e.g. `border-primary-500`).

### 10. `frontend/src/components/ContainerTree.jsx` — per-container Move action
- Add a small "Move" icon button per container (on hover, like the existing add-child
  affordance). Clicking opens `MovePicker` with `mode: 'container'`,
  `containerId: container.id`, `sourceRoomId: roomId`.
- Keep existing select + add-sub-container behavior. (Rename/delete for containers are
  **out of scope** for this plan.)
- On move done: caller refreshes containers (pass an `onMoved` callback from
  `RoomView`).

### 11. `frontend/src/components/RoomView.jsx` — selection bar + container move + review-overlay destination selector
- **Multi-select items:** add `selectedItemIds: Set<number>` state. Add a sticky action
  bar (e.g. bottom of the items section) when non-empty: "Move {N} items" button → opens
  `MovePicker` (`mode: 'item'`, `itemIds: [...selectedItemIds]`,
  `sourceRoomId: roomId`). On done: `loadData()` + clear selection. Also add a per-card
  "Move" affordance for a single item (selects just that item and opens the picker) to
  cover one-at-a-time use.
- **Container move:** pass `onMoved={loadData}` to `ContainerTree`; `ContainerTree`
  invokes it after a successful container move.
- **Review overlay — per-item destination selector:**
  - When a scan completes and the overlay opens, fetch `containersApi.list(roomId)` →
    existing containers in the scanned room. Store on the scan object as
    `existingContainers`.
  - Per item, track a `target`: one of
    `{ kind: 'existing', containerId } | { kind: 'proposed', name } | { kind: 'loose' }`.
    Default from the AI's `suggested_container`: if it matches an existing container
    name (case-insensitive) → `existing`; else if it matches a `proposed_containers`
    name → `proposed`; else `loose`.
  - Render a `<select>` per item with options: existing containers (label = name),
    proposed new containers (label = name, marked "(new)"), and "Loose in room".
- **Rewrite `handleAcceptAll` (per reviewing scan):**
  1. Build `nameToId` map from existing containers (lowercased name → id).
  2. For each `proposed_container`: if its name (lowercased) is already in `nameToId`,
     skip (reuse); else create it via `containersApi.create`, add to `nameToId`.
  3. For each item: resolve its `target` to `container_id`:
     - `existing` → the chosen existing id.
     - `proposed` → `nameToId[target.name.toLowerCase()]`.
     - `loose` → `null`.
     Then set `room_id = parseInt(roomId)`, `container_id = resolved`,
     `scan_session_id = null`.
  4. `itemsApi.bulkCreate({ items })`; on success `loadData()`, close review,
     `removeScan(scanId)`.
- Keep the existing edit-name / reject-item behaviors in the overlay.

## Validation / invariant matrix (backend authoritative)

| Operation | Checks | Effect |
|-----------|--------|--------|
| `POST /items/move` | target room exists; each item's house == target house; container (if given) ∈ target room | set `room_id`, `container_id` (or null) |
| `POST /containers/{id}/move` | container exists; target room exists; same house | re-home subtree `room_id`; null moved container `parent_id`; re-home contained items `room_id` |

## Edge cases

- **Duplicate containers at accept** — case-insensitive name reuse prevents re-scanning
  a room from creating duplicate shelves.
- **Container-move cascade consistency** — descendants and contained items all get the
  new `room_id`, so `child.room_id == parent.room_id` and `item.room_id ==
  container.room_id` hold after any move.
- **Latent inconsistent rows** — any item with `room_id != container.room_id` is
  normalized the next time it's moved into a container.
- **Scan snapshot** — existing-container list is captured when the scan is created
  (in `_run_scan`), not when it completes, so mid-scan container additions don't race.
- **No-op container move** (same room) — returns unchanged, no cascade work.
- **Moving a sub-container across rooms** — detaches to root (`parent_id=null`); its
  descendants move with it and also detach implicitly (their `parent_id` chains remain
  intact within the subtree).

## Out of scope (explicit)

- Container rename/delete UI (only Move added to the tree).
- Reparenting containers within a room (move only changes `room_id` + detaches to
  root; it does not let you choose a new parent).
- Cross-house moves (same-house only).
- Drag-and-drop (deferred; Move button + picker now).
- New DB columns or migrations.

## Testing / verification (manual)

- `docker compose exec -T backend python -m py_compile` on all changed backend files.
- Rebuild frontend: `npm --prefix frontend run build`, then
  `docker compose up -d --build frontend` (prod/nginx); dev uses Vite HMR.
- Backend smoke tests via curl through nginx (port 80):
  - Move one item room→room: `POST /api/items/move {item_ids:[1], room_id:2}` → 200,
    item.room_id == 2, container_id null.
  - Move item into a container in another (same-house) room: container_id set, item.room_id
    == container.room_id.
  - Cross-house move: expect 400.
  - Move a container with descendants+items to another same-house room: container +
    descendants + items all have new room_id; container.parent_id null.
- Frontend:
  - Select 2+ item cards → "Move N items" → picker shows same-house rooms → pick
    room + container → items move and view refreshes; selection cleared.
  - Open a container's Move action → pick another room → tree + items refresh.
  - Scan a room that already has containers → review overlay shows existing containers
    as per-item destinations; AI suggested_container prefers existing; accept reuses
    existing container (no duplicate created) and files items correctly.

## Run instructions after implementation

- **Dev**: Vite HMR + uvicorn `--reload` pick up changes; no rebuild needed.
- **Prod (Docker/nginx)**: `docker compose up -d --build frontend` (frontend dist is
  baked into the image). Backend code is volume-mounted, so no backend rebuild needed.
- Browser: hard refresh (Cmd/Ctrl+Shift+R) to bust the cached JS bundle.
