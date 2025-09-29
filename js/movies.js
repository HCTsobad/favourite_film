const slugs = ["kho-do-danh", "sa-vao-tinh-yeu-cuong-nhiet-cua-chung-ta", "vung-trom-khong-the-giau", "khi-anh-chay-ve-phia-em", "man-thanh",
    "treu-nham-yeu-that-di-ai-vi-doanh", "chiec-bat-lua-va-vay-cong-chua", "anh-dao-ho-phach", "suyt-quoc-vuong-dang-ngu-dong",
    "an-chay-yeu", "tam-biet-khoanh-khac-rung-dong", "tinh-nong-trong-mat", "yeu-em", "duoi-tan-cay-co-ngoi-nha-mai-do", "cuu-trung-tu", "lieu-chu-ky",
    "thieu-hoa-nhuoc-cam", "than-an-the-last-immortal", "con-trai-ban-me", "khi-dien-thoai-do-chuong", "nguoi-nhen-xa-nha", "nguoi-nhen-sieu-dang",
    "nguoi-nhen-sieu-dang-2", "nguoi-nhen-tro-ve-nha", "nguoi-nhen-khong-con-nha", "nguoi-nhen", "nguoi-nhen-2", "nguoi-nhen-3", "nguoi-sat",
    "nguoi-sat-2", "nguoi-sat-3", "nhim-sonic", "nhim-sonic-2", "nhim-sonic-3", "trieu-tuyet-luc", "hien-ngu", "tang-hai-truyen"
];
async function loadMovie(slug) {
    const res = await fetch(`https://phim.nguonc.com/api/film/${slug}`);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    return { ...data.movie, slug };
}

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
        const results = await Promise.allSettled(slugs.map(slug => loadMovie(slug)));

        const successMovies = results.filter(r => r.status === "fulfilled").map(r => r.value);

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
        successMovies.forEach((movie, idx) => {
            html += `
              <div class="movie-card" data-slug="${slugs[idx]}">
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

        document.querySelectorAll(".movie-card").forEach(card => {
            card.addEventListener("click", () => {
                window.location.href = `player.html?slug=${card.dataset.slug}`;
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