// frontend/app.js
// This file manages client-side interactivity, user authentication state (via localStorage),
// communication with backend APIs (/api/auth/callback for login, /api/auth0-user-management for user admin tasks),
// and dynamic HTML updates based on application state and user actions.

// LOCAL_TESTING_MODE:
// Set this global variable to true in your browser's developer console
// (e.g., window.LOCAL_TESTING_MODE = true;) to bypass client-side authentication checks
// and simulate a user. This is useful for UI development without needing to repeatedly log in.
// IMPORTANT: Ensure this is false or removed for production or real authentication testing.
// No Okta Auth JS initialization is used; authentication is handled via backend and localStorage.

// Global variables for parallax effect, updated by a single window event listener.
let mouseParallaxX = 0;
let mouseParallaxY = 0;

// Global variable to store fetched application configuration
let appConfig = {};

// --- Okta Configuration (CLIENT-SIDE) ---
// These will be fetched from /api/config
// const AUTH0_DOMAIN = 'dev-ky8umfzopcrqoft1.us.auth0.com'; // e.g., dev-abc1234.us.auth0.com
// const AUTH0_CLIENT_ID = '3H2O07Y9h101Gpx2hINM0avLDO20fA77'; // Client ID of your Auth0 SPA/Regular Web Application
// const AUTH0_AUDIENCE = 'https://dev-ky8umfzopcrqoft1.us.auth0.com/api/v2/'; // Optional: If you have a custom API, use its identifier (e.g., https://your-api.com)

// The redirect_uri must exactly match one configured in your Okta Application's "Sign-in redirect URIs".
// It points to the HTML page in your frontend that will handle the Okta redirect.
// Determine the Okta Redirect URI dynamically based on the hostname.
let OKTA_REDIRECT_URI;
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  // For local development
  OKTA_REDIRECT_URI = 'http://localhost:3000/callback.html';
} else {
  // For Vercel production deployment.
  // Ensure this matches your Vercel production URL.
  OKTA_REDIRECT_URI = `https://${window.location.hostname}/callback.html`;
}

/**
 * Fetches application configuration from the backend.
 * This should be called before any auth-related initializations.
 */
async function fetchAppConfig() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.statusText}`);
    }
    appConfig = await response.json();
    console.log('[App.js] Configuration fetched:', appConfig);

    // Validate essential config
    if (!appConfig.oktaDomain || !appConfig.oktaClientId) {
        console.error('Okta domain or client ID is missing from fetched config.');
        showToast('Error: Client configuration is missing. Authentication may not work.', 'error', 5000);
        // Potentially block further auth actions if config is incomplete
    }
  } catch (error) {
    console.error('Error fetching application configuration:', error);
    showToast('Failed to load application settings. Please try again later.', 'error', 5000);
    // Handle error appropriately, maybe show a user-friendly message or disable auth features
  }
}


/**
 * Logs the user out by clearing their session information from localStorage and redirecting to the login page.
 * This now also initiates a logout request with Okta to terminate their session there.
 * @async
 */
async function logout() {
    const authenticatedUser = JSON.parse(localStorage.getItem('authenticatedUser'));
    localStorage.removeItem('authenticatedUser');
    localStorage.removeItem('okta_state'); // Also clear any stored state for Okta

    if (appConfig.oktaDomain && authenticatedUser?.idToken) {
        const postLogoutRedirectUri = window.location.origin + '/index.html'; // Or login.html
        // For Okta, the client_id is not sent to /logout. Instead, id_token_hint and post_logout_redirect_uri are used.
        const oktaLogoutUrl = `https://${appConfig.oktaDomain}/oauth2/default/v1/logout?id_token_hint=${authenticatedUser.idToken}&post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
        window.location.href = oktaLogoutUrl;
    } else {
        // Fallback if config or idToken isn't available
        console.warn('Okta config or ID token not available for full logout. Clearing local session and redirecting.');
        window.location.href = window.location.origin + '/index.html';
    }
}


/**
 * Checks the user's authentication state (from localStorage) and roles.
 * Manages page access by redirecting users based on their auth status and roles.
 * Updates UI elements (e.g., user profile display, admin links visibility).
 * This function is crucial for client-side route protection and UI personalization,
 * and it's typically called on every page load.
 */
