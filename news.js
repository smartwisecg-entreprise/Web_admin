// ==========================================
// ⚠️  IMPORTANT - SÉCURITÉ CONFIGURATION
// ==========================================
// La SUPABASE_KEY (anon key) est publique par nature dans une app front-end.
// MAIS vous devez impérativement :
//   1. Activer les Row Level Security (RLS) sur TOUTES vos tables Supabase
//   2. Ne JAMAIS utiliser la "service_role key" ici (elle bypass le RLS)
//   3. Idéalement, gérer les opérations sensibles (création user, suppression)
//      via des Supabase Edge Functions protégées par JWT
// ==========================================
const SUPABASE_URL = 'https://neensjugjhkvwcqslicr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lZW5zanVnamhrdndjcXNsaWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5Mjg1NzQsImV4cCI6MjA4MTUwNDU3NH0.eDEhhT8HzetCntUZ2LYkZhtoUjSjmFxPQqm03aAL8tU';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 1. SYSTÈME DE TOASTS (remplace tous les alert())
// ==========================================
const Toast = (() => {
    // Crée le conteneur de toasts s'il n'existe pas
    function getContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 380px;
            `;
            document.body.appendChild(container);
        }
        return container;
    }

    const STYLES = {
        success: { bg: '#d1fae5', border: '#10b981', color: '#065f46', icon: '✅' },
        error:   { bg: '#fee2e2', border: '#ef4444', color: '#991b1b', icon: '❌' },
        warning: { bg: '#fef3c7', border: '#f59e0b', color: '#92400e', icon: '⚠️' },
        info:    { bg: '#dbeafe', border: '#3b82f6', color: '#1e40af', icon: 'ℹ️'  },
    };

    function show(message, type = 'info', duration = 4000) {
        const style = STYLES[type] || STYLES.info;
        const container = getContainer();

        const toast = document.createElement('div');
        toast.style.cssText = `
            background: ${style.bg};
            border-left: 4px solid ${style.border};
            color: ${style.color};
            padding: 14px 18px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 0.92rem;
            font-weight: 500;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            cursor: pointer;
            transition: opacity 0.3s ease, transform 0.3s ease;
            opacity: 0;
            transform: translateX(20px);
        `;
        toast.innerHTML = `<span style="font-size:1.1em;flex-shrink:0;">${style.icon}</span><span>${message}</span>`;

        // Fermer au clic
        toast.addEventListener('click', () => dismiss(toast));
        container.appendChild(toast);

        // Animation d'entrée
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

        // Auto-dismiss
        const timer = setTimeout(() => dismiss(toast), duration);
        toast._timer = timer;

        return toast;
    }

    function dismiss(toast) {
        clearTimeout(toast._timer);
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        setTimeout(() => toast.remove(), 300);
    }

    return {
        success: (msg, duration) => show(msg, 'success', duration),
        error:   (msg, duration) => show(msg, 'error', duration),
        warning: (msg, duration) => show(msg, 'warning', duration),
        info:    (msg, duration) => show(msg, 'info', duration),
    };
})();

// ==========================================
// 2. UTILITAIRES DE SÉCURITÉ ET VALIDATION
// ==========================================
const Security = (() => {

    // Sanitise une chaîne pour éviter l'injection HTML
    function sanitizeHTML(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // Valide un email
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
    }

    // Valide la force d'un mot de passe
    function isStrongPassword(password) {
        // Min 8 chars, 1 majuscule, 1 chiffre, 1 caractère spécial
        return /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/.test(password);
    }

    // Tronque un string pour éviter les inputs trop longs
    function truncate(str, maxLength = 5000) {
        if (typeof str !== 'string') return '';
        return str.slice(0, maxLength);
    }

    // Vérifie que l'utilisateur courant a le rôle requis
    async function requireRole(requiredRole) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) return false;

        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        if (!profile) return false;

        const hierarchy = ['editor', 'admin'];
        const userLevel = hierarchy.indexOf(profile.role);
        const requiredLevel = hierarchy.indexOf(requiredRole);

        return userLevel >= requiredLevel;
    }

    return { sanitizeHTML, isValidEmail, isStrongPassword, truncate, requireRole };
})();

// ==========================================
// 3. GESTION DE LA MODALE AVATAR
// ==========================================
let cropper;
const modalPreview = document.getElementById('modalAvatarPreview');
const uploadBtn = document.querySelector('.upload-btn');
const fileInput = document.getElementById('avatarInputHidden');

document.querySelector('.user-profile-box').onclick = function () {
    const currentSrc = document.getElementById('userAvatar').src;
    modalPreview.onload = null;
    modalPreview.src = currentSrc;
    document.getElementById('avatarModal').style.display = 'flex';
};

function closeAvatarModal() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    modalPreview.onload = null;
    if (fileInput) fileInput.value = '';
    document.getElementById('avatarModal').style.display = 'none';
    uploadBtn.innerHTML = '<span>📷</span> Modifier';
    uploadBtn.disabled = false;
    uploadBtn.onclick = triggerFileInput;
}

function triggerFileInput() {
    fileInput.click();
}

async function uploadAvatar(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    // Validation : type et taille (max 5 Mo)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        Toast.error('Format invalide. Utilisez JPG, PNG ou WebP.');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        Toast.error('Image trop lourde. Maximum 5 Mo.');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        modalPreview.onload = function () {
            if (cropper) cropper.destroy();

            cropper = new Cropper(modalPreview, {
                aspectRatio: 1,
                viewMode: 1,
                dragMode: 'move',
                autoCropArea: 0.8,
                restore: false,
                guides: true,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
                ready() {
                    uploadBtn.innerHTML = '<span>✅</span> Valider ce cadrage';
                    uploadBtn.onclick = confirmCrop;
                }
            });
        };
        modalPreview.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function confirmCrop() {
    if (!cropper) return;

    cropper.getCroppedCanvas({ width: 400, height: 400 }).toBlob(async (blob) => {
        try {
            uploadBtn.innerText = 'Chargement...';
            uploadBtn.disabled = true;

            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) throw new Error('Session expirée. Reconnectez-vous.');

            const userId = session.user.id;
            const fileName = `${userId}/${Date.now()}.png`;

            const { error: uploadError } = await supabaseClient.storage
                .from('avatars')
                .upload(fileName, blob, { contentType: 'image/png', upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
            const publicUrl = urlData.publicUrl;

            const { error: dbError } = await supabaseClient
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

            if (dbError) throw dbError;

            document.getElementById('userAvatar').src = publicUrl;
            Toast.success('Photo de profil mise à jour !');
            closeAvatarModal();

        } catch (error) {
            Toast.error('Erreur lors de la mise à jour : ' + error.message);
            uploadBtn.innerHTML = '<span>✅</span> Valider ce cadrage';
            uploadBtn.disabled = false;
        }
    }, 'image/png');
}

async function deleteAvatar() {
    const confirmed = await confirmDialog(
        'Supprimer votre photo de profil ?',
        'Votre avatar sera remplacé par vos initiales.',
        'Supprimer',
        'danger'
    );
    if (!confirmed) return;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) throw new Error('Session expirée.');

        const userId = session.user.id;
        const { error } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: null })
            .eq('id', userId);

        if (error) throw error;

        const name = document.getElementById('userName').innerText;
        const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4e7994&color=fff`;
        document.getElementById('userAvatar').src = defaultAvatar;

        Toast.success('Photo de profil supprimée.');
        closeAvatarModal();

    } catch (error) {
        Toast.error('Erreur : ' + error.message);
    }
}

