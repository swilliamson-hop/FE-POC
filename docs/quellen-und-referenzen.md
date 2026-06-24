# EUDI Wallet Integration – Quellen & Referenzen

Strukturierte Sammlung aller Quellen, die bei der Entwicklung des EUDI Wallet POC verwendet wurden.

---

## 1. OpenID Foundation – Spezifikationen

| Quelle | URL | Relevanz |
|--------|-----|----------|
| OpenID4VP (Verifiable Presentations) | https://openid.net/specs/openid-4-verifiable-presentations-1_0.html | Kernprotokoll für PID-Präsentation aus der Wallet (POC 1) |
| OpenID4VCI (Verifiable Credential Issuance) | https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html | Kernprotokoll für Credential-Ausstellung in die Wallet (POC 2) |
| HAIP (High Assurance Interoperability Profile) | https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0.html | Interoperabilitätsprofil, auf dem die SPRIND-Wallet basiert |
| DCQL (Digital Credentials Query Language) | https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-digital-credentials-query-l | Abfragesprache für Credential-Anforderungen im VP-Request |
| JARM (JWT Secured Authorization Response Mode) | https://openid.net/specs/openid-financial-api-jarm-ID1.html | Verschlüsselte Authorization Responses (direct_post.jwt) |

---

## 2. IETF – Standards

| Quelle | URL | Relevanz |
|--------|-----|----------|
| SD-JWT (Selective Disclosure JWT) | https://datatracker.ietf.org/doc/draft-ietf-oauth-selective-disclosure-jwt/ | Basisformat für selektive Offenlegung in JWTs |
| SD-JWT VC (Verifiable Credentials) | https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/ | Credential-Format `dc+sd-jwt` mit selektiver Offenlegung |
| JAR (JWT-Secured Authorization Requests) | https://datatracker.ietf.org/doc/html/rfc9101 | Signierte Authorization Requests (VP-Request als `oauth-authz-req+jwt`) |
| DPoP (Demonstration of Proof-of-Possession) | https://datatracker.ietf.org/doc/html/rfc9449 | Token-Binding (Blueprint-Anforderung, im POC nicht erzwungen) |
| JWE (JSON Web Encryption) | https://datatracker.ietf.org/doc/html/rfc7516 | Verschlüsselung der VP-Response (ECDH-ES + A128GCM/A256GCM) |

---

## 3. BMI Blueprint – Deutsche EUDI-Wallet Architektur

### Hauptdokumentation

| Quelle | URL | Relevanz |
|--------|-----|----------|
| Blueprint Startseite | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/ | Gesamtübersicht der deutschen EUDI-Wallet-Architektur |
| EAA Übersicht | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/ecosystem-architecture/EAA/ | Electronic Attestation of Attributes – Grundlagen |
| Catalog of Attestations | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/ecosystem-architecture/EAA/catalog-of-attestations/ | Schema-Struktur, Verification Approach, Trust Lists |
| Credential Anatomy | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/ecosystem-architecture/EAA/credential-anatomy/ | Aufbau von SD-JWT-VC und mDoc Credentials |
| Design Recommendations | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/ecosystem-architecture/EAA/design-recommendations/ | Empfehlungen zu Laufzeiten, Revocation, Sicherheit |

### EAA Developer Guide

| Quelle | URL | Relevanz |
|--------|-----|----------|
| EAA Onboarding Overview | https://bmi.usercontent.opencode.de/eudi-wallet/developer-guide/eaa/onboarding/overview/ | Ökosystem-Rollen, Onboarding-Pfade (Path A: Rulebook-Adoption, Path B: Neues Rulebook) |
| EAA Onboarding – Integration Steps | https://bmi.usercontent.opencode.de/eudi-wallet/developer-guide/eaa/onboarding/overview/#eaa-integration-steps | Konkrete Schritte für EAA-Integration als Issuer |
| EAA Onboarding – Rulebook erstellen | https://bmi.usercontent.opencode.de/eudi-wallet/developer-guide/eaa/onboarding/rulebook/ | Anleitung zum Erstellen eines eigenen Attestation Rulebooks (Path B) |
| EAA Issuance Developer Guide | https://bmi.usercontent.opencode.de/eudi-wallet/developer-guide/eaa/EAA_Issuance/ | OpenID4VCI-Implementierung: Pre-Auth Flow, dc+sd-jwt, Metadata-Beispiele |

### PID (Person Identification Data)

| Quelle | URL | Relevanz |
|--------|-----|----------|
| German PID Rulebook | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/ecosystem-architecture/PID/german-pid-rulebook/ | PID-Spezifikation: VCT `urn:eudi:pid:de:1`, Pflicht-/Optionale Attribute, SD-JWT VC Format |

### Protokoll-Flows (Appendix)

| Quelle | URL | Relevanz |
|--------|-----|----------|
| EAA Issuance Flow (OID4VCI) | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/appendix/flows/EAA-Issuance-OpenID4VC/ | Detaillierter Issuance-Ablauf |
| EAA Presentation Flow (OID4VP) | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/appendix/flows/EAA-Presentation-OpenID4VC/ | Detaillierter Presentation-Ablauf |
| Presentation during Issuance | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/appendix/flows/Presentation-During-Issuance/ | PID-Vorlage während Credential-Ausstellung |
| OID4VC + Access Certificates | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/appendix/flows/OID4VC-with-WRP-attestations/ | Integration von Access Certificates in OID4VC-Flows |

### Trust Lists

| Quelle | URL | Relevanz |
|--------|-----|----------|
| Test Trust Lists (Übersicht) | https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists | Verzeichnis der Test-Trust-Lists |
| PID Provider Trust List | https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists/pid-provider.jwt | ETSI TS 119 602 LoTE Format (seit März 2026) |
| Wallet Provider Trust List | https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists/wallet-provider.jwt | Wallet-Provider-Zertifikate |

