# Chapter 39: Language-Specific Packaging Format

> Deploy each service as a language-specific package — a Java JAR or WAR, a Node.js directory of modules, or a Go OS-specific executable.

_Also known as: Chris Richardson · Microservice Patterns p.387 · microservices.io /patterns/deployment/language-specific-packaging-format.html_

## Flow

### Package the service in its own language

> **Why this matters:** Every language has a native package format. Shipping that format directly is the simplest possible deployment, and its drawbacks are what motivate every other deployment option.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s0n0["<b>1. Build the native artifact</b><br/>A Spring Boot Java service builds to an executable JAR file, or a W…"]:::start
  s0n1["<b>2. Know the per-language shape</b><br/>For Node.js a service is a directory of source code and modules; fo…"]:::step
  s0n2["<b>3. Hand off to the pipeline</b><br/>The deployment pipeline builds the JAR or WAR and invokes the produ…"]:::stop
  s0n0 --> s0n1
  s0n1 --> s0n2
```

1. **Build the native artifact** — A Spring Boot Java service builds to an executable JAR file, or a WAR file.

2. **Know the per-language shape** — For Node.js a service is a directory of source code and modules; for Go it is an OS-specific executable.

3. **Hand off to the pipeline** — The deployment pipeline builds the JAR or WAR and invokes the production environment's service management interface.

```java
// BUILD SIDE — package the service in its language's native format so the pipeline can ship one artifact
// PARTIES: BLD = deployment pipeline · SVC = Restaurant Service
// STATE (before):
//    artifact : null                    // nothing built yet
//    src : "restaurant-service"         // Spring Boot Java source
// DEF: build version 3.1.0 · CALLED BY: BLD on commit
// -> service : "restaurant-service" · -> version : "3.1.0"
//    step 1 · compile · artifact : null -> "restaurant-service-3.1.0.jar"  BECAUSE a Spring Boot app packages as an executable JAR
//    step 2 · choose format · format : "unknown" -> "jar"                   // a JAR or WAR; a WAR would add a web container
//    step 3 · hand off · pipeline : 0 -> 1                                  BECAUSE the pipeline invokes the service management interface
// <- artifact : "restaurant-service-3.1.0.jar"  · one executable JAR to deploy
//    alt WAR packaging : artifact : null -> "restaurant-service-3.1.0.war"  BECAUSE a WAR also needs a web container installed
```

### Install the runtime and start the service

> **Why this matters:** The package does not carry its own runtime. The machine must be configured first — the JDK for a JAR, plus a web container such as Tomcat for a WAR — before the service can run.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s1n0["<b>1. Install the runtime</b><br/>For a Java service you install the JDK first; a WAR additionally ne…"]:::start
  s1n1["<b>2. Copy the package</b><br/>Once the machine is configured, you copy the package to the machine."]:::step
  s1n2["<b>3. Start the service</b><br/>Each service instance runs as a JVM process."]:::stop
  s1n0 --> s1n1
  s1n1 --> s1n2
```

1. **Install the runtime** — For a Java service you install the JDK first; a WAR additionally needs Apache Tomcat.

2. **Copy the package** — Once the machine is configured, you copy the package to the machine.

3. **Start the service** — Each service instance runs as a JVM process.

```java
// RUNTIME SIDE — configure a machine, copy the package, and start it as a JVM process
// PARTIES: MACH = the production machine · SVC = Restaurant Service
// STATE (before):
//    runtime : {}                       // software installed on the machine, none yet
//    process : null                     // no service process running yet
// DEF: deploy JAR 3.1.0 · CALLED BY: the service management interface
// -> artifact : "restaurant-service-3.1.0.jar"
//    step 1 · install JDK · runtime : {} -> {"jdk":"17"}   BECAUSE a Java service needs the JDK installed first
//    step 2 · copy package · process : null -> "pending"   // the JAR is copied onto the machine
//    step 3 · start · process : "pending" -> "jvm-8121"    // the service starts as a JVM process
// <- process : "jvm-8121"  · one JVM running one service instance
//    alt WAR path : runtime : {"jdk":"17"} -> {"jdk":"17","tomcat":"10"}  BECAUSE a WAR also needs Apache Tomcat installed
```

### Run several instances on one machine

