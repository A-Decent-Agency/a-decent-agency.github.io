import { escapeHTML as esc } from './markdown.js';

const source = (repository, revision, path, label) => ({
  label, url: `https://github.com/${repository}/blob/${revision}/${path}`,
});
const issue = (repository, number, label) => ({ label, url: `https://github.com/${repository}/issues/${number}` });
const step = (id, title, outcome, test) => ({ id, title, outcome, test, state: 'proposed' });

export const REVIVAL_PLANS = [
  {
    repository: 'TheJollyLaMa/ArtFi', name: 'DecentLending / DLend', district: 'Local opportunity exchange',
    color: '#f0c078', motif: 'exchange', focus: 'Next / steward-selected revamp',
    intent: 'Give newcomers a legible route from a useful local opportunity to agreed funding, delivery, repayment and evidence. DLend is a lateral consumer of settlements infrastructure, not its owner or parent. DecentLending / DLend is the proposed product name; ArtFi remains the source repository until a migration is approved.',
    observed: 'ArtFiProtocol models requests, funded offers, creator acceptance, repayment and role-operated settlement. ArtFiSettlementRouter v2.1.0 separately tracks purpose-designated funds, approved contributors and replay-deduplicated payroll. Existing automated tests cover both; no tests or live deployments were executed in this planning pass.',
    historical: 'SmartHome page 1 describes a Collective Corner: nearby people producing complementary goods and services, plus case-by-case community-development borrowing. This motivates local opportunity discovery, not promised rates, guaranteed income or an automatic lending entitlement.',
    archive: { id: 'smarthome-4', page: 1 },
    caution: 'Rebranding is not a new token, contract deployment, repo rename or migration. The advance protocol and payroll router must not be conflated. Preserve asset units, liabilities, old obligations and receipts; disclose settlement authority, default/cancellation rules and lender risk. No yield promises or automatic approval based on an opaque reputation score.',
    sources: [
      source('TheJollyLaMa/ArtFi', 'b14e7c62931c9d2a5079d9971420c0064b8fb109', 'contracts/ArtFiProtocol.sol', 'Creator advance lifecycle / acceptOffer, repay, settleFromPayout'),
      source('TheJollyLaMa/ArtFi', 'b14e7c62931c9d2a5079d9971420c0064b8fb109', 'contracts/ArtFiSettlementRouter.sol', 'Settlement router v2.1.0 / payout, recoverFund'),
      issue('TheJollyLaMa/ArtFi', 52, 'Closed prior router upgrade / do not duplicate'),
      issue('TheJollyLaMa/ArtFi', 58, 'Open public onboarding, recovery, indexing and rewards'),
      issue('TheJollyLaMa/DecentCanopy', 20, 'Open deployment and funding-flow verification'),
      issue('TheJollyLaMa/DecentCanopy', 22, 'Open giving/receiving explanations'),
    ],
    stages: [
      step('identity', 'Identity and first useful opportunity', 'Design DLend language around local needs and services, independent of Artizen-specific onboarding.', 'A newcomer can distinguish a grant, paid job and repayable advance before connecting a wallet.'),
      step('settlement', 'Define the DLend consumer boundary', 'Keep advance liabilities in the lending lifecycle; integrate the independently planned DecentSettlementsRouter only under explicit fund, authority and receipt terms.', 'A written lifecycle distinguishes DLend obligations from router allocations; fund, accept, cancel, repay, default and recovery preserve attribution.'),
      step('onboarding', 'Safe newcomer onboarding and discovery', 'Adapt the existing public-origin/profile recovery work and rebuildable Canopy index instead of starting a second identity service.', 'First use and return from another origin succeed or explain the exact unavailable state; no private agent keys are copied.'),
      step('widget', 'Portable DLend widget', 'Plan a host-controlled request/offer/read-only flow, shared Head wallet session, exact chain/asset checks and explicit confirmation.', 'The same pinned widget works in two synthetic host dashboards; host wallet, unavailable RPC and declined signatures retain clear states.'),
      step('pilot', 'Small local pilot and accountable closeout', 'Agree a bounded newcomer pilot, receipt-based operations, contributor support and user-exit paths before a release.', 'No opportunity is labeled funded, earned or repaid without matching evidence; pilot participants can export their records.'),
    ],
    connections: [
      { to: 'entity:decent-settlements-router', label: 'DLend consumes independent settlements infrastructure', test: 'Verify the exact consumer configuration, chain, asset, fund and receipt path; sharing custody is an explicit decision.' },
      { to: 'TheJollyLaMa/DecentCanopy', label: 'DLend opportunities and evidence discovery', test: 'Verify contract deployments and request IDs before publishing funding actions.' },
      { to: 'TheJollyLaMa/DecentHead', label: 'Shared wallet/provider surface for the proposed DLend widget', test: 'Host-owned session with exact asset/chain and declined-signature tests.' },
      { to: 'TheJollyLaMa/BigNuten_Vanilla', label: 'Candidate recipient of local opportunity and funded-work flows', test: 'Separate health participation from credit eligibility and financial commitments.' },
    ],
  },
  {
    repository: 'TheJollyLaMa/jolly-sim-siddhi', name: 'JollySimSiddhi', district: 'Home and community simulation observatory',
    color: '#83d8bc', motif: 'observatory', focus: 'Discovery / staged revival',
    intent: 'Help households notice practical ways to live well and produce local value, then share chosen evidence and reproducible lessons with neighbors. Simulation should help compare possibilities, not rule households.',
    observed: 'The committed React/Express project wires home surveys, wallet/storage routes, three contextual assistants, vector-store/transcription routes and DeFi experiments. Its README identifies itself as Decent Smarthome 4.0. Existing source is a recovery lead, not a tested current deployment.',
    historical: 'SmartHome pages 1 and 4 connect household capabilities, home/environment observations, locally complementary businesses and contextual helpers. Pages 6 and 7 add weather, compost, multimedia and beehive experiments. The steward wants cadCAD integration; this pass has not established an existing cadCAD adapter.',
    archive: { id: 'smarthome-4', page: 1 },
    caution: 'Do not revive the old public email/location or health-sharing defaults wholesale. A synthetic-data baseline, per-purpose consent, recoverable storage and explicit AI-service boundaries precede real household data. Simulated returns and suggestions are not actual outcomes, medical advice or payouts.',
    sources: [
      source('TheJollyLaMa/jolly-sim-siddhi', 'e6438005b138def6cf14c858713a27f1c877ba68', 'server/server.js', 'Existing home/assistant/storage API surfaces'),
      source('TheJollyLaMa/jolly-sim-siddhi', 'e6438005b138def6cf14c858713a27f1c877ba68', 'README.md', 'SmartHome 4.0 purpose and historical milestone claims'),
      issue('TheJollyLaMa/jolly-sim-siddhi', 2, 'Open Supporter release workflow / not revival completion'),
    ],
    stages: [
      step('baseline', 'Recover one coherent runnable baseline', 'Compare existing variants without overwriting local work; identify supported frontend/server and runtime requirements.', 'A synthetic household opens, routes respond, missing services remain explicit and the chosen baseline is documented.'),
      step('household', 'Local household capability notebook', 'Keep useful home, garden, water and skills observations local by default; adapt tested backup/recovery patterns.', 'Export and restore a synthetic household; neither assistants nor public pins receive data without a separate choice.'),
      step('learning', 'Practical sensors and repeatable experiments', 'Connect CodeCamp exercises to a weather, compost or beehive example, beginning with fixture data.', 'An experiment retains units, timestamps and missing-sensor states and can be reproduced without buying tokens.'),
      step('simulation', 'cadCAD-compatible what-if sandbox', 'Define state, policies, assumptions and comparison metrics before selecting or building a simulation adapter.', 'Identical seeds reproduce the same synthetic scenario; assumptions and modeled outcomes are labeled, not live telemetry.'),
      step('community', 'Consentful local opportunity and helper loop', 'Use optional shared evidence to connect household capabilities, local demand, DLend and bounded contextual assistance.', 'A person can review, decline and leave without losing local records; proposed matches are not financial or medical determinations.'),
    ],
    connections: [
      { to: 'TheJollyLaMa/AJollyDecentCodeCamp', label: 'Home experiments as learning projects', test: 'One fixture-driven sensor lesson produces a reproducible household example.' },
      { to: 'TheJollyLaMa/ArtFi', label: 'Collective Corner / complementary local goods and services', test: 'Opt-in opportunity matching without public home coordinates or credit scoring.' },
      { to: 'TheJollyLaMa/BigNuten_Vanilla', label: 'Candidate reuse of local records and recovery patterns', test: 'Synthetic export/restore conformance, with separate purpose and consent.' },
    ],
  },
  {
    repository: 'TheJollyLaMa/DecentPilgrimages', name: 'DecentPilgrimages', district: 'Journey and local welcome trail',
    color: '#e4c18b', motif: 'trail', focus: 'Next delivery / Base V1 build', directedAt: '1 Nov 2026',
    intent: 'Make purposeful travel a route into local connection: places, missions, welcome, sponsor support and a record of what was learned or contributed.',
    observed: 'Base V1 is implemented in open, deliberately unmerged PR #6, with 56 reported receiving tests and guided Head/atlas/radio integration. The legacy-main placeholder test script is not the state of that preparation branch. No Base deployment, identified legacy migration, funds, payroll or assistant activation is established.',
    historical: 'SmartHome page 5 describes DooBetter cycling, QR onboarding and GeoRewards at places along a route. This is a thematic crossover into Pilgrimages, not proven repository ancestry or a claim that browser coordinates are trusted location evidence.',
    archive: { id: 'smarthome-4', page: 5 },
    caution: 'Browser location is optional onboarding guidance, never proof of presence; organizer approval controls rewards. Preserve old Optimism obligations while preparing a newly versioned Base contract. No private travel traces, live migration, assistant activation or payroll execution without explicit steward approval. Verified source does not guarantee warning-free wallet simulation or reputation.',
    sources: [
      source('TheJollyLaMa/DecentPilgrimages', '7b97c4ae045a2b54cfa1dccdf4bfcace2eb6f15f', 'public/contracts/DecentPilgrimage.sol', 'Existing sponsor/location/claim model'),
      source('TheJollyLaMa/DecentPilgrimages', '7b97c4ae045a2b54cfa1dccdf4bfcace2eb6f15f', 'public/scripts/main.js', 'Existing map and claim interface'),
      issue('TheJollyLaMa/DecentPilgrimages', 1, 'Open Supporter workflow / no journey acceptance implied'),
      issue('TheJollyLaMa/DecentPilgrimages', 2, 'Base contract worker / approved claims'),
      issue('TheJollyLaMa/DecentPilgrimages', 3, 'Decent experience worker / newcomer journey'),
      issue('TheJollyLaMa/DecentPilgrimages', 4, 'Contributor operations / gated payroll and helper'),
      issue('TheJollyLaMa/DecentPilgrimages', 5, 'V1 overseer / acceptance and migration gate'),
      { label: 'Open Base V1 implementation PR / unmerged', url: 'https://github.com/TheJollyLaMa/DecentPilgrimages/pull/6' },
    ],
    team: [
      { role: 'Contract worker', job: 2, responsibility: 'Version Base contracts, conserve sponsor allocations, implement organizer-approved claims and prove local-EVM behavior.' },
      { role: 'Experience worker', job: 3, responsibility: 'Adapt shared Head, wallet/IPFS, admin and personal ankhs, contextual motion, radio and bunny-hop onboarding.' },
      { role: 'Contributor operations', job: 4, responsibility: 'Wire accepted-work queue and verified receipts with steward-gated payroll; configure an optional server-side helper only after consent.' },
      { role: 'Integration overseer', job: 5, responsibility: 'Review worker evidence, test the newcomer journey and reconcile old contracts before asking the steward to authorize deployment.' },
    ],
    stages: [
      step('inventory', 'Reconcile legacy contracts and configure Base', 'Preserve legacy Optimism source/obligations; prepare a reproducible version, ABI and verification path for Base and Base Sepolia.', 'A wallet-optional fixture loads; absent deployment, wrong chain and source-version mismatch cannot enable writes.'),
      step('accounting', 'Sponsor reservations and organizer-approved claims', 'Separate funding, reserved allocations, participant approvals, confirmed claims and unused-fund recovery.', 'Local-EVM tests conserve assets and reject unauthorized approvals, duplicate claims and recovery of reserved funds.'),
      step('presence', 'Optional location and personal recovery', 'Use browser location only as opted-in journey guidance; retain useful itinerary access and user-owned profile/export controls.', 'Declined geolocation still permits onboarding; private coordinates are never automatically published or sent to an assistant.'),
      step('welcome', 'Shared Decent welcome and contributor route', 'Adapt Head, IPFS, left admin/right personal ankhs, contextual confirmations, DBusk radio, bunny-hop help and gated payroll instructions.', 'A newcomer completes a wallet-free tour, identifies accepted paid work versus free participation, and sees no payment celebration without a confirmed receipt.'),
      step('pilot', 'Overseer acceptance and Base migration gate', 'Integrate workers, optional disabled-by-default server-side helper and a bounded journey pilot before steward-authorized activation.', 'Browser and contract evidence distinguish local build, verified deployment, Supporter mint and contributor payout; no activation is inferred from setup.'),
    ],
    connections: [
      { to: 'TheJollyLaMa/ArtFi', label: 'Local opportunity on a journey', test: 'Separate travel participation from borrowing and reveal repayment terms.' },
      { to: 'TheJollyLaMa/AJollyDecentCodeCamp', label: 'Travel and learn / reproducible local projects', test: 'A journey task links to a usable lesson without requiring location publication.' },
      { to: 'TheJollyLaMa/DecentHead', label: 'Pinned shared wallet, IPFS and header experience', test: 'Verify host permissions, account/chain changes, export consent and declined signatures in Pilgrimages.' },
      { to: 'A-Decent-Agency/DBuskRadio', label: 'Opt-in journey radio', test: 'A visitor chooses to load radio; no autoplay or third-party embed request occurs before that choice.' },
    ],
  },
  {
    repository: 'TheJollyLaMa/AJollyDecentCodeCamp', name: 'A Jolly Decent CodeCamp', district: 'Learn, contribute and teach workshop',
    color: '#b8a0eb', motif: 'workshop', focus: 'Discovery / staged revival',
    intent: 'Welcome newcomers into useful coding through small shared wins: learn a tool, make a change, report a bug, contribute a tested fix and leave a clearer path for the next learner.',
    observed: 'The committed lessons include beginner Python examples such as a calendar program. The README directs learners to a Lucid map, preparation, class participation, shared experience, contributions and later token opportunities. A runnable modern curriculum or automatic reward pipeline was not established.',
    historical: 'SmartHome page 2 gives the concrete path: VS Code/Live Share, simple Python, clone the camp, branch/change/PR, bugs and debriefs, then Node/Web3 familiarity. Page 6 offers twelve Arduino weeks, beginning with blink/sensors and growing into weather, compost, performance, IoT and a capstone.',
    archive: { id: 'smarthome-4', page: 2 },
    caution: 'Keep a free, wallet-optional learning route. Old recruitment bonuses, course token prices and reward quantities are historical proposals, not current offers. Record paid-work agreements separately from learning progress; do not promise payment merely for completing a tutorial.',
    sources: [
      source('TheJollyLaMa/AJollyDecentCodeCamp', '492c4090b85e71467c789fd301a68710e854b46f', 'README.md', 'Original learner/contribution loop'),
      source('TheJollyLaMa/AJollyDecentCodeCamp', '492c4090b85e71467c789fd301a68710e854b46f', 'Class2/Calendar/MyImprovedCalendar.py', 'Existing small Python calendar exercise'),
    ],
    stages: [
      step('welcome', 'First-hour welcome and environment', 'Recover the lesson inventory and build a beginner setup with optional pair assistance.', 'A newcomer runs one small program on a documented setup without a wallet, payment or private credential.'),
      step('contribute', 'Issue, branch, test and pull request', 'Turn an actual small bug into the learn-by-contributing loop from the old map.', 'One practice change has a reproducible bug report, focused test, PR and explanatory debrief.'),
      step('sensor', 'Arduino creative/home track', 'Reuse the twelve-week outline as modules; support fixture alternatives for learners without hardware.', 'A blink/sensor example and one weather/compost/media exercise have working instructions and explicit hardware cost.'),
      step('opportunity', 'Skills into local contribution', 'Connect demonstrated work to explicitly funded jobs and DLend/local needs, without turning participation into an earnings promise.', 'A learner can tell a free exercise from a paid job, see acceptance terms and inspect a completed-work receipt.'),
      step('teach', 'Capstone and teach-forward archive', 'Let learners export their plan and document the next learner’s path; link small projects back into the Office.', 'A second learner reproduces a capstone from its public, consent-reviewed instructions and contributes one improvement.'),
    ],
    connections: [
      { to: 'TheJollyLaMa/jolly-sim-siddhi', label: 'SmartHome lessons and household capstones', test: 'Fixture-first experiment is reusable in the household notebook.' },
      { to: 'TheJollyLaMa/ArtFi', label: 'Skill-to-opportunity bridge', test: 'Explain payment and repayment conditions independently of tutorial completion.' },
    ],
  },
  {
    repository: 'TheJollyLaMa/BabelBet', name: 'BabelBet', district: 'Language and cooperative commitment exchange',
    color: '#efa0c1', motif: 'bridge', focus: 'Historical sandbox / existing build preparation only', directedAt: '10 Nov 2026',
    intent: 'Keep this historical sandbox and its preparation review distinct from the independent DLang repository and campus. Buddy accountability is separable from learning; the original two-friend $10 streak agreement is historical motivation, not a required stake. No current DLang product affiliation is implied.',
    observed: 'The historical prototype has invitation/accept/counter routes, ERC1155 challenge tokens and an unofficial Duolingo watcher. Open, deliberately unmerged PR #5 adds shared Head/ankhs, local recovery, consent-only radio and gated contributor preparation, with 16 reported receiving tests; its branch quarantines legacy provider/watcher entrypoints. No new game, oracle, wager, payout, provider or AI activation is established. Legacy identity/credential coupling is not a pattern to revive.',
    historical: 'The supplied BabelBet use-case diagram shows on-device challenge terms, counter/accept, challenge-token creation with staked funds, active/history lookup, a daily watcher, and term-based payouts. Aave/yield is a separate historical branch. The diagram is intent, not execution evidence.',
    archive: { id: 'babelbet-use-case', page: 1 },
    caution: 'Existing preparation scope: do not build a game, oracle, wagering flow or new payout contract under its acceptance. The learning and LiveKit plans were transferred to the independent DLang repository; its preview is not a release of this sandbox. Use original/licensed scene art, not copied magazine illustrations or proprietary lessons. Neither official nor unofficial Duolingo endpoints may be contacted by runtime, tests or CI. No on-chain passwords/private email, yield, stakes or payroll activation.',
    sources: [
      issue('TheJollyLaMa/DLang', 1, 'Independent DLang learning plan / transferred, not sandbox affiliation'),
      source('TheJollyLaMa/BabelBet', 'dbd3dd4719c2638b23167a1d762a3b03f7b99a22', 'README.md', 'Original challenge flow and unfinished tests/payouts'),
      source('TheJollyLaMa/BabelBet', 'dbd3dd4719c2638b23167a1d762a3b03f7b99a22', 'contracts/ChallengeToken.sol', 'Historical ERC1155 challenge representation'),
      source('TheJollyLaMa/BabelBet', 'dbd3dd4719c2638b23167a1d762a3b03f7b99a22', 'index.js', 'Historical watcher / not a supported production oracle'),
      issue('TheJollyLaMa/BabelBet', 1, 'Open Supporter workflow / not a challenge-engine release'),
      issue('TheJollyLaMa/BabelBet', 2, 'Preparation worker / shared Decent experience'),
      issue('TheJollyLaMa/BabelBet', 3, 'Gated contributor payroll and provider etiquette'),
      issue('TheJollyLaMa/BabelBet', 4, 'Preparation overseer / offline and build gates'),
      { label: 'Open preparation PR / unmerged, not game launch', url: 'https://github.com/TheJollyLaMa/BabelBet/pull/5' },
    ],
    team: [
      { role: 'Preparation worker', job: 2, responsibility: 'Refresh the shared Decent shell and newcomer experience while keeping every provider, wager and legacy watcher disabled.' },
      { role: 'Contributor operations', job: 3, responsibility: 'Prepare steward-reviewed payroll queues/receipts and explain free participation, accepted work and future provider etiquette.' },
      { role: 'Integration overseer', job: 4, responsibility: 'Prove the no-Duolingo boundary and shared UI behavior; retain unresolved game decisions for a separately authorized build.' },
    ],
    stages: [
      step('terms', 'Shared Decent preparation shell', 'Adapt supported Head, wallet/IPFS, ankhs, about/help, contextual reduced-motion decoration and opt-in DBusk radio.', 'The wallet-optional preparation shell works without connecting a provider, starting a challenge or requesting a stake.'),
      step('evidence', 'Disable provider access and document etiquette', 'Quarantine legacy watcher/provider entrypoints; record permission, supported access, rate limits, caching, backoff and outage prerequisites.', 'Runtime, tests and CI make no official or unofficial Duolingo calls, including when legacy environment flags are present.'),
      step('challenge', 'Personal profile and bunny-hop onboarding', 'Offer user-owned profile/export recovery and explain historical versus currently supported surfaces; do not implement a new challenge lifecycle.', 'A newcomer can restore a synthetic profile and identify unavailable game features without providing credentials or publishing personal information.'),
      step('settle', 'Steward-gated contributor payroll preparation', 'Adapt accepted-work queue validation and verified-receipt workflow without deploying a game payout engine or activating transfers.', 'An empty queue validates; unapproved work and absent funding never appear paid, and instructions explain private contributor registration.'),
      step('opportunity', 'Preserve the historical boundary', 'Retain the preparation acceptance and historical evidence separately from the independently published DLang application.', 'The independent DLang campus links its own source, preview and launch gates; this sandbox never claims its delivery or a new watcher, wager or learning outcome.'),
    ],
    connections: [
      { to: 'TheJollyLaMa/BigNuten_Vanilla', label: 'Candidate challenge lifecycle and receipt patterns', test: 'Adapt source-only engine tests without assuming live deploy or identical assets.' },
      { to: 'TheJollyLaMa/DecentPilgrimages', label: 'Language practice and local welcome on journeys', test: 'A non-wagering exchange works without public travel traces.' },
      { to: 'TheJollyLaMa/AJollyDecentCodeCamp', label: 'Learn together / cooperative accountability', test: 'One free practice cohort uses agreed terms without a betting requirement.' },
      { to: 'TheJollyLaMa/DecentHead', label: 'Shared Decent preparation shell', test: 'Verify wallet-optional help, lifecycle cleanup and user-owned IPFS/export consent in BabelBet.' },
      { to: 'A-Decent-Agency/DBuskRadio', label: 'Opt-in preparation radio', test: 'Radio stays unloaded until a visitor explicitly chooses it; no autoplay accompanies onboarding.' },
    ],
  },
];