function checkAuthAndRedirect() {
  // --- Start Local Testing Bypass (Frontend Only) ---
  // This block allows developers to bypass actual authentication for UI testing.
  if (window.LOCAL_TESTING_MODE) {
    console.warn("LOCAL_TESTING_MODE is active. Bypassing client-side authentication checks.");
    // If no 'authenticatedUser' is found in localStorage (meaning no real login or manual setup),
    // and the current page is not a public page (login, index, callback),
    // then simulate a default user to allow access to protected UI elements.
    if (!localStorage.getItem('authenticatedUser') &&
      !window.location.pathname.endsWith('/login.html') && // Don't simulate on login page
      !window.location.pathname.endsWith('/index.html') && // Don't simulate on public index
      !window.location.pathname.endsWith('/') &&              // Don't simulate on root if it's public
      !window.location.pathname.endsWith('/callback.html') // Don't simulate on callback page
    ) {
      // Create a default dummy user object. For testing non-admin views, ensure this user
      // does NOT have the 'admin' role. To test admin views, manually set an admin user
      // in localStorage via the browser console (see README for example).
      const dummyUser = {
        id: 'local-test-user-sub', // Simulated Auth0 user ID (sub)
        profile: { firstName: 'Local', lastName: 'Tester', name: 'Local Tester', email: 'test@example.com', picture: 'assets/default-avatar.png' }, // Added default picture
        roles: ['user'] // Simulate a basic user role; add 'admin' to test admin features.
      };
      localStorage.setItem('authenticatedUser', JSON.stringify(dummyUser)); // Store the dummy user.
      console.log('LOCAL_TESTING_MODE: Simulated user set in localStorage:', dummyUser);
    }
  }
  // --- End Local Testing Bypass ---

  // Retrieve the authenticated user object from localStorage.
  // This object (if present) contains profile, tokens, and roles.
  const authenticatedUser = JSON.parse(localStorage.getItem('authenticatedUser'));
  const currentPage = window.location.pathname; // Get the current page's path.

  // Select DOM elements used for displaying user information and controlling UI visibility.
  const userProfileNameEl = document.getElementById('user-profile-name');
  const userProfileEmailEl = document.getElementById('user-profile-email');
  const userProfileRolesEl = document.getElementById('user-profile-roles');
  const userProfilePictureEl = document.getElementById('user-profile-picture'); // New: Profile picture element
  const adminLinksContainerEl = document.getElementById('admin-links-container');
  const logoutButton = document.getElementById('logout-button');

  // Control visibility of the logout button based on authentication state.
  if (logoutButton) {
    logoutButton.style.display = authenticatedUser ? 'block' : 'none';
  }

  // Handle behavior if a user is authenticated (i.e., authenticatedUser object exists).
  if (authenticatedUser) {
    // User is considered "authenticated" (either via a real login or LOCAL_TESTING_MODE simulation).

    // Populate user profile information on pages like protected.html.
    if (userProfileNameEl && authenticatedUser.profile) {
      userProfileNameEl.textContent = authenticatedUser.profile.name || authenticatedUser.profile.firstName || authenticatedUser.profile.email || 'User';
    }
    if (userProfileEmailEl && authenticatedUser.profile) {
      userProfileEmailEl.textContent = authenticatedUser.profile.email || 'N/A';
    }
    // New: Set profile picture
    if (userProfilePictureEl && authenticatedUser.profile?.picture) {
      userProfilePictureEl.src = authenticatedUser.profile.picture;
    } else if (userProfilePictureEl) {
      userProfilePictureEl.src = 'assets/default-avatar.png'; // Fallback to default
    }

    if (userProfileRolesEl) {
      userProfileRolesEl.textContent = authenticatedUser.roles?.join(', ') || 'No roles assigned';
    }

    // Determine if the authenticated user has an 'admin' role.
    const isAdmin = authenticatedUser.roles && authenticatedUser.roles.some(role => typeof role === 'string' && role.toLowerCase() === 'admin');

    // Show or hide the admin links container based on whether the user is an admin.
    if (adminLinksContainerEl) {
      adminLinksContainerEl.style.display = isAdmin ? 'block' : 'none';
      // Staggered entry for dashboard cards if on protected.html
      if (currentPage.endsWith('protected.html')) {
        const userInfoCard = document.getElementById('user-info-details');
        // Delay applied directly to the card elements to trigger animation
        if (userInfoCard) userInfoCard.style.animationDelay = '0.4s';
        if (adminLinksContainerEl) adminLinksContainerEl.style.animationDelay = '0.6s';
      }
    }

    // Redirection logic for logged-in users.
    if (isAdmin) {
      if (currentPage.endsWith('login.html') || currentPage.endsWith('callback.html')) {
        window.location.href = 'protected.html';
      }
    } else {
      const isAdminPage = currentPage.endsWith('admin.html') || currentPage.endsWith('admin-group.html') || currentPage.endsWith('admin-user-crud.html');
      if (isAdminPage) {
        // Use toast notification instead of alert for access denied
        showToast('Access Denied: You do not have permission to view this page.', 'error');
        window.location.href = 'protected.html';
      }
      if (currentPage.endsWith('login.html') || currentPage.endsWith('callback.html')) {
        window.location.href = 'protected.html';
      }
    }
  } else {
    // User is not authenticated
    const isProtectedPage = currentPage.endsWith('protected.html');
    const isAdminAreaPage = currentPage.includes('admin');
    // Ensure we don't redirect from the login or callback page itself if not authenticated
    if (isProtectedPage || isAdminAreaPage) {
      window.location.href = 'login.html';
    }
  }
}

/**
 * Displays a message in a designated HTML element with appropriate styling and optional auto-hide.
 * Uses CSS classes for styling (e.g., 'success', 'error', 'info') and for triggering show/hide animations.
 * @param {HTMLElement} element - The HTML element where the message will be displayed.
 * @param {string} text - The message text to display.
 * @param {'success' | 'error' | 'info'} [type='info'] - The type of message, influencing its styling.
 * @param {string} [baseClass='message-area'] - The base CSS class for the message element.
 * @param {number} [autoHideDelay=0] - Delay in milliseconds to auto-hide the message. If 0, message remains visible.
 * @param {boolean} [addShake=false] - If true, adds a shake animation to the error message.
 */
