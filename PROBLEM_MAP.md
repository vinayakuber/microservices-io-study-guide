# The 28 problems → three knowledge bases (mapped + ranked)

Each of the 28 system-design problems (in `system-design-deep-dives`) is mapped
against **all three** books, and the best pattern/solution is **handpicked** per
problem. Ranked candidates are listed strongest-first; the **PICK** is the one
that belongs in the solution.

Books:
- **DDIA** — Designing Data-Intensive Applications (14 chapters).
- **PDS** — Patterns of Distributed Systems (30 patterns).
- **MSP** — Microservice Patterns / microservices.io (44 patterns).

Legend: ⭐ = the handpicked best for this problem · 🥈 = strong secondary · 🥉 = supporting.

| # | Problem | ⭐ Best | 🥈 Secondary | 🥉 Supporting |
|---|---|---|---|---|
| 1 | Scale from zero to millions | MSP ch02 Microservice architecture + ch03 Decompose by business capability | DDIA ch06 Replication + ch07 Sharding | MSP ch23 API gateway · ch11 Server-side discovery |
| 2 | Back-of-the-envelope estimation | DDIA ch02 Nonfunctional requirements | DDIA ch01 Trade-offs | — |
| 3 | Framework for system-design interviews | DDIA ch01 Trade-offs | DDIA ch02 Nonfunctional requirements | MSP ch03 Decompose by business capability |
| 4 | Rate limiter | MSP ch23 API gateway (edge function) | DDIA ch01 Trade-offs (correctness vs cost) | MSP ch30 Microservice chassis |
| 5 | Consistent hashing | DDIA ch07 Sharding (hash partitioning) | PDS ch19 Fixed partitions + ch20 Key-range partitions | DDIA ch06 Replication |
| 6 | Key-value store | DDIA ch04 Storage engines (LSM/B-tree) | DDIA ch06 Replication + ch07 Sharding | PDS ch03 WAL · ch06 Leader-followers · ch10 High-water mark · ch12 Replicated log · ch18 Version vector |
| 7 | Unique ID generator | PDS ch23 Hybrid clock | PDS ch09 Generation clock · ch22 Lamport clock | DDIA ch09 The trouble with distributed systems (clocks) |
| 8 | URL shortener | DDIA ch04 Storage engines (hash index) | DDIA ch06 Replication + ch07 Sharding | PDS ch15 Idempotent receiver |
| 9 | Web crawler | DDIA ch11 Batch processing (MapReduce) | DDIA ch12 Stream processing | DDIA ch14 Doing the right thing |
| 10 | Notification system | MSP ch05 Messaging + ch14 Transactional outbox | DDIA ch12 Stream processing (publish/subscribe) | MSP ch15 Saga (fan-out) · ch12 Polling publisher |
| 11 | News feed | MSP ch22 CQRS + ch17 Domain event | DDIA ch12 Stream processing (fan-out) | MSP ch21 API composition |
| 12 | Chat system | DDIA ch12 Stream processing (log-based broker) | MSP ch05 Messaging | PDS ch04 Segmented log · ch32 Request pipeline · ch31 Single-socket channel |
| 13 | Search autocomplete | DDIA ch04 Inverted index | DDIA ch03 Data models | DDIA ch01 Trade-offs |
| 14 | YouTube | DDIA ch04 Storage + ch06 Replication + ch07 Sharding | MSP ch03 Decompose by business capability + ch41 Serverless deployment | MSP ch24 Backends for frontends |
| 15 | Google Drive | PDS ch18 Version vector + ch17 Versioned value | DDIA ch05 Encoding + ch08 Transactions | MSP ch19 Event sourcing |
| 16 | Proximity service | DDIA ch04 Spatial (R-tree) index | DDIA ch07 Sharding | PDS ch20 Key-range partitions |
| 17 | Nearby friends | PDS ch27 State watch + ch28 Gossip dissemination | DDIA ch12 Stream processing | MSP ch05 Messaging |
| 18 | Google Maps | DDIA ch04 Spatial index | DDIA ch07 Sharding | MSP ch03 Decompose by business capability |
| 19 | Distributed message queue | DDIA ch12 Stream processing (log-based broker) | PDS ch04 Segmented log + ch06 Leader-followers + ch12 Replicated log | MSP ch05 Messaging |
| 20 | Metrics monitoring | MSP ch31 Application metrics + ch36 Log aggregation | DDIA ch12 Stream aggregation | MSP ch33 Distributed tracing |
| 21 | Ad-click aggregation | DDIA ch12 Stream processing (windowing, exactly-once) | DDIA ch11 Batch processing | — |
| 22 | Hotel reservation | MSP ch15 Saga | DDIA ch08 Transactions | PDS ch21 Two-phase commit · ch15 Idempotent receiver |
| 23 | Distributed email | MSP ch14 Transactional outbox + ch05 Messaging | DDIA ch12 Stream processing | PDS ch03 WAL · ch04 Segmented log |
| 24 | S3 object storage | DDIA ch04 Storage engines | DDIA ch06 Replication + ch07 Sharding | PDS ch17 Versioned value |
| 25 | Gaming leaderboard | DDIA ch12 Stream processing (top-K) | DDIA ch11 Batch processing | DDIA ch01 Trade-offs |
| 26 | Payment system | MSP ch14 Transactional outbox + ch15 Saga | DDIA ch08 Transactions + ch10 Consistency | PDS ch15 Idempotent receiver · ch21 Two-phase commit |
| 27 | Digital wallet | DDIA ch08 Transactions (double-entry, isolation) | MSP ch16 Aggregate + ch14 Transactional outbox | PDS ch15 Idempotent receiver · ch17 Versioned value |
| 28 | Stock exchange | PDS ch12 Replicated log + ch06 Leader-followers | DDIA ch12 Stream processing | PDS ch32 Request pipeline · ch31 Single-socket channel · ch09 Generation clock |