window.onclick = function (event) {
    const modal = document.getElementById('avatarModal');
    if (event.target === modal) closeAvatarModal();
};

// ==========================================
// 4. BOÎTE DE DIALOGUE DE CONFIRMATION (remplace confirm())
// ==========================================
function confirmDialog(title, message, confirmLabel = 'Confirmer', type = 'primary') {
    return new Promise((resolve) => {
        // Supprimer une ancienne modale si elle existe
        const existing = document.getElementById('confirm-dialog');
        if (existing) existing.remove();

        const colors = {
            danger:  { bg: '#ef4444', hover: '#dc2626' },
            primary: { bg: '#3b82f6', hover: '#2563eb' },
            warning: { bg: '#f59e0b', hover: '#d97706' },
        };
        const color = colors[type] || colors.primary;

        const overlay = document.createElement('div');
        overlay.id = 'confirm-dialog';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.5);
            z-index: 100000; display: flex; align-items: center; justify-content: center;
        `;
        overlay.innerHTML = `
            <div style="background:#fff; border-radius:12px; padding:28px 32px; max-width:420px; width:90%; box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <h3 style="margin:0 0 8px; font-size:1.1rem; color:#111;">${Security.sanitizeHTML(title)}</h3>
                <p style="margin:0 0 24px; color:#555; font-size:0.95rem;">${Security.sanitizeHTML(message)}</p>
                <div style="display:flex; gap:10px; justify-content:flex-end;">
                    <button id="dlg-cancel" style="padding:9px 18px; border:1px solid #ddd; border-radius:7px; background:#f9fafb; cursor:pointer; font-weight:500;">Annuler</button>
                    <button id="dlg-confirm" style="padding:9px 18px; border:none; border-radius:7px; background:${color.bg}; color:#fff; cursor:pointer; font-weight:600;">${Security.sanitizeHTML(confirmLabel)}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('dlg-cancel').onclick = () => { overlay.remove(); resolve(false); };
        document.getElementById('dlg-confirm').onclick = () => { overlay.remove(); resolve(true); };
        overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
}

// ==========================================
// 5. AUTHENTIFICATION ET PROFIL
// ==========================================
async function checkUser() {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('display_name, avatar_url, role')
            .eq('id', session.user.id)
            .single();

        if (error) throw error;

        document.getElementById('adminContent').style.display = 'block';

        const nameDisplay  = document.getElementById('userName');
        const avatarDisplay = document.getElementById('userAvatar');
        const roleDisplay  = document.getElementById('userRole');

        nameDisplay.innerText = Security.sanitizeHTML(profile.display_name || session.user.email);
        const userRole = profile.role || 'editor';
        if (roleDisplay) roleDisplay.innerText = userRole.toUpperCase();

        if (profile.avatar_url) {
            avatarDisplay.src = profile.avatar_url;
        } else {
            avatarDisplay.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || 'Admin')}&background=4e7994&color=fff`;
        }
        avatarDisplay.style.display = 'block';

        if (userRole === 'admin' || userRole === 'administrator') {
            const btnAccounts = document.getElementById('btnManageAccounts');
            if (btnAccounts) btnAccounts.style.display = 'inline-block';
        }

        loadNews();

    } catch (err) {
        console.error('Erreur profil:', err);
        document.getElementById('userName').innerText = session.user.email;
        document.getElementById('adminContent').style.display = 'block';
        loadNews();
    }
}

async function logout() {
    const confirmed = await confirmDialog('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', 'Se déconnecter');
    if (!confirmed) return;

    const { error } = await supabaseClient.auth.signOut();
    if (error) Toast.error('Erreur lors de la déconnexion.');
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
});

checkUser();

// ==========================================
// 6. GESTION DES ARTICLES (CRUD)
// ==========================================
let allNewsData = [];
let currentEditId = null;
let currentEditImageUrl = '';

document.getElementById('date').valueAsDate = new Date();

// ---- Traductions catégories ----
const CAT_TRANSLATIONS = {
    'Produits & Services': 'Products & Services',
    'Entreprise':          'Corporate',
    'Technologie':         'Technology',
    'Info Pratique':       'Useful Info',
    'Impact':              'Social Impact',
    'Événement':           'Event'
};

// ---- Validation du formulaire article ----
function validateArticleForm(fields) {
    const errors = [];

    if (!fields.titleFR.trim()) {
        errors.push('Le titre en français est obligatoire.');
    } else if (fields.titleFR.length > 200) {
        errors.push('Le titre (FR) ne peut pas dépasser 200 caractères.');
    }

    if (fields.dateVal && isNaN(Date.parse(fields.dateVal))) {
        errors.push('La date sélectionnée est invalide.');
    }

    return errors;
}

// ---- Sauvegarder (Créer ou Modifier) ----
document.getElementById('btnSave').addEventListener('click', async () => {
    const btn    = document.getElementById('btnSave');
    const status = document.getElementById('status');
    const imgFile = document.getElementById('imageFile').files[0];

    const fields = {
        titleFR:    Security.truncate(document.getElementById('title_fr').value, 200),
        titleEN:    Security.truncate(document.getElementById('title_en').value, 200),
        summaryFR:  Security.truncate(document.getElementById('summary_fr').value, 500),
        summaryEN:  Security.truncate(document.getElementById('summary_en').value, 500),
        contentFR:  Security.truncate(document.getElementById('content_fr').value, 20000),
        contentEN:  Security.truncate(document.getElementById('content_en').value, 20000),
        dateVal:    document.getElementById('date').value,
        catFR:      document.getElementById('category').value,
    };

    status.style.display = 'none';

    // Validation
    const errors = validateArticleForm(fields);
    if (errors.length > 0) {
        Toast.warning(errors.join(' '));
        document.getElementById('title_fr').focus();
        return;
    }

    // Validation image
    if (imgFile) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(imgFile.type)) {
            Toast.error('Format image invalide. Utilisez JPG, PNG, WebP ou GIF.');
            return;
        }
        if (imgFile.size > 10 * 1024 * 1024) {
            Toast.error("L'image dépasse 10 Mo. Veuillez la compresser.");
            return;
        }
    }

    btn.disabled = true;
    btn.innerHTML = currentEditId
        ? '<span>💾 Enregistrement...</span>'
        : '<span>⏳ Publication...</span>';

    try {
        let imageUrl = currentEditImageUrl;

        // Fallback image si création sans image
        if (!currentEditId && !imgFile) {
            imageUrl = 'https://placehold.co/800x400?text=Smart+Wise';
        }

        if (imgFile) {
            const fileExt  = imgFile.name.split('.').pop().toLowerCase();
            const cleanName = `${Date.now()}${Math.random().toString(36).substring(7)}`;
            const fileName  = `news_${cleanName}.${fileExt}`;

            const { error: upErr } = await supabaseClient.storage
                .from('news-images')
                .upload(fileName, imgFile);

            if (upErr) throw upErr;

            const { data: urlData } = supabaseClient.storage.from('news-images').getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
        }

        const payload = {
            date:        fields.dateVal,
            image:       imageUrl,
            title_fr:    fields.titleFR,
            category_fr: fields.catFR,
            summary_fr:  fields.summaryFR,
            content_fr:  fields.contentFR,
            title_en:    fields.titleEN   || fields.titleFR,
            category_en: CAT_TRANSLATIONS[fields.catFR] || fields.catFR,
            summary_en:  fields.summaryEN || fields.summaryFR,
            content_en:  fields.contentEN || fields.contentFR,
        };

        let dbError = null;

        if (currentEditId) {
            const { error } = await supabaseClient.from('news').update(payload).eq('id', currentEditId);
            dbError = error;
        } else {
            const { error } = await supabaseClient.from('news').insert([payload]);
            dbError = error;
        }

        if (dbError) throw dbError;

        Toast.success(currentEditId ? 'Article modifié avec succès !' : 'Article publié avec succès !');
        resetForm();
        loadNews();

    } catch (e) {
        console.error(e);
        Toast.error('Erreur : ' + e.message);
    } finally {
        btn.disabled = false;
        if (!currentEditId) btn.innerHTML = "<span>🚀 Publier l'article</span>";
    }
});

// ---- Lister les articles ----
async function loadNews() {
    const div = document.getElementById('newsList');
    div.innerHTML = `<p style="text-align:center;color:#94a3b8;">Chargement...</p>`;

    const { data, error } = await supabaseClient
        .from('news')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        div.innerHTML = `<p style="color:red">Erreur : ${Security.sanitizeHTML(error.message)}</p>`;
        return;
    }

    allNewsData = data || [];

    if (allNewsData.length === 0) {
        div.innerHTML = `<p style="text-align:center;color:#94a3b8;">Aucun article en ligne.</p>`;
        return;
    }

    div.innerHTML = allNewsData.map(item => {
        const dateStr = new Date(item.date).toLocaleDateString('fr-FR');
        return `
            <div class="news-item">
                <div class="news-content">
                    <img src="${Security.sanitizeHTML(item.image)}" alt="Cover" onerror="this.src='https://placehold.co/80?text=IMG'">
                    <div class="news-info">
                        <h3>${Security.sanitizeHTML(item.title_fr)}</h3>
                        <div class="news-meta">
                            <span>📅 ${dateStr}</span>
                            <span class="badge">${Security.sanitizeHTML(item.category_fr)}</span>
                        </div>
                    </div>
                </div>
                <div class="actions">
                    <button class="action-btn edit-btn" onclick="editNews(${item.id})">✏️ Modifier</button>
                    <button class="action-btn delete-btn" onclick="deleteNews(${item.id})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// ---- Éditer un article ----
window.editNews = (id) => {
    const article = allNewsData.find(n => n.id === id);
    if (!article) return;

    currentEditId = id;
    currentEditImageUrl = article.image;

    document.getElementById('formTitle').innerText = "Modifier l'actualité";
    document.getElementById('btnSave').innerHTML = '<span>💾 Mettre à jour</span>';
    document.getElementById('btnSave').style.background = '#f59e0b';
    document.getElementById('btnCancel').style.display = 'flex';

    document.getElementById('date').value        = article.date;
    document.getElementById('category').value    = article.category_fr;
    document.getElementById('title_fr').value    = article.title_fr;
    document.getElementById('summary_fr').value  = article.summary_fr   || '';
    document.getElementById('content_fr').value  = article.content_fr;
    document.getElementById('title_en').value    = article.title_en     || '';
    document.getElementById('summary_en').value  = article.summary_en   || '';
    document.getElementById('content_en').value  = article.content_en   || '';

    const imgPrev = document.getElementById('currentImagePreview');
    imgPrev.src = article.image;
    imgPrev.style.display = 'block';
    document.getElementById('uploadPlaceholder').style.display = 'none';
    document.getElementById('uploadArea').classList.add('has-image');

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ---- Réinitialiser le formulaire ----
function resetForm() {
    currentEditId = null;
    currentEditImageUrl = '';

    document.getElementById('formTitle').innerText = 'Publier une Actualité';
    document.getElementById('btnSave').innerHTML   = "<span>🚀 Publier l'article</span>";
    document.getElementById('btnSave').style.background = 'var(--primary)';
    document.getElementById('btnCancel').style.display  = 'none';

    const preview = document.getElementById('currentImagePreview');
    preview.style.display = 'none';
    preview.src = '';
    document.getElementById('uploadPlaceholder').style.display = 'block';
    document.getElementById('uploadArea').classList.remove('has-image');

    document.querySelectorAll('input[type="text"], textarea').forEach(el => el.value = '');
    document.getElementById('imageFile').value = '';
    document.getElementById('date').valueAsDate = new Date();
}

document.getElementById('btnCancel').addEventListener('click', resetForm);

// ---- Supprimer un article ----
window.deleteNews = async (id) => {
    const confirmed = await confirmDialog(
        'Supprimer cet article ?',
        'Cette action est irréversible. L\'article sera définitivement supprimé.',
        'Supprimer',
        'danger'
    );
    if (!confirmed) return;

    // Récupère l'URL de l'image avant suppression
    const article = allNewsData.find(n => n.id === id);

    // Supprime en base
    const { error } = await supabaseClient.from('news').delete().eq('id', id);
    if (error) {
        Toast.error('Erreur lors de la suppression.');
        return;
    }

    // Supprime l'image du bucket si elle vient bien de news-images
    if (article?.image) {
        try {
            const url = new URL(article.image);
            // L'URL Supabase storage a la forme : .../storage/v1/object/public/news-images/nom_fichier.ext
            const marker = '/news-images/';
            const idx = url.pathname.indexOf(marker);

            if (idx !== -1) {
                const fileName = url.pathname.substring(idx + marker.length);
                const { error: storageError } = await supabaseClient.storage
                    .from('news-images')
                    .remove([decodeURIComponent(fileName)]);

                if (storageError) {
                    console.warn('Image non supprimée du bucket :', storageError.message);
                    Toast.warning('Article supprimé, mais l\'image n\'a pas pu être retirée du stockage.');
                }
            }
        } catch (e) {
            console.warn('Erreur parsing URL image :', e);
        }
    }

    Toast.success('Article supprimé.');
    loadNews();
    if (currentEditId === id) resetForm();
};

// ---- Aperçu image ----
document.getElementById('imageFile').addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const preview = document.getElementById('currentImagePreview');
        preview.src = e.target.result;
        preview.style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
        document.getElementById('uploadArea').classList.add('has-image');
    };
    reader.readAsDataURL(file);
});

