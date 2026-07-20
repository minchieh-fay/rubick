

Cloudflare Workers and other workerd runtimes cannot open outbound WebSockets using the global
`WebSocket` constructor. To simplify connecting Realtime Agents from these environments, the
extensions package provides a dedicated transport that performs the `fetch()`-based upgrade
internally.


  This adapter is still in beta. You may run into edge case issues or bugs.
  Please report any issues via [GitHub
  issues](https://github.com/openai/openai-agents-js/issues) and we'll fix
  quickly. For Node.js-style APIs in Workers, consider enabling `nodejs_compat`.


## Setup



1. **Install the extensions package.**

   ```bash
   npm install @openai/agents-extensions
   ```

2. **Create a transport and attach it to your session.**

   

3. **Connect your `RealtimeSession`.**

   ```typescript
   await session.connect({ apiKey: 'your-openai-ephemeral-or-server-key' });
   ```



## Notes

- The Cloudflare transport uses `fetch()` with `Upgrade: websocket` under the hood and skips
  waiting for a socket `open` event, matching the workerd APIs.
- All `RealtimeSession` features (tools, guardrails, etc.) work as usual when using this transport.
- Use `DEBUG=openai-agents*` to inspect detailed logs during development.
