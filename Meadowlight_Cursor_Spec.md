# Meadowlight cooperative city builder specifications for Cursor

Working title: **Meadowlight**. The name is replaceable. Build a cozy, asynchronous cooperative city builder for the web. Each player owns an infinite city map, builds houses and roads, places portals to other cities, and sends materials or construction contributions through those portals. Shared construction includes skyscrapers, museums, parks, and municipal recreation centers.

The central promise is **meaningful progress in one to two minutes a day, with ordinary progression visits taking less than five minutes**. A player should leave feeling satisfied. Build the complete first playable release described here, including genuine multiplayer persistence. Decorating homes and backyards, exploration, and space stations are later releases.

The numerical values below are initial design decisions to implement and playtest. They are not established balance or engagement benchmarks.

## 1 Instructions for Cursor

Treat this document as the implementation source of truth. Read any existing repository instructions and inspect the current application before changing it. Preserve an established compatible stack; use the default stack in section 11 for a new repository.

1. Write a short implementation plan mapped to the milestones in section 15.
2. Implement a playable vertical slice first, then complete the multiplayer release. Continue through the milestones without requiring approval for ordinary implementation choices.
3. Keep simulation rules separate from rendering. Use one authoritative definition catalog for costs, footprints, yields, and project targets.
4. Implement the database migrations, authorization, transaction rules, and two-player tests. A beautiful client with simulated neighbors does not satisfy the multiplayer milestone.
5. If hosted credentials are unavailable, provide a runnable, clearly labeled local demo and a complete Supabase local-development setup. Report exactly which live integrations remain unverified. Do not present the demo as live multiplayer.
6. Keep a short progress checklist in the repository. Run the checks relevant to each milestone and fix failures before continuing.
7. Implement only the first-release feature set. Leave narrow extension points for later releases; do not build the decorating, exploration, or space systems yet.
8. Finish with launch instructions, test results, known limitations, and the smallest remaining setup steps. Do not invent successful deployment, account setup, or multiplayer verification.

## 2 Product principles and explicit assumptions

| Principle | Required behavior |
|---|---|
| Two actions per window | Each 12-hour window has exactly two available progression actions. Unused actions are discarded at the next window. |
| Short visits | A typical visit uses one or two actions and takes one to two minutes. Nothing requires remaining online. |
| Gentle pacing | No city decay, debt, disasters, expiring item rewards, streaks, competitive rankings, or cleanup obligations after absence. Unused actions do expire as specified. |
| Infinite personal space | Every city can expand in every direction without purchasing map extensions or reaching a designed world edge. |
| Houses and roads | House construction and road drawing are explicit building tools, with previews and persistent map changes. |
| Portal connections | A placed portal points to another player's city. Its creation and initial assignment are one action together. Changing its destination later is one action. |
| Read-only browsing | A map directory lets players view other cities freely. Cross-city changes must be sent through a valid owned portal. |
| Asynchronous cooperation | Friends never need to be online simultaneously. A player can also progress alone. |
| Visible shared progress | Contributions improve a project on its host player's map and name the contributing cities. |
| Lasting ownership | Guests never receive general permission to rearrange another player's city. |
| Limited obligations | Future decorating, exploration, and space progression share the existing two-action window. |

**Time assumption:** five minutes is the design target for ordinary progression, not a forced logout. Optional map browsing, rearranging owned decorations, or future interior editing may take longer by choice.

**No banking:** at most two unspent actions exist at any time. A player who skips a window loses its unused actions. Do not compensate with stored actions, a starter bonus, a catch-up grant, a streak grant, or an overflowing reserve. Resource balances may still accumulate while absent; the restriction is specifically on actions.

**Portal assumption:** portals are directed, owned objects on the source map. Selecting a target city needs no matching portal or approval action from the target owner. A return portal, if wanted, is built by that owner using their own action. Moving an existing portal within its own map is free and preserves its destination.

**Sending assumption:** the first release supports resource parcels and project-work contributions. Sendable furniture and other items are later extensions. A portal authorizes these specific deliveries; traveling through it does not grant freeform editing of the destination city.

**Trade assumption:** an operational portal also establishes modest passive commerce between the two cities. Duplicate and reciprocal portals never multiply that pair's commerce bonus. Actual inventory parcels are explicit sends with a separate action cost.

**Social assumption:** authenticated players can browse a paginated directory of player maps. Friend lists and private circles provide optional filters and coordination; neither replaces the portal requirement nor adds an approval step to first assignment.

## 3 First release scope

### Required

- A persistent infinite personal city map with an isometric view and cohesive original 2D artwork.
- Explicit tools to build houses, draw roads, build other town buildings, and place portals.
- One building upgrade tier, free rearrangement, and storage of owned entities.
- Exactly two actions in each fixed 12-hour window, with no banking and no extra starting actions.
- Three resources: coins, timber, and stone. Automatic production while away.
- Authentication and server-owned multiplayer state.
- A searchable, paginated map directory; every destination opens in read-only visitor mode.
- Portal creation with first destination in one action; reassignment in one action; free viewing and traversal.
- Server-validated portal sends for resource parcels and construction work.
- Passive portal commerce, counted once per connected city pair.
- Projects physically hosted on player maps: park, museum, municipal recreation center, and skyscraper.
- Optional friendships and invite-only circles for organizing people and projects.
- A concise return summary and a clear stopping point when actions are spent.
- Responsive desktop and phone controls, accessible map alternatives, and reduced motion.
- A clearly labeled local demo for evaluation without online configuration.

### Later releases

- House interiors, furniture, backyards, flower collections, and item transport through portals.
- Forest, cave, freshwater, and coastal exploration missions.
- Shared orbital construction and space station scenes.
- More house styles, road and bridge types, project styles, and negotiated barter.

Do not add inert expansion buttons to primary navigation. An optional Future plans panel may describe planned systems.

## 4 Daily loop and action accounting

### Expected visit

1. Open directly into the city. Settle production and the current action window automatically.
2. Read one small summary with actual earned resources and project progress.
3. Use up to two actions. Examples: build a house and draw a road; create an assigned portal and send work through it; or build once and contribute once.
4. See the committed results immediately, including activity on a destination project.
5. End with a calm stopping message and a quiet indication of when the next two-action window begins.

A once-daily player will normally use two actions. A player who visits in both 12-hour windows can use four actions across those windows. Never describe four as a banked daily allowance. Browsing and optional cosmetic rearrangement do not require unused actions.

The return summary needs no collect button. Do not scatter claim buttons across buildings, portals, parcels, or projects.

### Exact window rules

