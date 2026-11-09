# Generates authentic X.509 test certificates and ICAO PKD Master List for TUM Trust Fabric
$ErrorActionPreference = "Continue"
$env:OPENSSL_CONF = "C:\Program Files\Git\usr\ssl\openssl.cnf"
$openssl = "C:\Program Files\Git\usr\bin\openssl.exe"
$outDir = "D:\TUM\tum-trust-fabric\data\icao-pki"

Write-Host "Generating ICAO Doc 9303 PKI test suite into $outDir..."

function Generate-Authority($countryCode, $cscaOrg, $cscaCn, $dsOrg, $dsCn) {
    Write-Host "Creating CSCA and DS for $countryCode ($cscaCn)..."
    
    # 1. CSCA Root Key & Self-Signed Cert
    & $openssl genrsa -out "$outDir\${countryCode}_csca_key.pem" 2048 2>$null
    & $openssl req -x509 -new -nodes -key "$outDir\${countryCode}_csca_key.pem" -sha256 -days 3650 `
        -out "$outDir\${countryCode}_csca_cert.pem" `
        -subj "/C=$countryCode/O=$cscaOrg/OU=$countryCode CSCA/CN=$cscaCn" 2>$null
        
    # 2. DS Key, CSR, and Certificate signed by CSCA
    & $openssl genrsa -out "$outDir\${countryCode}_ds_key.pem" 2048 2>$null
    & $openssl req -new -key "$outDir\${countryCode}_ds_key.pem" `
        -out "$outDir\${countryCode}_ds_csr.pem" `
        -subj "/C=$countryCode/O=$dsOrg/OU=Passport Issuance/CN=$dsCn" 2>$null
        
    & $openssl x509 -req -in "$outDir\${countryCode}_ds_csr.pem" `
        -CA "$outDir\${countryCode}_csca_cert.pem" -CAkey "$outDir\${countryCode}_csca_key.pem" `
        -CAcreateserial -out "$outDir\${countryCode}_ds_cert.pem" -days 730 -sha256 2>$null
        
    Remove-Item "$outDir\${countryCode}_ds_csr.pem" -ErrorAction SilentlyContinue
}

# 1. Sovereign Nations
Generate-Authority "TH" "Ministry of Foreign Affairs" "Thailand Country Signing CA" "Department of Consular Affairs" "Thailand Passport Document Signer 2026-01"
Generate-Authority "SG" "Immigration and Checkpoints Authority" "Singapore Country Signing CA" "ICA ePassport Production" "Singapore Document Signer 2026-SG"
Generate-Authority "DE" "Federal Office for Information Security" "German Country Signing CA" "Bundesdruckerei GmbH" "German Document Signer 2026-DE"
Generate-Authority "JP" "Ministry of Foreign Affairs" "Japan Country Signing CA" "National Printing Bureau" "Japan Document Signer 2026-JP"

# 2. Attacker / Rogue Authority (Untrusted, not in Master List)
Generate-Authority "XX" "Adversary Syndicate" "Rogue Nation Untrusted CA" "Malicious Forgery Unit" "Rogue Forged Document Signer 2026"

# 3. Revoked DS (Signed by THA CSCA but will be marked revoked)
& $openssl genrsa -out "$outDir\TH_revoked_ds_key.pem" 2048 2>$null
& $openssl req -new -key "$outDir\TH_revoked_ds_key.pem" `
    -out "$outDir\TH_revoked_ds_csr.pem" `
    -subj "/C=TH/O=Department of Consular Affairs/OU=Compromised Section/CN=Thailand Compromised Document Signer 2024" 2>$null
& $openssl x509 -req -in "$outDir\TH_revoked_ds_csr.pem" `
    -CA "$outDir\TH_csca_cert.pem" -CAkey "$outDir\TH_csca_key.pem" `
    -CAcreateserial -out "$outDir\TH_revoked_ds_cert.pem" -days 365 -sha256 2>$null
Remove-Item "$outDir\TH_revoked_ds_csr.pem" -ErrorAction SilentlyContinue

# 4. Master List Signer (MLS)
Write-Host "Creating ICAO PKD Master List Signer..."
& $openssl genrsa -out "$outDir\ICAO_mls_key.pem" 2048 2>$null
& $openssl req -x509 -new -nodes -key "$outDir\ICAO_mls_key.pem" -sha256 -days 3650 `
    -out "$outDir\ICAO_mls_cert.pem" `
    -subj "/C=INT/O=International Civil Aviation Organization/OU=Public Key Directory/CN=ICAO PKD Master List Signer 2026" 2>$null

# Copy to tests/fixtures/icao-pki
Copy-Item "$outDir\*.pem" "D:\TUM\tum-trust-fabric\tests\fixtures\icao-pki" -Force

Write-Host "ICAO Doc 9303 Certificates generation completed successfully."
