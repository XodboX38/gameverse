import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Search, 
  Gamepad2, 
  Menu, 
  X, 
  Star, 
  Calendar, 
  Globe, 
  ChevronRight, 
  ChevronLeft,
  Settings, 
  ArrowLeft,
  Loader2,
  Maximize2,
  Monitor,
  Smartphone,
  ImageIcon,
  Laptop,
  ArrowRight,
  Share2,
  Check,
  WifiOff,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ==================================================================================
 * PERFORMANCE UTILS
 * ==================================================================================
 */

const API_BASE_URL = "https://api.rawg.io/api";

// Optimization: Resize RAWG images to reduce bandwidth and decode time
const getOptimizedImageUrl = (url, type = 'card') => {
  if (!url) return "https://placehold.co/600x400/1a1a1a/FFF?text=No+Image";
  if (url.includes('placehold.co')) return url;
  
  const width = type === 'hero' ? 1280 : 640;
  
  if (url.includes('/resize/')) return url;

  return url.replace('/media/', `/media/resize/${width}/-/`);
};

const preloadImage = (url) => {
  const img = new Image();
  img.src = getOptimizedImageUrl(url, 'hero');
};

const DEMO_DATA = [
  {
    id: 3498,
    name: "Grand Theft Auto V",
    background_image: "https://media.rawg.io/media/games/456/456dea5e127e3d6db5e5305b1c5f7281.jpg",
    rating: 4.47,
    released: "2013-09-17",
    genres: [{ id: 4, name: "Action" }, { id: 3, name: "Adventure" }],
    parent_platforms: [
      { platform: { id: 1, name: "PC", slug: "pc" } }, 
      { platform: { id: 2, name: "PlayStation", slug: "playstation" } }, 
      { platform: { id: 3, name: "Xbox", slug: "xbox" } }
    ],
    short_screenshots: [
      { id: 1, image: "https://media.rawg.io/media/games/456/456dea5e127e3d6db5e5305b1c5f7281.jpg" },
      { id: 2, image: "https://media.rawg.io/media/screenshots/5f5/5f5a38a222252d996b1f7b5d095447a5.jpg" }
    ],
    platforms: [
      {
        platform: { slug: "pc", name: "PC" },
        requirements: {
          minimum: "Minimum requirements...",
          recommended: "Recommended requirements..."
        }
      }
    ]
  },
  {
    id: 3328,
    name: "The Witcher 3: Wild Hunt",
    background_image: "https://media.rawg.io/media/games/618/618c2031a07bbff6b4f611f10b6bcdbc.jpg",
    rating: 4.66,
    released: "2015-05-18",
    genres: [{ id: 5, name: "RPG" }, { id: 4, name: "Action" }],
    parent_platforms: [
      { platform: { id: 1, name: "PC", slug: "pc" } }, 
      { platform: { id: 2, name: "PlayStation", slug: "playstation" } }
    ],
    short_screenshots: [],
    platforms: []
  },
  {
    id: 4200,
    name: "Portal 2",
    background_image: "https://media.rawg.io/media/games/328/3283617cb7d75d67257fc58339188742.jpg",
    rating: 4.61,
    released: "2011-04-18",
    genres: [{ id: 2, name: "Shooter" }, { id: 7, name: "Puzzle" }],
    parent_platforms: [{ platform: { id: 1, name: "PC", slug: "pc" } }],
    short_screenshots: [],
    platforms: []
  }
];

const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * ==================================================================================
 * PWA & SERVICE WORKER
 * ==================================================================================
 */
