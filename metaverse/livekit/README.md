# LiveKit

The SFU that carries video and audio in video-enabled spaces (currently the Virtual Office).
Each space is one LiveKit room, named after the space id.
Clients get a room-scoped access token from `POST /api/v1/livekit/token`, which the http server mints and which is also where the client learns the server URL.

## Running it locally

```sh
docker compose -f metaverse/livekit/docker-compose.yml up -d
```

That serves the signal websocket on `ws://localhost:7880`, which is what `apps/http` points at by default.
Nothing else needs configuring in dev: the credentials in `livekit.yaml` (`devkey` / `devsecret...`) are the same ones `apps/http/config.ts` falls back to.

The full dev stack is postgres (`docker start metaverse-test-db`), this container, and then `bun run dev` in `metaverse/`.

## TURN, and why it is here

Media normally goes straight from the browser to the SFU over UDP.
Some networks refuse that - strict corporate or campus firewalls, a few mobile carriers - and those clients can only get through if the media is relayed for them.
That relay is TURN.

LiveKit has a TURN server built in, so there is no separate coturn to deploy.
It hands each participant TURN credentials as part of the join response, and the client falls back to the relay on its own.
Neither the app nor the token endpoint has any part in this, which is why enabling TURN is a config change and nothing more.

`livekit.yaml` enables TURN over **UDP** (port 3478).
TURN over **TLS** is the variant that actually matters in production, because it is what gets through firewalls that only allow outbound TLS - but it needs a real domain and a real certificate, so it is commented out until this is deployed.

## Deploying

1. Point a DNS A record at the server, e.g. `turn.<your-domain>`.
2. Get a certificate for that name (Let's Encrypt) and mount it into the container.
3. In `livekit.yaml`: uncomment `domain`, `cert_file`, `key_file` and `tls_port`, and set `rtc.use_external_ip: true` so the SFU advertises its public address rather than a NAT one.
4. Replace the `keys:` block with real credentials. The secret must be at least 32 characters.
5. Open inbound `443` or `7880` (signal), `7881/tcp`, `3478/udp`, `5349/tcp` (TURN/TLS) and the UDP media range.
6. Set `LIVEKIT_URL` (a `wss://` URL), `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` on the http server.

The dev credentials in this directory are public and belong in dev only.

## Checking that the relay works

TURN only engages when a direct path is impossible, so it is invisible in normal use and easy to break without noticing.
To force it, make the client relay-only, which bans host and server-reflexive candidates outright, and confirm media still arrives:

```js
// in useVideoChat, temporarily:
new Room({ rtcConfig: { iceTransportPolicy: "relay" } });
```

Then confirm the path really is a relayed one, by finding the nominated candidate pair in `getStats()` and checking its local candidate has `candidateType === "relay"`.
If video plays and the candidate is a relay, TURN carried it.

One trap if you force the policy from outside the app (patching `RTCPeerConnection` in the page, say): `livekit-client` calls `setConfiguration()` after the join response to apply the ICE servers the server sends back, and that resets `iceTransportPolicy` to `all`.
The connection then quietly goes direct and the check passes for the wrong reason.
Pin the policy on `setConfiguration` too, or just use the `Room` option above.

This exercises TURN over UDP only.
TURN over TLS cannot be verified without the real domain and certificate from the deploy steps above.
