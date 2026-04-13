# EUDI Wallet Integration – Quellen & Referenzen

Strukturierte Sammlung aller Quellen, die bei der Entwicklung des EUDI Wallet POC verwendet wurden.

---

## 1. OpenID Foundation – Spezifikationen

| Quelle | URL | Relevanz |
|--------|-----|----------|
| OpenID4VP (Verifiable Presentations) | https://openid.net/specs/openid-4-verifiable-presentations-1_0.html | Kernprotokoll für PID-Präsentation aus der Wallet (POC 1) |
| OpenID4VCI (Verifiable Credential Issuance) | https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html | Kernprotokoll für Credential-Ausstellung in die Wallet (POC 2) |
| OID4VCI – Credential Refresh | https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-refreshing-issued-credentia | Automatisches Erneuern ausgestellter Credentials (noch nicht von SPRIND-Wallet unterstützt) |
| HAIP (High Assurance Interoperability Profile) | https://openid.net/specs/openid4vc-high-assurance-interoperability-profile-1_0.html | Interoperabilitätsprofil, auf dem die SPRIND-Wallet basiert |
| SD-JWT VC (Verifiable Credentials) | https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-05.html | Credential-Format mit selektiver Offenlegung |
| DCQL (Digital Credentials Query Language) | https://openid.net/specs/openid-4-verifiable-presentations-1_0.html#name-digital-credentials-query-l | Abfragesprache für Credential-Anforderungen im VP-Request |

---

## 2. IETF – Standards

| Quelle | URL | Relevanz |
|--------|-----|----------|
| SD-JWT (Selective Disclosure JWT) | https://www.ietf.org/archive/id/draft-ietf-oauth-selective-disclosure-jwt-13.html | Basisformat für selektive Offenlegung in JWTs |
| JAR (JWT-Secured Authorization Requests) | https://datatracker.ietf.org/doc/html/rfc9101 | Signierte Authorization Requests (unser VP-Request) |
| DPoP (Demonstration of Proof-of-Possession) | https://datatracker.ietf.org/doc/html/rfc9449 | Token-Binding im OID4VCI-Flow (Blueprint-Anforderung) |

---

## 3. BMI Blueprint – Deutsche EUDI-Wallet Architektur

### Hauptdokumentation

| Quelle | URL | Relevanz |
|--------|-----|----------|
| Blueprint Startseite | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/ | Gesamtübersicht der deutschen EUDI-Wallet-Architektur |
| EAA Übersicht | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/ecosystem-architecture/EAA/ | Electronic Attestation of Attributes – Grundlagen |
| Credential Anatomy | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/ecosystem-architecture/EAA/credential-anatomy/ | Aufbau von SD-JWT-VC und mDoc Credentials, Holder Binding, Revocation |
| Design Recommendations | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/ecosystem-architecture/EAA/design-recommendations/ | Empfehlungen zu Laufzeiten (max. 36 Monate), Revocation-Strategie, Sicherheit |

### EAA Developer Guide (pausiert – Use-Case noch nicht in Wallet lauffähig)

| Quelle | URL | Relevanz |
|--------|-----|----------|
| EAA Onboarding Overview | https://bmi.usercontent.opencode.de/eudi-wallet/developer-guide/eaa/onboarding/overview/ | Ökosystem-Rollen (EAA Provider/Issuer, Relying Party/Verifier, Schema Owner), Onboarding-Pfad (Rulebook-Adoption + technische Implementierung) |
| EAA Issuance Developer Guide | https://bmi.usercontent.opencode.de/eudi-wallet/developer-guide/eaa/EAA_Issuance/ | OpenID4VCI-Implementierung für EAA-Issuer: Auth Code vs. Pre-Auth Flow, dc+sd-jwt/mso_mdoc, Metadata, Refresh Tokens, Status Lists, Key Rotation |

### PID (Person Identification Data)

| Quelle | URL | Relevanz |
|--------|-----|----------|
| German PID Rulebook | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/ecosystem-architecture/PID/german-pid-rulebook/ | Nationale PID-Spezifikation: Pflicht-/Optionale Attribute, SD-JWT VC Format (`urn:eudi:pid:de:1`), German Extensions (age_over_XX, source_document_type), ICAO Doc 9303 Encoding, 5-Jahres-Laufzeit |

### Protokoll-Flows (Appendix)

