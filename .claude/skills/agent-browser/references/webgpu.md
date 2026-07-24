# WebGPU

Screenshots and video of WebGPU pages (three.js `WebGPURenderer`, Babylon.js, raw WebGPU) in headless Chrome. Without setup this is a silent failure: the page loads, the screenshot succeeds, and the canvas is black.

## Quick start

```bash
agent-browser --webgpu open https://my-webgpu-app.example.com
# wait for the app to render (see "Timing" below)
agent-browser screenshot app.png
```

`--webgpu` (or `AGENT_BROWSER_WEBGPU=1`, or `"webgpu": true` in agent-browser.json) applies a launch preset:

- everywhere: `--enable-unsafe-webgpu` (WebGPU is hidden in headless/blocklisted environments by default)
- Linux only: `--enable-features=Vulkan --use-angle=vulkan --use-vulkan=swiftshader --use-webgpu-adapter=swiftshader --disable-vulkan-surface` — routes WebGPU through SwiftShader's software Vulkan, so it works with no GPU (containers, CI)

macOS uses the hardware Metal backend; Windows uses D3D. Nothing extra to install on either.

## Platform matrix (verified)

| Platform | WebGPU rendering (headless) | Screenshots of WebGPU canvases                                                                  |
| -------- | --------------------------- | ----------------------------------------------------------------------------------------------- |
| macOS    | works                       | works headless                                                                                  |
| Windows  | works (hardware D3D)        | **headless captures black** — use `--headed` on a logged-in desktop                             |
| Linux    | works (SwiftShader Vulkan)  | headless capture not supported upstream — add `--headed` (virtual display starts automatically) |

The Windows/Linux screenshot gap is an upstream headless-Chrome limitation: WebGPU canvas _presentation_ never reaches the headless compositor, even though rendering itself works (verified by pixel readback). It is not an agent-browser or flag problem — no known flag combination fixes it. Rendering, `eval`-based pixel readbacks, and compute all work headless everywhere.

On Linux, `--headed` is all you need even on displayless servers and containers: when no `DISPLAY` is set and Xvfb is installed (`apt-get install -y xvfb`), agent-browser starts a private virtual display for the browser and tears it down with it. Set `AGENT_BROWSER_NO_XVFB=1` to opt out.

```bash
agent-browser --webgpu --headed open https://my-webgpu-app.example.com
agent-browser screenshot app.png   # real WebGPU pixels, no display hardware
```

On Windows, the session must run headed in a logged-in desktop session (an ssh/Session-0 context is not enough — schedule the launch on the interactive desktop, e.g. `schtasks /IT`, then drive it from anywhere).

## Verify the pipeline

```bash
agent-browser doctor --webgpu
```

This launches a scratch session with the preset and pixel-checks two stages separately:

1. **render** — requests an adapter (with retries; a cold Chrome returns null while the GPU process starts), clears an offscreen texture to red through a real render pass, and reads the buffer back. Proves WebGPU works at all, and reports the adapter (e.g. `nvidia ampere`, `apple metal-3`, `google swiftshader`).
2. **screenshot** — decodes an actual screenshot of a presenting canvas. Proves the capture path. Expected to fail headless on Windows/Linux (see matrix); the failure message says so and points at `--headed`.

Add `--headed` (`agent-browser doctor --webgpu --headed`) to validate the capture path itself — on displayless Linux the probe starts its own Xvfb, so both checks should pass.

## Linux / containers / CI

The SwiftShader Vulkan path needs the system Vulkan loader and Mesa ICD. Without them `requestAdapter()` returns null (or fails with "A valid external Instance reference no longer exists"):

```bash
apt-get install -y libvulkan1 mesa-vulkan-drivers
```

Container recipe (Debian/Ubuntu base; xvfb needed only for the screenshot path). Verified with both Chrome for Testing and Debian's `chromium` package (set `AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium` for the latter — useful on ARM64, where Chrome for Testing has no Linux builds):

```dockerfile
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y \
    ca-certificates libvulkan1 mesa-vulkan-drivers xvfb xauth \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g agent-browser \
    && agent-browser install   # downloads Chrome for Testing
```

No real GPU or `/dev/dri` is required. To prefer a real GPU on a Linux machine that has working hardware Vulkan, override both the Vulkan driver and the adapter — the preset pins `--use-vulkan=swiftshader`, so overriding only the adapter still enumerates SwiftShader (user `--args` win over the preset):

```bash
agent-browser --webgpu --args "--use-vulkan=native,--use-webgpu-adapter=default" open ...
```

## Secure contexts

`navigator.gpu` only exists in secure contexts. `https://`, `http://localhost`, and `file://` qualify; a plain `http://` LAN address or `data:` URL does not — WebGPU will be `undefined` there no matter which flags are set.

## Timing: don't screenshot too early

WebGPU apps initialize asynchronously. A screenshot taken at `load` captures a blank canvas with no error anywhere. In particular:

