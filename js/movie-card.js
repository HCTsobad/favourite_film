(() => {
    'use strict';

    const TYPE_LABELS = {
        music: 'Nhạc',
        anime: 'Anime',
        tvshow: 'TV Show',
        movie: 'Phim'
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    function renderCard({ image, title, originalName, quality = 'FULL', label, year = '' }) {
        return `
            <div class="movie-poster">
                <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
                <span class="movie-quality">${escapeHtml(quality)}</span>
                <span class="movie-label">${escapeHtml(label)}</span>
            </div>
            <div class="movie-info movie-card-info">
                <div class="movie-title">${escapeHtml(title)}</div>
                <div class="movie-origin">${escapeHtml(originalName || 'Đang cập nhật')}</div>
                <div class="movie-meta"><span>${escapeHtml(year)}</span></div>
            </div>`;
    }

    function local(movie) {
        return renderCard({
            image: movie.image,
            title: movie.title,
            originalName: movie.desc || TYPE_LABELS[movie.type] || 'Video',
            label: TYPE_LABELS[movie.type] || 'Video',
            year: movie.year || ''
        });
    }

    function api(movie) {
        return renderCard({
            image: movie.thumb_url || movie.poster_url || 'image/Flash.png',
            title: movie.name || movie.origin_name || 'Đang cập nhật',
            originalName: movie.original_name || movie.origin_name || 'Đang cập nhật',
            quality: movie.quality || 'FULL',
            label: movie.language || movie.lang || movie.current_episode || 'Vietsub',
            year: movie.year || ''
        });
    }

    function decorateLocal(card, movie) {
        card.innerHTML = local(movie);
    }

    function decorateApi(card, movie) {
        if (movie) {
            card.innerHTML = api(movie);
            return;
        }

        const image = card.querySelector('img')?.src || 'image/Flash.png';
        const title = card.querySelector('.movie-title')?.textContent || 'Đang cập nhật';
        const originalName = card.dataset.originalName || card.querySelector('.movie-desc')?.textContent || '';
        card.innerHTML = renderCard({
            image,
            title,
            originalName,
            quality: card.dataset.quality || 'FULL',
            label: card.dataset.label || 'Vietsub',
            year: card.dataset.year || ''
        });
    }

    window.MovieCardRenderer = { local, api, decorateLocal, decorateApi };
})();
