(() => {
    'use strict';

    const API_BASE_URL = 'https://phim.nguonc.com/api/film/';
    const CATALOGUES_URL = 'data/api-catalogues.json';
    const CACHE_TTL_MS = 20 * 60 * 1000;
    const DEFAULT_OPTIONS = {
        concurrency: 4,
        retries: 2,
        retryDelayMs: 700,
        timeoutMs: 12000
    };

    let cataloguesPromise;

    const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

    function validateCatalogues(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Danh mục phim API không hợp lệ.');
        }

        return Object.fromEntries(
            Object.entries(data)
                .filter(([, group]) => Array.isArray(group?.slugs))
                .map(([key, group]) => [key, {
                    title: String(group.title || key),
                    slugs: [...new Set(group.slugs.filter((slug) => typeof slug === 'string' && slug.trim()))]
                }])
        );
    }

    async function loadCatalogues({ forceReload = false } = {}) {
        if (!cataloguesPromise || forceReload) {
            cataloguesPromise = fetch(CATALOGUES_URL, { cache: 'no-store' })
                .then((response) => {
                    if (!response.ok) throw new Error(`Không thể tải danh mục phim API (${response.status}).`);
                    return response.json();
                })
                .then(validateCatalogues)
                .catch((error) => {
                    cataloguesPromise = null;
                    throw error;
                });
        }

        return cataloguesPromise;
    }

    async function getCatalogueForSlug(slug) {
        const catalogues = await loadCatalogues();
        return Object.values(catalogues).find((catalogue) => catalogue.slugs.includes(slug)) || null;
    }

    async function getRelatedSlugs(slug, limit = 6) {
        const catalogue = await getCatalogueForSlug(slug);
        if (!catalogue) return [];

        const currentIndex = catalogue.slugs.indexOf(slug);
        const orderedSlugs = [
            ...catalogue.slugs.slice(currentIndex + 1),
            ...catalogue.slugs.slice(0, currentIndex)
        ];
        return orderedSlugs.slice(0, limit);
    }

    function readCache(slug) {
        try {
            const cached = JSON.parse(sessionStorage.getItem(`movie-api:${slug}`));
            if (!cached || Date.now() - cached.savedAt > CACHE_TTL_MS) return null;
            return { ...cached.movie, slug };
        } catch {
            return null;
        }
    }

    function writeCache(slug, movie) {
        try {
            sessionStorage.setItem(`movie-api:${slug}`, JSON.stringify({ savedAt: Date.now(), movie }));
        } catch {
            // The page remains usable when browser storage is unavailable.
        }
    }

    function isRetriableStatus(status) {
        return status === 408 || status === 429 || status >= 500;
    }

    async function fetchMovie(slug, options = {}) {
        const settings = { ...DEFAULT_OPTIONS, ...options };
        const cachedMovie = readCache(slug);
        if (cachedMovie) return cachedMovie;

        let lastError;
        for (let attempt = 0; attempt <= settings.retries; attempt += 1) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), settings.timeoutMs);

            try {
                const response = await fetch(`${API_BASE_URL}${encodeURIComponent(slug)}`, {
                    signal: controller.signal
                });

                if (!response.ok) {
                    const error = new Error(`Không thể tải ${slug} (HTTP ${response.status})`);
                    error.retriable = isRetriableStatus(response.status);
                    throw error;
                }

                const data = await response.json();
                if (!data?.movie) {
                    const error = new Error(`API không trả dữ liệu cho ${slug}`);
                    error.retriable = false;
                    throw error;
                }

                const movie = { ...data.movie, slug };
                writeCache(slug, movie);
                return movie;
            } catch (error) {
                lastError = error;
                const canRetry = error.name === 'AbortError' || error.retriable !== false;
                if (!canRetry || attempt === settings.retries) break;

                const backoff = settings.retryDelayMs * (2 ** attempt);
                await wait(backoff + Math.floor(Math.random() * 250));
            } finally {
                clearTimeout(timeoutId);
            }
        }

        throw lastError || new Error(`Không thể tải ${slug}`);
    }

    async function loadMovies(slugs, options = {}) {
        const settings = { ...DEFAULT_OPTIONS, ...options };
        const results = new Array(slugs.length);
        let nextIndex = 0;

        async function worker() {
            while (nextIndex < slugs.length) {
                const currentIndex = nextIndex;
                nextIndex += 1;
                const slug = slugs[currentIndex];

                try {
                    results[currentIndex] = { slug, movie: await fetchMovie(slug, settings), error: null };
                } catch (error) {
                    console.warn(`Không thể tải phim ${slug}:`, error);
                    results[currentIndex] = { slug, movie: null, error };
                }
            }
        }

        const workerCount = Math.min(Math.max(1, settings.concurrency), slugs.length);
        await Promise.all(Array.from({ length: workerCount }, worker));
        return results;
    }

    window.MovieApiLoader = {
        fetchMovie,
        loadMovies,
        loadCatalogues,
        getCatalogueForSlug,
        getRelatedSlugs
    };
})();
