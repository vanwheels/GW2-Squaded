import { asLikelyBuildFields, asLikelySquadCompFields } from '../share-validate'

/** Mirrors `share-resolve.ts`'s `StoredShare` (kept separate for the same "no shared module
 *  between these small internal shapes" reasoning as the rest of this Worker's duplicated types). */
export interface StoredShare {
  kind: 'build' | 'squadComp'
  data: unknown
  createdAt: string
}

/** Where a browser lands after `/releases/latest` redirects — used for the landing page's "don't
 *  have the app yet" link. Same repo `electron-builder.yml`'s `publish` block points
 *  electron-updater at. */
const DOWNLOAD_URL = 'https://github.com/vanwheels/GW2-Squaded/releases/latest'

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string)
}

interface ShareSummary {
  title: string
  subtitle: string
}

/** Reuses the same "likely shape" field extraction `/buildAdd`/`/squadAdd` already validate
 *  incoming share links against — good enough for a display-only summary, no need for a second,
 *  stricter parse just for this page. Falls back to a generic label for a share whose stored data
 *  doesn't look like a real build/squad comp (shouldn't happen for anything the bot itself wrote
 *  to `builds`/`squads`, but a share id can in principle point at any blob this Worker's public
 *  `POST /shares` endpoint ever accepted). */
function summarizeShare(share: StoredShare): ShareSummary {
  if (share.kind === 'build') {
    const fields = asLikelyBuildFields(share.data)
    return fields ? { title: fields.name, subtitle: fields.profession } : { title: 'GW2-Squaded build', subtitle: '' }
  }
  const fields = asLikelySquadCompFields(share.data)
  return fields ? { title: fields.name, subtitle: 'Squad composition' } : { title: 'GW2-Squaded squad', subtitle: '' }
}

/** Shared page chrome (theme-aware CSS, card shell) so the found/not-found pages look like one
 *  site. `nonce` gates the one inline `<script>` each page needs — see callers' `Content-Security-
 *  Policy` header, which only allows that exact nonce through. */
function pageShell(nonce: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="robots" content="noindex" />
<title>GW2-Squaded</title>
<style>
  :root {
    --bg: #fff3f9;
    --surface: #ffffff;
    --border: #f3cbe6;
    --text: #3a2030;
    --muted: #8c5c79;
    --accent: #a1558a;
    --accent-strong: #7a3b69;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #291e26;
      --surface: #382730;
      --border: #553b4c;
      --text: #f8e9f1;
      --muted: #c79bb7;
      --accent: #e3b3d0;
      --accent-strong: #cd83b2;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--bg);
    color: var(--text);
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .card {
    width: 100%;
    max-width: 420px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 28px;
    text-align: center;
  }
  .eyebrow {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 8px;
  }
  h1 {
    font-size: 22px;
    margin: 0 0 4px;
    word-break: break-word;
  }
  .subtitle {
    color: var(--muted);
    margin: 0 0 24px;
  }
  button, .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    border-radius: 8px;
    border: none;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    background: var(--accent);
    color: #1a1015;
  }
  button:hover, .btn:hover { background: var(--accent-strong); color: #fff; }
  #copy-link {
    width: 100%;
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    text-align: center;
  }
  .hint {
    margin-top: 10px;
    font-size: 13px;
    color: var(--muted);
    min-height: 1.2em;
  }
  .download {
    display: block;
    margin-top: 20px;
    font-size: 13px;
    color: var(--muted);
  }
  .download a { color: var(--accent-strong); }
</style>
</head>
<body>
${bodyHtml}
<script nonce="${nonce}">
(function () {
  var btn = document.getElementById('copy-btn')
  var hint = document.getElementById('hint')
  var input = document.getElementById('copy-link')
  if (!btn || !input) return
  btn.addEventListener('click', function () {
    input.select()
    var done = function () {
      hint.textContent = 'Copied — paste it into GW2-Squaded\\'s "Import from link" box.'
    }
    var failed = function () {
      hint.textContent = 'Couldn\\'t copy automatically — the link above is selected, press Ctrl/Cmd+C.'
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(input.value).then(done, failed)
    } else {
      try {
        document.execCommand('copy') ? done() : failed()
      } catch (e) {
        failed()
      }
    }
  })
})()
</script>
</body>
</html>`
}

/** The `GET /shares/:id/open` landing page — where a build/squad name's hyperlink on the Discord
 *  board goes, instead of straight to the raw `/shares/:id` JSON the desktop app's own import flow
 *  fetches. A masked Discord link can't run JS to write the clipboard on click, so this page is
 *  the "real" one-click copy: it shows what the share is, and a Copy button for the same share
 *  link (`/shares/:id`) `share-client.ts`'s "Import from link" box already accepts. Board-polish
 *  decision 2026-08-19, see docs/discord-bot.md — "auto-open straight into the app" is a separate,
 *  deferred feature (a custom URL protocol), not built here. */
export function renderShareLandingPage(shareId: string, share: StoredShare, publicOrigin: string, nonce: string): string {
  const { title, subtitle } = summarizeShare(share)
  const shareUrl = `${publicOrigin}/shares/${shareId}`
  const kindLabel = share.kind === 'build' ? 'Build' : 'Squad'

  const body = `<div class="card">
  <p class="eyebrow">GW2-Squaded ${kindLabel}</p>
  <h1>${escapeHtml(title)}</h1>
  ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ''}
  <button id="copy-btn" type="button">Copy link</button>
  <input id="copy-link" type="text" value="${escapeHtml(shareUrl)}" readonly />
  <p class="hint" id="hint">Paste the copied link into GW2-Squaded's "Import from link" box to open it.</p>
  <p class="download">Don't have GW2-Squaded yet? <a href="${DOWNLOAD_URL}">Download it here</a>.</p>
</div>`

  return pageShell(nonce, body)
}

/** A missing/expired share id (or a malformed one) still gets a real page, not a bare 404 JSON
 *  blob — this route is meant for a human clicking a Discord link, not a program. */
export function renderShareNotFoundPage(nonce: string): string {
  const body = `<div class="card">
  <p class="eyebrow">GW2-Squaded</p>
  <h1>Link not found</h1>
  <p class="subtitle">This share link doesn't exist, or the build/squad it pointed to has since been removed from the board.</p>
  <p class="download">Get GW2-Squaded here: <a href="${DOWNLOAD_URL}">${DOWNLOAD_URL}</a></p>
</div>`
  return pageShell(nonce, body)
}
