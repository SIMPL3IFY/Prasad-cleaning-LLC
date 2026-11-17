# SCRUM-253: Testing — Service Photos Manager

## What this tests

Unit tests for the Edit Services popup (`src/components/ServicePhotosManager.jsx`), which an admin opens from the dashboard with the Manage Services button. From it the admin can replace a service's photo, show or hide a service, edit its description, delete it, and add a new service.

Supabase is fully mocked so these tests never touch the real database or the `service-images` photo bucket, and never change what customers see on the live site.

## Test file

`Testing/servicePhotosTest/testScrum253.jsx`

## How to run

### Step 1 — Make sure you are in the project root

```bash
cd path/to/Prasad-cleaning-LLC
```

### Step 2 — Install dependencies (first time only)

```bash
npm install
```

### Step 3 — Run just the SCRUM-253 tests

```bash
npx vitest run Testing/servicePhotosTest/testScrum253.jsx
```

You should see output like this:

```
✓ Testing/servicePhotosTest/testScrum253.jsx (48 tests)

Test Files  1 passed (1)
     Tests  48 passed (48)
```

### Step 4 — Run all tests together (optional)

```bash
npm run test:run
```

### Step 5 — View coverage report (optional)

```bash
npm run test:coverage
```

After it finishes, open `coverage/index.html` in your browser to see the full report.

---

## Tests included

"Blocked" below means Supabase returns no rows and no error, which is what happens when the database's security rules refuse the change. The page then shows "Please make sure you are signed in as an admin."

**Loading the list**

| # | Test | What it checks |
|---|---|---|
| 1 | Loading | "Loading services..." shows while services load |
| 2 | Service list | Services are loaded in `sort_order`, each with its photo, description and a Visible or Hidden badge |
| 3 | Load error | "Unable to load services." shows |
| 4 | No services | "No services found." shows |
| 5 | Close | The close button calls `onClose` |

**Replacing a photo**

| # | Test | What it checks |
|---|---|---|
| 6 | No file yet | Save photo stays disabled until a file is chosen |
| 7 | Wrong file type | "Please choose a JPG, PNG, or WebP image." shows and nothing is uploaded |
| 8 | Too large | A file over 5 MB shows "Please choose an image smaller than 5 MB." |
| 9 | Pick again | A rejected file is cleared so the same file can be picked again |
| 10 | Preview | The chosen photo and its file name show before anything is saved |
| 11 | New photo | The photo is uploaded, the service is updated, then the old photo is removed, in that order. "Deep Cleaning photo updated." shows and other services don't change |
| 12 | While saving | The button reads "Saving..." and is disabled |
| 13 | Preview cleanup | Picking another file releases the old preview |
| 14 | File types offered | Both photo pickers only offer JPG, PNG and WebP |
| 15 | Upload fails | Supabase's error shows, the service isn't updated and the old photo stays |
| 16 | Update blocked | The new upload is removed, the old photo is kept, and the admin error shows |
| 17 | Old photo not removed | The save still counts as a success and no error shows |

**Showing and hiding a service**

| # | Test | What it checks |
|---|---|---|
| 18 | Hide | Sends `is_active: false`, shows "Deep Cleaning is now hidden from the site." and only that service's badge changes |
| 19 | Show | Sends `is_active: true` and shows "Window Cleaning is now shown on the site." |
| 20 | Blocked | The badge stays the same and "Could not update Deep Cleaning." shows |
| 21 | While saving | Every button and field in the popup is disabled until the save finishes |

**Editing a description**

