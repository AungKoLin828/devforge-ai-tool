# DevForge Local Agent

The agent is a separate local process. It is intentionally bound to `127.0.0.1` and only operates inside `DEVFORGE_WORKSPACE`.

## Run

```bash
npm install
set DEVFORGE_AGENT_TOKEN=replace-me
set DEVFORGE_WORKSPACE=C:\DevForge
npm run agent:dev
```

Never expose the agent port to the public network. In a later native installer, replace the environment token with a device-pairing secret and OS-level permissions.
