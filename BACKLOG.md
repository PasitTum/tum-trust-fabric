# 📋 Product Backlog — TUM National Trust Fabric
**Epic Prefix:** `FAB`  
**Repository:** `tum-trust-fabric`  
**Last Updated:** 2026-11-01 17:05:00
**Active Sprint:** Sprint 11 — Autonomous AI Agent Identity Protocol & Delegated Human Sovereign Authority 🟢

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
| **FAB-EPIC-09** | Autonomous AI Agent Identity Protocol & Delegated Human Sovereign Authority | `P1 - Critical` | AI Agent Trust | `IN_PROGRESS` | — |
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

## 3. Sprint 11 Specifications (In Progress)

### 🎯 [FAB-EPIC-09] Autonomous AI Agent Identity Protocol & Delegated Human Sovereign Authority
- **Category:** AI Agent Trust & Autonomous Identity
- **Priority:** P1 - Critical
- **Status:** In Progress
- **Key Objectives:**
  1. **Autonomous AI Agent Identity & Verification Framework:**
     - `AgenticIdentityCredential`: W3C VC and DID compliant AI Agent Identity (`did:tum:agent:<agent_id>`), model provenance hash, training snapshot attestation, and operational sandbox boundaries.
  2. **Delegated Human Sovereign Power of Attorney (PoA):**
     - `DelegatedPowerOfAttorneyToken`: Cryptographically verifiable delegation signed by sovereign human Thai Citizen ID / ePassport.
     - Constraints engine: Maximum single/cumulative spending cap (THB/USD), action scope whitelist (`BANKING_TRANSFER`, `GOV_PROCUREMENT`, `CONTRACT_SIGNING`, `CROSS_BORDER_CUSTOMS`), task expiration timestamp, and human real-time kill-switch.
  3. **Zero-Trust Network Access (ZTNA) Agent Token & Nonce Evaluation:**
     - `ProofOfHumanDelegation`: Nonce evaluation to eliminate agent impersonation, replay attacks, and prompt injection privilege escalation.
     - Short-lived scoped JWT/PQC ZTNA authorization tokens for TUM Ecosystem enterprise services.
  4. **Application Use Cases & REST API:**
     - `IssueAgentCredentialUseCase`: Provisions agent DID and registers agent provenance.
     - `DelegateHumanAuthorityUseCase`: Issues PQC-signed human delegation PoA token with strict boundaries.
     - `VerifyAgentAuthorityUseCase`: Evaluates agent operation request against delegation token, active revocations, and spending caps.
     - Endpoints: `POST /api/v1/agent/issue`, `POST /api/v1/agent/delegate`, `POST /api/v1/agent/verify`, `POST /api/v1/agent/revoke`.