- New city: **2 actions**, immediately available in its first window.
- Window duration: **12 hours**.
- At the next window: **replace the remaining allowance with 2**. Do not add two to the old allowance.
- Unspent maximum: **2**, always.
- Window anchor: the server timestamp at city creation and successive 12-hour intervals. It is independent of local midnight, time zone, daylight saving, login, and spending time.
- Missing several windows still leaves only two actions in the current window.
- Spending an action does not restart or shift a window.
- No paid actions, speed-ups, advertisements for extra actions, quest action grants, or tutorial bonuses.

Authoritative calculation under the city's economy lock:

```text
H = 12 hours
elapsed_windows = floor((effective_server_now - action_window_start_at) / H)
if elapsed_windows > 0:
    actions_remaining = 2
    action_window_start_at += elapsed_windows * H
```

Initialize `actions_remaining = 2` and `action_window_start_at = city_created_at`. Use the current server time when processing a new command, never a timestamp supplied by the client. Capturing the effective timestamp after acquiring locks makes the spend belong unambiguously to one window.

Examples:

- Spend both starting actions: zero remain at 11h59m; two are available at 12h.
- Leave one action unused before 12h: the new window has two, not three.
- Do not open the game for 72 hours: the current window still has only two.
- Reload repeatedly, reconnect, or open another tab: the allowance never increases.
- Using actions just before a boundary and again just after it is allowed: those are two distinct windows. The unspent allowance never exceeds two.

### Actions and costs

| Action | Actions spent | Other cost |
|---|---:|---|
| Build one house or other functional building | 1 | Its catalog resource cost |
| Upgrade a building to level 2 | 1 | Twice its original resource cost |
| Build one continuous road path of up to 16 tiles | 1 | 1 stone per newly added road tile |
| Place a portal and assign its initial destination together | 1 total | None |
| Change an existing portal's destination to another city | 1 | None |
| Send one resource parcel through a portal | 1 | The resources sent, removed from the source and credited to the destination |
| Send one work unit to a project through a portal | 1 | 5 timber and 5 stone; consumed as construction work |
| Contribute one work unit to a project on your own map | 1 | 5 timber and 5 stone |
| Supply run | 1 | None; choose 30 coins, 20 timber, or 20 stone |
| Open the map list, view any listed map, or traverse a portal | 0 | None; visitor mode stays read-only |
| Move, rotate, recolor, store, or restore an owned entity | 0 | None; same entity, level, and portal destination |
| Erase up to 16 owned road tiles or restyle existing roads | 0 | No resource refund; rebuilding new tiles follows the paid road rule |
| Place an earned cosmetic landmark or owned scenery | 0 | No production or progression reward |
| Friendship, circle management, or selecting a new project site | 0 | No remote edit or resource transfer |
| Disable incoming sends or block a sender | 0 | Safety setting; never changes a portal's assigned destination |

Previewing costs nothing. Charge only when a valid confirmation commits. A portal's initial placement and assignment are a single atomic command, not two actions. A work send is one atomic contribution, not a parcel action plus a second contribution action.

Sending after creating or reassigning a portal is a separate action. For example, create-and-assign costs one; send a parcel costs one; the current window is then exhausted.

Reject invalid, stale, unavailable, or unaffordable requests without spending an action or resources. Re-selecting a portal's current destination is a no-op with no charge. At zero actions, leave viewing, traversal, cosmetic rearrangement, and project inspection available without a blocking recharge dialog.

## 5 City building and starting economy

### Infinite map and placement

- Every player owns a separate map with no designed edge in any direction. New land requires no map purchase, district unlock, portal, or action to reveal.
- Generate deterministic terrain lazily in **32-by-32-tile chunks**, using the city seed and generator version. Persist edits and placed entities, not an infinite pre-generated tile array.
- The initial camera shows a small authored neighborhood near the origin: a river edge, starter roads, trees, town hall, two cottage houses, timber workshop, stone yard, pocket park, and an untouched cooperative park site.
- Use a generous buildable grassland baseline outside the starting neighborhood. Distant terrain generation must not strand a player behind unbuildable barriers. Scenic terrain has no economic loot merely for panning over it.
- Load only visible and nearby chunks. Bound request sizes, cancel stale camera requests, use a bounded cache, and discard distant rendered geometry. Panning farther is not permission to scan or render the whole city.
- Definitions provide authoritative footprints. Houses and most buildings occupy 1 by 1 or 2 by 2 tiles; project sites occupy 4 by 4. A portal occupies 1 by 1. Water, solid structures, and road tiles are invalid building footprints.
- Show a placement ghost with valid/invalid reasons, rotate, confirm, and cancel. The backend checks the full footprint, including cross-chunk tiles.
- Buildings complete immediately. Passive production has no construction countdown or manual harvesting.
- Owned entities may be rearranged freely. Storing a productive building stops its yield; restoring resumes the same entity. Settle production before either operation.
- Store instead of demolish in the first release. The town hall cannot be stored. A portal always retains its destination while stored or moved; free storage cannot bypass reassignment costs.
- Population and amenity are positive descriptive totals, not needs meters, labor limits, or happiness systems that can deteriorate.

### Houses and roads

Houses are a visible build-menu category. The initial house is the cottage; offer at least three original visual styles with the same cost, footprint, and output so choices are aesthetic. A level 2 house has a visibly improved appearance. Each new house costs one action; the styled variants are not separate production exploits.

Roads are actual persistent map tiles with a dedicated draw tool. Draw a continuous orthogonal path of **1 to 16 tiles** per confirmed action. Existing road tiles may occur in the path; charge stone only for new tiles. An entirely existing path is a free no-op, and a path exceeding the limit is rejected without silently truncating it or spending several actions.

Roads automatically render straight segments, corners, junctions, and ends according to neighboring road tiles, including across chunk boundaries. Roads cannot overlap water, houses, portals, or project footprints. Clearing purely cosmetic grass or flowers within a valid placement is included; do not add a separate cleanup chore.

Houses, portals, and projects can sit beside roads. Connected roads may carry ambient walkers or carts, but roads are not a production prerequisite, traffic simulation, utility network, or daily maintenance obligation. Erasing owned roads grants no stone or action refund. New tiles added afterward require a new paid road action.

Provide Town hall, Portal, Project, and saved-place camera jumps so an infinite map remains easy to navigate. A free camera jump never authorizes a remote change.

### Resource rules

Start with **80 coins, 60 timber, and 40 stone**, in addition to the starting buildings.

