import { useState } from "react";
import { Link } from "react-router-dom"; // ✅ replace next/link
import { Music, ChevronRight, Radio, Headphones, Zap } from "lucide-react"; // example icons
import { Button } from "../components/ui/button"; 

export default function LandingPage() {
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-2xl font-bold">
          <Music className="w-8 h-8 text-purple-500" />
          <span>Limul Player</span>
        </div>
        <Link to="/login">
          <Button variant="ghost" className="text-white hover:text-purple-400">
            Sign In
          </Button>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-6xl lg:text-7xl font-bold leading-tight mb-6">
            Your Music,{" "}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-500 bg-clip-text text-transparent">
              Your Style
            </span>
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-xl">
            Discover millions of songs, create custom playlists, and share your favorite tracks with friends worldwide.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/login">
              <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all">
                Start Listening
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Button
              variant="outline"
              className="border-gray-700 text-white hover:bg-gray-900 px-8 py-6 text-lg rounded-full bg-transparent"
            >
              Learn More
            </Button>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="relative h-96 lg:h-full">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl"></div>
          <div className="relative bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-3xl p-8 backdrop-blur-sm border border-purple-500/20 h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center shadow-2xl">
                <Music className="w-16 h-16 text-black" />
              </div>
              <p className="text-gray-300 text-lg">Stream your favorite music anytime, anywhere</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-center mb-16">Why Choose Limul Player?</h2>
        <div className="grid md:grid-cols-3 gap-8">
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

      {/* CTA Section */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h3 className="text-4xl font-bold mb-6">Ready to start your music journey?</h3>
        <p className="text-xl text-gray-400 mb-8">
          Join millions of music lovers and discover your new favorite artist today.
        </p>
        <Link to="/login">
          <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-10 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all">
            Get Started Now
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-4 flex items-center gap-2">
                <Music className="w-5 h-5 text-purple-500" />
                Limul Player
              </h4>
              <p className="text-gray-400 text-sm">Your music streaming platform</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Pricing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-900 pt-8 text-center text-gray-400 text-sm">
            <p>&copy; 2025 Limul Player. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-8 rounded-2xl bg-gradient-to-br from-gray-900/50 to-black/50 border border-gray-800 hover:border-purple-500/50 transition-all hover:bg-gray-900/70 group cursor-pointer">
      <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mb-4 group-hover:shadow-lg group-hover:shadow-purple-500/50 transition-all text-white">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 group-hover:bg-clip-text transition-all">
        {title}
      </h3>
      <p className="text-gray-400 group-hover:text-gray-300 transition-colors">{description}</p>
    </div>
  );
}
