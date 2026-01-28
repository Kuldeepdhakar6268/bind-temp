import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { stripe, SUBSCRIPTION_PLANS, PlanKey } from "@/lib/stripe"
import { getSession } from "@/lib/auth"
import { eq } from "drizzle-orm"

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { planKey } = body as { planKey: PlanKey }

    if (!planKey || !SUBSCRIPTION_PLANS[planKey]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    const plan = SUBSCRIPTION_PLANS[planKey]

    // Get company
    const company = await db.query.companies.findFirst({
      where: eq(schema.companies.id, session.companyId),
    })

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Create or get Stripe customer
    let stripeCustomerId = company.stripeCustomerId

    if (!stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        email: company.email,
        name: company.name,
        metadata: {
          companyId: company.id.toString(),
        },
      })
      stripeCustomerId = stripeCustomer.id

      // Save stripe customer ID
      await db
        .update(schema.companies)
        .set({ stripeCustomerId })
        .where(eq(schema.companies.id, company.id))
    }

    // Create checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/profile?tab=subscription&success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/profile?tab=subscription&canceled=true`,
      metadata: {
        companyId: company.id.toString(),
        planKey,
      },
      subscription_data: {
        metadata: {
          companyId: company.id.toString(),
          planKey,
        },
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error("Checkout error:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}

