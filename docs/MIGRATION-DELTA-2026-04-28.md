# Migration Delta – 16. April → 28. April 2026

> **Zweck:** Änderungen seit der letzten SPEC-Version (16. April), zum nachträglichen Glattziehen in der Cookie-Cutter-Migration.
> **Status:** POC 2 (Credential Issuance) ist seit 28. April 2026 vollständig funktionsfähig. Alle Änderungen unten waren nötig, um vom "Wallet bricht nach 1 Sekunde ab" zum erfolgreichen Credential-Empfang zu kommen.

---

## Übersicht

| # | Änderung | Datei | Auswirkung |
|---|---|---|---|
| 1 | `display`-Metadata hinzugefügt (Issuer + Credential-Config) | `metadata.ts` | Rendering der Consent-View |
| 2 | `nonce_endpoint` zur Issuer-Metadata hinzugefügt | `metadata.ts` | HAIP-Pflicht für Proof-JWT |
| 3 | `token_endpoint` direkt in Issuer-Metadata (Top-Level) | `metadata.ts` | BMI-Guide-Konformität |
| 4 | `grant_types_supported` direkt in Issuer-Metadata | `metadata.ts` | Wallet-Validierung |
| 5 | `authorization_endpoint` in AS-Metadata | `metadata.ts` | RFC 8414 Pflicht |
| 6 | `response_types_supported` in AS-Metadata | `metadata.ts` | RFC 8414 Pflicht |
| 7 | `proof_types_supported.jwt.proof_signing_alg_values_supported` in Credential-Config | `metadata.ts` | **Kritisch:** Wallet bricht ohne ab |
| 8 | `display` UNTER `credential_metadata`-Wrapper (nicht direkt) | `metadata.ts` | SPRIND-Wallet-Spezifika |
| 9 | Im Offer: nur `tx_code`-Objekt, kein `user_pin_required` | `offer.ts` | Verhindert weißen Screen |

---

## Detaillierte Änderungen

### Datei 1: `eudi-wallet-service/src/routes/issuer/metadata.ts`

#### Vorher (16. April):

```typescript
// GET /.well-known/openid-credential-issuer
export function handleIssuerMetadata(c: Context): Response {
  c.header('Cache-Control', 'no-store')
  return c.json({
    credential_issuer: SERVICE_URL,
    credential_endpoint: `${SERVICE_URL}/issuer/credential`,
    nonce_endpoint: `${SERVICE_URL}/issuer/nonce`,
    credential_configurations_supported: {
      wohnungsgeberbestaetigung: {
        format: 'dc+sd-jwt',
        vct: 'urn:credential:wohnungsgeberbestaetigung:1',
        credential_signing_alg_values_supported: ['ES256'],
      },
    },
  })
}

// GET /.well-known/oauth-authorization-server
export function handleAuthServerMetadata(c: Context): Response {
  c.header('Cache-Control', 'no-store')
  return c.json({
    issuer: SERVICE_URL,
    token_endpoint: `${SERVICE_URL}/issuer/token`,
    grant_types_supported: [
      'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    ],
    pre_authorized_grant_anonymous_access_supported: true,
  })
}
```

#### Nachher (28. April – funktionsfähig):

