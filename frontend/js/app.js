const API_URL = 'http://127.0.0.1:8000';
let allUsers = []; // Store all users for search/filter

// --- Toast Notification System ---
function showToast(title, message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// --- Utility Functions ---
function getHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function setLoading(buttonId, isLoading) {
    const btn = document.getElementById(buttonId);
    if (btn) {
        const text = btn.querySelector('.btn-text');
        const loader = btn.querySelector('.btn-loader');
        if (text && loader) {
            if (isLoading) {
                text.classList.add('hidden');
                loader.classList.remove('hidden');
                btn.disabled = true;
            } else {
                text.classList.remove('hidden');
                loader.classList.add('hidden');
                btn.disabled = false;
            }
        }
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
    } else {
        input.type = 'password';
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// --- Auth Page Logic ---
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    if (tab === 'login') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
}

// Login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    setLoading('loginBtn', true);

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', data.role);
            localStorage.setItem('userId', data.user_id);
            localStorage.setItem('userName', data.name);
            localStorage.setItem('userEmail', data.email);
            
            showToast('Welcome Back!', `Logged in as ${data.name}`, 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
        } else {
            showToast('Login Failed', data.detail || 'Invalid credentials', 'error');
        }
    } catch (err) {
        showToast('Connection Error', 'Backend is not running!', 'error');
    } finally {
        setLoading('loginBtn', false);
    }
});

// Register
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const role = document.getElementById('regRole').value;

    // Validate passwords match
    if (password !== confirmPassword) {
        showToast('Validation Error', 'Passwords do not match!', 'error');
        return;
    }

    setLoading('registerBtn', true);

    try {
        const res = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });
        const data = await res.json();

        if (res.ok) {
            showToast('Success!', 'Account created successfully. Please login.', 'success');
            setTimeout(() => {
                switchTab('login');
                document.getElementById('registerForm').reset();
            }, 2000);
        } else {
            showToast('Registration Failed', data.detail || 'Email already exists', 'error');
        }
    } catch (err) {
        showToast('Connection Error', 'Backend is not running!', 'error');
    } finally {
        setLoading('registerBtn', false);
    }
});

// --- Dashboard Logic ---
function checkAuth() {
    if (!localStorage.getItem('token')) {
        window.location.href = 'index.html';
    }
}

function logout() {
    localStorage.clear();
    showToast('Logged Out', 'You have been successfully logged out', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

async function loadDashboard() {
    checkAuth();
    const role = localStorage.getItem('role');
    const userId = localStorage.getItem('userId');
    const userName = localStorage.getItem('userName') || 'User';
    
    document.getElementById('navUserName').textContent = `Hi, ${userName}`;
    document.getElementById('navUserRole').textContent = role;
    document.getElementById('navUserRole').className = `role-badge ${role}`;

    if (role === 'admin') {
        document.getElementById('adminView').classList.remove('hidden');
        await loadAllUsers();
    } else {
        document.getElementById('userView').classList.remove('hidden');
        await loadUserProfile(userId);
    }
}

async function loadAllUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr class="loading-row"><td colspan="6" class="text-center">Loading users...</td></tr>';

    try {
        const res = await fetch(`${API_URL}/users`, { headers: getHeaders() });
        if (res.ok) {
            allUsers = await res.json();
            renderUsersTable(allUsers);
            updateStats(allUsers);
        } else {
            showToast('Error', 'Failed to load users', 'error');
            tbody.innerHTML = '';
        }
    } catch (err) {
        showToast('Connection Error', 'Cannot connect to server', 'error');
        tbody.innerHTML = '';
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    const emptyState = document.getElementById('emptyState');
    
    if (users.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const tr = document.createElement('tr');
        const createdAt = new Date(user.created_at).toLocaleDateString();
        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td><span class="role-badge ${user.role}">${user.role}</span></td>
            <td>${createdAt}</td>
            <td>
                <button class="btn-edit" onclick="openEditUserModal(${user.id})">Edit</button>
                <button class="btn-delete" onclick="deleteUser(${user.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateStats(users) {
    const adminCount = users.filter(u => u.role === 'admin').length;
    const userCount = users.filter(u => u.role === 'user').length;
    
    document.getElementById('statTotal').textContent = users.length;
    document.getElementById('statAdmins').textContent = adminCount;
    document.getElementById('statUsers').textContent = userCount;
}

function searchUsers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allUsers.filter(user => 
        user.name.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        user.role.toLowerCase().includes(searchTerm)
    );
    renderUsersTable(filtered);
}

async function loadUserProfile(userId) {
    try {
        const res = await fetch(`${API_URL}/users/${userId}`, { headers: getHeaders() });
        if (res.ok) {
            const user = await res.json();
            document.getElementById('profileName').textContent = user.name;
            document.getElementById('profileEmail').textContent = user.email;
            document.getElementById('profileRole').textContent = user.role;
            document.getElementById('profileRoleDisplay').textContent = user.role;
            document.getElementById('profileNameDisplay').textContent = user.name;
            document.getElementById('profileAvatar').textContent = user.name.charAt(0).toUpperCase();
            
            const createdAt = new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            document.getElementById('profileCreatedAt').textContent = createdAt;
            
            // Pre-fill edit form
            document.getElementById('editProfileName').value = user.name;
        }
    } catch (err) {
        showToast('Error', 'Failed to load profile', 'error');
    }
}

// --- Admin: Edit User Modal ---
function openEditUserModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    document.getElementById('editUserId').value = user.id;
    document.getElementById('editName').value = user.name;
    document.getElementById('editEmail').value = user.email;
    document.getElementById('editRole').value = user.role;
    
    document.getElementById('editUserModal').classList.remove('hidden');
}

document.getElementById('editUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = parseInt(document.getElementById('editUserId').value);
    const updatedData = {
        name: document.getElementById('editName').value,
        email: document.getElementById('editEmail').value,
        role: document.getElementById('editRole').value
    };

    try {
        const res = await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(updatedData)
        });
        
        if (res.ok) {
            showToast('Success', 'User updated successfully', 'success');
            closeModal('editUserModal');
            await loadAllUsers();
        } else {
            const data = await res.json();
            showToast('Error', data.detail || 'Failed to update user', 'error');
        }
    } catch (err) {
        showToast('Connection Error', 'Cannot connect to server', 'error');
    }
});

