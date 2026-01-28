import { useState } from "react"
import { Link } from "react-router-dom"
import { Music, ChevronRight, Radio, Headphones, Zap } from "lucide-react"
import { Button } from "../components/ui/button"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="flex items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center gap-2 text-lg sm:text-2xl font-bold">
          <Music className="w-6 h-6 sm:w-8 sm:h-8 text-purple-500" />
          <span>Limul Player</span>
        </div>

        <Link to="/login">
          <Button
            variant="ghost"
            className="text-sm sm:text-base text-white hover:text-purple-400"
          >
            Sign In
          </Button>
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold leading-tight mb-6">
            Your Music,{" "}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 bg-clip-text text-transparent">
              Your Style
            </span>
          </h1>

          <p className="text-sm sm:text-lg text-gray-400 mb-8 max-w-xl">
            Discover millions of songs, create custom playlists, and share your
            favorite tracks with friends worldwide.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/login" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-8 py-6 text-base sm:text-lg rounded-full shadow-lg hover:shadow-xl transition-all">
                Start Listening
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>

            <Button
              variant="outline"
              className="w-full sm:w-auto border-gray-700 text-white hover:bg-gray-900 px-8 py-6 text-base sm:text-lg rounded-full bg-transparent"
            >
              Learn More
            </Button>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="relative h-64 sm:h-80 lg:h-[420px]">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl" />
          <div className="relative h-full bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-3xl p-6 sm:p-8 backdrop-blur-sm border border-purple-500/20 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center shadow-2xl">
                <Music className="w-12 h-12 sm:w-16 sm:h-16 text-black" />
              </div>
              <p className="text-gray-300 text-sm sm:text-lg">
                Stream your favorite music anytime, anywhere
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 sm:mb-16">
          Why Choose Limul Player?
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Radio className="w-8 h-8" />}
            title="Unlimited Streaming"
            description="Access millions of songs from artists around the world"
          />
          <FeatureCard
            icon={<Headphones className="w-8 h-8" />}
            title="Custom Playlists"
            description="Create and organize your favorite tracks your way"
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="Fast & Responsive"
            description="Lightning-fast streaming with zero lag"
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
        <h3 className="text-2xl sm:text-4xl font-bold mb-6">
          Ready to start your music journey?
        </h3>

        <p className="text-base sm:text-xl text-gray-400 mb-8">
          Join millions of music lovers and discover your new favorite artist
          today.
        </p>

        <Link to="/login">
          <Button className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-10 py-6 text-base sm:text-lg rounded-full shadow-lg hover:shadow-xl transition-all">
            Get Started Now
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <FooterCol title="Limul Player">
              <p className="text-gray-400 text-sm">
                Your music streaming platform
              </p>
            </FooterCol>

            <FooterCol title="Product">
              <FooterLink text="Features" />
              <FooterLink text="Pricing" />
            </FooterCol>

            <FooterCol title="Company">
              <FooterLink text="About" />
              <FooterLink text="Contact" />
            </FooterCol>

            <FooterCol title="Legal">
              <FooterLink text="Privacy" />
              <FooterLink text="Terms" />
            </FooterCol>
          </div>

          <div className="border-t border-gray-900 pt-6 text-center text-gray-400 text-sm">
            &copy; 2025 Limul Player. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-8 rounded-2xl bg-gradient-to-br from-gray-900/50 to-black/50 border border-gray-800 hover:border-purple-500/50 transition-all hover:bg-gray-900/70 group cursor-pointer">
      <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mb-4 text-white">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 group-hover:bg-clip-text transition-all">
        {title}
      </h3>
      <p className="text-gray-400">{description}</p>
    </div>
  )
}

function FooterCol({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h4 className="font-bold mb-4">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function FooterLink({ text }: { text: string }) {
  return (
    <a href="#" className="block text-gray-400 text-sm hover:text-white transition">
      {text}
    </a>
  )
}