| Building | Footprint | Build cost in coins / timber / stone | Level 1 output every 12 hours | Residents | Amenity |
|---|---|---|---|---:|---:|
| Town hall | 2 by 2 | Starting entity only | 18 coins, 8 timber, 8 stone | 0 | 0 |
| Cottage | 1 by 1 | 12 / 8 / 4 | 4 coins | 4 | 0 |
| Timber workshop | 1 by 1 | 10 / 14 / 4 | 6 timber | 0 | 0 |
| Stone yard | 1 by 1 | 10 / 8 / 12 | 6 stone | 0 | 0 |
| Neighborhood market | 1 by 1 | 22 / 16 / 12 | 10 coins | 0 | 0 |
| Flower garden | 1 by 1 | 10 / 6 / 4 | None | 0 | 2 |
| Pocket park | 2 by 2 | 16 / 10 / 8 | None | 0 | 4 |

The starting city therefore produces **26 coins, 14 timber, and 14 stone per 12 hours**, or **52 / 28 / 28 per 24 hours**, before trade. Its population is eight and amenity is four. The permanent town hall provides a recovery floor.

Level 2 costs twice the original cost in every resource and keeps the same footprint. Outputs become: cottage 6 coins and 8 residents; timber workshop 10 timber; stone yard 10 stone; market 16 coins; flower garden 4 amenity; pocket park 8 amenity. The town hall has no first-release upgrade. A level 2 building cannot be upgraded again.

Resources have no spoilage, upkeep, debt, or ordinary storage cap. A supply run gives a player with low stock a useful action without requiring another session. All cities can produce all three resources; no specialization can make a city dependent on a friend.

### Offline production and rate changes

Production accrues continuously at the displayed 12-hour rate. Calculate it from authoritative elapsed time when state is synchronized; a per-city background timer is unnecessary.

For each resource, store an integer balance and an integer fractional remainder. With `H_ms = 43,200,000`, a nonnegative integer `rate` per 12 hours, and integer `elapsed_ms`:

```text
numerator = rate * elapsed_ms + remainder
earned = floor(numerator / H_ms)
remainder = numerator % H_ms
balance = balance + earned
last_settled_at = effective_now
```

Use integer arithmetic with adequate range. Choose millisecond precision consistently. Clamp effective time to at least the stored settlement time; a clock regression must not create negative production or replay an interval.

Settle at the **old** production rate before construction, upgrading, storing, restoring, or a portal connection changing the rate. Then apply the new rate from that timestamp forward. Never apply a newly built workshop retroactively to the whole offline period. Display estimates may animate locally; committed balances come from the server.

### Balance checks

- Two project contributions cost 10 timber and 10 stone per window. Using both windows, four contributions cost 20 timber and 20 stone per day; the starting city produces 28 of each. A player can focus entirely on shared work without being forced to expand production.
- Every building has a nonnegative yield. Cosmetic choices never impose an economic penalty beyond their stated initial cost.
- Portal commerce improves convenience and identity; it is never required to recover from a resource shortage.
- Production growth is paced by actions. There is no rapid-clicking income loop.

## 6 Map directory and portals

### Browse other player maps

Provide a searchable, cursor-paginated list of player maps for authenticated users. Each entry shows city name, display name, a small preview, and project status. Include All maps, Friends, and My circle filters; new users can browse before they have friends or a portal.

Opening a directory entry is always free and read-only. Visitors may pan across the infinite map, zoom, inspect buildings and public projects, and bookmark a view. No directory button may directly place, upgrade, erase, rearrange, contribute, trade, or change the target city's state.

Visit snapshots expose public appearance, terrain, structures, project progress, population, amenity, and city specialty. Do not expose wallets, action counters, email addresses, session tokens, private settings, or hidden account data. A clear Visiting label and Return to my city control remain visible.

The map viewer itself stays read-only even after traveling through a portal. A Send through portal control opens a source-owned delivery action; it is not a general edit mode for the destination scene.

### Portal lifecycle

1. On your own map, choose Portal, an unoccupied land tile, and a destination city from the map list. Preview the combined result.
2. Confirm once. The server atomically places the portal and assigns that city for **one action total**, with no resource charge. Reject an unassigned creation, self-destination, missing city, or invalid placement without a charge.
3. The destination needs no existing portal and spends no actions. Do not create an extra portal or edit a tile on its map. Arrival uses the destination city's public arrival anchor, initially near the town hall.
4. Later, choose Change destination on that same portal. A different valid city costs **one action**. Preserve the portal entity ID, position, and appearance; increment its assignment revision.
5. Visiting or traversing a configured portal is free. Repeated traversal does not grant resources, actions, ownership, or editing permission.

Only the portal owner may assign, reassign, move, store, or restore it. Moving or restoring preserves the current assignment. There is no free clear-and-assign endpoint, destination edit through cosmetic data, or clone operation. Creating another portal always costs a new action, even if one was previously stored.

Portals are directed. A portal from A to B lets A send to B. B needs its own assigned portal to send back to A. There is no arbitrary total portal count or three-connection limit. Duplicate portals are allowed for layout, but do not multiply commerce bonuses.

Target owners accept supported positive deliveries by default, without a separate setup action. They may disable inbound deliveries or block a source for free. Such portals become unavailable for sending and commerce without losing their stored assignment. Show availability before confirmation; a change during a request fails safely without charging. Restoring availability to the same destination does not count as reassignment.

### Send through a portal

The first release has two payload types:

| Payload | Cost and effect |
|---|---|
| Resource parcel | One source action. Atomically subtract a chosen positive amount of coins, timber, and/or stone from the source and credit exactly those amounts to the destination. No currency duplication or manual claim. |
| Project work | One source action plus 5 timber and 5 stone. Atomically add one work unit to an open project physically hosted in the destination city. Do not also credit those materials to its wallet. |

Every cross-city send includes the source-owned portal ID, its expected assignment revision, the displayed destination ID, and a unique request ID. For work, also include the destination project ID. Server checks must confirm all of these still agree at commit time.

- The source belongs to the authenticated actor and has an action and any required stock.
- The portal is placed, active, owned by that source city, and currently assigned to the displayed destination.
- The destination exists and allows this source and payload.
- A work target is an open project actually hosted in that destination, not merely a project whose ID was supplied by the client.
- A resource parcel has valid nonnegative integer amounts, at least one positive amount, and no unsupported resource or item type.

An accepted send is immediate and atomic; it creates a receipt and small activity entry. No timed collection, queue babysitting, or second recipient action follows. Reassigning the portal afterward does not reroute or replay a completed send. A stale send after reassignment fails with no spend; do not silently send to the new target.

When browsing another map without a matching portal, the only offered next step is to create an assigned portal on your own map. Creating it consumes one action; sending still consumes a second action. With a matching portal, offer an explicit send flow. A raw API call with only a destination or project ID must not bypass portal checks.