- **three.js `WebGPURenderer`**: `renderer.init()` is async; the first frame lands only after it resolves. Also note three.js **silently falls back to WebGL2** when it can't get a WebGPU adapter — the page "works" but you're not testing WebGPU (and on old setups the WebGL fallback itself may be black).
- Wait for an app-specific signal before capturing: a canvas with content, a "ready" DOM marker, or simply a rendered-frame check:

```bash
agent-browser wait --fn "window.__appReady === true"
# or generically: give the render loop a frame or two
agent-browser eval "new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"
agent-browser screenshot app.png
```

To check which backend a three.js app actually got:

```bash
agent-browser eval "document.querySelector('canvas').getContext('webgpu') ? 'webgpu' : 'webgl-fallback'"
```

## Reading pixels back inside the page

If you `eval` your own WebGPU readback, don't snapshot the canvas (`drawImage(webgpuCanvas, ...)`) — it depends on presentation timing and reads transparent black on Windows even when rendering works. Render to an offscreen texture and read it back deterministically:

```js
const tex = device.createTexture({
    size: [w, h],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
});
// ...render to tex, then:
encoder.copyTextureToBuffer({ texture: tex }, { buffer, bytesPerRow }, [w, h]);
device.queue.submit([encoder.finish()]);
await buffer.mapAsync(GPUMapMode.READ);
```

