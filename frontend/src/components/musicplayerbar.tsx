import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
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
  ThumbsDown,
  PictureInPicture2,
  ListMusic,
  Mic2,
} from "lucide-react"

import { useAuth } from "./AuthProvider"

type Track = {
  id: string
  title: string
  artist: string
  audio_url: string
  cover_url?: string
}

type PlayerEventType = "play" | "pause" | "skip" | "complete" | "like" | "dislike"

type PlaybackSession = {
  sessionId: string
  songId: string
  sessionStartTime: number
  sessionStartAudioTime: number
  lastAudioTime: number
  ignoredBackwardSeekSeconds: number
}

function createSessionId(): string {
  try {
    // Browser support is good, but keep a fallback.
    const cryptoAny = crypto as unknown as { randomUUID?: () => string }
    if (typeof cryptoAny?.randomUUID === "function") return cryptoAny.randomUUID()
  } catch {
    // ignore
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function safeAudioTimeSeconds(audioElement: HTMLAudioElement | null | undefined): number {
  const t = audioElement?.currentTime
  return typeof t === "number" && Number.isFinite(t) ? t : 0
}

function computeActualPlayDurationSeconds(
  audioElement: HTMLAudioElement,
  session: PlaybackSession | null,
  { backwardSeekToleranceSeconds = 2 }: { backwardSeekToleranceSeconds?: number } = {}
): number {
  if (!session) {
    const fallback = safeAudioTimeSeconds(audioElement)
    return Math.max(0, fallback)
  }

  const elapsedMs = Date.now() - session.sessionStartTime
  const elapsedSeconds = Math.max(0, elapsedMs / 1000)

  const currentAudioTime = safeAudioTimeSeconds(audioElement)
  const rawAudioProgress = currentAudioTime - session.sessionStartAudioTime

  // Optional: ignore small backward seeks by adding back a capped amount.
  const ignoredBackward =
    backwardSeekToleranceSeconds > 0
      ? Math.min(session.ignoredBackwardSeekSeconds, backwardSeekToleranceSeconds)
      : 0

  const audioProgress = Math.max(0, rawAudioProgress + ignoredBackward)
  const actualPlayDuration = Math.min(elapsedSeconds, audioProgress)

  return Math.max(0, actualPlayDuration)
}

function isValidUuid(value: unknown): value is string {
  if (typeof value !== "string") return false
  const v = value.trim()
  if (!v) return false
  // UUID versions 1-5.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export default function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { user } = useAuth()

  const playbackSessionRef = useRef<PlaybackSession | null>(null)
  const suppressNextPauseRef = useRef(false)

  const [songList, setSongList] = useState<Track[]>([])
  const [currentSongIndex, setCurrentSongIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const [volume, setVolume] = useState([75])
  const [isMuted, setIsMuted] = useState(false)
  const [isLiked, setIsLiked] = useState(false)
  const [isDisliked, setIsDisliked] = useState(false)


  const currentSong = useMemo(() => {
    if (currentSongIndex < 0) return null
    return songList[currentSongIndex] ?? null
  }, [songList, currentSongIndex])

  const logEvent = useCallback(
    async (eventType: PlayerEventType, songId: string | null | undefined) => {
      const userId = user?.id
      const timestamp = new Date().toISOString()

      if (!isValidUuid(userId)) {
        console.warn("[events] Skipping log: missing/invalid user_id", {
          eventType,
          songId,
          timestamp,
        })
        return
      }

      if (typeof songId !== "string" || songId.trim().length === 0) {
        console.warn("[events] Skipping log: missing/invalid song_id", {
          eventType,
          songId,
          timestamp,
        })
        return
      }

      const normalizedSongId = songId.trim()

      const audio = audioRef.current

      // Initialize playback session state on play.
      if (eventType === "play" && audio) {
        playbackSessionRef.current = {
          sessionId: createSessionId(),
          songId: normalizedSongId,
          sessionStartTime: Date.now(),
          sessionStartAudioTime: safeAudioTimeSeconds(audio),
          lastAudioTime: safeAudioTimeSeconds(audio),
          ignoredBackwardSeekSeconds: 0,
        }
      }

      const body: {
        user_id: string
        song_id: string
        event_type: PlayerEventType
        timestamp: string
        play_duration?: number
      } = {
        user_id: userId,
        song_id: normalizedSongId,
        event_type: eventType,
        timestamp,
      }

      // Only include play_duration for pause/skip/complete.
      // Use seek-safe "active listening" duration: min(elapsed wall time, audio progress).
      if ((eventType === "pause" || eventType === "skip" || eventType === "complete") && audio) {
        const session =
          playbackSessionRef.current && playbackSessionRef.current.songId === normalizedSongId
            ? playbackSessionRef.current
            : null

        const actualSeconds = computeActualPlayDurationSeconds(audio, session, {
          backwardSeekToleranceSeconds: 2,
        })

        body.play_duration = Math.max(0, Math.floor(actualSeconds))

        // End the current continuous session after a terminal-ish event.
        // Next play will start a new session.
        playbackSessionRef.current = null
      }

      try {
        const res = await fetch("/api/events", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        })

        const text = await res.text().catch(() => "")
        let parsed: unknown = null
        try {
          parsed = text ? JSON.parse(text) : null
        } catch {
          parsed = text
        }

        if (!res.ok) {
          console.error("[events] Backend rejected event", {
            status: res.status,
            event: body,
            response: parsed,
          })
          return
        }

        console.log("[events] Logged", {
          event: body,
          response: parsed,
        })
      } catch (err: unknown) {
        console.error("[events] Failed to log event", {
          event: body,
          error: err,
        })
      }
    },
    [user?.id]
  )

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
    } catch (err: unknown) {
      setIsPlaying(false)
      console.error("[player] play failed", err)
    }
  }, [currentSong])

  const pauseSong = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.pause()
  }, [])

  const nextSong = useCallback(async ({ reason = "user" }: { reason?: "user" | "auto" } = {}) => {
    if (!songList.length) return

    if (reason === "user" && currentSong) {
      suppressNextPauseRef.current = true
      void logEvent("skip", currentSong.id)
    }
    const nextIndex = (currentSongIndex + 1) % songList.length
    loadSong(nextIndex)

    if (isPlaying) {
      await playSong()
    }
  }, [songList.length, currentSong, currentSongIndex, loadSong, isPlaying, playSong, logEvent])

  const prevSong = useCallback(async ({ reason = "user" }: { reason?: "user" | "auto" } = {}) => {
    const audio = audioRef.current
    if (!audio || !songList.length) return

    // Restart behavior: if past 3 seconds, restart.
    if (Number.isFinite(audio.currentTime) && audio.currentTime > 3) {
      audio.currentTime = 0
      if (isPlaying) await playSong()
      return
    }

    if (reason === "user" && currentSong) {
      suppressNextPauseRef.current = true
      void logEvent("skip", currentSong.id)
    }
    const prevIndex = (currentSongIndex - 1 + songList.length) % songList.length
    loadSong(prevIndex)
    if (isPlaying) await playSong()
  }, [songList.length, currentSong, currentSongIndex, loadSong, isPlaying, playSong, logEvent])

  const onLike = useCallback(() => {
    if (!currentSong) return
    const nextLiked = !isLiked
    setIsLiked(nextLiked)
    if (nextLiked) {
      setIsDisliked(false)
      void logEvent("like", currentSong.id)
    }
  }, [currentSong, isLiked, logEvent])

  const onDislike = useCallback(() => {
    if (!currentSong) return
    const nextDisliked = !isDisliked
    setIsDisliked(nextDisliked)
    if (nextDisliked) {
      setIsLiked(false)
      void logEvent("dislike", currentSong.id)
    }
  }, [currentSong, isDisliked, logEvent])

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

      const session = playbackSessionRef.current
      if (session && session.songId === currentSong?.id) {
        const t = safeAudioTimeSeconds(audio)
        session.lastAudioTime = t
      }
    }

    const onEnded = () => {
      // Natural completion.
      void logEvent("complete", currentSong?.id)
      // Auto-advance without counting as a user skip.
      void nextSong({ reason: "auto" })
    }

    const onPlay = () => {
      setIsPlaying(true)
      void logEvent("play", currentSong?.id)
    }

    const onPause = () => {
      setIsPlaying(false)
      // Some browsers fire "pause" after "ended". Avoid double-logging.
      if (audio.ended) return

      // Switching tracks can trigger a transient pause; don't double-log.
      if (suppressNextPauseRef.current) {
        suppressNextPauseRef.current = false
        return
      }
      void logEvent("pause", currentSong?.id)
    }

    const onSeeked = () => {
      const session = playbackSessionRef.current
      if (!session) return
      if (session.songId !== currentSong?.id) return

      const nextTime = safeAudioTimeSeconds(audio)
      const prevTime = session.lastAudioTime
      if (Number.isFinite(prevTime) && nextTime < prevTime) {
        const backwardDelta = prevTime - nextTime
        // Track small backward seeks so they don't artificially reduce "active listening".
        // Large backward seeks are left as-is (they will reduce audioProgress).
        if (backwardDelta > 0 && backwardDelta <= 2) {
          session.ignoredBackwardSeekSeconds += backwardDelta
        }
      }

      session.lastAudioTime = nextTime
    }

    const onError = () => {
      const name = currentSong?.title ? ` (${currentSong.title})` : ""
      console.error(`[player] Audio failed to load${name}.`)
      setIsPlaying(false)
    }

    audio.addEventListener("loadedmetadata", onLoadedMetadata)
    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("ended", onEnded)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("seeked", onSeeked)
    audio.addEventListener("error", onError)

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata)
      audio.removeEventListener("timeupdate", onTimeUpdate)
      audio.removeEventListener("ended", onEnded)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("seeked", onSeeked)
      audio.removeEventListener("error", onError)
    }
  }, [currentSong?.id, currentSong?.title, logEvent, nextSong])

  // Apply volume/mute.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = isMuted
    audio.volume = Math.min(Math.max(volume[0] / 100, 0), 1)
  }, [isMuted, volume])

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 p-3 z-50">
      <div className="grid grid-cols-3 items-center gap-4">
        {/* Now Playing */}
        <div className="flex items-center gap-3 min-w-0">
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
            onClick={onLike}
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

          <Button
            variant="ghost"
            size="icon"
            onClick={onDislike}
            className={`text-zinc-400 hover:text-white ${
              isDisliked ? "text-red-500" : ""
            }`}
          >
            <ThumbsDown
              className={`w-4 h-4 ${
                isDisliked ? "fill-current" : ""
              }`}
            />
          </Button>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center justify-center gap-1 justify-self-center w-full max-w-md">
          <div className="flex items-center justify-center gap-3">
            <IconButton
              icon={<Shuffle className="h-3.5 w-3.5" />}
              className="text-zinc-500 hover:text-white"
            />
            <IconButton
              icon={<SkipBack className="w-5 h-5" />}
              onClick={() => void prevSong({ reason: "user" })}
              disabled={!songList.length}
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => (isPlaying ? pauseSong() : void playSong())}
              disabled={!songList.length}
              className="h-10 w-10 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:scale-105 transition-transform"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>

            <IconButton
              icon={<SkipForward className="w-5 h-5" />}
              onClick={() => void nextSong({ reason: "user" })}
              disabled={!songList.length}
            />
            <IconButton
              icon={<Repeat className="h-3.5 w-3.5" />}
              className="text-zinc-500 hover:text-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full max-w-md">
            <span className="w-10 text-right text-[11px] text-zinc-400 font-medium leading-none">
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

            <span className="w-10 text-[11px] text-zinc-400 font-medium leading-none">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Volume & Options */}
        <div className="flex items-center gap-2 justify-self-end">
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
            className="w-24 hidden sm:flex"
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
  className,
}: {
  icon: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-8 w-8 text-zinc-400 hover:text-white ${className ?? ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon}
    </Button>
  )
}
