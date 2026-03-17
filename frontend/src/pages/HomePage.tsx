import { useMemo, useState } from "react"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card"
import { Slider } from "../components/ui/slider"
import { Skeleton } from "../components/ui/skeleton"
import {
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "../components/ui/sidebar"
import MusicPlayerBar from "../components/musicplayerbar"

type Track = {
  id: string
  title: string
  artist: string
  audio_url?: string
  cover_url?: string
}

type MoodState = {
  electronicAcoustic: number
  energeticMellow: number
  happySad: number
  danceableChill: number
}

function clamp01to100(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.min(100, Math.max(0, Math.round(value)))
}

function MoodSliderRow({
  leftLabel,
  rightLabel,
  value,
  onChange,
}: {
  leftLabel: string
  rightLabel: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-sidebar-foreground/80 truncate">
          {leftLabel} / {rightLabel}
        </p>
        <p className="text-xs text-sidebar-foreground/60 tabular-nums">{value}</p>
      </div>
      <Slider
        value={[value]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => onChange(clamp01to100(v?.[0] ?? 50))}
      />

      <div className="flex items-center justify-between text-[10px] text-sidebar-foreground/50 leading-none">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("")

  const [mood, setMood] = useState<MoodState>({
    electronicAcoustic: 50,
    energeticMellow: 50,
    happySad: 50,
    danceableChill: 50,
  })

  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [generatedTracks, setGeneratedTracks] = useState<Track[]>([])

  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return generatedTracks
    return generatedTracks.filter((t) => {
      const hay = `${t.title} ${t.artist}`.toLowerCase()
      return hay.includes(q)
    })
  }, [generatedTracks, searchQuery])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
  }

  const handleGeneratePlaylist = async () => {
    setIsGenerating(true)
    setGenerateError(null)

    try {
      const res = await fetch("/api/tracks?limit=75", {
        method: "GET",
        headers: { Accept: "application/json" },
      })

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(
          `Failed to generate playlist: ${res.status} ${res.statusText} ${body}`
        )
      }

      const json = await res.json()
      if (!Array.isArray(json)) {
        throw new Error("Invalid /api/tracks response: expected an array")
      }

      const tracks = json as Track[]
      setGeneratedTracks(tracks)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      setGenerateError(message)
      setGeneratedTracks([])
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <SidebarProvider>
      <Sidebar className="border-r border-sidebar-border">
        <SidebarHeader className="p-4">
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
            <SidebarTrigger className="text-sidebar-foreground/80 hover:text-sidebar-foreground" />
          </div>

          <form onSubmit={handleSearchSubmit} className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebar-foreground/50" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search songs or artists"
              className="pl-10 h-10 rounded-full bg-sidebar-accent/40 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50"
            />
          </form>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent className="p-2">
          <SidebarGroup>
            <SidebarGroupLabel>4D Mood</SidebarGroupLabel>
            <SidebarGroupContent className="space-y-4">
              <MoodSliderRow
                leftLabel="Electronic"
                rightLabel="Acoustic"
                value={mood.electronicAcoustic}
                onChange={(v) => setMood((m) => ({ ...m, electronicAcoustic: v }))}
              />
              <MoodSliderRow
                leftLabel="Energetic"
                rightLabel="Mellow"
                value={mood.energeticMellow}
                onChange={(v) => setMood((m) => ({ ...m, energeticMellow: v }))}
              />
              <MoodSliderRow
                leftLabel="Happy"
                rightLabel="Sad"
                value={mood.happySad}
                onChange={(v) => setMood((m) => ({ ...m, happySad: v }))}
              />
              <MoodSliderRow
                leftLabel="Danceable"
                rightLabel="Chill"
                value={mood.danceableChill}
                onChange={(v) => setMood((m) => ({ ...m, danceableChill: v }))}
              />

              <Button
                type="button"
                onClick={() => void handleGeneratePlaylist()}
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {isGenerating ? "Generating…" : "Generate Playlist"}
              </Button>

              <div className="text-xs text-sidebar-foreground/60 leading-relaxed">
                <p className="text-sidebar-foreground/80 font-medium">Current mood</p>
                <p>
                  EA {mood.electronicAcoustic} • EM {mood.energeticMellow} • HS {mood.happySad} • DC {mood.danceableChill}
                </p>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="bg-background">
        <header className="flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="mr-1" />
            <Button variant="ghost" size="icon">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
        </header>

        <main className="flex-1 overflow-y-auto p-6 pb-24">
          <div className="max-w-5xl mx-auto">
            <Card className="bg-card/80 border-border backdrop-blur-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-white text-2xl">Generated Playlist</CardTitle>
                <CardDescription>
                  Adjust the 4D mood in the sidebar, then generate.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {generateError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-foreground">
                    {generateError}
                  </div>
                ) : null}

                {isGenerating ? (
                  <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-3 w-1/2" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : generatedTracks.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-foreground font-medium">No playlist yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Set your mood, then click “Generate Playlist”.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground pb-2">
                      <p>{filteredTracks.length} tracks</p>
                      {searchQuery.trim() ? <p>Filtered</p> : null}
                    </div>

                    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {filteredTracks.map((t, idx) => (
                        <div
                          key={t.id}
                          className="flex items-center gap-3 px-4 py-3 bg-background/40 hover:bg-background/60 transition-colors"
                        >
                          <p className="w-6 text-xs text-muted-foreground tabular-nums">
                            {String(idx + 1).padStart(2, "0")}
                          </p>
                          <img
                            src={t.cover_url || "/placeholder.svg"}
                            alt=""
                            className="h-10 w-10 rounded object-cover bg-muted"
                            loading="lazy"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-foreground text-sm font-medium truncate">{t.title}</p>
                            <p className="text-muted-foreground text-xs truncate">{t.artist}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>

        <MusicPlayerBar />
      </SidebarInset>
    </SidebarProvider>
  )
}
