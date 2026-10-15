# Zendesk Messaging – Web SDK (Google Tag Manager template)

<img src="assets/icon.png" width="64" height="64" alt="" align="right">

A Google Tag Manager custom tag template for the **Zendesk Messaging Web Widget** (the `zE` Web SDK). It loads and controls the widget without Custom HTML, and it supports the whole public Web SDK except end-user authentication:

- every command and setting;
- all 22 events, pushed to the `dataLayer` with their details;
- Google Consent Mode;
- embedded mode;
- message delegates;
- the 2025–2026 additions: the Customization API, `sendMessage`, navigation, the Article Viewer events and the cited sources events.

> This is a community template. It is not affiliated with, endorsed by or supported by Zendesk or Google.

## Contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [The event bridge](#the-event-bridge)
- [dataLayer events](#datalayer-events)
- [Commands](#commands)
- [Consent](#consent)
- [Things to know](#things-to-know)
- [Not included](#not-included)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Features

| Area | Supported |
|---|---|
| Loading | Loads the snippet from the template, without a `<script id="ze-snippet">` on the page. Detects a snippet that is already on the page. Supports floating, embedded and deferred rendering. Can switch off the snippet's own error reporting. |
| Settings | `locale`, `zIndex`, `cookies`, `conversationTags`, `conversationFields`, `conversationMetadata`, `userMetadata`, `updateUser`, `behavior` |
| Appearance | Customization API: all 17 theme colors, styling preset, position (including automatic left for right-to-left locales), 25 more options, and extra JSON |
| Commands | open, close, toggle, show, hide, navigation, new conversation (in the widget or programmatic), `sendMessage`, `fetchConversations`, get config, update user, change locale, change cookies, voice call, reset, render |
| Delegates | `beforeMessageSent`: add metadata from static values, from dataLayer keys read at send time, and the page URL and title. `beforeMessageDisplay`: rename authors, and hide messages by their metadata. |
| Events | All 22 documented events, plus the results and errors of API calls, pushed to the `dataLayer` |
| Consent | Google Consent Mode → widget cookies `all` / `functional` / `none`. Changes apply live, and the widget can be loaded once consent is granted. |
| Experimental | Features that are in the current widget but not documented by Zendesk: a pre-conversation screen, a typing indicator, `isHideButtonVisible`, and the `formShown`, `formSubmitted` and `preConversationShown` events |

## Installation

**From the Community Template Gallery:** in Tag Manager, go to **Templates → Tag Templates → Search Gallery** and search for *Zendesk Messaging – Web SDK*.

**Manually:** download [`template.tpl`](template.tpl). Then go to **Templates → Tag Templates → New → ⋮ → Import** and save the template.

## Quick start

1. **Event bridge.** Create a Custom HTML tag with the contents of [`bridge/gtm-custom-html.html`](bridge/gtm-custom-html.html). Do not give it a trigger. See [the event bridge](#the-event-bridge) for why.
2. **Setup tag.** Create a tag of type *Zendesk Messaging – Web SDK* and choose **Setup**.
   - **Web Widget key:** in Zendesk Admin Center, go to Channels → Messaging and social → Messaging → your Web Widget → Installation, and copy the value after `?key=`.
   - **Trigger:** *Initialization – All Pages*. Use *Consent Initialization* when you use Consent Mode.
   - **Advanced Settings → Tag Sequencing:** *Fire a tag before*: the bridge tag from step 1.
3. **Command tags (optional).** For example, *Open the messaging window* on a click trigger, for a custom launcher or a "Chat with us" button.
4. **Existing snippet.** Remove a hard-coded Zendesk snippet from the site, or set **Load mode** to *Never load*.
5. **Test.** Check everything in Preview mode before you publish.

## The event bridge

Zendesk passes its event objects as class instances. GTM converts every value that a custom template receives from the page in strict mode, and that turns class instances into `undefined`. Without help, a template only knows *that* an event happened. It does not get the conversation id, the message role, the article id and so on.

The [event bridge](bridge/zendesk-gtm-bridge.js) is a 1 KB script. It registers the Zendesk listeners outside the sandbox and gives the template a plain copy of each event. It makes no network requests, stores nothing and creates only one global, `window.zendeskGtmBridge`.

Choose where it comes from in **Setup → Events → Event bridge**:

| Option | How |
|---|---|
| Custom HTML tag in this container (default) | Paste `bridge/gtm-custom-html.html` into a Custom HTML tag and fire it before the Setup tag with tag sequencing. No external host needed. |
| cdn.jsdelivr.net | The template loads the version pinned to this release from jsDelivr. Allow `https://cdn.jsdelivr.net` in your Content Security Policy. |
| Off | Events still fire, but with their name only. |

API responses, errors and delegate messages are plain objects and work without the bridge.

## dataLayer events

The event name is the prefix (default `zendesk_messaging.`) plus the event name in snake_case. For GA4-style names, set the prefix to `zendesk_`.

| Event | When |
|---|---|
| `zendesk_messaging.ready` | The widget API is ready (`zendesk.result.version`, `zendesk.result.config`) |
| `.open`, `.close`, `.show`, `.hide` | The widget's visibility changes |
| `.conversation_started`, `.conversation_opened`, `.conversation_clicked`, `.new_conversation_button_clicked` | Conversations |
| `.conversation_with_agent_requested`, `.conversation_agent_assigned` | Handover to a human agent |
| `.message_received`, `.messages_shown` | Messages (`message_role`, `message_source_type`) |
| `.unread_messages` | The unread count changed (`unread_count`) |
| `.proactive_message_displayed`, `.proactive_message_clicked` | Proactive messages (`proactive_message_id`, `campaign_id`) |
| `.postback_button_clicked` | Postback buttons (`action_name`) |
| `.conversation_extension_opened`, `.conversation_extension_displayed` | Conversation extensions (`url`) |
| `.article_clicked`, `.article_browser_clicked` | Help Center articles (`article_id`, `article_title`, `url`) |
| `.sources_opened`, `.sources_closed` | AI agent cited sources |
| `.conversation_created`, `.message_sent`, `.conversations_fetched`, `.config_loaded`, `.widget_reset`, `.rendered`, `.user_updated`, `.consent_updated` | Results of API calls |
| `.error` | A failed API call (`api`, `error_type`, `error_reason`, `error_message`) |

The details are in the `zendesk` object: `event_name`, `event_type`, `event_id`, `event_timestamp`, `conversation_id`, `conversation_status`, `message_id`, `message_role`, `message_source_type`, `message_received_at`, `messages_count`, `proactive_message_id`, `campaign_id`, `article_id`, `article_title`, `url`, `action_name`, `new_conversation_source`, `trigger`, `form_type`, `form_id`, `form_name`, `unread_count`, `api`, `error_type`, `error_reason`, `error_message`, `result` and `raw`.

Every key is present on every push. That way, a value from one event never carries over into the next one in GTM's data model.

The template also keeps a read-only state object in `window.__gtmZendesk`: `ready`, `version`, `isOpen`, `isShown`, `unreadCount`, `conversationId`, `conversationStatus`, `multiConvoEnabled`, `canUserCreateMoreConversations`, `launcherShape` and `cookies`.

## Commands

Commands that fire before the widget has loaded are queued, and they run in order.

| Command | Notes |
|---|---|
| Open / Close / Toggle / Show / Hide | *Open* can show the widget first, which is needed after hiding it on page load. |
| Navigate | Conversation list, most recent conversation, or a specific conversation. Needs multi-conversation mode. |
| New conversation | *In the widget* (`messenger:ui`) or *programmatic*. The programmatic mode supports a description, message metadata and the result in the dataLayer. |
| Send a message | Sends a message as the end user to the current or a given conversation, optionally with metadata. Combine it with the *Hide messages* delegate for hidden workflow messages. |
| Fetch conversations / Get configuration | The results are pushed to the dataLayer. |
| Update user / Change locale / Change cookie usage | |
| Voice call | Uses the 32-character `line_id` of a Talk digital line. |
| Reset | Resets the widget, then applies the Setup tag's tags, fields and metadata again. |
| Render | Renders in the containers of the Setup tag. Use it with the *Deferred* render mode, for example on an Element Visibility trigger. |

## Consent

With **Cookie usage → Follow Google Consent Mode**:

- `functionality_storage` granted → `functional`
- `functionality_storage` and `analytics_storage` granted → `all`

You choose what happens when functional storage is denied:

- load the widget with cookies `none`, which hides it;
- don't load the widget;
- load it with functional cookies anyway.

Consent updates are applied live, and the widget can be loaded as soon as consent is granted.

## Things to know

- **Conversation tags and fields** need Messaging Metadata (`conversationTicketMetadata`) on the Zendesk account. Zendesk applies them when a conversation starts or the end user sends a message. Zendesk lowercases tags and accepts at most 20.
- **Opening the widget:** `messenger:ui newConversation` and `navigation` do not open the widget by themselves. The template's *Open afterwards* options do that.
- **Customization:** one invalid value makes Zendesk reject the whole customization. The template validates colors and option values, and it skips invalid ones.
- **Embedded mode:** the containers must exist when the render runs. Do not mix floating and embedded mode on one page.
- **GTM limits:** templates cannot use globals that already exist on `window`, such as `open` or `document`. That is why there is no popup command and no page-direction detection. The automatic position follows the locale field.
- **Privacy:** the widget sends a page view for every URL change and follows the page's `<meta name="referrer">` policy. Mention Zendesk in your privacy notice.
- **CSP:** allow the hosts in [Zendesk's CSP guide](https://developer.zendesk.com/documentation/zendesk-web-widget-sdks/sdks/web/csp/), plus `https://cdn.jsdelivr.net` if the bridge comes from the CDN.

### How loading works

- GTM cannot set an `id` on a script, so there is no `#ze-snippet`. In that case `snippet.js` reads the key from `window.zE.s.src`, and the template sets that before it injects the snippet.
- The widget only installs its API when `window.zE === window.zEmbed`. The template creates the queue with `createArgumentsQueue` and aliases it with `aliasInWindow`.

## Not included

- **End-user authentication** (`loginUser`, `logoutUser`, `useSessionAuth`). Creating and refreshing JWTs belongs in the site's own code, not in a tag manager. Call these from your site; the template works alongside them. Zendesk clears conversation tags, fields and metadata on logout. To apply them again, fire a Setup tag with *Load the Zendesk Web Widget* unchecked on an event that your site pushes after logout.
- **Web Widget (Classic)** (`zE('webWidget', …)`).

## Development

Requirements: Node.js 20 or later, and Python 3 for the icon and the harness.

```bash
npm install
npm test          # lint the sandboxed code, build template.tpl, run the unit tests
npm run harness   # serve the repository on http://127.0.0.1:8787
```

| Path | What it is |
|---|---|
| `src/sandbox.js` | The template code (sandboxed JavaScript) |
| `src/parameters.mjs` | The fields (GTM allows at most 100, and the build checks this) |
| `src/permissions.mjs` | The permissions (the build checks GTM's key rules) |
| `src/info.json`, `assets/icon.png` | Template info and icon (`scripts/make-icon.py`) |
| `bridge/` | The event bridge, and the Custom HTML version of it, which is generated |
| `tests/unit/` | Unit tests, run in a GTM sandbox emulator with gtm.js conversion rules and a fake widget |
| `tests/harness/` | Runs the template code against the real widget: `tests/harness/index.html?key=<your key>` |
| `tests/gtm-tests.yaml` | Becomes the `___TESTS___` section that Tag Manager runs |
| `template.tpl` | Generated by `npm run build`; do not edit it by hand |

## Contributing

Issues and pull requests are welcome. Please:

- run `npm test` before you open a pull request;
- describe how you tested against a real widget;
- never include Web Widget keys, JWTs or customer data in issues, commits or test files.

## License

[Apache License 2.0](LICENSE). The Community Template Gallery requires this license.
