import { NextRequest, NextResponse } from "next/server"

// GET /api/geocode?address=...
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")

  if (!address) {
    return NextResponse.json({ error: "Address is required" }, { status: 400 })
  }

  try {
    const encodedAddress = encodeURIComponent(address)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`,
      {
        headers: {
          "User-Agent": "CleanManager/1.0",
        },
      }
    )

    if (!res.ok) {
      return NextResponse.json({ error: "Geocoding failed" }, { status: 502 })
    }

    const data = await res.json()
    if (!data || data.length === 0) {
      return NextResponse.json({ result: null })
    }

    return NextResponse.json({
      result: {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      },
    })
  } catch (error) {
    console.error("Geocoding error:", error)
    return NextResponse.json({ error: "Geocoding failed" }, { status: 500 })
  }
}
