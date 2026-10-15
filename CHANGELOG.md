# Changelog

## 0.1.0 – 2026-10-15

- First version: Setup and Command tag types covering the full Zendesk Messaging Web SDK.
- Loads the snippet without `#ze-snippet` (key in `zE.s.src`), and keeps `zE === zEmbed`.
- Event bridge (`bridge/zendesk-gtm-bridge.js`, jsDelivr) so event payloads survive GTM's sandbox; without it events carry their name only.
- Consent Mode mapping, embedded and deferred rendering, delegates, all 22 events.
- End-user authentication (loginUser/logoutUser/useSessionAuth) is deliberately left to the site.
- Icon in the pluscloud icon family (Web Widget launcher bubble in a tag on pluscloud blue).
- Verified against Messaging Web Widget build `5eb6863`.
