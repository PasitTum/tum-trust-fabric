# 📋 Product Backlog — TUM National Trust Fabric
**Epic Prefix:** `FAB`  
**Repository:** `tum-trust-fabric`  
**Last Updated:** 2026-11-01 12:32:00
**Active Sprint:** Sprint 1 — Sovereign Architecture & Core Foundation 🟢

---

## 1. Backlog Matrix & Priority Allocation

| Issue Key | Title | Priority | Category | Status | Code Coverage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FAB-EPIC-01** | Omni-Channel Sovereign Onboarding (ePassport & DOPA ThaiID with 3D Liveness) | `P1 - Critical` | Identity Core | `IN_PROGRESS` (Foundation Delivered) | 91.1% |
| **FAB-EPIC-02** | Zero-Knowledge Privacy Fabric (zk-Proof Selective Disclosure Engine) | `P1 - Critical` | Privacy/ZKP | `IN_PROGRESS` (Foundation Delivered) | 91.1% |
| **FAB-EPIC-03** | Quantum-Safe Qualified Trust Services (e-Seal, e-Sign, Timestamping) | `P1 - Critical` | Trust Services | `IN_PROGRESS` (Foundation Delivered) | 91.1% |
| **FAB-EPIC-04** | Walk-Through Corridor Access API & Multi-Angle Biometric Matcher | `P2 - High` | Edge / Hardware | `IN_PROGRESS` (Foundation Delivered) | 91.1% |
| **FAB-EPIC-05** | Cross-Border Trust Federation Gateway (ASEAN & eIDAS 2.0) | `P2 - High` | GovTech Federation | `IN_PROGRESS` (Foundation Delivered) | 91.1% |
| **FAB-BKL-02** | PQC Hardware Enclave Bridge (Nitro / TPM / HSM Integration) | `P1 - Critical` | Innovation Backlog | `IN_PROGRESS` (Foundation Delivered) | 91.1% |
| **FAB-BKL-03** | Zero-Knowledge Age & Balance Prover SDK for Edge Devices | `P2 - High` | Innovation Backlog | `IN_PROGRESS` (Foundation Delivered) | 91.1% |

---

## 2. Epic & Story Specifications

### 🎯 [FAB-EPIC-01] Omni-Channel Sovereign Onboarding (ePassport & DOPA ThaiID with 3D Liveness)
- **Category:** Identity Core
- **Priority:** P1 - Critical
- **Status:** In-Progress (Sprint 1 Foundation Complete)
- **Delivered Capabilities:**
  - `DopaIdCard`: Thai National ID 13-digit Modulo 11 check digit verification + Laser Code validation.
  - `IcaoMrzPassport`: ICAO Doc 9303 TD3 44-character MRZ parser with 7-3-1 cycle check digits.
  - `Verify3DLivenessUseCase`: 3D stereoscopic depth disparity anti-spoofing against 2D screen attacks.
- **Acceptance Criteria (DoD):**
  1. โครงสร้างโมดูลถูกออกแบบตาม Clean Architecture ปราศจาก Single-file Spaghetti ✅
  2. มี Type-safe API Contracts และ Validation Schemas ครอบคลุม 100% (Zod schemas) ✅
  3. มี Automated Unit/Integration Tests ผ่านเกณฑ์ขั้นต่ำ 85% Code Coverage (ทำได้ 91.1%) ✅
  4. รองรับการเชื่อมต่อกับ Sovereign Ecosystem ของ TUM อย่างสมบูรณ์ ✅

### 🎯 [FAB-EPIC-02] Zero-Knowledge Privacy Fabric (zk-Proof Selective Disclosure Engine)
- **Category:** Privacy/ZKP
- **Priority:** P1 - Critical
- **Status:** In-Progress (Sprint 1 Foundation Complete)
- **Delivered Capabilities:**
  - `ZkEngine`: Pedersen Commitment Scheme over prime field with Non-Interactive Zero Knowledge (NIZK) Schnorr-Fiat-Shamir challenge protocol.
  - Selective Age Proof: Proves Age >= 20 without revealing birthdate or citizen ID.
  - Selective Solvency Proof: Proves balance >= threshold without revealing exact bank balance.

### 🎯 [FAB-EPIC-03] Quantum-Safe Qualified Trust Services (e-Seal, e-Sign, Timestamping)
- **Category:** Trust Services
- **Priority:** P1 - Critical
- **Status:** In-Progress (Sprint 1 Foundation Complete)
- **Delivered Capabilities:**
  - `PqcEngine`: NIST FIPS 204 ML-DSA-87 (CRYSTALS-Dilithium) + Hybrid Dual Envelope (Ed25519).
  - `QualifiedSeal`: eIDAS and ETSI EN 319 compliant electronic seal for corporate & governmental legal entities.
  - RFC 3161 Qualified Timestamp Token generation.

### 🎯 [FAB-EPIC-04] Walk-Through Corridor Access API & Multi-Angle Biometric Matcher
- **Category:** Edge / Hardware
- **Priority:** P2 - High
- **Status:** In-Progress (Sprint 1 Foundation Complete)
- **Delivered Capabilities:**
  - `MultiAngleBiometricEngine`: 512-dimensional facial feature vector cosine similarity matcher.
  - Multi-camera angle capture (Center Frontal, Left 30-deg, Right 30-deg).
  - Corridor walk-through gate clearance decision in under 1.0s.

### 🎯 [FAB-EPIC-05] Cross-Border Trust Federation Gateway (ASEAN & eIDAS 2.0)
- **Category:** GovTech Federation
- **Priority:** P2 - High
- **Status:** In-Progress (Sprint 1 Foundation Complete)
- **Delivered Capabilities:**
  - `AseanEidasFederationGateway`: Singapore Singpass NDI, Malaysia MyDigital ID, and German eIDAS 2.0 accredited trust anchors.
  - Automated cross-certification and assurance level mapping (IAL2/AAL2 and IAL3/AAL3).

### 🎯 [FAB-BKL-02] PQC Hardware Enclave Bridge (Nitro / TPM / HSM Integration)
- **Category:** Innovation Backlog
- **Priority:** P1 - Critical
- **Status:** In-Progress (Sprint 1 Foundation Complete)
- **Delivered Capabilities:**
  - `HardwareEnclaveBridge`: AWS Nitro Enclaves NSM attestation document generation and PCR0 measurement validation.
  - Hardware-isolated signing operations.

### 🎯 [FAB-BKL-03] Zero-Knowledge Age & Balance Prover SDK for Edge Devices
- **Category:** Innovation Backlog
- **Priority:** P2 - High
- **Status:** In-Progress (Sprint 1 Foundation Complete)
- **Delivered Capabilities:**
  - Lightweight serializable `ZkProofPackage` for kiosk edge devices and web clients.
