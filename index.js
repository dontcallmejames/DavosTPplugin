/**
 * Davos Touch Portal Plugin
 * Bridges Touch Portal actions to the Davos WebSocket gateway.
 */

const TouchPortalAPI = require('touchportal-api');
const WebSocket = require('ws');

const PLUGIN_ID = 'com_dontcallmejames_davos';

const STATES = {
  RESPONSE: `${PLUGIN_ID}_state_response`,
  STATUS:   `${PLUGIN_ID}_state_status`,
  THINKING: `${PLUGIN_ID}_state_thinking`,
};

const ACTIONS = {
  CHAT:     `${PLUGIN_ID}_action_chat`,
  SEARCH:   `${PLUGIN_ID}_action_search`,
  BRIEFING: `${PLUGIN_ID}_action_briefing`,
  CLEAR:    `${PLUGIN_ID}_action_clear`,
};

// â”€â”€ Config (overridden by TP settings) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let gatewayHost = '127.0.0.1';
let gatewayPort = 8080;

// â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let TPClient = null;
let gatewayWs = null;
let reconnectTimer = null;
let pendingMessageId = null;

// â”€â”€ Touch Portal client setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function startTP() {
  TPClient = new TouchPortalAPI.Client();

  TPClient.on('Info', (data) => {
    console.log('[TP] Connected to Touch Portal');
    connectGateway();
  });

  TPClient.on('Settings', (settings) => {
    for (const s of settings) {
      if (s.name === 'Gateway Host' && s.value) gatewayHost = s.value.trim();
      if (s.name === 'Gateway Port' && s.value) gatewayPort = parseInt(s.value.trim(), 10) || 8080;
    }
    console.log(`[TP] Settings updated â€” gateway: ws://${gatewayHost}:${gatewayPort}`);
    // Reconnect with new settings
    if (gatewayWs) {
      gatewayWs.terminate();
    }
    connectGateway();
  });

  TPClient.on('Action', (data) => {
    const actionId = data.actionId;
    console.log(`[TP] Action: ${actionId}`);

    if (actionId === ACTIONS.CLEAR) {
      TPClient.stateUpdate(STATES.RESPONSE, '');
      return;
    }

    if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) {
      console.warn('[TP] Gateway not connected, cannot send action');
      TPClient.stateUpdate(STATES.RESPONSE, '[Davos is not connected]');
      return;
    }

    if (actionId === ACTIONS.CHAT) {
      const message = getDataValue(data, `${PLUGIN_ID}_action_chat_message`);
      if (!message) return;
      sendToGateway(message);
    }

    else if (actionId === ACTIONS.SEARCH) {
      const query = getDataValue(data, `${PLUGIN_ID}_action_search_query`);
      if (!query) return;
      sendToGateway(`Search the web for: ${query}`);
    }

    else if (actionId === ACTIONS.BRIEFING) {
      sendToGateway('Give me my morning briefing.');
    }
  });

  TPClient.on('disconnected', () => {
    console.log('[TP] Disconnected from Touch Portal â€” shutting down');
    process.exit(0);
  });

  TPClient.connect({ pluginId: PLUGIN_ID });
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getDataValue(actionData, dataId) {
  if (!actionData.data) return '';
  const item = actionData.data.find(d => d.id === dataId);
  return item ? item.value : '';
}

function setStatus(status) {
  if (!TPClient) return;
  TPClient.stateUpdate(STATES.STATUS, status);
}

function setThinking(thinking) {
  if (!TPClient) return;
  TPClient.stateUpdate(STATES.THINKING, thinking ? 'true' : 'false');
  if (thinking) setStatus('Thinking...');
}

// â”€â”€ Davos gateway WebSocket â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function connectGateway() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const url = `ws://${gatewayHost}:${gatewayPort}`;
  console.log(`[Gateway] Connecting to ${url}`);

  try {
    gatewayWs = new WebSocket(url);
  } catch (err) {
    console.error(`[Gateway] Failed to create WebSocket: ${err.message}`);
    scheduleReconnect();
    return;
  }

  gatewayWs.on('open', () => {
    console.log('[Gateway] Connected');
    setStatus('Connected');
    setThinking(false);
  });

  gatewayWs.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Gateway sends: { type: 'chat', message: '...', thinking: bool, done: bool }
    if (msg.type === 'chat') {
      if (msg.thinking) {
        setThinking(true);
      } else {
        setThinking(false);
        setStatus('Connected');
        if (msg.message) {
          // Strip markdown bold/italic for TP display
          const clean = msg.message
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .trim();
          if (clean) {
            TPClient.stateUpdate(STATES.RESPONSE, clean);
          }
        }
      }
    }

    // Handle status updates
    if (msg.type === 'status') {
      // Could surface model name etc. in the future
    }
  });

  gatewayWs.on('close', () => {
    console.log('[Gateway] Disconnected');
    setStatus('Disconnected');
    setThinking(false);
    scheduleReconnect();
  });

  gatewayWs.on('error', (err) => {
    console.error(`[Gateway] Error: ${err.message}`);
    // close event will fire after error
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  console.log('[Gateway] Reconnecting in 10s...');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectGateway();
  }, 10000);
}

function sendToGateway(message) {
  if (!gatewayWs || gatewayWs.readyState !== WebSocket.OPEN) {
    TPClient.stateUpdate(STATES.RESPONSE, '[Not connected to Davos]');
    return;
  }
  setThinking(true);
  gatewayWs.send(JSON.stringify({ type: 'chat', message }));
}

// â”€â”€ Entry point â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
console.log('[Davos TP Plugin] Starting...');
startTP();