> **Why this matters:** You are not forced to one instance per machine. Multiple JVMs can run on a single machine, each running a single service instance.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s2n0["<b>1. Launch multiple JVMs</b><br/>Each JVM runs a single service instance, and a machine can host sev…"]:::start
  s2n1["<b>2. Bind separate ports</b><br/>Each instance binds its own port on the shared machine."]:::step
  s2n2["<b>3. Recall instance shapes</b><br/>An instance is usually a single process, but a Node.js service may…"]:::stop
  s2n0 --> s2n1
  s2n1 --> s2n2
```

1. **Launch multiple JVMs** — Each JVM runs a single service instance, and a machine can host several JVMs.

2. **Bind separate ports** — Each instance binds its own port on the shared machine.

3. **Recall instance shapes** — An instance is usually a single process, but a Node.js service may spawn multiple worker processes.

```java
// RUNTIME SIDE — run several service instances on one machine, one JVM per instance
// PARTIES: MACH = the production machine · SVC = Restaurant Service
// STATE (before):
//    jvms : {}                          // JVM processes on this machine, none yet
//    jar : "restaurant-service-3.1.0.jar"
// DEF: start 3 instances · CALLED BY: a scale-up on one machine
// -> instance_count : 3
//    step 1 · launch JVMs · jvms : {} -> {"jvm-1","jvm-2","jvm-3"}  BECAUSE each JVM runs a single service instance
//    step 2 · bind ports · ports : 0 -> 3                          // each instance binds its own port on the machine
//    step 3 · serve · serving : 0 -> 3                             // 3 instances share the same machine and JDK
// <- instances : 3  · multiple JVMs share one machine
//    alt single instance : instance_count : 3 -> 1   BECAUSE some deployments keep one instance per machine
```

### Why this option motivates the others

> **Why this matters:** The language-specific package leaves the runtime outside the artifact, so the machine must be configured by hand. That unmanaged, shared runtime is exactly what the VM and container options fix by encapsulating the stack.

```mermaid
flowchart TD
  classDef step fill:#1f6feb,color:#ffffff,stroke:#388bfd,stroke-width:1px,rx:6
  classDef start fill:#238636,color:#ffffff,stroke:#2ea043,rx:6
  classDef stop fill:#b62324,color:#ffffff,stroke:#da3633,rx:6
  s3n0["<b>1. Configure the machine by hand</b><br/>The JDK and, for a WAR, Tomcat must be installed and pinned before…"]:::start
  s3n1["<b>2. Notice the stack is not encapsulated</b><br/>Unlike a VM or container image, the package does not carry its tech…"]:::step
  s3n2["<b>3. Prefer the encapsulating options</b><br/>The book recommends one of the other options; this pattern's drawba…"]:::stop
  s3n0 --> s3n1
  s3n1 --> s3n2