// ==========================================
// 7. GESTION DES COMPTES
// ==========================================

function openAccountModal() {
    resetAccView();
    document.getElementById('accountModal').style.display = 'flex';
}

function closeAccountModal() {
    document.getElementById('accountModal').style.display = 'none';
}

function resetAccView() {
    document.getElementById('accMenu').style.display      = 'flex';
    document.getElementById('accAddForm').style.display   = 'none';
    document.getElementById('accListPanel').style.display = 'none';

    // Reset des champs
    ['newUsername', 'newEmail', 'newPass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Masquer les messages d'erreur éventuels
    const errEl = document.getElementById('accFormError');
    if (errEl) { errEl.style.display = 'none'; errEl.innerText = ''; }
}

function showAddUser() {
    document.getElementById('accMenu').style.display    = 'none';
    document.getElementById('accAddForm').style.display = 'block';
}

async function showDeleteUser() {
    // Vérification de rôle avant d'afficher la liste
    const isAdmin = await Security.requireRole('admin');
    if (!isAdmin) {
        Toast.error("Accès refusé. Seuls les administrateurs peuvent gérer les comptes.");
        closeAccountModal();
        return;
    }

    document.getElementById('accMenu').style.display      = 'none';
    document.getElementById('accListPanel').style.display = 'block';
    loadUsersList();
}

// ---- Créer un utilisateur ----
async function createUser() {
    const username = Security.truncate(document.getElementById('newUsername').value.trim(), 100);
    const email    = document.getElementById('newEmail').value.trim();
    const password = document.getElementById('newPass').value;
    const rawRole  = document.getElementById('newRole').value;

    // Validation des champs
    const errors = [];
    if (!username)                          errors.push('Le nom est requis.');
    if (!email || !Security.isValidEmail(email)) errors.push('Email invalide.');
    if (!password)                          errors.push('Le mot de passe est requis.');
    else if (!Security.isStrongPassword(password)) {
        errors.push('Mot de passe trop faible. Minimum 8 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial.');
    }

    if (errors.length > 0) {
        Toast.warning(errors.join(' '));
        return;
    }

    // Vérification que l'utilisateur courant est admin
    const isAdmin = await Security.requireRole('admin');
    if (!isAdmin) {
        Toast.error('Accès refusé.');
        return;
    }

    const dbRole = rawRole.toLowerCase().includes('admin') ? 'admin' : 'editor';

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: {
                display_name: username,
                role: dbRole,
                must_change_password: true,
            }
        }
    });

    if (error) {
        Toast.error('Erreur lors de la création : ' + error.message);
        return;
    }

    // Mise à jour de sécurité du profil
    if (data.user) {
        await supabaseClient
            .from('profiles')
            .update({ role: dbRole })
            .eq('id', data.user.id);
    }

    Toast.success('Utilisateur créé avec succès !');
    resetAccView();
}

