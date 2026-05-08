# ERICA-Test 5. Mai 2026 – Adress-Disclosure-Bug verifiziert

> **Zweck:** Dokumentation des Tests mit ERICA (BMI's offizielles RP-Debug-Tool) der bewiesen hat: der Adress-Disclosure-Bug bei OpenID4VP ist 100% wallet-seitig. Unser Code arbeitet korrekt.

## Was ist ERICA

**ERICA** = EUDI Relying Party Integration Conformance Analyzer.

Offizielles Debug-Tool von BMI/SPRIND für RP-Integrationen. Validiert OpenID4VP-Anfragen gegen HAIP-Profile und simuliert konforme Wallets, damit RP-Implementierungen unabhängig von der echten Wallet getestet werden können.

- **Forum-Ankündigung:** 4. Mai 2026 von Mirko Mollik (SPRIND)
- **Source:** https://gitlab.opencode.de/bmi/eudi-wallet/erica
- **Docker Registry:** `registry.opencode.de/bmi/eudi-wallet/erica:latest`

## Setup (lokal auf Mac)

```bash
docker run -p 3001:3001 registry.opencode.de/bmi/eudi-wallet/erica:latest
```

ERICA Web-UI: http://localhost:3001

## Testablauf

### 1. Authorization-URL vom Backend erzeugen

```bash
curl -X POST https://fe-poc-production.up.railway.app/initiate \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response:
```json
{
  "sessionId": "139f7fb3-499e-4099-a0f6-73c3939bb6f3",
  "walletUrl": "openid4vp://?client_id=...&request_uri=https%3A%2F%2Ffe-poc-production.up.railway.app%2Frequest%2F139f7fb3-..."
}
```

### 2. In ERICA einfügen

ERICA UI → "Debug a Presentation Request" → "Authorization URL" Mode → Wert von `walletUrl` einfügen.

Settings auf den Defaults belassen:
- **Wallet Simulation Mode:** Valid / Compliant Wallet
- **Validation Profile:** PID Presentation (EUDI)
- **PID Template:** Normal
- **Credential Format:** SD-JWT

Submit-Button klicken.

### 3. Erwartetes Ergebnis

ERICA fetched die JAR von unserem Backend, simuliert eine compliant Wallet, schickt eine valide VP-Response an unser `/callback`-Endpoint.

## Befund vom 5. Mai 2026

### ERICA-Validierung

```
Profile-aligned with recommendations: 98%
Request Compliance: 97% (1 optionale Verbesserung, 50/51 Checks)
Response Compliance: 100% (21/21 Checks, 0 Errors)
"Your Presentation Request is fully compliant with the EUDI PID Presentation profile
 and will work with wallets that support the OID4VP HAIP."
```

→ Unser Service ist HAIP-konform und arbeitet korrekt.

### Die eine Empfehlung: `verifier_info` (am 8. Mai umgesetzt)

ERICA's einziger Warning-Eintrag:

> **Verifier Info Presence (PID)** – Warning
> Profile · PID Presentation Requirements
> "PID Presentation requires verifier_info to identify the RP"
> Expected: `verifier_info object` | Actual: `undefined`
> Suggested fix: Add verifier_info with organization name and logo
> Reference: EUDI-ARF Section 3.2

**Umgesetzt am 8. Mai 2026** in [jar.ts:99-105](../eudi-wallet-service/src/lib/jar.ts):
```json
"verifier_info": {
  "name": "Immomio",
  "logo_uri": "https://www.mieter.immomio.com/favicon.ico"
}
```

Damit kann der Wallet-Consent-Screen "Immomio fragt Daten an" mit Logo anzeigen statt nur Client-ID/Hash. Beim nächsten ERICA-Run sollten **51/51** Request-Checks passen → 100% Compliance.

### Backend-Log: was eine compliant Wallet sendet

```
[PID] Disclosed claim names: [ 'given_name', 'family_name', 'birthdate', 'address' ]

[PID] address object: {
  "street_address": "Hauptstraße 42",
  "postal_code": "10115",
  "locality": "Berlin",
  "country": "DE"
}

[PID] Extracted address fields: {
  streetAddress: 'Hauptstraße 42',
  postalCode: '10115',
  locality: 'Berlin',
  country: 'DE'
}
```

→ Alle Adressfelder kommen durch. Unser Code in [pid.ts:65-75](../eudi-wallet-service/src/lib/pid.ts#L65-L75) extrahiert sie korrekt.

### Vergleich SPRIND-Wallet (IDGo/55)

Bei identischer DCQL-Anfrage – aber mit der echten SPRIND-Wallet statt ERICA:

```
[PID] Disclosed claim names: [ 'family_name', 'given_name', 'birthdate' ]
[PID] No address object found. claims.address = undefined
[PID] Extracted address fields: {
  streetAddress: undefined,
  postalCode: undefined,
  locality: undefined,
  country: undefined
}
```

→ SPRIND-Wallet sendet keine Adress-Disclosures. Bug klar wallet-seitig.

## Wichtige Erkenntnis: Wie compliant Wallets Adresse disclosen

Eine compliant Wallet sendet `address` als **ein einzelnes Disclosure** für das gesamte Objekt – nicht als 4 separate Disclosures pro Sub-Feld:

```
Disclosed: ['..., 'address']                        ← 1 Eintrag
        ↓
address: {
  street_address, postal_code, locality, country    ← alle drin
}
```

DCQL-Query mit nested paths `["address", "street_address"]` etc. wird interpretiert als "ich will die Felder unter address" → Wallet liefert das ganze Objekt.

Unser Code in [pid.ts:65-75](../eudi-wallet-service/src/lib/pid.ts#L65-L75) handelt beide Fälle ab:
1. Address als Objekt → Sub-Felder extrahieren
2. Sub-Felder als Top-Level-Claims → ebenfalls extrahieren

## Schlussfolgerung

**Code unsererseits ist korrekt.** Wartet auf SPRIND-Wallet-Fix.

## Bug-Report-Vorlage für SPRIND

```
OpenID4VP Address Disclosure Bug in EUDI Wallet DE Sandbox (IDGo/55)

When a relying party sends a DCQL query with nested paths for the
German PID address fields (e.g., path: ["address", "street_address"]),
the SPRIND wallet does not disclose the address claims at all – neither
as a parent address object nor as individual sub-fields.

Reproducible with ERICA reference implementation:
docker run -p 3001:3001 registry.opencode.de/bmi/eudi-wallet/erica:latest

Same DCQL query → ERICA's compliant wallet simulator correctly discloses
the `address` parent object containing all 4 sub-fields (street_address,
postal_code, locality, country).

Backend received with ERICA:
  [PID] Disclosed claim names: [ 'given_name', 'family_name', 'birthdate', 'address' ]
  [PID] address object: {
    "street_address": "Hauptstraße 42",
    "postal_code": "10115",
    "locality": "Berlin",
    "country": "DE"
  }

Backend received with SPRIND wallet IDGo/55 (same backend, same DCQL):
  [PID] Disclosed claim names: [ 'family_name', 'given_name', 'birthdate' ]
  [PID] No address object found.
```

## Zusatznutzen von ERICA

### Demo-Vorbereitung

Vor jedem Demo (z.B. Wohnzukunftstag): kurz mit ERICA prüfen ob unser Service noch HAIP-konform ist. 1 Minute Aufwand, hohe Sicherheit.

### Reproduzierbarer Test

Bei SPRIND-Backend-Regressions können wir ERICA gegen unseren Service laufen lassen um zu beweisen: unser Service ist nicht das Problem. Hilft bei der Eskalation.

### Demo-Backup-Idee

Falls am Wohnzukunftstag die echte Wallet zickt, könnte ERICA als Notfall-Backup dienen ("Hier funktioniert's mit dem konformen Simulator – mit der Wallet wird's auch laufen sobald der bekannte Bug behoben ist"). Nicht ideal für ein Live-Publikum, aber besser als gar nichts.
