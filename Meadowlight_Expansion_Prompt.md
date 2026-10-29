# Meadowlight home space and exploration expansion prompt

Continue working in the existing cooperative city-builder repository. Add playable home ownership and customization, backyard gardening, a space center with rocket launches and a modular space station, and party-based exploration with a turn-based minigame.

Inspect the actual repository, existing instructions, migrations, UI, catalogs, and tests before editing. Reuse the implemented stack, artwork style, ownership model, scene system, authoritative commands, and action accounting. Preserve existing cities, houses, roads, portals, resource balances, contributions, and player accounts. This is an expansion of the running game.

The earlier specification marked these features as future work. This request moves them into the current implementation scope. Complete the features below through working gameplay and persistence. The current game has intentionally diverged from `Meadowlight_Cursor_Spec.md`; preserve the compatibility baseline below and update conflicting documentation. Do not restore obsolete first-release rules while implementing this expansion.

## 0 Preserve the game that currently exists

The changes in this section are intentional product decisions. Use this order of authority: the user's current rules and requested expansion; the repository's actual implementation for values not supplied here; this prompt's new-feature defaults; then older specifications where still compatible.

Before editing, inspect the current catalogs, command handlers, local-demo adapter, Supabase migrations/functions, resource schema, save normalization, and inspectors. Record a short baseline in the implementation plan, including exact current values and which behavior is implemented only in the demo. This prompt does not claim the live backend has already been verified.

| Existing system | Required preservation |
|---|---|
| Resource registry | Coins, **wood**, stone, **research**, and **happiness** are real balances with HUD icons, production, costs, and applicable transfers. Happiness is not merely an amenity score; research is not merely a journal entry. |
| Naming | Use wood everywhere in new UI, catalogs, payloads, and documentation. Preserve any necessary legacy save migration without creating a second resource balance. |
| Supply runs and parcels | Preserve research supply runs and existing supported research/happiness parcel sends. Read per-operation allowlists from the code; do not assume every resource is eligible for every kind of supply run or harvest. |
| Hosted projects | Preserve park, museum, municipal recreation center, skyscraper, **University**, and **Bank**, including their actual IDs, footprints, targets, start costs, work recipes, and completion effects. |
| Own-map project work | **Materials only, zero actions.** Start costs and per-work costs come from each project's current definition, including research where configured. Keep affordable contributions usable at zero actions. |
| Remote project work | **Zero actions in the existing local demo.** Preserve that behavior. Inspect the actual live command separately, retain its verified policy, and report any difference or scaffold status. Do not infer live parity or restore a one-action contribution charge from an older document. |
| Project balance | Costs vary by project. The reported park is 24 work plus a coin start cost; museum/rec targets differ from the old table; rec, University, and Bank may require research to start and/or contribute. Extract exact values from the repository. |
| Finished landmarks | Current completed landmarks produce happiness, research, or coins as configured. Preserve those yields and any eligible blueprint/replica behavior; do not force all finished landmarks to zero yield. |
| Existing gardens and parks | City flower gardens and pocket parks produce happiness over time. Preserve their actual rates, levels, and eligible/stored-state rules. |
| Banks | Clicking a finished Bank opens resource exchanges. Preserve one action per trade and the existing rate calculation that scales with eligible bank count. Do not replace it with a fixed quote or count decorative furniture as a bank. |
| City manual harvest | Clicking an eligible tree or stone pile spends one action and grants **25 wood or 25 stone**. Preserve the current node and availability rules. Do not reintroduce the old blanket ban on manual harvesting. |
| Starter state | Preserve the current starter wallet, including its happiness, and all current starter definitions. Initializing a home or new scene must not reseed the wallet. |
| Townsfolk | Preserve the current count of approximately square root of buildings times happiness, capped at eight. Keep the exact current rounding/filter rules and SMIL-only walker animation. Dispatching a party does not consume these decorative walkers. |
| UI polish | Preserve HUD and cost-line resource icons, building tooltips/tips, clear bank/portal/project selection text, and clickable-hint badges. |
| Safe fallback | Unknown project types must continue to fail softly in the client. Preserve unknown saved records and show a safe unavailable state; invalid mutations still fail without spending. |
| Core world rules | Two-action windows without banking; infinite chunked cities; houses, roads, and portals; directory and visits; local demo and Supabase scaffolding remain supported. |

Do not invent unspecified current project targets, research prices, bank formulas, or starter amounts from memory. Read their definitions and reuse the existing cost/yield helpers. Preserve Bank and University handling anywhere projects or landmarks are enumerated, rendered, migrated, or validated.

Keep action cost separate from material cost in command metadata. A material-only contribution still needs ownership or portal authorization, affordability checks, exact resource debit, idempotency, and project locking. It never spends or requires an action merely because another command uses the common action spender. New exploration and space commands remain action-charging commands even if they reuse project or scene infrastructure.

The session-length goal remains a UX target. Keep existing material-only contributions responsive and avoid unnecessary repeated dialogs; do not enforce short sessions by adding back action costs. Reuse existing contribution batching where available without changing per-unit recipes.

## 1 Rules that apply everywhere

