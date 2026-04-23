document.addEventListener('DOMContentLoaded', () => {
    const animeGrid = document.getElementById('anime-grid');
    const genreFilter = document.getElementById('genre-filter');

    // 1. Populate genre filter
    const allGenres = new Set();
    ANIME.forEach(anime => {
        anime.genres.forEach(genre => allGenres.add(genre));
    });

    const sortedGenres = Array.from(allGenres).sort();
    sortedGenres.forEach(genre => {
        const option = document.createElement('option');
        option.value = genre.toLowerCase();
        option.textContent = genre;
        genreFilter.appendChild(option);
    });

    // Helper to create a placeholder
    function createPlaceholder(title) {
        const placeholder = document.createElement('div');
        placeholder.className = 'card__poster--placeholder';
        placeholder.textContent = title.charAt(0);
        return placeholder;
    }

    // 2. Function to render cards
    function renderCards(filter = 'all') {
        animeGrid.innerHTML = '';
        
        const filteredAnime = filter === 'all' 
            ? ANIME 
            : ANIME.filter(anime => anime.genres.some(g => g.toLowerCase() === filter));

        filteredAnime.forEach(anime => {
            const card = document.createElement('article');
            card.className = 'card';
            
            // Poster Section
            const posterContainer = document.createElement('div');
            posterContainer.className = 'card__poster';
            
            if (anime.image) {
                const img = document.createElement('img');
                img.src = anime.image;
                img.alt = anime.title;
                img.onerror = () => {
                    posterContainer.innerHTML = '';
                    posterContainer.appendChild(createPlaceholder(anime.title));
                };
                posterContainer.appendChild(img);
            } else {
                posterContainer.appendChild(createPlaceholder(anime.title));
            }

            // Body Section
            const body = document.createElement('div');
            body.className = 'card__body';

            const title = document.createElement('h2');
            title.className = 'card__title';
            title.textContent = anime.title;

            const jpInfo = document.createElement('p');
            jpInfo.className = 'card__jp';
            jpInfo.textContent = `${anime.japaneseTitle} · ${anime.year}`;

            const meta = document.createElement('div');
            meta.className = 'card__meta';

            // Badges
            anime.genres.slice(0, 2).forEach(genre => {
                const badge = document.createElement('span');
                badge.className = 'badge';
                badge.textContent = genre;
                meta.appendChild(badge);
            });

            // Rating
            const rating = document.createElement('span');
            rating.className = 'rating';
            rating.textContent = `★ ${anime.rating}`;
            meta.appendChild(rating);

            const synopsis = document.createElement('p');
            synopsis.className = 'card__synopsis';
            synopsis.textContent = anime.synopsis;

            // Assemble
            body.appendChild(title);
            body.appendChild(jpInfo);
            body.appendChild(meta);
            body.appendChild(synopsis);

            card.appendChild(posterContainer);
            card.appendChild(body);
            
            animeGrid.appendChild(card);
        });
    }

    // 3. Initial render
    renderCards();

    // 4. Handle filter change
    genreFilter.addEventListener('change', (e) => {
        renderCards(e.target.value);
    });
});
