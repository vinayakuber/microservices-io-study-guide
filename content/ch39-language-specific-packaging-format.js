registerChapter({
  id: 'ch39',
  num: 39,
  title: 'Language-Specific Packaging Format',
  pattern: 'Deploy each service as a language-specific package — a Java JAR or WAR, a Node.js directory of modules, or a Go OS-specific executable.',
  aka: 'Chris Richardson · Microservice Patterns p.387 · microservices.io /patterns/deployment/language-specific-packaging-format.html',
  part: 9,
  flow: [
    {
      section: 'Package the service in its own language',
      color: 'orange',
      motivation: `Every language has a native package format. Shipping that format directly is the simplest possible deployment, and its drawbacks are what motivate every other deployment option.`,
      steps: [
        { num: 1, title: 'Build the native artifact', detail: 'A Spring Boot Java service builds to an executable JAR file, or a WAR file.' },
        { num: 2, title: 'Know the per-language shape', detail: 'For Node.js a service is a directory of source code and modules; for Go it is an OS-specific executable.' },
        { num: 3, title: 'Hand off to the pipeline', detail: 'The deployment pipeline builds the JAR or WAR and invokes the production environment\'s service management interface.' }
      ],
      program: `// BUILD SIDE — package the service in its language's native format so the pipeline can ship one artifact
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
//    alt WAR packaging : artifact : null -> "restaurant-service-3.1.0.war"  BECAUSE a WAR also needs a web container installed`
    },
    {
      section: 'Install the runtime and start the service',
      color: 'orange',
      motivation: `The package does not carry its own runtime. The machine must be configured first — the JDK for a JAR, plus a web container such as Tomcat for a WAR — before the service can run.`,
      steps: [
        { num: 1, title: 'Install the runtime', detail: 'For a Java service you install the JDK first; a WAR additionally needs Apache Tomcat.' },
        { num: 2, title: 'Copy the package', detail: 'Once the machine is configured, you copy the package to the machine.' },
        { num: 3, title: 'Start the service', detail: 'Each service instance runs as a JVM process.' }
      ],
      program: `// RUNTIME SIDE — configure a machine, copy the package, and start it as a JVM process
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
//    alt WAR path : runtime : {"jdk":"17"} -> {"jdk":"17","tomcat":"10"}  BECAUSE a WAR also needs Apache Tomcat installed`
    },
    {
      section: 'Run several instances on one machine',
      color: 'orange',
      motivation: `You are not forced to one instance per machine. Multiple JVMs can run on a single machine, each running a single service instance.`,
      steps: [
        { num: 1, title: 'Launch multiple JVMs', detail: 'Each JVM runs a single service instance, and a machine can host several JVMs.' },
        { num: 2, title: 'Bind separate ports', detail: 'Each instance binds its own port on the shared machine.' },
        { num: 3, title: 'Recall instance shapes', detail: 'An instance is usually a single process, but a Node.js service may spawn multiple worker processes.' }
      ],
      program: `// RUNTIME SIDE — run several service instances on one machine, one JVM per instance
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
//    alt single instance : instance_count : 3 -> 1   BECAUSE some deployments keep one instance per machine`
    },
    {
      section: 'Why this option motivates the others',
      color: 'orange',
      motivation: `The language-specific package leaves the runtime outside the artifact, so the machine must be configured by hand. That unmanaged, shared runtime is exactly what the VM and container options fix by encapsulating the stack.`,
      steps: [
        { num: 1, title: 'Configure the machine by hand', detail: 'The JDK and, for a WAR, Tomcat must be installed and pinned before the service runs.' },
        { num: 2, title: 'Notice the stack is not encapsulated', detail: 'Unlike a VM or container image, the package does not carry its technology stack.' },
        { num: 3, title: 'Prefer the encapsulating options', detail: 'The book recommends one of the other options; this pattern\'s drawbacks motivate them.' }
      ],
      program: `// TRADEOFF SIDE — the package runs on a shared, hand-configured runtime, which motivates VM and container packaging
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
//    alt VM packaging : setup : ["install jdk","install tomcat"] -> []  BECAUSE a VM image encapsulates the whole technology stack`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'A package that needs a pre-installed runtime', content: '<p><strong>Why.</strong> A production environment must let developers create, update, and configure services, keep the desired number of instances running, monitor them, and route requests to them.</p><p><strong>Claim.</strong> With a language-specific package, what is deployed is the package itself, and the machine must be configured with the runtime before the service can run.</p><p><strong>Grounding.</strong> The book walks through deploying the Spring Boot Restaurant Service: install the JDK, and for a WAR install Apache Tomcat, then copy the package and start the service.</p><p><strong>In the wild.</strong> Each service instance then runs as a JVM process on the configured machine.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'Deploy the language-specific package', content: '<p><strong>Why.</strong> It is the simplest deployment option, and it is worth exploring even when you will choose another option.</p><p><strong>Claim.</strong> Deploy the service in its language-specific package: an executable JAR or WAR for Java, a directory of source code and modules for Node.js, or an OS-specific executable for Go.</p><p><strong>Grounding.</strong> The pattern text names each language\'s package shape and shows the deployment pipeline building an executable JAR or WAR and handing it to the service management interface.</p><p><strong>In the wild.</strong> A Java service instance is a process running the JVM; a Node.js service may spawn multiple worker processes.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'One JVM per instance, many per machine', content: '<p><strong>Why.</strong> You may want to run more than one instance on a machine without extra packaging work.</p><p><strong>Claim.</strong> You can run multiple JVMs on a single machine, each JVM running a single service instance.</p><p><strong>Grounding.</strong> Figure 12.4 in the book shows multiple JVM processes on one machine, each running one service instance, and notes some languages support several instances per process.</p><p><strong>In the wild.</strong> This gives coarser resource sharing than the VM or container patterns, where isolation is stronger.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'The runtime is not encapsulated', content: '<p><strong>Why.</strong> Deployment should be reliable and repeatable across machines.</p><p><strong>Claim.</strong> Because the package does not carry its runtime, the machine must be configured first, which is a drawback.</p><p><strong>Grounding.</strong> The book explicitly says its drawbacks motivate the other options, and the VM and container patterns are described as encapsulating the service\'s technology stack.</p><p><strong>In the wild.</strong> Teams that want the stack bundled choose the VM or container options instead.</p>' }
    ]
  },
  quiz: [
    { "question": "What is deployed and managed when using the Language-specific packaging format?", "options": ["A. A container image", "B. A virtual machine image", "C. The service in its language-specific package, such as a JAR or WAR", "D. A serverless function"], "answer": 3, "explanation": "What is deployed is the service in its language-specific package — an executable JAR or WAR for Java (C). A container image, VM image, and serverless function are the other three deployment options.", "conceptRef": "Deploy the language-specific package" },
    { "question": "What must you install before deploying a Java WAR file?", "options": ["A. Only the JDK", "B. The JDK and a web container such as Apache Tomcat", "C. Docker", "D. Nothing — the WAR carries its own runtime"], "answer": 2, "explanation": "For a WAR file you install the JDK and also a web container such as Apache Tomcat (B). A JAR needs only the JDK; the WAR does not carry its runtime.", "conceptRef": "A package that needs a pre-installed runtime" },
    { "question": "How does a Java service instance run in production?", "options": ["A. As a JVM process", "B. As a Kubernetes pod", "C. As a Lambda function", "D. As a Docker daemon"], "answer": 1, "explanation": "A Java service instance is a process running the JVM (A). Pods, Lambda functions, and the Docker daemon belong to other deployment patterns.", "conceptRef": "Deploy the language-specific package" },
    { "question": "Why does the book say this pattern's drawbacks motivate the other options?", "options": ["A. The package does not encapsulate the technology stack, so the runtime must be installed and configured by hand", "B. The package runs too fast", "C. The package is impossible to scale", "D. The package requires Kubernetes"], "answer": 1, "explanation": "The language-specific package leaves the runtime outside, so a machine must be configured with the JDK and Tomcat before the service runs (A); the VM and container options fix this by encapsulating the stack. The other options are not the stated reason.", "conceptRef": "The runtime is not encapsulated" }
  ]
});
