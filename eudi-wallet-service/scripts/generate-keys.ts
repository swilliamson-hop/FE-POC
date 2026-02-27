/**
 * One-time key generation script for the EUDI Wallet Service Access Certificate.
 *
 * Run with:  npm run generate-keys
 *
 * Output:
 *  1. Private key (PEM) → goes into .env as PRIVATE_KEY
 *  2. Public key (PEM)  → paste into sandbox "Create Access Certificate" form
 */

import { generateKeyPair, exportPKCS8, exportSPKI, exportJWK, calculateJwkThumbprintUri } from 'jose'

const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })

const privateKeyPem = await exportPKCS8(privateKey)
const publicKeyPem = await exportSPKI(publicKey)

// Calculate x509_hash client_id thumbprint from the actual public key
const publicKeyJwk = await exportJWK(publicKey)
const thumbprintUri = await calculateJwkThumbprintUri(publicKeyJwk)

console.log('='.repeat(70))
console.log('EUDI Wallet Service – Key Generation')
console.log('='.repeat(70))

console.log('\n📋 STEP 1: Add this to your .env file as PRIVATE_KEY')
console.log('(Keep this SECRET – never commit to git)\n')
console.log('PRIVATE_KEY="' + privateKeyPem.replace(/\n/g, '\\n') + '"')

console.log('\n' + '='.repeat(70))
console.log('\n📋 STEP 2: Paste this PUBLIC KEY into the sandbox Access Certificate form')
console.log('(Field: "Public Key (P-256 only)")\n')
console.log(publicKeyPem)

console.log('='.repeat(70))
console.log('\n📋 STEP 3: After sandbox creates the certificate:')
console.log('  - Download the certificate chain (PEM format)')
console.log('  - Add to .env as CERT_CHAIN="-----BEGIN CERTIFICATE-----\\n...\\n-----END CERTIFICATE-----"')
console.log('\n📋 STEP 4: Set CLIENT_ID in .env')
console.log('  - The sandbox will show a certificate thumbprint / x509 identifier')
console.log('  - Format: x509_hash:sha256:<base64url-thumbprint>')
console.log('='.repeat(70))