function displayMessage(element, text, type = 'info', baseClass = 'message-area', autoHideDelay = 0, addShake = false) {
  if (element) {
    element.textContent = text;
    element.className = `${baseClass} ${type} show`;
    if (addShake && type === 'error') {
      element.classList.add('shake');
      // Remove shake class after animation
      element.addEventListener('animationend', () => {
        element.classList.remove('shake');
      }, { once: true });
    }

    if (autoHideDelay > 0) {
      setTimeout(() => {
        element.classList.remove('show');
      }, autoHideDelay);
    }
  }
}

/**
 * Displays a transient "toast" notification.
 * @param {string} message - The message to display.
 * @param {'success' | 'error' | 'info'} [type='info'] - The type of toast.
 * @param {number} [duration=3000] - How long the toast should be visible in milliseconds.
 */
function showToast(message, type = 'info', duration = 3000) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  // Auto-hide after duration
  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('animationend', () => {
      toast.remove();
      if (toastContainer.children.length === 0) {
        toastContainer.remove(); // Remove container if no toasts left
      }
    }, { once: true });
  }, duration);
}

/**
 * Creates and displays a custom confirmation modal.
 * @param {string} title - The title of the confirmation.
 * @param {string} message - The message body of the confirmation.
 * @param {function} onConfirmCallback - Function to execute if user confirms.
 * @param {function} [onCancelCallback] - Optional function to execute if user cancels.
 */
