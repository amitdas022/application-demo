// Set this global variable to true in your browser's developer console
// (e.g., window.LOCAL_TESTING_MODE = true;) to bypass Okta authentication checks.
// Remember to remove or set to false for production/actual testing.
// Removed Okta Auth JS initialization

// Function to handle login by sending credentials to backend
async function login(username, password, errorMessageElement) {
  try {
    const response = await fetch('/api/auth', { // Call backend auth endpoint
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (response.ok) {
      const user = await response.json();
      // Store user info locally (e.g., localStorage) - NOT SECURE FOR SENSITIVE DATA IN PRODUCTION
      localStorage.setItem('authenticatedUser', JSON.stringify(user));
      window.location.href = 'protected.html';
    } else {
      const error = await response.json().catch(() => ({ error: 'Unknown error from server.' }));
      errorMessageElement.textContent = `Login failed: ${error.error || 'Invalid credentials.'}`;
    }
  } catch (error) {
    console.error('Login error:', error);
    displayError('Invalid credentials or error during login.');
  }
}

async function logout() {
  // Clear local storage user info
  localStorage.removeItem('authenticatedUser');
  // In a real app with server-side sessions, you'd call a backend logout endpoint here
  // await fetch('/api/logout', { method: 'POST' });
  window.location.href = 'index.html';
}

// checkAuth function now checks local storage instead of Okta Auth JS
// This is the single source of truth for client-side auth checks.
async function checkAuth() {
    // --- Start Local Testing Bypass (Frontend Only) ---
    if (window.LOCAL_TESTING_MODE) {
        console.warn("LOCAL_TESTING_MODE is active. Bypassing client-side authentication.");
        // Simulate a user object for UI elements if needed
        // If you want to test non-admin views in LOCAL_TESTING_MODE,
        // ensure the dummyUser here does NOT have 'AdminGroup'.
        // Or, introduce another flag like window.LOCAL_TESTING_AS_ADMIN
        if (!localStorage.getItem('authenticatedUser')) {
            // Default dummy user for LOCAL_TESTING_MODE (non-admin)
            const dummyUser = { id: 'test-user-123', profile: { firstName: 'Local', lastName: 'Tester', name: 'Local Tester', email: 'test@example.com' }, groups: ['Everyone'] };
            localStorage.setItem('authenticatedUser', JSON.stringify(dummyUser));
        }
        // Do not return here if you want the rest of the logic (like admin checks) to run with the dummy user.
    }
    // --- End Local Testing Bypass ---

    const authenticatedUser = JSON.parse(localStorage.getItem('authenticatedUser'));

    if (authenticatedUser) {
        // User is "authenticated" based on local storage
        const usernameEl = document.getElementById('username');
        if (usernameEl && authenticatedUser.profile) {
             usernameEl.textContent = authenticatedUser.profile.name || authenticatedUser.profile.firstName || authenticatedUser.profile.email;
        }

        // Check for admin group membership from stored data
        const isAdmin = authenticatedUser.groups && authenticatedUser.groups.includes('AdminGroup'); // Replace 'AdminGroup'

        if (isAdmin) {
            if (window.location.pathname.endsWith('protected.html')) {
                window.location.href = 'admin.html'; // redirect to admin if on protected
            }
        } else {
            if (window.location.pathname.endsWith('admin.html') || window.location.pathname.endsWith('admin-group.html') || window.location.pathname.endsWith('admin-user-crud.html')) {
                window.location.href = 'protected.html'; // redirect from admin pages if not admin
            }
        }
    } else {
        // User is not authenticated (and not in LOCAL_TESTING_MODE with a dummy user),
        // redirect to login if not already on login or index page.
        if (!window.location.pathname.endsWith('login.html') && !window.location.pathname.endsWith('index.html')) {
            window.location.href = 'login.html';
        }
    }
}

function displayError(message) {
  const errorElement = document.getElementById('error-message');
  if (errorElement) {
    errorElement.textContent = message;
  }
}

// Event listeners and initial checks:
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.endsWith('login.html')) {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = loginForm.username.value;
        const password = loginForm.password.value;
        const errorMessageElement = document.getElementById('error-message');
        await login(username, password, errorMessageElement);
      });
    }
  }
  if (document.getElementById('logout-button')) {
    document.getElementById('logout-button').addEventListener('click', logout)
  }

  if (window.location.pathname.endsWith('admin-group.html')) {
    const addUserButton = document.getElementById('add-user-button')
    const addUserInput = document.getElementById('add-user-input')
    const messageDiv = document.getElementById('message')
    addUserButton.addEventListener('click', async () => {
      const userId = addUserInput.value;
      if (userId) {
        const authenticatedUser = JSON.parse(localStorage.getItem('authenticatedUser'));
        try {
          const response = await fetch('/api/okta-crud', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json', 'X-User-Id': authenticatedUser?.id
            },
            body: JSON.stringify({ action: 'addToAdminGroup', userId })
          });
          if (response.ok) {
            messageDiv.textContent = 'User added to admin group successfully'
            messageDiv.className = 'success'; // Use class for styling
          } else {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' })); // Graceful error parsing
            messageDiv.textContent = `Failed to add user: ${errorData.error || 'Server error'}`;
            messageDiv.className = 'error'; // Use class for styling
          }
        } catch (error) {
          console.error("Error adding to group:", error)
          messageDiv.textContent = 'Error: ' + error.message
          messageDiv.className = 'error'; // Use class for styling
        }
      } else {
        messageDiv.textContent = 'Please enter a user ID.'
        messageDiv.className = 'error'; // Use class for styling
      }
    })
  }
  checkAuth();

  if (window.location.pathname.endsWith('admin-user-crud.html')) {
    // Ensure only admins can access this page (checkAuth should handle redirection if not admin)

    const createUserForm = document.getElementById('create-user-form');
    const createMessage = document.getElementById('create-message');
    const loadUsersButton = document.getElementById('load-users-button');
    const userListContainer = document.getElementById('user-list-container');
    const listMessage = document.getElementById('list-message');

    // Edit Modal Elements
    const editModal = document.getElementById('edit-user-modal');
    const editUserIdInput = document.getElementById('edit-userId');
    const editFirstNameInput = document.getElementById('edit-firstName');
    const editLastNameInput = document.getElementById('edit-lastName');
    const editEmailInput = document.getElementById('edit-email');
    const saveEditButton = document.getElementById('save-edit-button');
    const editMessage = document.getElementById('edit-message');


    // Create User
    if (createUserForm) {
      createUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        createMessage.textContent = '';
        createMessage.className = 'message'; // Reset class

        const userData = {
          profile: {
            firstName: document.getElementById('firstName').value,
            lastName: document.getElementById('lastName').value,
            email: document.getElementById('email').value,
            login: document.getElementById('email').value, // Okta requires login to be set, often same as email
          },
          credentials: {
            password: { value: document.getElementById('password').value }
          }
          // activate: true // Optional: to activate user immediately. Default is false (STAGED).
        };

        try {
          // For local dev, ensure this points to your local backend, e.g., 'http://localhost:3000/api/okta-crud'
          // For Vercel deployment, '/api/okta-crud' is correct.
          const response = await fetch('/api/okta-crud', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Id': authenticatedUser?.id },
            body: JSON.stringify({ action: 'createUser', userData })
          });
          if (response.ok) {
            const newUser = await response.json();
            createMessage.textContent = `User ${newUser.profile.firstName} created successfully (ID: ${newUser.id})`;
            createMessage.className = 'message success';
            createUserForm.reset();
            loadUsers(); // Refresh list
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response from server.'}));
            createMessage.textContent = `Error: ${error.error || 'Failed to create user.'} ${error.details || ''}`;
            createMessage.className = 'message error';
          }
        } catch (err) {
          console.error("Create user network error:", err);
          createMessage.textContent = `Network error: ${err.message}`;
          createMessage.className = 'message error';
        }
      });
    }

    // Load Users
    async function loadUsers() {
      listMessage.textContent = 'Loading users...';
      listMessage.className = 'message'; // Reset class
      userListContainer.innerHTML = ''; // Clear previous list

      try {
        // GET requests might not need user ID header depending on backend implementation
        const response = await fetch('/api/okta-crud?action=listUsers'); // GET request
        if (response.ok) {
          const users = await response.json();
          if (users.length === 0) {
            userListContainer.innerHTML = '<p>No users found.</p>';
          } else {
            const ul = document.createElement('ul');
            ul.style.listStyleType = 'none'; // Basic styling
            ul.style.paddingLeft = '0';
            users.forEach(user => {
              const li = document.createElement('li');
              li.style.marginBottom = '10px';
              li.style.padding = '10px';
              li.style.border = '1px solid #eee';
              li.style.borderRadius = '4px';
              li.innerHTML = `
                <strong>${user.profile.firstName} ${user.profile.lastName}</strong> (${user.profile.email || 'N/A'})<br>
                ID: ${user.id} - Status: ${user.status}
                <button data-userid="${user.id}" data-firstname="${user.profile.firstName}" data-lastname="${user.profile.lastName}" data-email="${user.profile.email || ''}" class="edit-user-btn button" style="font-size:0.8em; padding: 3px 6px; margin-left:10px; margin-top:5px;">Edit</button>
                <button data-userid="${user.id}" class="delete-user-btn button" style="font-size:0.8em; padding: 3px 6px; background-color:var(--error-color); margin-top:5px;">Delete</button>
              `;
              ul.appendChild(li);
            });
            userListContainer.appendChild(ul);

            // Add event listeners for new buttons
            document.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', handleEditUser));
            document.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', handleDeleteUser));
          }
          listMessage.textContent = '';
        } else {
          const error = await response.json().catch(() => ({ error: 'Failed to parse error response from server.'}));
          listMessage.textContent = `Error loading users: ${error.error || 'Failed to load users.'}`;
          listMessage.className = 'message error';
        }
      } catch (err) {
        console.error("Load users network error:", err);
        listMessage.textContent = `Network error: ${err.message}`;
        listMessage.className = 'message error';
      }
    }

    if (loadUsersButton) {
      loadUsersButton.addEventListener('click', loadUsers);
    }

    // Handle Edit User
    function handleEditUser(event) {
        const btn = event.target.closest('.edit-user-btn'); // Ensure we get the button if click is on inner element
        if (!btn) return;
        editUserIdInput.value = btn.dataset.userid;
        editFirstNameInput.value = btn.dataset.firstname;
        editLastNameInput.value = btn.dataset.lastname;
        editEmailInput.value = btn.dataset.email;
        editMessage.textContent = '';
        editMessage.className = 'message';
        if (editModal) editModal.style.display = 'block';
    }

    if (saveEditButton) {
        saveEditButton.addEventListener('click', async () => {
            const userId = editUserIdInput.value;
            const updates = {
                profile: {
                    firstName: editFirstNameInput.value,
                    lastName: editLastNameInput.value
                    // email: editEmailInput.value // Email/login updates are complex and often restricted.
                }
            };
            editMessage.textContent = 'Saving...';
            editMessage.className = 'message';
            const authenticatedUser = JSON.parse(localStorage.getItem('authenticatedUser'));

            try {
                const response = await fetch('/api/okta-crud', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'X-User-Id': authenticatedUser?.id }, // Include user ID for backend auth
                    body: JSON.stringify({ action: 'updateUser', userId, updates })
                });
                if (response.ok) {
                    editMessage.textContent = 'User updated successfully!';
                    editMessage.className = 'message success';
                    if (editModal) editModal.style.display = 'none';
                    loadUsers(); // Refresh the list
                } else {
                    const error = await response.json().catch(() => ({ error: 'Failed to parse error response from server.'}));
                    editMessage.textContent = `Error: ${error.error || 'Failed to update.'} ${error.details || ''}`;
                    editMessage.className = 'message error';
                }
            } catch (err) {
                console.error("Update user network error:", err);
                editMessage.textContent = `Network error: ${err.message}`;
                editMessage.className = 'message error';
            }
        });
    }

    // Handle Delete User
    async function handleDeleteUser(event) {
      const btn = event.target.closest('.delete-user-btn');
      if (!btn) return;
      const userId = btn.dataset.userid;
      if (confirm(`Are you sure you want to delete user ID: ${userId}? This is irreversible.`)) {
        listMessage.textContent = 'Deleting user...';
        listMessage.className = 'message';
        const authenticatedUser = JSON.parse(localStorage.getItem('authenticatedUser'));

        try {
          const response = await fetch('/api/okta-crud', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'X-User-Id': authenticatedUser?.id }, // Include user ID for backend auth
            body: JSON.stringify({ action: 'deleteUser', userId })
          });
          if (response.ok) {
            listMessage.textContent = 'User deleted successfully.';
            listMessage.className = 'message success';
            loadUsers(); // Refresh list
          } else {
            const error = await response.json().catch(() => ({ error: 'Failed to parse error response from server.'}));
            listMessage.textContent = `Error deleting user: ${error.error || 'Failed to delete.'} ${error.details || ''}`;
            listMessage.className = 'message error';
          }
        } catch (err) {
          console.error("Delete user network error:", err);
          listMessage.textContent = `Network error: ${err.message}`;
          listMessage.className = 'message error';
        }
      }
    }
    // Initial load of users if desired, or wait for button click
    // loadUsers(); 
  }
});