const injectServiceWorker = () => {
  if (!('serviceWorker' in navigator)) return;
  
  const swCode = `
    const CACHE_NAME = 'gameverse-v1';
    const URLS_TO_CACHE = ['/', '/index.html'];

    self.addEventListener('install', (event) => {
      self.skipWaiting();
    });

    self.addEventListener('activate', (event) => {
      event.waitUntil(clients.claim());
    });

    self.addEventListener('fetch', (event) => {
      const { request } = event;
      const url = new URL(request.url);

      // Strategy 1: Stale-While-Revalidate for API requests
      if (url.hostname.includes('api.rawg.io')) {
        event.respondWith(
          caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(request);
            const fetchPromise = fetch(request).then((networkResponse) => {
              cache.put(request, networkResponse.clone());
              return networkResponse;
            });
            return cachedResponse || fetchPromise;
          })
        );
        return;
      }

      // Strategy 2: Cache First for Images
      if (url.hostname.includes('media.rawg.io')) {
        event.respondWith(
          caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(request);
            if (cachedResponse) return cachedResponse;
            try {
              const networkResponse = await fetch(request);
              cache.put(request, networkResponse.clone());
              return networkResponse;
            } catch (e) {
              return new Response('', { status: 408, statusText: 'Request timed out.' });
            }
          })
        );
        return;
      }
    });
  `;

  const blob = new Blob([swCode], { type: 'application/javascript' });
  const swUrl = URL.createObjectURL(blob);
  navigator.serviceWorker.register(swUrl)
    .catch(err => console.log('SW registration failed: ', err));
};

const injectManifest = () => {
  const manifest = {
    name: "GameVerse",
    short_name: "GameVerse",
    start_url: "/",
    display: "standalone",
    background_color: "#111111",
    theme_color: "#8b5cf6",
    icons: [
      {
        src: "https://cdn-icons-png.flaticon.com/512/3408/3408506.png", 
        sizes: "192x192",
        type: "image/png"
      }
    ]
  };
  const stringManifest = JSON.stringify(manifest);
  const blob = new Blob([stringManifest], { type: "application/json" });
  const manifestURL = URL.createObjectURL(blob);
  
  let link = document.querySelector("link[rel='manifest']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = manifestURL;
};

/**
 * ==================================================================================
 * HOOKS
 * ==================================================================================
 */

const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return isOnline;
};

const useGameData = (apiKey, isOnline) => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [currentQuery, setCurrentQuery] = useState('trending');

  useEffect(() => {
    const cached = localStorage.getItem('gv_cached_games');
    if (cached) {
      const parsed = JSON.parse(cached);
      setGames(parsed);
      if (!apiKey) setLoading(false); 
    }
  }, []);

  const fetchTrending = useCallback(async (reset = false) => {
    if (!isOnline && !reset) { setLoading(false); return; }
    if (!apiKey) {
      if (reset && games.length === 0) {
         setGames(DEMO_DATA);
         setLoading(false);
      }
      return;
    }
    
    const nextPage = reset ? 1 : page + 1;
    if (reset) setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/games?key=${apiKey}&ordering=-added&page_size=12&page=${nextPage}`);
      if (!response.ok) throw new Error("Failed");
      const data = await response.json();
      
      setGames(prev => {
        const newGames = reset ? data.results : [...prev, ...data.results];
        if (reset) localStorage.setItem('gv_cached_games', JSON.stringify(newGames.slice(0, 12)));
        return newGames;
      });
      
      setHasMore(!!data.next);
      setPage(nextPage);
    } catch (err) {
      if (reset && games.length === 0) setGames(DEMO_DATA);
    } finally {
      setLoading(false);
    }
  }, [apiKey, isOnline, page, games.length]);

  const searchGames = useCallback(async (query, reset = false) => {
    if (!apiKey || !isOnline) return;
    const nextPage = reset ? 1 : page + 1;
    if (reset) setLoading(true);
    setCurrentQuery(query);

    try {
      const response = await fetch(`${API_BASE_URL}/games?key=${apiKey}&search=${query}&page_size=12&page=${nextPage}`);
      const data = await response.json();
      
      setGames(prev => reset ? data.results : [...prev, ...data.results]);
      setHasMore(!!data.next);
      setPage(nextPage);
    } catch (err) {
      // Error handling
    } finally {
      setLoading(false);
    }
  }, [apiKey, isOnline, page]);

  const getSuggestions = useCallback(async (query) => {
    if (!apiKey || query.length < 2 || !isOnline) return [];
    try {
      const response = await fetch(`${API_BASE_URL}/games?key=${apiKey}&search=${query}&page_size=5`);
      const data = await response.json();
      return data.results;
    } catch (err) {
      return [];
    }
  }, [apiKey, isOnline]);

  const loadMore = () => {
    if (!hasMore || loading || !isOnline) return;
    if (currentQuery === 'trending') {
      fetchTrending(false);
    } else {
      searchGames(currentQuery, false);
    }
  };

  const getGameDetails = useCallback(async (id) => {
    const cachedGame = games.find(g => g.id === id);
    if (!apiKey || !isOnline) {
      const base = cachedGame || DEMO_DATA.find(g => g.id === id) || DEMO_DATA[0];
      return { ...base, screenshots: base.short_screenshots || [] };
    }

    try {
      const [detailsRes, screenshotsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/games/${id}?key=${apiKey}`),
        fetch(`${API_BASE_URL}/games/${id}/screenshots?key=${apiKey}`)
      ]);
      const details = await detailsRes.json();
      const screenshotsData = await screenshotsRes.json();
      return { ...details, screenshots: screenshotsData.results };
    } catch (err) {
      return cachedGame ? { ...cachedGame, screenshots: cachedGame.short_screenshots || [] } : null;
    }
  }, [apiKey, isOnline, games]);

  return { games, loading, fetchTrending, searchGames, loadMore, hasMore, getGameDetails, getSuggestions };
};

