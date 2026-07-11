# App Shell Migration Plan

1. Foundation: App Shell, navigation registry, hash router, command palette and local UI state.
2. Dashboard: home, all tools, favorites, recent and settings views.
3. Workspace migration: move the existing platform section into the shell and route tools to it.
4. Module migration: convert one tool group at a time to lazy mounted views.
5. Quality: accessibility, keyboard flows, mobile drawer, reduced motion and performance cleanup.

## Initial route mapping

| Existing capability | New route group |
| --- | --- |
| Platform tools | `#/tools` and `#/create/*` |
| AI and Creator tools | `#/create/*` |
| Project, automation and cloud | `#/work/*` |
| Chat, community, notifications | `#/communication/*` |
| Analytics and reports | `#/analytics` |
| Learning and Wiki | `#/learn/*` |
| User profile and security | `#/settings/*` |

The first App Shell release keeps existing tool implementations in place. Lazy per-tool mounting is the next migration step after route stability is verified.