export const ROUTER_PLAN = {
  entityId: 'decent-settlements-router', repository: 'TheJollyLaMa/ArtFi',
  name: 'DecentSettlementsRouter', district: 'Shared settlements / public ledger infrastructure',
  color: '#8ddbea', motif: 'settlements', focus: 'Now / financial visibility and architecture decision',
  intent: 'An independent infrastructure entity serving lateral dapps, not a subsidiary of DLend. Make fund purpose, custody, authority, attribution and distribution visible before deciding which consumers should share a contract.',
  observed: 'ArtFiSettlementRouter v2.1.0 manages named fund/asset allocations, approved contributors, role-operated payout/recovery and globally deduplicated work references. Its source lives in ArtFi; the source repository is not product ownership. The steward reports substantial recent use; this planning pass has not independently reconciled deployments, consumers or transaction totals.',
  historical: 'The founding maps connect useful work, mutual support and local opportunity. The shared ledger must show where support goes without making money the parent of music, health, travel, learning or play.',
  archive: null,
  caution: 'Existing operation is not a new proposed deployment. The outlined levels describe the makeover, not a claim that the router is unbuilt. Named allocations share a contract balance and role/pause policy; they are not separate custody contracts. No balances, transaction volume, verified consumer paths, repo rename, fund movement or redeployment are inferred here. An architecture decision and migration approval come first.',
  sources: [
    source('TheJollyLaMa/ArtFi', 'b14e7c62931c9d2a5079d9971420c0064b8fb109', 'contracts/ArtFiSettlementRouter.sol', 'Existing router / allocations, roles and events'),
    issue('TheJollyLaMa/ArtFi', 62, 'Independent identity, public ledger, custody decision and coordinated migration'),
    issue('TheJollyLaMa/DecentCanopy', 17, 'Reusable project, fund, contract and evidence schema'),
    issue('TheJollyLaMa/DecentCanopy', 20, 'Verify deployments and public event sources'),
  ],
  stages: [
    step('inventory', 'Identify deployments and reconcile public money paths', 'Inventory chain/address/version/roles, fund IDs, assets and actual consumers; reconcile deposits, payouts, recoveries and remaining allocations.', 'A chain-qualified per-asset ledger conserves value, deduplicates receipts and labels partial or unavailable history rather than zero.'),
    step('visibility', 'Independent tower and public fund observatory', 'Expose consumer, fund, contract and receipt relationships outside the ArtFi/DLend view with read-only portable records.', 'A visitor finds the router without a wallet and follows an evidenced funding/payout path; proposed lines never masquerade as transactions.'),
    step('custody', 'Shared, separate or hybrid custody decision', 'Compare per-dapp/per-fund contracts with a shared router and shared evidence over isolated custody; document authority and failure blast radius.', 'A reviewed decision explains fund isolation, shared roles/pause, sponsor restrictions, costs, exit and which consumers intentionally share terms.'),
    step('migration', 'Makeover and coordinated redeployment rehearsal', 'Inventory ABIs, bots, consumers and indexers; preserve historical addresses, obligations and work-reference history across cutover.', 'Synthetic migration tests conserve each asset and prevent cross-deployment double payment; deployment order and separate transaction approval are recorded.'),
    step('continuity', 'Human priorities, user exits and continuity', 'Attribute support to useful human outcomes; provide exports, offline reconciliation, unavailable-admin procedures and succession planning.', 'A user can retain records and inspect authority, restrictions and recovery routes without a token; digital failure never produces fabricated settlement success.'),
  ],
  connections: [
    { to: 'TheJollyLaMa/DecentCanopy', label: 'Independent public router / fund / receipt discovery', test: 'Publish only reviewed chain-qualified source evidence; retain unavailable and partial history.' },
    { to: 'A-Decent-Agency/a-decent-agency.github.io', label: 'Public financial visibility and human-needs planning', test: 'Router has its own entity ID and tower without duplicating ArtFi cards, releases or financial totals.' },
  ],
};
export const PLANNING_PLANS = [...REVIVAL_PLANS, ROUTER_PLAN];

