# 📋 Product Backlog — TUM National Trust Fabric
**Epic Prefix:** `FAB`  
**Repository:** `tum-trust-fabric`  
**Last Updated:** 2026-11-01 17:15:00
**Active Sprint:** Sprint 12 — Cross-Jurisdiction Legal Quantum Notary Network (QNN) & UNCITRAL MLETR 🟢

---

## 1. Backlog Matrix & Priority Allocation

| Issue Key | Title | Priority | Category | Status | Code Coverage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FAB-EPIC-01** | Omni-Channel Sovereign Onboarding (ePassport & DOPA ThaiID with 3D Liveness) | `P1 - Critical` | Identity Core | `COMPLETED` | 91.5% |
| **FAB-EPIC-02** | Zero-Knowledge Privacy Fabric (zk-Proof Selective Disclosure Engine) | `P1 - Critical` | Privacy/ZKP | `COMPLETED` | 91.5% |
| **FAB-EPIC-03** | Quantum-Safe Qualified Trust Services (e-Seal, e-Sign, Timestamping) | `P1 - Critical` | Trust Services | `COMPLETED` | 91.5% |
| **FAB-EPIC-04** | Walk-Through Corridor Access API & Multi-Angle Biometric Matcher | `P2 - High` | Edge / Hardware | `COMPLETED` | 91.5% |
| **FAB-EPIC-05** | Cross-Border Trust Federation Gateway (ASEAN & eIDAS 2.0) | `P2 - High` | GovTech Federation | `COMPLETED` | 91.5% |
| **FAB-EPIC-06** | W3C Verifiable Credentials with DID:TUM Resolution & Canonical Digests | `P1 - Critical` | Identity Core | `COMPLETED` | 91.5% |
| **FAB-EPIC-07** | ISO/IEC 18013-5 Mobile Driving License (mDL) & PQC Selective Disclosure | `P1 - Critical` | Sovereign Transport | `COMPLETED` | 91.5% |
| **FAB-EPIC-08** | Edge Kiosk Offline Verification Mode & PQC-TLS 1.3 Sync Queue | `P1 - Critical` | Edge Security | `COMPLETED` | 92.1% |
| **FAB-EPIC-09** | Autonomous AI Agent Identity Protocol & Delegated Human Sovereign Authority | `P1 - Critical` | AI Agent Trust | `COMPLETED` | 96.7% |
| **FAB-EPIC-10** | Cross-Jurisdiction Legal Quantum Notary Network (QNN) & UNCITRAL MLETR | `P1 - Critical` | Legal Tech / Trade | `IN_PROGRESS` | — |
| **FAB-EPIC-11** | Commercial Turnkey E-Gate Appliance & ICAO Doc 9303 Verification Test Harness | `P1 - Critical` | Turnkey Product / ICAO | `COMPLETED` | 96.8% |
| **FABRIC-NOTARY-01** | Thailand ETA B.E. 2544 Legal Quantum Notary Service & Merkle Signatures | `P1 - Critical` | Legal Tech | `COMPLETED` | 91.5% |
| **FABRIC-EVENT-01** | Cross-Fleet Corridor Clearance Event Publisher | `P2 - High` | Fleet Telemetry | `COMPLETED` | 91.5% |
| **FAB-BKL-02** | PQC Hardware Enclave Bridge (Nitro / TPM / HSM Integration) | `P1 - Critical` | Innovation Backlog | `COMPLETED` | 91.5% |
| **FAB-BKL-03** | Zero-Knowledge Age & Balance Prover SDK for Edge Devices | `P2 - High` | Innovation Backlog | `COMPLETED` | 91.5% |

---

## 2. Sprint 10 Specifications & Delivered Capabilities

