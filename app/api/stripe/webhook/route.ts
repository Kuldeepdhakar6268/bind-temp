import { NextRequest, NextResponse } from "next/server"
import { db, schema } from "@/lib/db"
import { stripe } from "@/lib/stripe"
import { eq } from "drizzle-orm"
import Stripe from "stripe"

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const body = await request.text()
    const signature = request.headers.get("stripe-signature")!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error("Webhook signature verification failed:", err)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const companyId = parseInt(session.metadata?.companyId || "0")
        const planKey = session.metadata?.planKey

        if (companyId && planKey) {
          await db
            .update(schema.companies)
            .set({
              subscriptionPlan: planKey,
              subscriptionStatus: "active",
              stripeSubscriptionId: session.subscription as string,
              trialEndsAt: null,
              updatedAt: new Date(),
            })
            .where(eq(schema.companies.id, companyId))
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription
        const companyId = parseInt(subscription.metadata?.companyId || "0")

        if (companyId) {
          let status = "active"
          if (subscription.status === "past_due") status = "past_due"
          if (subscription.status === "canceled") status = "canceled"
          if (subscription.status === "unpaid") status = "unpaid"

          await db
            .update(schema.companies)
            .set({
              subscriptionStatus: status,
              updatedAt: new Date(),
            })
            .where(eq(schema.companies.id, companyId))
        }
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const companyId = parseInt(subscription.metadata?.companyId || "0")

        if (companyId) {
          await db
            .update(schema.companies)
            .set({
              subscriptionPlan: "free",
              subscriptionStatus: "canceled",
              stripeSubscriptionId: null,
              updatedAt: new Date(),
            })
            .where(eq(schema.companies.id, companyId))
        }
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // Find company by stripe customer ID
        const company = await db.query.companies.findFirst({
          where: eq(schema.companies.stripeCustomerId, customerId),
        })

        if (company) {
          await db
            .update(schema.companies)
            .set({
              subscriptionStatus: "active",
              updatedAt: new Date(),
            })
            .where(eq(schema.companies.id, company.id))
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        const company = await db.query.companies.findFirst({
          where: eq(schema.companies.stripeCustomerId, customerId),
        })

        if (company) {
          await db
            .update(schema.companies)
            .set({
              subscriptionStatus: "past_due",
              updatedAt: new Date(),
            })
            .where(eq(schema.companies.id, company.id))
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}

