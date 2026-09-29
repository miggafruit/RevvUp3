/**
 * An uploaded (Cloudinary) or otherwise direct video file can be played
 * inline with expo-video's VideoView; an external page like a YouTube
 * watch link cannot — handing VideoView a webpage URL just fails
 * silently. This is a simple, good-enough heuristic rather than an
 * exhaustive check: Cloudinary URLs and direct file links are treated
 * as playable in-app; everything else is treated as an external link
 * to open instead.
 */
export const isPlayableVideoUrl = (url?: string | null): boolean =>
  !!url && (url.includes('cloudinary.com') || /\.(mp4|mov|webm|m3u8)(\?|$)/i.test(url));