// ---- Lister les utilisateurs ----
async function loadUsersList() {
    const container = document.getElementById('usersListContainer');
    container.innerHTML = '<p style="text-align:center;color:#888;">Chargement...</p>';

    const { data: profiles, error } = await supabaseClient
        .from('profiles')
        .select('id, display_name, role');

    if (error) {
        container.innerHTML = `<p style="color:red;">Erreur : ${Security.sanitizeHTML(error.message)}</p>`;
        return;
    }

    if (!profiles || profiles.length === 0) {
        container.innerHTML = "<p style='text-align:center;color:#888;'>Aucun utilisateur trouvé.</p>";
        return;
    }

    const roleLabels = { admin: 'Administrateur', editor: 'Éditeur' };

    container.innerHTML = `
        <ul style="list-style:none; padding:0; margin:0;">
            ${profiles.map(p => `
                <li style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${Security.sanitizeHTML(p.display_name || 'Sans nom')}</strong><br>
                        <small style="color:#666; background:#f3f4f6; padding:2px 6px; border-radius:4px; font-size:0.8em;">
                            ${roleLabels[p.role] || 'Éditeur'}
                        </small>
                    </div>
                    <button
                        onclick="deleteUserProfile('${Security.sanitizeHTML(p.id)}')"
                        title="Supprimer ce compte"
                        style="background:#fee2e2; color:#c53030; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold;">
                        ✕
                    </button>
                </li>
            `).join('')}
        </ul>
    `;
}

// ---- Supprimer un compte ----
async function deleteUserProfile(targetId) {
    // Vérification admin côté client (le RLS doit aussi le bloquer côté serveur)
    const isAdmin = await Security.requireRole('admin');
    if (!isAdmin) {
        Toast.error('Accès refusé.');
        return;
    }

    // Empêcher l'admin de se supprimer lui-même
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user.id === targetId) {
        Toast.warning('Vous ne pouvez pas supprimer votre propre compte.');
        return;
    }

    const confirmed = await confirmDialog(
        'Supprimer ce compte ?',
        '⚠️ Cette action est irréversible. Elle supprimera le profil et l\'accès de connexion de cet utilisateur.',
        'Supprimer définitivement',
        'danger'
    );
    if (!confirmed) return;

    const { error } = await supabaseClient.rpc('delete_user_account', { user_id: targetId });

    if (error) {
        Toast.error('Erreur lors de la suppression : ' + error.message);
    } else {
        Toast.success('Compte supprimé définitivement.');
        loadUsersList();
    }
}