Direct editing of another person's house, roads, portal assignments, project position, or appearance remains forbidden. Future sendable items arrive in the receiver's owned inventory; their owner chooses placement. Do not implement remote freeform construction as an accidental consequence of portal access.

### Passive trade through portal connections

Choose a city specialty during onboarding: markets, timber, or stone. It does not change basic building production. All cities remain self-sufficient.

One or more operational portals between the same two cities establish **one commerce connection for that unordered city pair**. Each city receives 3 units per 12 hours of the partner's agreed specialty; markets supply coins. This is newly generated background commerce, not a deduction from the partner's stored wallet.

- One A-to-B portal, two A-to-B portals, or reciprocal A-to-B and B-to-A portals all produce the same one pair bonus.
- Directed sending permissions still follow each owner's outbound portal; a commerce connection does not authorize B to send through A's portal.
- Opening the directory, viewing a map, or having a friendship produces no commerce bonus.
- Establishing a portal includes activation of any new pair connection. There is no extra paid route-activation action or recipient acceptance step.
- Snapshot the agreed specialties when a pair becomes active. Free specialty changes affect newly activated pairs, not an existing active connection.
- Reassigning, storing, restoring, disabling, or blocking a portal updates the affected pair's operational portal count. End a pair bonus only when no operational portal connects that pair; a reverse portal may keep it active.
- Settle all affected cities at their old rates through one effective timestamp before changing connection counts and rates. Reassignment may involve source, old destination, and new destination.
- Completed shipments, earned resources, and contribution credit survive reassignment or disconnection.

There is no upkeep, expiry, manual collection, or requirement that the partner log in. The game's original trade-route concept is represented by these portal connections; do not implement a second independent route system that bypasses portals.

Friendship is an optional contact relationship, not a prerequisite for public map viewing or portal placement. Private circle invites still use unpredictable revocable tokens with stored hashes and rate-limited resolution.

## 7 Projects hosted on player maps

### Ownership and cooperation

Projects occupy real 4-by-4 sites on the host player's infinite city map. There is no separate writable regional map for first-release construction. The project board links to these hosted sites and displays their shared progress.

- Each city may host one active project at a time. It may complete each of the four project types once in the first release.
- The host chooses a valid site for free. Creating the untouched site produces no yield, reward, or completed structure. The starter town includes an untouched Riverside park site.
- The host contributes directly using their own actions and resources.
- Anyone else contributes by sending project work through their own portal assigned to the host's city. A friendship or circle membership never substitutes for that portal.
- Supported positive contributions are accepted by default, subject to inbound and block settings. Nobody can delete or alter another contributor's credit.
- The host controls placement, appearance, and later cosmetic rearrangement. Moving a site preserves its project ID and progress, so a pending send targets the project rather than old tile coordinates.
- Reserve all footprint tiles atomically, including across chunk boundaries. Sites cannot overlap roads, portals, water, or other structures.
- There are no deadlines, minimum quotas, contribution leaderboards, or automatic work. A solo host can complete every project.

### Project catalog

| Shared project | Required work units | Solo windows at two contributions per window | Completed appearance |
|---|---:|---:|---|
| Riverside park | 6 | 3 | Paths, trees, flowers, benches, and a pond |
| Community museum | 16 | 8 | Warm civic building, banners, sculpture court |
| Municipal recreation center | 24 | 12 | Recreation building, courts, accessible paths |
| Skyline tower | 40 | 20 | Welcoming skyscraper with a planted plaza |

These are effort comparisons, not guaranteed elapsed times. A once-daily player making two contributions per visit needs approximately 3, 8, 12, or 20 such visits. Visiting both windows can use four actions per day, but unused windows never carry over. Building houses, roads, or portals uses the same allowance. Additional contributors shorten completion naturally; targets never grow when people join.

### Contribution and completion

One work unit always costs one contributor action, five timber, and five stone. For remote work, portal delivery and work application are the same transaction and the same one action. No action is spent by the host to accept it. The remote materials become work; they are not also paid into the host wallet.

Show total work, current work, recent contributing cities, and the effect of the next contribution. Construction stages use `ceil(total / 3)` and `ceil(2 * total / 3)` thresholds: groundworks, structure or planting, finishing, then complete. The first contribution visibly changes the site.

On completion, atomically:

1. Replace the site appearance with the finished landmark while retaining its stable identity.
2. Write one completion event and preserve attributed contribution history.
3. Unlock a 2-by-2 cosmetic landmark blueprint for the host and every city that contributed, including people who left a circle or reassigned their portal before completion.
4. Grant each blueprint type once per city. Repeated requests or earning the same type from another host do not duplicate entitlements or owned entities.
5. Grant no extra actions, production multiplier, ranking power, or timed claim reward.

The finished 4-by-4 host landmark remains where it was built. A blueprint allows at most one additional owned cosmetic instance of that type per city, freely placed and rearranged. Its resource yield and population effect are zero.

If two contributions race for the final work unit, only the first commits its charge and work. The loser receives fresh completed state and spends nothing. Starting an already completed type or a second active project also fails without a charge.

An untouched project can be canceled freely by its host. Once work has been contributed, it cannot be canceled or stored; the host may relocate the intact site. Disconnecting portals, leaving a circle, or becoming inactive never removes work or possession of the landmark.

### Optional circles

A circle is an invite-only coordination group of one to eight cities, with at most one current circle per city. Its board aggregates projects physically hosted by its members and offers links to those maps. Friendship and circle management are free.

Any current member may create an invite and revoke their own invites. Revoke outstanding invites when the creator leaves. Joining or leaving preserves owned city entities, current projects, contributions, and earned blueprint rights. Joining alone grants no project completion credit or duplicate blueprints.

Group membership confers no direct write access to another map, no extra actions, and no portal bypass. No chat is required for the first release; use optional preset cheers on your own activity surface. Sending actual gifts or work always uses a portal and the sender's action allowance.

## 8 Interface and visual direction

### Overall feel

Use a warm miniature diorama style: cream background, sage greens, clay roofs, pale stone, soft blue water, and warm windows. Houses, roads, and portals should be recognizable at a glance. Favor original SVG or locally bundled illustrations over dashboard cards or emoji as the main art system.

Use a legible interface face, friendly headings, gentle shadows, and restrained texture. The city is the main surface. Avoid excessive statistics, flashing badges, timer emphasis, full-screen reward ceremonies, and noisy activity feeds.

### Main screens