---

## 4. SPRIND Funke Wallet

### App

| Quelle | Relevanz |
|--------|----------|
| EUDI Wallet DE Sandbox (TestFlight, Sprind GmbH, v0.2.0 Build 50) | Primäre Test-Wallet. User-Agent: `IDGo/50` (Thales-Engine). |

### Forum-Erkenntnisse (Element/Matrix)

| Datum | Thema | Erkenntnis |
|-------|-------|------------|
| März 2026 | DCQL `id`-Properties | Jeder Claim braucht ein `id`-Property. Adressfelder als nested paths (`["address", "street_address"]`). |
| März 2026 | Trust List Breaking Change | Umstellung auf ETSI TS 119 602 LoTE Format. Alte `entries[].x5t#S256` funktionieren nicht mehr. |
| März 2026 | Credential Refresh | "Not supported by the wallet yet" (mirko.mollik) |
| März 2026 | EAA Blueprint Update | Blueprint-Doku um EAA-Issuance-Kapitel erweitert (gabriel.pene) |
| März 2026 | Adressfelder | SPRIND-Wallet zeigt keine Adressfelder zur Auswahl an – Wallet-Limitation |

---

## 5. Attestation Rulebooks & Trust Infrastructure

| Quelle | URL | Relevanz |
|--------|-----|----------|
| EUDI Attestation Rulebooks Catalog (GitHub) | https://github.com/eu-digital-identity-wallet/eudi-doc-attestation-rulebooks-catalog | **Komplett leer** (Stand April 2026) – nur Template-Struktur |
| Catalog of Attestations Reference Impl. | https://github.com/cre8/catalog-of-attestations | Referenzimplementierung für Attestation Catalogs |
| Catalog Verification Approach | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/ecosystem-architecture/EAA/catalog-of-attestations/#verification-approach | Wie Wallets Issuer-Autorisierung prüfen: Registration Certificate → Rulebook → Trust List |
| Catalog of Attestations – For Issuers | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/ecosystem-architecture/EAA/catalog-of-attestations/#for-issuers | Issuer-spezifische Anforderungen: Rulebook-Konformität, Registration Certificate, Trust List Eintrag |

---

## 6. Libraries & Packages

### Backend (eudi-wallet-service)

| Package | Version | URL | Verwendung |
|---------|---------|-----|------------|
| hono | ^4.7.4 | https://hono.dev | HTTP-Framework |
| @hono/node-server | ^1.13.8 | https://github.com/honojs/node-server | Node.js Adapter für Hono |
| jose | ^6.0.10 | https://github.com/panva/jose | JWT/JWS/JWE Erstellung und Verifikation, Key Import |
| @sd-jwt/core | ^0.14.0 | https://github.com/openwallet-foundation-labs/sd-jwt-js | SD-JWT-VC Credential-Erstellung |
| tsx | ^4.19.3 | https://github.com/privatenumber/tsx | TypeScript-Ausführung ohne Kompilierung |

### Frontend (web)

| Package | Version | URL | Verwendung |
|---------|---------|-----|------------|
| next | 16.1.1 | https://nextjs.org | React-Framework |
| react | 19.2.3 | https://react.dev | UI-Library |
| qrcode.react | ^4.2.0 | https://www.npmjs.com/package/qrcode.react | QR-Code Rendering für Cross-Device Flows |
| zod | ^4.3.5 | https://zod.dev | Schema-Validierung |
| graphql-request | ^7.4.0 | https://github.com/jasonkuhrt/graphql-request | GraphQL Client |
| lucide-react | ^0.562.0 | https://lucide.dev | Icon-Library |
| tailwindcss | ^4 | https://tailwindcss.com | CSS-Framework |

---

## 7. Externe APIs (nicht EUDI-bezogen)

| Quelle | URL | Verwendung |
|--------|-----|------------|
| Nominatim (OpenStreetMap) | https://nominatim.openstreetmap.org/search | Adress-Autocomplete im Bewerbungsformular (Step 3) |

---

## 8. Referenz-Implementierungen & Test-Infrastruktur

| Quelle | URL | Relevanz |
|--------|-----|----------|
| Bundesdruckerei PID Demo | https://demo.pid-issuer.bundesdruckerei.de | PID-Issuer Referenzimplementierung |

---

## 9. ETSI Standards (referenziert im Blueprint)

| Standard | Thema | Relevanz im POC |
|----------|-------|-----------------|
| ETSI TS 119 602 | LoTE (List of Trusted Entities) | Trust List Format – Parser implementiert |
| ETSI TS 119 461 | Identifizierung nach eIDAS Art. 24(1) | Referenziert im Blueprint |
| ETSI TS 119 471 | Authentifizierung | Referenziert im Blueprint |
| ETSI TS 119 472-1 | Attestation Format Requirements | Referenziert im Blueprint |
| ETSI TS 119 472-2 | Presentation-Spezifikation | Referenziert im Blueprint |
| ETSI TS 119 472-3 | Issuance-Spezifikation | Registration Certificate für Issuer-Autorisierung |
| ETSI TS 119 475 | Registration Certificates | Rulebook-Referenz für EAA-Autorisierung |

---

## 10. Projekt-spezifisch

| Quelle | URL | Relevanz |
|--------|-----|----------|
| Immomio Datenschutz | https://www.mieter.immomio.com/datenschutz | Datenschutz-Link im Bewerbungs-Frontend |
| Railway (Deployment) | https://railway.com | Hosting des eudi-wallet-service Backend |

---

*Letzte Aktualisierung: 16. April 2026*
