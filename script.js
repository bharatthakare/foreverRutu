/**
 * foreveryouR • APPLICATION SCRIPT (script.js)
 * Production-grade front-end logic, YouTube IFrame API integration,
 * 12-hour live clock, timeline scrubber, volume popover, and visualizer.
 */

document.addEventListener('DOMContentLoaded', () => {
  /* ==========================================================================
     1. Global State & DOM Element References
     ========================================================================== */
  let player = null;
  let isPlaying = false;
  let isMuted = false;
  let isDraggingTimeline = false;
  let currentTrackIndex = 0;
  let updateTimer = null;

  // Fallback Playlist Metadata (Guarantees instant metadata rendering)
  const fallbackPlaylist = [
    {
      id: 'PLvx1CTfylSL9l8oR7eonQjBn7loRsuMur',
      videoId: '5qap5aO4i9A',
      title: 'Midnight City Lights',
      artist: 'Lofi Chill Hop Stream'
    },
    {
      videoId: 'DWcJFNfaw9c',
      title: 'Synthwave Dreams 1984',
      artist: 'Retro Cyberwave'
    },
    {
      videoId: 'jfKfPfyJRdk',
      title: 'Tokyo Night Rain',
      artist: 'Ambient Lofi Beats'
    },
    {
      videoId: '7NOSDKb0HlU',
      title: 'Stargazing Drive',
      artist: 'Neon Chill Out'
    },
    {
      videoId: 'kgx4WGK0oNU',
      title: 'Late Night Coffee & Code',
      artist: 'foreveryouR Special'
    }
  ];

  // DOM References
  const liveClockEl = document.getElementById('live-clock');
  const cdCoverWrapper = document.getElementById('cd-cover-wrapper');
  const cdCoverImg = document.getElementById('cd-cover-img');
  const trackTitleEl = document.getElementById('track-title');
  const trackArtistEl = document.getElementById('track-artist');
  const heroTrackNameEl = document.getElementById('hero-track-name');

  const playBtn = document.getElementById('play-btn');
  const iconPlay = document.getElementById('icon-play');
  const iconPause = document.getElementById('icon-pause');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const shuffleBtn = document.getElementById('shuffle-btn');
  const repeatBtn = document.getElementById('repeat-btn');

  const timelineContainer = document.getElementById('timeline-container');
  const timelineProgress = document.getElementById('timeline-progress');
  const timelineHandle = document.getElementById('timeline-handle');
  const currentTimeEl = document.getElementById('current-time');
  const totalTimeEl = document.getElementById('total-time');

  const volumeBtn = document.getElementById('volume-btn');
  const iconVolHigh = document.getElementById('icon-vol-high');
  const iconVolMute = document.getElementById('icon-vol-mute');
  const volumeSlider = document.getElementById('volume-slider');
  const volPercentage = document.getElementById('vol-percentage');
  const volumePopover = document.getElementById('volume-popover');

  const tracksDrawer = document.getElementById('tracks-drawer');
  const drawerBackdrop = document.getElementById('drawer-backdrop');
  const playlistsBtn = document.getElementById('playlists-btn');
  const songsBtn = document.getElementById('songs-btn');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  const tracksListEl = document.getElementById('tracks-list');
  const trackSearchInput = document.getElementById('track-search');

  const infoBtn = document.getElementById('info-btn');
  const infoModal = document.getElementById('info-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  const startOverlay = document.getElementById('start-overlay');
  const startAppBtn = document.getElementById('start-app-btn');

  const canvas = document.getElementById('visualizer-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;

  /* ==========================================================================
     2. Continuous Live Digital Clock (12-hour hh:mm:ss AM/PM)
     ========================================================================== */
  function updateClock() {
    if (!liveClockEl) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const hoursStr = String(hours).padStart(2, '0');

    liveClockEl.textContent = `${hoursStr}:${minutes}:${seconds} ${ampm}`;
  }

  setInterval(updateClock, 1000);
  updateClock();

  /* ==========================================================================
     3. YouTube IFrame API Dynamic Loader & Logic
     ========================================================================== */
  function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) {
      initYouTubePlayer();
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
  }

  window.onYouTubeIframeAPIReady = function() {
    initYouTubePlayer();
  };

  function initYouTubePlayer() {
    player = new YT.Player('youtube-audio-engine', {
      height: '200',
      width: '200',
      playerVars: {
        listType: 'playlist',
        list: 'PLvx1CTfylSL9l8oR7eonQjBn7loRsuMur',
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        rel: 0,
        modestbranding: 1
      },
      events: {
        onReady: onPlayerReady,
        onStateChange: onPlayerStateChange,
        onError: onPlayerError
      }
    });
  }

  function onPlayerReady(event) {
    console.log('YouTube Audio Engine Ready');
    player.setVolume(parseInt(volumeSlider.value, 10));
    updateTrackMetadata();
    populateTracksDrawer();
    startProgressLoop();
  }

  function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
      isPlaying = true;
      cdCoverWrapper.classList.add('spinning');
      iconPlay.classList.add('hidden');
      iconPause.classList.remove('hidden');
      updateTrackMetadata();
    } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
      isPlaying = false;
      cdCoverWrapper.classList.remove('spinning');
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
    }
  }

  function onPlayerError(event) {
    console.warn('YouTube Player Event Warning/Error:', event.data);
    // Fallback track skip if video restricted
    if (player && typeof player.nextVideo === 'function') {
      setTimeout(() => player.nextVideo(), 1500);
    }
  }

  function togglePlayPause() {
    if (!player) return;
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  }

  function updateTrackMetadata() {
    if (!player) return;
    let videoData = null;

    if (typeof player.getVideoData === 'function') {
      videoData = player.getVideoData();
    }

    if (videoData && videoData.video_id) {
      const title = videoData.title || 'foreveryouR Stream Track';
      const author = videoData.author || 'foreveryouR Station';
      const thumbUrl = `https://img.youtube.com/vi/${videoData.video_id}/mqdefault.jpg`;

      trackTitleEl.textContent = title;
      trackArtistEl.textContent = author;
      heroTrackNameEl.textContent = `${title} • ${author}`;
      cdCoverImg.src = thumbUrl;
    } else {
      // Fallback display
      const fallback = fallbackPlaylist[currentTrackIndex % fallbackPlaylist.length];
      trackTitleEl.textContent = fallback.title;
      trackArtistEl.textContent = fallback.artist;
      heroTrackNameEl.textContent = `${fallback.title} • ${fallback.artist}`;
      cdCoverImg.src = `https://img.youtube.com/vi/${fallback.videoId}/mqdefault.jpg`;
    }

    highlightActiveDrawerItem();
  }

  /* ==========================================================================
     4. Interactive Timeline Scrubber & Progress Loop
     ========================================================================== */
  function startProgressLoop() {
    if (updateTimer) clearInterval(updateTimer);
    updateTimer = setInterval(updateProgress, 250);
  }

  function updateProgress() {
    if (!player || isDraggingTimeline || typeof player.getCurrentTime !== 'function') return;

    const currentTime = player.getCurrentTime() || 0;
    const duration = player.getDuration() || 0;

    currentTimeEl.textContent = formatTime(currentTime);
    totalTimeEl.textContent = formatTime(duration);

    if (duration > 0) {
      const percentage = (currentTime / duration) * 100;
      timelineProgress.style.width = `${percentage}%`;
      timelineHandle.style.left = `${percentage}%`;
    }
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function handleSeek(event) {
    if (!player || typeof player.getDuration !== 'function') return;
    const rect = timelineContainer.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const percentage = clickX / rect.width;
    const duration = player.getDuration() || 0;
    const seekTime = duration * percentage;

    timelineProgress.style.width = `${percentage * 100}%`;
    timelineHandle.style.left = `${percentage * 100}%`;
    currentTimeEl.textContent = formatTime(seekTime);

    player.seekTo(seekTime, true);
  }

  // Timeline Mouse / Touch Event Listeners
  timelineContainer.addEventListener('mousedown', (e) => {
    isDraggingTimeline = true;
    handleSeek(e);
  });

  document.addEventListener('mousemove', (e) => {
    if (isDraggingTimeline) handleSeek(e);
  });

  document.addEventListener('mouseup', () => {
    isDraggingTimeline = false;
  });

  /* ==========================================================================
     5. Volume & Mute Controls
     ========================================================================== */
  volumeSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    volPercentage.textContent = `${val}%`;
    if (player && typeof player.setVolume === 'function') {
      player.setVolume(val);
      if (val === 0) {
        setMuteState(true);
      } else if (isMuted) {
        setMuteState(false);
      }
    }
  });

  volumeBtn.addEventListener('click', () => {
    toggleMute();
  });

  function toggleMute() {
    setMuteState(!isMuted);
  }

  function setMuteState(mute) {
    isMuted = mute;
    if (isMuted) {
      iconVolHigh.classList.add('hidden');
      iconVolMute.classList.remove('hidden');
      if (player && typeof player.mute === 'function') player.mute();
    } else {
      iconVolHigh.classList.remove('hidden');
      iconVolMute.classList.add('hidden');
      if (player && typeof player.unMute === 'function') player.unMute();
    }
  }

  /* ==========================================================================
     6. Playback Controls Listeners
     ========================================================================== */
  playBtn.addEventListener('click', togglePlayPause);

  prevBtn.addEventListener('click', () => {
    if (player && typeof player.previousVideo === 'function') {
      player.previousVideo();
      if (currentTrackIndex > 0) currentTrackIndex--;
    }
  });

  nextBtn.addEventListener('click', () => {
    if (player && typeof player.nextVideo === 'function') {
      player.nextVideo();
      currentTrackIndex++;
    }
  });

  shuffleBtn.addEventListener('click', () => {
    shuffleBtn.classList.toggle('active');
    if (player && typeof player.setShuffle === 'function') {
      player.setShuffle(shuffleBtn.classList.contains('active'));
    }
  });

  repeatBtn.addEventListener('click', () => {
    repeatBtn.classList.toggle('active');
    if (player && typeof player.setLoop === 'function') {
      player.setLoop(repeatBtn.classList.contains('active'));
    }
  });

  /* ==========================================================================
     7. Side Drawer & Playlist Queue
     ========================================================================== */
  function openDrawer() {
    tracksDrawer.classList.add('open');
    drawerBackdrop.classList.add('open');
  }

  function closeDrawer() {
    tracksDrawer.classList.remove('open');
    drawerBackdrop.classList.remove('open');
  }

  playlistsBtn.addEventListener('click', openDrawer);
  songsBtn.addEventListener('click', openDrawer);
  closeDrawerBtn.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);

  function populateTracksDrawer() {
    tracksListEl.innerHTML = '';
    
    // Render list using fallback dataset or fetched YouTube videos
    fallbackPlaylist.forEach((track, idx) => {
      const item = document.createElement('div');
      item.className = `track-item ${idx === currentTrackIndex ? 'active' : ''}`;
      item.dataset.index = idx;
      item.dataset.videoid = track.videoId;

      item.innerHTML = `
        <img src="https://img.youtube.com/vi/${track.videoId}/mqdefault.jpg" alt="${track.title}" class="track-item-img">
        <div class="track-item-details">
          <div class="track-item-title">${track.title}</div>
          <div class="track-item-artist">${track.artist}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        currentTrackIndex = idx;
        if (player && typeof player.playVideoAt === 'function') {
          player.playVideoAt(idx);
        } else if (player && typeof player.loadVideoById === 'function') {
          player.loadVideoById(track.videoId);
        }
        highlightActiveDrawerItem();
        closeDrawer();
      });

      tracksListEl.appendChild(item);
    });
  }

  function highlightActiveDrawerItem() {
    const items = tracksListEl.querySelectorAll('.track-item');
    items.forEach((item, idx) => {
      if (idx === currentTrackIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  trackSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const items = tracksListEl.querySelectorAll('.track-item');
    items.forEach((item) => {
      const title = item.querySelector('.track-item-title').textContent.toLowerCase();
      const artist = item.querySelector('.track-item-artist').textContent.toLowerCase();
      if (title.includes(query) || artist.includes(query)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  });

  /* ==========================================================================
     8. Info Modal & Overlay Setup
     ========================================================================== */
  infoBtn.addEventListener('click', () => {
    infoModal.classList.remove('hidden');
  });

  modalCloseBtn.addEventListener('click', () => {
    infoModal.classList.add('hidden');
  });

  infoModal.addEventListener('click', (e) => {
    if (e.target === infoModal) infoModal.classList.add('hidden');
  });

  startAppBtn.addEventListener('click', () => {
    startOverlay.classList.add('hidden');
    togglePlayPause();
  });

  /* ==========================================================================
     9. Keyboard Shortcuts
     ========================================================================== */
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (player && typeof player.getCurrentTime === 'function') {
          player.seekTo(Math.max(0, player.getCurrentTime() - 5), true);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (player && typeof player.getCurrentTime === 'function') {
          player.seekTo(player.getCurrentTime() + 5, true);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        volumeSlider.value = Math.min(100, parseInt(volumeSlider.value, 10) + 10);
        volumeSlider.dispatchEvent(new Event('input'));
        break;
      case 'ArrowDown':
        e.preventDefault();
        volumeSlider.value = Math.max(0, parseInt(volumeSlider.value, 10) - 10);
        volumeSlider.dispatchEvent(new Event('input'));
        break;
      case 'KeyM':
        toggleMute();
        break;
      case 'KeyN':
        if (player && typeof player.nextVideo === 'function') player.nextVideo();
        break;
      case 'KeyP':
        if (player && typeof player.previousVideo === 'function') player.previousVideo();
        break;
    }
  });

  /* ==========================================================================
     10. Ambient Canvas Audio Visualizer Animation
     ========================================================================== */
  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function animateVisualizer() {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (isPlaying) {
      const bars = 64;
      const barWidth = canvas.width / bars;
      const time = Date.now() * 0.003;

      for (let i = 0; i < bars; i++) {
        const height = Math.sin(time + i * 0.15) * 45 + Math.cos(time * 0.8 + i * 0.1) * 35 + 50;
        const x = i * barWidth;
        const y = canvas.height - height;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, y);
        gradient.addColorStop(0, 'rgba(168, 85, 247, 0)');
        gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.15)');
        gradient.addColorStop(1, 'rgba(192, 132, 252, 0.4)');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth - 4, height);
      }
    }

    requestAnimationFrame(animateVisualizer);
  }

  animateVisualizer();

  /* ==========================================================================
     11. Touch & Click Floating Purple Heart (💜) Particle Effect
     ========================================================================== */
  function spawnPurpleHeart(x, y) {
    if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) return;

    const heart = document.createElement('span');
    heart.className = 'floating-heart';
    heart.textContent = '💜';

    const randomX = (Math.random() - 0.5) * 60; // -30px to +30px sway
    const randomRot = (Math.random() - 0.5) * 50; // -25deg to +25deg rotation
    heart.style.setProperty('--dx', `${randomX}px`);
    heart.style.setProperty('--rot', `${randomRot}deg`);

    heart.style.left = `${x}px`;
    heart.style.top = `${y}px`;

    document.body.appendChild(heart);

    setTimeout(() => {
      if (heart && heart.parentNode) {
        heart.parentNode.removeChild(heart);
      }
    }, 1200);
  }

  // Pointerdown Event - Universal handler for touch, tap, stylus, and mouse click
  window.addEventListener('pointerdown', (e) => {
    spawnPurpleHeart(e.clientX, e.clientY);
  }, { passive: true });

  // Load YouTube API
  loadYouTubeAPI();
});
