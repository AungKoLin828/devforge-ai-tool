# Codevia AI Local Agent

The agent is a separate local process. It is intentionally bound to `127.0.0.1` and only operates inside `CODEVIA_WORKSPACE`.

## Run

```bash
npm install
set CODEVIA_AGENT_TOKEN=replace-me
set CODEVIA_WORKSPACE=C:\CodeviaAI
npm run agent:dev
```

Never expose the agent port to the public network. In a later native installer, replace the environment token with a device-pairing secret and OS-level permissions.