/**
 * ==================================================================================
 * COMPONENTS
 * ==================================================================================
 */

const CinematicLoader = () => (
  <motion.div
    initial={{ opacity: 1 }}
    exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
    className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
  >
    <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-violet-900 via-black to-black animate-pulse" />
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative z-10 flex flex-col items-center"
    >
      <div className="bg-gradient-to-tr from-violet-600 to-indigo-600 p-4 rounded-2xl shadow-2xl shadow-violet-500/30 mb-6">
        <Gamepad2 className="text-white w-12 h-12 md:w-16 md:h-16" />
      </div>
      <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-2">
        GAME<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-indigo-500">VERSE</span>
      </h1>
    </motion.div>
  </motion.div>
);

const OfflineBanner = () => (
  <div className="fixed bottom-0 left-0 right-0 bg-red-600/90 backdrop-blur-md text-white py-3 px-4 text-center z-[90] text-xs md:text-sm font-bold flex items-center justify-center gap-2 safe-area-bottom">
    <WifiOff size={16} /> Offline Mode
  </div>
);

const ShimmerBlock = ({ className }) => (
  <div className={`relative overflow-hidden bg-white/5 ${className}`}>
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
  </div>
);

const LazyImage = ({ src, alt, className, priority = false, type = 'card' }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const optimizedSrc = useMemo(() => getOptimizedImageUrl(src, type), [src, type]);

  return (
    <div className={`relative overflow-hidden ${className} bg-[#1a1a1a]`}>
      {!isLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900">
           <ImageIcon size={32} className="text-white/20" />
        </div>
      )}
      <img
        src={optimizedSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-700 ease-in-out`}
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
};

// Mobile Optimized Game Card
const GameCard = React.memo(({ game, onClick, isFocused }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative h-[380px] md:h-[450px] rounded-2xl overflow-hidden cursor-pointer shadow-lg active:scale-95 transition-all duration-300 border border-white/5`}
      onClick={() => onClick(game.id)}
    >
      <LazyImage
        src={game.background_image}
        alt={game.name}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 md:group-hover:scale-110"
        type="card"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 flex flex-col gap-2 md:gap-3">
        <div className="flex justify-between items-start">
          <h3 className="text-xl md:text-2xl font-bold text-white leading-tight line-clamp-2 md:group-hover:text-violet-400 transition-colors drop-shadow-md">
            {game.name}
          </h3>
          <span className={`flex-shrink-0 px-2 py-1 rounded-md text-xs font-bold border backdrop-blur-md ${
            game.rating >= 4 
              ? 'bg-green-500/20 text-green-400 border-green-500/30' 
              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
          }`}>
            {game.rating}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          {game.genres?.slice(0, 3).map(g => (
            <span key={g.id} className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-white/10 text-gray-300 font-medium">
              {g.name}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
});

// Mobile Optimized Hero Slider
const HeroSlider = React.memo(({ games, onGameClick }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (games.length === 0) return;
    const nextIndex = (index + 1) % games.length;
    preloadImage(games[nextIndex].background_image);
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % games.length), 6000);
    return () => clearInterval(timer);
  }, [games, index]);

  const currentGame = games[index];
  if (!currentGame) return null;

  return (
    <div className="relative w-full h-[85vh] md:h-screen overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentGame.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="absolute inset-0"
        >
          <LazyImage
            src={currentGame.background_image}
            alt={currentGame.name}
            className="w-full h-full object-cover"
            priority={true}
            type="hero"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#111111]/80 via-transparent to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-0 left-0 w-full p-6 md:p-16 pb-20 md:pb-24 z-10 flex flex-col items-start max-w-4xl">
        <div className="flex gap-2 mb-3 md:mb-4 flex-wrap">
          {currentGame.genres?.map((g) => (
            <span key={g.id} className="px-2 py-0.5 md:px-3 md:py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] md:text-xs uppercase tracking-wider text-white border border-white/20">
              {g.name}
            </span>
          ))}
        </div>
        <h1 className="text-3xl md:text-7xl font-black text-white mb-4 md:mb-6 leading-tight drop-shadow-lg line-clamp-2">
          {currentGame.name}
        </h1>
        <button 
          onClick={() => onGameClick(currentGame.id)}
          className="px-6 py-2.5 md:px-8 md:py-3 bg-violet-600 active:bg-violet-700 text-white font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-violet-600/30 touch-manipulation"
        >
          View Details <ChevronRight size={18} />
        </button>
      </div>
      
      <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 flex gap-1.5 md:gap-2 z-20">
        {games.slice(0, 5).map((_, i) => (
          <div
            key={i}
            className={`h-1 md:h-1.5 rounded-full transition-all duration-300 shadow-sm ${i === index ? 'w-6 md:w-8 bg-violet-500' : 'w-2 bg-white/50'}`}
          />
        ))}
      </div>
    </div>
  );
});

