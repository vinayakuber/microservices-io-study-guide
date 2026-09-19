registerChapter({
  id: 'ch38',
  num: 38,
  title: 'Service per VM',
  pattern: 'Package each service as a virtual-machine image and deploy each service instance as a separate VM.',
  aka: 'Chris Richardson · Microservice Patterns p.390 · microservices.io /patterns/deployment/service-per-vm.html',
  part: 9,
  flow: [
    {
      section: 'Bake a VM image',
      color: 'orange',
      motivation: `A VM image captures the service plus its technology stack, so every instance boots the same way and the details of the language and framework are hidden.`,
      steps: [
        { num: 1, title: 'Install the runtime into the image', detail: 'The image captures the service\'s technology stack, such as the JDK and OS.' },
        { num: 2, title: 'Copy the service code', detail: 'The service code is baked into the image so the instance is self-contained.' },
        { num: 3, title: 'Register the image', detail: 'The finished image is registered with the IaaS so instances can be launched from it.' }
      ],
      program: `// BUILD SIDE — bake a service plus its tech stack into a VM image so each instance boots the same way
// PARTIES: BLD = build pipeline · AMI = the resulting machine image
// STATE (before):
//    image : null                       // no VM image yet
//    stack : {}                         // technology stack captured by the image, empty
// DEF: bake version 2.3.0 · CALLED BY: BLD on release
// -> service : "catalog-service" · -> version : "2.3.0"
//    step 1 · install runtime · stack : {} -> {"jdk":"17","os":"linux"}  BECAUSE the image captures the service's technology stack
//    step 2 · copy code · image : null -> "catalog:2.3.0"                // service code is baked into the image
//    step 3 · register · ami : 0 -> 1                                    BECAUSE one AMI is now registered for launch
// <- ami : "catalog:2.3.0"  · 1 image, ready to launch as N EC2 instances
//    alt rebuild after a change : version : "2.3.0" -> "2.3.1"  BECAUSE building a VM image is slow and time consuming`
    },
    {
      section: 'Deploy each instance as a VM',
      color: 'orange',
      motivation: `Each service instance is a separate VM, launched from the shared image. Isolation is strong, and scaling means launching more instances.`,
      steps: [
        { num: 1, title: 'Launch VMs from the image', detail: 'Each service instance is a separate VM started from the same image.' },
        { num: 2, title: 'Front with a load balancer', detail: 'An Elastic Load Balancer fronts the instances and spreads traffic.' },
        { num: 3, title: 'Add instances for throughput', detail: 'Scaling the service means increasing the number of instances.' }
      ],
      program: `// RUNTIME SIDE — deploy one service instance per VM, launched from the shared AMI
// PARTIES: SVC = catalog-service · IaaS = the EC2 cloud
// STATE (before):
//    instances : {}                     // running VMs, none yet
//    ami : "catalog:2.3.0"              // the image every VM is launched from
// DEF: launch 3 instances · CALLED BY: a deploy of catalog-service
// -> instance_count : 3
//    step 1 · launch · instances : {} -> {"i-1","i-2","i-3"}  BECAUSE each instance is a separate VM from the same AMI
//    step 2 · attach · load_balancer : 0 -> 1                 // the Elastic Load Balancer fronts the instances
//    step 3 · serve · endpoints : 0 -> 3                      // 3 VMs now answer for the service
// <- instances : 3  · Netflix-style: one EC2 instance per service instance
//    alt scale out : instance_count : 3 -> 5   BECAUSE you increase the number of instances to add throughput`
    },
    {
      section: 'Scale automatically on load',
      color: 'orange',
      motivation: `A service must scale with load. The VM approach gets autoscaling almost for free because the IaaS already provides mature autoscaling groups.`,
      steps: [
        { num: 1, title: 'Bound the group', detail: 'An autoscaling group is bounded by a minimum and maximum number of VMs.' },
        { num: 2, title: 'Trigger on load', detail: 'When load crosses a threshold, the group launches more VMs automatically.' },
        { num: 3, title: 'Shrink when load drops', detail: 'The group terminates VMs when they are no longer needed.' }
      ],
      program: `// RUNTIME SIDE — scale the service automatically as load rises, no manual launch
// PARTIES: ASG = autoscaling group · SVC = catalog-service
// STATE (before):
//    group_size : 2                      // current VM count in the group
//    policy : {}                         // scaling policy, not yet triggered
// DEF: react to load 8.0 · CALLED BY: ASG monitoring CPU
// -> load : 8.0
//    step 1 · compare · policy : {} -> {"min":2,"max":6}   BECAUSE the group is bounded between 2 and 6 VMs
//    step 2 · trigger · group_size : 2 -> 4                // load exceeds threshold, so the group adds 2 VMs
//    step 3 · stabilize · healthy : 2 -> 4                 // the 2 new VMs come up healthy, total healthy = 4
// <- group_size : 4  · scaling happened automatically based on load
//    alt load drops : group_size : 4 -> 2   BECAUSE autoscaling removes VMs when they are unneeded`
    },
    {
      section: 'Mature IaaS, slow builds',
      color: 'orange',
      motivation: `The VM approach inherits a mature, feature-rich IaaS ecosystem, but every image build is slow and time consuming. That tradeoff defines when this pattern wins.`,
      steps: [
        { num: 1, title: 'Use ready-made features', detail: 'AWS provides mature infrastructure such as the Elastic Load Balancer and autoscaling groups.' },
        { num: 2, title: 'Pay the build cost', detail: 'Building a VM image is slow and time consuming.' },
        { num: 3, title: 'Compare with containers', detail: 'A container packages about 100x faster than an AMI, which is why containers are a lighter alternative.' }
      ],
      program: `// TRADEOFF SIDE — mature cloud tooling on one side, slow image builds on the other
// PARTIES: VM = the VM approach · BLD = the build pipeline
// STATE (before):
//    image : "catalog:2.3.0"            // the image being rebuilt
//    tools : 0                          // count of ready-made IaaS features in use
//    build_time : 0                     // seconds to produce an image
// DEF: measure deploy of 2.3.0 · CALLED BY: a release engineer
// -> service : "catalog-service"
//    step 1 · use ELB · tools : 0 -> 1       BECAUSE AWS provides a mature load balancer out of the box
//    step 2 · use ASG · tools : 1 -> 2       // autoscaling groups are another ready-made feature
//    step 3 · build · build_time : 0 -> 600  BECAUSE building a VM image is slow and time consuming
// <- tools : 2  · build_time : 600 s  · rich infrastructure, but each image build is slow
//    alt container build : build_time : 600 -> 6   BECAUSE a container packages ~100x faster than an AMI`
    }
  ],
  concepts: {
    cards: [
      { tag: 'problem', tagLabel: 'Problem', title: 'How to package services that must scale and isolate', content: '<p><strong>Why.</strong> Services are written in a variety of languages, frameworks, and versions, and each service runs as multiple instances that must be independently deployable and scalable.</p><p><strong>Claim.</strong> Each instance must be isolated from the others and constrained in the CPU and memory it consumes, while the whole thing must be deployed reliably and cost-effectively.</p><p><strong>Grounding.</strong> The pattern forces are identical to those of the container pattern: variety of technologies, multiple instances, isolation, and cost-effective deployment.</p><p><strong>In the wild.</strong> These forces are what drive teams toward a per-VM or per-container packaging choice.</p>' },
      { tag: 'solution', tagLabel: 'Solution', title: 'A VM image per service', content: '<p><strong>Why.</strong> You want the technology stack encapsulated so all services start and stop the same way.</p><p><strong>Claim.</strong> Package the service as a virtual machine image and deploy each service instance as a separate VM.</p><p><strong>Grounding.</strong> The solution states the service is packaged as a VM image; the example is Netflix packaging each service as an EC2 AMI and deploying each instance as an EC2 instance.</p><p><strong>In the wild.</strong> A VM imposes limits on CPU and memory and keeps each instance isolated.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Mature, feature-rich IaaS', content: '<p><strong>Why.</strong> You want deployment to be reliable without building every capability yourself.</p><p><strong>Claim.</strong> IaaS solutions such as AWS provide a mature and feature-rich infrastructure for deploying and managing virtual machines.</p><p><strong>Grounding.</strong> The resulting context names the Elastic Load Balancer and autoscaling groups as ready-made features, and notes autoscaling can react to load automatically.</p><p><strong>In the wild.</strong> Netflix relies on this mature AWS tooling to run each service as an EC2 instance.</p>' },
      { tag: 'tradeoff', tagLabel: 'Tradeoff', title: 'Slow image builds', content: '<p><strong>Why.</strong> You need to be able to quickly build and deploy a service.</p><p><strong>Claim.</strong> Building a VM image is slow and time consuming, which works against rapid iteration.</p><p><strong>Grounding.</strong> The resulting context lists slow image builds as the main drawback of the VM approach.</p><p><strong>In the wild.</strong> Teams that need frequent redeploys prefer containers, which package about 100x faster than an AMI.</p>' }
    ]
  },
  quiz: [
    { "question": "What is the solution of the Service per VM pattern?", "options": ["A. Package each service as a virtual machine image and deploy each instance as a separate VM", "B. Package each service as a container image and deploy each instance as a container", "C. Deploy each service as a JAR on a shared machine", "D. Run each service inside a serverless function"], "answer": 1, "explanation": "The pattern packages the service as a virtual machine image and deploys each instance as a separate VM (A). B is the container pattern, C is language-specific packaging, and D is serverless deployment.", "conceptRef": "A VM image per service" },
    { "question": "Which company is given as the example of the Service per VM pattern?", "options": ["A. Google", "B. Amazon", "C. Netflix", "D. Spotify"], "answer": 3, "explanation": "The reference uses Netflix, which packages each service as an EC2 AMI and deploys each instance as an EC2 instance (C). The others are not named.", "conceptRef": "A VM image per service" },
    { "question": "What does the reference identify as the main drawback of the VM approach?", "options": ["A. Instances are not isolated", "B. Building a VM image is slow and time consuming", "C. Services cannot be scaled", "D. The technology stack is not encapsulated"], "answer": 2, "explanation": "Building a VM image is slow and time consuming (B). The other options contradict the listed benefits: VMs are isolated, scalable, and encapsulate the tech stack.", "conceptRef": "Slow image builds" },
    { "question": "Which mature IaaS features does the reference name for the VM approach?", "options": ["A. Elastic Load Balancer and autoscaling groups", "B. Docker and Kubernetes", "C. AWS Lambda and API Gateway", "D. Kinesis and S3"], "answer": 1, "explanation": "The reference names the Elastic Load Balancer and autoscaling groups as mature AWS features (A). Docker and Kubernetes are container tooling, and Lambda, API Gateway, Kinesis, and S3 are not the VM-management features listed here.", "conceptRef": "Mature, feature-rich IaaS" }
  ]
});