| # | Test | What it checks |
|---|---|---|
| 22 | Real change only | Save description stays disabled until the text actually changes (extra spaces don't count) |
| 23 | Length limit | The description is limited to 300 characters |
| 24 | Save | The trimmed text is saved and "Deep Cleaning description updated." shows |
| 25 | While saving | The button reads "Saving..." and is disabled |
| 26 | Emptied | An empty description is saved as `null`, so the site shows its default text |
| 27 | Save fails | The typed text stays and "Could not save the description for Deep Cleaning." shows |

**Deleting a service**

| # | Test | What it checks |
|---|---|---|
| 28 | Confirmation | Delete asks "Delete Deep Cleaning?" and deletes nothing yet |
| 29 | Cancel | Cancelling the confirmation deletes nothing |
| 30 | Another save running | An open confirmation's buttons are disabled while another service saves |
| 31 | Delete | The row is deleted first, then its photo. "Deep Cleaning was deleted." shows and only that service leaves the list |
| 32 | While deleting | The button reads "Deleting..." and is disabled |
| 33 | Preview cleanup | A chosen preview is released when its service is deleted |
| 34 | Blocked | The service and its photo stay and "Could not delete Deep Cleaning." shows |
| 35 | Photo not removed | The service still leaves the list and no error shows |

**Adding a service**

| # | Test | What it checks |
|---|---|---|
| 36 | No name | "Please enter a service name." shows and nothing is uploaded |
| 37 | Duplicate name | `DEEP cleaning` shows "A service named "DEEP cleaning" already exists." (capitals are ignored) |
| 38 | No photo | "Please choose a photo for the new service." shows and nothing is uploaded |
| 39 | Bad photo | The file type error shows and the photo is cleared |
| 40 | Add | The photo is uploaded, then the service is added with a trimmed name and description and a `sort_order` one past the highest. "Floor Waxing was added." shows and the form clears |
| 41 | Old message replaced | A new error replaces the last success message |
| 42 | While adding | The button reads "Adding..." and is disabled |
| 43 | Length limit | The new description is limited to 300 characters |
| 44 | Preview cleanup | Picking another file releases the old preview |
| 45 | Blank description | A blank description is saved as `null` |
| 46 | Upload fails | Supabase's error shows and nothing is added |
| 47 | Name taken meanwhile | If another admin just added the same name, the upload is removed and the duplicate message shows |
| 48 | Blocked | The upload is removed, the typed name stays, and "Could not add the service." shows |

---

## How the mock works

`mockSupabase()` fakes everything the popup talks to:

- `from('services').select().order()` loads the services
- `from('services').update().eq().select()` saves a photo, description or visibility change
- `from('services').delete().eq().select()` deletes a service
- `from('services').insert().select()` adds a service
- `storage.from('service-images').upload()` and `.remove()` upload and remove photos, and `getPublicUrl()` returns a fake address

Each call records its name in `calls`, so tests can check the order things happen in, for example `['upload', 'update', 'remove']` when a photo is replaced.

Each test can override any result, for example `mockSupabase({ uploadResult: { error: { message: 'bucket full' } } })` to make an upload fail, or `mockSupabase({ updateResult: { data: [], error: null } })` to block an update.

The browser's photo preview functions (`URL.createObjectURL` and `URL.revokeObjectURL`) are faked too, because the test browser doesn't have them.

---

## Selenium tests

`Testing/selenium/test_service_photos.py` has 12 functional tests that drive the real site in Chrome. They are not part of `npm run test:run` and don't run in CI, so run them yourself before your PR.

### How to run

```bash
pip install -r Testing/selenium/requirements.txt   # once
npm run dev                                         # terminal 1
```

Every test signs in as an admin, so they are all skipped without a real admin account. In terminal 2:

```powershell
$env:TEST_ADMIN_EMAIL = 'admin@example.com'; $env:TEST_ADMIN_PASSWORD = '...'
python -m pytest Testing/selenium/test_service_photos.py -v
```

To run without opening a browser window, set `HEADLESS=1`.

Test 12 changes real data, so it only runs when you also set `RUN_SERVICE_WRITE_TESTS=1`:

```powershell
$env:RUN_SERVICE_WRITE_TESTS = '1'
python -m pytest Testing/selenium/test_service_photos.py -v
Remove-Item Env:RUN_SERVICE_WRITE_TESTS
```

### Tests included

| # | Test | What it checks | Needs account? | Saves data? |
|---|---|---|---|---|
| 1 | Popup opens and closes | Services show with their photos, and × closes the popup | Admin | No |
| 2 | Badges and buttons | Every service shows Visible with a Hide button, or Hidden with a Show button | Admin | No |
| 3 | Wrong file type | "Please choose a JPG, PNG, or WebP image." shows, Save photo stays disabled, and the file can be picked again | Admin | No |
| 4 | Too large | A file over 5 MB shows "Please choose an image smaller than 5 MB." | Admin | No |
| 5 | Photo preview | A good photo previews, and closing without saving keeps the old photo | Admin | No |
| 6 | Description edit | Save description only turns on after a change, and closing without saving keeps the old text | Admin | No |
| 7 | Delete confirmation | Delete asks first, and Cancel keeps the service | Admin | No |
| 8 | No name | "Please enter a service name." shows | Admin | No |
| 9 | Duplicate name | An existing name in capitals shows "A service named "…" already exists." | Admin | No |
| 10 | No photo | "Please choose a photo for the new service." shows | Admin | No |
| 11 | Bad photo | The file type error shows and the photo is cleared | Admin | No |
| 12 | Full flow | Adds a service, edits its description, hides it, replaces its photo, then deletes it | Admin | **Yes (opt-in)** |

### Why most tests don't save

The tests use the real Supabase project, and every service in it shows on the live site. So every test except 12 either only looks at the popup or uses a bad value that the popup's own checks stop before anything is sent. Test 7 also blocks all service and photo requests before it clicks Delete, and fails if the block isn't working, so a broken confirmation can't delete a real service. Successful saves, and the errors Supabase can return, are covered by the unit tests above, which fake Supabase.

Test 12 adds a service named `Selenium Test 253 …`, which is briefly visible on the live site, and deletes it at the end. If it stops early, delete any `Selenium Test 253` rows from the `services` table and their photos from the `service-images` bucket.