| Screen | Essential content |
|---|---|
| My city | Infinite map, compact resources, 0/2 to 2/2 actions, build tools, entity inspector, camera bookmarks |
| Build drawer | Houses, Roads, Town buildings, Portals, and owned Cosmetics; footprint, preview, and full cost |
| Maps | Searchable paginated player directory, All maps/Friends/My circle filters, free read-only visits |
| Portal inspector | Current destination, availability, free Visit, one-action Change destination, and explicit Send |
| Send panel | Owned portal, displayed target city, parcel or work payload, full action/resource cost, confirm |
| Project board | Projects on your map and circle maps; host, stage, contributions, and portal-gated work action |
| Settings | Name, specialty, accessibility, account, inbound sends, blocked sources, circle invites |

On phones use City, Maps, and Projects navigation with context bottom sheets. Portals remain an obvious city build tool, not a hidden social setting. On desktop use a compact rail and contextual drawer. Core actions never require hover.

### Controls and accessibility

- Pan by dragging the background; zoom with wheel or pinch. Include visible zoom, town-hall recenter, and owned-portal/project jump controls.
- Distinguish drags from taps. Finishing a pan must not place a building, road, or portal or spend an action.
- Road drawing has its own preview, 16-tile limit indicator, cost, confirm, and cancel. No implicit repeated purchases while dragging.
- Portal creation previews placement and chosen destination together. Reassignment clearly states that it costs one action.
- Offer a keyboard-operable local placement grid or coordinate selector. Escape cancels; Enter confirms a valid, fully previewed action.
- Use at least 44-pixel touch targets, visible focus, readable contrast, and labels for icon buttons. Invalid placement includes text, not only color.
- Respect reduced motion. Sound starts off. The full game remains usable with sound and animation disabled.
- Design loading, chunk-loading, missing destination, disabled portal, exhausted actions, offline, stale assignment, and empty-directory states.
- Preserve placement and send drafts through ordinary updates when possible. A changed destination or invalidated footprint requires a fresh confirmation and never silently redirects a spend.
- Keep visitor scenes visibly read-only. Inspecting a project may offer Send through a matching portal; it never turns the map into an editor.

### First session

Name the city, choose a specialty with a safe default, and enter a ready-made starter neighborhood with exactly two actions. Offer a dismissible suggestion to build a house and a short road. Another tutorial example may show that creating an assigned portal and sending work use the same two actions. Do not require both examples or grant bonus actions to finish onboarding.

Use this wording: **Two actions per twelve-hour window. Unused actions do not carry over.** Account creation and initial learning may take longer than a routine visit, and should be measured separately.

## 9 Architecture for later expansion

Preserve the first release's time budget when expanding. Every new progression activity competes for the same two-action allowance; do not introduce a new energy meter for each module.

| Release | Player experience | Progression rule | Architecture needed now |
|---|---|---|---|
| Interiors | Enter a specific owned house and arrange furniture | Rearranging owned items is free; acquiring or crafting a new progression item may spend an action | Stable entity IDs; scenes can reference a parent entity |
| Backyards | Arrange paths, garden beds, and flowers | No required watering, plant death, or timed collection; arranging owned cosmetic varieties is free | Parent scenes and validated appearance data |
| Exploration | Choose a forest, cave, river, or coastal destination and bring back discoveries | Launch costs one action; results resolve automatically after a set duration and wait safely until the next visit | A command boundary and injectable clock; create mission tables in that release |
| Space | Develop an orbital scene and build a station with friends | Station work uses the existing project, portal, and two-action-window rules | Scene kinds and project definitions can expand without changing city entity IDs |

Exploration must not require twitch play, a continuous five-minute run, same-day claiming, equipment repair, or failure that destroys possessions. Deterministic reward rolls should be fixed on launch, not rerolled by refresh. These are future requirements, not first-release implementations.

For interiors and backyards, creative editing may be an optional longer activity. Required daily progression must still fit the original one-to-two-minute target. Space stations are a later setting and content system, not a reason to launch with a 3D engine or a separate MMO backend.

Use a small scene model now: infinite city scenes, with optional parent-scene and parent-entity references. Add other kinds when implementing them. Do not build a universal scripting engine, an entity-component framework, procedural galaxies, or speculative future tables.

## 10 Game state and authoritative commands

### Domain boundaries

Separate versioned definitions, pure simulation rules, persistence and authorization, and presentation. Keep action-window resets, continuous resource accrual, road validation, chunk coordinates, footprints, portal eligibility, pair commerce, and project work independently testable.

Use a typed service interface with a local-demo adapter and an authenticated backend adapter. They share catalogs and reference fixtures; online state is always server-owned. A client-side portal check is only preview feedback, never authorization.

Minimum operations:

```text
sync_my_city / create_city
list_player_maps / read_city_summary / read_city_chunks
place_building / upgrade_building
build_road_path / erase_owned_roads / restyle_owned_roads
reposition_entity / store_entity / restore_entity / update_cosmetics
create_assigned_portal / reassign_portal / set_portal_enabled
send_resource_parcel / send_project_work
set_inbound_delivery_policy / block_source / unblock_source
take_supply_run
propose_friendship / respond_friendship / remove_friendship
create_circle / create_circle_invite / revoke_invite / join_circle / leave_circle
start_hosted_project / cancel_untouched_project / contribute_to_own_project
place_landmark
```

Directory and chunk reads are read-only queries. Do not expose an unguarded contribute-to-any-project or activate-independent-route endpoint.

Every mutation takes a request ID. Source-city mutations take an expected city revision. Portal sends and retargets also take the expected portal assignment revision; the payload contains the destination displayed in the confirmation. Spend commands include the displayed catalog version. Reject changed definitions or stale destinations without charging.

Payloads specify intent, not client-supplied costs, yields, action counters, ownership, timestamps, commerce bonuses, or work totals. City revisions track intentional changes; passive accrual and automatic action-window changes alone do not increment them. Current affordability is still checked against locked balances. `sync_my_city` needs no expected revision.

### Transaction contract

1. Authenticate, validate the command schema, and enforce bounded request sizes.
2. Resolve `(actor_id, request_id)` with a canonical payload hash. A replay returns the recorded result; reuse for a different command is rejected.
3. Acquire all needed locks using one consistent hierarchy. Lock every affected city in sorted ID order; also lock the specific portal, project, circle, commerce-pair, and occupancy records as appropriate. Re-read relationships under locks.
4. Capture one effective server timestamp after obtaining locks. Settle resources and reset action windows for affected cities as appropriate. Passive synchronization never spends or grants more than the two current-window actions.
5. Validate source ownership, expected revisions, current window allowance, resources, terrain, occupancy, portal assignment, inbound policy, and target project ownership/status.
6. Deduct one source action and the exact resources for the selected command. A recipient never spends an action to receive a parcel, commerce, or work.
7. Apply all effects atomically: source deduction, destination credit or project increment, occupancy, portal assignment, affected commerce rates, and any completion entitlements.
8. Record an action ledger entry with its action-window start, a delivery/contribution receipt as relevant, revisions, and a small safe activity event. Store the idempotent result and commit.

