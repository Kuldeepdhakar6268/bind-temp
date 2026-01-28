"use client"

import { useState, Suspense, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle, Building2, User, Mail, AlertCircle, Eye, EyeOff } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get("registered")
  const verified = searchParams.get("verified")
  const loginTypeParam = searchParams.get("type")

  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState("")
  const [requiresVerification, setRequiresVerification] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [loginType, setLoginType] = useState<"company" | "employee">("company")
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const emailRef = useRef<HTMLInputElement | null>(null)
  const usernameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (loginTypeParam === "employee" || loginTypeParam === "company") {
      setLoginType(loginTypeParam)
    }
  }, [loginTypeParam])

  useEffect(() => {
    if (loginType === "company") {
      emailRef.current?.focus()
    } else {
      usernameRef.current?.focus()
    }
    setShowPassword(false)
  }, [loginType])

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    setError("")
    setRequiresVerification(false)
    setResendSuccess(false)
  }

  const handleResendVerification = async () => {
    if (!formData.email) return
    
    setResendLoading(true)
    setResendSuccess(false)
    
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      })
      
      if (response.ok) {
        setResendSuccess(true)
      }
    } catch (err) {
      // Silent fail
    } finally {
      setResendLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setRequiresVerification(false)
    setResendSuccess(false)

    // Validate based on login type
    if (loginType === "company") {
      if (!formData.email || !formData.password) {
        setError("Please fill in all fields")
        return
      }
    } else {
      if (!formData.username || !formData.password) {
        setError("Please fill in all fields")
        return
      }
    }

    setLoading(true)

    try {
      const endpoint = loginType === "company" ? "/api/auth/signin" : "/api/auth/employee-signin"
      const body = loginType === "company"
        ? { email: formData.email, password: formData.password }
        : { username: formData.username, password: formData.password }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.requiresVerification) {
          setRequiresVerification(true)
          setError("Please verify your email before signing in")
        } else {
          setError(data.error || `Invalid ${loginType === "company" ? "email" : "email or username"} or password`)
        }
      } else {
        // Use hard redirect for employee login to ensure cookie is sent
        if (loginType === "employee") {
          window.location.href = data.redirectTo || "/employee"
        } else {
          router.push("/")
          router.refresh()
        }
      }
    } catch (err) {
      setError("An error occurred during login")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>

          {/* Login Type Toggle */}
          <Tabs value={loginType} onValueChange={(value) => setLoginType(value as "company" | "employee")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Company
              </TabsTrigger>
              <TabsTrigger value="employee" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Employee
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {registered && (
            <Alert className="mb-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                Account created successfully! Please check your email to verify your account.
              </AlertDescription>
            </Alert>
          )}

          {verified && (
            <Alert className="mb-4 border-emerald-500 bg-emerald-50 dark:bg-emerald-950">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                Email verified successfully! You can now sign in.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && !requiresVerification && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {requiresVerification && (
              <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  <div className="space-y-2">
                    <p>Please verify your email before signing in.</p>
                    <p className="text-sm">Check your inbox for a verification link.</p>
                    {resendSuccess ? (
                      <p className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Verification email sent!
                      </p>
                    ) : (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={handleResendVerification}
                        disabled={resendLoading}
                        className="mt-2"
                      >
                        {resendLoading ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="mr-2 h-3 w-3" />
                            Resend verification email
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Conditional Fields Based on Login Type */}
            {loginType === "company" ? (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  disabled={loading}
                  required
                  ref={emailRef}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="username">Email or username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="name@company.com or john.doe"
                  value={formData.username}
                  onChange={(e) => handleChange("username", e.target.value)}
                  disabled={loading}
                  required
                  ref={usernameRef}
                  className="font-mono"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {loginType === "company" && (
                  <Link
                    href="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          {loginType === "company" && (
            <p className="text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
