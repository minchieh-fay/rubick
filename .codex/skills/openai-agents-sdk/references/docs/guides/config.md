

This page covers **SDK-wide defaults** that you usually set once during app startup, such as the
default OpenAI client, transport, tracing export key, and debug logging behavior. These settings
apply process-wide by default, so this is the right place for universal configuration rather than
per-agent or per-run tuning.

If you need to configure a specific `Agent`, `Runner`, or `run()` call instead, see:

- [Running Agents](/openai-agents-js/guides/running-agents) for `Runner` and per-run options.
- [Models](/openai-agents-js/guides/models) for agent-level and runner-level model settings.
- [Tracing](/openai-agents-js/guides/tracing) for run-specific tracing configuration and exporter behavior.

## OpenAI client and transport

### API keys and clients

By default the SDK resolves `OPENAI_API_KEY` lazily when it needs to create an OpenAI client. If setting the environment variable is not possible, call `setDefaultOpenAIKey()` manually.



You may also pass your own `OpenAI` client instance. The SDK will otherwise create one automatically using the default key.



### API selection

Finally you can switch between the Responses API and the Chat Completions API.



### Responses transport

If you are using the Responses API, you can also choose the OpenAI provider transport. The default is HTTP.



Use `setOpenAIResponsesTransport('websocket')` to enable the WebSocket transport and `setOpenAIResponsesTransport('http')` to switch back. If you route websocket traffic through a proxy or gateway, set `OPENAI_WEBSOCKET_BASE_URL` (or configure `websocketBaseURL` on your `OpenAIProvider`).

This process-wide default only affects models that are later resolved through the default OpenAI provider. If you pass a concrete `Model` instance or a custom `modelProvider`, configure the transport there instead. See the [Models guide](/openai-agents-js/guides/models#responses-websocket-transport).

## Observability and debugging

### Tracing

Tracing is enabled by default in supported server runtimes. It is disabled by default in browsers
and when `NODE_ENV=test`.

By default trace export uses the same OpenAI key from the section above.

A separate key may be set via `setTracingExportApiKey()`:



Tracing can also be disabled entirely:



If you’d like to learn more about the tracing feature, please check out [Tracing guide](/openai-agents-js/guides/tracing).

### Debug logging

The SDK uses the [`debug`](https://www.npmjs.com/package/debug) package for debug logging. Set the `DEBUG` environment variable to `openai-agents*` to see verbose logs.

```bash
export DEBUG=openai-agents*
```

To log session persistence activity, set `OPENAI_AGENTS__DEBUG_SAVE_SESSION=1`.

You can obtain a namespaced logger for your own modules using `getLogger(namespace)` from `@openai/agents`.



#### Sensitive data in logs

Certain logs may contain user data. Disable them by setting these environment variables.

To disable logging LLM inputs and outputs:

```bash
export OPENAI_AGENTS_DONT_LOG_MODEL_DATA=1
```

To disable logging tool inputs and outputs:

```bash
export OPENAI_AGENTS_DONT_LOG_TOOL_DATA=1
```