```typescript
// GET /.well-known/openid-credential-issuer
export function handleIssuerMetadata(c: Context): Response {
  c.header('Cache-Control', 'no-store')
  return c.json({
    credential_issuer: SERVICE_URL,
    credential_endpoint: `${SERVICE_URL}/issuer/credential`,
    token_endpoint: `${SERVICE_URL}/issuer/token`,                    // NEU: Top-Level
    nonce_endpoint: `${SERVICE_URL}/issuer/nonce`,
    credential_configurations_supported: {
      wohnungsgeberbestaetigung: {
        format: 'dc+sd-jwt',
        vct: 'urn:credential:wohnungsgeberbestaetigung:1',
        credential_signing_alg_values_supported: ['ES256'],
        proof_types_supported: {                                       // NEU – kritisch
          jwt: {
            proof_signing_alg_values_supported: ['ES256'],
          },
        },
        credential_metadata: {                                         // NEU – mit Wrapper
          display: [
            {
              name: 'Wohnungsgeberbestätigung',
              locale: 'de-DE',
              description: 'Bestätigung des Vermieters über den Einzug in eine Wohnung',
              background_color: '#0066CC',
              text_color: '#FFFFFF',
            },
            {
              name: 'Landlord Confirmation',
              locale: 'en-US',
              description: 'Landlord confirmation of move-in to a residence',
              background_color: '#0066CC',
              text_color: '#FFFFFF',
            },
          ],
        },
      },
    },
    grant_types_supported: [                                            // NEU: Top-Level
      'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    ],
    display: [                                                          // NEU: Issuer-Display
      { name: 'Immomio', locale: 'de-DE' },
      { name: 'Immomio', locale: 'en-US' },
    ],
  })
}

// GET /.well-known/oauth-authorization-server
export function handleAuthServerMetadata(c: Context): Response {
  c.header('Cache-Control', 'no-store')
  return c.json({
    issuer: SERVICE_URL,
    authorization_endpoint: `${SERVICE_URL}/issuer/authorize`,         // NEU: Stub-URL, RFC 8414
    token_endpoint: `${SERVICE_URL}/issuer/token`,
    response_types_supported: ['code'],                                 // NEU: RFC 8414
    grant_types_supported: [
      'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    ],
    pre_authorized_grant_anonymous_access_supported: true,
  })
}
```

#### Warum jede Änderung nötig war:

| Änderung | Problem ohne Änderung | Wallet-Verhalten |
|---|---|---|
| `token_endpoint` Top-Level | BMI-Guide-Konformität | (Vermutlich auch ohne ok, aber Best Practice) |
| `nonce_endpoint` | HAIP: Wallet braucht c_nonce für Proof-JWT | Stiller Abbruch nach Consent |
| `authorization_endpoint` | RFC 8414 Pflichtfeld | `ValidationError: Invalid authorization endpoint` |
| `response_types_supported` | RFC 8414 Pflichtfeld | Wahrscheinlich auch RFC-Validation-Fehler |
| `proof_types_supported.jwt.proof_signing_alg_values_supported` | Wallet weiß nicht wie sie Proof-JWT signieren soll | **Kritisch:** Im Wallet-Log `EudiWalletKit: No valid signing algorithms found in credential metadata: []` → User-facing irreführender Fehler "invalid transaction code" |
| `display` unter `credential_metadata`-Wrapper | SPRIND-Wallet erwartet so | Weißer Screen statt Consent |
| Issuer-Level `display` | Damit "Herausgeber: Immomio" angezeigt wird | "Herausgeber" zeigt Spinner / "Unbekannt" |

---

### Datei 2: `eudi-wallet-service/src/routes/issuer/offer.ts`

#### Vorher (16. April):

```typescript
const offer = {
  credential_issuer: SERVICE_URL,
  credential_configuration_ids: [session.credentialType],
  grants: {
    'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
      'pre-authorized_code': session.preAuthorizedCode,
      tx_code: {
        input_mode: 'numeric',
        length: 4,
        description: 'PIN aus der Immomio-App eingeben',
      },
      user_pin_required: true,    // ALT, weg!
    },
  },
}
```

#### Nachher (28. April):

```typescript
const offer = {
  credential_issuer: SERVICE_URL,
  credential_configuration_ids: [session.credentialType],
  grants: {
    'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
      'pre-authorized_code': session.preAuthorizedCode,
      tx_code: {
        input_mode: 'numeric',
        length: 4,
        description: 'PIN aus der Immomio-App eingeben',
      },
    },
  },
}
```

#### Warum:

`tx_code` (neuer OID4VCI Draft) und `user_pin_required` (alter Draft) gleichzeitig führten zu Wallet-Konflikten → weißer Screen. SPRIND-Wallet (Build 53+) versteht das `tx_code`-Objekt korrekt; der alte Flag ist nicht nötig und stört.

---

## Token Endpoint – KEIN Code-Change, aber wichtig

Der Token Endpoint (`/issuer/token`) muss weiterhin BEIDE Parameternamen für die PIN akzeptieren – `tx_code` (neuer Draft) UND `user_pin` (alter Draft). Welchen die Wallet sendet, hängt von ihrer Version ab.

