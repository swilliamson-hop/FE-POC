# SPRIND Bug Report – Address Sub-Field Disclosure (2026-06-15)

Update zum bekannten Adress-Bug. **Die Wallet-UI wurde gefixt – die Disclosure-Logik nicht.** Status nach Test mit `IDGo/59` (vorher `IDGo/55`).

## Was sich gegenüber dem Mai-Report geändert hat

| | Mai 2026 (IDGo/55) | Juni 2026 (IDGo/59) |
|---|---|---|
| Consent-Screen | nur 3 Felder sichtbar (Name, Vorname, Geburtsdatum) | **7 Felder** sichtbar inkl. Straße/PLZ/Stadt/Wohnsitzland |
| Backend disclosed claims | 3 | **3** (unverändert) |
| User-Erwartung vs. Realität | konsistent (User sieht nur was er bekommt) | **inkonsistent** (User glaubt, er teilt Adresse, tut es aber nicht) |

Die UI-Verbesserung allein macht den Bug schlimmer: der Consent-Screen suggeriert dem Nutzer, er teile seine Adresse, der RP bekommt sie aber nicht. Privacy-Theater.

## Evidenz

### 1. Wallet-UI – behauptet 7 Felder zu teilen

`wallet-consent-screen.png` – „Diese Daten werden erfasst: 7 from 13 of Deutsche PID" mit den vier Adress-Feldern (Postleitzahl 51147, KÖLN, HEIDESTRAßE 17, DE) plus Familienname/Geburtsdatum/Vorname.

### 2. Wallet-Log – kennt die Adress-Felder

Auszug aus `eudi-ios-wallet-logs.txt`:

```
2026-06-15T09:45:20 OpenId4VpService : Verifier requested items:
  ["urn:eudi:pid:de:1": ["": ["given_name", "family_name", "birthdate",
   "address.street_address", "address.postal_code",
   "address.locality", "address.country"]]]

2026-06-15T09:45:39 OpenId4VpService : Openid4vp request items:
  ["F0523040-...": ["": ["postal_code", "locality", "street_address",
   "country", "family_name", "birthdate", "given_name"]]]
```

→ Die Wallet hat die DCQL-Anfrage korrekt geparst (`address.street_address` etc.), die Felder im Consent-Screen angezeigt und in der internen „Openid4vp request items"-Liste vermerkt. Sie weiß also exakt, was sie senden müsste.

### 3. RP-Backend (Railway-Log) – sieht nur 3 Disclosures

Aus dem `extractPidClaims`-Pfad in `eudi-wallet-service/src/lib/pid.ts`:

```
[PID-DIAG] Total credential parts: 5, disclosure parts: 3
[PID-DIAG] Disclosure #0: WyJUMGlYOHVvZHU2M3VaM1N6...
           → ["T0iX8uodu63uZ3SzAxHeNA","family_name","MUSTERMANN"]
[PID-DIAG] Disclosure #1: WyJTbGdvYUtxNWxsa09OMXo4...
           → ["SlgoaKq5llkON1z8ha0WbQ","given_name","ERIKA"]
[PID-DIAG] Disclosure #2: WyItTEVzVklNbE5RSzIzUlJ0...
           → ["-LEsVIMlNQK23RRtsQjNbw","birthdate","1964-08-12"]
```

3 Disclosure-Parts im SD-JWT. Keine davon enthält ein Adress-Sub-Feld. Saubere `[salt, name, value]`-Triples, kein exotisches rekursives Sub-Object-Encoding.

### 4. PID-Credential erlaubt mehr

Issuer-JWT-Payload (preprod.pid-provider.bundesdruckerei.de) enthält ein `_sd`-Array mit **10–11 Hash-Einträgen** – also genug Slots für sämtliche Pflichtfelder der DE-PID inklusive Adress-Subfelder. Strukturell ist auf Issuer-Seite alles vorhanden.

```json
{
  "_sd": [
    "P38BM9mgCJyX5G7ezZeDxWIFeyYl2dMp6qvkYbge554",
    "3DGUjwQt482ViVv7Gg2TXxm2Rs1KJFtXqUih5Z0ZPDk",
    "1wjgPAwLpXxkzaOUZgmpaizthpjkIAvmixppasx4x48",
    "QveraM3ClkBHR0kZFvPkpYUIdraIhva05dlOcfm38_E",
    "q8E9yiOCf9xmCpkN1QzV-Ln8TDNUqelZsQRVLiICpcA",
    "Yw0S3DQJtGFRPILOvVbC0xnFJd_pcy_f0jc0BeCsrbE",
    "n4ix7iu_74bsrOvXXL5pHkqYXAONreb1cvEC35S-BII",
    "dZYmr99yu35N_Ghqydw0nYswNqzp7ea_BYzNK37ob30",
    "OE5PcQArJKxrIZ5zhyzlGQ0PwH3KB9BKUxT7-o60axk",
    "n60qFPm-O1rJmWhWHHvlaeyOKOvNC-CF1_F2vq3Db6g",
    "1dIMw6c_9eVFEYWH6CWxgEHD6N6t_ayWzg_XgAiRDBU"
  ],
  "vct": "urn:eudi:pid:de:1",
  "iss": "https://preprod.pid-provider.bundesdruckerei.de",
  "_sd_alg": "sha-256",
  ...
}
```

## Diagnose

| Mögliche Fehlerquelle | Ausgeschlossen durch |
|---|---|
| Unsere DCQL-Anfrage falsch formuliert | Wallet-Log Z. 09:45:20 zeigt korrekte Interpretation der `address.<feld>`-Pfade |
| Unser SD-JWT-Parser defekt | Alle 3 ankommenden Disclosures werden sauber dekodiert; kein Encoding-Mismatch sichtbar |
| Credential enthält Adresse nicht | `_sd`-Array hat 11 Einträge → Slots für mehr als die übertragenen 3 Felder |

Bleibt: **Selective-Disclosure-Logik der Wallet für Sub-Object-Claims**. Die Wallet entscheidet auf welche Disclosures sie ins SD-JWT packt – und packt die Adress-Felder konsistent nicht ein, obwohl sie im Consent-Screen so tut.

## Reproduktion

ERICA-Sandbox-Test (siehe `../ERICA-TEST-2026-05-05.md`) sendet bei identischer DCQL-Anfrage eine compliant Response mit dem `address`-Objekt als einzelner Disclosure inkl. allen Sub-Feldern. Unser Code verarbeitet das korrekt. → der Bug ist deterministisch in der DE-Sandbox-Wallet IDGo/59 reproduzierbar, nicht in einer compliant Wallet.

```bash
# Live-Reproduktion gegen den Production-RP:
curl -X POST https://fe-poc-production.up.railway.app/initiate \
  -H "Content-Type: application/json" -d '{}'
# liefert eine walletUrl; mit IDGo/59 öffnen, Bewerbungsflow durchspielen,
# Railway-Logs zeigen [PID] Disclosed claim names: 3 statt 7.
```

## Anhänge

- `wallet-consent-screen.png` – Screenshot der Wallet-UI mit den 7 Feldern
- `eudi-ios-wallet-logs.txt` – Wallet-Log mit „request items"-Listing
- `railway-log-excerpt.txt` – Backend-Log mit Disclosure-Dump
