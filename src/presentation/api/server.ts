import http from 'node:http';
import { InMemoryTrustRegistryRepository } from '../../infrastructure/repositories/InMemoryTrustRegistryRepository.js';
import { OnboardDopaThaiIdUseCase } from '../../application/use-cases/onboarding/OnboardDopaThaiIdUseCase.js';
import { OnboardIcaoPassportUseCase } from '../../application/use-cases/onboarding/OnboardIcaoPassportUseCase.js';
import { Verify3DLivenessUseCase } from '../../application/use-cases/onboarding/Verify3DLivenessUseCase.js';
import { SelectiveDisclosureZkUseCase } from '../../application/use-cases/zkp/SelectiveDisclosureZkUseCase.js';
import { QuantumSafeTrustServicesUseCase } from '../../application/use-cases/trust-services/QuantumSafeTrustServicesUseCase.js';
import { WalkThroughCorridorUseCase } from '../../application/use-cases/corridor/WalkThroughCorridorUseCase.js';
import { CrossBorderFederationUseCase } from '../../application/use-cases/federation/CrossBorderFederationUseCase.js';
import { BatchCorridorLaneProcessor } from '../../application/use-cases/corridor/BatchCorridorLaneProcessor.js';
import { CrossBorderCorridorGateway } from '../../application/use-cases/corridor/CrossBorderCorridorGateway.js';
import { AseanEidasFederationGateway } from '../../infrastructure/federation/AseanEidasFederationGateway.js';
import { IssueMobileDrivingLicenseUseCase } from '../../application/use-cases/mdl/IssueMobileDrivingLicenseUseCase.js';
import { VerifyMobileDrivingLicenseUseCase } from '../../application/use-cases/mdl/VerifyMobileDrivingLicenseUseCase.js';
import { MdlDeviceEngagement } from '../../domain/value-objects/MdlDeviceEngagement.js';
import { OfflineTrustCache } from '../../domain/value-objects/OfflineTrustCache.js';
import { OfflineKioskStorageEngine } from '../../infrastructure/offline/OfflineKioskStorageEngine.js';
import { PqcTls13HandshakeSimulator } from '../../infrastructure/offline/PqcTls13HandshakeSimulator.js';
import { ProcessOfflineKioskVerificationUseCase } from '../../application/use-cases/offline/ProcessOfflineKioskVerificationUseCase.js';
import { SynchronizeOfflineKioskQueueUseCase } from '../../application/use-cases/offline/SynchronizeOfflineKioskQueueUseCase.js';
import { getWebHudHtml } from '../web/WebHudHtml.js';
import { CitizenIdentity } from '../../domain/entities/CitizenIdentity.js';
import { MultiAngleBiometricEngine } from '../../infrastructure/biometric/MultiAngleBiometricEngine.js';

export class SovereignTrustApiServer {
  private repository: InMemoryTrustRegistryRepository;
  private dopaUseCase: OnboardDopaThaiIdUseCase;
  private icaoUseCase: OnboardIcaoPassportUseCase;
  private livenessUseCase: Verify3DLivenessUseCase;
  private zkUseCase: SelectiveDisclosureZkUseCase;
  private trustServicesUseCase: QuantumSafeTrustServicesUseCase;
  private corridorUseCase: WalkThroughCorridorUseCase;
  private federationUseCase: CrossBorderFederationUseCase;
  private batchProcessor: BatchCorridorLaneProcessor;
  private crossBorderGateway: CrossBorderCorridorGateway;
  private issueMdlUseCase: IssueMobileDrivingLicenseUseCase;
  private verifyMdlUseCase: VerifyMobileDrivingLicenseUseCase;
  private trustCache: OfflineTrustCache;
  private kioskStorageEngine: OfflineKioskStorageEngine;
  private processOfflineUseCase: ProcessOfflineKioskVerificationUseCase;
  private syncOfflineUseCase: SynchronizeOfflineKioskQueueUseCase;
  private server: http.Server | null = null;

