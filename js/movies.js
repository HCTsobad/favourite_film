async function loadSelectedMovies(retry = 0) {
    const grid = document.getElementById("movieGrid");

    // hiện spinner trước
    grid.innerHTML = `<div class="loader-container">
        <svg class="pl" width="80" height="80" viewBox="0 0 240 240">
          <circle class="pl__ring pl__ring--a" cx="120" cy="120" r="105" fill="none" stroke="#000" stroke-width="20"></circle>
          <circle class="pl__ring pl__ring--b" cx="120" cy="120" r="35" fill="none" stroke="#000" stroke-width="20"></circle>
          <circle class="pl__ring pl__ring--c" cx="85" cy="120" r="70" fill="none" stroke="#000" stroke-width="20"></circle>
          <circle class="pl__ring pl__ring--d" cx="155" cy="120" r="70" fill="none" stroke="#000" stroke-width="20"></circle>
        </svg>
        <p>Đang tải phim... (thử lại lần ${retry + 1})</p>
    </div>`;

    try {
        const catalogues = await window.MovieApiLoader.loadCatalogues();
        const slugs = catalogues.movies?.slugs || [];
        if (!slugs.length) throw new Error('Danh mục Movies đang trống.');
        const results = await window.MovieApiLoader.loadMovies(slugs, { concurrency: 4 });
        const successMovies = results.filter(result => result.movie).map(result => result.movie);
        successMovies.sort((first, second) => Number(second.year || 0) - Number(first.year || 0));

        if (successMovies.length === 0) {
            console.warn("Không tải được phim nào, thử lại...");
            if (retry < 3) { // 👈 Giới hạn số lần retry, ví dụ 3 lần
                setTimeout(() => loadSelectedMovies(retry + 1), 2000); // đợi 2s rồi thử lại
            } else {
                grid.innerHTML = "<p>Lỗi tải dữ liệu phim. Vui lòng thử lại sau.</p>";
            }
            return;
        }

        // render ra HTML
        let html = "";
        successMovies.forEach((movie) => {
            html += `
              <div class="movie-card" data-slug="${movie.slug}" data-year="${movie.year || ''}" data-quality="${movie.quality || 'FULL'}" data-label="${movie.lang || 'Vietsub'}">
                  <img src="${movie.thumb_url}" alt="${movie.name}">
                  <div class="movie-info">
                      <div class="movie-title">${movie.name}</div>
                      <div class="movie-desc">${movie.origin_name || ""}</div>
                      <p>${movie.original_name || ""}</p>
                      <p>Số tập: ${movie.total_episodes || "?"}</p>
                      <p>Thời lượng: ${movie.time || "?"}</p>
                  </div>
              </div>
            `;
        });

        grid.innerHTML = html;

        grid.querySelectorAll(".movie-card").forEach((card, index) => {
            window.MovieCardRenderer.decorateApi(card, successMovies[index]);
            card.addEventListener("click", () => {
                window.location.href = `detail.html?slug=${card.dataset.slug}`;
            });
        });

    } catch (err) {
        console.error("Lỗi load dữ liệu:", err);
        grid.innerHTML = "<p>Lỗi tải dữ liệu phim.</p>";
    }
}

// chạy khi load trang
loadSelectedMovies();

//tìm kiếm theo file json
let data = [];

async function loadData() {
    try {
        const response = await fetch('data/movies.json');
        if (!response.ok) throw new Error('Không thể tải dữ liệu JSON');
        data = await response.json();
        console.log('Dữ liệu đã load:', data);
    } catch (error) {
        console.error(error);
    }
}

async function init() {
    await loadData();

    const input = document.getElementById('searchInput');
    const resultContainer = document.getElementById('resultContainer');

    input.addEventListener('input', function () {
        const query = this.value.toLowerCase().trim();
        if (!query) {
            resultContainer.innerHTML = '';
            return;
        }

        const filtered = data.filter(item => item.title.toLowerCase().includes(query)
            ||
            (item.desc && item.desc.toLowerCase().includes(query)));

        if (filtered.length === 0) {
            resultContainer.innerHTML = '<p>Không tìm thấy kết quả nào.</p>';
            return;
        }

        const html = filtered.map(item => `
                <div class="result-item">
                    <img src="${item.image}" alt="${item.title}" width="120">
                    <h4>${item.title}</h4>
                </div>
            `).join('');

        resultContainer.innerHTML = html;
        document.querySelectorAll('.result-item').forEach((el, idx) => {
            el.addEventListener('click', () => {
                const video = filtered[idx].video;
                window.location.href = `player.html?video=${encodeURIComponent(video)}`;
            });
        });
    });
}
fetch("footer.html")
    .then(response => response.text())
    .then(data => {
        document.getElementById("footer").innerHTML = data;
    });

//tìm kiếm theo api
// async function loadApiMovies() {
//     const results = await Promise.allSettled(slugs.map(slug => loadMovie(slug)));
//     apiMovies = results
//         .filter(r => r.status === "fulfilled")
//         .map(r => r.value);
//     console.log("API Movies đã load:", apiMovies);
// }


// // khởi tạo tìm kiếm API
// async function initApiSearch() {
//     await loadApiMovies();

//     const input = document.getElementById('searchInput');
//     const resultContainer = document.getElementById('resultContainerApi'); // container riêng

//     input.addEventListener('input', function () {
//         const query = this.value.toLowerCase().trim();
//         if (!query) {
//             resultContainer.innerHTML = '';
//             return;
//         }

//         const filtered = apiMovies.filter(item =>
//             item.name.toLowerCase().includes(query) ||
//             (item.original_name && item.original_name.toLowerCase().includes(query))
//         );

//         if (filtered.length === 0) {
//             resultContainer.innerHTML = '<p>Không tìm thấy phim từ API.</p>';
//             return;
//         }

//         const html = filtered.map(item => `
//             <div class="result-item">
//                 <img src="${item.thumb_url}" alt="${item.name}" width="120">
//                 <h4>${item.name}</h4>
//             </div>
//         `).join('');

//         resultContainer.innerHTML = html;
//         document.querySelectorAll('#resultContainerApi .result-item').forEach((el, idx) => {
//             el.addEventListener('click', () => {
//                 window.location.href = `infor.html?slug=${filtered[idx].slug}`;
//             });
//         });
//     });
// }

// window.onload = () => {
//     init();          // tìm kiếm JSON
//     initApiSearch(); // tìm kiếm API
// };
