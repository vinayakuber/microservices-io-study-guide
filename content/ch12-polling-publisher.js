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
// PARTIES: RLY = relay · DB = relational database · BRK = message broker
// STATE (before):
//    outbox : [ (1, "E1", sent=false), (2, "E2", sent=false) ]
//    published : [ ]
// DEF: poll_once · CALLED BY: a timer firing every 100 ms
// -> query : SELECT * FROM outbox WHERE sent=false   // returns [ (1,"E1",sent=false), (2,"E2",sent=false) ]
//    step 1 · fetch rows    : rows : [ ] -> [ (1,"E1",sent=false), (2,"E2",sent=false) ]
//    step 2 · publish row 1 : published : [ ] -> [ "E1" ]
//    step 3 · mark row 1    : outbox : [(1,"E1",sent=false),(2,"E2",sent=false)] -> [(1,"E1",sent=true),(2,"E2",sent=false)]
//    step 4 · publish row 2 : published : [ "E1" ] -> [ "E1", "E2" ]
//    step 5 · mark row 2    : outbox : [(1,"E1",sent=true),(2,"E2",sent=false)] -> [(1,"E1",sent=true),(2,"E2",sent=true)]
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
// PARTIES: RLY = relay · DB = relational database · BRK = message broker
// STATE (before):
//    outbox : [ (1, "E1", sent=false), (2, "E2", sent=false) ]
//    published : [ ]
// DEF: poll_without_order · CALLED BY: the relay running a query with no ORDER BY
// -> query : SELECT * FROM outbox WHERE sent=false   // returns rows in DB order, here id 2 first
//    step 1 · publish id 2 : published : [ ] -> [ "E2" ]     BECAUSE the query returned id 2 before id 1
//    step 2 · publish id 1 : published : [ "E2" ] -> [ "E2", "E1" ]
// <- output : BRK receives [ "E2", "E1" ] · order WRONG (E1 should precede E2)
// DEF: poll_with_order · CALLED BY: the relay adding ORDER BY id to the same query
// -> query : SELECT * FROM outbox WHERE sent=false ORDER BY id ASC   // returns id 1 then id 2
//    step 1 · publish id 1 : published : [ ] -> [ "E1" ]     BECAUSE ORDER BY id returns the committed-first row first
//    step 2 · publish id 2 : published : [ "E1" ] -> [ "E1", "E2" ]
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
// PARTIES: RLY = relay · SQLDB = MySQL database · NOSQL = NoSQL document store · BRK = message broker
// DEF: outbox — the table of stored events awaiting publication to the broker = row (1, "E1", sent=false)
// DEF: sql — the queryable relational access an SQL database gives the outbox = "SELECT * FROM outbox WHERE sent=false" returns 1 unsent row
// STATE (before):
//    outbox_sql : [ (1, "E1", sent=false) ]
//    outbox_nosql : { "rec-9" : { "event" : "E1", "sent" : false } }
//    published : [ ]
// DEF: poll_sql · CALLED BY: the relay against MySQL
// -> query : SELECT * FROM outbox WHERE sent=false    // matches : 1 unsent row
//    step 1 · publish E1 : published : [ ] -> [ "E1" ]          BECAUSE MySQL returns the one unsent row
//    step 2 · mark sent  : outbox_sql : [(1,"E1",sent=false)] -> [(1,"E1",sent=true)]
// <- output : BRK receives [ "E1" ] · SQLDB supports polling
// DEF: poll_nosql · CALLED BY: the relay against a NoSQL store with no unsent-row query
// -> query : SELECT * FROM outbox WHERE sent=false    // matches : 0 rows (the query cannot be expressed)
//    step 1 · publish nothing : published : [ ] -> [ ]  (0 messages sent)   BECAUSE the outbox is a per-record property with no global sent index
// <- output : BRK receives 0 messages · NOSQL cannot poll, so the relay uses transaction log tailing instead`
    }
  ],
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