export function planningEntityKey(project) {
  return project?.entityId ? `entity:${project.entityId}` : project?.repository?.toLowerCase();
}

export const HUMAN_PRIORITIES = [
  { id: 'livelihood', title: 'Livelihood / money and useful exchange',
    direction: 'Make support, paid work, goods, obligations and distribution understandable. Money is a means of agency, not the parent of every other need.',
    projects: ['entity:decent-settlements-router', 'TheJollyLaMa/ArtFi', 'TheJollyLaMa/DecentMarket', 'TheJollyLaMa/DecentBusking'] },
  { id: 'health', title: 'Health / nutrition, exercise and care',
    direction: 'Keep BigNuten primary. Support enjoyable participation and user-owned records without tying health disclosure to borrowing eligibility.',
    projects: ['TheJollyLaMa/BigNuten_Vanilla', 'TheJollyLaMa/jolly-sim-siddhi'] },
  { id: 'joy', title: 'Joy / music, entertainment, sport and play',
    direction: 'Keep room for music and play that does not require wagering, buying a token or proving productivity.',
    projects: ['TheJollyLaMa/DecentBusking', 'A-Decent-Agency/DBuskRadio', 'TheJollyLaMa/BabelBet', 'TheJollyLaMa/BigNuten_Vanilla'] },
  { id: 'understanding', title: 'Understanding / native tongues, learning and knowledge',
    direction: 'Build language access, teach-forward lessons and cooperative exchange; keep a free, wallet-optional learning path.',
    projects: ['TheJollyLaMa/BabelBet', 'TheJollyLaMa/AJollyDecentCodeCamp', 'TheJollyLaMa/DecentHead'] },
  { id: 'essentials', title: 'Essentials / clean food, water and appropriate care',
    direction: 'Explore household, garden and environmental learning. Practical emergency or health guidance needs qualified sources and local context, not an unverified diagram claim.',
    projects: ['TheJollyLaMa/jolly-sim-siddhi', 'TheJollyLaMa/BigNuten_Vanilla', 'TheJollyLaMa/AJollyDecentCodeCamp'] },
  { id: 'refuge', title: 'Refuge / shelter, privacy and chosen visibility',
    direction: 'Let people be seen when they choose and withdraw when they need. Household and travel data must not become compulsory public evidence.',
    projects: ['TheJollyLaMa/jolly-sim-siddhi', 'TheJollyLaMa/DecentPilgrimages', 'TheJollyLaMa/DecentCanopy'] },
  { id: 'connection', title: 'Connection / belonging even when isolated',
    direction: 'Connect people through accessible music, local hosts, useful work and optional sharing, including low-bandwidth and exportable plans.',
    projects: ['TheJollyLaMa/DecentCanopy', 'TheJollyLaMa/DecentBusking', 'TheJollyLaMa/DecentPilgrimages', 'TheJollyLaMa/AJollyDecentCodeCamp'] },
  { id: 'continuity', title: 'Continuity / when the lights or ledgers go out',
    direction: 'Plan user-owned backups, offline records, emergency contacts, succession and administrator-unavailability procedures. Preserve analog culture and practical skills; digital rewards cannot replace essential care.',
    projects: ['entity:decent-settlements-router', 'A-Decent-Agency/a-decent-agency.github.io', 'TheJollyLaMa/jolly-sim-siddhi', 'TheJollyLaMa/AJollyDecentCodeCamp'] },
];

