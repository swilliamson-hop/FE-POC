// Normalizes ALLCAPS PID field values to Title Case ("ERIKA" → "Erika",
// "MARIA-CHRISTINE" → "Maria-Christine", "HEIDESTRAßE" → "Heidestraße").
export function titleCaseFromCaps(s: string | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .split(/([\s-])/)
    .map((part) =>
      /[\s-]/.test(part) || part.length === 0
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join('');
}

// Splits the combined SD-JWT-VC PID `street_address` ("HEIDESTRAßE 17") into
// street and house number. The OIDC address claim keeps them in one string,
// so the split is heuristic: last whitespace-separated token starting with a
// digit is treated as the number (supports "12a", "12-14", "12/A").
export function splitStreetAddress(s: string | undefined): {
  street: string;
  houseNumber: string;
} {
  if (!s) return { street: '', houseNumber: '' };
  const trimmed = s.trim();
  const m = trimmed.match(/^(.+?)\s+([0-9][0-9a-zA-Z\-/\s]*)$/);
  if (!m) return { street: trimmed, houseNumber: '' };
  return { street: m[1].trim(), houseNumber: m[2].trim() };
}
