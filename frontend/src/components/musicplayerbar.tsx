import { useState, useEffect } from "react"
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

export default function MusicPlayerBar() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration] = useState(240) // seconds
  const [volume, setVolume] = useState([75])
  const [isMuted, setIsMuted] = useState(false)
  const [isLiked, setIsLiked] = useState(false)

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Simulated playback timer (safe for Vite / browser)
  useEffect(() => {
    if (!isPlaying) return

    const interval = window.setInterval(() => {
      setCurrentTime((prev) => (prev < duration ? prev + 1 : 0))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isPlaying, duration])

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-zinc-800 p-3 z-50">
      <div className="flex items-center justify-between gap-4">
        {/* Now Playing */}
        <div className="flex items-center gap-3 w-[30%] min-w-0">
          <img
            src="/placeholder.svg"
            alt="Album cover"
            className="w-14 h-14 rounded object-cover"
          />

          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">
              Midnight Dreams
            </p>
            <p className="text-zinc-400 text-xs truncate">
              Luna Eclipse
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
            <IconButton icon={<SkipBack className="w-5 h-5" />} />

            <Button
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-9 h-9 bg-white text-black hover:bg-gray-200"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </Button>

            <IconButton icon={<SkipForward className="w-5 h-5" />} />
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
              onValueChange={(v) => setCurrentTime(v[0])}
              className="flex-1"
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
    </div>
  )
}

function IconButton({ icon }: { icon: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-zinc-400 hover:text-white"
    >
      {icon}
    </Button>
  )
}
