registerChapter({
  id: 'ch43',
  num: 43,
  title: 'Anti-Corruption Layer',
  pattern: 'An anti-corruption layer that translates between a legacy monolith\'s domain model and a new service\'s domain model, preventing the legacy model from polluting the new service.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 43 · microservices.io /patterns/refactoring/anti-corruption-layer.html',
  part: 10,
  flow: [
    {
      section: 'The pollution problem',
      color: 'orange',
      motivation: `A new service has to interoperate with a legacy monolith, but the legacy model's field names, codes and shapes differ from the new service's own vocabulary. Without a boundary, the raw legacy model is copied straight in and pollutes the new service.`,
      steps: [
        { num: 1, title: 'New service needs legacy data', detail: 'The new service must read from or call the legacy monolith to do its job.' },
        { num: 2, title: 'Two models disagree', detail: 'The legacy model uses its own field names, status codes and date formats, which differ from the new service\'s vocabulary.' },
        { num: 3, title: 'The legacy model leaks in', detail: 'With no boundary, the raw legacy record is copied into the new service, whose code now depends on legacy names like <strong>cust_dob</strong> and <strong>status_cd</strong>.' }
      ],
      program: `// NEW SERVICE SIDE — a new Customer service reads a record straight from the legacy monolith, with no boundary
// PARTIES: NEW = new Customer service · LEG = PostgreSQL 14 @ legacy-db-1 (customer table)
// STATE (before):
//    leg_customer : { "cust_id": "C-1042", "cust_dob": "1987-04-03", "status_cd": "A" }
//    new_customer : {}
// DEF: fetch_customer · CALLED BY: NEW when it needs customer 1042
// -> customer_id : "C-1042"
//    step 1 · SELECT the legacy row by cust_id   // leg_customer : {} -> { "cust_id": "C-1042", "cust_dob": "1987-04-03", "status_cd": "A" }
//    step 2 · copy the raw legacy row into the new service's model   // new_customer : {} -> { "cust_id": "C-1042", "cust_dob": "1987-04-03", "status_cd": "A" }
//    step 3 · adopt the legacy 1-letter code as the service's own status   // new_customer.status : "" -> "A"   BECAUSE the code is copied over verbatim
// <- output : new_customer now holds legacy names "cust_dob" and "status_cd" plus the raw code "A" — the legacy model polluted the new service
`
    },
    {
      section: 'The translation boundary',
      color: 'orange',
      motivation: `The anti-corruption layer is the fix: a component that sits between the new service and the legacy monolith and translates between the two domain models, so each side keeps its own language.`,
      steps: [
        { num: 1, title: 'Define the anti-corruption layer', detail: 'A layer that sits between the new service and the legacy monolith and owns all translation.' },
        { num: 2, title: 'Translate on the way in', detail: 'The layer converts the legacy model into the new service\'s model before the service ever sees it.' },
        { num: 3, title: 'Translate field by field', detail: 'Each legacy field is mapped onto the new service\'s field: rename the field, and translate its value where the two models disagree.' },
        { num: 4, title: 'Keep the new model clean', detail: 'The service only ever receives its own model and never references legacy names.' }
      ],
      program: `// ACL SIDE — the anti-corruption layer translates a legacy record into the new service's own model
// PARTIES: NEW = new Customer service · ACL = anti-corruption layer · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// STATE (before):
//    legacy : { "cust_id": "C-1042", "cust_dob": "1987-04-03", "status_cd": "A" }
//    domain : {}                              // the new service's model, empty before translation
// DEF: translate · CALLED BY: NEW when it needs a customer in its own vocabulary
// -> legacy : { "cust_id": "C-1042", "cust_dob": "1987-04-03", "status_cd": "A" }
//    step 1 · map cust_id to id unchanged   // domain.id : "" -> "C-1042"   BECAUSE the identifier is already clean
//    step 2 · rename cust_dob to dateOfBirth   // domain.dateOfBirth : "" -> "1987-04-03"
//    step 3 · translate the 1-letter code to a word   // domain.status : "" -> "ACTIVE"   BECAUSE legacy code "A" means active
// <- output : domain = { "id": "C-1042", "dateOfBirth": "1987-04-03", "status": "ACTIVE" } — the service sees only its own model
`
    },
    {
      section: 'Containing the legacy model',
      color: 'orange',
      motivation: `Because the translation lives in one place, the legacy vocabulary stays inside the anti-corruption layer. A change to the legacy model is absorbed at the boundary instead of rippling into the new service.`,
      steps: [
        { num: 1, title: 'One translation point', detail: 'The anti-corruption layer is the only code that knows the legacy model\'s vocabulary.' },
        { num: 2, title: 'Legacy changes stop here', detail: 'When the monolith changes a code, only the layer\'s mapping is updated.' },
        { num: 3, title: 'The new service stays clean', detail: 'The service\'s model never absorbs the legacy names or codes.' }
      ],
      program: `// ACL SIDE — the legacy monolith renames its active-status code; the change stops inside the ACL
// PARTIES: NEW = new Customer service · ACL = anti-corruption layer · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// STATE (before):
//    mapping : { "status_cd": "A" }           // the ACL's translation table: legacy code -> word
//    domain  : { "id": "C-1042", "status": "ACTIVE" }
// DEF: absorb_change · CALLED BY: ACL when LEG changes its active code
// -> legacy_code : "A"
//    step 1 · LEG starts writing "1" for active   // mapping.status_cd : "A" -> "1"
//    step 2 · the ACL retranslates through the updated table   // translated : "" -> "ACTIVE"   BECAUSE the mapping table owns the code, not the service
//    step 3 · the service reads its own model and sees the word   // read_status : "" -> "ACTIVE"
// <- output : domain.status stays "ACTIVE" while the legacy code is now "1" — the rename is confined to the ACL
`
    }
  ],
  interview: [
    {
      scenario: 'Your new Customer service reads a row straight from the legacy monolith. The record arrives with legacy names and a raw one-letter code, and your service starts storing those names as its own.',
      q: 'What happens when a new service copies the legacy model directly, with no boundary?',
      solution: 'The raw legacy record is copied into the new service\'s domain model, and the service\'s code comes to depend on legacy names and codes, so the legacy model pollutes the new service.',
      components: ['Legacy record — with legacy names', 'Direct copy — no translation', 'Legacy codes — adopted verbatim', 'Pollution — the new model leaks in'],
      diagram: `flowchart LR
  LEG["Legacy monolith"] -->|"cust_dob, status_cd"| NEW["New Customer service"]
  NEW -->|"stores raw"| M["new_customer"]
  M -->|"polluted"| P["legacy names leak in"]`,
      code: `// NEW SERVICE SIDE — a new Customer service reads a record straight from the legacy monolith, with no boundary
// PARTIES: NEW = new Customer service · LEG = PostgreSQL 14 @ legacy-db-1 (customer table)
// STATE (before):
//    leg_customer : { "cust_id": "C-3157", "cust_dob": "1999-06-14", "status_cd": "A" }
//    new_customer : {}
// DEF: fetch_customer · CALLED BY: NEW when it needs customer 3157
// -> customer_id : "C-3157"
//    step 1 · SELECT the legacy row by cust_id   // leg_customer : {} -> { "cust_id": "C-3157", "cust_dob": "1999-06-14", "status_cd": "A" }
//    step 2 · copy the raw legacy row into the new model   // new_customer : {} -> { "cust_id": "C-3157", "cust_dob": "1999-06-14", "status_cd": "A" }
//    step 3 · adopt the 1-letter code as its own status   // new_customer.status : "" -> "A"   BECAUSE the code is copied over verbatim
// <- output : new_customer now holds legacy names "cust_dob" and "status_cd" plus the raw code "A" — the legacy model polluted the new service`,
      tieback: 'This is the pollution problem — copying the legacy record verbatim so its names and codes leak into the new model.',
      refs: ['The pollution problem'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: 'You decide the new Customer service must only ever see its own vocabulary: id, dateOfBirth, and a readable status. Someone has to convert the legacy record before the service sees it.',
      q: 'What does the anti-corruption layer do to a legacy record?',
      solution: 'A layer sits between the new service and the legacy monolith and translates the legacy model into the new service\'s model field by field, renaming fields and translating values where the two models disagree.',
      components: ['Anti-corruption layer — the boundary', 'Field rename — cust_dob to dateOfBirth', 'Value translation — code to word', 'Clean model — only the new vocabulary'],
      diagram: `flowchart LR
  LEG["Legacy monolith"] -->|"cust_id, cust_dob, status_cd"| ACL["Anti-corruption layer"]
  ACL -->|"id, dateOfBirth, status"| NEW["New Customer service"]
  ACL -->|"A -> ACTIVE"| MAP["translation"]`,
      code: `// ACL SIDE — the anti-corruption layer translates a legacy record into the new service's own model
// PARTIES: NEW = new Customer service · ACL = anti-corruption layer · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// STATE (before):
//    legacy : { "cust_id": "C-3157", "cust_dob": "1999-06-14", "status_cd": "A" }
//    domain : {}                              // the new service's model, empty before translation
// DEF: translate · CALLED BY: NEW when it needs a customer in its own vocabulary
// -> legacy : { "cust_id": "C-3157", "cust_dob": "1999-06-14", "status_cd": "A" }
//    step 1 · map cust_id to id unchanged   // domain.id : "" -> "C-3157"   BECAUSE the identifier is already clean
//    step 2 · rename cust_dob to dateOfBirth   // domain.dateOfBirth : "" -> "1999-06-14"
//    step 3 · translate the 1-letter code to a word   // domain.status : "" -> "ACTIVE"   BECAUSE legacy code "A" means active
// <- output : domain = { "id": "C-3157", "dateOfBirth": "1999-06-14", "status": "ACTIVE" } — the service sees only its own model`,
      tieback: 'This is the translation stage — renaming fields and translating values so each side keeps its own language.',
      refs: ['The translation boundary'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: 'The monolith team announces they are renaming status_cd and switching its value from "A" to "1". Without a boundary, that change would ripple into your new service.',
      q: 'Why does a change to the legacy model stop inside the anti-corruption layer?',
      solution: 'Because the translation lives in one place, the legacy vocabulary stays inside the layer; when the monolith changes a code, only the layer\'s mapping is updated, and the new service keeps seeing its own unchanged model.',
      components: ['One translation point — the ACL', 'Legacy change — a rename plus a new code', 'Mapping update — only in the layer', 'Unchanged domain — the service is untouched'],
      diagram: `flowchart LR
  LEG["Legacy monolith"] -->|"stat_code '1'"| ACL["Anti-corruption layer"]
  ACL -->|"mapping updated"| MAP["status_cd -> stat_code, A -> 1"]
  MAP -->|"still yields"| NEW["New service status ACTIVE"]`,
      code: `// ACL SIDE — the legacy monolith renames its status field and changes its code; the change stops inside the ACL
// PARTIES: NEW = new Customer service · ACL = anti-corruption layer · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// STATE (before):
//    mapping : { "status_cd": "A" }           // the ACL's translation table: legacy field -> code
//    domain  : { "id": "C-3157", "status": "ACTIVE" }
// DEF: absorb_change · CALLED BY: ACL when LEG renames its status field and value
// -> legacy_field : "stat_code" · -> legacy_code : "1"
//    step 1 · LEG starts writing "stat_code" with value "1" for active   // mapping.status_cd : "A" -> "1"   // the table keys the NEW field name to the NEW code
//    step 2 · the ACL retranslates through the updated table   // translated : "" -> "ACTIVE"   BECAUSE the mapping table owns the code, not the service
//    step 3 · the service reads its own model and sees the word   // read_status : "" -> "ACTIVE"
// <- output : domain.status stays "ACTIVE" while the legacy field is now "stat_code" = "1" — the rename is confined to the ACL`,
      tieback: 'This is the containment stage — the legacy vocabulary and its changes are absorbed at the single translation point.',
      refs: ['Containing the legacy model'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    },
    {
      scenario: 'The anti-corruption layer works only if every interaction with the legacy system goes through it. A shortcut — reading the legacy database directly — would undo the whole boundary.',
      q: 'What happens when a call bypasses the anti-corruption layer?',
      solution: 'Any call that bypasses the layer reintroduces the pollution it was meant to stop, because the legacy model reaches the new service again; the layer only works if every interaction goes through it.',
      components: ['The layer — the only sanctioned path', 'A bypass — a direct legacy read', 'Pollution — the legacy model returns', 'Discipline — every call through the layer'],
      diagram: `flowchart LR
  DEV["Developer"] -->|"bypasses"| DB["Legacy DB direct"]
  DB -->|"raw row"| NEW["New service"]
  NEW -->|"polluted again"| P["legacy names leak in"]
  DEV -->|"should use"| ACL["Anti-corruption layer"]`,
      code: `// BOUNDARY SIDE — one direct read that skips the layer reintroduces the exact pollution the layer stops
// PARTIES: NEW = new Customer service · ACL = anti-corruption layer · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// STATE (before):
//    domain : { "id": "C-3157", "dateOfBirth": "1999-06-14", "status": "ACTIVE" }
//    bypass_count : 0                      // how many reads skipped the layer
// DEF: read_direct · CALLED BY: NEW reading the legacy table without the ACL
// -> customer_id : "C-3157"
//    step 1 · query the legacy table directly   // raw : {} -> { "cust_dob": "1999-06-14", "status_cd": "A" }   BECAUSE the read skipped the translation layer
//    step 2 · the raw names land in the new model   // domain : { "id": "C-3157", ... } -> { "cust_dob": "1999-06-14", "status_cd": "A" }   // pollution returns
//    step 3 · count the bypass   // bypass_count : 0 -> 1   // one more call that reintroduced the legacy model
// <- output : domain holds "cust_dob" and "status_cd" again · the layer solved nothing because it was bypassed
//    alt through the layer : raw : {"cust_dob":"1999-06-14","status_cd":"A"} -> {"dateOfBirth":"1999-06-14","status":"ACTIVE"}   BECAUSE the ACL translates before the service sees it`,
      tieback: 'This is the discipline stage — the layer only prevents pollution when every interaction with the legacy system goes through it.',
      refs: ['Boundary discipline'],
      problems: ["01-scale-from-zero-to-millions", "03-framework-for-system-design-interviews"]
    }
  ],
  systemDesign: {
    pipeline: 'subsystem → ACL (adapter + translator) → legacy monolith',
    decomposition: [
      {
        box: 'new Customer service — the subsystem that keeps its own clean model',
        role: 'subsystem',
        parts: [
          'Domain model — id, dateOfBirth, status',
          'Consumer — reads only what the ACL hands it'
        ]
      },
      {
        box: 'anti-corruption layer — the translation boundary',
        role: 'ACL (adapter + translator)',
        parts: [
          'Adapter — calls the legacy API / table',
          'Translator — maps legacy names and codes to the modern model'
        ]
      },
      {
        box: 'legacy monolith — the old system being shielded',
        role: 'legacy monolith',
        parts: [
          'customer table — cust_id, cust_dob, status_cd on PostgreSQL 14 @ legacy-db-1',
          'Legacy codes — status_cd "A" for active'
        ]
      }
    ],
    wiring: "flowchart LR\n  NEW[\"new Customer service\"] -->|\"needs customer C-1042\"| ACL[\"anti-corruption layer\"]\n  ACL -->|\"adapter reads\"| LEG[(\"PostgreSQL 14 @ legacy-db-1\")]\n  LEG -->|\"cust_id, cust_dob, status_cd\"| ACL\n  ACL -->|\"translator maps A -> ACTIVE\"| NEW\n  NEW -->|\"stores\"| DM[\"domain: id, dateOfBirth, status\"]",
    program: `// SYSTEM DESIGN — anti-corruption layer: new subsystem -> ACL (adapter + translator) -> legacy monolith
// PARTIES: NEW = new Customer service (the clean subsystem) · ACL = anti-corruption layer (adapter that calls the legacy API + translator that maps the legacy model to the modern model) · LEG = PostgreSQL 14 @ legacy-db-1 (legacy monolith customer table)
// DEF: adapter — the ACL half that calls the legacy API/table; here SELECT of customer "C-1042"
// DEF: translator — the ACL half that maps legacy names to the new model; here "cust_dob" -> "dateOfBirth"
// DEF: domain — the new service own model; here { "id":"C-1042", "dateOfBirth":"1987-04-03", "status":"ACTIVE" }
// DEF: legacy — the monolith model; here { "cust_id":"C-1042", "cust_dob":"1987-04-03", "status_cd":"A" }
// STATE (before):
//    legacy : {}     // the monolith record, fetched by the adapter
//    domain : {}     // the new model, empty before translation
// DEF: translate · CALLED BY: NEW when it needs customer 1042 in its own vocabulary
// -> customer_id : "C-1042"
//    step 1 · the adapter reads the legacy row    legacy : {} -> { "cust_id":"C-1042", "cust_dob":"1987-04-03", "status_cd":"A" }   // SELECT from PostgreSQL 14 @ legacy-db-1
//    step 2 · the translator renames cust_dob    domain.dateOfBirth : "" -> "1987-04-03"   BECAUSE the legacy field is mapped to the modern name
//    step 3 · the translator maps the code to a word    domain.status : "" -> "ACTIVE"   // legacy code "A" means active
//    step 4 · the adapter returns the clean model    domain : {} -> { "id":"C-1042", "dateOfBirth":"1987-04-03", "status":"ACTIVE" }   // NEW stores only its own model
// <- output : domain = { "id":"C-1042", "dateOfBirth":"1987-04-03", "status":"ACTIVE" } · the service reads no legacy name   BECAUSE the ACL translates before NEW sees it`
  },
  concepts: {
    cards: [
      {
        tag: 'problem',
        tagLabel: 'Problem',
        title: 'Legacy model pollution',
        content: '<p><strong>Why.</strong> A new service almost always has to interoperate with the legacy monolith, reading its data or calling its APIs.</p><p><strong>Claim.</strong> If the legacy model is copied in directly, its field names, status codes and shapes leak into the new service\'s domain model, and the new service ends up speaking the old system\'s language.</p><p><strong>Grounding.</strong> This is the pattern\'s problem statement: prevent a legacy monolith\'s domain model from polluting the domain model of a new service.</p><p><strong>In the wild.</strong> A new customer service that imports legacy cust_dob and status_cd fields instead of its own dateOfBirth and status.</p>'
      },
      {
        tag: 'solution',
        tagLabel: 'Solution',
        title: 'Anti-corruption layer',
        content: '<p><strong>Why.</strong> Translation has to live somewhere, and that somewhere must be a dedicated boundary rather than scattered mapping code inside the new service.</p><p><strong>Claim.</strong> Define an anti-corruption layer that translates between the two domain models, so the legacy model is converted into the new service\'s model at the boundary.</p><p><strong>Grounding.</strong> This is the pattern\'s solution statement: define an anti-corruption layer, which translates between the two domain models.</p><p><strong>In the wild.</strong> A layer that maps legacy cust_id, cust_dob and status_cd onto the new service\'s id, dateOfBirth and status.</p>'
      },
      {
        tag: 'tradeoff',
        tagLabel: 'Tradeoff',
        title: 'Extra translation code',
        content: '<p><strong>Why.</strong> The layer is code you must write and keep in sync as either model changes.</p><p><strong>Claim.</strong> You trade the pollution risk for a permanent translation component that must be maintained for as long as the two models coexist.</p><p><strong>Grounding.</strong> The solution introduces a layer, and every legacy field the new service touches needs a mapping, so the cost grows with the number of translated fields.</p><p><strong>In the wild.</strong> A mapping table that grows one entry per legacy field until the monolith is retired.</p>'
      },
      {
        tag: 'tradeoff',
        tagLabel: 'Tradeoff',
        title: 'Boundary discipline',
        content: '<p><strong>Why.</strong> The layer only works if every interaction with the legacy system goes through it.</p><p><strong>Claim.</strong> Any call that bypasses the anti-corruption layer reintroduces the pollution it was meant to stop.</p><p><strong>Grounding.</strong> The pattern\'s whole point is to prevent pollution, so a bypassed layer solves nothing: the legacy model reaches the new service again.</p><p><strong>In the wild.</strong> A team that agrees never to read the legacy database directly, only through the layer.</p>'
      }
    ]
  },
  quiz: [
    {
      "question": "What is the anti-corruption layer's job?",
      "options": [
        "A. To speed up calls between a new service and the legacy monolith",
        "B. To translate between two domain models",
        "C. To replace the legacy monolith's database",
        "D. To route requests to the nearest service instance"
      ],
      "answer": 2,
      "explanation": "The solution statement is to define a layer that translates between the two domain models. A and D describe unrelated concerns, and C is wrong because the layer translates models; it does not replace the database.",
      "conceptRef": "Anti-corruption layer"
    },
    {
      "question": "Which problem does the anti-corruption layer solve?",
      "options": [
        "A. A legacy monolith's domain model polluting a new service's domain model",
        "B. A service discovering where other services are located",
        "C. A database running out of storage",
        "D. A service failing under high load"
      ],
      "answer": 1,
      "explanation": "The problem statement is exactly how to prevent a legacy monolith's domain model from polluting a new service's domain model. B, C and D belong to different patterns entirely.",
      "conceptRef": "Legacy model pollution"
    },
    {
      "question": "After you apply the pattern, where should the legacy vocabulary (field names and codes) live?",
      "options": [
        "A. Spread across the new service's code",
        "B. In the anti-corruption layer only",
        "C. Nowhere, it is deleted from the monolith",
        "D. In the user's browser"
      ],
      "answer": 2,
      "explanation": "The layer is the single translation point, so the legacy names and codes are confined there and the new service only sees its own model. A is the pollution the pattern prevents, C is wrong because the monolith keeps its own model, and D is irrelevant.",
      "conceptRef": "Boundary discipline"
    },
    {
      "question": "A legacy record has cust_id = 'C-1042', cust_dob = '1987-04-03', and status_cd = 'A'. Which is a correct translation into the new service's model?",
      "options": [
        "A. id = 'C-1042', dateOfBirth = '1987-04-03', status = 'A'",
        "B. id = 'C-1042', dateOfBirth = '1987-04-03', status = 'ACTIVE'",
        "C. cust_id = 'C-1042', cust_dob = '1987-04-03', status_cd = 'A'",
        "D. id = 'C-1042', dateOfBirth = 'ACTIVE', status = '1987-04-03'"
      ],
      "answer": 2,
      "explanation": "The layer maps the legacy code 'A' to the word 'ACTIVE' and renames the fields, so B is right. A keeps the raw code, C is the untranslated legacy record, and D swaps the field values.",
      "conceptRef": "Anti-corruption layer"
    }
  ]
});
