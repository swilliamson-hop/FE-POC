# Migration Delta – 28. April → 4. Mai 2026

> **Zweck:** Änderungen seit dem letzten Migration-Delta ([`MIGRATION-DELTA-2026-04-28.md`](./MIGRATION-DELTA-2026-04-28.md)), zum nachträglichen Glattziehen in der Cookie-Cutter-Migration.
>
> **Voraussetzung:** Du hast die Änderungen aus dem 28. April Delta bereits angewendet.
>
> **Status:** Beide Credential-Typen (Wohnungsgeberbestätigung + Genossenschafts-Mitgliedsbescheinigung) end-to-end ausstellbar. Bekannte Wallet-Bugs sind dokumentiert aber nicht in unserem Code lösbar.

---

## Übersicht

| # | Änderung | Datei | Auswirkung |
|---|---|---|---|
| 1 | Zweite Credential-Konfiguration `genossenschaft-mitglied` zur Issuer-Metadata hinzugefügt | `metadata.ts` | Pflicht für Issuance dieses Credential-Typs |
| 2 | Erweitertes Request-Logging mit Request-IDs, Timing, Headern | `index.ts` | Debug-Hilfe (optional) |
| 3 | Optionale Artificial-Delay-Middleware via Env-Vars | `index.ts` | Debug-Hilfe für Race-Condition-Tests (optional) |

---

## Änderung 1: Zweite Credential-Konfiguration in der Issuer-Metadata

### Datei: `eudi-wallet-service/src/routes/issuer/metadata.ts`

Bisher war im 28. April Delta nur `wohnungsgeberbestaetigung` deklariert. Beim Versuch eine `genossenschaft-mitglied`-Bescheinigung auszustellen zeigte die Wallet **keinen Titel** (weil es keine `display`-Metadata für diesen Typ gab) und warf Folgefehler.

#### Vorher

```typescript
credential_configurations_supported: {
  wohnungsgeberbestaetigung: {
    format: 'dc+sd-jwt',
    vct: 'urn:credential:wohnungsgeberbestaetigung:1',
    credential_signing_alg_values_supported: ['ES256'],
    proof_types_supported: { jwt: { proof_signing_alg_values_supported: ['ES256'] } },
    credential_metadata: {
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
```

#### Nachher

```typescript
credential_configurations_supported: {
  wohnungsgeberbestaetigung: {
    // ... unverändert ...
  },
  'genossenschaft-mitglied': {                                          // NEU
    format: 'dc+sd-jwt',
    vct: 'urn:credential:genossenschaft-mitglied:1',
    credential_signing_alg_values_supported: ['ES256'],
    proof_types_supported: {
      jwt: {
        proof_signing_alg_values_supported: ['ES256'],
      },
    },
    credential_metadata: {
      display: [
        {
          name: 'Genossenschafts-Mitgliedsbescheinigung',
          locale: 'de-DE',
          description: 'Bescheinigung über die Mitgliedschaft in einer Wohnungsbaugenossenschaft',
          background_color: '#1A7F5A',                                  // Grün, um sich von der blauen Wohnungsgeberbestätigung zu unterscheiden
          text_color: '#FFFFFF',
        },
        {
          name: 'Cooperative Membership Certificate',
          locale: 'en-US',
          description: 'Certificate of membership in a housing cooperative',
          background_color: '#1A7F5A',
          text_color: '#FFFFFF',
        },
      ],
    },
  },
},
```

#### Warum

Die Credential-Builder-Logik in `credential-builder.ts` unterstützte bereits beide Typen, aber das Offer schickt `credential_configuration_ids: [<credentialType>]` und die Wallet validiert das gegen die Issuer-Metadata. Ohne den Eintrag:
- Kein Titel im Consent-Screen (Wallet kennt keinen Display-Namen)
- Folgefehler bei der Validierung

#### Wichtig: Schlüssel mit Bindestrich

Beachte: Der Key heißt `'genossenschaft-mitglied'` (mit Bindestrich, in Anführungszeichen weil Bindestrich kein gültiger JS-Identifier ist). Das muss exakt mit dem `CredentialType`-Enum aus `types.ts` übereinstimmen, weil das Offer den Wert direkt aus `session.credentialType` übernimmt.

---

## Änderung 2 & 3: Debug-Hilfen (optional)

### Datei: `eudi-wallet-service/src/index.ts`

Zwei Erweiterungen für Debugging. **Sind nicht zwingend nötig** für die Funktionalität – beide Funktionen sind im Standard-Modus inaktiv (kein Delay) bzw. liefern lediglich detailliertere Logs.

