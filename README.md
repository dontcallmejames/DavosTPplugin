# Davos Touch Portal Plugin

Touch Portal plugin that connects to the Davos AI assistant gateway and lets you trigger actions and display responses on your Stream Deck / Touch Portal layout.

## Actions

| Action | Description |
|--------|-------------|
| **Send Message to Davos** | Send any text message and get a response |
| **Web Search via Davos** | Ask Davos to search the web |
| **Morning Briefing** | Trigger a morning briefing |
| **Clear Last Response** | Reset the response state |

## States

| State | Description |
|-------|-------------|
| **Davos Last Response** | The most recent text response from Davos |
| **Davos Connection Status** | `Connected` / `Disconnected` / `Thinking...` |
| **Davos Is Thinking** | `true` / `false` â€” use for button animations |

## Events

- **Davos Connection Changed** â€” triggers on connect/disconnect
- **Davos Thinking Changed** â€” triggers when Davos starts/stops processing

## Setup

### Requirements
- Davos gateway must be running (`npm start` in the my-assistant folder)
- Node.js 18+ (or bundle node.exe into the .tpp, see Packaging)

### Settings (in Touch Portal)
- **Gateway Host** â€” default `127.0.0.1`
- **Gateway Port** â€” default `8080`

### Development / Local Run

```bash
npm install
npm start
```

### Packaging as .tpp

```bash
npm install
node scripts/package.js
```

This creates `DavosTPplugin.tpp` in the project root. Import it into Touch Portal via **Settings â†’ Plug-ins â†’ Import**.

The packager copies `node.exe` from your current Node.js install into the bundle so Touch Portal can run the plugin standalone.

## Project Structure

```
DavosTPplugin/
â”œâ”€â”€ entry.tp          # Plugin descriptor (Touch Portal reads this)
â”œâ”€â”€ index.js          # Plugin logic (WebSocket bridge)
â”œâ”€â”€ package.json
â”œâ”€â”€ scripts/
â”‚   â””â”€â”€ package.js    # .tpp packager
â””â”€â”€ README.md
```

## How It Works

1. Plugin connects to Touch Portal via the `touchportal-api` socket
2. Plugin connects to Davos gateway via WebSocket (`ws://127.0.0.1:8080`)
3. When a TP action fires, it sends a chat message to the gateway
4. Gateway streams the response back; plugin updates the TP state with the result
5. Auto-reconnects to gateway every 10s if disconnected
