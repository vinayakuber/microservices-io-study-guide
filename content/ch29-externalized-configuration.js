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
// PARTIES: SVC = order service · ENV = deployment environment (OS) · DB = database server
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
// PARTIES: ENV-QA = QA environment · ENV-PROD = production environment · DB = database server
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