This works headless on every platform (it's how `doctor --webgpu` proves rendering).

## Performance expectations

SwiftShader is a CPU rasterizer. Simple scenes render fine; heavy three.js scenes are single-digit FPS. For screenshots that's usually irrelevant; for smooth video capture of complex scenes, use hardware (macOS/Windows, or Linux with `--use-vulkan=native,--use-webgpu-adapter=default` and real Vulkan drivers).

--- templates/authenticated-session.sh ---

#!/bin/bash

# Template: Authenticated Session Workflow

# Purpose: Login once, save state, reuse for subsequent runs

# Usage: ./authenticated-session.sh <login-url> [state-file]

#

# RECOMMENDED: Use the auth vault instead of this template:

# echo "<pass>" | agent-browser auth save myapp --url <login-url> --username <user> --password-stdin

# agent-browser auth login myapp

# The auth vault stores credentials securely and the LLM never sees passwords.

#

# Environment variables:

# APP_USERNAME - Login username/email

# APP_PASSWORD - Login password

#

# Two modes:

# 1. Discovery mode (default): Shows form structure so you can identify refs

# 2. Login mode: Performs actual login after you update the refs

#

# Setup steps:

# 1. Run once to see form structure (discovery mode)

# 2. Update refs in LOGIN FLOW section below

# 3. Set APP_USERNAME and APP_PASSWORD

# 4. Delete the DISCOVERY section

set -euo pipefail

LOGIN_URL="${1:?Usage: $0 <login-url> [state-file]}"
STATE_FILE="${2:-./auth-state.json}"

echo "Authentication workflow: $LOGIN_URL"

# ================================================================

# SAVED STATE: Skip login if valid saved state exists

# ================================================================

if [[-f "$STATE_FILE"]]; then
echo "Loading saved state from $STATE_FILE..."
    if agent-browser --state "$STATE_FILE" open "$LOGIN_URL" 2>/dev/null; then
agent-browser wait --load networkidle

        CURRENT_URL=$(agent-browser get url)
        if [[ "$CURRENT_URL" != *"login"* ]] && [[ "$CURRENT_URL" != *"signin"* ]]; then
            echo "Session restored successfully"
            agent-browser snapshot -i
            exit 0
        fi
        echo "Session expired, performing fresh login..."
        agent-browser close 2>/dev/null || true
    else
        echo "Failed to load state, re-authenticating..."
    fi
    rm -f "$STATE_FILE"

fi

# ================================================================

# DISCOVERY MODE: Shows form structure (delete after setup)

# ================================================================

echo "Opening login page..."
agent-browser open "$LOGIN_URL"
agent-browser wait --load networkidle

echo ""
echo "Login form structure:"
echo "---"
agent-browser snapshot -i
echo "---"
echo ""
echo "Next steps:"
echo " 1. Note the refs: username=@e?, password=@e?, submit=@e?"
echo " 2. Update the LOGIN FLOW section below with your refs"
echo " 3. Set: export APP_USERNAME='...' APP_PASSWORD='...'"
echo " 4. Delete this DISCOVERY MODE section"
echo ""
agent-browser close
exit 0

# ================================================================

# LOGIN FLOW: Uncomment and customize after discovery

# ================================================================

# : "${APP_USERNAME:?Set APP_USERNAME environment variable}"

# : "${APP_PASSWORD:?Set APP_PASSWORD environment variable}"

#

# agent-browser open "$LOGIN_URL"

# agent-browser wait --load networkidle

# agent-browser snapshot -i

#

# # Fill credentials (update refs to match your form)

# agent-browser fill @e1 "$APP_USERNAME"

# agent-browser fill @e2 "$APP_PASSWORD"

# agent-browser click @e3

# agent-browser wait --load networkidle

#

# # Verify login succeeded

# FINAL_URL=$(agent-browser get url)

# if [["$FINAL_URL" == *"login"*]] || [["$FINAL_URL" == *"signin"*]]; then

# echo "Login failed - still on login page"

# agent-browser screenshot /tmp/login-failed.png

# agent-browser close

# exit 1

# fi

#

# # Save state for future runs

# echo "Saving state to $STATE_FILE"

# agent-browser state save "$STATE_FILE"

# echo "Login successful"

# agent-browser snapshot -i

--- templates/capture-workflow.sh ---

#!/bin/bash

# Template: Content Capture Workflow

# Purpose: Extract content from web pages (text, screenshots, PDF)

# Usage: ./capture-workflow.sh <url> [output-dir]

#

# Outputs:

# - page-full.png: Full page screenshot

# - page-structure.txt: Page element structure with refs

# - page-text.txt: All text content

# - page.pdf: PDF version

#

# Optional: Load auth state for protected pages

set -euo pipefail

TARGET_URL="${1:?Usage: $0 <url> [output-dir]}"
OUTPUT_DIR="${2:-.}"

echo "Capturing: $TARGET_URL"
mkdir -p "$OUTPUT_DIR"

# Optional: Load authentication state

# if [[-f "./auth-state.json"]]; then

# echo "Loading authentication state..."

# agent-browser state load "./auth-state.json"

# fi

# Navigate to target

agent-browser open "$TARGET_URL"
agent-browser wait --load networkidle

# Get metadata

TITLE=$(agent-browser get title)
URL=$(agent-browser get url)
echo "Title: $TITLE"
echo "URL: $URL"

# Capture full page screenshot

agent-browser screenshot --full "$OUTPUT_DIR/page-full.png"
echo "Saved: $OUTPUT_DIR/page-full.png"

# Get page structure with refs

agent-browser snapshot -i > "$OUTPUT_DIR/page-structure.txt"
echo "Saved: $OUTPUT_DIR/page-structure.txt"

# Extract all text content

agent-browser get text body > "$OUTPUT_DIR/page-text.txt"
echo "Saved: $OUTPUT_DIR/page-text.txt"

# Save as PDF

agent-browser pdf "$OUTPUT_DIR/page.pdf"
echo "Saved: $OUTPUT_DIR/page.pdf"

# Optional: Extract specific elements using refs from structure

# agent-browser get text @e5 > "$OUTPUT_DIR/main-content.txt"

# Optional: Handle infinite scroll pages

# for i in {1..5}; do

# agent-browser scroll down 1000

# agent-browser wait 1000

# done

# agent-browser screenshot --full "$OUTPUT_DIR/page-scrolled.png"

# Cleanup

agent-browser close

echo ""
echo "Capture complete:"
ls -la "$OUTPUT_DIR"

--- templates/form-automation.sh ---

#!/bin/bash

# Template: Form Automation Workflow

# Purpose: Fill and submit web forms with validation

# Usage: ./form-automation.sh <form-url>

#

# This template demonstrates the snapshot-interact-verify pattern:

# 1. Navigate to form

# 2. Snapshot to get element refs

# 3. Fill fields using refs

# 4. Submit and verify result

#

# Customize: Update the refs (@e1, @e2, etc.) based on your form's snapshot output

set -euo pipefail

FORM_URL="${1:?Usage: $0 <form-url>}"

echo "Form automation: $FORM_URL"

# Step 1: Navigate to form

agent-browser open "$FORM_URL"
agent-browser wait --load networkidle

# Step 2: Snapshot to discover form elements

echo ""
echo "Form structure:"
agent-browser snapshot -i

# Step 3: Fill form fields (customize these refs based on snapshot output)

#

# Common field types:

# agent-browser fill @e1 "John Doe" # Text input

# agent-browser fill @e2 "user@example.com" # Email input

# agent-browser fill @e3 "SecureP@ss123" # Password input

# agent-browser select @e4 "Option Value" # Dropdown

# agent-browser check @e5 # Checkbox

# agent-browser click @e6 # Radio button

# agent-browser fill @e7 "Multi-line text" # Textarea

# agent-browser upload @e8 /path/to/file.pdf # File upload

#

# Uncomment and modify:

# agent-browser fill @e1 "Test User"

# agent-browser fill @e2 "test@example.com"

# agent-browser click @e3 # Submit button

# Step 4: Wait for submission

# agent-browser wait --load networkidle

# agent-browser wait --url "\*\*/success" # Or wait for redirect

# Step 5: Verify result

echo ""
echo "Result:"
agent-browser get url
agent-browser snapshot -i

# Optional: Capture evidence

agent-browser screenshot /tmp/form-result.png
echo "Screenshot saved: /tmp/form-result.png"

# Cleanup

agent-browser close
echo "Done"
