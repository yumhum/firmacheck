interface MapyGeocodeResponse {
  items?: Array<{ position?: { lat: number, lon: number } }>
}

/**
 * Geocodes an address string via the Mapy.cz REST API.
 * Returns coordinates, or null if no result / no key / request fails.
 */
export async function geocode(query: string): Promise<{ lat: number, lon: number } | null> {
  const apiKey = useRuntimeConfig().mapyApiKey as string
  if (!apiKey) {
    console.warn('[mapy] NUXT_MAPY_API_KEY not configured, skipping geocoding')
    return null
  }

  try {
    const url = new URL('https://api.mapy.cz/v1/geocode')
    url.searchParams.set('query', query)
    url.searchParams.set('lang', 'cs')
    url.searchParams.set('limit', '1')

    const res = await fetch(url, {
      headers: { 'X-Mapy-Api-Key': apiKey },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      console.warn(`[mapy] geocode error: ${res.status}`)
      return null
    }

    const data = await res.json() as MapyGeocodeResponse
    const pos = data.items?.[0]?.position
    if (!pos) return null
    return { lat: pos.lat, lon: pos.lon }
  }
  catch (error) {
    console.warn(`[mapy] geocode failed for "${query}": ${(error as Error).message}`)
    return null
  }
}