1. **Exactly two global actions per anchored 12-hour window, with no banking.** The next window replaces the allowance with two. A player returning after a week still has only two. Keep the existing window anchor and already spent actions through the migration.
2. Every action-charging operation spends from the same owning city's counter. A house, garden, station, expedition, new tab, or minigame never has its own replenishing allowance. Existing material-only project contributions remain action-free under the baseline above.
3. Maintain the infinite personal city maps, chunk loading, exact negative and large coordinates, house and road tools, and existing resource production.
4. Initial portal creation and assignment together cost one action; reassignment costs one action. Moving or storing a portal does not erase its assignment.
5. The map directory remains read-only. Cross-player gifts, resources, and project work go through a valid source-owned portal assigned to the receiving city. A new scene or screen must not bypass this check.
6. Owners may edit their own spaces. Visitors never gain general edit rights to someone else's interior, backyard, station, or exploration party.
7. Keep progression visits around one to two minutes, with ordinary progression under five minutes. Optional creative decorating and browsing may last longer. Never force the player to stay online to finish an animation or claim a reward.
8. No plant death, crew death, oxygen emergencies, equipment decay, daily upkeep, stamina meters, expiring rewards, action bonuses, or catch-up grants. Sleeping systems resume safely after absence.

Use the existing five-resource wallet: **coins, wood, stone, research, and happiness**. All cost, yield, reward, parcel, persistence, and validation helpers must retain these keys and any additional supported registry entries. New furniture, harvested plants, and portable discoveries are inventory items. Existing research and happiness remain full resources, not inventory substitutes or separate stamina meters. The prices below are defaults for new features only; preserve all existing prices and calibrate new ones against the implemented economy.

## 2 Global action costs and free editing

Route action-charging commands through the existing authoritative spending transaction and action ledger. Material-only commands use the same authorization and atomic resource checks with an explicit action cost of zero. Do not apply a universal one-action fee to every mutation.

### Happiness for exploration and research for space

Use **happiness as the resource cost of each paid exploration decision** and **research as the resource cost of each paid space build or launch**. These costs are in addition to the operation's one global action; they do not buy extra turns. Ordinary home furnishing and garden planting keep their stated costs without an added happiness toll.

Choose small positive numeric amounts after reading the actual economy. Use these starting authoring heuristics:

```text
exploration_happiness_cost = max(1, floor(starter_happiness_production_per_12h / 4))
space_research_unit = max(1, floor(existing_research_supply_run_yield / 4))
```

Inspect the current starter entities to obtain the first rate and the actual research supply-run definition to obtain the second. If starter happiness production is zero, start the happiness cost at one and confirm that an existing accessible flower garden or park provides a positive income. Do not add a research or happiness source that requires spending that same resource before any source exists.

In the tables, **H** means the chosen happiness cost and **R** the chosen research unit. They are authoring shorthand for ordinary numeric happiness/research prices, not new currencies or player-facing labels. Record final values in the implementation plan and versioned catalog. Keep them fixed for this balance version; do not scale a player's costs dynamically with their wallet, happiness, bank count, or accumulated buildings. Preserve the bank's existing exchange-rate scaling separately.

The starter pricing target is that happiness from a modest park or flower garden supports regular exploration, while Universities and existing research supply runs support space. A low happiness or research balance pauses only the unaffordable operation. It does not damage homes, halt ordinary city production, or introduce a needs meter.


| Operation | Global actions | Resource or item rule |
|---|---:|---|
| Designate an already owned house as the primary home | 0 | No new city house or extra actions are granted |
| Enter or leave your home, backyard, station, or expedition view | 0 | Navigation only |
| Acquire one furnishing or landscaping bundle | 1 | Catalog resource cost; grant the exact listed inventory items once |
| Add one new interior room | 1 | 22 coins, 10 wood, 8 stone |
| Place, move, rotate, recolor, or store already owned decor | 0 | Preserve item identity; settle any configured yields before rate changes; never duplicate production or grants |
| Build one raised garden bed | 1 | 10 coins, 6 wood, 4 stone; four planting slots |
| Plant or replant up to four slots in one batch | 1 | 2 coins per changed slot; use available seed varieties |
| Settle matured plants and receive their one-time harvests | 0 | Automatic and idempotent; no claim button |
| Build a space center | 1 | 80 coins, 40 wood, 40 stone, and 2R research |
| Launch the founding rocket and create the station core | 1 | 50 coins, 16 wood, 24 stone, and R research |
| Launch and install one new station module | 1 total | Its base module cost plus R research, including fabrication and rocket delivery |
| Launch and install one instrument | 1 total | Instrument base cost plus R research, including delivery |
| Rearrange already owned station equipment or modules | 0 | Must preserve ownership, connectivity, occupancy, and power validity |
| Start an expedition with its first exploration choice | 1 total | H happiness; includes dispatch and the first step with no second happiness charge |
| Make another exploration movement, scan, or investigation | 1 | H happiness; same global counter and wallet, no separate expedition energy |
| Look at revealed information or leave the minigame screen | 0 | No new discovery, position advance, reward, or objective progress |
| Send a stored portable item through a city portal | 1 | Atomically transfer ownership or stack quantity to the recipient's inventory |
| Existing own-map project contribution | 0 | Its actual per-project materials/research recipe |
| Existing remote project contribution | 0 in local demo; verified current live policy otherwise | Same project recipe and current portal rules; do not infer live behavior |
| Existing city tree or stone-pile harvest | 1 | Current node rules; grants 25 wood or 25 stone |
| Existing Bank exchange | 1 | Existing quote and bank-count-based rate; include every supported resource |

