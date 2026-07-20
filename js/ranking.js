(() => {
    'use strict';

    const STORAGE_KEY = 'movie-favourite-ranking-v1';
    const SEARCH_LIMIT = 12;
    const TYPE_LABELS = {
        music: 'Nhạc',
        anime: 'Anime',
        tvshow: 'TV Show',
        movie: 'Phim'
    };

    const rankingList = document.getElementById('rankingList');
    const rankingCount = document.getElementById('rankingCount');
    const clearRankingButton = document.getElementById('clearRanking');
    const searchInput = document.getElementById('rankingSearch');
    const searchStatus = document.getElementById('rankingSearchStatus');
    const candidatesContainer = document.getElementById('rankingCandidates');

    let localCatalogue = [];
    let ranking = readRanking();
    let searchTimer;
    let searchVersion = 0;

    const normalise = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u0111/g, 'd')
        .replace(/\u0110/g, 'D')
        .toLocaleLowerCase('vi-VN')
        .trim();

    function readRanking() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            return Array.isArray(saved) ? saved.filter((item) => item?.id && item?.title) : [];
        } catch {
            return [];
        }
    }

    function saveRanking() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ranking));
        } catch (error) {
            console.error('Không thể lưu BXH:', error);
        }
    }

    function toLocalRecord(movie) {
        return {
            id: `local:${movie.video}`,
            kind: 'local',
            title: movie.title,
            type: TYPE_LABELS[movie.type] || movie.type || 'Video',
            description: movie.desc || '',
            image: movie.image,
            video: movie.video
        };
    }

    function toApiRecord(movie, groupTitle) {
        return {
            id: `api:${movie.slug}`,
            kind: 'api',
            title: movie.name || movie.origin_name || movie.slug,
            type: groupTitle || 'Phim',
            description: movie.origin_name || movie.original_name || '',
            image: movie.thumb_url || movie.poster_url || 'image/Flash.png',
            slug: movie.slug
        };
    }

    function getDetailUrl(item) {
        return item.kind === 'api'
            ? `detail.html?slug=${encodeURIComponent(item.slug)}`
            : `detail.html?video=${encodeURIComponent(item.video)}`;
    }

    function createIconButton(iconClass, label, disabled, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ranking-action';
        button.disabled = disabled;
        button.setAttribute('aria-label', label);
        button.innerHTML = `<i class="fa-solid ${iconClass}" aria-hidden="true"></i>`;
        button.addEventListener('click', onClick);
        return button;
    }

    function renderRanking() {
        rankingList.replaceChildren();
        rankingCount.textContent = ranking.length
            ? `${ranking.length} phim trong BXH của bạn`
            : 'Chưa có phim nào';
        clearRankingButton.hidden = ranking.length === 0;

        if (!ranking.length) {
            const empty = document.createElement('li');
            empty.className = 'ranking-empty';
            empty.textContent = 'Hãy tìm và thêm phim đầu tiên của bạn ở khung bên phải.';
            rankingList.append(empty);
            return;
        }

        ranking.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'ranking-item';

            const position = document.createElement('span');
            position.className = `ranking-position ranking-position-${Math.min(index + 1, 3)}`;
            position.textContent = String(index + 1);

            const image = document.createElement('img');
            image.className = 'ranking-poster';
            image.src = item.image;
            image.alt = '';
            image.loading = 'lazy';

            const info = document.createElement('div');
            info.className = 'ranking-info';
            const title = document.createElement('a');
            title.href = getDetailUrl(item);
            title.textContent = item.title;
            const meta = document.createElement('span');
            meta.textContent = item.type;
            info.append(title, meta);
            if (item.description) {
                const description = document.createElement('small');
                description.textContent = item.description;
                info.append(description);
            }

            const actions = document.createElement('div');
            actions.className = 'ranking-actions';
            actions.append(
                createIconButton('fa-arrow-up', `Đưa ${item.title} lên`, index === 0, () => moveItem(index, -1)),
                createIconButton('fa-arrow-down', `Đưa ${item.title} xuống`, index === ranking.length - 1, () => moveItem(index, 1)),
                createIconButton('fa-xmark', `Xóa ${item.title} khỏi BXH`, false, () => removeItem(item.id))
            );

            listItem.append(position, image, info, actions);
            rankingList.append(listItem);
        });
    }

    function addItem(item) {
        if (ranking.some((rankedItem) => rankedItem.id === item.id)) {
            searchStatus.textContent = 'Phim này đã có trong BXH.';
            return;
        }

        ranking = [item, ...ranking];
        saveRanking();
        renderRanking();
        searchStatus.textContent = `Đã thêm “${item.title}” vào hạng #1.`;
        renderCandidates(searchInput.value.trim());
    }

    function moveItem(index, direction) {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= ranking.length) return;

        [ranking[index], ranking[targetIndex]] = [ranking[targetIndex], ranking[index]];
        saveRanking();
        renderRanking();
    }

    function removeItem(id) {
        ranking = ranking.filter((item) => item.id !== id);
        saveRanking();
        renderRanking();
        renderCandidates(searchInput.value.trim());
    }

    function scoreItem(item, queryTerms) {
        const text = normalise(`${item.title} ${item.description} ${item.type} ${item.slug || ''}`);
        return queryTerms.every((term) => text.includes(term));
    }

    async function findCandidates(query) {
        const queryTerms = normalise(query).split(/\s+/).filter(Boolean);
        if (!queryTerms.length) return [];

        const localMatches = localCatalogue
            .map(toLocalRecord)
            .filter((item) => scoreItem(item, queryTerms));

        if (normalise(query).length < 3) return localMatches.slice(0, SEARCH_LIMIT);

        const apiLoader = window.MovieApiLoader;
        const catalogues = await apiLoader.loadCatalogues();
        const apiCandidates = Object.values(catalogues)
            .flatMap((group) => group.slugs.map((slug) => ({ slug, group })))
            .filter(({ slug }) => scoreItem({ title: '', description: '', type: '', slug }, queryTerms))
            .slice(0, SEARCH_LIMIT);

        if (!apiCandidates.length) return localMatches.slice(0, SEARCH_LIMIT);

        const groupBySlug = new Map(apiCandidates.map((candidate) => [candidate.slug, candidate.group.title]));
        const apiResults = await apiLoader.loadMovies(apiCandidates.map((candidate) => candidate.slug), { concurrency: 3 });
        return [
            ...localMatches,
            ...apiResults.filter((result) => result.movie).map((result) => toApiRecord(result.movie, groupBySlug.get(result.slug)))
        ].slice(0, SEARCH_LIMIT);
    }

    function renderCandidates(query) {
        const version = ++searchVersion;
        clearTimeout(searchTimer);
        candidatesContainer.replaceChildren();

        if (!query) {
            searchStatus.textContent = '';
            return;
        }

        searchStatus.textContent = 'Đang tìm phim…';
        searchTimer = setTimeout(async () => {
            try {
                const candidates = await findCandidates(query);
                if (version !== searchVersion) return;

                candidatesContainer.replaceChildren();
                if (!candidates.length) {
                    searchStatus.textContent = 'Không tìm thấy phim phù hợp.';
                    return;
                }

                searchStatus.textContent = `${candidates.length} kết quả có thể thêm vào BXH.`;
                candidates.forEach((item) => {
                    const candidate = document.createElement('article');
                    candidate.className = 'ranking-candidate';
                    const image = document.createElement('img');
                    image.src = item.image;
                    image.alt = '';
                    image.loading = 'lazy';
                    const text = document.createElement('div');
                    const title = document.createElement('strong');
                    title.textContent = item.title;
                    const type = document.createElement('span');
                    type.textContent = item.type;
                    text.append(title, type);
                    const addButton = document.createElement('button');
                    addButton.type = 'button';
                    addButton.className = 'ranking-add-button';
                    const exists = ranking.some((rankedItem) => rankedItem.id === item.id);
                    addButton.textContent = exists ? 'Đã thêm' : 'Thêm';
                    addButton.disabled = exists;
                    addButton.addEventListener('click', () => addItem(item));
                    candidate.append(image, text, addButton);
                    candidatesContainer.append(candidate);
                });
            } catch (error) {
                console.error('Không thể tìm phim cho BXH:', error);
                if (version === searchVersion) searchStatus.textContent = 'Không thể tải danh mục lúc này.';
            }
        }, 180);
    }

    function loadFooter() {
        fetch('footer.html')
            .then((response) => response.text())
            .then((html) => {
                const footer = document.getElementById('footer');
                if (footer) footer.innerHTML = html;
            })
            .catch((error) => console.error('Không thể tải footer:', error));
    }

    searchInput.addEventListener('input', () => renderCandidates(searchInput.value.trim()));
    clearRankingButton.addEventListener('click', () => {
        if (!window.confirm('Bạn có muốn xóa toàn bộ BXH yêu thích không?')) return;
        ranking = [];
        saveRanking();
        renderRanking();
        renderCandidates(searchInput.value.trim());
    });

    fetch('data/movies.json', { cache: 'no-store' })
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then((movies) => {
            localCatalogue = Array.isArray(movies) ? movies : [];
        })
        .catch((error) => console.error('Không thể tải danh mục cục bộ:', error));

    loadFooter();
    renderRanking();
})();