```typescript
// Bereits implementiert, NICHT ändern:
txCode = (formData.get('tx_code') ?? formData.get('user_pin')) as string | undefined
```

---

## Reihenfolge der Fix-Versuche (zur Validierung der Migration)

Falls beim Cookie-Cutter-Rebuild ähnliche Symptome auftreten, hilft diese Diagnose-Reihenfolge:

1. **Wallet bricht ab vor Consent-Screen** → wahrscheinlich `display` falsch platziert oder fehlend
2. **Wallet zeigt Consent, aber bei "Weiter" → "Server nicht erreichbar / Invalid authorization endpoint"** → `authorization_endpoint` in AS-Metadata fehlt
3. **Wallet zeigt PIN-Eingabe, aber direkt nach PIN → "invalid transaction code" OHNE dass /issuer/token aufgerufen wurde** → `proof_types_supported.jwt.proof_signing_alg_values_supported` fehlt (Wallet bricht intern ab vor Token-Call)
4. **Wallet sendet PIN an /issuer/token aber wird abgelehnt** → in unserem Token-Endpoint nachprüfen ob `tx_code` UND `user_pin` als Parameter akzeptiert werden
5. **Erster Scan zeigt weißen Screen, zweiter funktioniert** → Wallet-Bug, akzeptieren bis SPRIND fixt

---

## Beweis: Funktioniert (28. April 2026)

Wallet-Log nach erfolgreicher Issuance:

```
09:38:31 IssuanceCode      → PIN-Eingabe
09:38:39 IssuanceSuccess   → ERFOLG!
09:38:40 Dashboard
09:38:39 OpenId4VCI : Issued credential data: eyJ0eXAiOiJkYytzZC1qd3QiLCJ4NWMi...
```

Credential in der Wallet sichtbar mit allen 8 Disclosures:
- given_name: ERIKA
- family_name: MUSTERMANN
- birthdate: 1964-08-12
- street_address: Musterstraße 42
- postal_code: 10115
- locality: Berlin
- move_in_date: 2026-04-01
- landlord_name: Immobilien GmbH

---

## Was unverändert blieb

Folgende Dateien hatten **keine** funktional relevanten Änderungen seit 16. April und müssen bei der Migration nicht angefasst werden:

- `eudi-wallet-service/src/routes/issuer/credential.ts` – Credential-Endpoint-Logik unverändert
- `eudi-wallet-service/src/routes/issuer/token.ts` – akzeptiert weiterhin beides (`tx_code`/`user_pin`)
- `eudi-wallet-service/src/routes/issuer/nonce.ts` – unverändert
- `eudi-wallet-service/src/routes/issuer/initiate.ts` – unverändert
- `eudi-wallet-service/src/lib/credential-builder.ts` – Mock-Daten unverändert
- `eudi-wallet-service/src/lib/jar.ts` – DCQL-Query unverändert
- `eudi-wallet-service/src/lib/validator.ts` – 7-Layer-Validierung unverändert
- Alle POC 1 Routes – unverändert

Nur `metadata.ts` und `offer.ts` mussten angepasst werden.

---

## Tech-Stack-Migration: Worauf besonders achten

Beim Übertragen ins Cookie-Cutter-Template:

1. **JSON-Struktur EXAKT übernehmen.** Reihenfolge der Keys ist egal, aber die Verschachtelung (`credential_metadata.display`, `proof_types_supported.jwt.proof_signing_alg_values_supported`) ist kritisch.

2. **`Cache-Control: no-store`** auf beide Well-Known-Endpoints.

3. **Authorization Endpoint Stub:** Im neuen Tech-Stack reicht es eine Route `/issuer/authorize` zu definieren die einfach 405 Method Not Allowed oder 404 zurückgibt. Sie wird nie aufgerufen, muss aber als URL existieren in der Metadata.

4. **Display Locale Codes:** Genau diese Schreibweise verwenden (`de-DE`, `en-US`), nicht `de` oder `en` allein.

5. **Background Color:** Hex-String mit `#`, nicht ohne.
