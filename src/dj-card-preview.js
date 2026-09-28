/**
 * dj-card-preview - the homepage hover preview from The DJ Calendar
 *
 * Hover an artist card: a 30-second iTunes preview plays, an 8-bar EQ
 * driven by the REAL audio frequencies renders on canvas, and a
 * "You are now listening to" overlay fades in. Roll off and everything
 * stops - audio, canvas, overlay, document title, media session.
 *
 * Extracted verbatim from production (_inc/dj_card_preview_boot.php).
 * Zero dependencies. The only site-specific piece is the optional
 * artwork proxy (/img.php) used for media-session artwork; without it
 * the code degrades gracefully to no artwork.
 *
 * https://github.com/bryanhamiltondev/dj-card-preview
 * MIT licensed.
 */
(function () {
    window.activeAudioCard = null;
    var djcOriginalDocumentTitle = document.title;

    function djcPreviewTrackTitle(card) {
        return String(card && card.dataset ? (card.dataset.previewTitle || '') : '').trim();
    }

    function djcPreviewArtistName(card) {
        var name = String(card && card.dataset ? (card.dataset.name || '') : '').trim();
        if (name) {
            return name;
        }
        var nameEl = card ? (card.querySelector('.dj-card-name') || card.querySelector('.fav-card-name')) : null;
        return nameEl && nameEl.textContent ? nameEl.textContent.trim() : '';
    }

    function djcSetPreviewDocumentTitle(card) {
        var artist = djcPreviewArtistName(card);
        var track = djcPreviewTrackTitle(card);
        if (artist && track) {
            document.title = artist + ' - ' + track;
        }
    }

    function djcRestorePreviewDocumentTitle() {
        document.title = djcOriginalDocumentTitle;
    }

    function djcPreviewArtworkUrl(card) {
        var src = String(card && card.dataset ? (card.dataset.image || '') : '').trim();
        if (!src && card) {
            var img = card.querySelector('.card-image-photo, img');
            src = img && img.currentSrc ? img.currentSrc : (img && img.src ? img.src : '');
        }
        if (!src) {
            return '';
        }
        try {
            return new URL(src, window.location.origin).href;
        } catch (e) {
            return src;
        }
    }

    function djcPreviewArtworkEntries(card) {
        var artworkUrl = djcPreviewArtworkUrl(card);
        if (!artworkUrl) {
            return [];
        }
        var sizes = [96, 128, 192, 256, 384, 512];
        try {
            var parsed = new URL(artworkUrl, window.location.origin);
            var source = parsed.pathname.endsWith('/img.php')
                ? (parsed.searchParams.get('src') || artworkUrl)
                : artworkUrl;

            return sizes.map(function (size) {
                var proxied = new URL('/img.php', window.location.origin);
                proxied.searchParams.set('src', source);
                proxied.searchParams.set('w', String(size));
                proxied.searchParams.set('h', String(size));
                proxied.searchParams.set('q', '82');
                proxied.searchParams.set('fmt', 'jpeg');
                proxied.searchParams.set('fit', 'cover');
                return {
                    src: proxied.href,
                    sizes: size + 'x' + size,
                    type: 'image/jpeg'
                };
            });
        } catch (e) {
            return [{ src: artworkUrl, sizes: '512x512' }];
        }
    }

    function djcSetPreviewMediaMetadata(card) {
        if (!('mediaSession' in navigator) || typeof window.MediaMetadata !== 'function') {
            return;
        }
        var artist = djcPreviewArtistName(card);
        var track = djcPreviewTrackTitle(card);
        var artwork = djcPreviewArtworkEntries(card);
        var metadata = {
            title: artist && track ? artist + ' - ' + track : (track || artist || document.title),
            artist: artist,
            album: 'The DJ Calendar Preview'
        };
        if (artwork.length) {
            metadata.artwork = artwork;
        }
        try {
            navigator.mediaSession.metadata = new window.MediaMetadata(metadata);
            navigator.mediaSession.playbackState = 'playing';
        } catch (e) {
            /* media metadata is best-effort */
        }
    }

    function djcClearPreviewMediaMetadata() {
        if (!('mediaSession' in navigator)) {
            return;
        }
        try {
            navigator.mediaSession.playbackState = 'none';
            navigator.mediaSession.metadata = null;
        } catch (e) {
            /* noop */
        }
    }

    function djcFavAudioBlocksCardPreview() {
        return typeof window.djcIsFavAudioSessionActive === 'function'
            && window.djcIsFavAudioSessionActive();
    }

    function djcPreviewHoverAllowed() {
        if (djcFavAudioBlocksCardPreview()) {
            return false;
        }
        if (window.matchMedia('(hover: none), (pointer: coarse)').matches) {
            return false;
        }
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return false;
        }
        return true;
    }

    function djcPreviewTouchMode() {
        return window.matchMedia('(hover: none), (pointer: coarse)').matches;
    }

    function djcPreviewMotionOk() {
        return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function djcSetPreviewPlaying(card, playing) {
        if (!card) {
            return;
        }
        card.classList.toggle('is-preview-playing', !!playing);
        var overlay = card.querySelector('.card-image-overlay');
        var label = card.querySelector('.card-overlay-track');
        if (playing) {
            if (label && card.dataset.previewTitle) {
                label.textContent = card.dataset.previewTitle;
            }
            if (overlay) {
                overlay.style.opacity = '1';
            }
        } else {
            if (overlay) {
                overlay.style.opacity = '0';
            }
            if (label) {
                label.textContent = '';
            }
        }
    }

    function djcPreviewReleaseHover(card) {
        if (card) {
            card._djcPreviewHovered = false;
        }
    }

    function djcPreviewPickTrack(data) {
        if (!data || !data.results || !data.results.length) {
            return null;
        }
        for (var i = 0; i < data.results.length; i++) {
            var row = data.results[i];
            if (row && row.previewUrl) {
                return {
                    previewUrl: String(row.previewUrl),
                    title: String(row.trackName || row.collectionName || '').trim()
                };
            }
        }
        return null;
    }

    function djcPreviewFetchTrack(name) {
        var url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(name)
            + '&entity=musicTrack&limit=12&media=music';
        return fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (data) { return djcPreviewPickTrack(data); });
    }

    function djcStopCardPreview(card) {
        if (!card) {
            return;
        }
        card._djcPreviewGen = (card._djcPreviewGen || 0) + 1;
        card._djcPreviewHovered = false;
        card._djcPreviewPending = false;

        if (card._djcPreviewDrawId) {
            cancelAnimationFrame(card._djcPreviewDrawId);
            card._djcPreviewDrawId = null;
        }
        if (card._djcPreviewAudio) {
            try {
                card._djcPreviewAudio.pause();
                card._djcPreviewAudio.removeAttribute('src');
                card._djcPreviewAudio.load();
            } catch (e) {
                /* noop */
            }
            card._djcPreviewAudio = null;
            card._audio = null;
        }
        if (card._djcPreviewCtx) {
            try {
                if (card._djcPreviewCtx.state !== 'closed' && typeof card._djcPreviewCtx.close === 'function') {
                    card._djcPreviewCtx.close();
                }
            } catch (e2) {
                /* noop */
            }
            card._djcPreviewCtx = null;
        }
        card._djcPreviewAnalyser = null;
        card._djcPreviewMediaSrc = null;

        var canvas = card.querySelector('.waveform-canvas');
        if (canvas) {
            canvas.style.opacity = '0';
            var ctx2d = canvas.getContext('2d');
            if (ctx2d) {
                ctx2d.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        if (window.activeAudioCard === card) {
            window.activeAudioCard = null;
            djcRestorePreviewDocumentTitle();
            djcClearPreviewMediaMetadata();
        }
        djcSetPreviewPlaying(card, false);
        if (typeof window.djcResumeFavAudioAfterCardPreview === 'function') {
            window.djcResumeFavAudioAfterCardPreview();
        }
    }

    function djcStartPreviewEq(card, canvas, analyser) {
        var canvasCtx = canvas.getContext('2d');
        if (!canvasCtx || !analyser) {
            return;
        }
        if (!djcPreviewMotionOk()) {
            canvas.style.opacity = '0';
            return;
        }
        canvas.style.opacity = '1';
        var dataArray = new Uint8Array(analyser.frequencyBinCount);
        var BAR_COUNT = 8;
        var gap = 4;
        var barWidth = (canvas.width - (gap * (BAR_COUNT - 1))) / BAR_COUNT;

        function draw() {
            if (!card._djcPreviewAudio || window.activeAudioCard !== card) {
                card._djcPreviewDrawId = null;
                return;
            }
            card._djcPreviewDrawId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            for (var i = 0; i < BAR_COUNT; i++) {
                var avg = dataArray[i * 2] || 0;
                var barHeight = Math.max(4, (avg / 255) * canvas.height);
                var x = i * (barWidth + gap);
                var y = canvas.height - barHeight;
                var grad = canvasCtx.createLinearGradient(x, y, x, canvas.height);
                grad.addColorStop(0, '#00d2ff');
                grad.addColorStop(1, 'rgba(0,210,255,0)');
                canvasCtx.fillStyle = grad;
                canvasCtx.fillRect(x, y, barWidth, barHeight);
            }
        }
        draw();
    }

    function djcLaunchCardPreview(card, previewUrl, canvas, gen) {
        if (!previewUrl || window.activeAudioCard !== card || card._djcPreviewGen !== gen) {
            return;
        }

        var audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.src = previewUrl;
        card._djcPreviewAudio = audio;
        card._audio = audio;
        card._djcPreviewPending = false;
        djcSetPreviewDocumentTitle(card);
        djcSetPreviewMediaMetadata(card);

        audio.addEventListener('ended', function () {
            djcStopCardPreview(card);
        });
        audio.addEventListener('error', function () {
            try {
                delete card.dataset.previewUrl;
            } catch (e0) {
                card.removeAttribute('data-preview-url');
            }
            djcStopCardPreview(card);
        });

        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) {
            audio.play().then(function () {
                djcSetPreviewPlaying(card, true);
            }).catch(function () {});
            return;
        }

        var ctx = new Ctx();
        card._djcPreviewCtx = ctx;

        function beginPlayback(analyser) {
            if (card._djcPreviewGen !== gen || window.activeAudioCard !== card) {
                djcStopCardPreview(card);
                return;
            }
            djcStartPreviewEq(card, canvas, analyser);
            var resume = ctx.state === 'suspended' && typeof ctx.resume === 'function'
                ? ctx.resume()
                : Promise.resolve();
            Promise.resolve(resume).then(function () {
                return audio.play();
            }).then(function () {
                djcSetPreviewPlaying(card, true);
            }).catch(function () {
                djcSetPreviewPlaying(card, true);
            });
        }

        try {
            var src = ctx.createMediaElementSource(audio);
            var analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.8;
            src.connect(analyser);
            analyser.connect(ctx.destination);
            card._djcPreviewMediaSrc = src;
            card._djcPreviewAnalyser = analyser;
            beginPlayback(analyser);
        } catch (e) {
            audio.play().then(function () {
                djcSetPreviewPlaying(card, true);
            }).catch(function () {});
        }
    }

    function djcToggleCardPreview(card) {
        if (!card) {
            return;
        }
        if (djcFavAudioBlocksCardPreview()) {
            return;
        }
        if (window.activeAudioCard === card && (card._djcPreviewAudio || card._djcPreviewPending)) {
            djcStopCardPreview(card);
            return;
        }
        window.djcPlayCardPreview(card);
    }

    window.djcPlayCardPreview = function (card) {
        if (!card) {
            return;
        }
        if (djcFavAudioBlocksCardPreview()) {
            djcPreviewReleaseHover(card);
            return;
        }
        if (card.dataset.previewMiss === '1') {
            return;
        }
        if (card._djcPreviewPending || card._djcPreviewAudio) {
            return;
        }

        var name = String(card.dataset.name || '').trim();
        if (!name) {
            var nameEl = card.querySelector('.dj-card-name') || card.querySelector('.fav-card-name');
            name = nameEl && nameEl.textContent ? nameEl.textContent.trim() : '';
        }
        if (!name) {
            djcPreviewReleaseHover(card);
            return;
        }
        var canvas = card.querySelector('.waveform-canvas');
        if (!canvas) {
            djcPreviewReleaseHover(card);
            return;
        }

        if (window.activeAudioCard && window.activeAudioCard !== card) {
            djcStopCardPreview(window.activeAudioCard);
        }

        var gen = (card._djcPreviewGen || 0) + 1;
        card._djcPreviewGen = gen;
        card._djcPreviewPending = true;
        window.activeAudioCard = card;

        var cached = String(card.dataset.previewUrl || '').trim();
        if (cached) {
            djcLaunchCardPreview(card, cached, canvas, gen);
            return;
        }

        djcPreviewFetchTrack(name)
            .then(function (track) {
                if (card._djcPreviewGen !== gen || window.activeAudioCard !== card) {
                    card._djcPreviewPending = false;
                    return;
                }
                if (!track || !track.previewUrl) {
                    card._djcPreviewPending = false;
                    card.dataset.previewMiss = '1';
                    djcPreviewReleaseHover(card);
                    return;
                }
                card.dataset.previewUrl = track.previewUrl;
                if (track.title) {
                    card.dataset.previewTitle = track.title;
                }
                djcLaunchCardPreview(card, track.previewUrl, canvas, gen);
            })
            .catch(function () {
                card._djcPreviewPending = false;
                djcPreviewReleaseHover(card);
            });
    };

    window.djcStopCardPreview = djcStopCardPreview;
    window.djcToggleCardPreview = djcToggleCardPreview;
    window.playPreview = function (card) {
        if (djcPreviewTouchMode()) {
            window.djcToggleCardPreview(card);
            return;
        }
        window.djcPlayCardPreview(card);
    };
    window.stopPreview = function (card) {
        window.djcStopCardPreview(card);
    };
    window.djcInitDjCardPreviewHover = function () {
        /* app.js / a11y.js must not bind a second handler */
    };

    function djcPreviewBindGrid(grid, opts) {
        opts = opts || {};
        var cardSelector = opts.cardSelector || '.dj-card';
        var imageSelector = opts.imageSelector || '.card-image';

        if (!grid || grid.dataset.djcPreviewGridBound === '1') {
            return;
        }
        grid.dataset.djcPreviewGridBound = '1';

        grid.addEventListener('click', function (e) {
            if (!djcPreviewTouchMode()) {
                return;
            }
            if (e.target.closest('.star-toggle, .fav-remove')) {
                return;
            }
            var imageWrap = e.target.closest(imageSelector);
            if (!imageWrap) {
                return;
            }
            var card = imageWrap.closest(cardSelector);
            if (!card || !grid.contains(card)) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            djcToggleCardPreview(card);
        }, true);

        grid.addEventListener('mouseover', function (e) {
            if (!djcPreviewHoverAllowed()) {
                return;
            }
            var card = e.target.closest(cardSelector);
            if (!card || !grid.contains(card) || card._djcPreviewHovered) {
                return;
            }
            card._djcPreviewHovered = true;
            window.djcPlayCardPreview(card);
            if (!card._djcPreviewPending && !card._djcPreviewAudio) {
                card._djcPreviewHovered = false;
            }
        });

        grid.addEventListener('mouseout', function (e) {
            if (!djcPreviewHoverAllowed()) {
                return;
            }
            var card = e.target.closest(cardSelector);
            if (!card || !grid.contains(card)) {
                return;
            }
            var related = e.relatedTarget;
            if (related && card.contains(related)) {
                return;
            }
            card._djcPreviewHovered = false;
            djcStopCardPreview(card);
        });
    }

    function djcPreviewBindAllGrids() {
        var djGrid = document.getElementById('djGrid');
        if (djGrid) {
            djcPreviewBindGrid(djGrid, { cardSelector: '.dj-card', imageSelector: '.card-image' });
        }
        document.querySelectorAll('.genre-artists-grid').forEach(function (grid) {
            djcPreviewBindGrid(grid, { cardSelector: '.dj-card', imageSelector: '.card-image' });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(djcPreviewBindAllGrids, { timeout: 2000 });
            } else {
                setTimeout(djcPreviewBindAllGrids, 100);
            }
        });
    } else {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(djcPreviewBindAllGrids, { timeout: 2000 });
        } else {
            setTimeout(djcPreviewBindAllGrids, 100);
        }
    }
})();
