interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  duration: number;
  image: string;
  video_files: PexelsVideoFile[];
}

export interface VideoEstrellasResult {
  videoUrl: string;
  posterUrl: string;
}

/**
 * Consulta la API de Pexels para obtener un video vertical de alta calidad con la búsqueda 'stars' / 'estrellas'.
 * Incluye fallback robusto por si la API alcanzara cuota o no hubiera conexión temporal.
 */
export async function obtenerVideoEstrellas(): Promise<VideoEstrellasResult> {
  const apiKey = process.env.PEXELS_API_KEY;
  const fallback: VideoEstrellasResult = {
    videoUrl:
      "https://videos.pexels.com/video-files/18184370/18184370-hd_720_1080_25fps.mp4",
    posterUrl:
      "https://images.pexels.com/videos/18184370/at-night-beauty-in-nature-landscape-shooting-stars-18184370.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630",
  };

  if (!apiKey) return fallback;

  try {
    const res = await fetch(
      "https://api.pexels.com/videos/search?query=stars&orientation=portrait&per_page=5",
      {
        headers: {
          Authorization: apiKey,
        },
        // Cache en Next.js para no consumir cuotas innecesarias
        next: { revalidate: 3600 },
      }
    );

    if (!res.ok) return fallback;

    const data = await res.json();
    const video: PexelsVideo | undefined = data.videos?.[0];
    if (!video || !video.video_files || video.video_files.length === 0) {
      return fallback;
    }

    // Seleccionar archivo vertical HD optimizado
    const file =
      video.video_files.find(
        (f) => f.quality === "hd" && f.height <= 1920 && f.height >= 720
      ) ||
      video.video_files.find((f) => f.quality === "hd") ||
      video.video_files[0];

    return {
      videoUrl: file?.link || fallback.videoUrl,
      posterUrl: video.image || fallback.posterUrl,
    };
  } catch {
    return fallback;
  }
}