Do not charge separately for dispatch and its included first step, or for fabricating, loading, launching, and attaching a module when they are one confirmed build operation. The player previews one complete outcome and its full five-resource cost before spending. Space research is charged once for the combined build-and-launch command; the expedition dispatch pays H once for its included first step.

An invalid, stale, unauthorized, or unaffordable operation spends nothing. Passive accounting may synchronize, but never refund an unrelated spend or mint additional actions.

At zero actions, retain navigation, viewing, free rearrangement of owned items, automatic maturity settlement, already revealed expedition information, and affordable action-free project contributions under the current mode policy. New purchases, bank trades, manual city harvests, and paid exploration/space operations still require an action. Having actions but insufficient H happiness or R research likewise leaves the attempted operation uncharged and paused.

## 3 Own a home and customize the inside

### Ownership and scenes

Allow a player to designate one already owned, placed residential building as their primary home. Offer an existing starter cottage by default. This is a designation of something already owned, not a new purchase or a free additional city building.

Bind an interior scene and backyard scene to the house's stable entity ID and owning city. Moving the house on the infinite map preserves both scenes. Storing the house preserves the scenes and their contents; restoring it brings back the same home. Switching primary homes never copies an old home's items or creates another starter grant.

Initialize scenes on first use. Grant one modest starter furnishing and garden kit **once per city**, with a unique persisted grant key. This item grant must not overwrite, normalize away, or reseed coins, wood, stone, research, happiness, production remainders, or existing action-window state. Newly designated houses can have empty layouts, but do not repeatedly receive free furniture. Previously customized houses retain their layouts if they are selected again.

Interiors and backyards are private by default. Owners may opt into read-only visits. Public city viewers see an Enter home action only when authorized. Sharing a view does not share a wallet, action counter, inventory management, or editing permission.

### Interior editor

Build a real cutaway room scene with visible furniture, floors, walls, doors, and placement previews. Use the current 2D renderer or a compatible orthographic room view. The result must be an editable place, not a list of owned furniture cards.

Start with an 8-by-8 interior arranged into living, sleeping, kitchen, and bathroom zones. Provide at least these furniture definitions: bed, sofa, table, chair, counter, refrigerator, shelf, desk, lamp, rug, wall art, and houseplant. Starter item quantities may be smaller than the full catalog.

Support selecting, placing, rotating, moving, recoloring, and storing items. Use appropriate floor, wall, and overlay layers: a rug can sit beneath a table, while two solid cabinets cannot occupy the same tile. Preserve usable door access. Show a readable reason for invalid placement. Stored items appear in the inventory drawer and can be restored without another purchase.

Changing to an already owned wallpaper, flooring, or color palette is free. New furnishing bundles cost one action and a stated resource amount. Define at least three bundles with exact item counts, such as a living-room set, bedroom set, and study set. A suitable starting bundle cost is 20 coins and 6 wood; distinguish bundles only when their contents justify it.

Allow an additional 4-by-4 room to attach to a valid house doorway for one action and the room cost above. Room additions must persist and maintain a connected floor plan. The interior is a stylized child scene; it does not silently enlarge the city building's footprint or overwrite a neighbor's city tiles.

Free room rearrangement must preserve paid room identities and the complete item layout. Never obtain new rooms, furniture copies, resource refunds, or another starter kit through move, store, recolor, or home-switch operations.

## 4 Backyard and garden

### Backyard editor

Start with a 12-by-12 backyard containing grass, a small seating area, one empty four-slot raised bed, and a modest once-per-city starter scenery kit. Allow fences, decorative paths, benches, planters, small trees, flower beds, and existing owned outdoor decor.

Use the same inventory and placement principles as the home. Cosmetic backyard paths are decorations; they do not manufacture paid city-road tiles or provide transferable resources. Preserve the city road tool's original rules.

An owned bed can be moved with its planting slots intact. Each slot retains the same planting-cycle ID, species, planting timestamp, maturity timestamp, and credited-harvest state. Existing cycles continue maturing while stored; new planting requires a bed placed in an owned backyard. Moving, rotating, storing, restoring, or revisiting never restarts growth or duplicates produce.

### Planting and growth

Implement at least six visually distinct varieties:

| Variety | Family | Initial maturity duration | Harvest display item |
|---|---|---|---|
| Daisy | Flower | 12 hours | Daisy bloom |
| Rose | Flower | 24 hours | Rose bloom |
| Lavender | Flower or herb | 24 hours | Lavender sprig |
| Basil | Herb | 12 hours | Basil bundle |
| Lettuce | Vegetable | 12 hours | Lettuce basket |
| Tomato | Vegetable | 24 hours | Tomato basket |

Make the common varieties available from the beginning. Do not gate basic gardening behind exploration or space. Later discoveries can unlock optional cosmetic seed varieties.