// Mobile Optimized Detail View
const DetailView = ({ gameId, onBack, apiKey, useGameDataHook, isFavorite, toggleFavorite }) => {
  const [game, setGame] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const { getGameDetails } = useGameDataHook;
  
  useEffect(() => {
    const fetchDetails = async () => {
      setGame(null);
      const data = await getGameDetails(gameId);
      setGame(data);
    };
    fetchDetails();
  }, [gameId, getGameDetails]);

  // Handle Android back button simulation using history hash
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleShare = async () => {
    const url = `${window.location.origin}/#/game/${gameId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: game.name, url: url });
        return;
      } catch (err) {}
    }
    // Fallback
    try {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    } catch (err) {}
  };

  const handleDragEnd = (event, info) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold) {
      // Swipe Left -> Next Image
      if (photoIndex < game.screenshots.length - 1) {
        setPhotoIndex(photoIndex + 1);
      }
    } else if (info.offset.x > swipeThreshold) {
      // Swipe Right -> Previous Image
      if (photoIndex > 0) {
        setPhotoIndex(photoIndex - 1);
      }
    }
  };

  if (!game) return (
    <div className="fixed inset-0 z-50 bg-[#111111] overflow-hidden">
       <div className="h-[50vh] w-full relative">
          <ShimmerBlock className="w-full h-full" />
       </div>
    </div>
  );

  const pcPlatform = game.platforms?.find(p => p.platform.slug === 'pc');
  const requirements = pcPlatform?.requirements || {};

  return (
    <div className="fixed inset-0 z-50 bg-[#111111] overflow-y-auto overscroll-contain pb-safe">
      <div className="relative h-[60vh] md:h-[70vh]">
        <LazyImage 
          src={game.background_image} 
          className="w-full h-full object-cover" 
          alt="cover"
          type="hero"
          priority={true}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#111111] via-[#111111]/20 to-transparent" />
        
        {/* Mobile-friendly navigation buttons */}
        <button 
          onClick={onBack}
          className="absolute top-4 left-4 p-3 bg-black/40 backdrop-blur-md rounded-full text-white active:bg-white/20 transition-all z-50 border border-white/10 touch-manipulation"
        >
          <ArrowLeft size={22} />
        </button>

        <button 
          onClick={handleShare}
          className="absolute top-4 right-4 p-3 bg-black/40 backdrop-blur-md rounded-full text-white active:bg-white/20 transition-all z-50 border border-white/10 touch-manipulation"
        >
          <Share2 size={22} />
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-16">
           <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
              <h1 className="text-4xl md:text-8xl font-black text-white mb-3 drop-shadow-2xl tracking-tighter leading-none">
                {game.name}
              </h1>
              <div className="flex flex-wrap gap-3 items-center text-gray-200 font-medium text-sm md:text-lg">
                <span className="flex items-center gap-1 bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full"><Star size={14} className="text-yellow-400 fill-yellow-400" /> {game.rating}</span>
                <span className="flex items-center gap-1"><Calendar size={14} /> {game.released}</span>
                <span className="flex items-center gap-1"><Gamepad2 size={14} /> {game.playtime} hrs</span>
              </div>
           </motion.div>
        </div>
      </div>

      <div className="bg-[#111111] min-h-screen px-6 py-8 md:p-16 text-white -mt-4 relative rounded-t-3xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8 md:space-y-12 order-2 lg:order-1">
            <section>
              <h2 className="text-2xl md:text-3xl font-bold mb-4 flex items-center gap-2 text-violet-400">
                <Globe size={20}/> About
              </h2>
              <div 
                className="text-gray-300 leading-relaxed space-y-4 text-base md:text-lg font-light"
                dangerouslySetInnerHTML={{ __html: game.description || "No description available." }}
              />
            </section>
            
            {(requirements.minimum || requirements.recommended) && (
              <section className="bg-white/5 rounded-2xl p-5 md:p-8 border border-white/10">
                <h2 className="text-xl md:text-2xl font-bold mb-4 flex items-center gap-2 text-white">
                  <Laptop size={20} className="text-violet-400" /> System Requirements
                </h2>
                <div className="grid grid-cols-1 gap-6 text-xs md:text-sm leading-relaxed">
                  {requirements.minimum && (
                      <div>
                        <h3 className="font-bold text-gray-400 uppercase tracking-wider mb-1">Minimum</h3>
                        <p className="text-gray-300 whitespace-pre-line">{requirements.minimum}</p>
                      </div>
                  )}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">Gallery</h2>
              {/* Horizontal Scroll on Mobile, Grid on Desktop */}
              <div className="flex overflow-x-auto gap-3 pb-4 md:grid md:grid-cols-2 md:gap-3 md:pb-0 scrollbar-hide snap-x snap-mandatory">
                {game.screenshots?.map((shot, index) => (
                  <div 
                    key={shot.id} 
                    className="relative rounded-xl overflow-hidden cursor-pointer h-48 md:h-56 flex-shrink-0 w-[85vw] md:w-auto snap-center"
                    onClick={() => setPhotoIndex(index)}
                  >
                    <LazyImage 
                        src={shot.image} 
                        className="w-full h-full object-cover" 
                        alt="screenshot" 
                        type="card"
                    />
                    <div className="absolute inset-0 bg-black/0 active:bg-black/20 transition-colors" />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar / Quick Actions */}
          <div className="space-y-6 order-1 lg:order-2">
            <button 
              onClick={() => toggleFavorite(game)}
              className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 touch-manipulation ${isFavorite(game.id) ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white/10 text-white border border-white/10'}`}
            >
              <Heart size={20} className={isFavorite(game.id) ? "fill-current" : ""} /> 
              {isFavorite(game.id) ? 'Favorited' : 'Add to Favorites'}
            </button>

            <div className="bg-white/5 p-5 md:p-8 rounded-2xl border border-white/10 space-y-6">
               <div>
                  <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-bold">Platforms</h3>
                  <div className="flex flex-wrap gap-2">
                    {game.parent_platforms?.map(({platform}, i) => (
                      <span key={i} className="text-gray-300 text-xs bg-black/40 px-2 py-1 rounded border border-white/10">{platform.name}</span>
                    ))}
                  </div>
               </div>
               {game.metacritic && (
                 <div>
                    <h3 className="text-gray-500 text-xs uppercase tracking-wider mb-2 font-bold">Metascore</h3>
                    <div className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center font-black text-xl ${game.metacritic > 75 ? 'border-green-500 text-green-500' : 'border-yellow-500 text-yellow-500'}`}>
                      {game.metacritic}
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {photoIndex !== null && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm touch-none overflow-hidden"
                onClick={() => setPhotoIndex(null)}
            >
                {/* Dynamic Blurred Background */}
                <div className="absolute inset-0 z-[-1] overflow-hidden">
                    <motion.img 
                        key={`bg-${photoIndex}`}
                        src={getOptimizedImageUrl(game.screenshots[photoIndex].image, 'hero')}
                        className="w-full h-full object-cover blur-3xl opacity-50 scale-125"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        transition={{ duration: 0.5 }}
                    />
                    <div className="absolute inset-0 bg-black/40" />
                </div>

                <div className="absolute top-4 right-4 z-50">
                    <button onClick={() => setPhotoIndex(null)} className="p-2 bg-white/10 rounded-full text-white backdrop-blur-md hover:bg-white/20 transition-colors"><X size={24}/></button>
                </div>
                
                {/* Desktop Nav Buttons */}
                {photoIndex > 0 && (
                   <button 
                      className="absolute left-4 p-3 bg-white/10 rounded-full text-white backdrop-blur-md hidden md:block hover:bg-white/20 transition-colors z-50"
                      onClick={(e) => { e.stopPropagation(); setPhotoIndex(photoIndex - 1); }}
                   >
                     <ChevronLeft size={32}/>
                   </button>
                )}
                
                <motion.img 
                    key={photoIndex}
                    src={getOptimizedImageUrl(game.screenshots[photoIndex].image, 'hero')}
                    className="max-h-[85vh] max-w-[95vw] object-contain select-none shadow-2xl"
                    alt="fullscreen"
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={handleDragEnd}
                    initial={{ opacity: 0, scale: 0.85 }} 
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.85 }} 
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    onClick={(e) => e.stopPropagation()}
                />

                {/* Mobile Pagination Dots */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2 pointer-events-none">
                  {game.screenshots.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${idx === photoIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/30'}`} 
                    />
                  ))}
                </div>

                {photoIndex < game.screenshots.length - 1 && (
                   <button 
                      className="absolute right-4 p-3 bg-white/10 rounded-full text-white backdrop-blur-md hidden md:block hover:bg-white/20 transition-colors z-50"
                      onClick={(e) => { e.stopPropagation(); setPhotoIndex(photoIndex + 1); }}
                   >
                     <ChevronRight size={32}/>
                   </button>
                )}
            </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-bold text-sm whitespace-nowrap"
          >
            <Check size={18} /> Link Copied!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Mobile Optimized Navbar