export function renderHumanPriorities(project = null) {
  const key = planningEntityKey(project);
  const needs = HUMAN_PRIORITIES.filter(need => !project || need.projects.some(value => value.toLowerCase() === key));
  const name = value => {
    const plan = PLANNING_PLANS.find(plan => planningEntityKey(plan) === value.toLowerCase());
    return plan?.name || (value === 'A-Decent-Agency/a-decent-agency.github.io' ? 'Agency Office' : value.split('/')[1]);
  };
  return `<section class="human-priorities"><p>Overlapping human-needs lenses, not a universal ranking, financial eligibility score or proof of outcomes.
    BigNuten's existing build and router work retain their evidence and gates. Pilgrimages is a steward-selected Base V1 build;
    BabelBet's current build is preparation only; DLang is its planned visual-scene and simultaneous-multilingual direction, not a delivered game. Duolingo access remains disabled. The other campuses retain their staged plans,
    not a promise to launch everything at once.</p>
    <ul>${needs.map(need => `<li data-human-priority="${need.id}"><h4>${esc(need.title)}</h4><p>${esc(need.direction)}</p>
      <div class="campus-neighbors">${need.projects.map(value => `<button type="button" data-human-site="${esc(value.toLowerCase())}">${esc(name(value))}</button>`).join('')}</div></li>`).join('')}</ul>
    <p>These associations are planning direction, not tested integrations. Continuity and accessible participation apply across all domains.</p></section>`;
}