One planting confirmation may fill or replace **one to four slots** and costs one global action plus two coins per changed slot. It can mix available varieties. A zero-change batch is a no-op. Reject more than four slots without silently spending multiple actions.

Show planted, growing, and mature visuals. Compute growth from authoritative timestamps while away; no watering or fertilizing is required. Plants never die and mature harvests never expire.

Each planting cycle produces **one harvest item once at maturity**, automatically credited to inventory. The mature plant remains attractive in the garden afterward. It does not repeatedly produce a new harvest on every visit or time tick. Replanting creates a new paid cycle if the player wants another harvest or another variety.

Settle a ready harvest before a replant, uproot, or storage operation so earned items are not lost. Uprooting an immature plant is free but grants no harvest or refund. Persist a unique `(planting_cycle_id, harvest_reward)` receipt to prevent duplicate settlement across tabs and retries.

Harvest items can be displayed, collected in the garden journal, or sent as gifts. Do not introduce hunger, food requirements, perishability, or a mandatory daily harvesting routine.

### Garden happiness and existing manual harvesting

Keep existing city flower-garden and pocket-park happiness production unchanged. Add an explicit happiness yield for mature flowers in the new backyard, so home gardening can support exploration. Herbs and vegetables produce their listed harvest items; they need not inherit a flower's happiness yield.

As a starting balance, one four-slot backyard bed filled with mature flowers produces at most the current level-one city flower garden's happiness rate. Scale that bed's rate with its mature-flower fraction using the shared catalog's numeric precision and rounding rules; calculate and display the exact resulting rate. Use the existing city definition as the authoring reference and record a fixed backyard rate in the new catalog, without altering the original city rate.

Only placed, eligible backyard beds produce happiness. Stored beds keep their growth timestamps and once-only harvest rights, but produce no passive happiness while stored. Free relocation never adds another producing copy. Harvest items are inventory items; they are not a second happiness payout unless a separate explicit recipe says so.

Settle happiness at the correct rates before storage, restoration, replanting, or uprooting. During an offline interval, integrate rate changes at plant maturity timestamps: flowers begin producing at maturity, not retroactively at planting and not only when the player next opens the garden. A ready stored plant starts producing only upon eligible restoration. Do not double-count a bed's total and its individual plots.

The new backyard's automatic once-per-cycle produce settlement does **not** replace city resource harvesting. Existing city trees and stone piles still give 25 wood or stone for one action. Decorative backyard trees are not resource nodes unless their definition explicitly makes them one. Keep these commands and receipts distinct.

## 5 Space center rockets and the modular station

### Build and launch

Add a Space center to the city building catalog. It occupies 4 by 4 valid city tiles and visually includes mission control, a rocket pad, and a small assembly area. Initially allow one operational center per city. It has no upkeep or separate fuel currency. Construction costs 2R research in addition to its listed coins/wood/stone, while the founding launch costs R research. Reuse existing research production and supply-run controls; do not add a second research wallet or require a University if current research supply runs already provide an accessible path.

Its first available mission is Founding launch. Preview the rocket, cost, and station core before confirmation. One global action pays for the founding rocket, its initial core payload, launch, and placement of the station core in orbit. Create at most one owned station per city in this release.

Use a short optional, skippable launch animation after the server commits. Arrival is immediate for gameplay; the animation does not hold a transaction open or require the player to wait for another timer. Skipping, replaying, refreshing, closing the app, or receiving the response twice never changes the committed outcome.

The station is an owned child scene reached from the space center or a small scene navigator. Its core includes a docking point, four cardinal connection ports, and two power units. Show Earth or the home world in the background with a calm visual connection to the city.

Subsequent module and instrument purchases use Launch and install. The player chooses a valid orbital location first; confirmation spends one action, the listed supplies, and atomically commits delivery and installation. Show a corresponding rocket departure from the city, even when the command began in the station view. Do not require separate rocket crafting, cargo loading, or claim actions for this combined operation.

### Modular room construction

Represent the station as a connected modular layout. Each room or corridor occupies a station-grid cell and has an editable 4-by-4 interior or its appropriate exterior view. Store module IDs, grid positions, rotations, ports, and attached instruments independently of screen coordinates.

Implement these modules:

| Module | Base cost in coins / wood / stone, plus R research per new module | Function |
|---|---|---|
| Corridor | 18 / 6 / 8 | Connect rooms and shape the station |
| Habitation room | 35 / 14 / 16 | Furnishable crew living space |
| Laboratory | 40 / 12 / 20 | Supports research and survey instruments |
| Greenhouse | 30 / 18 / 12 | Supports a plant-growth instrument and decorative orbital plants |
| Observatory | 45 / 12 / 20 | Supports a telescope and observation decor |
| Solar power module | 30 / 8 / 16 | Adds four nonconsumable instrument power units |

Treat resource prices as the game's fabrication contracts. Every newly launched module, including corridors and power modules, also costs R research. All charges use the existing five-resource wallet. Preserve the University's actual research yield, Banks and their exchange rules, and research parcels. Do not introduce fuel, oxygen, maintenance, hunger, or another currency system.

A new module must connect to the core through adjacent compatible ports. Provide attachment previews, valid-port highlighting, occupancy checks, rotation, and a clear invalid-connection reason. The complete layout must remain connected to the core.