Free mutations use the same validation and atomicity rules but no action ledger spend. An invalid request may update ordinary passive accounting, but spends no action or action cost. Store business-rule error results under their request ID too; a newly confirmed corrected attempt uses a new ID.

Use bounded transaction retries for lock conflicts. A timeout after commit is retried with the same ID, never with a new spend request. A collection of separate source debit and destination credit REST calls is not a transaction.

Define the lock hierarchy explicitly before implementing commands. Reassignment may affect three cities and two commerce pairs; storing, blocking, or policy changes may affect multiple pairs. Serialize target changes with sends so an in-flight confirmation is either valid for its original destination or rejected, never redirected.

### Reading and synchronization

Realtime messages invalidate authorized snapshots and visible chunk caches; they do not grant resources or prove a purchase succeeded. Subscribe only to the necessary owned state, visible city chunks, relevant portal assignments, and viewed projects. Never broadcast private wallet data in directory or project events.

Refresh on reconnect and visibility changes, with manual refresh fallback. Lost or duplicated messages must converge to database state. Use spatially filtered invalidation so an infinite map does not imply subscribing to all map entities.

Online cached views are read-only while disconnected. Do not queue purchases, retargets, or sends that might race with another tab. Keep authenticated snapshots out of shared public caches; directory map data and owner-only economy data need separate safe responses.

## 11 Default technical stack

Use a responsive browser application first. Do not start with native mobile apps.

| Layer | Default |
|---|---|
| Application | Next.js App Router, React, strict TypeScript |
| Styling | Tailwind CSS or the repository's established styling system |
| City rendering | Viewport-culled SVG chunks, reusable original building components, isometric projection, and a floating-origin camera |
| Persistence | Supabase PostgreSQL with migrations |
| Authentication | Supabase Auth; email one-time code for the first release |
| Shared updates | Supabase Realtime with authorized subscriptions and refetch fallback |
| Validation | Zod or an equivalent shared schema library |
| Tests | Vitest for domain rules; database integration tests; Playwright for user flows |

Use compatible stable package versions available when implementing and commit the package-manager lockfile. Do not assume this document pins framework versions. A custom WebSocket server, Redis, payment system, AI service, or heavyweight 3D renderer is unnecessary for the first release.

### Rendering details

Store integer world coordinates independent of screen coordinates; render only small camera-relative coordinates. A suitable starting tile size is 64 by 32 pixels:

```text
screen_x = (grid_x - grid_y) * 32
screen_y = (grid_x + grid_y) * 16
```

Invert the camera transform before converting pointer positions back to tiles. Use a tested depth order based on the footprint's ground anchor. Buildings need level 1 and level 2 appearances; project sites need their construction stages. Prefer local, original SVG assets with a consistent palette and light direction.

An SVG first release can use a renderer interface to allow later replacement. Do not introduce a graphics engine solely for hypothetical future content. Performance targets are a smooth usable map on a midrange phone and an initial city interaction within three seconds on an ordinary connection after authentication, to be measured rather than assumed.

### Infinite coordinate and chunk requirements

Use canonical chunk coordinates and local tile coordinates. A chunk contains 32 by 32 tiles. Chunk keys must remain exact at large distances: use decimal integer strings on API boundaries and BigInt arithmetic for world/chunk keys. Store chunk keys as canonical decimal text in Postgres, with scene/chunk-key indexes for exact lookups. Normalize plus signs, leading zeroes, and negative zero away before persistence. Do not round coordinates through floating-point JSON numbers or rely on lexicographic text order for spatial comparisons.

```text
chunk_x = floor(world_tile_x / 32)
local_x = world_tile_x - chunk_x * 32
chunk_y = floor(world_tile_y / 32)
local_y = world_tile_y - chunk_y * 32
```

Local coordinates are always 0 through 31. Signed integer division that truncates toward zero is incorrect for negative coordinates; implement explicit floor division. Do not use signed 32-bit bitwise shortcuts for unbounded world coordinates.

Apply the screen projection to differences relative to a nearby camera origin, not enormous absolute tile values. Rebase that origin as the camera moves and preserve screen position; this avoids jitter and broken hit tests at large distances. Convert screen hits back to canonical chunk/local keys before mutation.

Generate terrain with a versioned deterministic function of the city seed and canonical coordinates. Adjacent chunks must agree along their borders. Persist edited terrain and entities only; walking the camera into unmodified terrain needs no database allocation. A chunk's spatial revision is independent of action-window accounting.

Return a bounded list of requested chunk keys per query, with scene-view authorization and cancellation. Clients request explicit visible and nearby chunk keys; the backend does not trust a client-supplied camera position as an ownership or write check. Use coarse summaries at distant zoom levels so zooming out does not allocate every intervening tile. Index spatial queries by scene and canonical chunk coordinates. Cached city production is maintained on entity/connection changes, not by scanning loaded chunks or the entire world on each login.

Footprints and road updates crossing chunks are single server transactions. Test coordinate boundaries, collision uniqueness, deterministic generation, and bounded query size. The intended user experience has no designed map edge, unlock radius, or finite land allotment; infinite terrain is generated as needed rather than allocated at startup.

### Security approach

Put authorization in the server data-access layer and database command boundary. Do not rely on a hidden button or a page-level route guard. Use the user's authenticated context for RPC calls. Enable RLS on exposed tables, grant only necessary reads, and revoke direct client writes to authoritative balances, action windows, road tiles, entity levels, portal assignments, deliveries, membership, contributions, and entitlements.

If privileged database functions are required, give them explicit actor and relationship checks, a fixed safe search path, qualified object names, and narrowly scoped execution permissions. Keep secret keys on the server. Use parameterized operations and validated definition IDs. See the official implementation references in section 17.

## 12 Minimum persistence model

Use UUID entity IDs and timezone-aware timestamps. These are logical entities; combine simple records when constraints remain explicit.

