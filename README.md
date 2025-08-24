# FootFootage

Preview, tag, and rapidly rename footage. Works in Electron and in a Chromium browser via Vite using the File System Access API.

## Run (Electron)
- npm install
- npm run dev

## Run (Web / Vite)
- Requires a Chromium-based browser (Chrome/Edge) for the File System Access API
- npm install
- npm run web
- Open the printed localhost URL, then:
	- Click "Open Folder" to grant access to a folder of videos (top-level files only)
	- Use the same tagging/rename flow as Electron
	- "Reveal in Finder/Explorer" is not available in web mode

Roster JSON is cached to app data in Electron and to localStorage in Web mode.