Moving an already owned room is free if its final placement leaves the entire station valid. Storing an empty noncore module is free if remaining connectivity and power remain valid; restoring uses the same module ID and costs no new action. The core cannot be stored. Never duplicate a room or trigger another rocket reward through rearrangement.

Rooms should be visibly different, with readable doors, windows, fixtures, and exterior silhouettes. Entering a room opens its actual interior for arranging owned furnishings or instruments. Keep crew motion ambient and optional.

### Instruments with real functions

Implement at least these three instruments. Initial cost is **15 coins, 4 wood, 8 stone, and R research** each, including rocket delivery. Each requires one available station power unit and an eligible room slot. An invalid power or room placement spends nothing.

- **Telescope:** fits an observatory. Each later paid rocket launch while it is operational may add one deterministic cosmetic astronomy entry to the station journal. Associate the reward with that launch receipt so animations and reloads cannot repeat it.
- **Survey console:** fits a laboratory. While operational, it supplies one extra coarse route clue with a paid exploration step. It never grants another action, an unpaid exploration movement, or the complete hidden expedition map.
- **Plant-growth chamber:** fits a greenhouse. Its first successful installation unlocks an optional space-flower seed variety for normal gardening. The knowledge is permanent and uniquely recorded; storing and reinstalling never grants item copies or repeated unlock rewards.

Core power is two; each solar module adds four. Instruments consume one each while operational. This is an installation capacity check, not a draining meter. Room movement or storing power equipment cannot leave an invalid state; reject it or require the owner to store an instrument first. No equipment is damaged and no station emergency occurs.

Friends can support a station by sending resources, including research where supported by the existing parcel handler, through portals assigned to its owning city. Those resources enter the owner's city wallet; the owner chooses and launches the orbital modules. A portal gift does not automatically create a room or bypass its rocket-build action and research cost. Existing material-only city project work keeps its current free-action policy; direct station module builds are distinct paid operations. Read-only visitors cannot edit orbital layouts or launch another player's rockets.

## 6 Parties and the exploration minigame

### Unclaimed territory on an infinite map

Exploration takes place in the player's own infinite world. Define an expedition region using the existing canonical city chunk keys. Unclaimed means the region has no permanent city development; unexplored means its expedition has not been completed. Persist these as separate state where needed.

Initialize claimed regions from existing buildings, roads, portals, and project sites. Future city development updates the relevant region metadata in the same placement transaction.

Panning over terrain is still free and does not discover loot or complete a survey. Do not add fog that blocks ordinary city building or introduce paid land expansion. Exploration reveals detailed points of interest, stories, seed varieties, and journal discoveries beyond the coarse visible terrain.

Offer nearby eligible regions with forest, cave, river, or coastal themes. Players may choose another nearby eligible region without a long camera journey. The detailed outing is its own small encounter map, not a write operation against every city tile. Existing city building remains available and owned structures cannot be deleted by an expedition event.

### Party and dispatch

Offer a three-person party with a cartographer, botanist, and engineer as starter roles. Naming and cosmetic selection are free. Do not require hiring, food, paid crew rerolls, or removing workers from productive city buildings. One party can be active at a time per city. Party members do not reduce the city's existing happiness balance or walker count merely by being selected or dispatched; the stated H cost is the only happiness debit for each exploration decision.

Preview the destination, party, first route choices, and complete cost. **Dispatch plus the first exploration step costs one global action and H happiness together.** Do not charge another H for dispatch on top of that included first decision. Starting a party must reveal and resolve a meaningful first choice; do not consume one action merely to open a minigame and another to do anything.

### Turn-based play

This turn-based outing supersedes any earlier timer-only expedition design. Time passing never advances a paid exploration step or completes the outing for the player.

Build an actual interactive **7-by-7 encounter map** with fog, a party marker, adjacent route choices, revealed terrain, event art, and a small journal. Use at least three authored encounter templates for each of the four biome families.

An outing has **four paid decisions in total**, including its dispatch decision. This is a finite scenario length, not another replenishing energy meter. Every decision consumes one of the city's two global actions for the current window and H happiness from its existing wallet. A complete outing therefore costs four actions and 4H happiness, spread across visits if desired. It is normal for an outing to span multiple windows or visits.

Each meaningful movement, scan, or investigation is a confirmed one-action, H-happiness command. Show both prices with the existing icons. Validate both balances before changing party state; insufficient happiness never consumes an action, and zero actions never consumes happiness. Do not use the action-free project contribution handler to advance an expedition. An example choice is following flowers toward a clearing versus surveying a rocky ridge. Show available coarse clues before the decision; reveal the encounter and any reward only after the server commits the paid step. Make at least two useful route options available for ordinary decision states.

Do not allow free arrow-key movement, repeated scan clicks, or a separate minigame turn allowance to reveal cells, advance the party, roll rewards, or progress an objective. Looking at the already revealed map, panning it, reading existing journal text, and leaving the screen are free.

After the fourth decision, conclude the outing automatically, record its surveyed state, return the party, and show a short summary. No fifth action is charged to return or claim its results. Generate achievable small objectives with a route reachable within the four-decision structure; a choice that misses the optional special discovery still grants its stated safe outcome.

### Safe persistence and rewards

