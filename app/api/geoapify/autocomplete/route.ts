import { NextRequest, NextResponse } from "next/server"

type GeoapifyResult = {
  place_id?: string
  formatted?: string
  address_line1?: string
  address_line2?: string
  city?: string
  town?: string
  village?: string
  suburb?: string
  county?: string
  state?: string
  postcode?: string
  country?: string
}

const resolveCity = (result: GeoapifyResult) =>
  result.city ||
  result.town ||
  result.village ||
  result.suburb ||
  result.county ||
  result.state ||
  ""

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const text = searchParams.get("text")?.trim() || ""
  const limit = searchParams.get("limit")?.trim() || "5"

  if (!text || text.length < 3) {
    return NextResponse.json({ results: [] })
  }

  const apiKey = process.env.GEOAPIFY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Geoapify API key not configured" }, { status: 500 })
  }

  try {
    const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete")
    url.searchParams.set("text", text)
    url.searchParams.set("format", "json")
    url.searchParams.set("limit", limit)
    url.searchParams.set("lang", "en")
    url.searchParams.set("filter", "countrycode:gb")
    url.searchParams.set("apiKey", apiKey)

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "CleanManager/1.0",
      },
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Geoapify request failed" }, { status: 502 })
    }

    const data = await response.json()
    const results = Array.isArray(data?.results)
      ? data.results.map((result: GeoapifyResult) => ({
          id: result.place_id || result.formatted || `${result.address_line1 || ""}-${result.postcode || ""}`,
          label: result.formatted || result.address_line1 || "",
          address: result.address_line1 || result.formatted || "",
          addressLine2: result.address_line2 || "",
          city: resolveCity(result),
          postcode: result.postcode || "",
          country: result.country || "United Kingdom",
        }))
      : []

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Geoapify autocomplete error:", error)
    return NextResponse.json({ error: "Geoapify request failed" }, { status: 500 })
  }
}