  constructor() {
    this.repository = new InMemoryTrustRegistryRepository();
    this.dopaUseCase = new OnboardDopaThaiIdUseCase(this.repository);
    this.icaoUseCase = new OnboardIcaoPassportUseCase(this.repository);
    this.livenessUseCase = new Verify3DLivenessUseCase(this.repository);
    this.zkUseCase = new SelectiveDisclosureZkUseCase(this.repository);
    this.trustServicesUseCase = new QuantumSafeTrustServicesUseCase(this.repository);
    this.corridorUseCase = new WalkThroughCorridorUseCase(this.repository);
    this.federationUseCase = new CrossBorderFederationUseCase(this.repository);
    this.batchProcessor = new BatchCorridorLaneProcessor(this.repository);
    this.crossBorderGateway = new CrossBorderCorridorGateway(this.repository, new AseanEidasFederationGateway());
    this.issueMdlUseCase = new IssueMobileDrivingLicenseUseCase(this.repository);
    this.verifyMdlUseCase = new VerifyMobileDrivingLicenseUseCase(
      this.repository,
      this.issueMdlUseCase.getIssuerKeyPair().publicKey
    );

    // Initialize Offline Edge Kiosk Components (Sprint 10)
    const bitVector = OfflineTrustCache.createBitVector(128, [99, 105]); // Sample revoked indices
    this.trustCache = new OfflineTrustCache({
      cacheVersion: 1,
      kioskNodeId: 'KIOSK-EDGE-CHIANGMAI-01',
      generatedAtIso: new Date().toISOString(),
      expiresAtIso: new Date(Date.now() + 72 * 3600 * 1000).toISOString(), // 72-hour offline TTL
      anchors: [],
      revocationBitVectorBase64: bitVector,
      cacheSignatureHex: 'c0ffee'.repeat(10),
    });
    this.kioskStorageEngine = new OfflineKioskStorageEngine('KIOSK-EDGE-CHIANGMAI-01');
    this.processOfflineUseCase = new ProcessOfflineKioskVerificationUseCase(
      this.kioskStorageEngine,
      this.trustCache
    );
    this.syncOfflineUseCase = new SynchronizeOfflineKioskQueueUseCase(
      this.repository,
      this.kioskStorageEngine
    );

    this.seedDemoCitizen();
  }

