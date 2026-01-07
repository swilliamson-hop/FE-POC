export interface AddressSuggestion {
  displayName: string;
  street: string;
  houseNumber: string;
  zipCode: string;
  city: string;
  bundesland: string;
  country: string;
}

interface NominatimResult {
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  if (query.length < 3) {
    return [];
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: query,
          format: 'json',
          addressdetails: '1',
          countrycodes: 'de',
          limit: '5',
        }),
      {
        headers: {
          'Accept-Language': 'de',
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const results: NominatimResult[] = await response.json();

    return results.map((result) => ({
      displayName: result.display_name,
      street: result.address.road || '',
      houseNumber: result.address.house_number || '',
      zipCode: result.address.postcode || '',
      city:
        result.address.city ||
        result.address.town ||
        result.address.village ||
        result.address.municipality ||
        '',
      bundesland: result.address.state || '',
      country: result.address.country_code?.toUpperCase() || 'DE',
    }));
  } catch (error) {
    console.error('Address search failed:', error);
    return [];
  }
}
