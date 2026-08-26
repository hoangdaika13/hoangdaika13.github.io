# Kim Liên Điện — Route & Scroll Inventory

Last source sync: 2026-08-26.

This inventory is derived from the navigation registry and route renderer in
`script.js`, plus the route-to-feature map in `performance-loader.js`. A route
family includes its registered child routes, not only its landing route.
`app-main` owns ordinary page scrolling unless the table explicitly names an
immersive/internal owner.

## Verification legend

- **Browser visual**: that exact route/view was rendered at the listed viewport
  and a screenshot exists. This does not prove every interaction or child route.
- **Browser end-scroll**: the sampled route was scrolled to its final content at
  the listed viewport. This does not extend to sibling routes in the family.
- **Prior browser sample**: verified during the earlier Kim Liên rollout, but not
  rerun in the current all-workspace browser sample set.
- **Contract only**: registration, load ownership, theme wiring or scroll rules
  are present in source/contracts; there is no direct browser claim.
- **Pending matrix**: no direct evidence yet for the full required viewport,
  zoom, keyboard, dialog, refresh and back/forward matrix.

The status of a family must never be read as proof that every hidden or nested
route in that family has been browser-tested.

| Route family | Product surface | Runtime/load owner | Scroll owner | Kim Liên layer | Verification |
|---|---|---|---|---|---|
| empty hash → `/home` | Điện Kim Liên | `kim-lien-home.js`; `home-critical` | `app-main` | Dedicated | Browser visual: 1440×900, 375×812; full matrix pending |
| Auth/login/register/recovery | Identity gateway | `auth-platform.js`, `kim-lien-auth.js` | `authGate` | Dedicated | Browser visual: 1440×900, 375×812; flows/matrix pending |
| Boot and route transition | Loading | `auth-platform.js`, `script.js` | Locked opaque overlay | Dedicated | Browser visual: transition at 375×812; timing/matrix pending |
| `/chat-ai/*` | HH Intelligence | `chat-ai-hub.js`; `chat-ai` | History + message stream | Dedicated + late universal | Browser visual: landing at 1440×900; mobile v20 history sheet geometry passed at 375×812; message-end scroll pending |
| `/create/*` | Sáng tạo | creative/platform modules; `creative`, `platform` | `app-main` or active editor stage | Creative/learning + universal | Contract only; pending matrix |
| `/draw/*` | Vẽ | `draw-studio.js`; `draw` | Internal editor | Creative/learning + universal | Contract only; pending matrix |
| `/music-ai/*` | Làm nhạc AI | music AI suite; `music` | `app-main` or studio timeline | Creative/learning + universal | Contract only; pending matrix |
| `/comic-motion-studio/*` | Comic Motion | comic motion runtime; `comic-motion` | Internal studio | Creative/learning + universal | Contract only; pending matrix |
| `/comic-reader/*` | Đọc truyện | comic reader runtime; `comic-reader` | Reader content | Creative/learning + universal | Contract only; pending matrix |
| `/media-design/*` | Media & Design | media production modules; `media` | `app-main` or active editor | Creative/learning + universal | Browser end-scroll: landing and `/media-design/media-core` at 375×812; Media Core palette and horizontal-overflow audits passed; remaining tools pending |
| `/graphic-design/*` (25 registered tools) | Thiết kế đồ họa | graphic design runtime; `graphic` | Internal editor on tool routes | Creative/learning + universal | Browser end-scroll: landing and `/graphic-design/vector` at 375×812; 24 other tool routes pending |
| `/davinci-resolve/*` | Tool/video production | DaVinci modules; `davinci` | Internal editor/timeline | Creative/learning + universal | Contract only; pending matrix |
| `/social-media-tools/*` | Social creator tools | social media runtime; `social-media-tools` | `app-main` | Creative/learning + universal | Contract only; pending matrix |
| `/google` | Google Center | `google-hub.js`; `google` | Results list | Operations + universal | Contract only; pending matrix |
| `/youtube` | YouTube Center | `youtube-hub.js`; `youtube` | Results/player layout | Operations + universal | Contract only; pending matrix |
| `/discord` | Discord Center | `discord-hub.js`; `discord` | Message stream | Operations + universal | Contract only; pending matrix |
| `/communication/*` (14 registered workspaces) | Giao tiếp | communication suite; `communication` | Active stream/list | Dedicated + late universal | Browser end-scroll: landing at 375×812; More sheet audit passed; Messenger v9 passed horizontal-overflow and final-message reachability; 12 unsampled workspaces remain |
| `/play/*` (10 registered spaces) | HH Play | HH Play runtime; `play` | `.hhp-stage-scroll` on landing; active game surface inside cartridges | Operations + universal | Browser end-scroll: landing at 375×812; computed-color audit found no sampled cosmic palette; nine child spaces pending |
| `/game/*` (9 registered spaces) | HH EonWild | EonWild runtime; `game` | Immersive game root | Operations chrome + neutral 3D viewport | Browser end-scroll: landing at 375×812; neutral renderer and Kim Liên chrome sampled; eight child spaces pending |
| `/cinema/*` | Phim | cinema runtime; `cinema` | Catalog/player | Operations + universal | Contract only; pending matrix |
| `/music/*` | Nhạc | open music runtime; `open-music` | Catalog/player | Operations + universal | Contract only; pending matrix |
| `/copyright/*` | Bản quyền | governance runtime; `open-media-governance` | `app-main` | Operations + universal | Contract only; pending matrix |
| `/fortune/*` | Xem bói | fortune runtime; `fortune` | `app-main` | Universal | Contract only; pending matrix |
| `/work/*` (7 registered centers) | Công việc | work center; `work` | `app-main` | Operations + universal | Browser end-scroll: landing at 375×812; six child centers pending |
| `/dev-tools/*` | DEV | developer suite; `dev` | `app-main` or code editor | Operations chrome + neutral code surface | Contract only; pending matrix |
| `/system/*`, `/tools/*` | Hệ thống & Tool | platform runtime; `platform` | `app-main` | Operations + universal | Contract only; pending matrix |
| `/favorites`, `/recent` | Bộ sưu tập cá nhân | app router; `platform` | `app-main` | Operations + universal | Contract only; pending matrix |
| `/learn/*` (7 registered spaces) | HH School | school runtime; `learning` | Main school content | Creative/learning + universal | Language Cockpit browser end-scroll: landing at 375×812; six child spaces pending |
| `/english/*` | HH English | English runtime; `english` | Active lesson content | Creative/learning + universal | Language Cockpit browser end-scroll: landing at 375×812; lesson/feature matrix pending |
| `/japanese/*` | HH Japanese | Japanese runtime; `japanese` | Active lesson content | Creative/learning + universal | Language Cockpit internal-scroller end reached at 375×812; lesson/feature matrix pending |
| `/chinese/*` | HH Chinese | Chinese runtime; `chinese` | Active lesson content | Creative/learning + universal | Language Cockpit internal-scroller end reached at 375×812; lesson/feature matrix pending |
| `/phat-phap/*` (24 registered spaces) | Trung tâm Phật Pháp | Phật Pháp runtime; `dharma` | Dharma main content | Dedicated | Prior browser sample: desktop + mobile; current full matrix pending |
| `/analytics/*` | Phân tích | insights runtime; `analytics` | `app-main` | Operations + universal | Contract only; pending matrix |
| `/admin/*`, `/analytics/admin-panel` | Admin Panel | admin runtime; `analytics`, `admin` | `app-main` | Operations + universal | Authorization contract only; browser permission flow pending |
| `/settings` | Cài đặt | settings runtime; `settings` | `app-main` | Operations + universal | Browser end-scroll: landing at 375×812; settings interactions and wider matrix pending |
| `/settings/account/*`, `/settings/user-dashboard`, `/settings/security-center` | Tài khoản & bảo mật | account runtime; `account` | `app-main` | Operations + universal | Contract only; pending matrix |
| `/remote/*` | Remote | remote runtime; `remote` | `app-main` | Universal | Contract only; pending matrix |
| `/support/*` | Ủng hộ nhà phát triển | support runtime; `support` | `app-main` | Universal | Contract only; pending matrix |