```

1. **Configure the machine by hand** — The JDK and, for a WAR, Tomcat must be installed and pinned before the service runs.

2. **Notice the stack is not encapsulated** — Unlike a VM or container image, the package does not carry its technology stack.

3. **Prefer the encapsulating options** — The book recommends one of the other options; this pattern's drawbacks motivate them.

```java
// TRADEOFF SIDE — the package runs on a shared, hand-configured runtime, which motivates VM and container packaging
// PARTIES: MACH = the machine · SVC = Restaurant Service
// STATE (before):
//    setup : []                         // manual steps required before the service can run
//    jdk : null                         // the runtime, not yet installed
// DEF: prepare machine for 3.1.0 · CALLED BY: an operator
// -> service : "restaurant-service"
//    step 1 · install runtime · setup : [] -> ["install jdk","install tomcat"]  BECAUSE the package does not carry its own runtime
//    step 2 · configure · jdk : null -> "17"                                     // the operator pins the JDK version by hand
//    step 3 · contrast · stack_encapsulated : 0 -> 1                             BECAUSE a VM or container image WOULD encapsulate the stack
// <- setup : 2 manual steps  · this unmanaged runtime is the drawback that motivates the other options
//    alt VM packaging : setup : ["install jdk","install tomcat"] -> []  BECAUSE a VM image encapsulates the whole technology stack
```


## Key Concepts

### The Problem

**A package that needs a pre-installed runtime.** With a language-specific package, what is deployed is the package itself, and the machine must be configured with the runtime before the service can run.


### The Solution

Deploy the service in its language-specific package: an executable JAR or WAR for Java, a directory of source code and modules for Node.js, or an OS-specific executable for Go.


### Key Facts

| Fact | Detail | In the wild |
|---|---|---|
| Deploy the language-specific package | Deploy the service in its language-specific package: an executable JAR or WAR for Java, a directory of source code and modules for Node.js, or an OS-specific executable for Go. | A Java service instance is a process running the JVM; a Node.js service may spawn multiple worker processes. |
| One JVM per instance, many per machine | You can run multiple JVMs on a single machine, each JVM running a single service instance. | This gives coarser resource sharing than the VM or container patterns, where isolation is stronger. |
| The runtime is not encapsulated | Because the package does not carry its runtime, the machine must be configured first, which is a drawback. | Teams that want the stack bundled choose the VM or container options instead. |


### Tradeoffs & When

- You can run multiple JVMs on a single machine, each JVM running a single service instance.
- Because the package does not carry its runtime, the machine must be configured first, which is a drawback.


<details><summary>All concepts (index)</summary>

### Problem: A package that needs a pre-installed runtime

**Why.** A production environment must let developers create, update, and configure services, keep the desired number of instances running, monitor them, and route requests to them.

**Claim.** With a language-specific package, what is deployed is the package itself, and the machine must be configured with the runtime before the service can run.

**Grounding.** The book walks through deploying the Spring Boot Restaurant Service: install the JDK, and for a WAR install Apache Tomcat, then copy the package and start the service.

**In the wild.** Each service instance then runs as a JVM process on the configured machine.
### Solution: Deploy the language-specific package

**Why.** It is the simplest deployment option, and it is worth exploring even when you will choose another option.

**Claim.** Deploy the service in its language-specific package: an executable JAR or WAR for Java, a directory of source code and modules for Node.js, or an OS-specific executable for Go.

**Grounding.** The pattern text names each language's package shape and shows the deployment pipeline building an executable JAR or WAR and handing it to the service management interface.

**In the wild.** A Java service instance is a process running the JVM; a Node.js service may spawn multiple worker processes.
### Tradeoff: One JVM per instance, many per machine

**Why.** You may want to run more than one instance on a machine without extra packaging work.

**Claim.** You can run multiple JVMs on a single machine, each JVM running a single service instance.

**Grounding.** Figure 12.4 in the book shows multiple JVM processes on one machine, each running one service instance, and notes some languages support several instances per process.

**In the wild.** This gives coarser resource sharing than the VM or container patterns, where isolation is stronger.
### Tradeoff: The runtime is not encapsulated

**Why.** Deployment should be reliable and repeatable across machines.

**Claim.** Because the package does not carry its runtime, the machine must be configured first, which is a drawback.

**Grounding.** The book explicitly says its drawbacks motivate the other options, and the VM and container patterns are described as encapsulating the service's technology stack.

**In the wild.** Teams that want the stack bundled choose the VM or container options instead.

</details>


## Quiz

1. What is deployed and managed when using the Language-specific packaging format?

   - A. A container image
   - B. A virtual machine image
   - C. The service in its language-specific package, such as a JAR or WAR
   - D. A serverless function

<details><summary>Reveal answer</summary>

**C.** What is deployed is the service in its language-specific package — an executable JAR or WAR for Java (C). A container image, VM image, and serverless function are the other three deployment options.

</details>

2. What must you install before deploying a Java WAR file?

   - A. Only the JDK
   - B. The JDK and a web container such as Apache Tomcat
   - C. Docker
   - D. Nothing — the WAR carries its own runtime

<details><summary>Reveal answer</summary>

**B.** For a WAR file you install the JDK and also a web container such as Apache Tomcat (B). A JAR needs only the JDK; the WAR does not carry its runtime.

</details>

3. How does a Java service instance run in production?

   - A. As a JVM process
   - B. As a Kubernetes pod
   - C. As a Lambda function
   - D. As a Docker daemon

<details><summary>Reveal answer</summary>

**A.** A Java service instance is a process running the JVM (A). Pods, Lambda functions, and the Docker daemon belong to other deployment patterns.

</details>

4. Why does the book say this pattern's drawbacks motivate the other options?

   - A. The package does not encapsulate the technology stack, so the runtime must be installed and configured by hand
   - B. The package runs too fast
   - C. The package is impossible to scale
   - D. The package requires Kubernetes

<details><summary>Reveal answer</summary>

**A.** The language-specific package leaves the runtime outside, so a machine must be configured with the JDK and Tomcat before the service runs (A); the VM and container options fix this by encapsulating the stack. The other options are not the stated reason.

</details>

