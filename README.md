# FootFootage (Web)

Preview, tag, and rapidly rename any footage in a Chromium browser via Vite using the File System Access API. Choose **Player tagging** for the roster workflow or **Generic labeling** to append reusable labels such as `crowd`, `DJ`, and `static` without player data. Generic labels are remembered locally and autocomplete on later clips while preserving each original clip name/number.

## Run (Web / Vite)
- Requires a Chromium-based browser (Chrome/Edge) for the File System Access API
- npm install
- npm run web
- Open the printed localhost URL, then:
	- Click "Open Folder" to grant access to a folder of videos (top-level files only)
	- Use the tagging/rename flow
	- "Reveal in Finder/Explorer" is not available in web mode

Roster JSON is cached to localStorage in Web mode.

High-frame-rate 4K 10-bit S-Log3 files can always be organized and renamed. In-browser preview of their HEVC/H.264 media depends on the codecs exposed by the browser and operating system; when a codec cannot be decoded, the app keeps navigation and labeling controls available and shows a clear fallback message.