| Entity | Important fields and constraints |
|---|---|
| Profiles | Auth user ID, display name, accessibility preferences; email stays in Auth |
| Cities | Owner ID unique, name, specialty, scene ID, arrival anchor, revision, creation timestamp |
| City economy | Integer balances and fractional remainders, cached production rates, last settlement, `actions_remaining` constrained to 0 through 2, `action_window_start_at` |
| Definition catalog | Versioned costs, footprints, levels, yields, styles, portal and road definitions; read-only to players |
| Scenes | City kind for this release, seed, generator version, optional parent scene/entity; no fixed city width, height, or maximum chunk bounds |
| Map chunks | City/scene ID, integer chunk-coordinate keys, edits revision, sparse terrain overrides; generated untouched chunks need no stored row |
| Placed entities | Scene, definition, level, chunk and local coordinates, rotation, stored flag, validated appearance, revision |
| Occupied tiles | Scene, canonical chunk/local tile coordinates, solid entity ID; unique occupancy even across chunk boundaries |
| Road tiles | Scene, canonical chunk/local coordinates, style; unique road tile; no overlap with solid occupancy |
| Portals | Owned placed-entity ID, source city, required destination city, assignment revision, enabled/status, assignment timestamp; no self-destination |
| Commerce connections | Canonical unordered city pair, operational portal reference count, agreed specialties and activation data; at most one pair bonus regardless of duplicates or reverse portals |
| Delivery policies | Target city, default inbound setting, optional blocked source cities; no destination reassignment permission |
| Parcel receipts | Source, destination captured at send, portal ID and assignment revision, exact resource amounts, request ID, committed timestamp |
| Friendships | Canonical distinct city pair, initiator and status; optional contact list only |
| Circle invites | Hashed token, creator, circle, revocation timestamp; no raw token hash in snapshots |
| Circles and members | Name and invite metadata; at most eight members and one current circle membership per city; no shared construction scene |
| Hosted projects | Host city, stable site entity, definition, target/current work, status, completion time; one active project and one completion of each type per host |
| Contributions | Project, source city, optional source portal for remote work, work/resource amounts, request ID, timestamp |
| Blueprint entitlements | City, landmark type, provenance; unique city and type |
| Action ledger | Source city, window start, action kind, request ID, timestamp; one spend per successful request and at most two spends in a window |
| Command receipts | Actor, request ID, canonical payload hash, committed result; unique actor and request ID |
| Activity events | Typed owner-safe or public-safe event, city/project scope, minimal data, timestamp |

Additional invariants:

- No action balance above two, negative resource balance, or project work above its target.
- An action-window advance replaces the allowance with two and discards unused old allowance. It does not mint cumulative action credits.
- Every created portal has its first destination in the same one-action transaction. Stored portals retain assignment and revision; cosmetic JSON cannot change either.
- Every cross-city resource or work mutation has a committed source-owned portal path whose assignment matched the displayed target at send time.
- Old committed receipts remain tied to the destination actually used even if the portal later changes.
- Each unordered city pair receives at most one commerce bonus. No independent routes or friendship bonuses bypass portals.
- Roads and multi-tile structures use the same canonical chunk coordinates for collision checks, including negative and cross-chunk positions.
- A resource parcel debits and credits equal amounts. A work send consumes materials into work and never also credits a destination wallet.
- Free restoration never duplicates entities, changes a portal destination, or reapplies a completed receipt.
- Production rates equal active building yields plus eligible distinct-pair commerce yields, independent of which chunks are loaded.
- Public chunk snapshots contain no economy or account secrets. A directory visit grants no write capability.

Use one versioned authoring catalog and seed database definitions from it. The backend charges from those definitions. Frontend catalogs are display caches, not authority.

If an earlier prototype already exists, migrate owned entities and stable IDs instead of wiping cities. Preserve authored starting terrain, projects, and ledger history while changing coordinate storage. Clamp any legacy unspent allowance to two and adopt the current anchored window without a repeatable extra grant. Remove obsolete banking and independent-route code paths.

## 13 Demo and development experience

With valid backend configuration, use authenticated persistent multiplayer. Without it, the application may offer **“Local demo — simulated neighbors”** instead of a broken sign-in screen.

The demo must:

- Save locally and survive reloads when browser storage is available; show a small notice if persistence is unavailable.
- Use the same starting city, costs, two-action window rules, project targets, and portal benefits as the online version.
- Label all sample neighbors as simulated. Simulated contributions occur only through deliberate demo controls, not fabricated live notifications.
- Keep any “Advance 12 hours” or reset controls in a clearly labeled demo tools panel. Never expose clock overrides to production commands.
- Never import a demo wallet, actions, or fabricated contributions into the online economy. Offer a fresh online city when switching.

Provide `.env.example`, exact package scripts, Supabase CLI instructions, migrations, seed data, and two test-account instructions. Local multiplayer verification must use an actual local Postgres/Auth backend, not two tabs sharing a localStorage object.

Do not require an email provider for the local automated test suite; use the local authentication test facilities. Hosted email delivery configuration belongs in deployment instructions.

## 14 Acceptance tests and playtest targets

### Action windows and economy

1. Fresh onboarding grants exactly two actions, one city, the specified resources, and starter entities. Retrying cannot create a second grant.
2. Spending both actions leaves zero until the next anchored boundary, when the allowance becomes two. Leaving one unused also yields exactly two at the boundary. Absences of 24 hours, 72 hours, or seven days still yield only two current-window actions.
3. Repeated sync, reconnect, client clock changes, daylight saving, tab duplication, and delayed processing never bank actions or restart the anchor. Two simultaneous spends from a two-action allowance both succeed at most once; a third cannot succeed in the same window.
4. A command is assigned to the window at its effective locked server timestamp. Requests spanning a boundary and retrying a previously committed command cannot double-charge or re-grant actions.
5. The unchanged starting town accrues exactly 52 coins, 28 timber, and 28 stone in 24 hours. Partial settlements equal one long settlement. Unviewed distant buildings continue producing correctly.
6. Construction, upgrades, storage, restoration, portal creation, reassignment, blocking, and connection changes split old/new production rates correctly. Newly added yields are never retroactive.
7. Supply runs and ordinary purchases spend once. Invalid, unaffordable, zero-action, stale-definition, or invalid-terrain requests spend nothing. Same-ID retries return the original result; a changed payload with that ID is rejected.

### Infinite maps and roads

8. Pan, jump, build, reload, and revisit at positive and negative chunk coordinates far from the origin. Terrain is deterministic across clients and reloads, with no designed edge or land-unlock purchase.
9. Chunk arithmetic handles -1, -32, -33, 0, 31, and 32 tile boundaries correctly. Cross-chunk houses, portals, roads, and 4-by-4 project footprints persist and collide correctly.
10. Loading one viewport does not fetch the whole city. Cache limits remain bounded during long pans. Requests for excessive chunk ranges are rejected or paginated, not expanded without limit.
11. Confirming a road of 1 or 16 tiles spends one action and stone for newly added tiles only. More than 16, nonorthogonal, disconnected, occupied, or water-crossing paths are rejected without charge. An entirely existing path is a free no-op.
12. Roads render matching junctions across chunk edges. Erasing roads provides no refund; rebuilding follows the paid rule. Variant houses have identical economic rules and stable ownership.