Wenn dein Cookie-Cutter-Logging-Setup ähnliche Funktionalität bereits liefert, kannst du das überspringen.

### Erweitertes Request-Logging

Pro Request:
- Eindeutige Request-ID (8-stellig, base64url)
- Millisekunden-Timestamp
- Wallet-relevante Header (Accept, Accept-Encoding, Cache-Control, Content-Type, etc.)
- Response-Duration

Format der Logs:
```
[REQ a3f1c8b2] 09:38:18.123 GET /issuer/offer/abc-def ua=IDGo/55 ...
[RES a3f1c8b2] +47ms GET /issuer/offer/abc-def -> 200
```

Hilfreich um:
- Concurrent Requests zu unterscheiden (Wallet macht oft parallele Calls)
- Wallet-Cache-Verhalten zu sehen
- Server-seitige Latenz zu identifizieren

### Optionale Artificial-Delay-Middleware

Steuerbar über Environment-Variablen:
- `ARTIFICIAL_DELAY_OFFER_MS` (default `0`) – Verzögerung auf `/issuer/offer/*`
- `ARTIFICIAL_DELAY_METADATA_MS` (default `0`) – Verzögerung auf `/.well-known/*`

Im normalen Betrieb beide `0`. Aktivieren wenn man Race-Conditions in der Wallet untersuchen will.

---

## Was nicht geändert wurde (aber in der SPEC dokumentiert)

Folgende Erkenntnisse aus dieser Periode sind in der SPEC dokumentiert, brauchen aber **keinen Code-Change** beim Migrieren:

### Wallet-Bug-Updates

- **White-Screen beim ersten Scan ist mit Wallet-Version IDGo/55 weg** – kein Workaround mehr nötig
- **Post-Issuance "Schluckauf"** (Wallet navigiert sporadisch in ungewollten Folge-Flow) – **NICHT** unser Bug, das passiert nach dem erfolgreichen Issuance. Backend reagiert korrekt mit 400/404 auf die Wiederholungs-Requests.
- **Adress-Disclosures bei VP weiterhin defekt** – auf SPRIND-Wallet-Fix warten, kein Workaround unsererseits möglich

### MDVM- und PID-Issuer-Probleme im Sandbox

Anfang Mai gab's mehrere SPRIND-Backend-Regressions (MDVM Attestation, BDR PID-Issuer Token-URL). Diese sind aktuell behoben, aber **wenn beim Migrationstest plötzlich PID-Verifikation oder PID-Ausstellung im BDR Demo nicht funktioniert: zuerst im SPRIND-Forum nach aktuellen Backend-Issues schauen** bevor man den eigenen Code verdächtigt.

---

## Verifikations-Checkliste nach Migration

Nach Anwenden dieses Deltas sollte folgendes funktionieren:

- [ ] `GET /.well-known/openid-credential-issuer` listet **beide** Credential-Konfigurationen
- [ ] `POST /issuer/initiate` mit `credentialType: "genossenschaft-mitglied"` erzeugt eine valide Session
- [ ] Issuance einer Genossenschafts-Mitgliedsbescheinigung läuft end-to-end durch (Token, Nonce, Credential alle 200)
- [ ] Wallet zeigt korrekten Titel "Genossenschafts-Mitgliedsbescheinigung" im Consent-Screen
- [ ] Credential-Karte in der Wallet hat grünen Hintergrund (`#1A7F5A`) zur Unterscheidung von der blauen Wohnungsgeberbestätigung
- [ ] Mock-Daten kommen korrekt durch: `cooperative_name: "Berliner Wohnungsbaugenossenschaft eG"`, `membership_number: "BWG-2026-04217"`, `member_since: "2026-03-15"`

---

## Zusammenfassung kumulativ (16. April → 4. Mai)

Wenn du mit der Cookie-Cutter-Migration komplett bei null anfängst, bekommst du den Gesamtüberblick aus:

1. [`SPEC-eudi-wallet-service.md`](./SPEC-eudi-wallet-service.md) – aktuelle vollständige Spezifikation
2. [`MIGRATION-DELTA-2026-04-28.md`](./MIGRATION-DELTA-2026-04-28.md) – Issuance-Metadata-Fixes (display, nonce_endpoint, authorization_endpoint, proof_types_supported, tx_code-Format)
3. **dieses Doc** – Genossenschafts-Mitglied + optionale Debug-Hilfen