  private seedDemoCitizen(): void {
    const demoVector = MultiAngleBiometricEngine.generateSyntheticVector(101);
    const demoCitizen = new CitizenIdentity({
      id: 'did:tum:citizen:sample-demo',
      nationalIdHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      fullNameTh: 'นายสมชาย ไทยแท้',
      fullNameEn: 'Mr. Somchai Thaitae',
      birthDateIso: '1995-05-12',
      nationality: 'THA',
      status: 'ACTIVE',
      assuranceLevel: 'IAL3_AAL3',
      biometricProfile: {
        faceVector512: demoVector,
        livenessConfidence: 0.98,
        antiSpoofScore: 0.96,
        captureTimestamp: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.repository.saveCitizenIdentity(demoCitizen);
  }

  public getRepository(): InMemoryTrustRegistryRepository {
    return this.repository;
  }

  public getTrustServicesUseCase(): QuantumSafeTrustServicesUseCase {
    return this.trustServicesUseCase;
  }

  public getZkUseCase(): SelectiveDisclosureZkUseCase {
    return this.zkUseCase;
  }

  public getCorridorUseCase(): WalkThroughCorridorUseCase {
    return this.corridorUseCase;
  }

  public getFederationUseCase(): CrossBorderFederationUseCase {
    return this.federationUseCase;
  }

  public getDopaUseCase(): OnboardDopaThaiIdUseCase {
    return this.dopaUseCase;
  }

  public getIcaoUseCase(): OnboardIcaoPassportUseCase {
    return this.icaoUseCase;
  }

  public getIssueMdlUseCase(): IssueMobileDrivingLicenseUseCase {
    return this.issueMdlUseCase;
  }

  public getVerifyMdlUseCase(): VerifyMobileDrivingLicenseUseCase {
    return this.verifyMdlUseCase;
  }

  public getKioskStorageEngine(): OfflineKioskStorageEngine {
    return this.kioskStorageEngine;
  }

  public getProcessOfflineUseCase(): ProcessOfflineKioskVerificationUseCase {
    return this.processOfflineUseCase;
  }

  public getSyncOfflineUseCase(): SynchronizeOfflineKioskQueueUseCase {
    return this.syncOfflineUseCase;
  }

  private async parseJsonBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        if (!body) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error('Invalid JSON payload'));
        }
      });
      req.on('error', reject);
    });
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
    const jsonStr = JSON.stringify(data);
    res.writeHead(statusCode, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(jsonStr);
  }

  public createHttpServer(): http.Server {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const method = req.method?.toUpperCase();

      // Handle CORS Preflight
      if (method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        res.end();
        return;
      }

      try {
        // 1. Web HUD
        if (url.pathname === '/' && method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(getWebHudHtml());
          return;
        }

        // 2. Health Check
        if (url.pathname === '/health' && method === 'GET') {
          this.sendJson(res, 200, {
            status: 'HEALTHY',
            service: 'TUM National Trust Fabric',
            classification: 'Sovereign Flagship Platform',
            pqcEngineReady: true,
            fips204Standard: 'NIST FIPS 204 ML-DSA-87',
            zkPrivacyEngine: 'Pedersen NIZK',
            mdlEngineReady: true,
            iso18013Standard: 'ISO/IEC 18013-5:2021 mDL',
            offlineEdgeEngineReady: true,
            pqcTlsStandard: 'NIST FIPS 203 ML-KEM-768',
            activeSprint: 'Sprint 10 — Edge Kiosk Offline Mode & PQC-TLS Handshake (Milestone 2)',
            uptimeSeconds: Math.floor(process.uptime()),
          });
          return;
        }

        // 3. DOPA Thai ID Onboarding
        if (url.pathname === '/api/v1/onboarding/dopa' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.dopaUseCase.execute(body as any);
          this.sendJson(res, 201, result);
          return;
        }

        // 4. ICAO ePassport Onboarding
        if (url.pathname === '/api/v1/onboarding/icao' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.icaoUseCase.execute(body as any);
          this.sendJson(res, 201, result);
          return;
        }

        // 5. 3D Biometric Liveness
        if (url.pathname === '/api/v1/biometrics/liveness' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.livenessUseCase.execute(body as any);
          this.sendJson(res, 200, result);
          return;
        }

        // 6. ZK Age Proof Generation
        if (url.pathname === '/api/v1/zkp/age-proof' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.zkUseCase.generateAgeProof(body);
          this.sendJson(res, 201, result);
          return;
        }

        // 7. ZK Solvency Proof Generation
        if (url.pathname === '/api/v1/zkp/solvency-proof' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.zkUseCase.generateSolvencyProof(body);
          this.sendJson(res, 201, result);
          return;
        }

        // 8. ZK Proof Verification
        if (url.pathname === '/api/v1/zkp/verify' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.zkUseCase.verifyProof(body);
          this.sendJson(res, 200, result);
          return;
        }

        // 9. Quantum-Safe Sign
        if (url.pathname === '/api/v1/trust-services/sign' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.trustServicesUseCase.signDocument(body);
          this.sendJson(res, 200, result);
          return;
        }

        // 10. Issue Qualified Seal
        if (url.pathname === '/api/v1/trust-services/seal' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.trustServicesUseCase.issueQualifiedSeal(body);
          this.sendJson(res, 201, result);
          return;
        }

        // 11. Generate RFC 3161 Timestamp
        if (url.pathname === '/api/v1/trust-services/timestamp' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = this.trustServicesUseCase.generateTimestamp(body);
          this.sendJson(res, 200, result);
          return;
        }

        // 12. Walk-Through Corridor Access
        if (url.pathname === '/api/v1/corridor/walkthrough' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.corridorUseCase.execute(body as any);
          this.sendJson(res, 200, result);
          return;
        }

        // 13. Cross-Border Federation
        if (url.pathname === '/api/v1/federation/crossborder' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.federationUseCase.execute(body);
          this.sendJson(res, 200, result);
          return;
        }

        // 13b. High-Throughput Batch Corridor Multi-Lane Processing
        if (url.pathname === '/api/v1/corridor/batch' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.batchProcessor.processBatch(body as any);
          this.sendJson(res, 200, result);
          return;
        }

        // 13c. Cross-Border Corridor Interpol & PQC Gateway
        if (url.pathname === '/api/v1/corridor/cross-border' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.crossBorderGateway.evaluateCrossBorderEntry(body as any);
          this.sendJson(res, 200, result);
          return;
        }

        // 13d. ISO/IEC 18013-5 mDL Issuance
        if (url.pathname === '/api/v1/mdl/issue' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const { result } = await this.issueMdlUseCase.execute(body);
          this.sendJson(res, 201, result);
          return;
        }

        // 13e. ISO/IEC 18013-5 mDL Selective Disclosure Verification
        if (url.pathname === '/api/v1/mdl/verify' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.verifyMdlUseCase.execute(body);
          this.sendJson(res, 200, result);
          return;
        }

        // 13f. ISO/IEC 18013-5 Device Engagement Handshake
        if (url.pathname === '/api/v1/mdl/engagement' && method === 'POST') {
          const body = (await this.parseJsonBody(req)) as any;
          const devEngagement = new MdlDeviceEngagement({
            version: '1.0',
            security: {
              cipherSuite: 'PQC_HYBRID_ECDH_ML_KEM_768',
              ephemeralPublicKeyHex: body.deviceKeyHex || '04' + 'a'.repeat(64),
            },
            deviceRetrievalMethods: [{ type: 'BLE', version: 1 }],
          });
          const readerKeyHex = body.readerKeyHex || '04' + 'b'.repeat(64);
          const transcript = MdlDeviceEngagement.computeSessionTranscript(
            devEngagement.getRawBytes(),
            Buffer.from(readerKeyHex, 'hex')
          );
          this.sendJson(res, 200, {
            qrCodeUri: devEngagement.getQrCodeUri(),
            sessionTranscriptHex: transcript.toString('hex'),
            cipherSuite: 'PQC_HYBRID_ECDH_ML_KEM_768',
            hndlImmunity: true,
          });
          return;
        }

        // 13g. Sprint 10: Offline Edge Kiosk Verification
        if (url.pathname === '/api/v1/offline/verify' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.processOfflineUseCase.execute(body);
          this.sendJson(res, 200, result);
          return;
        }

        // 13h. Sprint 10: Inspect Pending Offline Queue
        if (url.pathname === '/api/v1/offline/queue' && method === 'GET') {
          const pending = this.kioskStorageEngine.getPendingRecords();
          this.sendJson(res, 200, {
            kioskNodeId: this.kioskStorageEngine.getKioskNodeId(),
            pendingCount: pending.length,
            records: pending.map((r) => r.toJSON()),
          });
          return;
        }

        // 13i. Sprint 10: Synchronize Offline Queue to Cloud Ledger
        if (url.pathname === '/api/v1/offline/sync' && method === 'POST') {
          const body = await this.parseJsonBody(req);
          const result = await this.syncOfflineUseCase.execute(body);
          this.sendJson(res, 200, result);
          return;
        }

        // 13j. Sprint 10: PQC TLS 1.3 Key Exchange Handshake
        if (url.pathname === '/api/v1/offline/pqc-tls-handshake' && method === 'POST') {
          const body = (await this.parseJsonBody(req)) as any;
          const result = PqcTls13HandshakeSimulator.performHandshake(
            body.kioskNodeId || 'KIOSK-EDGE-01',
            body.cloudEndpoint || 'gateway.tum.gov.th:8443'
          );
          this.sendJson(res, 200, result);
          return;
        }

        // 14. Immutable Audit Logs
        if (url.pathname === '/api/v1/audit/logs' && method === 'GET') {
          const limitParam = url.searchParams.get('limit');
          const limit = limitParam ? parseInt(limitParam, 10) : 50;
          const logs = await this.repository.getAuditLogs(limit);
          this.sendJson(res, 200, { count: logs.length, logs });
          return;
        }

        // Not Found
        this.sendJson(res, 404, { error: 'NOT_FOUND', path: url.pathname });
      } catch (err: any) {
        this.sendJson(res, 400, {
          error: 'BAD_REQUEST',
          message: err.message,
          issues: err.issues || undefined,
        });
      }
    });

    this.server = server;
    return server;
  }

  public async start(port: number = 8088): Promise<void> {
    const server = this.createHttpServer();
    return new Promise((resolve) => {
      server.listen(port, () => {
        console.log(`[TUM National Trust Fabric] Sovereign API Server listening on http://localhost:${port}`);
        console.log(`[TUM National Trust Fabric] Web HUD Dashboard: http://localhost:${port}/`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server!.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }
}

// Standalone execution
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8088;
  const api = new SovereignTrustApiServer();
  api.start(port);
}