### Portals and directory permissions

13. Two isolated authenticated accounts can find and inspect each other's infinite maps before any friendship or portal exists. Directory visits and portal traversal remain read-only and do not spend actions or create commerce by themselves.
14. Creating a portal and first assignment together spend exactly one action. There is no unassigned portal intermediate state, second activation charge, target approval action, or remote portal automatically placed on the target map.
15. Reassigning to a different city spends one action; choosing the same target is a free no-op. Repositioning, storing, restoring, and cosmetic updates cannot change its destination for free. Another player cannot retarget or use an owned portal as their own.
16. Resource sends debit and credit exactly once. Work sends charge one source action and materials, advance the proper destination-hosted project, and cost the host zero actions. A return send requires the return sender's own assigned portal.
17. Direct API calls using only a destination or project ID fail without a valid portal. Reject source-owner mismatch, stale assignment, a target project in another city, disabled/stored portal, blocked sender, and unavailable destination without a charge.
18. Race a portal retarget against a send. The send either commits to the exact destination it displayed under its original valid revision or fails without spend. It never lands silently in the new city. Reassignment does not replay old parcels.
19. Duplicate and reciprocal portals grant only one pair commerce bonus. Retargeting the last connection ends that pair's future bonus; a surviving reverse portal preserves it. A new target starts only its appropriate future bonus. There is no three-portal total limit.

### Shared construction and persistence

20. Multiple distinct players contribute through their portals to a project physically hosted on one player's map. The host's building position remains owner-controlled. Membership or friendship alone cannot bypass the portal rule.
21. Concurrent final contributions cannot overfill, charge a losing contributor, or double-award. A former circle member or reassigned-portal owner with recorded work still receives completion credit and the blueprint.
22. At most one active project and one completed project per type exist for a host. Circle joins do not duplicate rewards. Project relocation preserves its ID, work, and incoming contribution validity.
23. Direct protected table writes fail. Public directory, chunk, and project responses expose no wallet, action counters, account emails, or privileged credentials.
24. Dropped realtime events, refreshes, stale tabs, lost responses, and visibility changes converge to committed state without duplicate parcels, action spends, or work.
25. Local demo mode and simulated neighbors stay clearly labeled. Online mutations are disabled offline; demo clocks or balances cannot be imported into an online city.

### Interaction and session playtests

26. Pan, zoom, resize, touch gestures, and floating-origin shifts preserve tile hit tests. A pan cannot confirm a road, house, or portal. Keyboard controls reach equivalent placements.
27. Reduced motion and sound-off modes remain fully usable. Phone interfaces expose all necessary actions without hover, clipped sheets, or tiny targets.
28. All four project types visibly progress and finish on host maps. House upgrades, road junctions, portal destinations, parcel activity, and earned cosmetic placement are visually clear.

Measure ordinary visits from the settled city becoming usable to the player finishing their chosen progression actions; measure initial authentication and tutorial time separately.

- Target median ordinary visit: **60 to 120 seconds**, with no more than two actions available in that window.
- Target 90th-percentile ordinary progression visit: **under 300 seconds**.
- Returning after seven days provides exactly two actions, intact possessions, accrued resources, and no cleanup checklist.
- A once-daily player can build and cooperate using two actions. A twice-daily player can use each window, with no carryover between them.
- A solo player can produce every resource and finish every project. Optional browsing stays available after actions are spent without rewarding time online.

Validate these time targets with people, not button counts. Simplify menus and previews if sessions take too long. Do not solve it by granting banked actions or adding extra daily systems. Any playtest telemetry should be minimal and consented.

## 15 Implementation milestones

| Milestone | Deliverable | Exit condition |
|---|---|---|
| 1 Infinite city slice | Chunked terrain, authored origin, SVG artwork, camera, houses, roads, placement, inspection | Build a house or 16-tile road path for one action; far and negative coordinates work on desktop and phone |
| 2 Complete solo loop | Exactly-two action windows, catalog, upgrades, passive resources, storage, return summary, hosted solo projects, local demo | No-banking and offline-production fixtures pass; one or two actions complete an ordinary visit |
| 3 Persistent backend | Auth, migrations, chunk queries, transactional commands, RLS, idempotency, revisions | Separate accounts persist private state; window and collision races cannot duplicate actions or entities |
| 4 Genuine portal cooperation | Public map directory, assigned portals, paid reassignment, parcels, remote work, pair commerce, optional circles | Two real accounts view read-only, then connect and interact only through validated portal sends |
| 5 Release quality | All art and project stages, accessibility, phone input, chunk performance, offline/error states, tests and documentation | Required checks pass; session targets are tested and unresolved setup is stated precisely |

Each milestone leaves the application runnable. Complete the action-window, spatial, ownership, and send-transaction rules before expanding content. The first release includes all five milestones.

Deliver source, original local assets, migrations and seeds, meaningful tests and fixtures, README, environment example, authoritative catalog, and an architecture note explaining no-banking windows, chunked maps, and portal-gated mutations.

## 16 Scope guardrails

Do not add action banking, starter action bonuses, action overflow, catch-up credits, separate daily energy pools, paid actions, or a third action in the same window. Do not substitute a huge finite scene for chunked infinite expansion.

Do not add combat, raids, leaderboards, disasters, unhappy citizens, starvation, timed item rewards, streaks, premium currency, daily quest chains, repairs, manual harvesting, or required synchronous sessions.

Do not add independent trade routes, free portal retargeting through storage, a two-action initial portal assignment, or direct cross-map contribution endpoints. Directory access, friendship, circle membership, and portal traversal never grant arbitrary map-edit permission.

Do not expand the first release into traffic simulation, public chat, a furniture editor, cave traversal, or orbital physics. Preserve a few clear decisions per visit.

The player should feel: **I built a little more of my city, sent help through a portal, and can leave it safely until my next visit.**

## 17 Official implementation references

Gameplay rules and numbers in this specification are original design choices. Use these primary references to check implementation details against the versions actually installed:

- [Next.js data security](https://nextjs.org/docs/app/guides/data-security): server data access, authorization, and safe data passed to clients.
- [Supabase row level security](https://supabase.com/docs/guides/database/postgres/row-level-security): table grants, row policies, and protection of exposed data.
- [Supabase database functions](https://supabase.com/docs/guides/database/functions): RPC-based database commands and function execution permissions.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html): row locking and deadlock considerations for concurrent commands.

Do not copy a historical framework setup blindly. Verify current installation and authentication instructions while building, pin dependencies, and test the authorization and concurrency behavior in the actual environment.
