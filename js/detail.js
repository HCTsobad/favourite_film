(() => {
    'use strict';

    const TYPE_LABELS = {
        music: 'Âm nhạc',
        anime: 'Anime',
        tvshow: 'TV Show',
        movie: 'Phim'
    };
    const detailContainer = document.getElementById('movieDetail');
    const params = new URLSearchParams(window.location.search);

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const textOnly = (value) => String(value || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const listNames = (values) => (Array.isArray(values) ? values : [])
        .map((value) => value?.name || value)
        .filter(Boolean)
        .join(', ');

    function renderError(message) {
        detailContainer.innerHTML = `
            <div class="detail-error">
                <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
                <h1>Không thể mở nội dung</h1>
                <p>${escapeHtml(message)}</p>
                <a class="detail-secondary-button" href="index.html">Về trang chủ</a>
            </div>`;
    }

    function toLocalMovie(item) {
        return {
            id: item.video,
            title: item.title,
            originalName: TYPE_LABELS[item.type] || 'Nội dung yêu thích',
            poster: item.image,
            description: item.desc || 'Nội dung này chưa có phần mô tả.',
            badge: TYPE_LABELS[item.type] || 'Video',
            facts: [
                ['Phân loại', TYPE_LABELS[item.type] || 'Video'],
                ['Trạng thái', 'Sẵn sàng phát'],
                ['Nguồn', 'Danh mục yêu thích']
            ],
            watchUrl: `player.html?video=${encodeURIComponent(item.video)}`,
            relatedType: item.type,
            relatedKey: item.video,
            episodes: []
        };
    }

    function toApiMovie(movie, slug) {
        const episodes = movie.episodes?.[0]?.items || [];
        return {
            id: slug,
            title: movie.name || 'Chưa có tên',
            originalName: movie.origin_name || movie.original_name || '',
            poster: movie.poster_url || movie.thumb_url || 'image/Flash.png',
            description: textOnly(movie.description) || textOnly(movie.content) || 'Nội dung này chưa có phần mô tả.',
            badge: movie.type || 'Phim',
            facts: [
                ['Năm phát hành', movie.year],
                ['Thời lượng', movie.time],
                ['Trạng thái', movie.current_episode || movie.total_episodes],
                ['Chất lượng', movie.quality],
                ['Ngôn ngữ', movie.lang],
                ['Thể loại', listNames(movie.category)],
                ['Quốc gia', listNames(movie.country)]
            ].filter(([, value]) => value),
            watchUrl: `player.html?slug=${encodeURIComponent(slug)}`,
            relatedType: '',
            relatedKey: '',
            episodes: episodes.map((episode, index) => ({
                name: episode.name || index + 1,
                url: `player.html?slug=${encodeURIComponent(slug)}&episode=${index + 1}`
            }))
        };
    }

    function renderRelated(items) {
        if (!items.length) return '';

        return `
            <section class="detail-related" aria-labelledby="related-title">
                <div class="detail-section-heading">
                    <h2 id="related-title">Có thể bạn cũng thích</h2>
                    <a href="index.html">Xem thêm</a>
                </div>
                <div class="related-grid">
                    ${items.map((item) => `
                        <a class="related-card" href="detail.html?video=${encodeURIComponent(item.video)}">
                            <img src="${escapeHtml(item.image)}" alt="" loading="lazy">
                            <span>${escapeHtml(item.title)}</span>
                        </a>`).join('')}
                </div>
            </section>`;
    }

    function renderMovie(movie, relatedItems = []) {
        document.title = `${movie.title} | Movie Favourite`;
        const facts = movie.facts.map(([label, value]) => `
            <div class="detail-fact">
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value)}</dd>
            </div>`).join('');
        const episodeSection = movie.episodes.length ? `
            <section class="detail-episodes" aria-labelledby="episodes-title">
                <div class="detail-section-heading">
                    <h2 id="episodes-title">Danh sách tập</h2>
                    <span>${movie.episodes.length} tập</span>
                </div>
                <div class="episode-grid">
                    ${movie.episodes.map((episode) => `
                        <a class="episode-link" href="${episode.url}">Tập ${escapeHtml(episode.name)}</a>`).join('')}
                </div>
            </section>` : '';

        detailContainer.innerHTML = `
            <article class="detail-hero">
                <div class="detail-backdrop" aria-hidden="true">
                    <img src="${escapeHtml(movie.poster)}" alt="">
                </div>
                <div class="detail-hero-overlay"></div>
                <div class="detail-content">
                    <img class="detail-poster" src="${escapeHtml(movie.poster)}" alt="Poster ${escapeHtml(movie.title)}">
                    <div class="detail-summary">
                        <p class="detail-breadcrumb"><a href="index.html">Trang chủ</a><span>/</span>${escapeHtml(movie.badge)}</p>
                        <span class="detail-badge">${escapeHtml(movie.badge)}</span>
                        <h1>${escapeHtml(movie.title)}</h1>
                        ${movie.originalName ? `<p class="detail-original-name">${escapeHtml(movie.originalName)}</p>` : ''}
                        <dl class="detail-facts">${facts}</dl>
                        <div class="detail-actions">
                            <a class="detail-watch-button" href="${movie.watchUrl}"><i class="fa-solid fa-play" aria-hidden="true"></i>Xem ngay</a>
                            <a class="detail-secondary-button" href="index.html"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i>Quay lại</a>
                        </div>
                    </div>
                </div>
            </article>
            <section class="detail-description" aria-labelledby="description-title">
                <h2 id="description-title">Nội dung phim</h2>
                <p>${escapeHtml(movie.description)}</p>
            </section>
            ${episodeSection}
            ${renderRelated(relatedItems)}`;
    }

    async function loadLocalMovie(video) {
        const response = await fetch('data/movies.json');
        if (!response.ok) throw new Error('Không thể tải danh mục nội dung.');

        const catalogue = await response.json();
        const item = catalogue.find((movie) => movie.video === video);
        if (!item) throw new Error('Nội dung bạn chọn không còn trong danh mục.');

        const related = catalogue
            .filter((movie) => movie.type === item.type && movie.video !== item.video)
            .slice(0, 4);
        renderMovie(toLocalMovie(item), related);
    }

    async function loadApiMovie(slug) {
        const response = await fetch(`https://phim.nguonc.com/api/film/${encodeURIComponent(slug)}`);
        if (!response.ok) throw new Error('Không thể tải thông tin phim từ nguồn dữ liệu.');

        const data = await response.json();
        if (!data.movie) throw new Error('Không tìm thấy thông tin phim.');
        renderMovie(toApiMovie(data.movie, slug));
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

    const video = params.get('video');
    const slug = params.get('slug');
    loadFooter();

    if (video) {
        loadLocalMovie(video).catch((error) => {
            console.error(error);
            renderError(error.message);
        });
    } else if (slug) {
        loadApiMovie(slug).catch((error) => {
            console.error(error);
            renderError(error.message);
        });
    } else {
        renderError('Hãy chọn một bộ phim từ danh mục để xem thông tin chi tiết.');
    }
})();
