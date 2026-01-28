"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import { CompanyProfileForm } from "@/components/profile/company-profile-form"
import { UserProfileForm } from "@/components/profile/user-profile-form"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"

function ProfileTabsContent() {
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") || "company"

  return (
    <Tabs defaultValue={tab} className="space-y-6">
      <TabsList>
        <TabsTrigger value="company">Company Details</TabsTrigger>
        <TabsTrigger value="account">My Account</TabsTrigger>
      </TabsList>

      <TabsContent value="company" className="space-y-6">
        <CompanyProfileForm />
      </TabsContent>

      <TabsContent value="account" className="space-y-6">
        <UserProfileForm />
      </TabsContent>

    </Tabs>
  )
}

export function ProfileTabs() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-96 w-full" />
      </div>
    }>
      <ProfileTabsContent />
    </Suspense>
  )
}