export function revivalPlan(repository, entityId) {
  return PLANNING_PLANS.find(plan => entityId ? plan.entityId === entityId
    : !plan.entityId && plan.repository.toLowerCase() === repository?.toLowerCase()) || null;
}

export function renderRevivalPlan(site) {
  const plan = revivalPlan(site?.project?.repository, site?.project?.entityId);
  if (!plan) return '';
  return `<section class="revival-plan" data-revival-plan="${esc(plan.entityId ? planningEntityKey(plan) : plan.repository)}">
    <h4>${esc(plan.district)} / proposed buildout</h4>
    <p><b>${esc(plan.focus)}</b> / steward direction recorded ${esc(plan.directedAt || '31 Oct 2026')}. Proposed levels are not delivered floors.</p>
    <p>${esc(plan.intent)}</p>
    <details><summary>Existing work / implementation boundaries</summary><p>${esc(plan.observed)}</p></details>
    <details><summary>Founding-map intention</summary><p>${esc(plan.historical)}</p>
      ${plan.archive ? `<button data-revival-archive="${esc(plan.archive.id)}">Read the original historical map</button>` : ''}
      ${plan.archive?.id === 'smarthome-4' ? `<a href="./studio/archive.html?page=${plan.archive.page}" target="_blank" rel="noopener noreferrer">Open local PDF at page ${plan.archive.page}</a>` : ''}</details>
    ${plan.team ? `<details data-revival-team><summary>Workers and overseer / public acceptance jobs</summary>
      <p>Roles describe the scoped work, not paid appointments or autonomous background services. Contributors agree acceptance terms with the steward before beginning paid work.</p>
      <ul>${plan.team.map(member => `<li><b>${esc(member.role)}</b> — ${esc(member.responsibility)}
        <a href="https://github.com/${esc(plan.repository)}/issues/${member.job}" target="_blank" rel="noopener noreferrer">Acceptance job #${member.job}</a></li>`).join('')}</ul>
      <p>Queue preparation is not payment. The steward approves contributor registration and funding; only verified transaction receipts prove settlement.</p></details>` : ''}
    <details><summary>${plan.stages.length} proposed levels / acceptance tests</summary><ol class="revival-stages">${plan.stages.map((stage, index) => `<li data-revival-stage="${esc(stage.id)}"><b>Plan level ${index + 1} / ${esc(stage.title)}</b><small>PROPOSED / not delivered</small>
      <p>${esc(stage.outcome)}</p><p><strong>Acceptance:</strong> ${esc(stage.test)}</p></li>`).join('')}</ol></details>
    <details><summary>Limits and activation gates</summary><p class="revival-caution">${esc(plan.caution)}</p></details>
    <details><summary>Public source and existing issue signposts</summary><ul>${plan.sources.map(entry => `<li><a href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer">${esc(entry.label)}</a></li>`).join('')}</ul></details>
  </section>`;
}