- Save party position, step index, revealed cells, available choices, fixed encounter seed, earned discoveries, and reward receipts on the server after every step.
- At zero global actions or insufficient happiness, leave the expedition paused safely. Another window resets the shared action allowance, not the outing, its seed, or happiness. Existing parks/gardens, applicable Bank exchanges, or permitted incoming parcels supply happiness through their current rules.
- Closing the screen leaves the party safe. An optional free Recall pauses the outing without granting rewards or resetting its cells. Returning to that region resumes its saved attempt, paying only for the next meaningful step.
- A player may abandon an outing, but retain that region's seed, visited-cell state, and credited rewards. Restarting it cannot reroll encounters, recreate the first-step reward, reset four-decision progress, or refund spent actions or happiness. Viewing, recall, and returning to the city are free and do not grant happiness.
- No crew death, traps that erase inventory, equipment damage, strict countdown, or absence penalty.
- Fix randomness on the server before revealing outcomes. Do not send undiscovered cells, reward seeds, or the full hidden solution to an online client.
- Exploration rewards use the existing five-resource wallet, cosmetic seeds or decor, and journal entries. Initial base rewards may be 6 coins, 3 wood, and 3 stone per paid decision, with variants at most 12 coins, 6 wood, and 6 stone. Research-themed discoveries can also credit actual research, initially at most R per paid decision and never more than a dedicated research supply run. Include the happiness cost when comparing rewards. Do not automatically refund the H happiness cost through every reward. Any happiness reward must be an explicit balanced encounter recipe. Keep resource changes distinct from journal text, and do not allow free clicks to generate either.
- Credit each paid step's outcome once. Completion may additionally unlock a single cosmetic discovery for that region, never actions or a recurring claim reward.
- Record exact reward quantities on the committed receipt. Refresh, reconnect, replayed animation, returning, or changing party cosmetics never rolls or grants it again.

Each exploration decision should take roughly 10 to 25 seconds. A player who spends both available actions exploring should see two small meaningful outcomes, safely pause, and leave within the ordinary session target.

## 7 New items and existing cooperation

Use one owned inventory model for furniture, outdoor decor, harvested plants, produce, and portable discoveries. Distinguish unique item instances from stackable counts. A placed item cannot simultaneously exist as available inventory.

Extend portal sending with a stored portable-item payload. It costs one global action, transfers the chosen owned instance or stack quantity atomically, and arrives in the receiver's inventory without a recipient action. Support gifting garden harvests and stored home decor. Receivers choose their placement.

Enforce the same source portal, assignment revision, displayed destination, inbound permission, and idempotency checks as resource parcels. Do not transfer growing plots, home deeds, house entities, city resource nodes, productive city landmarks, University/Bank entities, station cores, station modules, or installed instruments through this portable-gift command. Use an explicit portable-item allowlist rather than treating every stored entity as a gift.

Receiving an item grants neither layout edit rights nor another copy of a blueprint, plant unlock, or starter grant. Preserve entity ownership consistently when transferring a unique item. Read-only visits to published homes and stations must never accidentally invoke an owner editor.

## 8 Persistence architecture and migration

Use additive migrations and stable IDs. Extend the current scene model to include interiors, backyards, stations, and expedition instances. Every scene has an authoritative owning city and optional parent scene or entity. Validate that these relationships agree; reject cycles and arbitrary client reassignment of an owning city.

Keep these domain records explicit:

| Records | Required state |
|---|---|
| Existing economy and projects | All five balances, rates and remainders; per-operation action/material policies; every project type, yield, Bank count rule, research supply run, and existing starter state |
| Personal home | Owning city, selected owned house, per-house interior/backyard scenes, visit privacy |
| Inventory and grants | Item owner, definition, instance ID or count, placement, unique starter and unlock grant keys |
| Rooms and decor | Scene, stable room/item IDs, placement layer, footprint, palette, occupancy and revision |
| Garden beds and plots | Stable slots, species/cycle ID, planting/ready times, credited harvest receipt, eligible/stored state, and precise happiness-rate transitions |
| Space center and station | Owning city, source center, unique station/core, scene and revision |
| Station modules and instruments | Owned identities, positions, rotations, ports, room attachments, capacity and validated power use |
| Rocket launches | Manifest/installation, exact five-resource costs including research, unique command/launch ID, journal rewards |
| Expedition region | Canonical city chunk keys, claimed/surveyed state, persistent encounter seed and attempt history |
| Party and expedition | Composition/status, step 0 through 4, position, revealed cells, journal, exact happiness debits, and resource/item reward receipts |

Preserve the existing command-receipt, action-ledger, authorization, catalog-version, revision, and database-lock conventions. Normalize costs, yields, debits, credits, bank exchanges, and parcels through the actual resource registry; do not reconstruct balances from a three-field object. Preserve operation-specific allowed resources. Do not maintain a second client-only economy for any expansion.

All paid commands derive the source city from verified ownership and atomically lock that city's shared allowance before charging. Validate scene ownership, placement, available inventory, connections or power, current garden cycle, and expedition step as relevant. A home purchase racing a rocket launch, Bank exchange, city harvest, or exploration step can consume only the actions actually remaining. Material-only project work still validates and debits its configured materials/research atomically but does not require or decrement this allowance. Never count a zero-action audit event as one of the two spent actions.

