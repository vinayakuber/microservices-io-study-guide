# Chapter 29: Externalized Configuration

> A service reads all of its configuration — database credentials and network locations — from an external source at startup, so the same code runs unchanged in every environment.

_Also known as: Chris Richardson · Microservice Patterns Ch. 29 · microservices.io /patterns/externalized-configuration.html_

## Flow

### Read configuration at startup from the environment

> **Why this matters:** A service needs database credentials and network locations to connect to its dependencies. If those are compiled into the code, a build made for QA cannot talk to the production database; reading them from an external source at startup means the same artifact picks up whatever its environment supplies.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Service starts</b><br/>SVC needs DB credentials and network location to connect"]:::start
  n1["<b>2. Read DB_URL</b><br/>config : empty becomes db_url jdbc:mysql://prod-db:3306/orders"]:::step
  n2["<b>3. Read DB_PASSWORD</b><br/>config gains db_password prod-secret"]:::step
  n3["<b>4. Open the connection</b><br/>connection : empty becomes open, URL and password accepted"]:::core
  n4["<b>5. Connected</b><br/>SVC talks to the production database"]:::stop
  n5["<b>6. Missing value</b><br/>DB_PASSWORD absent, connection : empty becomes failed"]:::warn
  n0 -->|"1. startup needs config"| n1
  n1 -->|"2. pull the URL from the environment"| n2
  n2 -->|"3. pull the password"| n3
  n3 -->|"4. values match what the DB expects"| n4
  n2 -->|"5. password not supplied"| n5
```

1. **The service starts** — On startup, the service needs configuration telling it how to connect to external and third-party services.

2. **It reads the values externally** — The service reads its configuration from an external source, e.g. OS environment variables, property files, or command-line arguments.

3. **It connects with those values** — The service uses the resolved values, e.g. the database network location and credentials, to open its connections.

```java
// ORDER SERVICE SIDE — on startup, read DB credentials and location from the environment, not the code
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
//    alt DB_PASSWORD missing from ENV : connection : "" -> "failed"  BECAUSE the supplied configuration does not match what the service expects
```

### Run unchanged across environments

> **Why this matters:** Dev, test, QA, staging, and production each run different instances of the same dependencies — a QA database versus the production database, a test credit-card account versus the production one. Externalizing configuration lets one build serve all of them without modification or recompilation.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. One artifact</b><br/>orders-service.jar, no modification or recompilation"]:::start
  n1["<b>2. QA injects its values</b><br/>qa_config becomes jdbc:mysql://qa-db:3306/orders, qa-secret"]:::core
  n2["<b>3. Production injects different values</b><br/>prod_config becomes jdbc:mysql://prod-db:3306/orders, prod-secret"]:::core
  n3["<b>4. QA connects to its DB</b><br/>qa_connection : empty becomes qa-db"]:::step
  n4["<b>5. Production connects to its DB</b><br/>prod_connection : empty becomes prod-db"]:::step
  n5["<b>6. One build, two databases</b><br/>qa points at qa-db, prod at prod-db"]:::stop
  n0 -->|"1. same jar deployed to QA"| n1
  n0 -->|"2. same jar deployed to production"| n2
  n1 -->|"3. QA dependency resolved"| n3
  n2 -->|"4. production dependency resolved"| n4
  n3 -->|"5. converge on one artifact"| n5
  n4 -->|"6. converge on one artifact"| n5
```

1. **One artifact, many environments** — The same build is deployed to each environment with no modification or recompilation.

2. **Each environment supplies its own values** — Each environment injects its own instances, e.g. a QA database vs a production database.

3. **Each instance connects to its own dependency** — The same code resolves different database locations and credentials per environment.

```java
// DEPLOYMENT SIDE — the SAME build runs in QA and production because each environment supplies its own values
// PARTIES: ENV-QA = QA environment · ENV-PROD = production environment · DB = database server
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
// <- connections : qa = "qa-db" · prod = "prod-db" — one artifact "orders-service.jar", two different databases
```

### Resolve logical names via discovery

> **Why this matters:** Configuration can name a dependency logically rather than pinning a network location. A logical name like REGISTRATION-SERVICE stays valid when instances move, because client-side discovery turns it into a real address at call time.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,rx:6
  classDef core fill:#8250df,color:#ffffff,stroke:#8250df,rx:6
  classDef warn fill:#d29922,color:#ffffff,stroke:#d29922,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  n0["<b>1. Logical name in config</b><br/>config holds user_registration_url http://REGISTRATION-SERVICE/user"]:::start
  n1["<b>2. Resolve via discovery</b><br/>resolved_url : empty becomes http://10.0.0.7:8080/user"]:::step
  n2["<b>3. Proxy calls the instance</b><br/>call_target : empty becomes http://10.0.0.7:8080/user"]:::step
  n3["<b>4. Registration service reached</b><br/>RegistrationServiceProxy reaches REG"]:::stop
  n4["<b>5. Name unresolved</b><br/>a logical name has no host and port to dial"]:::warn
  n0 -->|"1. name is not a network location"| n1
  n1 -->|"2. logical name becomes a real address"| n2
  n2 -->|"3. invoke the dependency"| n3
  n0 -->|"4. discovery unavailable - call has no address"| n4
