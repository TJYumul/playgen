import { useState } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card, CardContent } from "../components/ui/card"
import {
  Search,
  Play,
  ChevronLeft,
  ChevronRight,
  Pause,
} from "lucide-react"

import { Sidebar, SidebarProvider } from "../components/ui/sidebar"
import MusicPlayerBar from "../components/musicplayerbar"

type Song = {
  id: string
  title: string
  artist: string
  duration: string
  image?: string
  plays?: string
}

function SongCard({
  song,
  isTrending = false,
}: {
  song: Song
  isTrending?: boolean
}) {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-700/50 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer group overflow-hidden">
      <CardContent className="p-0 flex flex-col h-full">
        <div className="relative overflow-hidden bg-gray-800 aspect-square">
          <img
            src={song.image || "/placeholder.png"}
            alt={song.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />

          <Button
            size="icon"
            onClick={() => setIsPlaying(!isPlaying)}
            className="absolute bottom-2 right-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 scale-0 group-hover:scale-100"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="p-3 flex-1 flex flex-col">
          <p className="text-white font-semibold text-sm line-clamp-2">
            {song.title}
          </p>
          <p className="text-gray-400 text-xs mt-1">{song.artist}</p>

          {isTrending && song.plays && (
            <p className="text-purple-400 text-xs mt-1">
              {song.plays} plays
            </p>
          )}

          <p className="text-gray-500 text-xs mt-auto">
            {song.duration}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("")

  // 🔹 Replace these with real API data later
  const recommendedSongs: Song[] = []
  const recentlyPlayed: Song[] = []
  const trendingSongs: Song[] = []

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    console.log("Search:", searchQuery)
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-950">
        <Sidebar />

        <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-6 pb-24 space-y-10 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
          {/* Search */}
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs, artists, or genres..."
                className="pl-12 h-12 rounded-full bg-gray-800/50 border-gray-700/50 text-white placeholder:text-gray-400"
              />
            </form>
          </div>

          {/* Sections */}
          <Section
            title="Recommended For You"
            songs={recommendedSongs}
          />

          <Section
            title="Recently Played"
            songs={recentlyPlayed}
          />

          <Section
            title="Top Trending Now"
            songs={trendingSongs}
            trending
          />
        </main>
        </div>

        <MusicPlayerBar />
      </div>
    </SidebarProvider>
  )
}

function Section({
  title,
  songs,
  trending = false,
}: {
  title: string
  songs: Song[]
  trending?: boolean
}) {
  if (songs.length === 0) {
    return null
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white text-2xl font-bold">{title}</h2>
        <Button variant="ghost" className="text-purple-400">
          See All
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {songs.map((song) => (
          <SongCard
            key={song.id}
            song={song}
            isTrending={trending}
          />
        ))}
      </div>
    </section>
  )
}