Make scene edits transactional with inventory and occupancy. Make module construction transactional with all resources including research, and expedition steps transactional with happiness, action spending, party progression, and rewards. Insufficient resources or stale revisions commit no partial debit. Preserve Bank quote/count validation and the current exchange transaction. Make room construction transactional with its catalog cost. A timeout retried with the same request ID returns the original result. Use separate immutable grant receipts for garden maturity, seed knowledge, astronomy entries, and expedition rewards.

Settle ready garden cycles and happiness rate transitions lazily during authorized synchronization or related commands. Server timestamps determine maturity and production eligibility even when scenes were not loaded. Include existing landmark and city-garden yields in the root city rate calculation. Integrate each known maturity boundary during an offline interval; do not retroactively apply a final rate to the whole interval or wait for an interior view to begin crediting it. A timer or background worker may improve presentation but must not be the authority for economic rewards.

Keep private interiors, inventory, seeds for hidden expedition content, and account state out of public map snapshots and realtime payloads. Realtime invalidates safe snapshots; it never grants rewards. Parent-scene ownership needs enforcement in the database command boundary as well as the UI.

Migration must not reset action windows, replenish actions, recreate cities, duplicate home kits, or wipe legacy content. Preserve research/happiness balances and fractional production, existing starter happiness, per-project progress and recipes, productive landmarks, Bank eligibility, and harvest nodes. Existing scenes, houses, and portal assignments remain usable. Add missing resource fields only when truly absent under an explicit versioned migration; never overwrite present values. If online services are unavailable, retain the labeled local demo and its actual contribution policy, provide complete backend migrations/setup for the new systems, and report unverified live paths and mode differences rather than claiming parity.

## 9 Presentation and controls

Integrate these systems into the city rather than opening with a large expansion dashboard:

- Click an owned residential house to designate or enter a home. Home and Backyard are adjacent scene tabs with a reliable Return to city control.
- Use a furniture drawer with visible owned counts, rotate/store controls, placement ghosts, and a camera that fits the room. Add touch-friendly confirm/cancel controls and a keyboard placement alternative.
- Make the backyard visibly lush and personal. Growth stages, planters, paths, and seating should read as a tiny garden, not progress bars alone.
- The space center shows a rocket on the pad and opens launch planning. The station view uses a calm orbital backdrop, visible connection ports, room silhouettes, editable interiors, and installed instruments.
- Exploration opens a small illustrated encounter map with readable routes, a party, revealed discoveries, and one clear action confirmation per decision.
- Keep the same global action display across views, such as 1 of 2 actions left in this window, and retain all five resource icons in a compact HUD. Cost lines must distinguish one action plus happiness, one action plus research, and material-only project work. Reuse the existing cost renderer instead of creating a three-resource expansion HUD. Changing scenes must not suggest a new budget.
- Preserve current building tips/tooltips and clickable-hint badges on Bank, Portal, and active project sites. Extend the same interaction language to enterable homes, the space center, instruments, and expedition choices without intercepting existing Bank or project clicks. Support focus/touch as well as hover.
- Preserve current SMIL-only townsfolk motion, exact happiness-based count/filter behavior, and the eight-person cap. Use compatible lightweight SVG animation for new ambient scenes and rockets; do not add a per-frame JavaScript walker simulation or repurpose decorative townsfolk as consumable expedition crew.
- Use the same eligible city-entity sets as before for walker counts and Bank exchange scaling. Interior furniture, crops, station rooms, and expedition crew are not additional city buildings or banks. Newly earned happiness may affect the existing walker formula naturally.
- Respect reduced motion and muted sound. All growth, launches, mission choices, and placement work without watching animations.
- Keep the existing soft-fail path for unknown project types. New module/item/scene types also need safe read/render fallbacks; rejected unknown mutations must not spend resources or destroy saved data.
- Keep unsupported future content out of active controls. The requested home, garden, space, station, and exploration systems must be implemented in this release.

## 10 Implementation sequence

First inspect the repository and write a short plan against these milestones. Reconcile already implemented compatible features rather than duplicating them. Continue through the milestones without pausing for routine design approval.

1. **Compatibility baseline and shared data:** inspect/report current costs, yields, resources, Bank rates, harvest commands, demo/live contribution policies, and starter state; retain their regression coverage. Then add scene ownership, additive migrations, unique grants, inventory, and the shared spender with explicit zero-action operations.
2. **Home and backyard:** designation, cutaway editor, room addition, furnishing bundles, outdoor placement, privacy, and persistent owned inventory.
3. **Gardening:** planting batches, growth visuals, authoritative maturity, once-only harvests, precise mature-flower happiness production, and portable-item portal gifts; preserve city manual harvesting.
4. **Space:** cataloged research costs, center placement, founding rocket, core scene, modular rooms, instruments, power checks, launch visuals, and room customization; preserve University yields and Bank exchanges.
5. **Exploration:** region metadata, party setup, four-decision outings, fog/clues, deterministic encounters, atomic happiness-and-action spending, actual resource rewards, and durable receipts.
6. **Verification and polish:** cross-scene concurrency, two-account permission tests, phone and keyboard controls, saved-state recovery, and ordinary-session playtests.

