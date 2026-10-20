# Rubick

Rubick is an HTTP skill registry and router for independently running services. Its skill metadata comes from registered child services; skill details are fetched from the owning service on demand. Reverse proxies provide public ingress and access control.

## Run

```sh
cargo run -p rubick -- --config rubick/config.toml
```

The Rubick service keeps its configuration at [rubick/config.toml](rubick/config.toml). Edit `[common].port` to change the listening port, and set `[common].domain` to the public base URL used in the generated Rubick Skill. Rubick requires the selected configuration file to exist. Its external Skill file is `rubick/SKILL.md`; it is read at request time and is not compiled into the binary.

## API

- `GET /api/skill` returns Rubick's own entry Skill.
- `GET /api/skills` lists metadata for registered child skills.
- `GET /api/skills/{rubick_skill_id}` forwards the request to the child service that owns the skill and returns its full Markdown.
- `POST /api/works/register` registers or replaces a child service and returns its `registry_epoch`.
- `POST /api/works/heartbeat` refreshes a registration or requests re-registration when its epoch is stale.

See [configuration](doc/configuration.md) and the [HTTP API protocol](doc/http-api.md) for request and response formats.