function showConfirmModal(title, message, onConfirmCallback, onCancelCallback = () => { }) {
  // Remove any existing modal first to prevent duplicates
  let existingModal = document.getElementById('custom-confirm-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modalHTML = `
        <div id="custom-confirm-modal" class="modal" aria-labelledby="confirm-modal-title" aria-modal="true" role="dialog">
            <div class="modal-content card">
                <header class="modal-header">
                    <h3 id="confirm-modal-title" class="card-title">${title}</h3>
                    <button class="modal-close-btn" aria-label="Close dialog">&times;</button>
                </header>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <footer class="modal-footer">
                    <button id="confirm-yes-btn" class="btn btn-danger">Confirm</button>
                    <button id="confirm-no-btn" class="btn btn-secondary">Cancel</button>
                </footer>
            </div>
        </div>
    `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modalElement = document.getElementById('custom-confirm-modal');
  const confirmYesBtn = document.getElementById('confirm-yes-btn');
  const confirmNoBtn = document.getElementById('confirm-no-btn');
  const closeModalBtn = modalElement.querySelector('.modal-close-btn');
  const modalContent = modalElement.querySelector('.modal-content');

  // Show the modal container and trigger open animations
  modalElement.classList.remove('modal-closing-backdrop'); // Ensure no lingering closing class
  modalElement.classList.add('modal-active');
  modalContent.classList.remove('modal-closing'); // Ensure no lingering closing class
  modalContent.classList.add('modal-open');


  const closeAndCleanup = () => {
    // Trigger closing animations
    modalContent.classList.remove('modal-open');
    modalContent.classList.add('modal-closing');
    modalElement.classList.remove('modal-active');
    modalElement.classList.add('modal-closing-backdrop');

    // Wait for animations to finish before removing from DOM
    let animationEndCount = 0;
    const totalAnimations = 2; // one for modalContent, one for modalElement

    const onAnimationEnd = () => {
      animationEndCount++;
      if (animationEndCount === totalAnimations) {
        modalContent.removeEventListener('animationend', onContentAnimationEnd);
        modalElement.removeEventListener('animationend', onElementAnimationEnd);
        modalElement.remove(); // Remove modal from DOM after all animations
      }
    };

    const onContentAnimationEnd = (event) => {
      // Ensure this is the bounce animation, not some other child animation
      if (event.animationName === 'modalBounceOut' || event.animationName === 'fadeOut') {
        onAnimationEnd();
      }
    };

    const onElementAnimationEnd = (event) => {
      // Ensure this is the backdrop fade out
      if (event.animationName === 'fadeOut') {
        onAnimationEnd();
      }
    };

    modalContent.addEventListener('animationend', onContentAnimationEnd, { once: true });
    modalElement.addEventListener('animationend', onElementAnimationEnd, { once: true });
  };


  confirmYesBtn.addEventListener('click', () => {
    onConfirmCallback();
    closeAndCleanup();
  });

  confirmNoBtn.addEventListener('click', () => {
    onCancelCallback();
    closeAndCleanup();
  });

  closeModalBtn.addEventListener('click', () => {
    onCancelCallback();
    closeAndCleanup();
  });

  // Close modal if clicking outside content (on overlay)
  modalElement.addEventListener('click', (event) => {
    if (event.target === modalElement) { // Ensure click is on the modal container itself
      onCancelCallback();
      closeAndCleanup();
    }
  });
}


// Main event listener that runs when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', async () => {
  // Fetch configuration first
  await fetchAppConfig();

  // Initialize other parts of the application that might depend on appConfig
  initializePageSpecificFeatures(); // Encapsulate page-specific logic

  // Global mouse move listener for parallax effects - This updates the global variables
  window.addEventListener('mousemove', (event) => {
    const screenCenterX = window.innerWidth / 2;
    const screenCenterY = window.innerHeight / 2;
    // Update global parallax variables
    window.mouseParallaxX = (event.clientX - screenCenterX) * -0.005;
    window.mouseParallaxY = (event.clientY - screenCenterY) * -0.005;
  });

  // Code for welcome page title animation.
  if (window.location.pathname.endsWith('/') || window.location.pathname.endsWith('index.html')) {
    const welcomeTitle = document.querySelector('.welcome-title');
    if (welcomeTitle) {
      const letters = welcomeTitle.querySelectorAll('span');
      letters.forEach((span, index) => {
        span.style.setProperty('--letter-index', index);
      });
    }
  }

  // --- Okta Authorization Code Flow Login Setup ---
  if (window.location.pathname.endsWith('login.html')) {
    const oktaLoginButton = document.getElementById('okta-login-button'); // Updated ID

    if (oktaLoginButton) {
      // Event listener for global background logo animation on button hover
      const formWrapper = document.querySelector('.login-wrapper'); // Parent of bg-logos
      if (formWrapper) {
        oktaLoginButton.addEventListener('mouseenter', () => {
          formWrapper.classList.add('hovered-by-button');
        });
        oktaLoginButton.addEventListener('mouseleave', () => {
          formWrapper.classList.remove('hovered-by-button');
        });
      }

      oktaLoginButton.addEventListener('click', async () => {
        if (!appConfig.oktaDomain || !appConfig.oktaClientId) {
          showToast('Okta configuration is missing. Cannot initiate login.', 'error');
          console.error('Okta configuration (domain or client ID) not available for login.');
          return;
        }

        const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('okta_state', state); // Use okta_state

        // Construct Okta authorize URL
        const oktaAuthorizeUrl = `https://${appConfig.oktaDomain}/oauth2/default/v1/authorize?` +
          `response_type=code&` +
          `client_id=${appConfig.oktaClientId}&` +
          `redirect_uri=${encodeURIComponent(OKTA_REDIRECT_URI)}&` + // Use OKTA_REDIRECT_URI
          `scope=openid%20profile%20email%20offline_access%20groups&` + // Added 'groups' for roles
          (appConfig.oktaAudience ? `audience=${encodeURIComponent(appConfig.oktaAudience)}&` : '') + // Audience might be handled differently by Okta or not needed for default server
          `state=${state}`;

        oktaLoginButton.classList.add('loading');
        const errorMessageElement = document.getElementById('error-message');
        if (errorMessageElement) {
          errorMessageElement.textContent = '';
          errorMessageElement.className = 'error-message'; // Reset class if it was 'error'
        }

        window.location.href = oktaAuthorizeUrl; // Redirect to Okta Universal Login
      });
    }
  }

  // --- Callback Handler for Okta Redirect ---
  if (window.location.pathname.endsWith('callback.html')) {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    const storedState = localStorage.getItem('okta_state'); // Retrieve stored okta_state

    if (error) {
      showToast(`Okta Error: ${errorDescription || error}`, 'error');
      console.error('Okta Callback Error:', error, errorDescription);
      window.location.href = 'login.html';
      return;
    }

    if (!state || state !== storedState) {
      showToast('Invalid state parameter. Possible CSRF attack detected.', 'error');
      console.error('State mismatch: Expected', storedState, 'Received', state);
      localStorage.removeItem('okta_state'); // Clear potentially compromised state
      window.location.href = 'login.html';
      return;
    }

    localStorage.removeItem('okta_state'); // State has been used, clear it

    if (code) {
      showToast('Authentication successful, exchanging code with backend...', 'info');
      exchangeCodeWithBackend(code);
    } else {
      showToast('No authorization code found in callback URL.', 'error');
      window.location.href = 'login.html';
    }
  }

  /**
   * Helper function to send the authorization code to the backend for token exchange.
   * @param {string} code - The authorization code received from Okta.
   */
  async function exchangeCodeWithBackend(code) {
    if (!OKTA_REDIRECT_URI) {
        console.error("OKTA_REDIRECT_URI is not defined. Cannot exchange code.");
        showToast('Configuration error: Redirect URI is missing.', 'error');
        window.location.href = 'login.html';
        return;
    }
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: OKTA_REDIRECT_URI }) // Use OKTA_REDIRECT_URI
      });

      if (response.ok) {
        const user = await response.json();
        localStorage.setItem('authenticatedUser', JSON.stringify(user));
        console.log('User data received from backend after code exchange and stored:', user);
        showToast('Successfully logged in!', 'success');
        window.location.href = 'protected.html';
      } else {
        const error = await response.json().catch(() => ({ error: 'Unknown error from backend.' }));
        showToast(`Login failed: ${error.error || 'Server error during code exchange.'}`, 'error');
        console.error('Backend code exchange failed:', error);
        window.location.href = 'login.html';
      }
    } catch (error) {
      console.error('Network error during code exchange:', error);
      showToast('Network error during login process.', 'error');
      window.location.href = 'login.html';
    }
  }


  // Add event listener for the global logout button if it exists.
  const globalLogoutButton = document.getElementById('logout-button');
  if (globalLogoutButton) {
    globalLogoutButton.addEventListener('click', logout);
  }

  // Add ripple effect to all buttons
  document.querySelectorAll('.btn').forEach(button => {
    button.addEventListener('click', function (e) {
      // Only apply ripple if not loading
      if (!this.classList.contains('loading')) {
        this.classList.add('ripple-active');
        // Remove the class after the animation to allow it to be re-triggered
        this.addEventListener('animationend', () => {
          this.classList.remove('ripple-active');
        }, { once: true });
      }
    });
  });


  // Setup for the Admin Group Management page (admin-group.html).
  if (window.location.pathname.endsWith('admin-group.html')) {
    const addToAdminRoleButton = document.getElementById('add-to-admin-role-button');
    const removeFromAdminRoleButton = document.getElementById('remove-from-admin-role-button');
    const userIdInput = document.getElementById('admin-role-userId');
    const messageDiv = document.getElementById('admin-role-message'); // Renamed from messageDiv for clarity
    const loadAdminUsersButton = document.getElementById('load-admin-users-button');
    const adminUsersList = document.getElementById('admin-users-list');
    const loadAdminUsersMessage = document.getElementById('load-admin-users-message');

    async function manageAdminRole(action, buttonElement) {
      const userIdToManage = userIdInput.value;
      if (userIdToManage) {
        try {
          if (buttonElement) buttonElement.classList.add('loading');
          const response = await fetch('/api/okta-user-management', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, userId: userIdToManage, roles: ['admin'] })
          });

          if (response.ok) {
            const successMessage = action === 'assignRoles' ? 'User added to admin role successfully.' : 'User removed from admin role successfully.';
            showToast(successMessage, 'success'); // Use toast for success
            userIdInput.value = ''; // Clear input
            loadAdminUsers(); // Refresh the list
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown server error.' }));
            showToast(`Failed to update roles: ${errorData.error || 'Server error'}`, 'error'); // Use toast for error
          }
        } catch (error) {
          console.error("Error updating roles:", error);
          showToast('Client-side error: ' + error.message, 'error'); // Use toast for network errors
        } finally {
          if (buttonElement) buttonElement.classList.remove('loading');
        }
      } else {
        showToast('Please enter a User ID (Auth0 `sub`).', 'error'); // Use toast for validation
      }
    }

    if (addToAdminRoleButton) {
      addToAdminRoleButton.addEventListener('click', () => manageAdminRole('assignRoles', addToAdminRoleButton));
    }
    if (removeFromAdminRoleButton) {
      removeFromAdminRoleButton.addEventListener('click', () => manageAdminRole('unassignRoles', removeFromAdminRoleButton));
    }

    async function loadAdminUsers() {
      displayMessage(loadAdminUsersMessage, 'Loading admin users...', 'info');
      adminUsersList.innerHTML = '';
      if (loadAdminUsersButton) loadAdminUsersButton.classList.add('loading');

      try {
        const response = await fetch('/api/okta-user-management?action=listUsersInRole&roleName=admin');
        if (response.ok) {
          const users = await response.json();
          if (users.length === 0) {
            adminUsersList.innerHTML = '<li>No users currently in the admin role.</li>';
          } else {
            users.forEach((user, index) => {
              const li = document.createElement('li');
              li.textContent = `${user.name || user.email} (ID: ${user.user_id || user.id})`;
              li.classList.add('animated-item'); // Add class for animation
              li.style.setProperty('--item-index', `${index * 0.05}s`); // Set delay for staggered animation
              adminUsersList.appendChild(li);
            });
          }
          displayMessage(loadAdminUsersMessage, '', 'info');
        } else {
          const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
          displayMessage(loadAdminUsersMessage, `Error: ${error.error || 'Failed to load admin users.'}`, 'error');
        }
      } catch (err) {
        console.error("Load admin users error:", err);
        displayMessage(loadAdminUsersMessage, `Network error: ${err.message}`, 'error');
      } finally {
        if (loadAdminUsersButton) loadAdminUsersButton.classList.remove('loading');
      }
    }

    if (loadAdminUsersButton) {
      loadAdminUsersButton.addEventListener('click', loadAdminUsers);
      // Trigger initial load on page load if the list is empty (optional)
      if (adminUsersList.children.length === 0) { // Check if the container has content
        loadAdminUsers();
      }
    }
  }

  // Setup for the Admin User CRUD page (admin-user-crud.html).
  if (window.location.pathname.endsWith('admin-user-crud.html')) {
    const createUserForm = document.getElementById('create-user-form');
    const createMessage = document.getElementById('create-message');
    const loadUsersButton = document.getElementById('load-users-button');
    const userListContainer = document.getElementById('user-list-container');
    const listMessage = document.getElementById('list-message');
    const userListSkeleton = document.getElementById('user-list-skeleton'); // Skeleton loader

    const editModal = document.getElementById('edit-user-modal');
    const editUserIdInput = document.getElementById('edit-userId');
    const editFirstNameInput = document.getElementById('edit-firstName');
    const editLastNameInput = document.getElementById('edit-lastName');
    const editEmailInput = document.getElementById('edit-email');
    const saveEditButton = document.getElementById('save-edit-button');
    const editMessage = document.getElementById('edit-message');
    const createUserSubmitButton = createUserForm ? createUserForm.querySelector('button[type="submit"]') : null;

    // --- Modal Control Functions for Edit User Modal ---
    function showEditModal() {
      if (editModal) {
        const modalContent = editModal.querySelector('.modal-content');
        // Ensure no closing animation classes are present
        editModal.classList.remove('modal-closing-backdrop');
        modalContent.classList.remove('modal-closing');

        editModal.style.display = 'flex'; // Make it visible
        editModal.classList.add('modal-active'); // Activate backdrop fade-in
        modalContent.classList.add('modal-open'); // Trigger content bounce-in
      }
    }

    function closeEditModal() {
      if (editModal) {
        const modalContent = editModal.querySelector('.modal-content');

        // Trigger closing animations
        modalContent.classList.remove('modal-open');
        modalContent.classList.add('modal-closing');
        editModal.classList.remove('modal-active'); // Start backdrop fade-out
        editModal.classList.add('modal-closing-backdrop');

        // Wait for both animations to finish before hiding display
        let animationEndCount = 0;
        const totalAnimations = 2; // For modalContent and editModal (backdrop)

        const onAnimationEnd = () => {
          animationEndCount++;
          if (animationEndCount === totalAnimations) {
            modalContent.removeEventListener('animationend', onContentAnimationEnd);
            editModal.removeEventListener('animationend', onElementAnimationEnd);
            editModal.style.display = 'none'; // Finally hide the modal
            // Clean up closing classes
            modalContent.classList.remove('modal-closing');
            editModal.classList.remove('modal-closing-backdrop');
          }
        };

        const onContentAnimationEnd = (event) => {
          // Ensure this is the correct animation (e.g., modalBounceOut or fadeOut)
          if (event.animationName === 'modalBounceOut' || event.animationName === 'fadeOut') {
            onAnimationEnd();
          }
        };

        const onElementAnimationEnd = (event) => {
          // Ensure this is the correct animation (e.g., fadeOut for backdrop)
          if (event.animationName === 'fadeOut') {
            onAnimationEnd();
          }
        };

        modalContent.addEventListener('animationend', onContentAnimationEnd, { once: true });
        editModal.addEventListener('animationend', onElementAnimationEnd, { once: true });
      }
    }
    // Make closeEditModal globally accessible for HTML `onclick` (if any, though prefer JS listener)
    window.closeEditModal = closeEditModal;


    if (createUserForm) {
      createUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        displayMessage(createMessage, 'Creating user...', 'info');

        const userData = {
          firstName: document.getElementById('firstName').value,
          lastName: document.getElementById('lastName').value,
          email: document.getElementById('email').value,
          password: document.getElementById('password').value
        };

        if (createUserSubmitButton) createUserSubmitButton.classList.add('loading');
        try {
          const response = await fetch('/api/okta-user-management', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'createUser', userData })
          });

          if (response.ok) {
            const newUser = await response.json();
            showToast(`User ${newUser.email} created successfully!`, 'success'); // Use toast
            createUserForm.reset();
            loadUsers();
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            displayMessage(createMessage, `Error: ${error.error || error.message || 'Failed to create user.'}`, 'error', 'message-area', 0, true); // Shake on error
          }
        } catch (err) {
          console.error("Create user network error:", err);
          displayMessage(createMessage, `Network error: ${err.message}`, 'error', 'message-area', 0, true); // Shake on error
        } finally {
          if (createUserSubmitButton) createUserSubmitButton.classList.remove('loading');
        }
      });
    }

    async function loadUsers() {
      displayMessage(listMessage, 'Loading users...', 'info');
      userListContainer.innerHTML = ''; // Clear existing
      if (loadUsersButton) loadUsersButton.classList.add('loading');
      if (userListSkeleton) userListSkeleton.style.display = 'flex'; // Show skeleton

      try {
        const response = await fetch('/api/okta-user-management?action=listUsers');
        if (response.ok) {
          const users = await response.json();
          if (users.length === 0) {
            userListContainer.innerHTML = '<p>No users found.</p>';
          } else {
            const ul = document.createElement('ul');
            ul.className = 'styled-list item-list';
            users.forEach((user, index) => {
              const li = document.createElement('li');
              const userId = user.user_id || user.id || user.sub;
              const firstName = user.given_name || '';
              const lastName = user.family_name || '';
              const email = user.email || '';

              li.innerHTML = `
                <div class="user-item-info">
                  <span class="user-name">${firstName} ${lastName}</span>
                  <span class="user-email">${email}</span>
                  <span class="user-id">Auth0 ID: ${userId}</span>
                </div>
                <div class="user-item-actions">
                  <button data-userid="${userId}" data-firstname="${firstName}" data-lastname="${lastName}" data-email="${email}" class="edit-user-btn btn btn-secondary btn-sm">Edit</button>
                  <button data-userid="${userId}" class="delete-user-btn btn btn-danger btn-sm">Delete</button>
                </div>
              `;
              li.classList.add('animated-item'); // Add class for animation
              li.style.setProperty('--item-index', `${index * 0.05}s`); // Set delay for staggered animation
              ul.appendChild(li);
            });
            userListContainer.appendChild(ul);

            document.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', handleEditUser));
            document.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', handleDeleteUser));
          }
          displayMessage(listMessage, '', 'info');
        } else {
          const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
          displayMessage(listMessage, `Error loading users: ${error.error || error.message || 'Failed to load users.'}`, 'error');
        }
      } catch (err) {
        console.error("Load users network error:", err);
        displayMessage(listMessage, `Network error: ${err.message}`, 'error');
      } finally {
        if (loadUsersButton) loadUsersButton.classList.remove('loading');
        if (userListSkeleton) userListSkeleton.style.display = 'none'; // Hide skeleton
      }
    }

    if (loadUsersButton) {
      loadUsersButton.addEventListener('click', loadUsers);
      // Trigger initial load on page load if the list is empty (optional)
      if (userListContainer.children.length === 0) { // Check if the container has content
        loadUsers();
      }
    }

    // Event listener for the 'x' button on the edit modal
    const editModalCloseBtn = editModal.querySelector('.modal-close-btn');
    if (editModalCloseBtn) {
      editModalCloseBtn.addEventListener('click', closeEditModal);
    }
    // Event listener for clicking outside the modal content (on the overlay)
    editModal.addEventListener('click', (event) => {
      if (event.target === editModal) { // Check if the click was directly on the modal backdrop
        closeEditModal();
      }
    });


    function handleEditUser(event) {
      const btn = event.target.closest('.edit-user-btn');
      if (!btn) return;

      editUserIdInput.value = btn.dataset.userid;
      editFirstNameInput.value = btn.dataset.firstname;
      editLastNameInput.value = btn.dataset.lastname;
      editEmailInput.value = btn.dataset.email;

      displayMessage(editMessage, '', 'info');
      showEditModal(); // Call the new function to show modal smoothly
    }

    if (saveEditButton) {
      saveEditButton.addEventListener('click', async () => {
        const userIdToUpdate = editUserIdInput.value;
        const updates = {
          given_name: editFirstNameInput.value,
          family_name: editLastNameInput.value
        };
        displayMessage(editMessage, 'Saving changes...', 'info');

        if (saveEditButton) saveEditButton.classList.add('loading');
        try {
          const response = await fetch('/api/okta-user-management', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'updateUser', userId: userIdToUpdate, updates })
          });

          if (response.ok) {
            showToast('User updated successfully!', 'success'); // Use toast
            closeEditModal();
            loadUsers();
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
            displayMessage(editMessage, `Error: ${error.error || error.message || 'Failed to update user.'}`, 'error', 'message-area', 0, true); // Shake on error
          }
        } catch (err) {
          console.error("Update user network error:", err);
          displayMessage(editMessage, `Network error: ${err.message}`, 'error', 'message-area', 0, true); // Shake on error
        } finally {
          if (saveEditButton) saveEditButton.classList.remove('loading');
        }
      });
    }

    async function handleDeleteUser(event) {
      const btn = event.target.closest('.delete-user-btn');
      if (!btn) return;
      const userIdToDelete = btn.dataset.userid;

      // Replace confirm() with custom modal
      showConfirmModal(
        'Confirm Deletion',
        `Are you sure you want to delete user with ID: ${userIdToDelete}? This action cannot be undone.`,
        async () => { // On Confirm Callback
          displayMessage(listMessage, 'Deleting user...', 'info');
          btn.classList.add('loading');
          try {
            const response = await fetch('/api/okta-user-management', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'deleteUser', userId: userIdToDelete })
            });

            if (response.ok) {
              showToast('User deleted successfully.', 'success'); // Use toast
              loadUsers();
            } else {
              const error = await response.json().catch(() => ({ error: 'Failed to parse error response.' }));
              displayMessage(listMessage, `Error deleting user: ${error.error || error.message || 'Failed to delete.'}`, 'error', 'message-area', 0, true); // Shake on error
            }
          } catch (err) {
            console.error("Delete user network error:", err);
            displayMessage(listMessage, `Network error: ${err.message}`, 'error');
          } finally {
            btn.classList.remove('loading');
          }
        }
      );
    }
  }

  // Call checkAuthAndRedirect after config is potentially loaded and auth state might be processed.
  // It's now called within initializePageSpecificFeatures or similar logic that runs after fetchAppConfig.


  // ************* Animations   *************** //

  /**
  * This function makes a given HTML element move to random positions within the visible browser window.
  * Each element animated by this function will move independently, with its own random initial delay
  * and subsequent random intervals between movements, ensuring they don't move in sync.
  *
  * @param {HTMLElement} element - The HTML element to be animated.
  */
  // Adjusted function to use global parallax values
  function moveLandingPageElementIndependently() {
    const els = [...document.querySelectorAll('.scene-element')];
    if (els.length === 0) return; // Don't run if no elements are present

    const scene = { w: window.innerWidth, h: window.innerHeight };
    window.onresize = () => {
      scene.w = window.innerWidth;
      scene.h = window.innerHeight;
    };

    const objs = els.map((el, index) => ({
      el,
      w: el.offsetWidth,
      h: el.offsetHeight,
      baseX: Math.random() * (scene.w - el.offsetWidth), // Base X for random movement
      baseY: Math.random() * (scene.h - el.offsetHeight),// Base Y for random movement
      vx: (Math.random() - 0.5) * 1, // Reduced speed for random drift
      vy: (Math.random() - 0.5) * 1, // Reduced speed for random drift
      angle: Math.random() * 360,
      rotationSpeed: 0.2 + Math.random() * 0.5, // Slower rotation
      morphSpeed: 600 + Math.random() * 800, // Slower morphing
      morphPhase: Math.random() * 2 * Math.PI,
      // Increased depthMultiplier range for more pronounced parallax on some elements
      depthMultiplier: 0.2 + Math.random() * 1.3 // Random depth (0.2 to 1.5)
    }));

    function animate(time = 0) {
      objs.forEach(o => {
        // Update base position for random drift
        o.baseX += o.vx;
        o.baseY += o.vy;
        if (o.baseX < 0 || o.baseX + o.w > scene.w) o.vx *= -1;
        if (o.baseY < 0 || o.baseY + o.h > scene.h) o.vy *= -1; // Corrected: o.y to o.baseY

        o.angle = (o.angle + o.rotationSpeed) % 360;
        const morphProgress = Math.sin((time / o.morphSpeed) + o.morphPhase);
        const scale = 0.95 + 0.05 * morphProgress; // More subtle scale

        // Combine base random position with mouse-driven parallax
        // Use the globally updated mouseParallaxX and mouseParallaxY
        const currentX = o.baseX + (window.mouseParallaxX || 0) * o.depthMultiplier * (scene.w / 150); // Adjusted scaling factor
        const currentY = o.baseY + (window.mouseParallaxY || 0) * o.depthMultiplier * (scene.h / 150); // Adjusted scaling factor


        o.el.style.transform = `translate(${currentX}px,${currentY}px) scale(${scale}) rotate(${o.angle}deg)`;

        // Morph border-radius with randomized morphing
        const r1 = 30 + 20 * Math.abs(morphProgress); // Adjusted morphing parameters
        const r2 = 100 - r1;
        o.el.style.borderRadius = `${r1}% ${r2}% ${r2}% ${r1}% / ${r2}% ${r1}% ${r1}% ${r2}%`;
      });
      requestAnimationFrame(animate);
    }
    animate();
  }


  /**
   * Initializes the tilt effect for specified card-like elements.
   * On mousemove, elements tilt slightly. On mouseleave, they reset.
   */
  function initTiltEffect() {
    const tiltElements = document.querySelectorAll(
      '.card, .feature-card, .welcome-page .welcome-content-card, .login-page .form-container'
    );

    tiltElements.forEach(element => {
      element.addEventListener('mousemove', (event) => {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left; // x position within the element.
        const y = event.clientY - rect.top;  // y position within the element.

        const elementWidth = rect.width;
        const elementHeight = rect.height;

        const centerX = elementWidth / 2;
        const centerY = elementHeight / 2;

        let maxRotate = 2; // Default subtle rotation
        let scaleAmount = 1.005; // Default subtle scale

        if (element.classList.contains('admin-showcase-tilt')) {
          maxRotate = 7; // More pronounced rotation for showcase cards
          scaleAmount = 1.03; // More pronounced scale for showcase cards
        }

        const rotateX = ((y - centerY) / (elementHeight / 2)) * -maxRotate;
        const rotateY = ((x - centerX) / (elementWidth / 2)) * maxRotate;

        element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(${scaleAmount}, ${scaleAmount}, ${scaleAmount})`;
      });

      element.addEventListener('mouseleave', () => {
        // Reset transform to default
        // Note: If different resting scales were desired for different cards, this would also need to be conditional.
        // For now, all reset to scale(1). CSS :hover will apply its own scale if mouse re-enters.
        element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      });
    });
  }
  initTiltEffect();

  /**
   * Applies the selected theme to the document body.
   * @param {string} theme - The theme to apply ('light-mode' or 'dark-mode').
   */
  function applyTheme(theme) {
    if (theme === 'dark-mode') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  /**
   * Toggles the theme between light and dark mode.
   * Updates localStorage and the toggle switch's state.
   */
  function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light-mode';
    const newTheme = currentTheme === 'dark-mode' ? 'light-mode' : 'dark-mode';

    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    const themeCheckbox = document.getElementById('theme-checkbox');
    if (themeCheckbox) {
      themeCheckbox.checked = (newTheme === 'dark-mode');
    }
  }

  /**
   * Initializes the theme toggle functionality.
   * Sets the initial theme based on localStorage and attaches event listeners.
   */
  function initThemeToggle() {
    const themeCheckbox = document.getElementById('theme-checkbox');
    const storedTheme = localStorage.getItem('theme') || 'light-mode';

    applyTheme(storedTheme);

    if (themeCheckbox) {
      themeCheckbox.checked = (storedTheme === 'dark-mode');
      themeCheckbox.addEventListener('change', toggleTheme);
    }
  }
  initThemeToggle(); // Initialize theme toggle on DOMContentLoaded

  // Encapsulate page-specific initializations
  function initializePageSpecificFeatures() {
    // Call checkAuthAndRedirect on every page load after config is fetched.
    checkAuthAndRedirect();

    // Initialize animations only if relevant elements are on the page
    if (document.querySelector('.scene-element')) {
        moveLandingPageElementIndependently();
    }
    // Other initializations that depend on DOM elements specific to certain pages
  }
});