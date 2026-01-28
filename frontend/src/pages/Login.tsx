import { Button } from "../components/ui/button"
import { Music } from "lucide-react"
import { Link, Navigate } from "react-router-dom"
import { supabase } from "../supabase"
import { useAuth } from "../components/AuthProvider"

export default function LoginPage() {
  const { session, loading } = useAuth()

  // If already logged in, redirect
  if (!loading && session) {
    return <Navigate to="/home" replace />
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/home",
      },
    })
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-10 sm:mb-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-2xl font-bold mb-6 sm:mb-8 hover:text-purple-400 transition"
          >
            <Music className="w-8 h-8 text-purple-500" />
            <span>Limul Player</span>
          </Link>

          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Welcome Back</h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Sign in with Google to continue
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-8 sm:my-10">
          <div className="flex-1 h-px bg-gray-700" />
          <span className="text-gray-500 text-sm">Continue with</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        {/* Google Login */}
        <Button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          variant="outline"
          className="w-full border-gray-700 text-gray-300 hover:bg-gray-900 hover:text-white h-12 rounded-lg transition-all bg-transparent"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>
      </div>
    </div>
  )
}