## Direct browser evidence in the repository

| Exact sample | Evidence | What it proves | What it does not prove |
|---|---|---|---|
| `/home`, 1440×900 | `artifacts/kim-lien-qa/after-home-desktop-1440x900.png` | Desktop home rendered with the approved shell | Other desktop sizes, zoom and all interactions |
| `/home`, end-scroll at 1440×900 | `artifacts/kim-lien-all-qa/home-desktop-end-1440x900.png` | Sampled desktop home reached its final capability cards and trust notice | Other desktop sizes, zoom and all interactions |
| `/home`, 375×812 | `artifacts/kim-lien-qa/after-home-mobile-375x812.png` | Mobile home rendered | Landscape, zoom and complete scroll matrix |
| Login, 1440×900 | `artifacts/kim-lien-qa/after-login-desktop-1440x900.png` | Desktop login rendered | Registration/recovery and full auth flows |
| Login, 375×812 | `artifacts/kim-lien-qa/after-login-mobile-375x812.png` | Mobile login rendered | Keyboard-open, landscape and zoom states |
| Route transition, 375×812 | `artifacts/kim-lien-qa/after-route-transition-mobile-375x812.png` | A mobile transition state rendered opaque | Every route transition and duration behaviour |
| First-visit privacy banner over login, 375×812 | `artifacts/kim-lien-all-qa/privacy-banner-mobile-375x812.png` | Live v5 audit: Kim Liên banner is opaque, readable and sits at z-index 10020 above the login gate at z-index 10000 | Preference actions, customization sheet, landscape and zoom matrix |
| `/chat-ai`, 1440×900 | `artifacts/kim-lien-all-qa/chat-ai-desktop-1440x900.png` | Chat landing, history column and composer use Kim Liên styling | Long history, long message stream and final-message reachability |
| `/chat-ai`, history sheet v20, 375×812 | `artifacts/kim-lien-all-qa/chat-ai-mobile-sheet-375x812.png` | Pre-v7 sheet geometry: fixed backdrop y=0–742; drawer y=72.17–738; bottom navigation y=744–812; title and mode rail did not overflow | The screenshot predates the v7 typography pass; drag-to-close, focus trap, scroll restoration and long message-stream reachability remain pending |
| `/chat-ai`, workspace v7, 375×812 | `artifacts/kim-lien-all-qa/chat-ai-mobile-v7-375x812.png` | Live audit: all four mode buttons are 79.75×44px with 14px labels; composer is 16px; document width is exactly 375px | History drawer geometry was not rerun after the typography change; long message-stream reachability remains pending |
| `/communication`, 375×812 | `artifacts/kim-lien-all-qa/communication-mobile-end-375x812.png` | Sampled landing content can reach its final section above bottom navigation | The 12 registered workspaces not sampled directly |
| `/communication`, More sheet, 375×812 | Live browser audit on 2026-08-26; no separate screenshot | More sheet geometry/scroll audit passed in the sampled state | Other sheet states, landscape, zoom and focus restoration |
| `/communication/messenger`, v9, 375×812 | Live browser audit on 2026-08-26; no separate screenshot | No horizontal overflow and the final message was reachable in the sampled conversation | Long histories, other conversations, landscape, zoom and full interaction matrix |
| `/media-design`, 375×812 | `artifacts/kim-lien-all-qa/media-design-mobile-end-375x812.png` | Landing catalog can reach its final card/footer above bottom navigation | Every Media & Design tool/editor |
| `/media-design/media-core`, 375×812 | `artifacts/kim-lien-all-qa/media-core-mobile-375x812.png` (overwritten after final override) | Mobile palette audit passed (`--mpp-accent: #e0b54f`, `--mpp-accent-2: #9b3d2a`, gold health ring); no horizontal overflow; internal main reached its end at `359 + 440 = 799` | Other tabs, actions, desktop sizes, landscape and zoom matrix |
| `/learn`, 375×812 | Live browser audit on 2026-08-26; no separate screenshot | Language Cockpit page scroller reached its end at `1518 + 752 = 2270` | Six child spaces, landscape, zoom and full interaction matrix |
| `/english`, 375×812 | `artifacts/kim-lien-all-qa/english-mobile-end-375x812.png` | Language Cockpit page scroller reached its end at `2356 + 752 = 3108` | Lesson routes, controls, landscape and zoom matrix |
| `/japanese`, 375×812 | Live browser audit on 2026-08-26; no separate screenshot | Internal language scroller reached its end at `3825 + 624 = 4449` | Lesson routes, controls, landscape and zoom matrix |
| `/chinese`, 375×812 | `artifacts/kim-lien-all-qa/chinese-mobile-end-375x812.png` | Internal language scroller reached its end at `1971 + 602 = 2573` | Lesson routes, controls, landscape and zoom matrix |
| `/graphic-design`, 375×812 | Live browser audit on 2026-08-26; no separate screenshot | Landing page scroller reached its end at `7402 + 752 = 8154` | The 25 individual editor routes and full interaction matrix |
| `/graphic-design/vector`, 375×812 | Live browser audit on 2026-08-26; no separate screenshot | Vector tool page scroller reached its end at `1170 + 752 = 1922` | Editor actions, other tools, landscape and zoom matrix |
| `/play`, 375×812 | `artifacts/kim-lien-all-qa/hh-play-mobile-collection-375x812.png`, `hh-play-mobile-end-375x812.png` | Final v6 landing audit: duration/mood cards keep labels and descriptions on separate readable lines; `.hhp-stage-scroll` reached its end at `1533 + 632 = 2165`; bottom navigation remains visible | Inspector lifecycle, nine child spaces, games and full interaction matrix |
| `/game`, 375×812 | `artifacts/kim-lien-all-qa/eonwild-mobile-end-375x812.png` | EonWild `.hwe-main` reached its end at `1685 + 618 = 2303`; final world-layout content ended at y=708 above the mobile navigation; document width equals viewport width | Eight child routes, actual game lifecycle, other renderers, landscape and zoom matrix |
| `/work`, 375×812 | Live browser audit on 2026-08-26; no separate screenshot | Landing page scroller reached its end at `4858 + 752 = 5610` | Six child centers, dialogs, landscape and zoom matrix |
| `/settings`, 375×812 | Live browser audit on 2026-08-26; no separate screenshot | Settings page scroller reached its end at `118 + 752 = 870` | Save/reset behaviours, account child routes, landscape and zoom matrix |

The current all-workspace pass directly sampled only the `/game` landing route.
The older files under `artifacts/eonwild-qa/` validate earlier gameplay builds
and are not counted as evidence for the eight unsampled EonWild child routes.

## Scroll contract

- The document body stays locked while the authenticated shell is active.
- Desktop header and sidebar remain fixed.
- Sidebar search/home and footer remain outside the middle scroll region.
- `.app-main` owns ordinary route scrolling.
- Chat, games, canvas, video and code editors may own bounded internal scrolling.
- Mobile content reserves bottom-navigation and safe-area space.
- Mobile sheets lock the background and return the previous scroll position on close.
- `HHKimLienWorkspaces.audit()` reports horizontal overflow, current scroll owner,
  reachability of the end, route and authentication-layer visibility for QA.

## Visual exceptions

- Canvas, video, photo, code and 3D viewports keep a neutral dark working area
  where colour accuracy or scene readability requires it.
- Their header, toolbar, panels, controls, dialogs, status surfaces and loading
  states still use Kim Liên wood, ceremonial gold, ivory and bronze tokens.
- Buddha imagery remains limited to Home and Dharma contexts. Other modules use
  lotus/medallion/light-line motifs without religious-image repetition.
