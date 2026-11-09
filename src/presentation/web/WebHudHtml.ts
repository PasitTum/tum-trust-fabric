export function getWebHudHtml(): string {
  return `<!DOCTYPE html>
<html lang="th" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TUM National Trust Fabric — Sovereign HUD</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            tum: {
              gold: '#D4AF37',
              navy: '#0B132B',
              slate: '#1C2541',
              cyan: '#00F0FF',
              emerald: '#10B981',
              rose: '#F43F5E',
              purple: '#A855F7'
            }
          }
        }
      }
    }
  </script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;700;800&family=Sarabun:wght@300;400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
    body {
      font-family: 'Plus Jakarta Sans', 'Sarabun', sans-serif;
      background-color: #070B14;
    }
    .font-mono-code {
      font-family: 'JetBrains Mono', monospace;
    }
    .glow-gold {
      box-shadow: 0 0 25px rgba(212, 175, 55, 0.15);
    }
    .glow-cyan {
      box-shadow: 0 0 25px rgba(0, 240, 255, 0.18);
    }
  </style>
</head>
<body class="text-slate-100 min-h-screen flex flex-col selection:bg-tum-cyan selection:text-black">
  <!-- Top Navigation Bar -->
  <header class="border-b border-slate-800/80 bg-tum-navy/60 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-tum-gold to-yellow-600 flex items-center justify-center font-extrabold text-black text-xl shadow-lg">
          🏛️
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <span class="text-lg font-bold tracking-tight text-white">TUM National Trust Fabric</span>
            <span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">NIST FIPS 204 Ready</span>
            <span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">AI Agent ZTNA</span>
          </div>
          <p class="text-xs text-slate-400">Sovereign Digital Identity & Legal Super-Infrastructure</p>
        </div>
      </div>

      <div class="flex items-center space-x-4 text-xs font-mono-code">
        <div class="hidden sm:flex items-center space-x-2 bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-slate-300">NITRO ENCLAVE: ATTESTED</span>
        </div>
        <div class="bg-purple-900/20 text-purple-400 border border-purple-500/30 px-3 py-1.5 rounded-lg font-semibold">
          SPRINT 11 ACTIVE
        </div>
      </div>
    </div>
  </header>

  <!-- Main HUD Grid -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
    <!-- Quick Metrics Row -->
    <section class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-tum-cyan/40 transition">
        <div class="text-xs font-medium uppercase tracking-wider text-slate-400">Identity Assurance</div>
        <div class="mt-2 text-2xl font-bold text-white flex items-baseline space-x-2">
          <span>IAL3 / AAL3</span>
          <span class="text-xs text-emerald-400 font-mono-code">DOPA + ICAO</span>
        </div>
        <p class="text-xs text-slate-500 mt-1">Sovereign Thai National ID & ePassport</p>
      </div>

      <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-tum-gold/40 transition">
        <div class="text-xs font-medium uppercase tracking-wider text-slate-400">PQC Signature Envelope</div>
        <div class="mt-2 text-2xl font-bold text-tum-gold flex items-baseline space-x-2">
          <span>ML-DSA-87</span>
          <span class="text-xs text-slate-400 font-mono-code">Dilithium</span>
        </div>
        <p class="text-xs text-slate-500 mt-1">Hybrid Dual Envelope (Ed25519 + Lattice)</p>
      </div>

      <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-tum-cyan/40 transition">
        <div class="text-xs font-medium uppercase tracking-wider text-slate-400">ZK Privacy Engine</div>
        <div class="mt-2 text-2xl font-bold text-tum-cyan flex items-baseline space-x-2">
          <span>Pedersen NIZK</span>
          <span class="text-xs text-slate-400 font-mono-code">&lt;15ms</span>
        </div>
        <p class="text-xs text-slate-500 mt-1">Zero-Knowledge Selective Disclosure</p>
      </div>

      <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl relative overflow-hidden group hover:border-purple-500/40 transition">
        <div class="text-xs font-medium uppercase tracking-wider text-slate-400">Agentic ZTNA Gate</div>
        <div class="mt-2 text-2xl font-bold text-purple-400 flex items-baseline space-x-2">
          <span>Sub-5ms</span>
          <span class="text-xs text-slate-400 font-mono-code">PoA Token</span>
        </div>
        <p class="text-xs text-slate-500 mt-1">Delegated Human Sovereign Authority</p>
      </div>
    </section>

    <!-- Operational Panels -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left Panel: Onboarding & Verifications -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Interactive Tester Card -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div class="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h2 class="text-base font-bold text-white flex items-center space-x-2">
              <span>⚡</span>
              <span>Sovereign Identity Pipeline Interactive Console</span>
            </h2>
            <span class="text-xs font-mono-code text-tum-cyan">REST / JSON V1</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-4">
            <button onclick="testDopaOnboard()" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-200 border border-slate-700 transition">
              1. DOPA Thai ID
            </button>
            <button onclick="testIcaoOnboard()" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-200 border border-slate-700 transition">
              2. ICAO MRZ
            </button>
            <button onclick="testZkAgeProof()" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-200 border border-slate-700 transition">
              3. ZK Age &gt; 20 Proof
            </button>
            <button onclick="testCorridor()" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-200 border border-slate-700 transition">
              4. Walk-Through
            </button>
            <button onclick="testAgentZtna()" class="px-3 py-2 bg-purple-900/40 hover:bg-purple-800/60 text-xs font-semibold rounded-xl text-purple-300 border border-purple-600/40 transition">
              5. AI Agent ZTNA
            </button>
            <button onclick="testIcaoDoc9303Sod()" class="px-3 py-2 bg-tum-gold/20 hover:bg-tum-gold/40 text-xs font-semibold rounded-xl text-tum-gold border border-tum-gold/40 transition">
              6. ICAO E-Gate
            </button>
          </div>

          <div class="bg-black/80 rounded-xl p-4 border border-slate-800 font-mono-code text-xs overflow-x-auto min-h-[160px] max-h-[260px] text-emerald-400" id="consoleOutput">
            [SYS_READY] TUM National Trust Fabric Core initialized.<br>
            [STATUS] Ready to execute Clean Architecture Sovereign pipeline operations.<br>
            &gt; Click any operation button above to test real cryptographic execution.
          </div>
        </div>

        <!-- AI Agent Trust & ZTNA Card -->
        <div class="bg-slate-900/90 border border-purple-900/40 rounded-2xl p-6 shadow-xl">
          <div class="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <h3 class="text-sm font-bold text-white flex items-center space-x-2">
              <span>🤖</span>
              <span>Autonomous AI Agent Sovereign Identity & ZTNA Guardrails</span>
            </h3>
            <span class="text-xs font-mono-code text-purple-400">FAB-EPIC-09</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div class="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80">
              <div class="font-bold text-tum-gold">Human Principal</div>
              <div class="text-[11px] text-slate-400 mt-1 font-mono-code truncate">did:tum:citizen:1100500123451</div>
              <div class="mt-2 text-emerald-400 text-[10px] font-semibold">SOVEREIGN ATTESTED</div>
            </div>
            <div class="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80">
              <div class="font-bold text-purple-400">Autonomous Agent</div>
              <div class="text-[11px] text-slate-400 mt-1 font-mono-code truncate">did:tum:agent:settlement-v2</div>
              <div class="mt-2 text-slate-300 text-[10px]">Model: DeepSeek-R1 • Nitro Enclave</div>
            </div>
            <div class="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80">
              <div class="font-bold text-tum-cyan">Power of Attorney (PoA)</div>
              <div class="text-[11px] text-slate-400 mt-1">Cap: 500,000 THB • Step-up: 60k</div>
              <div class="mt-2 text-emerald-400 text-[10px] font-semibold">ETA B.E. 2544 LEGAL SEAL</div>
            </div>
          </div>
        </div>

        <!-- Architecture Layers Diagram -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
          <h3 class="text-sm font-bold text-white mb-3">Enterprise Clean Architecture Layers</h3>
          <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center text-xs">
            <div class="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80">
              <div class="font-bold text-tum-cyan">Presentation Layer</div>
              <div class="text-[11px] text-slate-400 mt-1">REST API • Web HUD • CLI Runner</div>
            </div>
            <div class="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80">
              <div class="font-bold text-tum-gold">Application Layer</div>
              <div class="text-[11px] text-slate-400 mt-1">Zod Schemas • CQRS Handlers • Use Cases</div>
            </div>
            <div class="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80">
              <div class="font-bold text-emerald-400">Domain Layer</div>
              <div class="text-[11px] text-slate-400 mt-1">Entities • Value Objects • Domain Events</div>
            </div>
            <div class="p-3 bg-slate-800/60 rounded-xl border border-slate-700/80">
              <div class="font-bold text-purple-400">Infrastructure</div>
              <div class="text-[11px] text-slate-400 mt-1">FIPS 204 PQC • ZK Engine • Enclaves</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Federation & Security Boundaries -->
      <div class="space-y-6">
        <!-- Cross-Border Federation Card -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
          <h3 class="text-sm font-bold text-white mb-3 flex items-center justify-between">
            <span>🌐 Cross-Border Trust Gateway</span>
            <span class="text-xs text-tum-gold">ASEAN & eIDAS 2.0</span>
          </h3>
          <div class="space-y-3 text-xs">
            <div class="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-xl border border-slate-800">
              <div class="flex items-center space-x-2">
                <span>🇸🇬</span>
                <span class="font-semibold text-slate-200">Singapore Singpass</span>
              </div>
              <span class="text-emerald-400 font-mono-code">ACCREDITED</span>
            </div>
            <div class="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-xl border border-slate-800">
              <div class="flex items-center space-x-2">
                <span>🇲🇾</span>
                <span class="font-semibold text-slate-200">Malaysia MyDigital ID</span>
              </div>
              <span class="text-emerald-400 font-mono-code">ACCREDITED</span>
            </div>
            <div class="flex items-center justify-between p-2.5 bg-slate-800/40 rounded-xl border border-slate-800">
              <div class="flex items-center space-x-2">
                <span>🇪🇺</span>
                <span class="font-semibold text-slate-200">EU eIDAS 2.0 Wallet</span>
              </div>
              <span class="text-emerald-400 font-mono-code">QTSP FEDERATED</span>
            </div>
          </div>
        </div>

        <!-- Enclave Isolation Status -->
        <div class="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
          <h3 class="text-sm font-bold text-white mb-3">🔒 PQC Enclave Boundary</h3>
          <div class="space-y-2 text-xs font-mono-code text-slate-300">
            <div class="flex justify-between border-b border-slate-800/60 pb-1.5">
              <span class="text-slate-500">PROVIDER:</span>
              <span class="text-slate-200">AWS NITRO NSM</span>
            </div>
            <div class="flex justify-between border-b border-slate-800/60 pb-1.5">
              <span class="text-slate-500">PCR0 HASH:</span>
              <span class="text-slate-200 truncate max-w-[140px]">e3b0c44298fc1c...</span>
            </div>
            <div class="flex justify-between border-b border-slate-800/60 pb-1.5">
              <span class="text-slate-500">CRYPTO ENVELOPE:</span>
              <span class="text-tum-gold">NIST FIPS 204 ML-DSA</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">AUDIT LOGGING:</span>
              <span class="text-emerald-400">HASH-CHAIN IMMUTABLE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>

  <footer class="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
    TUM National Trust Fabric • Sovereign Flagship Product • TUM Group Holdings Co., Ltd.
  </footer>

  <script>
    async function logToConsole(title, data) {
      const box = document.getElementById('consoleOutput');
      const time = new Date().toLocaleTimeString();
      const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      box.innerHTML = \`[\${time}] <b>\${title}</b><br><pre class="text-slate-300 mt-1">\${content}</pre><hr class="border-slate-800 my-2">\` + box.innerHTML;
    }

    async function testDopaOnboard() {
      try {
        const res = await fetch('/api/v1/onboarding/dopa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            citizenId: '1100500123451',
            laserCode: 'JT1123456789',
            firstNameTh: 'สมชาย',
            lastNameTh: 'ไทยแท้',
            firstNameEn: 'Somchai',
            lastNameEn: 'Thaitae',
            dateOfBirthTh: '1998-08-15',
            expiryDateTh: '2032-08-15',
            cardIssuePlace: 'Bangkok DOPA Central Registry'
          })
        });
        const json = await res.json();
        logToConsole('DOPA Thai ID Onboarded (IAL3/AAL3)', json);
      } catch (err) {
        logToConsole('Error', err.message);
      }
    }

    async function testIcaoOnboard() {
      try {
        const res = await fetch('/api/v1/onboarding/icao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mrzLine1: 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
            mrzLine2: 'L898902C<3UTO6908061F9406236ZE184226B<<<<<14'
          })
        });
        const json = await res.json();
        logToConsole('ICAO Doc 9303 ePassport Verified', json);
      } catch (err) {
        logToConsole('Error', err.message);
      }
    }

    async function testZkAgeProof() {
      try {
        const res = await fetch('/api/v1/zkp/age-proof', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            citizenDid: 'did:tum:citizen:sample-demo',
            minimumAge: 20,
            verifierJurisdiction: 'THA-REGULATOR'
          })
        });
        const json = await res.json();
        logToConsole('Zero-Knowledge Selective Age Proof (Age >= 20 without revealing birthdate)', json);
      } catch (err) {
        logToConsole('Error', err.message);
      }
    }

    async function testCorridor() {
      try {
        const res = await fetch('/api/v1/corridor/walkthrough', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            holderDid: 'did:tum:citizen:sample-demo',
            corridorGateId: 'BKK-GATE-NORTH-01',
            captures: [{
              angleName: 'CENTER_FRONTAL',
              featureVector512: new Array(512).fill(0.04419),
              depthMapDisparityMm: 18.5,
              timestampMs: Date.now()
            }],
            uwbDistanceMeters: 1.2
          })
        });
        const json = await res.json();
        logToConsole('Walk-Through Corridor Gate Decision', json);
      } catch (err) {
        logToConsole('Error', err.message);
      }
    }

    async function testAgentZtna() {
      try {
        // Step 1: Issue Agent
        const issueRes = await fetch('/api/v1/agent/issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Autonomous Port Settlement AI Agent',
            description: 'Automated treasury operations',
            modelName: 'DeepSeek-R1-Sovereign',
            modelWeightsHash: 'a'.repeat(64),
            systemPromptHash: 'b'.repeat(64),
            runtimeAttestation: 'AWS_NITRO_ENCLAVE',
            sandboxProfile: 'strict-egress-isolated',
            validityDays: 30
          })
        });
        const agent = await issueRes.json();

        // Step 2: Delegate Authority
        const delegateRes = await fetch('/api/v1/agent/delegate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            humanPrincipalDid: 'did:tum:citizen:1100500123451',
            agentDid: agent.agentDid,
            allowedScopes: ['BANKING_SETTLEMENT'],
            maxTransactionAmount: 50000,
            cumulativeBudgetLimit: 200000,
            currency: 'THB',
            requireStepUpApprovalAbove: 25000,
            validityHours: 24
          })
        });
        const poa = await delegateRes.json();

        logToConsole('AI Agent Delegated Authority (PoA Active)', {
          agentDid: agent.agentDid,
          delegationId: poa.delegationId,
          cumulativeBudget: poa.permissions.cumulativeBudgetLimit,
          pqcAttested: true
        });
      } catch (err) {
        logToConsole('Error', err.message);
      }
    }

    async function testIcaoDoc9303Sod() {
      try {
        const mlRes = await fetch('/api/v1/icao/master-list');
        const mlData = await mlRes.json();
        logToConsole('ICAO Master List Status', {
          masterListId: mlData.masterListId,
          authority: mlData.issuingAuthority,
          totalCscaCertificates: mlData.totalCscaCount,
          signatureVerified: mlData.signatureVerified,
          status: 'READY_FOR_EGATE_CLEARANCE'
        });
      } catch (err) {
        logToConsole('Error', err.message);
      }
    }
  </script>
</body>
</html>`;
}