| Quelle | URL | Relevanz |
|--------|-----|----------|
| EAA Issuance Flow (OID4VCI) | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/appendix/flows/EAA-Issuance-OpenID4VC/ | Detaillierter Issuance-Ablauf (Pre-Auth + Auth Code Flow), Endpoints, Proof-of-Possession |
| EAA Presentation Flow (OID4VP) | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/appendix/flows/EAA-Presentation-OpenID4VC/ | Detaillierter Presentation-Ablauf (Same-Device + Cross-Device) |
| Presentation during Issuance | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/appendix/flows/Presentation-During-Issuance/ | PID-Vorlage während Credential-Ausstellung |
| OID4VC + Access Certificates | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/appendix/flows/OID4VC-with-WRP-attestations/ | Integration von Access Certificates in OID4VC-Flows |
| Wallet Attestation | https://bmi.usercontent.opencode.de/eudi-wallet/eidas-2.0-architekturkonzept/content/appendix/flows/Wallet-Attestation/ | Wallet-Attestierung gegenüber Issuern/Verifiern |

### Trust Lists

| Quelle | URL | Relevanz |
|--------|-----|----------|
| Test Trust Lists (Übersicht) | https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists | Verzeichnis der Test-Trust-Lists |
| PID Provider Trust List | https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists/pid-provider.jwt | JWT mit PID-Issuer-Zertifikaten (ETSI TS 119 602 LoTE Format seit März 2026) |
| Wallet Provider Trust List | https://bmi.usercontent.opencode.de/eudi-wallet/test-trust-lists/wallet-provider.jwt | JWT mit Wallet-Provider-Zertifikaten |

---

## 4. SPRIND Funke Wallet

### Repositories & Dokumentation

| Quelle | URL | Relevanz |
|--------|-----|----------|
| Funke iOS Wallet (GitHub) | https://github.com/nicosResworworworworked/eudi-wallet-ios | SPRIND Wallet iOS App (Open Source) |
| Funke Android Wallet (GitHub) | https://github.com/nicosResworworworworked/eudi-wallet-android | SPRIND Wallet Android App |

### Forum-Erkenntnisse (Element/Matrix)

| Datum | Thema | Erkenntnis |
|-------|-------|------------|
| März 2026 | DCQL `id`-Properties | Anderer Tester nutzt `id` auf jedem Claim + nested paths für Adressfelder |
| März 2026 | Trust List Breaking Change | mirko.mollik: Umstellung auf ETSI TS 119 602 LoTE Format, alte `entries[].x5t#S256` funktionieren nicht mehr |
| März 2026 | Credential Refresh | mirko.mollik: "Not supported by the wallet yet" |
| März 2026 | Revocation vs. Laufzeit | mirko.mollik: Use-Case-abhängig – kurze Laufzeit ohne Revocation vs. lange Laufzeit mit Revocation |
| März 2026 | EAA Blueprint Update | gabriel.pene: Blueprint-Doku um EAA-Issuance-Kapitel erweitert |
| März 2026 | Adressfelder | SPRIND-Wallet zeigt keine Adressfelder zur Auswahl an – Wallet-Limitation |

---

## 5. Libraries & Packages

### Im Projekt verwendet

| Package | URL | Verwendung |
|---------|-----|------------|
| jose (v5) | https://github.com/panva/jose | JWT/JWS/JWE Erstellung und Verifikation, Key Import (PKCS8, SPKI) |
| @sd-jwt/core | https://github.com/nicosResworked/sd-jwt-js | SD-JWT-VC Credential-Erstellung für Issuance (POC 2) |
| qrcode.react | https://www.npmjs.com/package/qrcode.react | QR-Code Rendering für Cross-Device Flows |
| zod | https://zod.dev | Schema-Validierung (Frontend-Formulare) |

---

## 6. Referenz-Implementierungen & Test-Infrastruktur

| Quelle | URL | Relevanz |
|--------|-----|----------|
| Bundesdruckerei PID Demo | https://demo.pid-issuer.bundesdruckerei.de | PID-Issuer Referenzimplementierung |
| BDR Reference Wallet | https://wallet.bdr.de | Alternative Wallet für Tests |

---

## 7. ETSI Standards (referenziert im Blueprint)

| Standard | Thema |
|----------|-------|
| ETSI TS 119 602 | LoTE (List of Trusted Entities) – Trust List Format |
| ETSI TS 119 461 | Identifizierung nach eIDAS Art. 24(1) |
| ETSI TS 119 471 | Authentifizierung |
| ETSI TS 119 472-1 | Attestation Format Requirements |
| ETSI TS 119 472-2 | Presentation-Spezifikation |
| ETSI TS 119 472-3 | Issuance-Spezifikation |
| ETSI TS 119 411-8 | Access Certificates |
| ETSI TS 119 475 | Registration Certificates |

---

## 8. Projekt-spezifisch

| Quelle | URL | Relevanz |
|--------|-----|----------|
| Immomio Datenschutz | https://www.mieter.immomio.com/datenschutz | Datenschutz-Link im Bewerbungs-Frontend |
| Railway (Deployment) | https://railway.com | Hosting des eudi-wallet-service Backend |

---

*Letzte Aktualisierung: 13. April 2026*