## The handpicked picks, in words

1. **Scale from zero to millions** — *Decompose + replicate + shard.* Split the monolith by business capability (MSP ch02/ch03), put replicas behind load balancers (DDIA ch06), shard the data layer (DDIA ch07), front it with an API gateway (MSP ch23).
2. **Estimation** — *The capacity math.* QPS/storage/bandwidth with the numbers-derived-from-a-seed discipline (DDIA ch02), always stating the trade-off (DDIA ch01).
3. **Framework** — *Trade-offs first.* The DDIA ch01 four-way (correctness/simplicity/evolvability) is the skeleton of any answer.
4. **Rate limiter** — *Edge function.* Rate limiting is an API-gateway edge function (MSP ch23) with a correctness-vs-cost trade-off (DDIA ch01).
5. **Consistent hashing** — *Hash partition.* A hash ring is just hash partitioning with remap minimization (DDIA ch07); the physical layout is fixed/key-range partitions (PDS ch19/ch20).
6. **Key-value store** — *Storage engine + replication + sharding.* LSM/B-tree internals (DDIA ch04), leader/follower replication with a WAL and high-water mark (PDS ch03/ch06/ch10), hash sharding (DDIA ch07).
7. **Unique ID** — *Hybrid clock.* A hybrid clock gives globally-unique, roughly time-ordered 64-bit ids (PDS ch23).
8. **URL shortener** — *Hash index over a log.* The simplest possible index (DDIA ch04) + replication + sharding.
9. **Web crawler** — *Batch pipeline.* Map/reduce the fetch-parse-store pipeline (DDIA ch11).
10. **Notification system** — *Messaging + outbox.* Reliable, ordered delivery with the transactional outbox (MSP ch14) and messaging (MSP ch05).
11. **News feed** — *CQRS + events.* Write path appends posts; read path is a prebuilt per-user feed (MSP ch22), fed by domain events (MSP ch17).
12. **Chat system** — *Log-based broker.* Messages are an append-only log (DDIA ch12, PDS ch04); persistent connections are single-socket channels (PDS ch31).
13. **Autocomplete** — *Inverted/trie index.* DDIA ch04's inverted index, kept in memory, sharded by prefix (DDIA ch07).
14. **YouTube** — *Decompose + storage tier.* Split upload/transcode/stream (MSP ch03); transcode on serverless (MSP ch41); object storage + sharded metadata (DDIA ch04/07).
15. **Google Drive** — *Version vectors.* Concurrent edits resolve via version vectors (PDS ch18); encoding/schema evolution keeps clients compatible (DDIA ch05).
16. **Proximity** — *Spatial index.* R-tree range queries (DDIA ch04), sharded by geohash (DDIA ch07).
17. **Nearby friends** — *State watch + gossip.* Location changes propagate by state-watch subscription (PDS ch27) and gossip (PDS ch28).
18. **Google Maps** — *Spatial + shard.* Same spatial engine (DDIA ch04), partitioned by region (DDIA ch07).
19. **Message queue** — *Segmented replicated log.* The broker is a segmented log (PDS ch04) replicated leader/follower (PDS ch06/ch12), consumed in batches (PDS ch32).
20. **Metrics monitoring** — *Metrics + aggregation.* Instrumented via the chassis (MSP ch30/ch31), aggregated as a stream (DDIA ch12), centralized logs (MSP ch36).
21. **Ad-click aggregation** — *Stream windowing.* Exactly-once windowed aggregation (DDIA ch12) over the click stream.
22. **Hotel reservation** — *Saga.* A reservation is a multi-service saga with compensating transactions (MSP ch15); atomic per-service steps via local transactions (DDIA ch08).
23. **Distributed email** — *Outbox + messaging.* Send/receive is a reliable pipeline with the transactional outbox (MSP ch14) over messaging (MSP ch05).
24. **S3 object storage** — *Immutable store.* Append-once objects with versioned values (PDS ch17) over replicated/sharded storage (DDIA ch04/06/07).
25. **Leaderboard** — *Stream top-K.* Maintain top-K per board with stream aggregation (DDIA ch12).
26. **Payment system** — *Outbox + saga + idempotency.* Atomically write the payment + outbox (MSP ch14), drive the multi-step flow as a saga (MSP ch15), make every receiver idempotent (PDS ch15), and lean on local transactions (DDIA ch08).
27. **Digital wallet** — *Transactions + aggregate.* Double-entry ledger invariants inside one aggregate (MSP ch16) under serializable isolation (DDIA ch08), idempotent transfers (PDS ch15).
28. **Stock exchange** — *Replicated log.* The matching engine's order book is a replicated log (PDS ch12) with leader/follower failover (PDS ch06); market data fans out as a stream (DDIA ch12).