Every milestone leaves the existing city game runnable. Do not stop after adding tabs, static previews, or database tables. Deliver the complete playable flows and their persistence.

## 11 Acceptance checks

Run the existing relevant checks and add meaningful coverage for the new behavior. Keep existing cost/yield fixtures for all six hosted project types and verify actual resulting balances and state transitions, not only helper output against itself:

1. Two total actions can be shared across a city build, furnishing purchase, planting, rocket launch, and exploration step. A third action-charging command in the same window fails; an affordable action-free project contribution remains possible. Changing scenes, tabs, clocks, or accounts never refreshes a city's allowance. Skipped windows do not bank.
2. A home follows its stable house ID through moving and storage. Home switching and concurrent initialization grant only one starter kit. Another player cannot designate or edit it.
3. Furniture and backyard items persist; inventory and placement counts agree after move, rotate, store, restore, gifting, and a lost-response retry. Free editing cannot create new items or rooms.
4. One to four changed planting slots cost one action and the exact coins. A fifth slot or invalid variety fails atomically. Each cycle matures once and credits exactly one harvest; partial settlements and concurrent reads cannot duplicate it.
5. An absent player returns to healthy gardens and safely available earned items. Replanting/uprooting first settles earned harvests and happiness through the proper time. Maturity partway through an offline interval starts happiness at that boundary only; storage stops that yield without deleting the growth cycle. Existing city garden/park rates remain unchanged.
6. The founding launch spends one action, its coins/wood/stone, and R research, creating one core. Space-center construction spends 2R; module and instrument launches spend their configured R once. Insufficient research spends no action or other resource. Duplicate requests cannot create another station or installation.
7. Invalid module attachment, overlapping rooms, insufficient supplies or power, and disconnected rearrangements charge nothing. Valid free rearrangement preserves paid identities and instrument rewards.
8. Each instrument has its specified effect. Astronomy entries are unique per eligible launch; the plant unlock is once-only; survey hints do not reveal the full hidden map or grant a free step.
9. Dispatch includes its first choice for one action plus H happiness total. Each later meaningful decision spends one action plus H. Four decisions cost four actions and 4H, with no return/claim fee. Insufficient happiness or actions causes no partial debit, state advance, or reward. A zero-action project command cannot advance the expedition.
10. At zero actions or insufficient happiness, the expedition pauses safely. A window reset does not mint happiness. Reconnect, recall, abandonment, reentry, restyling, and lost-response retries cannot reroll a region, refund a committed cost, or duplicate rewards. Research encounter rewards credit the real research wallet once. Hidden outcomes are absent from public responses.
11. Claimed/surveyed metadata handles legacy development, negative and distant chunk keys, and simultaneous building. Exploration neither deletes city objects nor blocks the existing infinite building rules.
12. Cross-player gifts and contributions require the sender's current valid portal assignment. Browsing a home or station and being in a circle never gives edit privileges. Recipients cannot receive the same item twice or be charged an action to accept it.
13. New scenes and all five resource balances survive refresh/logout with existing production remainders intact. Online mutations are read-only offline; demo mode is labeled and preserves its zero-action remote-work policy. Do not claim an unverified live action cost or migrate fabricated demo balances online.
14. Phone, keyboard, reduced-motion, and sound-off users can complete each flow. Existing HUD/cost icons, tooltips, clickable hints, and safe unknown-type fallbacks remain functional. Townsfolk retain current SMIL-only movement and their happiness-based capped count. Ordinary visits target one to two minutes and under five; material-only contributions stay available without reintroducing action charges.


### Existing-game regression checks

- Own-map project work debits the exact current per-work recipe and zero actions even when the allowance is zero. Repeat/retry and concurrent completion cannot duplicate work or charge twice. The demo's remote equivalent also stays action-free and portal-authorized; test the actual live implementation separately if it exists.
- Park, museum, rec, tower, University, and Bank retain their current targets, start costs, per-work research/material costs, footprints, yields, and completion behavior. A park uses the current 24-work definition where confirmed; no old 6-work table or flat 5-wood/5-stone recipe is restored.
- Finished landmarks and existing flower gardens/pocket parks continue their exact configured happiness/research/coin production through reloads, storing/restoring, and new-scene navigation. Existing eligible Bank counts and resulting exchange rates do not change from merely opening a home or station.
- A Bank exchange spends exactly one action and its quoted resources; existing count-based rates still apply. A Bank trade racing an expedition or launch respects the same remaining actions and all five balances. No same-ID retry repeats a trade.
- Existing manual city harvest spends one action and grants exactly 25 wood or stone under its current availability rules. Backyard produce settlement remains a separate once-only cycle reward; decorative trees do not manufacture city resource nodes.
- Research supply runs, happiness/research parcels, starter happiness, full resource icons, and current save normalization remain intact. Never treat missing legacy fields as permission to overwrite real balances or redefine happiness as cosmetic.

Finish with a concise report of implemented features, migrations and commands needed to run them, checks actually performed, and remaining concrete limitations. Distinguish code that exists from integrations verified against an actual backend. Do not claim a feature is playable because a placeholder card or disabled button was added.