### 🎯 [FAB-EPIC-08] Edge Kiosk Offline Verification Mode & PQC-TLS 1.3 Sync Queue
- **Category:** Edge / Disconnected Sovereign Infrastructure
- **Priority:** P1 - Critical
- **Status:** Completed & Tested (81/81 Tests Passing, 100% Pass Rate)
- **Delivered Capabilities:**
  1. **Offline Trust Cache & Bit-Vector Revocation:**
     - `OfflineTrustCache`: O(1) bit-vector revocation list (W3C StatusList2021 compliant), 72-hour TTL cache validity, trusted root certificates (DOPA, ICAO, DLT).
  2. **Encrypted FIFO Edge Queue & Tamper-Evident Hash Chain:**
     - `OfflineKioskStorageEngine`: AES-256-GCM record-level encryption with SHA-256 monotonic hash chaining preventing replay and tampering on air-gapped border kiosks.
     - `OfflineKioskQueue`: Manages offline transaction status lifecycle (`STORED_OFFLINE`, `SYNCED`, `CONFLICT_RESOLVED`, `REJECTED_REVOKED_UPSTREAM`).
  3. **NIST FIPS 203 Hybrid PQC-TLS 1.3 Handshake:**
     - `PqcTls13HandshakeSimulator`: Hybrid X25519 + ML-KEM-768 key encapsulation and HKDF-SHA256 session key derivation for cloud sync.
  4. **Application Use Cases & REST API:**
     - `ProcessOfflineKioskVerificationUseCase`: Sub-5ms edge biometric and credential verification against local trust anchors.
     - `SynchronizeOfflineKioskQueueUseCase`: PQC-TLS 1.3 upstream synchronization and cloud revocation conflict resolution.
     - Endpoints: `POST /api/v1/offline/verify`, `GET /api/v1/offline/queue`, `POST /api/v1/offline/sync`, `POST /api/v1/offline/pqc-tls-handshake`.

---

## 3. Sprint 11 Specifications & Delivered Capabilities

### 🎯 [FAB-EPIC-09] Autonomous AI Agent Identity Protocol & Delegated Human Sovereign Authority
- **Category:** AI Agent Trust & Autonomous Identity
- **Priority:** P1 - Critical
- **Status:** Completed & Tested (119/119 Tests Passing, 96.69% Code Coverage)
- **Delivered Capabilities:**
  1. **Autonomous AI Agent Identity & Verification Framework:**
     - `AgenticIdentityCredential`: W3C VC and DID compliant AI Agent Identity (`did:tum:agent:<agent_id>`), model provenance hash (weights + system prompt digests), runtime enclave attestation (AWS Nitro, Apple Secure Enclave, Intel SGX, Docker Sandbox Strict), and status lifecycle (`ACTIVE`, `SUSPENDED`, `REVOKED`).
  2. **Delegated Human Sovereign Power of Attorney (PoA):**
     - `DelegatedPowerOfAttorneyToken`: Legally binding delegation rooted in sovereign human citizen/ePassport identity (ETA B.E. 2544 Sections 26 & 28).
     - Financial & Operational Guardrails: Permitted scopes whitelist (`BANKING_SETTLEMENT`, `GOV_PROCUREMENT`, `CONTRACT_SIGNING`, `CROSS_BORDER_CUSTOMS`, `FLEET_DISPATCH`, `IDENTITY_ATTESTATION`), single transaction cap, cumulative budget limit, tracked spend, and step-up biometric threshold.
     - Emergency Kill-Switch: Instant revocation mechanism terminating rogue or anomalous agent execution.
  3. **Zero-Trust Network Access (ZTNA) Agent Token & Replay Defense:**
     - `AgenticZtnaEngine`: Monotonic nonce cache evaluating replay freshness (120s TTL window), Ed25519 + NIST FIPS 204 ML-DSA-87 signature evaluation, and HMAC-SHA256 sealed short-lived ZTNA bearer access token minting.
     - `ProofOfHumanDelegation`: Ephemeral action proof signed by agent key embedding action payload SHA-256 digest.
  4. **Application Use Cases & REST API:**
     - `IssueAgentCredentialUseCase`: Generates agent PQC hybrid keypair, initializes model provenance, and creates immutable audit record.
     - `DelegateHumanAuthorityUseCase`: Evaluates agent readiness, applies spending boundaries, and signs PoA token with human PQC envelope.
     - `VerifyAgentAuthorityUseCase`: Complete ZTNA verification gate evaluating nonce, signature, model provenance, scope, and budget; returns `PERMITTED`, `DENIED`, or `CHALLENGE_STEP_UP_REQUIRED`.
     - `RevokeAgentAuthorityUseCase`: Emergency kill-switch revoking delegated authority.
     - Endpoints: `POST /api/v1/agent/issue`, `POST /api/v1/agent/delegate`, `POST /api/v1/agent/verify`, `POST /api/v1/agent/revoke`, `GET /api/v1/agent/delegations`.
  5. **Presentation Web HUD:**
     - Added SPRINT 11 ACTIVE banner and AI Agent ZTNA metrics gauge.
     - Interactive Console 5th action button: `5. AI Agent ZTNA` performing real-time end-to-end issuance, delegation, and verification in browser.

---

