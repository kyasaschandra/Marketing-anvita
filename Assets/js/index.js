function toggleMobileMenu(menu) {
    menu.classList.toggle('open');
    document.body.classList.toggle('menu-open');
}



let players = {};
let playersReady = 0;
let totalPlayers = 0;
let observer = null;

function onYouTubeIframeAPIReady() {
    // console.log('YouTube API Ready');
    const containers = document.querySelectorAll('.youtube-container');
    totalPlayers = containers.length;
    
    // console.log(`Found ${totalPlayers} YouTube containers`);
    
    if (totalPlayers === 0) {
        // console.warn('No containers found with class "youtube-container"');
        return;
    }
    
    // Initialize players for each YouTube container
    containers.forEach((container, index) => {
        // Add loading indicator
        const loader = document.createElement('div');
        loader.className = 'video-loader';
        container.appendChild(loader);
        
        const videoId = container.dataset.videoId;
        const playerId = `youtube-player-${index}`;
        
        // console.log(`Creating player ${playerId} with video ID: ${videoId}`);
        
        // Set an ID on the container if it doesn't have one
        if (!container.id) {
            container.id = playerId + '-container';
        }
        
        players[playerId] = new YT.Player(container, {
            videoId: videoId,
            playerVars: {
                'autoplay': 0,
                'mute': 1, // CRITICAL: Must be muted for autoplay
                'controls': 1,
                'playsinline': 1,
                'rel': 0,
                'modestbranding': 1,
                'enablejsapi': 1
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    });
}

function onPlayerReady(event) {
    playersReady++;
    const playerId = event.target.getIframe().id.replace('-container', '');
    // console.log(`Player ready: ${playerId} (${playersReady}/${totalPlayers})`);
    
    // Ensure the video is muted for autoplay
    event.target.mute();
    
    // Wait for all players to be ready before setting up scroll trigger
    if (playersReady === totalPlayers) {
        // console.log('All players ready - setting up intersection observer');
        setupScrollTrigger();
        // Check initial visibility after a delay
        setTimeout(() => {
            // console.log('Checking initial visibility...');
            checkInitialVisibility();
        }, 2000); // Increased delay
    }
}

function onPlayerStateChange(event) {
    const iframe = event.target.getIframe();
    const playerId = iframe.id.replace('-container', '');
    
    switch (event.data) {
        case YT.PlayerState.PLAYING:
            // console.log(`${playerId} is now PLAYING`);
            break;
        case YT.PlayerState.PAUSED:
            // console.log(`${playerId} is now PAUSED`);
            break;
        case YT.PlayerState.BUFFERING:
            // console.log(`${playerId} is BUFFERING`);
            break;
        case YT.PlayerState.ENDED:
            // console.log(`${playerId} has ENDED`);
            break;
        case YT.PlayerState.CUED:
            // console.log(`${playerId} is CUED`);
            break;
    }
}

function onPlayerError(event) {
    // console.error('YouTube Player Error:', event.data);
}

function setupScrollTrigger() {
    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const container = entry.target;
            // console.log(`Intersection change for ${container.id}: ${entry.isIntersecting ? 'VISIBLE' : 'HIDDEN'}`);
            
            // Find the player associated with this container
            const playerId = Object.keys(players).find(id => {
                try {
                    const iframe = players[id].getIframe();
                    return iframe && (iframe.parentNode === container || iframe.closest('.youtube-container') === container);
                } catch (e) {
                    return false;
                }
            });
            
            if (playerId && players[playerId]) {
                if (entry.isIntersecting) {
                    // Video container is visible - try to play
                    // console.log(`Attempting to play ${playerId}`);
                    tryPlayVideo(playerId);
                } else {
                    // Video container is not visible - pause video
                    // console.log(`Attempting to pause ${playerId}`);
                    tryPauseVideo(playerId);
                }
            } else {
                // console.warn(`No player found for container ${container.id}`);
            }
        });
    }, { 
        threshold: 0.25, // Trigger when 25% of container is visible
        rootMargin: '50px 0px 50px 0px' // Add margin to trigger earlier
    });
    
    // Observe all YouTube containers
    document.querySelectorAll('.youtube-container').forEach(container => {
        // console.log(`Observing container: ${container.id}`);
        observer.observe(container);
    });
}

function tryPlayVideo(playerId) {
    try {
        const player = players[playerId];
        if (!player) {
            // console.error(`Player ${playerId} not found`);
            return;
        }
        
        const currentState = player.getPlayerState();
        // console.log(`Current state of ${playerId}: ${getStateDescription(currentState)}`);
        
        if (currentState !== YT.PlayerState.PLAYING && currentState !== YT.PlayerState.BUFFERING) {
            // Ensure muted before playing
            player.mute();
            
            // Try to play (YouTube API playVideo() doesn't return a Promise)
            try {
                player.playVideo();
                // console.log(`Play command sent for ${playerId}`);
                
                // Check if it actually started playing after a short delay
                setTimeout(() => {
                    const newState = player.getPlayerState();
                    if (newState === YT.PlayerState.PLAYING || newState === YT.PlayerState.BUFFERING) {
                        // console.log(`Successfully playing ${playerId}`);
                    } else {
                        // console.warn(`${playerId} didn't start playing. State: ${getStateDescription(newState)}`);
                        // Retry once more
                        setTimeout(() => {
                            // console.log(`Retrying play for ${playerId}`);
                            player.playVideo();
                        }, 1000);
                    }
                }, 500);
                
            } catch (playError) {
                // console.error(`Failed to play ${playerId}:`, playError);
            }
        }
    } catch (error) {
        // console.error(`Error trying to play ${playerId}:`, error);
    }
}

