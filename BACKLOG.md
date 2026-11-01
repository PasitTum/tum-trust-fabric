# 📋 Product Backlog — TUM National Trust Fabric
**Epic Prefix:** `FAB`  
**Repository:** `tum-trust-fabric`  
**Last Updated:** 2026-11-01 16:56:00
**Active Sprint:** Sprint 9 — ISO/IEC 18013-5 Mobile Driving License & Quantum-Safe Credentials 🟢

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
| **FABRIC-NOTARY-01** | Thailand ETA B.E. 2544 Legal Quantum Notary Service & Merkle Signatures | `P1 - Critical` | Legal Tech | `COMPLETED` | 91.5% |
| **FABRIC-EVENT-01** | Cross-Fleet Corridor Clearance Event Publisher | `P2 - High` | Fleet Telemetry | `COMPLETED` | 91.5% |
| **FAB-BKL-02** | PQC Hardware Enclave Bridge (Nitro / TPM / HSM Integration) | `P1 - Critical` | Innovation Backlog | `COMPLETED` | 91.5% |
| **FAB-BKL-03** | Zero-Knowledge Age & Balance Prover SDK for Edge Devices | `P2 - High` | Innovation Backlog | `COMPLETED` | 91.5% |

---

## 2. Sprint 9 Specifications & Delivered Capabilities

### 🎯 [FAB-EPIC-07] ISO/IEC 18013-5 Mobile Driving License (mDL) & PQC Selective Disclosure
- **Category:** Sovereign Transport & Digital Credentials
- **Priority:** P1 - Critical
- **Status:** Completed & Tested (70/70 Tests Passing, 91.55% Coverage)
- **Delivered Capabilities:**
  1. **ISO/IEC 18013-5 Data Model:**
     - `MobileDrivingLicense`: Supports standard namespace `org.iso.18013.5.1` and Thailand Department of Land Transport extension `th.dlt.mdl`.
     - Mobile Security Object (MSO) with SHA-256 value digests and validity windows.
  2. **Device Engagement (QR / NFC Handshake):**
     - `MdlDeviceEngagement`: Generates and parses `mdoc:` QR Code URIs.
     - Ephemeral session transcript computation according to ISO/IEC 18013-5 Section 9.1.5.1.
     - PQC Hybrid Key Exchange (`PQC_HYBRID_ECDH_ML_KEM_768`) providing 0% HNDL quantum risk.
  3. **Privacy-Preserving Selective Disclosure:**
     - Allows drivers to disclose only requested attributes (e.g. `age_over_18` and `driving_privileges`) while completely concealing home address and full date of birth.
     - Verifier validates element digests against signed MSO without requiring undisclosed element values.
  4. **Production Use Cases & REST API:**
     - `IssueMobileDrivingLicenseUseCase`: Issues sovereign mDL with DLT digital credentials.
     - `VerifyMobileDrivingLicenseUseCase`: Verifies reader presentations with 100% cryptographic integrity.
     - Endpoints: `POST /api/v1/mdl/issue`, `POST /api/v1/mdl/verify`, `POST /api/v1/mdl/engagement`.