const Navbar = React.memo(({ onViewChange, currentView, onSearch, apiKey, setApiKey, getSuggestions, onGameSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  
  const fetchSuggestions = useCallback(debounce(async (q) => {
      const results = await getSuggestions(q);
      setSuggestions(results);
  }, 300), [getSuggestions]);

  const handleSearchInput = (e) => {
    const val = e.target.value;
    setLocalSearch(val);
    if (val.length > 2) fetchSuggestions(val);
    else setSuggestions([]);
  };

  const handleProceedSearch = () => {
    if (localSearch.length > 0) {
      onSearch(localSearch);
      setIsOpen(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 z-[60] p-3 bg-black/60 backdrop-blur-md text-white rounded-full hover:bg-violet-600 active:bg-violet-700 transition-all shadow-lg border border-white/10 touch-manipulation"
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#111111]/98 backdrop-blur-xl flex flex-col pt-20 px-6"
          >
            <div className="w-full max-w-lg mx-auto space-y-8">
              <div className="relative">
                <input
                  type="text"
                  value={localSearch}
                  onChange={handleSearchInput}
                  onKeyDown={(e) => e.key === 'Enter' && handleProceedSearch()}
                  placeholder="Search games..."
                  className="w-full bg-white/10 border border-white/10 rounded-2xl py-4 pl-12 pr-14 text-white placeholder-gray-500 text-lg focus:outline-none focus:border-violet-500 transition-all"
                  style={{ fontSize: '16px' }} // Prevent iOS zoom
                />
                <Search className="absolute left-4 top-4 text-gray-400" size={24} />
                <button onClick={handleProceedSearch} className="absolute right-3 top-2.5 p-2 bg-violet-600 rounded-xl text-white"><ArrowRight size={20} /></button>
                
                {suggestions.length > 0 && (
                   <div className="mt-4 bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
                      {suggestions.map(game => (
                        <div 
                          key={game.id}
                          onClick={() => { onGameSelect(game.id); setIsOpen(false); }}
                          className="flex items-center gap-4 p-3 border-b border-white/5 last:border-0 active:bg-white/5"
                        >
                          <img src={getOptimizedImageUrl(game.background_image, 'card')} alt="" className="w-10 h-10 rounded-lg object-cover" />
                          <div className="text-white text-sm font-bold">{game.name}</div>
                        </div>
                      ))}
                   </div>
                )}
              </div>

              <div className="grid gap-3">
                <button onClick={() => { onViewChange('home'); setIsOpen(false); }} className={`p-4 rounded-xl text-left text-xl font-bold flex items-center gap-4 ${currentView === 'home' ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-300'}`}>
                  <Gamepad2 /> Home
                </button>
                <button onClick={() => { onViewChange('favorites'); setIsOpen(false); }} className={`p-4 rounded-xl text-left text-xl font-bold flex items-center gap-4 ${currentView === 'favorites' ? 'bg-violet-600 text-white' : 'bg-white/5 text-gray-300'}`}>
                  <Heart /> Favorites
                </button>
              </div>

              <div className="bg-white/5 p-4 rounded-2xl border border-white/10 mt-auto mb-8">
                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">API Key</label>
                <input 
                  type="text" 
                  value={""}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white text-sm font-mono"
                  placeholder="Enter RAWG API Key"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

/**
 * ==================================================================================
 * MAIN APP
 * ==================================================================================
 */
export default function App() {
  const [view, setView] = useState('home'); 
  const [selectedId, setSelectedId] = useState(null);
  
  // Use localStorage OR the VITE environment variable as default
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rawg_api_key') || import.meta.env.VITE_RAWG_API_KEY || '');
  
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('gv_favorites')) || []);
  
  const isOnline = useOnlineStatus();
  const hookData = useGameData(apiKey, isOnline);
  const { games, loading, fetchTrending, searchGames, loadMore, hasMore, getSuggestions } = hookData;

  useEffect(() => {
    document.documentElement.classList.add('dark');
    injectManifest();
    injectServiceWorker();
    fetchTrending(true); 
  }, [apiKey]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/game/')) {
        const id = hash.split('/')[2];
        if (id) {
          setSelectedId(parseInt(id));
          setView('details');
        }
      } else {
        setView('home');
        setSelectedId(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => { localStorage.setItem('rawg_api_key', apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem('gv_favorites', JSON.stringify(favorites)); }, [favorites]);

  const handleSearchSubmit = (query) => {
    if (query?.length > 0) {
      setView('search');
      searchGames(query, true);
    }
  };

  const openDetails = (id) => window.location.hash = `#/game/${id}`;
  const onBack = () => window.location.hash = "";
  
  const toggleFavorite = (game) => {
    if (favorites.some(f => f.id === game.id)) setFavorites(favorites.filter(f => f.id !== game.id));
    else setFavorites([...favorites, game]);
  };
  const isFavorite = (id) => favorites.some(f => f.id === id);

  return (
    <div className="min-h-screen font-sans selection:bg-violet-500/30 bg-[#111111] text-white overflow-x-hidden">
      <AnimatePresence>
        {loading && games.length === 0 && <CinematicLoader />}
      </AnimatePresence>

      {view !== 'details' && (
        <Navbar 
          onViewChange={setView} 
          currentView={view} 
          onSearch={handleSearchSubmit}
          onGameSelect={openDetails}
          apiKey={apiKey}
          setApiKey={setApiKey}
          getSuggestions={getSuggestions}
        />
      )}

      {!isOnline && <OfflineBanner />}

      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.main key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {!loading && games.length > 0 && <HeroSlider games={games.slice(0, 5)} onGameClick={openDetails} />}
            <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 flex items-center gap-3 text-white">
                <span className="w-1.5 h-6 md:h-8 bg-violet-600 rounded-full"></span>
                Trending Now
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-8 max-w-6xl mx-auto">
                {games.map((game, index) => <GameCard key={game.id} game={game} onClick={openDetails} />)}
              </div>
              {games.length > 0 && hasMore && !loading && (
                 <div className="mt-12 mb-20 md:mb-0 flex justify-center">
                    <button onClick={loadMore} className="px-6 py-3 bg-[#1a1a1a] border border-white/10 text-white font-bold rounded-full hover:bg-white/10 transition-colors shadow-sm flex items-center gap-2">Load More</button>
                 </div>
              )}
            </div>
          </motion.main>
        )}

        {view === 'search' && (
          <motion.main key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 max-w-7xl mx-auto px-4 md:px-6 min-h-screen">
            <h2 className="text-xl md:text-2xl font-bold mb-6 text-gray-400">Search results</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 max-w-6xl mx-auto pb-12">
              {games.map((game) => <GameCard key={game.id} game={game} onClick={openDetails} />)}
            </div>
          </motion.main>
        )}

        {view === 'favorites' && (
          <motion.main key="favorites" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pt-20 max-w-7xl mx-auto px-4 md:px-6 min-h-screen">
            <h2 className="text-2xl md:text-3xl font-bold mb-8 flex items-center gap-2 text-white"><Heart className="text-red-500 fill-red-500" /> My Collection</h2>
            {favorites.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 max-w-6xl mx-auto pb-12">
                {favorites.map((game) => <GameCard key={game.id} game={game} onClick={openDetails} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-700 rounded-2xl mx-4">
                <p className="text-lg font-medium">No favorites yet.</p>
              </div>
            )}
          </motion.main>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {view === 'details' && selectedId && (
          <DetailView 
            gameId={selectedId} 
            onBack={onBack} 
            apiKey={apiKey}
            useGameDataHook={hookData}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
          />
        )}
      </AnimatePresence>
    </div>
  );
}