function tryPauseVideo(playerId) {
    try {
        const player = players[playerId];
        if (!player) return;
        
        const currentState = player.getPlayerState();
        if (currentState === YT.PlayerState.PLAYING || currentState === YT.PlayerState.BUFFERING) {
            player.pauseVideo();
            // console.log(`Paused ${playerId}`);
        }
    } catch (error) {
        // console.error(`Error trying to pause ${playerId}:`, error);
    }
}

// Check for videos that are already visible when page loads
function checkInitialVisibility() {
    document.querySelectorAll('.youtube-container').forEach(container => {
        const rect = container.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        
        // console.log(`Container ${container.id} - Top: ${rect.top}, Bottom: ${rect.bottom}, Visible: ${isVisible}`);
        
        if (isVisible) {
            // Find the player for this container
            const playerId = Object.keys(players).find(id => {
                try {
                    const iframe = players[id].getIframe();
                    return iframe && (iframe.parentNode === container || iframe.closest('.youtube-container') === container);
                } catch (e) {
                    return false;
                }
            });
            
            if (playerId && players[playerId]) {
                // console.log(`${container.id} is initially visible - attempting to play ${playerId}`);
                tryPlayVideo(playerId);
            }
        }
    });
}

// Helper function to get readable state description
function getStateDescription(state) {
    const states = {
        [-1]: 'UNSTARTED',
        [0]: 'ENDED',
        [1]: 'PLAYING',
        [2]: 'PAUSED',
        [3]: 'BUFFERING',
        [5]: 'CUED'
    };
    return states[state] || 'UNKNOWN';
}

// Add manual play function for testing
function manualPlay(playerIndex = 0) {
    const playerId = `youtube-player-${playerIndex}`;
    // console.log(`Manual play triggered for ${playerId}`);
    tryPlayVideo(playerId);
}

// Make manual play available globally for testing
window.manualPlay = manualPlay;

// Add click listeners to containers for manual play (fallback)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.querySelectorAll('.youtube-container').forEach((container, index) => {
            container.addEventListener('click', () => {
                // console.log(`Container clicked - attempting manual play`);
                manualPlay(index);
            });
            
            // Add a visual indicator that it's clickable
            container.style.cursor = 'pointer';
            container.title = 'Click to play if autoplay fails';
        });
    }, 3000);
});

// Form handling
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());
            
            // Basic validation
            if (!data.name || !data.email || !data.phone || !data.project || !data.message) {
                alert('Please fill in all fields');
                return;
            }
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(data.email)) {
                alert('Please enter a valid email address');
                return;
            }
            
            // Phone validation (basic)
            const phoneRegex = /^\+?[\d\s-]{10,}$/;
            if (!phoneRegex.test(data.phone)) {
                alert('Please enter a valid phone number');
                return;
            }
            
            // Show success message (in a real application, you would send this data to a server)
            alert('Thank you for your message! We will get back to you shortly.');
            contactForm.reset();
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Add intersection observer for animations
    const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.project, .contact-container').forEach(element => {
        animationObserver.observe(element);
    });
});

// Image loading handling
document.addEventListener('DOMContentLoaded', () => {
    // Lazy load project background images
    const projects = document.querySelectorAll('.project');
    projects.forEach(project => {
        const backgroundImage = getComputedStyle(project.querySelector(':before')).backgroundImage;
        if (backgroundImage && backgroundImage !== 'none') {
            const img = new Image();
            img.src = backgroundImage.slice(4, -1).replace(/"/g, '');
            img.onload = () => {
                project.classList.add('loaded');
            };
        }
    });

    // Handle logo images loading
    const logos = document.querySelectorAll('.project-logo');
    logos.forEach(logo => {
        if (logo.complete) {
            logo.classList.add('loaded');
        } else {
            logo.addEventListener('load', () => {
                logo.classList.add('loaded');
            });
        }
    });

    // Handle image loading errors
    const projectLogos = document.querySelectorAll('.project-logo');
    projectLogos.forEach(logo => {
        logo.onerror = function() {
            this.onerror = null; // Prevent infinite loop
            this.parentElement.innerHTML = `
                <div class="logo-placeholder">
                    <span>${this.alt || 'Project Logo'}</span>
                </div>
            `;
        };
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const hamburgerIcon = document.getElementById('hamburger-icon');
    const mobileMenu = document.querySelector('.mobile-menu');

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (hamburgerIcon.classList.contains('open') &&
            !hamburgerIcon.contains(e.target) &&
            !mobileMenu.contains(e.target)) {
            hamburgerIcon.classList.remove('open');
            document.body.classList.remove('menu-open');
        }
    });

    // Close menu when clicking a menu item
    mobileMenu.addEventListener('click', (e) => {
        if (e.target.tagName === 'A') {
            hamburgerIcon.classList.remove('open');
            document.body.classList.remove('menu-open');
        }
    });
});