## 4. Sprint 12 Specifications (In Progress)

### 🎯 [FAB-EPIC-10] Cross-Jurisdiction Legal Quantum Notary Network (QNN) & UNCITRAL MLETR
- **Category:** Legal Tech & International Trade
- **Priority:** P1 - Critical
- **Status:** In Progress
- **Key Objectives:**
  1. **UNCITRAL MLETR Electronic Transferable Records:**
     - Electronic Bills of Lading (eBL), Promissory Notes, and Sovereign Warehouse Receipts with transferable singularity guarantees.
  2. **Cross-Jurisdiction PQC Merkle Proof Notarization:**
     - Bilateral notarization bridging Thailand Electronic Transactions Development Agency (ETDA) and international trade corridors (Singapore IMDA TradeTrust, Rotterdam Port).

---

## 5. Sprint 13 Specifications & Delivered Capabilities

### 🎯 [FAB-EPIC-11] Commercial Turnkey E-Gate Appliance & ICAO Doc 9303 Verification Test Harness
- **Category:** Commercial Product / E-Gate Turnkey Appliance / ICAO Doc 9303
- **Priority:** P1 - Critical
- **Status:** Completed & Tested (133/133 Tests Passing, 96.8% Code Coverage)
- **Delivered Capabilities:**
  1. **Commercial Turnkey Standalone Appliance ("TUM Sovereign Corridor Gateway"):**
     - Production multi-stage `Dockerfile` and `docker-compose.yml` for instant, standalone deployment on edge hardware for airport contractors (AOT, Thales, SITA, Indra) and immigration checkpoints.
     - Production environment template (`.env.example`) and appliance calibration profile (`config/appliance.json`).
     - Sub-10ms Redis-compatible in-memory caching and persistent volumes for trust anchors, edge queues, and tamper-evident audit records.
  2. **Comprehensive REST & gRPC Integration Blueprint:**
     - `docs/REST_GRPC_INTEGRATION_BLUEPRINT.md`: Comprehensive 8-part architectural and integration specification covering corridor physical topology, peripheral wiring, sub-40ms latency budget, REST endpoints, sequence diagrams, and legal compliance.
     - Protocol Buffers specification `proto/sovereign_corridor.proto`: Defines bi-directional streaming for 3D camera embeddings & UWB distance tracking (`StreamBiometricTelemetry`), low-latency ePassport chip verification (`VerifyPassportChip`), walkthrough clearance (`EvaluateWalkthroughPassage`), and barrier actuator pulse (`TriggerBarrierPulse`).
  3. **ICAO Doc 9303 Passive Authentication & Master List Engine:**
     - `IcaoDoc9303SecurityObject`: Models `EF.SOD` (Security Object for Document), LDS version, Data Group hash tables (DG1 MRZ, DG2 Facial Biometrics, DG14 Security Options), and SignerInfo.
     - `IcaoMasterList`: Models ICAO PKD / National CSCA Master Lists signed by Master List Signer (MLS), with certificate indexing and fingerprint lookup.
     - `IcaoDoc9303Verifier`: Strict Passive Authentication (PA) engine validating LDS data group hashes, LDS canonical digests, Document Signer signatures, CSCA trust chains, and Certificate Revocation Lists (CRL).
     - `VerifyIcaoPassportSodUseCase` & `ImportIcaoMasterListUseCase`: End-to-end ePassport onboarding and Master List sync.
  4. **ICAO Doc 9303 Verification Test Harness & PKI Fixtures:**
     - Pre-generated authentic X.509 Test CSCA & DS Certificates for Thailand (`THA`), Singapore (`SGP`), Germany (`DEU`), Japan (`JPN`), and Rogue/Attacker authority.
     - Signed ICAO PKD Test Master List and Revocation Lists.
     - 10-point test harness (`tests/icao/IcaoDoc9303VerificationHarness.test.ts`): Verifies genuine Thai/Singapore passports, detects tampered MRZ data (DG1), detects facial substitution attacks (DG2), detects forged DS signatures, rejects untrusted foreign nations, intercepts revoked certificates on CRL, and verifies sub-50ms throughput (0.51ms per passport).
  5. **REST API Endpoints & Web HUD:**
     - `POST /api/v1/icao/verify-sod`, `POST /api/v1/icao/master-list/import`, `GET /api/v1/icao/master-list`.
     - Integrated interactive console button: `6. ICAO E-Gate` in Sovereign Web HUD (`src/presentation/web/WebHudHtml.ts`).

