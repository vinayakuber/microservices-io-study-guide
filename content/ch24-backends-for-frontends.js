registerChapter({
  id: 'ch24',
  num: 24,
  title: 'Backends for Frontends',
  pattern: 'Implement a separate API gateway for each type of client, owned and operated by that client\'s team.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 24 · microservices.io /patterns/apigateway.html',
  part: 5,
  flow: [
    {
      section: 'Why one shared gateway cannot fit every client',
      color: 'orange',
      motivation: `A single one-size-fits-all API serves every client the same payload, even though each client needs different data over a different network.`,
      steps: [
        { num: 1, title: 'Clients have different needs', detail: 'A desktop page is more elaborate than a mobile page, so each wants different data.' },
        { num: 2, title: 'One API must serve all', detail: 'A single shared gateway returns the same shape to every client that calls it.' },
        { num: 3, title: 'The mismatch wastes the slowest link', detail: 'A mobile client downloads fields it never renders, over a slow mobile network.' }
      ],
      program: `// GATEWAY SIDE — one shared gateway cannot fit two clients with different needs
// PARTIES: GW = shared gateway · WEB = desktop web client · MOB = mobile client
// STATE (before):
//    fields : []                                   // the fields the shared gateway returns
//    needed : []                                   // the fields the requesting client actually renders
//    extra  : 0                                    // fields sent but not needed
// DEF: serve_product_page · CALLED BY: GW answering a mobile request
// -> request : {"client":"MOB", "product":"P-9"}   // the mobile client asks for the product page
//    step 1 · gateway sends the full desktop shape    // fields : [] -> ["title","author","price","reviews","buying_options"]
//    step 2 · mobile renders only two of them    // needed : [] -> ["title","price"]
//    step 3 · count the waste    // extra : 0 -> 3  BECAUSE the gateway sent 5 fields and the mobile client uses only 2
// <- extra : 3  · fields = 5, needed = 2, so 3 fields travel a slow mobile network for nothing
//    alt a dedicated mobile gateway existed : fields : [] -> ["title","price"] -> extra : 0 -> 0`
    },
    {
      section: 'One gateway per client',
      color: 'orange',
      motivation: `Backends for frontends defines a separate API gateway for each type of client, so each client gets an API shaped exactly for its needs.`,
      steps: [
        { num: 1, title: 'Give each client type its own gateway', detail: 'The web, mobile, and third-party clients each get their own API gateway.' },
        { num: 2, title: 'Shape each API for its owner', detail: 'Each gateway exposes an API that is best suited to its one client.' },
        { num: 3, title: 'The client team owns its module', detail: 'Each API module is developed and operated by the team that owns the client.' }
      ],
      program: `// GATEWAY SIDE — two clients hit two different gateways, each shaped for its owner
// PARTIES: WEB = desktop web client · MOB = mobile client · GW-W = Web gateway · GW-M = Mobile gateway
// STATE (before):
//    gw_web    : {owner:"public API team", hits:0}      // the web client's own gateway
//    gw_mobile : {owner:"mobile team", hits:0}          // the mobile client's own gateway
//    payload   : {}
//    total_hits : 0
// DEF: route_by_client · CALLED BY: WEB and MOB each hitting their own gateway
// -> web_request    : "GET /web/product/P-9"
// -> mobile_request : "GET /mobile/product/P-9"
//    step 1 · WEB hits GW-W    // gw_web.hits : 0 -> 1  · payload : {} -> {title:"POJOs in Action", author:"Chris Richardson", price:39.99, reviews:12}
//    step 2 · MOB hits GW-M    // gw_mobile.hits : 0 -> 1  · payload : {} -> {title:"POJOs in Action", price:39.99}
//    step 3 · tally both gateways    // total_hits : 0 -> 2  BECAUSE each request was served by its own separate gateway process
// <- output : GW-W returns 4 fields to WEB · GW-M returns 2 fields to MOB · each client gets exactly its own API
//    alt a single shared gateway existed : both requests hit one process -> total_hits : 0 -> 2 on a single gateway returning one compromise shape`
    },
    {
      section: 'Isolation buys reliability',
      color: 'orange',
      motivation: `Because each API module is its own standalone process, one misbehaving API cannot easily impact the others — and each can be observed and scaled independently.`,
      steps: [
        { num: 1, title: 'Separate processes per API', detail: 'Each API module runs as its own process, isolated from the others.' },
        { num: 2, title: 'A fault stays contained', detail: 'One misbehaving API cannot easily impact other APIs.' },
        { num: 3, title: 'Observe and scale independently', detail: 'Different modules are different processes, so they are observable and independently scalable.' }
      ],
      program: `// GATEWAY SIDE — one misbehaving module cannot take down the others
// PARTIES: GW-M = Mobile gateway · GW-W = Web gateway
// STATE (before):
//    gw_mobile : {status:"running", errors:0}     // mobile's own process
//    gw_web    : {status:"running", hits:0}       // web's separate process
// DEF: crash_one_gateway · CALLED BY: GW-M hitting an out-of-memory fault
// -> fault : {"api":"mobile", "error":"out-of-memory"}
//    step 1 · GW-M crashes    // gw_mobile.status : "running" -> "crashed"
//    step 2 · its error count rises    // gw_mobile.errors : 0 -> 1  BECAUSE the mobile API hit an out-of-memory fault
//    step 3 · GW-W still serves    // gw_web.hits : 0 -> 1  BECAUSE the web gateway runs in a different process and never saw the fault
// <- output : GW-W returns 1 page to its client while GW-M is down  · the crash is contained to one process
//    alt both APIs shared one process : the same fault crashes the single gateway -> every client loses its API at once`
    },
    {
      section: 'The duplication and bottleneck risks',
      color: 'orange',
      motivation: `Separate gateways risk duplicating common functionality and becoming a development bottleneck, so the common code should be a shared library and the update process lightweight.`,
      steps: [
        { num: 1, title: 'Common code can be duplicated', detail: 'Different gateways may each re-implement common functionality such as edge functions.' },
        { num: 2, title: 'Share the common library', detail: 'Ideally all gateways use the same stack, with common functionality in a shared library.' },
        { num: 3, title: 'Keep updates lightweight', detail: 'If updating the gateway is slow, developers are forced to wait in line — the gateway becomes a bottleneck.' }
      ],
      program: `// GATEWAY SIDE — two stacks would duplicate common functionality unless it is shared
// PARTIES: GW-M = Mobile gateway · GW-W = Web gateway · LIB = shared edge-function library
// STATE (before):
//    edge_fn : {}                              // where the auth edge function lives
// DEF: add_edge_function · CALLED BY: GW-M and GW-W both needing the same function
// -> function : "verify_access_token"          // a common function both gateways need
//    step 1 · GW-M implements it    // edge_fn : {} -> {owner:"mobile team", code:"verify_access_token"}
//    step 2 · GW-W copies it    // edge_fn : {owner:"mobile team", code:"verify_access_token"} -> {owner:"web team", code:"verify_access_token (copy 2)"}
//    step 3 · refactor into LIB    // edge_fn : {owner:"web team", code:"verify_access_token (copy 2)"} -> {owner:"shared library", code:"verify_access_token"}
// <- edge_fn : {owner:"shared library", code:"verify_access_token"}  · one shared implementation used by both gateways, the duplicate removed
//    alt the two gateways used different stacks : the code could not be shared -> the function stays duplicated in two places`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'One-size-fits-all APIs fail', content: '<p><strong>Why.</strong> Different clients need different data, and each runs over a different network.</p><p><strong>Claim.</strong> A single shared gateway cannot serve every client well, so it must either bloat one client or starve another.</p><p><strong>Grounding.</strong> The reference notes Netflix initially attempted a one-size-fits-all API, which did not work well because of the diverse devices and their needs.</p><p><strong>In the wild.</strong> Netflix\'s streaming service spans hundreds of device types.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'A gateway per client', content: '<p><strong>Why.</strong> Each client type deserves an API built for it alone.</p><p><strong>Claim.</strong> Implement a separate API gateway for each type of client, owned and operated by a single client team.</p><p><strong>Grounding.</strong> The reference solution; the pattern was pioneered by Phil Calcado and his colleagues at SoundCloud.</p><p><strong>In the wild.</strong> The public API team owns their gateway, the mobile team owns theirs, and so on.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Isolation improves reliability', content: '<p><strong>Why.</strong> Each API module is its own standalone process.</p><p><strong>Claim.</strong> The modules are isolated, so one misbehaving API cannot easily impact others; they are also more observable, independently scalable, and faster to start.</p><p><strong>Grounding.</strong> These are the reference benefits, stated alongside clearly defined responsibilities.</p><p><strong>In the wild.</strong> Different API modules being different processes makes each easier to observe.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Duplication and bottleneck risk', content: '<p><strong>Why.</strong> Several gateways may re-implement the same edge functionality, and one team\'s gate may block others.</p><p><strong>Claim.</strong> There is a risk of duplicated code, and of the gateway becoming a development bottleneck if its update process is not lightweight.</p><p><strong>Grounding.</strong> The reference warns both: different stacks risk duplicating common functionality, and the update process must be lightweight or developers wait in line.</p><p><strong>In the wild.</strong> The common functionality, such as edge functions, should live in a shared library implemented by the API gateway team.</p>' }
    ]
  },
  quiz: [
    { "question": "What does the Backends for frontends pattern define?", "options": ["A. A single gateway that serves every client", "B. A separate API gateway for each type of client", "C. A database replica per frontend", "D. A message queue per client team"], "answer": 2, "explanation": "The reference defines a separate API gateway for each type of client. A single shared gateway is exactly what the pattern replaces, and the other options are not the pattern.", "conceptRef": "A gateway per client" },
    { "question": "Who owns and operates a BFF API module?", "options": ["A. A central API gateway team", "B. The database team", "C. The client team", "D. The network operations team"], "answer": 3, "explanation": "Each API module is developed and operated by a single client team, so they can change the client and its API module without asking a shared gateway team. A central team is the one the pattern removes from the loop.", "conceptRef": "A gateway per client" },
    { "question": "Which is a stated benefit of BFF?", "options": ["A. The API modules are isolated, improving reliability and observability", "B. It guarantees a single shared database", "C. It eliminates the need to deploy any gateway", "D. It removes all code duplication"], "answer": 1, "explanation": "The reference benefits include isolation (one misbehaving API cannot easily impact others), better observability, independent scalability, faster startup, and clearly defined responsibilities. BFF still deploys gateways and can still duplicate code, ruling out C and D.", "conceptRef": "Isolation improves reliability" },
    { "question": "Which is a drawback of BFF, shared with the API gateway pattern?", "options": ["A. It forces all clients to share one API", "B. It is yet another highly available component that must be developed, deployed, and managed", "C. It cannot be scaled independently", "D. It requires every team to use a different stack"], "answer": 2, "explanation": "The reference drawback is that it is yet another highly available component to develop, deploy, and manage, plus a possible development bottleneck. Each API is independently scalable and teams ideally share one stack, ruling out C and D.", "conceptRef": "Duplication and bottleneck risk" }
  ]
});