// --- User: Edit Profile Modal ---
function openEditProfileModal() {
    document.getElementById('editProfileModal').classList.remove('hidden');
}

document.getElementById('editProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = parseInt(localStorage.getItem('userId'));
    const newName = document.getElementById('editProfileName').value;

    try {
        const res = await fetch(`${API_URL}/users/${userId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ name: newName })
        });
        
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('userName', data.name);
            document.getElementById('navUserName').textContent = `Hi, ${data.name}`;
            showToast('Success', 'Profile updated successfully', 'success');
            closeModal('editProfileModal');
            await loadUserProfile(userId);
        } else {
            const data = await res.json();
            showToast('Error', data.detail || 'Failed to update profile', 'error');
        }
    } catch (err) {
        showToast('Connection Error', 'Cannot connect to server', 'error');
    }
});

// --- Change Password Modal ---
function openChangePasswordModal() {
    document.getElementById('changePasswordModal').classList.remove('hidden');
}

document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmNewPassword) {
        showToast('Validation Error', 'New passwords do not match!', 'error');
        return;
    }

    if (newPassword.length < 6) {
        showToast('Validation Error', 'Password must be at least 6 characters', 'error');
        return;
    }

    // Note: You'll need to add a PUT /users/{id}/password endpoint to your backend
    // For now, this is a placeholder
    showToast('Info', 'Password change feature requires backend update', 'warning');
    closeModal('changePasswordModal');
});

// --- Delete User ---
async function deleteUser(userId) {
    const currentUserId = parseInt(localStorage.getItem('userId'));
    
    if (userId === currentUserId) {
        showToast('Error', 'You cannot delete your own account', 'error');
        return;
    }

    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        
        if (res.ok) {
            showToast('Success', 'User deleted successfully', 'success');
            await loadAllUsers();
        } else {
            const data = await res.json();
            showToast('Error', data.detail || 'Failed to delete user', 'error');
        }
    } catch (err) {
        showToast('Connection Error', 'Cannot connect to server', 'error');
    }
}

// --- Add User Modal (Admin) ---
function openAddUserModal() {
    // For simplicity, redirect to register page or implement a modal similar to edit
    showToast('Info', 'Use the Register page to add new users', 'info');
}

// Close modals on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.add('hidden');
    }
}

// Initialize Dashboard
if (window.location.pathname.includes('dashboard.html')) {
    loadDashboard();
}