registerChapter({
  id: 'ch12',
  num: 12,
  title: 'Polling Publisher',
  pattern: 'Publish outbox messages to the broker by polling the database outbox table on an interval.',
  aka: 'Chris Richardson · Microservice Patterns Ch.12 · microservices.io /patterns/data/polling-publisher.html',
  part: 4,
  flow: [
    {
      section: 'Poll the outbox table',
      color: 'orange',
      motivation: `Once the Transactional Outbox pattern has stored events in the database, something must move them to the broker; polling the outbox table with a plain SQL query is the simplest relay.`,
      steps: [
        { num: 1, title: 'Select unsent rows', detail: 'A relay process runs a query for outbox rows that have not yet been sent.' },
        { num: 2, title: 'Publish each row', detail: 'The relay publishes each returned message or event to the broker.' },
        { num: 3, title: 'Mark the row sent', detail: 'The relay updates the row so the next poll skips it.' }
      ],
      program: `// RELAY SIDE — one poll cycle moves unsent outbox rows to the broker
// GOAL (what this is FOR): publish every stored event to the broker exactly once, without a transaction spanning the broker.
//    THE NAIVE WAY (why we build anything at all): write to the database and the broker in one transaction; the broker
//    is not transactional with the database, so a crash between the two loses or duplicates events. We replace that with
//    an outbox table the relay drains on a timer.
// PARTIES: RLY = relay · DB = PostgreSQL 16 @ orders-db-1 · BRK = message broker
// STATE (before):
//    outbox : [ (1, "E1", sent=false), (2, "E2", sent=false) ]
//    WHY outbox exists: without it, the event lives only in the application's hand and vanishes if the process dies
//    before publishing; with it, the event is a durable row the relay can find again and again until it is sent.
//    published : [ ]
//    WHY published exists: without it, "which rows went out this poll?" is untracked; with it, the relay records each
//    row it handed to the broker, so a poll's work is a list, not a guess.
// DEF: poll_once · CALLED BY: a timer firing every 100 ms
// -> query : SELECT * FROM outbox WHERE sent=false   // returns [ (1,"E1",sent=false), (2,"E2",sent=false) ]
//    WHO chose 100 ms: the relay operator, not the data. 100 ms here only to make the trace's poll a concrete tick; a
//    production relay often polls every 1 to 10 seconds — shorter republishes sooner, longer adds delivery latency.
// BUILD PHASE · run once at write time
//    the outbox pattern wrote these rows once -> outbox = [ (1,"E1",sent=false), (2,"E2",sent=false) ]
// QUERY PHASE · per poll
//    step 1 · fetch rows    : rows : [ ] -> [ (1,"E1",sent=false), (2,"E2",sent=false) ]
//    -> input  : rows = [] (query = "SELECT * FROM outbox WHERE sent=false")
//    <- output : rows = [ (1,"E1",sent=false), (2,"E2",sent=false) ]   BECAUSE the DB returns the two unsent outbox rows
//    step 2 · publish row 1 : published : [ ] -> [ "E1" ]
//    -> input  : rows = [ (1,"E1",sent=false), (2,"E2",sent=false) ] (published = [])
//    <- output : published = [ "E1" ]   BECAUSE the relay hands row 1's event E1 to the broker
//    step 3 · mark row 1    : outbox : [(1,"E1",sent=false),(2,"E2",sent=false)] -> [(1,"E1",sent=true),(2,"E2",sent=false)]
//    -> input  : outbox = [(1,"E1",sent=false),(2,"E2",sent=false)] (row_id = 1)
//    <- output : outbox = [(1,"E1",sent=true),(2,"E2",sent=false)]   BECAUSE the relay sets row 1's sent flag to true
//    step 4 · publish row 2 : published : [ "E1" ] -> [ "E1", "E2" ]
//    -> input  : published = [ "E1" ] (row = (2,"E2",sent=false))
//    <- output : published = [ "E1", "E2" ]   BECAUSE the relay hands row 2's event E2 to the broker
//    step 5 · mark row 2    : outbox : [(1,"E1",sent=true),(2,"E2",sent=false)] -> [(1,"E1",sent=true),(2,"E2",sent=true)]
//    -> input  : outbox = [(1,"E1",sent=true),(2,"E2",sent=false)] (row_id = 2)
//    <- output : outbox = [(1,"E1",sent=true),(2,"E2",sent=true)]   BECAUSE the relay sets row 2's sent flag to true
// TRACE (one run, k = 2 unsent rows):
//    poll  | rows fetched               | published        | outbox state
//    t=0   | [ (1,"E1"), (2,"E2") ]     | [ "E1", "E2" ]   | both rows sent=true
// CORRECTNESS (drain invariant): each poll selects only sent=false rows, publishes them, then flips each
//    to sent=true, so a row is published exactly once and the next poll's SELECT sees 0 unsent rows.
// VARIANTS (when to pick which):
//    per-row mark-sent            -> mark each row right after its publish, one update per row, no extra space        (use when the broker may drop a message)   <- THIS ONE
//    batch mark-sent              -> publish all rows then mark all at once, one update per row, keep one list of k rows       (use when the broker acks in bulk)
//    transactional poll-publish   -> publish + mark in one transaction, one update per row                         (use when a duplicate is intolerable)
// <- output : BRK received [ "E1", "E2" ] · outbox now fully sent`
    },
    {
      section: 'Publishing in order is tricky',
      color: 'orange',
      motivation: `The relay must reproduce the order the application wrote events in, but a naive poll without an explicit ordering can hand the broker events out of order.`,
      steps: [
        { num: 1, title: 'Order by a sequence', detail: 'The relay orders unsent rows by their outbox id so earlier events are read first.' },
        { num: 2, title: 'Watch the query order', detail: 'Without an ORDER BY, the database may return rows in any order, not commit order.' },
        { num: 3, title: 'Add ORDER BY id', detail: 'Ordering the query by id makes the poll reproduce the insertion sequence.' }
      ],
      program: `// RELAY SIDE — the same aggregate's two events must reach the broker in commit order
// GOAL (what this is FOR): reproduce the order events were committed, so a downstream consumer sees E1 before E2.
//    THE NAIVE WAY (why we build anything at all): run SELECT with no ORDER BY and trust the database to hand rows back
//    in insertion order; the database is free to return them in any order. We replace that trust with an explicit ORDER BY id.
// PARTIES: RLY = relay · DB = PostgreSQL 16 @ orders-db-1 · BRK = message broker
// STATE (before):
//    outbox : [ (1, "E1", sent=false), (2, "E2", sent=false) ]
//    WHY the order rule exists: id is an autoincrement that grows in commit order, so "id 1 before id 2" IS "E1 before
//    E2"; ordering the poll by id is the only way to hand the broker the sequence the aggregate actually wrote.
//    published : [ ]
// BUILD PHASE · run once at write time
//    the outbox pattern wrote these rows once -> outbox = [ (1,"E1",sent=false), (2,"E2",sent=false) ]
// DEF: poll_without_order · CALLED BY: the relay running a query with no ORDER BY
// -> query : SELECT * FROM outbox WHERE sent=false   // returns rows in DB order, here id 2 first
//    step 1 · publish id 2 : published : [ ] -> [ "E2" ]     BECAUSE the query returned id 2 before id 1
//    -> input  : published = [] (row = (2,"E2",sent=false))
//    <- output : published = [ "E2" ]   BECAUSE the query returned id 2 before id 1
//    step 2 · publish id 1 : published : [ "E2" ] -> [ "E2", "E1" ]
//    -> input  : published = [ "E2" ] (row = (1,"E1",sent=false))
//    <- output : published = [ "E2", "E1" ]   BECAUSE the query returns id 1 after id 2
// <- output : BRK receives [ "E2", "E1" ] · order WRONG (E1 should precede E2)
// DEF: poll_with_order · CALLED BY: the relay adding ORDER BY id to the same query
// QUERY PHASE · per poll
// -> query : SELECT * FROM outbox WHERE sent=false ORDER BY id ASC   // returns id 1 then id 2
//    step 1 · publish id 1 : published : [ ] -> [ "E1" ]     BECAUSE ORDER BY id returns the committed-first row first
//    -> input  : published = [] (row = (1,"E1",sent=false))
//    <- output : published = [ "E1" ]   BECAUSE ORDER BY id returns the committed-first row first
//    step 2 · publish id 2 : published : [ "E1" ] -> [ "E1", "E2" ]
//    -> input  : published = [ "E1" ] (row = (2,"E2",sent=false))
//    <- output : published = [ "E1", "E2" ]   BECAUSE ORDER BY id returns id 2 after id 1
// TRACE (one run, k = 2 events):
//    query                            | published        | order
//    SELECT ... WHERE sent=false      | [ "E2", "E1" ]   | WRONG (no ORDER BY)
//    SELECT ... ORDER BY id ASC       | [ "E1", "E2" ]   | CORRECT
// CORRECTNESS (order lemma): ORDER BY id reads rows in id order, and id grows in commit order, so the
//    poll publishes E1 (id 1) before E2 (id 2) — exactly the insertion sequence, never the reversed order.
// VARIANTS (when to pick which):
//    ORDER BY outbox id           -> sort by the autoincrement id, one sort of k rows per poll, keep one ordered list of k rows      (use when id = commit order)   <- THIS ONE
//    ORDER BY event timestamp     -> sort by the domain timestamp, one sort of k rows per poll, keep one ordered list of k rows      (use when wall-clock order is the contract)
//    partition by aggregate       -> publish each aggregate's events in id order, one sort of k rows per poll    (use when cross-aggregate order is irrelevant)
// <- output : BRK receives [ "E1", "E2" ] · order CORRECT`
    },
    {
      section: 'Any SQL database, not every NoSQL store',
      color: 'orange',
      motivation: `Polling is portable because it only needs a standard query, but a database that cannot express the unsent-row query cannot use this relay.`,
      steps: [
        { num: 1, title: 'A plain SELECT is enough', detail: 'Any SQL database exposes the outbox table to a standard query for unsent rows.' },
        { num: 2, title: 'NoSQL may lack the query', detail: 'Some NoSQL stores cannot query across records for the unsent outbox property.' },
        { num: 3, title: 'Use log tailing there', detail: 'For those stores, transaction log tailing is the alternative relay.' }
      ],
      program: `// RELAY SIDE — polling needs a queryable outbox: any SQL database has it, some NoSQL stores do not
// GOAL (what this is FOR): know which events still need publishing by asking one store-wide question, not by hunting per record.
//    THE NAIVE WAY (why we build anything at all): give each stored event its own sent flag and read them one at a
//    time; with no store-wide "which are unsent?" query, the relay has no list to drain. We replace that hunt with a table the relay can SELECT.
// PARTIES: RLY = relay · SQLDB = MySQL 8 @ orders-db-1 · NOSQL = MongoDB 7 @ orders-nosql-1 · BRK = message broker
// DEF: outbox — the table of stored events awaiting publication to the broker = row (1, "E1", sent=false)
// DEF: sql — the queryable relational access an SQL database gives the outbox = "SELECT * FROM outbox WHERE sent=false" returns 1 unsent row
// STATE (before):
//    outbox_sql : [ (1, "E1", sent=false) ]
//    outbox_nosql : { "rec-9" : { "event" : "E1", "sent" : false } }
//    published : [ ]
//    WHY the queryable outbox matters: SELECT ... WHERE sent=false needs one table with a sent column; a per-record
//    property with no global sent index answers "which are unsent?" with nothing, so no rows ever reach the broker.
// DEF: poll_sql · CALLED BY: the relay against MySQL
// -> query : SELECT * FROM outbox WHERE sent=false    // matches : 1 unsent row
//    step 1 · publish E1 : published : [ ] -> [ "E1" ]          BECAUSE MySQL returns the one unsent row
//    -> input  : published = [] (outbox_sql = [ (1, "E1", sent=false) ])
//    <- output : published = [ "E1" ]   BECAUSE MySQL returns the one unsent row
//    step 2 · mark sent  : outbox_sql : [(1,"E1",sent=false)] -> [(1,"E1",sent=true)]
//    -> input  : outbox_sql = [(1,"E1",sent=false)] (row_id = 1)
//    <- output : outbox_sql = [(1,"E1",sent=true)]   BECAUSE the relay sets row 1's sent flag to true
// <- output : BRK receives [ "E1" ] · SQLDB supports polling
// DEF: poll_nosql · CALLED BY: the relay against a NoSQL store with no unsent-row query
// -> query : SELECT * FROM outbox WHERE sent=false    // matches : 0 rows (the query cannot be expressed)
//    step 1 · publish nothing : published : [ ] -> [ ]  (0 messages sent)   BECAUSE the outbox is a per-record property with no global sent index
//    -> input  : query = "SELECT * FROM outbox WHERE sent=false" (matches = 0 rows)
//    <- output : published = [ ]  (0 messages sent)   BECAUSE the outbox is a per-record property with no global sent index
// <- output : BRK receives 0 messages · NOSQL cannot poll, so the relay uses transaction log tailing instead`
    }
  ],
  interview: [
    {
      scenario: "You have applied the Transactional Outbox pattern and your order service now stores events in a database table, but nothing moves them to the message broker yet. The downstream consumers are starved because the events never leave the database.",
      q: "What is the Polling Publisher, and how does one poll cycle move unsent outbox rows to the broker?",
      solution: "A relay process repeatedly queries the outbox table for unsent rows, publishes each row to the broker, then marks the row sent so the next poll skips it.",
      components: [
        "Outbox table — events awaiting publication",
        "Relay process — runs the poll on an interval",
        "Unsent-row query — SELECT ... WHERE sent=false",
        "Mark-sent update — sets sent=true per published row",
        "Message broker — receives the published events"
      ],
      
      code: `// RELAY SIDE — one poll cycle drains two unsent outbox rows into the broker
// PARTIES: RLY = relay process · DB = PostgreSQL 16 @ orders-db-1 (outbox table) · BRK = message broker
// DEF: outbox — the table of stored events awaiting publication = [ (10, "OrderCreated", sent=false), (11, "PaymentAuthorized", sent=false) ]
// STATE (before):
//    outbox : [ (10, "OrderCreated", sent=false), (11, "PaymentAuthorized", sent=false) ]
//    published : [ ]
// DEF: poll_once · CALLED BY: a scheduler tick every 250 ms
// -> query : SELECT * FROM outbox WHERE sent=false   // returns 2 unsent rows
//    step 1 · fetch rows    : rows : [ ] -> [ (10, "OrderCreated", sent=false), (11, "PaymentAuthorized", sent=false) ]
//    step 2 · publish row 10 : published : [ ] -> [ "OrderCreated" ]
//    step 3 · mark row 10    : outbox : [(10,"OrderCreated",sent=false),(11,"PaymentAuthorized",sent=false)] -> [(10,"OrderCreated",sent=true),(11,"PaymentAuthorized",sent=false)]
//    step 4 · publish row 11 : published : [ "OrderCreated" ] -> [ "OrderCreated", "PaymentAuthorized" ]
//    step 5 · mark row 11    : outbox : [(10,"OrderCreated",sent=true),(11,"PaymentAuthorized",sent=false)] -> [(10,"OrderCreated",sent=true),(11,"PaymentAuthorized",sent=true)]
// <- output : BRK received [ "OrderCreated", "PaymentAuthorized" ] · outbox now fully sent`,
      tieback: "This is the Polling Publisher: select unsent outbox rows, publish each to the broker, then mark each row sent.",
      refs: ["Poll the outbox table"],
      problems: ["19-distributed-message-queue"]
    },
    {
      scenario: "Your order aggregate wrote two events in one transaction — OrderCreated then OrderApproved — and a downstream consumer must apply them in that exact order. Your relay just ran a query with no ORDER BY, and the consumer saw OrderApproved arrive before OrderCreated.",
      q: "Why is publishing events in order tricky for a polling relay, and how do you fix it?",
      solution: "Add an explicit ORDER BY on the outbox row id so the poll reads rows in insertion order and publishes the earlier event first.",
      components: [
        "Outbox row id — the insertion sequence",
        "Unordered query — SELECT without ORDER BY",
        "Ordered query — SELECT ... ORDER BY id ASC",
        "Message broker — receives events in publish order"
      ],
      
      code: `// RELAY SIDE — ordering: the same order's two events must reach the broker in commit order
// PARTIES: RLY = relay · DB = MySQL 8 @ orders-db-1 (outbox table) · BRK = message broker
// DEF: outbox — the table of stored events = [ (20, "OrderCreated", sent=false), (21, "OrderApproved", sent=false) ]
// STATE (before):
//    outbox : [ (20, "OrderCreated", sent=false), (21, "OrderApproved", sent=false) ]
//    published : [ ]
// DEF: poll_without_order · CALLED BY: the relay running a query with no ORDER BY
// -> query : SELECT * FROM outbox WHERE sent=false   // DB returns id 21 first
//    step 1 · publish id 21 : published : [ ] -> [ "OrderApproved" ]   BECAUSE the query returned id 21 before id 20
//    step 2 · publish id 20 : published : [ "OrderApproved" ] -> [ "OrderApproved", "OrderCreated" ]
// <- output : BRK receives [ "OrderApproved", "OrderCreated" ] · order WRONG (OrderCreated must precede OrderApproved)
// DEF: poll_with_order · CALLED BY: the relay adding ORDER BY id to the query
// -> query : SELECT * FROM outbox WHERE sent=false ORDER BY id ASC   // returns id 20 then id 21
//    step 1 · publish id 20 : published : [ ] -> [ "OrderCreated" ]   BECAUSE ORDER BY id returns the committed-first row first
//    step 2 · publish id 21 : published : [ "OrderCreated" ] -> [ "OrderCreated", "OrderApproved" ]
// <- output : BRK receives [ "OrderCreated", "OrderApproved" ] · order CORRECT`,
      tieback: "This is the Polling Publisher's ordering tradeoff — a poll must reproduce insertion order with an explicit ORDER BY id.",
      refs: ["Publishing events in order is tricky"],
      problems: ["19-distributed-message-queue"]
    },
    {
      scenario: "Your team stores domain events in a NoSQL document store where each document has its own sent flag, but there is no query that can find all unsent documents across the store. Your relay cannot find anything to publish.",
      q: "Why does the Polling Publisher work with any SQL database but not every NoSQL store, and what is the fallback?",
      solution: "Polling needs a queryable outbox table with an unsent-row query; a NoSQL store where the outbox is a per-record property with no global unsent query cannot be polled, so you use transaction log tailing instead.",
      components: [
        "SQL database — exposes the outbox as a queryable table",
        "NoSQL store — outbox is a per-record property",
        "Unsent-row query — cannot be expressed in the NoSQL store",
        "Transaction log tailing — the alternative relay"
      ],
      
      code: `// RELAY SIDE — polling needs a queryable outbox: any SQL database has it, some NoSQL stores do not
// PARTIES: RLY = relay · SQLDB = MySQL 8 @ orders-db-1 · NOSQL = MongoDB 7 @ orders-nosql-1 · BRK = message broker
// DEF: outbox_sql — the queryable table = [ (30, "OrderCreated", sent=false) ]
// DEF: outbox_nosql — a per-record property with no global sent index = { "rec-9" : { "event" : "OrderCreated", "sent" : false } }
// STATE (before):
//    outbox_sql : [ (30, "OrderCreated", sent=false) ]
//    outbox_nosql : { "rec-9" : { "event" : "OrderCreated", "sent" : false } }
//    published : [ ]
// DEF: poll_sql · CALLED BY: the relay against MySQL
// -> query : SELECT * FROM outbox WHERE sent=false   // matches : 1 unsent row
//    step 1 · publish OrderCreated : published : [ ] -> [ "OrderCreated" ]   BECAUSE MySQL returns the one unsent row
//    step 2 · mark row 30 : outbox_sql : [(30,"OrderCreated",sent=false)] -> [(30,"OrderCreated",sent=true)]
// <- output : BRK receives [ "OrderCreated" ] · SQLDB supports polling
// DEF: poll_nosql · CALLED BY: the relay against the NoSQL store
// -> query : SELECT * FROM outbox WHERE sent=false   // matches : 0 rows (query cannot be expressed)
//    step 1 · publish nothing : published : [ ] -> [ ]   BECAUSE the outbox is a per-record property with no global sent index
// <- output : BRK receives 0 messages · NOSQL cannot be polled, so the relay uses transaction log tailing`,
      tieback: "This is the Polling Publisher's portability tradeoff — it needs a queryable outbox, which SQL gives and some NoSQL stores do not.",
      refs: ["Any SQL database, not every NoSQL store"],
      problems: ["19-distributed-message-queue"]
    },
    {
      scenario: "Your relay runs every 250 ms. After one poll publishes a row and marks it sent, you want to be sure the next poll does not republish the same event and spam the broker.",
      q: "How does marking a row sent change what the next poll selects, and why is the sent flag essential?",
      solution: "Marking a row sent means the next poll's WHERE sent=false query no longer returns it, so each event is published once per successful mark.",
      components: [
        "Sent flag — sent=false vs sent=true per row",
        "Poll 1 — publishes and marks the row",
        "Poll 2 — selects only sent=false rows",
        "Broker — receives no duplicate from the relay"
      ],
      
      code: `// RELAY SIDE — two consecutive polls: after a row is marked sent, the next poll skips it
// PARTIES: RLY = relay · DB = MySQL 8 @ orders-db-1 (outbox table) · BRK = message broker
// DEF: outbox — the table of stored events = [ (40, "OrderCreated", sent=false) ]
// STATE (before):
//    outbox : [ (40, "OrderCreated", sent=false) ]
//    published : [ ]
// DEF: poll_1 · CALLED BY: a timer tick at t=0ms
// -> query : SELECT * FROM outbox WHERE sent=false   // returns row 40
//    step 1 · publish row 40 : published : [ ] -> [ "OrderCreated" ]
//    step 2 · mark row 40 : outbox : [(40,"OrderCreated",sent=false)] -> [(40,"OrderCreated",sent=true)]
// <- output : BRK received [ "OrderCreated" ] · outbox row 40 is now sent=true
// DEF: poll_2 · CALLED BY: the next timer tick at t=250ms
// -> query : SELECT * FROM outbox WHERE sent=false   // returns 0 rows
//    step 1 · publish nothing : published : [ "OrderCreated" ] -> [ "OrderCreated" ]   BECAUSE row 40 no longer matches sent=false
// <- output : BRK receives 0 new messages · the sent flag prevented a duplicate publish`,
      tieback: "This is the Polling Publisher's mark-sent step — the sent flag is what lets the next poll skip already-published rows.",
      refs: ["Poll the outbox table"],
      problems: ["19-distributed-message-queue"]
    }
  ],
  systemDesign: {
    question: 'Design publishing database changes without CDC. Premise: a polling publisher relay reads new rows from an outbox table and publishes them to a broker, so subscribers get messages without tailing the log.',
    pipeline: 'source database → polling publisher (relay) → message broker → subscriber',
    decomposition: [
      {
        box: 'source database (outbox table) — the source database',
        role: 'source database',
        parts: [
          'Holds the outbox rows with a sent flag',
          'Answers the unsent-row SELECT'
        ]
      },
      {
        box: 'polling publisher relay — the relay',
        role: 'polling publisher',
        parts: [
          'Polls SELECT ... WHERE sent=false ORDER BY id',
          'Publishes each row to the broker',
          'Marks the row sent=true'
        ]
      },
      {
        box: 'message broker (RabbitMQ) — the broker',
        role: 'broker',
        parts: [
          'Receives published events in id order',
          'Holds them for subscribers'
        ]
      },
      {
        box: 'subscriber — the consumer',
        role: 'subscriber',
        parts: [
          'Consumes each event off the broker'
        ]
      }
    ],
    
    program: `// SYSTEM DESIGN — polling publisher as a pipeline: source database (outbox table) -> polling publisher relay -> message broker -> subscriber (consumer)
// GOAL (what this is FOR): publish each stored event to the broker exactly once, in id order, without a transaction spanning the broker.
//    THE NAIVE WAY (why we build anything at all): write to the database and the broker in one transaction; the broker is
//    not transactional with the database, so a crash between the two loses or duplicates events. We replace that with a durable outbox the relay drains on a timer.
// PARTIES: DB = PostgreSQL 16 @ orders-db-1 (outbox table) · RLY = polling publisher relay (polls, publishes, marks) · BRK = message broker (RabbitMQ) · SUB = subscriber (consumer)
// DEF: outbox — the table of events awaiting publication; here [ (10, "OrderCreated", sent=false), (11, "PaymentAuthorized", sent=false) ]
// DEF: list — the rows one poll selects, then publishes; here [ (10, "OrderCreated"), (11, "PaymentAuthorized") ]
// DEF: status — a row's sent flag; here false flipped to true
// STATE (before):
//    outbox : [ (10, "OrderCreated", sent=false), (11, "PaymentAuthorized", sent=false) ]
//    WHY outbox exists: without it, the event lives only in the application's hand and is lost if the process dies
//    before publishing; with it, each event is a durable row the relay can find again until it is sent.
//    list   : []
//    WHY list exists: without it, "which rows did this poll select?" is untracked; with it, the relay holds the rows
//    it is about to publish, ordered by id so the broker sees them in commit order.
//    status : "unsent"
// DEF: poll_once · CALLED BY: a scheduler tick every 250 ms
//    WHO chose 250 ms: the relay operator, not the data. 250 ms here only to give the trace a concrete tick; a production
//    relay often polls every 1 to 10 seconds — shorter republishes sooner, longer adds delivery latency.
// -> query : "SELECT * FROM outbox WHERE sent=false ORDER BY id ASC"
// BUILD PHASE · run once at write time
//    the outbox pattern wrote these rows once -> outbox = [ (10, "OrderCreated", sent=false), (11, "PaymentAuthorized", sent=false) ]
// QUERY PHASE · per poll
//    step 1 · RLY fetches the unsent rows    list : [] -> [ (10, "OrderCreated"), (11, "PaymentAuthorized") ]   BECAUSE the query returns rows whose sent flag is false, ordered by id
//    -> input  : list = [] (query = "SELECT * FROM outbox WHERE sent=false ORDER BY id ASC")
//    <- output : list = [ (10, "OrderCreated"), (11, "PaymentAuthorized") ]   BECAUSE the query returns rows whose sent flag is false, ordered by id
//    step 2 · RLY publishes row 10 to BRK    list : [ (10, "OrderCreated"), (11, "PaymentAuthorized") ] -> [ (11, "PaymentAuthorized") ]   BECAUSE each row is handed to the broker in id order
//    -> input  : list = [ (10, "OrderCreated"), (11, "PaymentAuthorized") ] (row = (10, "OrderCreated"))
//    <- output : list = [ (11, "PaymentAuthorized") ]   BECAUSE each row is handed to the broker in id order
//    step 3 · RLY marks row 10 sent    outbox : [(10,"OrderCreated",sent=false),(11,"PaymentAuthorized",sent=false)] -> [(10,"OrderCreated",sent=true),(11,"PaymentAuthorized",sent=false)]   BECAUSE sent=true makes the next poll skip the row
//    -> input  : outbox = [(10,"OrderCreated",sent=false),(11,"PaymentAuthorized",sent=false)] (row_id = 10)
//    <- output : outbox = [(10,"OrderCreated",sent=true),(11,"PaymentAuthorized",sent=false)]   BECAUSE sent=true makes the next poll skip the row
//    step 4 · SUB consumes "OrderCreated"    status : "unsent" -> "delivered"   BECAUSE the subscriber reads the event off BRK
//    -> input  : status = "unsent" (brk = [ "OrderCreated", "PaymentAuthorized" ])
//    <- output : status = "delivered"   BECAUSE the subscriber reads the event off BRK
// TRACE (one run, k = 2 unsent rows):
//    poll  | list                                                  | outbox state         | status
//    t=0   | [ (10,"OrderCreated"), (11,"PaymentAuthorized") ]     | both rows sent=true  | delivered
// CORRECTNESS (drain invariant): the relay selects sent=false rows in id order, publishes each, and marks it
//    sent, so every row is published exactly once and SUB receives the events in the same id order.
// VARIANTS (when to pick which):
//    per-row mark-sent            -> mark each row right after its publish, one update per row, no extra space        (use when the broker may drop a message)   <- THIS ONE
//    batch mark-sent              -> publish all rows then mark all at once, one update per row, keep one list of k rows       (use when the broker acks in bulk)
//    transactional poll-publish   -> publish + mark in one transaction, one update per row                         (use when a duplicate is intolerable)
// <- output : BRK holds [ "OrderCreated", "PaymentAuthorized" ] · SUB consumes them in id order`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'The outbox has events but no way out', content: '<p><strong>Why.</strong> The Transactional Outbox pattern leaves messages sitting in a database table, and they only matter once they reach the message broker.</p><p><strong>Claim.</strong> Something must discover the unsent outbox rows and hand each one to the broker.</p><p><strong>Grounding.</strong> The reference problem statement: how to publish messages and events in the outbox in the database to the message broker.</p><p><strong>In the wild.</strong> This is the relay half of transactional messaging; the outbox pattern creates the need for it.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Poll the outbox table', content: '<p><strong>Why.</strong> The outbox is just a table, so a recurring query can read whatever has not been sent yet.</p><p><strong>Claim.</strong> Publish messages by polling the outbox table: select unsent rows, publish each, then mark it sent.</p><p><strong>Grounding.</strong> The reference solution is one sentence: publish messages by polling the database outbox table.</p><p><strong>In the wild.</strong> The Eventuate Tram framework implements polling.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Publishing events in order is tricky', content: '<p><strong>Why.</strong> A poll must reproduce the order events were inserted, but the database does not hand rows back in order unless asked.</p><p><strong>Claim.</strong> The relay needs an explicit ordering, and a query without ORDER BY can deliver events out of sequence.</p><p><strong>Grounding.</strong> The reference lists "tricky to publish events in order" as a drawback.</p><p><strong>In the wild.</strong> Ordering by the outbox row id is the standard fix.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Works with any SQL database, not all NoSQL', content: '<p><strong>Why.</strong> Polling only needs a standard SELECT against a queryable table, which every SQL database provides.</p><p><strong>Claim.</strong> A store where the outbox is a per-record property, with no global unsent-row query, cannot be polled.</p><p><strong>Grounding.</strong> The reference lists "works with any SQL database" as a benefit and "not all NoSQL databases support this pattern" as a drawback.</p><p><strong>In the wild.</strong> Stores that cannot be polled fall back to transaction log tailing.</p>' }
    ]
  },
  quiz: [
    { "question": "What problem does the Polling Publisher solve?", "options": ["A. How to atomically write business data and an event together.", "B. How to publish the outbox messages stored in the database to the message broker.", "C. How to make consumers idempotent.", "D. How to replace the message broker with a database."], "answer": 2, "explanation": "The outbox pattern stores messages in the database, and the Polling Publisher is the relay that moves them to the broker. A is the Transactional Outbox problem, C is a consumer concern, and D is not a stated goal.", "conceptRef": "The outbox has events but no way out" },
    { "question": "How does the relay discover events to publish?", "options": ["A. The broker pushes events to the relay.", "B. It tails the database transaction log.", "C. It polls the database outbox table for unsent rows.", "D. Consumers notify it directly."], "answer": 3, "explanation": "Polling publishes messages by repeatedly querying the outbox table for rows that are not yet sent. B is the alternative (transaction log tailing), and A and D are not how this pattern works.", "conceptRef": "Poll the outbox table" },
    { "question": "Why is publishing events in order tricky for a polling relay?", "options": ["A. Polling always preserves order for free.", "B. A query without an explicit ordering may return rows out of commit order.", "C. Events have no ordering requirement at all.", "D. The broker reorders messages after they arrive."], "answer": 2, "explanation": "The database does not guarantee a row order unless the query asks for one, so an unordered poll can publish a later event before an earlier one. A and C are false, and D is not the mechanism.", "conceptRef": "Publishing events in order is tricky" },
    { "question": "Why do not all NoSQL databases support this pattern?", "options": ["A. They have no message broker integration.", "B. They cannot be polled when the outbox is a per-record property with no unsent-row query.", "C. They always lose events on rollback.", "D. They require 2PC to poll."], "answer": 2, "explanation": "Polling needs a queryable outbox table; where the outbox is a property on each record and no query can find unsent rows, polling cannot work. A, C, and D are not stated in the reference.", "conceptRef": "Works with any SQL database, not all NoSQL" }
  ]
});
