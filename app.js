// API konfigürasyonu
const API_CONFIG = {
    BASE_URL: '/api',
    ENDPOINTS: {
        USERS: '/users'
    }
};

// Global state
let state = {
    users: [],
    filteredUsers: [],
    loading: false,
    error: null
};

// DOM elementleri
const elements = {
    usersGrid: document.getElementById('users-grid'),
    stats: document.getElementById('stats'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    errorMessage: document.getElementById('error-message'),
    refreshBtn: document.getElementById('refreshBtn'),
    searchInput: document.getElementById('searchInput'),
    totalUsers: document.getElementById('total-users'),
    avgAge: document.getElementById('avg-age')
};

// API'den kullanıcıları getir
async function fetchUsers() {
    try {
        setLoading(true);
        hideError();
        
        const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.USERS}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'success') {
            state.users = result.data;
            state.filteredUsers = [...state.users];
            renderUsers();
            updateStats();
        } else {
            throw new Error(result.message || 'API hatası');
        }
        
    } catch (error) {
        console.error('Kullanıcıları getirme hatası:', error);
        showError(error.message);
        state.users = [];
        state.filteredUsers = [];
        renderUsers();
        updateStats();
    } finally {
        setLoading(false);
    }
}

// Kullanıcıları görüntüle
function renderUsers() {
    const { filteredUsers } = state;
    
    if (filteredUsers.length === 0) {
        elements.usersGrid.innerHTML = `
            <div class="empty-state">
                <h3>👤 Kullanıcı bulunamadı</h3>
                <p>Arama kriterlerinize uygun kullanıcı bulunmuyor.</p>
            </div>
        `;
        return;
    }

    elements.usersGrid.innerHTML = filteredUsers.map(user => {
        const initials = getUserInitials(user.name);
        return `
            <div class="user-card">
                <div class="user-avatar">${initials}</div>
                <div class="user-name">${user.name}</div>
                <div class="user-email">📧 ${user.email}</div>
                <div class="user-age">🎂 ${user.age || 'Yaş belirtilmemiş'}</div>
                <div class="user-id">ID: ${user.id}</div>
            </div>
        `;
    }).join('');
}

// İstatistikleri güncelle
function updateStats() {
    const { users } = state;
    const totalUsers = users.length;
    
    // Ortalama yaş hesapla
    const usersWithAge = users.filter(user => user.age);
    const avgAge = usersWithAge.length > 0 
        ? Math.round(usersWithAge.reduce((sum, user) => sum + user.age, 0) / usersWithAge.length)
        : 0;

    elements.totalUsers.textContent = totalUsers;
    elements.avgAge.textContent = avgAge;
}

// Kullanıcı adından baş harfleri al
function getUserInitials(name) {
    return name.split(' ').map(part => part[0]).join('').toUpperCase();
}

// Arama fonksiyonu
function searchUsers() {
    const searchTerm = elements.searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        state.filteredUsers = [...state.users];
    } else {
        state.filteredUsers = state.users.filter(user => 
            user.name.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            (user.age && user.age.toString().includes(searchTerm)) ||
            user.id.toString().includes(searchTerm)
        );
    }
    
    renderUsers();
    updateStats();
}

// Loading state
function setLoading(loading) {
    state.loading = loading;
    if (loading) {
        elements.loading.style.display = 'block';
        elements.usersGrid.style.display = 'none';
    } else {
        elements.loading.style.display = 'none';
        elements.usersGrid.style.display = 'grid';
    }
}

// Hata göster
function showError(message) {
    state.error = message;
    elements.errorMessage.textContent = message;
    elements.error.style.display = 'block';
}

// Hata gizle
function hideError() {
    state.error = null;
    elements.error.style.display = 'none';
}

// Event listener'ları bağla
function initEventListeners() {
    elements.refreshBtn.addEventListener('click', fetchUsers);
    elements.searchInput.addEventListener('input', searchUsers);
    
    // Enter tuşu ile arama
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            searchUsers();
        }
    });
}

// Uygulamayı başlat
function initApp() {
    initEventListeners();
    fetchUsers();
}

// Sayfa yüklendiğinde uygulamayı başlat
document.addEventListener('DOMContentLoaded', initApp);
