(() => {
    'use strict';

    const RESULT_LIMIT = 30;
    const API_FETCH_LIMIT = 30;
    const SEARCH_DEBOUNCE_MS = 180;
    const TYPE_LABELS = {
        music: 'Nh\u1ea1c',
        anime: 'Anime',
        tvshow: 'TV Show',
        movie: 'Phim'
    };

    let catalogue = [];
    let currentResults = [];
    let activeIndex = -1;
    let isLoading = true;
    let searchVersion = 0;
    let searchTimer;
    let apiLoaderPromise;

    const normalise = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd')
        .replace(/\u0110/g, 'D')
        .toLocaleLowerCase('vi-VN')
        .trim();

    const getSearchTerms = (query) => normalise(query).split(/\s+/).filter(Boolean);

    function getSearchScore(item, query) {
        const title = normalise(item.title);
        const description = normalise(item.desc);
        const category = normalise(item.typeLabel || item.type);
        const indexText = normalise(item.searchText || '');

        if (!title.includes(query) && !description.includes(query)
            && !category.includes(query) && !indexText.includes(query)) {
            return -1;
        }

        if (title === query) return 100;
        if (title.startsWith(query)) return 75;
        if (title.includes(query)) return 60;
        if (indexText.includes(query)) return 50;
        if (description.includes(query)) return 25;
        return 10;
    }

    function rankMatches(items, query) {
        const searchTerms = getSearchTerms(query);
        if (!searchTerms.length) return [];

        return items
            .map((item, index) => {
                const searchableText = normalise(`${item.title} ${item.desc} ${item.type} ${item.typeLabel || ''} ${item.searchText || ''}`);
                const matchesEveryTerm = searchTerms.every((term) => searchableText.includes(term));
                return {
                    item,
                    index,
                    score: matchesEveryTerm ? getSearchScore(item, normalise(query)) : -1
                };
            })
            .filter((result) => result.score >= 0)
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .map((result) => result.item);
    }

    function findLocalMatches(query) {
        const localItems = catalogue.map((item) => ({
            ...item,
            kind: 'local',
            typeLabel: TYPE_LABELS[item.type] || item.type || 'Video'
        }));
        return rankMatches(localItems, query);
    }

    function ensureApiLoader() {
        if (window.MovieApiLoader) return Promise.resolve(window.MovieApiLoader);
        if (apiLoaderPromise) return apiLoaderPromise;

        apiLoaderPromise = new Promise((resolve, reject) => {
            const existingScript = document.querySelector('script[data-api-movie-loader]');
            const script = existingScript || document.createElement('script');

            const complete = () => {
                if (window.MovieApiLoader) {
                    resolve(window.MovieApiLoader);
                } else {
                    reject(new Error('Kh\u00f4ng th\u1ec3 kh\u1edfi t\u1ea1o danh m\u1ee5c phim API.'));
                }
            };

            if (window.MovieApiLoader) {
                complete();
                return;
            }

            script.addEventListener('load', complete, { once: true });
            script.addEventListener('error', () => reject(new Error('Kh\u00f4ng th\u1ec3 t\u1ea3i danh m\u1ee5c phim API.')), { once: true });

            if (!existingScript) {
                script.src = 'js/api-movies.js';
                script.dataset.apiMovieLoader = 'true';
                document.head.append(script);
            }
        });

        return apiLoaderPromise;
    }

    async function findApiMatches(query) {
        const normalisedQuery = normalise(query);
        if (normalisedQuery.length < 3) return [];

        const apiLoader = await ensureApiLoader();
        const catalogues = await apiLoader.loadCatalogues();
        const searchTerms = getSearchTerms(query);
        const candidates = Object.values(catalogues)
            .flatMap((group) => group.slugs.map((slug, index) => ({ slug, group, index })))
            .filter(({ slug }) => {
                const slugText = normalise(slug.replaceAll('-', ' '));
                return searchTerms.every((term) => slugText.includes(term));
            })
            .sort((a, b) => a.index - b.index)
            .slice(0, API_FETCH_LIMIT);

        if (!candidates.length) return [];

        const apiResults = await apiLoader.loadMovies(
            candidates.map((candidate) => candidate.slug),
            { concurrency: 3 }
        );
        const candidateBySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));

        return apiResults
            .filter((result) => result.movie)
            .map((result) => {
                const group = candidateBySlug.get(result.slug)?.group;
                const movie = result.movie;
                return {
                    kind: 'api',
                    slug: movie.slug,
                    title: movie.name || movie.origin_name || movie.slug,
                    desc: movie.origin_name || movie.original_name || '',
                    image: movie.thumb_url || movie.poster_url || 'image/Flash.png',
                    type: group?.title || 'Phim API',
                    typeLabel: group?.title || 'Phim API',
                    searchText: `${movie.slug} ${movie.name || ''} ${movie.origin_name || ''} ${movie.original_name || ''}`
                };
            });
    }

    function createMessage(message, className = 'result-empty') {
        const messageElement = document.createElement('p');
        messageElement.className = className;
        messageElement.textContent = message;
        return messageElement;
    }

    function openContent(item) {
        const destination = item.kind === 'api'
            ? `detail.html?slug=${encodeURIComponent(item.slug)}`
            : `detail.html?video=${encodeURIComponent(item.video)}`;
        window.location.assign(destination);
    }

    function updateActiveResult(resultContainer) {
        resultContainer.querySelectorAll('.result-item').forEach((item, index) => {
            const isActive = index === activeIndex;
            item.classList.toggle('is-active', isActive);
            item.setAttribute('aria-selected', String(isActive));
            if (isActive) item.scrollIntoView({ block: 'nearest' });
        });
    }

    function renderResultItems(results, resultContainer, summaryText) {
        resultContainer.replaceChildren();
        activeIndex = -1;
        currentResults = results;

        if (!results.length) {
            resultContainer.append(createMessage('Kh\u00f4ng t\u00ecm th\u1ea5y k\u1ebft qu\u1ea3 ph\u00f9 h\u1ee3p.'));
            return;
        }

        resultContainer.append(createMessage(summaryText, 'result-status'));
        results.forEach((movie, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'result-item';
            button.id = `search-result-${index}`;
            button.setAttribute('role', 'option');
            button.setAttribute('aria-selected', 'false');

            const image = document.createElement('img');
            image.className = 'result-thumb';
            image.src = movie.image;
            image.alt = '';
            image.loading = 'lazy';

            const details = document.createElement('span');
            details.className = 'result-details';

            const title = document.createElement('strong');
            title.className = 'result-title';
            title.textContent = movie.title;

            const meta = document.createElement('span');
            meta.className = 'result-meta';
            meta.textContent = movie.typeLabel || TYPE_LABELS[movie.type] || movie.type || 'Video';

            details.append(title, meta);
            if (movie.desc) {
                const description = document.createElement('span');
                description.className = 'result-description';
                description.textContent = movie.desc;
                details.append(description);
            }

            button.append(image, details);
            button.addEventListener('click', () => openContent(movie));
            resultContainer.append(button);
        });
    }

    function hideResults(resultContainer, input) {
        currentResults = [];
        activeIndex = -1;
        resultContainer.replaceChildren();
        resultContainer.hidden = true;
        input.setAttribute('aria-expanded', 'false');
    }

    async function renderResults(query, resultContainer, input, version) {
        const trimmedQuery = query.trim();
        if (!trimmedQuery || version !== searchVersion) return;

        resultContainer.hidden = false;
        input.setAttribute('aria-expanded', 'true');

        if (isLoading) {
            resultContainer.replaceChildren(createMessage('\u0110ang t\u1ea3i danh m\u1ee5c\u2026', 'result-status'));
            return;
        }

        const localMatches = findLocalMatches(trimmedQuery);
        renderResultItems(
            localMatches.slice(0, RESULT_LIMIT),
            resultContainer,
            localMatches.length ? '\u0110ang t\u00ecm th\u00eam phim t\u1eeb API\u2026' : '\u0110ang t\u00ecm trong danh m\u1ee5c phim\u2026'
        );

        try {
            const apiMatches = await findApiMatches(trimmedQuery);
            if (version !== searchVersion || input.value.trim() !== trimmedQuery) return;

            const allMatches = rankMatches([...localMatches, ...apiMatches], trimmedQuery).slice(0, RESULT_LIMIT);
            renderResultItems(allMatches, resultContainer, `K\u1ebft qu\u1ea3 t\u00ecm ki\u1ebfm (${allMatches.length})`);
        } catch (error) {
            console.error('Kh\u00f4ng th\u1ec3 t\u00ecm phim t\u1eeb API:', error);
            if (version !== searchVersion) return;
            renderResultItems(
                localMatches.slice(0, RESULT_LIMIT),
                resultContainer,
                `K\u1ebft qu\u1ea3 t\u00ecm ki\u1ebfm (${Math.min(localMatches.length, RESULT_LIMIT)})`
            );
        }
    }

    async function loadCatalogue() {
        const response = await fetch('data/movies.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Kh\u00f4ng th\u1ec3 t\u1ea3i danh m\u1ee5c (${response.status})`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    }

    function initialiseSearch() {
        const input = document.getElementById('searchInput');
        const resultContainer = document.getElementById('resultContainer');
        const clearButton = document.getElementById('clearSearch');
        const searchButton = document.getElementById('searchButton');
        const searchArea = document.querySelector('.catalog-search');

        if (!input || !resultContainer || !searchArea) return;

        const showResults = () => {
            const query = input.value;
            const version = ++searchVersion;
            clearButton?.toggleAttribute('hidden', !query.trim());
            clearTimeout(searchTimer);

            if (!query.trim()) {
                hideResults(resultContainer, input);
                return;
            }

            searchTimer = setTimeout(() => {
                renderResults(query, resultContainer, input, version);
            }, SEARCH_DEBOUNCE_MS);
        };

        input.addEventListener('input', showResults);
        input.addEventListener('focus', () => {
            if (input.value.trim()) showResults();
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                input.value = '';
                showResults();
                input.blur();
                return;
            }

            if (!currentResults.length || resultContainer.hidden) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
                updateActiveResult(resultContainer);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                activeIndex = Math.max(activeIndex - 1, 0);
                updateActiveResult(resultContainer);
            } else if (event.key === 'Enter' && activeIndex >= 0) {
                event.preventDefault();
                openContent(currentResults[activeIndex]);
            }
        });

        clearButton?.addEventListener('click', () => {
            input.value = '';
            showResults();
            input.focus();
        });

        searchButton?.addEventListener('click', () => {
            input.focus();
            if (input.value.trim()) showResults();
        });

        document.addEventListener('click', (event) => {
            if (!searchArea.contains(event.target)) {
                resultContainer.hidden = true;
                input.setAttribute('aria-expanded', 'false');
                activeIndex = -1;
            }
        });

        loadCatalogue()
            .then((data) => {
                catalogue = data;
                isLoading = false;
                if (input.value.trim()) showResults();
            })
            .catch((error) => {
                console.error('Kh\u00f4ng th\u1ec3 t\u1ea3i d\u1eef li\u1ec7u t\u00ecm ki\u1ebfm:', error);
                isLoading = false;
                if (input.value.trim()) {
                    resultContainer.replaceChildren(createMessage('Kh\u00f4ng th\u1ec3 t\u1ea3i danh m\u1ee5c. Vui l\u00f2ng th\u1eed l\u1ea1i sau.'));
                    resultContainer.hidden = false;
                }
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialiseSearch, { once: true });
    } else {
        initialiseSearch();
    }
})();