```

1. **Config names the dependency logically** — The configuration holds a logical name (e.g. USER_REGISTRATION_URL: http://REGISTRATION-SERVICE/user), not a host and port.

2. **Client-side discovery resolves it** — The logical name REGISTRATION-SERVICE is resolved using client-side discovery into a real network location.

3. **The component calls the resolved service** — A component like RegistrationServiceProxy uses the resolved address to invoke the registration service.

```java
// WEB SERVICE SIDE — config names the dependency logically; client-side discovery resolves the real location
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
// <- resolved_url : "http://10.0.0.7:8080/user" — RegistrationServiceProxy reaches REG
```


## Key Concepts

### The Problem

**Running in many environments without modification.** The service must run in dev, test, QA, staging, and production without modification or recompilation, even though each environment has different service instances.


### The Solution

Externalize all configuration, including database credentials and network location; on startup the service reads it from an external source such as OS environment variables.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Externalize all application configuration | Externalize all configuration, including database credentials and network location; on startup the service reads it from an external source such as OS environment variables. | Spring Boot externalized configuration reads values from OS environment variables, property files, and command-line arguments. |
| Logical names still need resolving | The logical name is resolved using client-side discovery, which supplies the real network location. | The tradeoff is that externalized config defers the location problem to the service discovery patterns, which solve it separately. |
| Supplied config may not match expectations | The open issue is how to ensure that, when an application is deployed, the supplied configuration matches what is expected. | The tradeoff is that portability is bought with a new verification duty at deploy time. |


### Tradeoffs & When

- The logical name is resolved using client-side discovery, which supplies the real network location.
- The open issue is how to ensure that, when an application is deployed, the supplied configuration matches what is expected.


<details><summary>All concepts (index)</summary>

### Problem: Running in many environments without modification

**Why.** A service must be told how to connect to its external and third-party services — the database network location and credentials, for example.

**Claim.** The service must run in dev, test, QA, staging, and production without modification or recompilation, even though each environment has different service instances.

**Grounding.** These are the reference forces, nearly verbatim: a QA database vs the production database, a test credit-card account vs the production one.

**In the wild.** Any value baked into the code forces a separate build per environment.
### Solution: Externalize all application configuration

**Why.** The only way one build serves many environments is to move the differences out of the build.

**Claim.** Externalize all configuration, including database credentials and network location; on startup the service reads it from an external source such as OS environment variables.

**Grounding.** This is the reference solution.

**In the wild.** Spring Boot externalized configuration reads values from OS environment variables, property files, and command-line arguments.
### Tradeoff: Logical names still need resolving

**Why.** Config can hold a logical name like REGISTRATION-SERVICE, but code cannot connect to a name.

**Claim.** The logical name is resolved using client-side discovery, which supplies the real network location.

**Grounding.** The RegistrationServiceProxy example configures user_registration_url and resolves REGISTRATION-SERVICE via client-side discovery.

**In the wild.** The tradeoff is that externalized config defers the location problem to the service discovery patterns, which solve it separately.
### Tradeoff: Supplied config may not match expectations

**Why.** Once configuration lives outside the code, a deployment can be given the wrong values.

**Claim.** The open issue is how to ensure that, when an application is deployed, the supplied configuration matches what is expected.

**Grounding.** This is the issue listed in the resulting context.

**In the wild.** The tradeoff is that portability is bought with a new verification duty at deploy time.

</details>


## Quiz

1. What problem does Externalized Configuration solve?

   - A. How to authenticate a requestor
   - B. How to enable a service to run in multiple environments without modification
   - C. How to pass identity between services
   - D. How to aggregate data across services

<details><summary>Reveal answer</summary>

**B.** The reference problem is exactly: how to enable a service to run in multiple environments without modification. A and C belong to the Access Token pattern, and D is API composition.

</details>

2. What must be externalized, according to the solution?

   - A. Only the application's business logic
   - B. All application configuration, including database credentials and network location
   - C. Only the log output format
   - D. Only the service's public API

<details><summary>Reveal answer</summary>

**B.** The solution says externalize all application configuration including the database credentials and network location. The other options narrow the scope to things the pattern does not target.

</details>

3. When does the service read its externalized configuration?

   - A. On startup, from an external source such as OS environment variables
   - B. At compile time
   - C. Only when a request arrives
   - D. Never — it is generated at runtime

<details><summary>Reveal answer</summary>

**A.** The reference solution states that on startup a service reads the configuration from an external source, e.g. OS environment variables. Reading at compile time (B) would defeat externalization; C and D contradict the startup read.

</details>

4. In the RegistrationServiceProxy example, what is REGISTRATION-SERVICE?

   - A. A hardcoded IP address
   - B. The logical name of the service, resolved using client-side discovery
   - C. A database table name
   - D. The name of a Docker image

<details><summary>Reveal answer</summary>

**B.** The reference says REGISTRATION-SERVICE is the logical name of the service, resolved using client-side discovery. It is not an IP (A), a table (C), or an image (D).

</details>

