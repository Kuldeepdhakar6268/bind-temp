import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
  typescript: true,
})

export const SUBSCRIPTION_PLANS = {
  starter: {
    name: "Starter",
    description: "Perfect for small cleaning businesses",
    price: 19,
    priceId: process.env.STRIPE_STARTER_PRICE_ID || "",
    features: [
      "Up to 5 employees",
      "100 customers",
      "Job scheduling",
      "Basic invoicing",
      "Email support",
    ],
    limits: {
      employees: 5,
      customers: 100,
    },
  },
  professional: {
    name: "Professional",
    description: "For growing cleaning companies",
    price: 49,
    priceId: process.env.STRIPE_PRO_PRICE_ID || "",
    features: [
      "Up to 25 employees",
      "Unlimited customers",
      "Advanced scheduling",
      "Quotes & contracts",
      "Route optimization",
      "Customer portal",
      "Priority support",
    ],
    limits: {
      employees: 25,
      customers: -1, // unlimited
    },
    popular: true,
  },
  enterprise: {
    name: "Enterprise",
    description: "For large cleaning operations",
    price: 99,
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "",
    features: [
      "Unlimited employees",
      "Unlimited customers",
      "All Professional features",
      "Multi-location support",
      "Custom integrations",
      "API access",
      "Dedicated support",
      "Custom onboarding",
    ],
    limits: {
      employees: -1,
      customers: -1,
    },
  },
}

export type PlanKey = keyof typeof SUBSCRIPTION_PLANS
