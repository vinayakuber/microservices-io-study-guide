registerChapter({
  id: 'ch29',
  num: 29,
  title: 'Externalized Configuration',
  pattern: 'A service reads all of its configuration — database credentials and network locations — from an external source at startup, so the same code runs unchanged in every environment.',
  aka: 'Chris Richardson · Microservice Patterns Ch. 29 · microservices.io /patterns/externalized-configuration.html',
  part: 7,
  flow: [
    {
      section: 'Read configuration at startup from the environment',
      color: 'orange',
      motivation: `A service needs database credentials and network locations to connect to its dependencies. If those are compiled into the code, a build made for QA cannot talk to the production database; reading them from an external source at startup means the same artifact picks up whatever its environment supplies.`,
      steps: [
        { num: 1, title: 'The service starts', detail: 'On startup, the service needs configuration telling it how to connect to external and third-party services.' },
        { num: 2, title: 'It reads the values externally', detail: 'The service reads its configuration from an external source, e.g. OS environment variables, property files, or command-line arguments.' },
        { num: 3, title: 'It connects with those values', detail: 'The service uses the resolved values, e.g. the database network location and credentials, to open its connections.' }
      ],
      program: `// ORDER SERVICE SIDE — on startup, read DB credentials and location from the environment, not the code
// PARTIES: SVC = order service · ENV = deployment environment (OS) · DB = MySQL 8 @ prod-db
// STATE (before):
//    config : {}                          // SVC holds no DB settings yet at launch
//    connection : ""                      // no DB connection established yet
// DEF: startup · CALLED BY: the runtime launching SVC
// -> env : {"DB_URL":"jdbc:mysql://prod-db:3306/orders","DB_PASSWORD":"prod-secret"}
//    step 1 · SVC reads DB_URL from the environment    // config : {} -> {"db_url":"jdbc:mysql://prod-db:3306/orders"}
//    step 2 · SVC reads DB_PASSWORD from the environment    // config : {"db_url":"jdbc:mysql://prod-db:3306/orders"} -> {"db_url":"jdbc:mysql://prod-db:3306/orders","db_password":"prod-secret"}
//    step 3 · SVC opens a connection using those values    // connection : "" -> "open"  BECAUSE the config now holds a URL and a password the DB accepts
// <- config : {"db_url":"jdbc:mysql://prod-db:3306/orders","db_password":"prod-secret"} · connection : "open"
//    alt DB_PASSWORD missing from ENV : connection : "" -> "failed"  BECAUSE the supplied configuration does not match what the service expects`
    },
    {
      section: 'Run unchanged across environments',
      color: 'orange',
      motivation: `Dev, test, QA, staging, and production each run different instances of the same dependencies — a QA database versus the production database, a test credit-card account versus the production one. Externalizing configuration lets one build serve all of them without modification or recompilation.`,
      steps: [
        { num: 1, title: 'One artifact, many environments', detail: 'The same build is deployed to each environment with no modification or recompilation.' },
        { num: 2, title: 'Each environment supplies its own values', detail: 'Each environment injects its own instances, e.g. a QA database vs a production database.' },
        { num: 3, title: 'Each instance connects to its own dependency', detail: 'The same code resolves different database locations and credentials per environment.' }
      ],
      program: `// DEPLOYMENT SIDE — the SAME build runs in QA and production because each environment supplies its own values
// PARTIES: ENV-QA = QA environment · ENV-PROD = production environment · DB = MySQL 8 @ qa-db and prod-db
// DEF: config — the key/value settings a service reads at startup; here qa_config = {"db_url":"jdbc:mysql://qa-db:3306/orders","db_password":"qa-secret"}
// DEF: connection — the open link to a dependency, established from config; here connection = "qa-db"
// STATE (before):
//    artifact : "orders-service.jar"      // the identical, unmodified build
//    qa_config : {}                        // what the QA deployment resolves at startup
//    prod_config : {}                      // what the production deployment resolves at startup
//    qa_connection : ""                    // DB connection the QA instance opens
//    prod_connection : ""                  // DB connection the production instance opens
// DEF: deploy · CALLED BY: a release pipeline pushing the same artifact to two environments
// -> artifact : "orders-service.jar"      // one build, no recompilation for either environment
//    step 1 · ENV-QA injects its DB values    // qa_config : {} -> {"db_url":"jdbc:mysql://qa-db:3306/orders","db_password":"qa-secret"}
//    step 2 · ENV-PROD injects different DB values    // prod_config : {} -> {"db_url":"jdbc:mysql://prod-db:3306/orders","db_password":"prod-secret"}
//    step 3 · the QA instance connects to its own DB    // qa_connection : "" -> "qa-db"  BECAUSE qa_config points at the QA database
//    step 4 · the production instance connects to its own DB    // prod_connection : "" -> "prod-db"  BECAUSE prod_config points at the production database
// <- connections : qa = "qa-db" · prod = "prod-db" — one artifact "orders-service.jar", two different databases`
    },
    {
      section: 'Resolve logical names via discovery',
      color: 'orange',
      motivation: `Configuration can name a dependency logically rather than pinning a network location. A logical name like REGISTRATION-SERVICE stays valid when instances move, because client-side discovery turns it into a real address at call time.`,
      steps: [
        { num: 1, title: 'Config names the dependency logically', detail: 'The configuration holds a logical name (e.g. USER_REGISTRATION_URL: http://REGISTRATION-SERVICE/user), not a host and port.' },
        { num: 2, title: 'Client-side discovery resolves it', detail: 'The logical name REGISTRATION-SERVICE is resolved using client-side discovery into a real network location.' },
        { num: 3, title: 'The component calls the resolved service', detail: 'A component like RegistrationServiceProxy uses the resolved address to invoke the registration service.' }
      ],
      program: `// WEB SERVICE SIDE — config names the dependency logically; client-side discovery resolves the real location
// PARTIES: WEB = web service (RegistrationServiceProxy) · REG = registration service · DISC = client-side discovery
// DEF: call — the invocation the proxy makes to the dependency; here call_target = "http://10.0.0.7:8080/user"
// DEF: resolved — turned from a logical name into a real network address; here resolved_url = "http://10.0.0.7:8080/user"
// DEF: target — the specific address the proxy will call; here target = "http://10.0.0.7:8080/user"
// DEF: url — the network location string held in config; here url = "http://REGISTRATION-SERVICE/user" resolving to "http://10.0.0.7:8080/user"
// STATE (before):
//    config : {}                           // WEB holds no registration URL yet
//    resolved_url : ""                     // real network location, not yet found
//    call_target : ""                      // the resolved address the proxy will call
// DEF: startup · CALLED BY: the runtime launching WEB with an injected environment variable
// -> env : {"USER_REGISTRATION_URL":"http://REGISTRATION-SERVICE/user"}
//    step 1 · WEB binds the variable user_registration_url from the environment    // config : {} -> {"user_registration_url":"http://REGISTRATION-SERVICE/user"}
//    step 2 · WEB asks DISC to resolve the logical name REGISTRATION-SERVICE    // resolved_url : "" -> "http://10.0.0.7:8080/user"  BECAUSE REGISTRATION-SERVICE is a logical name, not a network location
//    step 3 · the proxy calls the resolved instance    // call_target : "" -> "http://10.0.0.7:8080/user"
// <- resolved_url : "http://10.0.0.7:8080/user" — RegistrationServiceProxy reaches REG`
    }
  ],
  interview: [
    {
      scenario: "Order Service needs a database URL and password to connect on startup. The team compiled those values into a QA build and now that build cannot talk to the production database.",
      q: "What does Externalized Configuration solve, and when does the service read its configuration?",
      solution: "It lets one service run in multiple environments without modification: on startup the service reads its configuration — database credentials and network location — from an external source such as OS environment variables.",
      components: ["Order Service", "OS environment", "database server", "DB_URL / DB_PASSWORD"],
      diagram: "flowchart LR\n  S[\"Order Service\"] -->|\"startup read\"| E[\"OS environment\"]\n  E -->|\"DB_URL\"| C[\"config\"]\n  E -->|\"DB_PASSWORD\"| C\n  C -->|\"opens\"| D[\"DB connection\"]",
      code: "// ORDER SERVICE SIDE — on startup, read DB credentials and location from the environment, not the code\n// PARTIES: SVC = order service · ENV = deployment environment (OS) · DB = MySQL 8 @ prod-db\n// STATE (before):\n//    config : {}                               // SVC holds no DB settings yet at launch\n//    connection : \"\"                           // no DB connection established yet\n// DEF: startup · CALLED BY: the runtime launching SVC\n// -> env : {\"DB_URL\":\"jdbc:mysql://prod-db:3306/orders\",\"DB_PASSWORD\":\"prod-secret\"}\n//    step 1 · SVC reads DB_URL from the environment    config : {} -> {\"db_url\":\"jdbc:mysql://prod-db:3306/orders\"}\n//    step 2 · SVC reads DB_PASSWORD from the environment    config : {\"db_url\":\"jdbc:mysql://prod-db:3306/orders\"} -> {\"db_url\":\"jdbc:mysql://prod-db:3306/orders\",\"db_password\":\"prod-secret\"}\n//    step 3 · SVC opens a connection using those values    connection : \"\" -> \"open\"  BECAUSE the config now holds a URL and a password the DB accepts\n// <- config : {\"db_url\":\"jdbc:mysql://prod-db:3306/orders\",\"db_password\":\"prod-secret\"} · connection : \"open\"\n//    alt DB_PASSWORD missing from ENV : connection : \"\" -> \"failed\"  BECAUSE the supplied configuration does not match what the service expects",
      tieback: "This is the chapter's startup read: configuration comes from the environment, not the code.",
      refs: ["Read configuration at startup from the environment"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "The release pipeline pushes one orders-service.jar to QA and production. QA must talk to a QA database; production must talk to the production database — without rebuilding anything.",
      q: "How does one build serve two environments without modification or recompilation?",
      solution: "Each environment injects its own values at startup, so the same artifact resolves different database locations and credentials — the QA instance connects to the QA database, production to the production database.",
      components: ["orders-service.jar (one artifact)", "QA environment", "production environment", "per-environment DB values"],
      diagram: "flowchart LR\n  A[\"orders-service.jar\"] -->|\"deployed\"| Q[\"QA env\"]\n  A -->|\"deployed\"| P[\"Production env\"]\n  Q -->|\"injects qa-db\"| QD[\"QA database\"]\n  P -->|\"injects prod-db\"| PD[\"Production database\"]",
      code: "// DEPLOYMENT SIDE — the SAME build runs in QA and production because each environment supplies its own values\n// PARTIES: ENVQA = QA environment · ENVPROD = production environment · DB = MySQL 8 @ qa-db and prod-db\n// DEF: connection — the open link to a dependency, established from config; here \"qa-db\" or \"prod-db\"\n// STATE (before):\n//    artifact : \"orders-service.jar\"        // the identical, unmodified build\n//    qa_config : {}                         // what the QA deployment resolves at startup\n//    prod_config : {}                       // what the production deployment resolves at startup\n//    qa_connection : \"\"                     // DB connection the QA instance opens\n//    prod_connection : \"\"                   // DB connection the production instance opens\n// DEF: deploy · CALLED BY: a release pipeline pushing the same artifact to two environments\n// -> artifact : \"orders-service.jar\"        // one build, no recompilation for either environment\n//    step 1 · ENVQA injects its DB values    qa_config : {} -> {\"db_url\":\"jdbc:mysql://qa-db:3306/orders\",\"db_password\":\"qa-secret\"}\n//    step 2 · ENVPROD injects different DB values    prod_config : {} -> {\"db_url\":\"jdbc:mysql://prod-db:3306/orders\",\"db_password\":\"prod-secret\"}\n//    step 3 · the QA instance connects to its own DB    qa_connection : \"\" -> \"qa-db\"  BECAUSE qa_config points at the QA database\n//    step 4 · the production instance connects to its own DB    prod_connection : \"\" -> \"prod-db\"  BECAUSE prod_config points at the production database\n// <- connections : qa = \"qa-db\" · prod = \"prod-db\" — one artifact \"orders-service.jar\", two different databases",
      tieback: "This is the chapter's run-unchanged-across-environments step: the differences live in the environment, not the build.",
      refs: ["Run unchanged across environments"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "The web service's RegistrationServiceProxy is configured with a logical name REGISTRATION-SERVICE instead of a host and port. Instances move, but the name must stay valid.",
      q: "In the RegistrationServiceProxy example, what is REGISTRATION-SERVICE, and how does it become a real address?",
      solution: "REGISTRATION-SERVICE is the logical name of the service; client-side discovery resolves it into a real network location that the proxy then calls.",
      components: ["Web service (RegistrationServiceProxy)", "registration service", "client-side discovery", "USER_REGISTRATION_URL"],
      diagram: "flowchart LR\n  W[\"Web service\"] -->|\"binds\"| U[\"USER_REGISTRATION_URL\"]\n  U -->|\"logical name\"| D[\"client-side discovery\"]\n  D -->|\"resolves\"| R[\"http://10.0.0.7:8080/user\"]\n  W -->|\"calls\"| R",
      code: "// WEB SERVICE SIDE — config names the dependency logically; client-side discovery resolves the real location\n// PARTIES: WEB = web service (RegistrationServiceProxy) · REG = registration service · DISC = client-side discovery\n// DEF: url — the network location string held in config; here \"http://REGISTRATION-SERVICE/user\" resolving to \"http://10.0.0.7:8080/user\"\n// STATE (before):\n//    config : {}                              // WEB holds no registration URL yet\n//    resolved_url : \"\"                        // real network location, not yet found\n//    call_target : \"\"                         // the resolved address the proxy will call\n// DEF: startup · CALLED BY: the runtime launching WEB with an injected environment variable\n// -> env : {\"USER_REGISTRATION_URL\":\"http://REGISTRATION-SERVICE/user\"}\n//    step 1 · WEB binds the variable user_registration_url from the environment    config : {} -> {\"user_registration_url\":\"http://REGISTRATION-SERVICE/user\"}\n//    step 2 · WEB asks DISC to resolve the logical name REGISTRATION-SERVICE    resolved_url : \"\" -> \"http://10.0.0.7:8080/user\"  BECAUSE REGISTRATION-SERVICE is a logical name, not a network location\n//    step 3 · the proxy calls the resolved instance    call_target : \"\" -> \"http://10.0.0.7:8080/user\"\n// <- resolved_url : \"http://10.0.0.7:8080/user\" — RegistrationServiceProxy reaches REG",
      tieback: "This is the chapter's logical-name resolution: externalized config defers the location problem to client-side discovery.",
      refs: ["Resolve logical names via discovery"],
      problems: ["01-scale-from-zero-to-millions"]
    },
    {
      scenario: "A deployment ships with a missing DB_PASSWORD, or a wrong database URL. The code is unchanged and correct, but the environment supplied bad values.",
      q: "What new failure mode does externalizing configuration open up, and what issue does the pattern leave unresolved?",
      solution: "Once configuration lives outside the code, a deployment can be given the wrong values; the open issue is how to ensure the supplied configuration matches what the service expects.",
      components: ["Service", "deployment environment", "supplied config", "startup validation"],
      diagram: "flowchart LR\n  E[\"Environment\"] -->|\"supplies config\"| S[\"Service\"]\n  E -->|\"missing DB_PASSWORD\"| M[\"mismatch\"]\n  S -->|\"startup\"| C[\"connection failed\"]\n  M --> C",
      code: "// SERVICE SIDE — the environment supplied the wrong values, so the unchanged code fails to connect\n// PARTIES: SVC = order service · ENV = deployment environment · DB = MySQL 8 @ prod-db\n// DEF: supplied — the configuration the environment injects at startup; here missing the DB_PASSWORD key\n// STATE (before):\n//    config : {}                              // what SVC resolves at startup\n//    connection : \"\"                          // the DB connection SVC opens\n//    expected_keys : [\"db_url\",\"db_password\"]  // the keys the service needs\n// DEF: startup · CALLED BY: the runtime launching SVC with an incomplete environment\n// -> env : {\"DB_URL\":\"jdbc:mysql://prod-db:3306/orders\"}     // DB_PASSWORD is missing\n//    step 1 · SVC reads only what the environment supplied    config : {} -> {\"db_url\":\"jdbc:mysql://prod-db:3306/orders\"}\n//    step 2 · SVC finds a missing key    expected_keys : [\"db_url\",\"db_password\"] -> [\"db_url\",\"db_password\"]  BECAUSE db_password is absent from config\n//    step 3 · the connection fails    connection : \"\" -> \"failed\"  BECAUSE the supplied configuration does not match what the service expects\n// <- connection : \"failed\" · the open issue : how to ensure the supplied configuration matches what is expected at deploy time\n//    alt validation in place : the pipeline checks expected_keys against the supplied config -> the deploy is refused before SVC ever starts",
      tieback: "This is the chapter's resulting-context issue: portability is bought with a new verification duty at deploy time.",
      refs: ["Read configuration at startup from the environment", "Resolve logical names via discovery"],
      problems: ["01-scale-from-zero-to-millions"]
    }
  ],
  systemDesign: {
    question: 'Design configuration without redeploys. Premise: a service pulls its configuration from a config server backed by git, so changing a setting never requires rebuilding the service.',
    pipeline: 'service → config server → config repository (git/VCS)',
    decomposition: [
      {
        box: 'Order Service — the consumer of config',
        role: 'service',
        parts: [
          'pulls config at startup (DB_URL, DB_PASSWORD)',
          'refreshes when the config changes'
        ]
      },
      {
        box: 'Spring Cloud Config server',
        role: 'config server',
        parts: [
          'serves configuration over HTTP',
          'versions each property change'
        ]
      },
      {
        box: 'git repository — the config source',
        role: 'config repository (git/VCS)',
        parts: [
          'stores the property files per environment',
          'is the versioned source of truth'
        ]
      }
    ],
    wiring: "flowchart LR\n  SVC[\"Order Service\"] -->|\"pull at startup\"| CS[\"config server\"]\n  CS -->|\"serves over HTTP\"| SVC\n  CS -->|\"reads\"| GIT[(\"git repository (config source)\")]",
    program: `// SYSTEM DESIGN — externalized configuration: service (Order Service) -> config server (Spring Cloud Config) -> config repository (git/VCS)
// PARTIES: SVC = Order Service (config consumer, pulls at startup) · CS = Spring Cloud Config server (config server, serves over HTTP) · GIT = git repository (config repository, VCS source of truth)
// DEF: config — the key/value settings a service reads at startup; here {"db_url":"jdbc:mysql://prod-db:3306/orders","db_password":"prod-secret"}
// DEF: repo — the versioned property file git stores; here the file with keys "db_url" and "db_password"
// DEF: connection — the open link built from the resolved values; here "open"
// STATE (before):
//    config : {}
//    connection : ""
// DEF: pull_and_connect · CALLED BY: the runtime launching SVC
// -> env : {"DB_URL":"jdbc:mysql://prod-db:3306/orders","DB_PASSWORD":"prod-secret"}
//    step 1 · SVC pulls the config from CS at startup    config : {} -> {"db_url":"jdbc:mysql://prod-db:3306/orders","db_password":"prod-secret"}
//    step 2 · CS reads the file from GIT and serves it over HTTP    config : {"db_url":"jdbc:mysql://prod-db:3306/orders"} -> {"db_url":"jdbc:mysql://prod-db:3306/orders","db_password":"prod-secret"}  BECAUSE git stores the versioned property file
//    step 3 · SVC opens a connection with the values    connection : "" -> "open"  BECAUSE the config now holds the URL and password the database accepts
// <- outcome : connection "open" · the same artifact runs unchanged in every environment`
  },
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'Running in many environments without modification', content: '<p><strong>Why.</strong> A service must be told how to connect to its external and third-party services — the database network location and credentials, for example.</p><p><strong>Claim.</strong> The service must run in dev, test, QA, staging, and production without modification or recompilation, even though each environment has different service instances.</p><p><strong>Grounding.</strong> These are the reference forces, nearly verbatim: a QA database vs the production database, a test credit-card account vs the production one.</p><p><strong>In the wild.</strong> Any value baked into the code forces a separate build per environment.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Externalize all application configuration', content: '<p><strong>Why.</strong> The only way one build serves many environments is to move the differences out of the build.</p><p><strong>Claim.</strong> Externalize all configuration, including database credentials and network location; on startup the service reads it from an external source such as OS environment variables.</p><p><strong>Grounding.</strong> This is the reference solution.</p><p><strong>In the wild.</strong> Spring Boot externalized configuration reads values from OS environment variables, property files, and command-line arguments.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Logical names still need resolving', content: '<p><strong>Why.</strong> Config can hold a logical name like REGISTRATION-SERVICE, but code cannot connect to a name.</p><p><strong>Claim.</strong> The logical name is resolved using client-side discovery, which supplies the real network location.</p><p><strong>Grounding.</strong> The RegistrationServiceProxy example configures user_registration_url and resolves REGISTRATION-SERVICE via client-side discovery.</p><p><strong>In the wild.</strong> The tradeoff is that externalized config defers the location problem to the service discovery patterns, which solve it separately.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Supplied config may not match expectations', content: '<p><strong>Why.</strong> Once configuration lives outside the code, a deployment can be given the wrong values.</p><p><strong>Claim.</strong> The open issue is how to ensure that, when an application is deployed, the supplied configuration matches what is expected.</p><p><strong>Grounding.</strong> This is the issue listed in the resulting context.</p><p><strong>In the wild.</strong> The tradeoff is that portability is bought with a new verification duty at deploy time.</p>' }
    ]
  },
  quiz: [
    { "question": "What problem does Externalized Configuration solve?", "options": ["A. How to authenticate a requestor", "B. How to enable a service to run in multiple environments without modification", "C. How to pass identity between services", "D. How to aggregate data across services"], "answer": 2, "explanation": "The reference problem is exactly: how to enable a service to run in multiple environments without modification. A and C belong to the Access Token pattern, and D is API composition.", "conceptRef": "Running in many environments without modification" },
    { "question": "What must be externalized, according to the solution?", "options": ["A. Only the application's business logic", "B. All application configuration, including database credentials and network location", "C. Only the log output format", "D. Only the service's public API"], "answer": 2, "explanation": "The solution says externalize all application configuration including the database credentials and network location. The other options narrow the scope to things the pattern does not target.", "conceptRef": "Externalize all application configuration" },
    { "question": "When does the service read its externalized configuration?", "options": ["A. On startup, from an external source such as OS environment variables", "B. At compile time", "C. Only when a request arrives", "D. Never — it is generated at runtime"], "answer": 1, "explanation": "The reference solution states that on startup a service reads the configuration from an external source, e.g. OS environment variables. Reading at compile time (B) would defeat externalization; C and D contradict the startup read.", "conceptRef": "Externalize all application configuration" },
    { "question": "In the RegistrationServiceProxy example, what is REGISTRATION-SERVICE?", "options": ["A. A hardcoded IP address", "B. The logical name of the service, resolved using client-side discovery", "C. A database table name", "D. The name of a Docker image"], "answer": 2, "explanation": "The reference says REGISTRATION-SERVICE is the logical name of the service, resolved using client-side discovery. It is not an IP (A), a table (C), or an image (D).", "conceptRef": "Logical names still need resolving" }
  ]
});
