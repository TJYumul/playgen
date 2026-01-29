import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "./ui/button"
import { Slider } from "./ui/slider"
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  Heart,
  PictureInPicture2,
  ListMusic,
  Mic2,
} from "lucide-react"

type Track = {
  id: string
  title: string
  artist: string
  audio_url: string
  cover_url?: string
}

function logPlay(songId: string) {
  console.log("[logPlay]", { songId, at: new Date().toISOString() })
}

function logPause(songId: string) {
  console.log("[logPause]", { songId, at: new Date().toISOString() })
}

function logSkip(songId: string) {
  console.log("[logSkip]", { songId, at: new Date().toISOString() })
}

export default function MusicPlayerBar() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [songList, setSongList] = useState<Track[]>([])
  const [currentSongIndex, setCurrentSongIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const [volume, setVolume] = useState([75])
  const [isMuted, setIsMuted] = useState(false)
  const [isLiked, setIsLiked] = useState(false)


  const currentSong = useMemo(() => {
    if (currentSongIndex < 0) return null
    return songList[currentSongIndex] ?? null
  }, [songList, currentSongIndex])

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const loadSongsFromBackend = useCallback(async () => {
    try {
      const res = await fetch("/api/tracks", {
        method: "GET",
        headers: { Accept: "application/json" },
      })

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new Error(`Failed to fetch tracks: ${res.status} ${res.statusText} ${body}`)
      }

      const json = await res.json()
      if (!Array.isArray(json)) {
        throw new Error("Invalid /api/tracks response: expected an array")
      }

      const tracks = json as Track[]
      setSongList(tracks)
      setCurrentSongIndex(tracks.length ? 0 : -1)
      setIsPlaying(false)

      // Load the first track into the audio element (no autoplay).
      const audio = audioRef.current
      if (audio && tracks.length) {
        audio.src = tracks[0].audio_url
        audio.load()
      }
    } catch (err: unknown) {
      console.error("[player] loadSongsFromBackend failed", err)
      setSongList([])
      setCurrentSongIndex(-1)
      setIsPlaying(false)
    }
  }, [])

  const loadSong = useCallback((index: number) => {
    const audio = audioRef.current
    if (!audio) return
    if (!songList.length) return

    const clamped = Math.max(0, Math.min(index, songList.length - 1))
    setCurrentSongIndex(clamped)

    audio.src = songList[clamped].audio_url
    audio.load()
  }, [songList])

  const playSong = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !currentSong) return

    try {
      await audio.play()
      setIsPlaying(true)
      logPlay(currentSong.id)
    } catch (err: unknown) {
      setIsPlaying(false)
      console.error("[player] play failed", err)
    }
  }, [currentSong])

  const pauseSong = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.pause()
    setIsPlaying(false)
    if (currentSong) logPause(currentSong.id)
  }, [currentSong])

  const nextSong = useCallback(async () => {
    if (!songList.length) return

    if (currentSong) logSkip(currentSong.id)
    const nextIndex = (currentSongIndex + 1) % songList.length
    loadSong(nextIndex)

    if (isPlaying) {
      await playSong()
    }
  }, [songList.length, currentSong, currentSongIndex, loadSong, isPlaying, playSong])

  const prevSong = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !songList.length) return

    // Restart behavior: if past 3 seconds, restart.
    if (Number.isFinite(audio.currentTime) && audio.currentTime > 3) {
      audio.currentTime = 0
      if (isPlaying) await playSong()
      return
    }

    if (currentSong) logSkip(currentSong.id)
    const prevIndex = (currentSongIndex - 1 + songList.length) % songList.length
    loadSong(prevIndex)
    if (isPlaying) await playSong()
  }, [songList.length, currentSong, currentSongIndex, loadSong, isPlaying, playSong])

  // Initial load.
  useEffect(() => {
    void loadSongsFromBackend()
  }, [loadSongsFromBackend])

  // Wire audio events.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }

    const onTimeUpdate = () => {
      setCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0)
    }

    const onEnded = () => {
      // Auto-advance
      void nextSong()
    }

    const onError = () => {
      const name = currentSong?.title ? ` (${currentSong.title})` : ""
      console.error(`[player] Audio failed to load${name}.`)
      setIsPlaying(false)
    }

    audio.addEventListener("loadedmetadata", onLoadedMetadata)
    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("error", onError)

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata)
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("error", onError)
    }
  }, [currentSong?.title, nextSong])

  // Apply volume/mute.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = isMuted
    audio.volume = Math.min(Math.max(volume[0] / 100, 0), 1)
  }, [isMuted, volume])

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 p-3 z-50">
      <div className="flex items-center justify-between gap-4">
        {/* Now Playing */}
        <div className="flex items-center gap-3 w-[30%] min-w-0">
          <img
            src={currentSong?.cover_url || "/placeholder.svg"}
            alt="Album cover"
            className="w-14 h-14 rounded object-cover"
          />

          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {currentSong?.title ?? "—"}
            </p>
            <p className="text-zinc-400 text-xs truncate">
              {currentSong?.artist ?? "—"}
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsLiked(!isLiked)}
            className={`text-zinc-400 hover:text-white ${
              isLiked ? "text-green-500" : ""
            }`}
          >
            <Heart
              className={`w-4 h-4 ${
                isLiked ? "fill-current" : ""
              }`}
            />
          </Button>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-2 w-[40%]">
          <div className="flex items-center gap-3">
            <IconButton icon={<Shuffle />} />
            <IconButton
              icon={<SkipBack className="w-5 h-5" />}
              onClick={() => void prevSong()}
              disabled={!songList.length}
            />

            <Button
              size="icon"
              onClick={() => (isPlaying ? pauseSong() : void playSong())}
              disabled={!songList.length}
              className="w-9 h-9 bg-white text-black hover:bg-gray-200"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </Button>

            <IconButton
              icon={<SkipForward className="w-5 h-5" />}
              onClick={() => void nextSong()}
              disabled={!songList.length}
            />
            <IconButton icon={<Repeat />} />
          </div>

          <div className="flex items-center gap-2 w-full max-w-md">
            <span className="text-zinc-400 text-xs w-10 text-right">
              {formatTime(currentTime)}
            </span>

            <Slider
              value={[currentTime]}
              max={duration}
              step={1}
              onValueChange={(v) => {
                const audio = audioRef.current
                if (!audio) return
                const next = v[0]
                audio.currentTime = next
                setCurrentTime(next)
              }}
              className="flex-1"
              disabled={!songList.length || duration <= 0}
            />

            <span className="text-zinc-400 text-xs w-10">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Volume & Options */}
        <div className="flex items-center gap-2 w-[30%] justify-end">
          <IconButton icon={<Mic2 />} />
          <IconButton icon={<ListMusic />} />
          <IconButton icon={<PictureInPicture2 />} />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className="text-zinc-400 hover:text-white"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>

          <Slider
            value={volume}
            max={100}
            step={1}
            onValueChange={setVolume}
            className="w-24 hidden sm:block"
          />
        </div>
      </div>

      {/* Single audio element for playback */}
      <audio ref={audioRef} preload="metadata" className="hidden" />
    </div>
  )
}

function IconButton({
  icon,
  onClick,
  disabled,
}: {
  icon: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-zinc-400 hover:text-white"
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </Button>
  )
}
