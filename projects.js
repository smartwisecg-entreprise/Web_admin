// ============================================================
// ⚠️  SÉCURITÉ - CONFIGURATION SUPABASE
// ============================================================
// La SUPABASE_KEY (anon key) est publique par nature dans une app front-end.
// MAIS vous devez impérativement :
//   1. Activer les Row Level Security (RLS) sur TOUTES vos tables Supabase
//   2. Ne JAMAIS utiliser la "service_role key" ici (elle bypass le RLS)
//   3. Gérer les opérations sensibles via des Supabase Edge Functions protégées par JWT
// ============================================================
const SUPABASE_URL = 'https://neensjugjhkvwcqslicr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lZW5zanVnamhrdndjcXNsaWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5Mjg1NzQsImV4cCI6MjA4MTUwNDU3NH0.eDEhhT8HzetCntUZ2LYkZhtoUjSjmFxPQqm03aAL8tU';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// 1. SYSTÈME DE TOASTS (remplace tous les alert())
// ============================================================
const Toast = (() => {
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
        toast.addEventListener('click', () => dismiss(toast));
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        });

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

// ============================================================
// 2. UTILITAIRES DE SÉCURITÉ ET VALIDATION
// ============================================================
const Security = (() => {

    function sanitizeHTML(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
    }

    function isStrongPassword(password) {
        return /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/.test(password);
    }

    function truncate(str, maxLength = 5000) {
        if (typeof str !== 'string') return '';
        return str.slice(0, maxLength);
    }

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
        const userLevel    = hierarchy.indexOf(profile.role);
        const requiredLevel = hierarchy.indexOf(requiredRole);
        return userLevel >= requiredLevel;
    }

    return { sanitizeHTML, isValidEmail, isStrongPassword, truncate, requireRole };
})();

// ============================================================
// 3. BOÎTE DE DIALOGUE DE CONFIRMATION (remplace confirm())
// ============================================================
function confirmDialog(title, message, confirmLabel = 'Confirmer', type = 'primary') {
    return new Promise((resolve) => {
        const existing = document.getElementById('confirm-dialog');
        if (existing) existing.remove();

        const colors = {
            danger:  { bg: '#ef4444' },
            primary: { bg: '#3b82f6' },
            warning: { bg: '#f59e0b' },
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
        document.getElementById('dlg-cancel').onclick  = () => { overlay.remove(); resolve(false); };
        document.getElementById('dlg-confirm').onclick = () => { overlay.remove(); resolve(true); };
        overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
}

// ============================================================
// 4. GESTION DE LA MODALE AVATAR
// ============================================================
let cropper;
const modalPreview = document.getElementById('modalAvatarPreview');
const uploadBtn    = document.querySelector('.upload-btn');
const fileInput    = document.getElementById('avatarInputHidden');

document.querySelector('.user-profile-box').onclick = function () {
    const currentSrc = document.getElementById('userAvatar').src;
    modalPreview.onload = null;
    modalPreview.src = currentSrc;
    document.getElementById('avatarModal').style.display = 'flex';
};

function closeAvatarModal() {
    if (cropper) { cropper.destroy(); cropper = null; }
    modalPreview.onload = null;
    if (fileInput) fileInput.value = '';
    document.getElementById('avatarModal').style.display = 'none';
    uploadBtn.innerHTML = '<span>📷</span> Modifier';
    uploadBtn.disabled  = false;
    uploadBtn.onclick   = triggerFileInput;
}

function triggerFileInput() {
    fileInput.click();
}

async function uploadAvatar(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
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
                    uploadBtn.onclick   = confirmCrop;
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
            uploadBtn.disabled  = true;

            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) throw new Error('Session expirée. Reconnectez-vous.');

            const userId   = session.user.id;
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
            uploadBtn.disabled  = false;
        }
    }, 'image/png');
}

async function deleteAvatar() {
    const confirmed = await confirmDialog(
        'Supprimer votre photo de profil ?',
        'Votre avatar sera remplacé par vos initiales.',
        'Supprimer', 'danger'
    );
    if (!confirmed) return;

    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) throw new Error('Session expirée.');

        const { error } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: null })
            .eq('id', session.user.id);
        if (error) throw error;

        const name = document.getElementById('userName').innerText;
        document.getElementById('userAvatar').src =
            `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4e7994&color=fff`;

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

// ============================================================
// 5. AUTHENTIFICATION ET PROFIL
// ============================================================
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

        const nameDisplay   = document.getElementById('userName');
        const avatarDisplay = document.getElementById('userAvatar');
        const roleDisplay   = document.getElementById('userRole');

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

        loadProjects();

    } catch (err) {
        console.error('Erreur profil:', err);
        document.getElementById('userName').innerText = session.user.email;
        document.getElementById('adminContent').style.display = 'block';
        loadProjects();
    }
}

async function logout() {
    const confirmed = await confirmDialog(
        'Déconnexion',
        'Voulez-vous vraiment vous déconnecter ?',
        'Se déconnecter'
    );
    if (!confirmed) return;
    const { error } = await supabaseClient.auth.signOut();
    if (error) Toast.error('Erreur lors de la déconnexion.');
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
});

checkUser();

// ============================================================
// 6. VARIABLES GLOBALES - PROJETS
// ============================================================
let allProjects = [];
let currentEditId = null;
let currentEditImageUrl = '';

// ============================================================
// 7. GESTION IMAGE PREVIEW
// ============================================================
const imageInput = document.getElementById('imageFile');
const preview    = document.getElementById('currentImagePreview');
const placeholder = document.getElementById('uploadPlaceholder');
const uploadArea  = document.getElementById('uploadArea');

imageInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

    // Validation type et taille
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        Toast.error('Format invalide. Utilisez JPG, PNG, WebP ou GIF.');
        this.value = '';
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        Toast.error("L'image dépasse 10 Mo. Veuillez la compresser.");
        this.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        preview.src = e.target.result;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        uploadArea.classList.add('has-image');
    };
    reader.readAsDataURL(file);
});

// ============================================================
// 8. LOGIQUE TAGS TECH
// ============================================================
const availableTechs = [
    "HTML5", "CSS3", "JavaScript", "TypeScript", "Python", "PHP", "Java", "C#", "Go", "Swift",
    "React", "Vue.js", "Angular", "Next.js", "Node.js", "Django", "Laravel", "Spring Boot",
    "WordPress", "Shopify", "MySQL", "PostgreSQL", "MongoDB", "Firebase", "Supabase",
    "Docker", "Kubernetes", "AWS", "Google Cloud", "Figma", "Adobe XD", "Flutter", "React Native"
];
let selectedTechs = [];
const techInput      = document.getElementById('techInput');
const suggestionsBox = document.getElementById('suggestionsBox');
const techWrapper    = document.getElementById('techWrapper');

techInput.addEventListener('input', function () {
    const val = this.value.toLowerCase();
    suggestionsBox.innerHTML = '';
    if (!val) { suggestionsBox.style.display = 'none'; return; }

    const matches = availableTechs.filter(t =>
        t.toLowerCase().includes(val) && !selectedTechs.includes(t)
    );
    if (matches.length > 0) {
        matches.forEach(tech => {
            const div = document.createElement('div');
            div.className   = 'suggestion-item';
            div.textContent = tech;
            div.onclick     = () => addTech(tech);
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    } else {
        suggestionsBox.style.display = 'none';
    }
});

function addTech(techName) {
    const clean = Security.truncate(techName.trim(), 50);
    if (!clean || selectedTechs.includes(clean)) return;
    selectedTechs.push(clean);
    renderTags();
    techInput.value = '';
    suggestionsBox.style.display = 'none';
    techInput.focus();
}

function removeTech(techName) {
    selectedTechs = selectedTechs.filter(t => t !== techName);
    renderTags();
}

function renderTags() {
    techWrapper.querySelectorAll('.tech-tag').forEach(t => t.remove());
    selectedTechs.forEach(tech => {
        const tag = document.createElement('div');
        tag.className = 'tech-tag';
        tag.innerHTML = `${Security.sanitizeHTML(tech)} <span onclick="removeTech('${Security.sanitizeHTML(tech)}')">&times;</span>`;
        techWrapper.insertBefore(tag, techInput);
    });
}

document.addEventListener('click', function (e) {
    if (!techWrapper.contains(e.target)) suggestionsBox.style.display = 'none';
});

// ============================================================
// 9. LOGIQUE FORMULAIRE
// ============================================================
function toggleFields() {
    const type = document.getElementById('projType').value;
    if (type === 'modal') {
        document.getElementById('modalFields').classList.remove('hidden');
        document.getElementById('linkFields').classList.add('hidden');
    } else {
        document.getElementById('modalFields').classList.add('hidden');
        document.getElementById('linkFields').classList.remove('hidden');
    }
}

// Traductions catégories
const LABELS_FR = {
    'web':     'Développement Web',
    'logiciel':'Logiciels & Desktop',
    'mobile':  'Applications Mobiles',
    'infra':   'Infrastructure & Cloud',
    'devops':  'DevOps & CI/CD',
    'data':    'Data & IA',
    'uiux':    'Design UI/UX',
    'cyber':   'Cybersécurité',
};
const LABELS_EN = {
    'web':     'Web Development',
    'logiciel':'Software & Desktop',
    'mobile':  'Mobile Apps',
    'infra':   'Infrastructure & Cloud',
    'devops':  'DevOps & CI/CD',
    'data':    'Data & AI',
    'uiux':    'UI/UX Design',
    'cyber':   'Cybersecurity',
};

// Validation formulaire projet
function validateProjectForm(fields) {
    const errors = [];
    if (!fields.titleFR.trim()) {
        errors.push('Le titre en français est obligatoire.');
    } else if (fields.titleFR.length > 200) {
        errors.push('Le titre ne peut pas dépasser 200 caractères.');
    }
    return errors;
}

// ---- Sauvegarder (Créer ou Modifier) ----
document.getElementById('btnSave').addEventListener('click', async () => {
    const btn    = document.getElementById('btnSave');
    const status = document.getElementById('statusMessage');

    const fields = {
        titleFR:    Security.truncate(document.getElementById('titleDefault').value, 200),
        titleEN:    Security.truncate(document.getElementById('titleEn').value, 200),
        descFR:     Security.truncate(document.getElementById('descDefault').value, 500),
        descEN:     Security.truncate(document.getElementById('descEn').value, 500),
        fullDescFR: Security.truncate(document.getElementById('fullDesc').value, 20000),
        fullDescEN: Security.truncate(document.getElementById('fullDescEn').value, 20000),
        catValue:   document.getElementById('category').value,
        type:       document.getElementById('projType').value,
        client:     Security.truncate(document.getElementById('clientName').value, 200),
        linkUrl:    Security.truncate(document.getElementById('linkUrl').value, 500),
    };

    status.style.display = 'none';

    // Validation
    const errors = validateProjectForm(fields);
    if (errors.length > 0) {
        Toast.warning(errors.join(' '));
        document.getElementById('titleDefault').focus();
        return;
    }

    btn.disabled  = true;
    btn.innerHTML = currentEditId ? '💾 Modification...' : '⏳ Publication...';

    try {
        // 1. Upload image si présente
        let imageUrl = currentEditImageUrl || 'https://placehold.co/600x400/e0e7ff/4e7994?text=Projet';
        const imgInput = document.getElementById('imageFile');

        if (imgInput.files.length > 0) {
            const file    = imgInput.files[0];
            const fileExt = file.name.split('.').pop().toLowerCase();
            const cleanName = `proj_${Date.now()}${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: upError } = await supabaseClient.storage
                .from('portfolio-images')
                .upload(cleanName, file);
            if (upError) throw upError;

            const { data: publicUrlData } = supabaseClient.storage
                .from('portfolio-images')
                .getPublicUrl(cleanName);
            imageUrl = publicUrlData.publicUrl;
        }

        // 2. Gestion tags : si aucun tag sélectionné mais saisie manuelle, l'ajouter
        if (selectedTechs.length === 0 && techInput.value.trim() !== '') {
            selectedTechs.push(Security.truncate(techInput.value.trim(), 50));
        }
        const techString = selectedTechs.join(', ');

        // 3. Construction du payload
        const modalDetailsFR = {
            title:     fields.titleFR,
            client:    fields.client,
            full_desc: fields.fullDescFR,
            tech:      techString,
        };
        const modalDetailsEN = {
            title:     fields.titleEN  || fields.titleFR,
            client:    fields.client,
            full_desc: fields.fullDescEN || fields.fullDescFR,
            tech:      techString,
        };

        const projectData = {
            type:             fields.type,
            category:         fields.catValue,
            image:            imageUrl,
            cat_key:          `cat_${fields.catValue}`,
            cat_label:        LABELS_FR[fields.catValue] || fields.catValue,
            cat_label_en:     LABELS_EN[fields.catValue] || fields.catValue,
            title_default:    fields.titleFR,
            desc_default:     fields.descFR,
            modal_details:    fields.type === 'modal' ? modalDetailsFR : null,
            title_en:         fields.titleEN   || fields.titleFR,
            desc_en:          fields.descEN    || fields.descFR,
            modal_details_en: fields.type === 'modal' ? modalDetailsEN : null,
            link_url:         fields.type === 'link' ? fields.linkUrl : null,
        };

        // 4. Insert ou Update
        if (currentEditId) {
            const { error } = await supabaseClient.from('projects').update(projectData).eq('id', currentEditId);
            if (error) throw error;
            Toast.success('Projet modifié avec succès !');
        } else {
            const { error } = await supabaseClient.from('projects').insert([projectData]);
            if (error) throw error;
            Toast.success('Projet publié avec succès !');
        }

        resetForm();
        loadProjects();

    } catch (error) {
        console.error(error);
        Toast.error('Erreur : ' + error.message);
    } finally {
        btn.disabled  = false;
        btn.innerHTML = currentEditId ? '🚀 Mettre à jour' : '🚀 Publier le Projet';
    }
});

// ============================================================
// 10. EDIT & RESET
// ============================================================
window.editProject = (id) => {
    const proj = allProjects.find(p => p.id === id);
    if (!proj) return;

    currentEditId       = id;
    currentEditImageUrl = proj.image;

    document.getElementById('formTitle').innerText = 'Modifier le Projet';
    const btn = document.getElementById('btnSave');
    btn.innerHTML      = '💾 Mettre à jour';
    btn.style.background = '#f59e0b';
    document.getElementById('btnCancel').style.display = 'flex';

    document.getElementById('projType').value      = proj.type;
    document.getElementById('category').value      = proj.category;
    document.getElementById('titleDefault').value  = proj.title_default;
    document.getElementById('titleEn').value       = proj.title_en        || '';
    document.getElementById('descDefault').value   = proj.desc_default;
    document.getElementById('descEn').value        = proj.desc_en         || '';

    if (proj.image) {
        preview.src               = proj.image;
        preview.style.display     = 'block';
        placeholder.style.display = 'none';
        uploadArea.classList.add('has-image');
    }

    if (proj.type === 'modal' && proj.modal_details) {
        document.getElementById('clientName').value = proj.modal_details.client        || '';
        document.getElementById('fullDesc').value   = proj.modal_details.full_desc     || '';
        document.getElementById('fullDescEn').value = proj.modal_details_en
            ? (proj.modal_details_en.full_desc || '')
            : '';

        selectedTechs = [];
        if (proj.modal_details.tech) {
            selectedTechs = proj.modal_details.tech.split(',').map(s => s.trim()).filter(Boolean);
        }
        renderTags();
    }

    if (proj.type === 'link') {
        document.getElementById('linkUrl').value = proj.link_url || '';
    }

    toggleFields();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

function resetForm() {
    currentEditId       = null;
    currentEditImageUrl = '';

    document.getElementById('formTitle').innerText = 'Nouveau Projet';
    const btn = document.getElementById('btnSave');
    btn.innerHTML      = '🚀 Publier le Projet';
    btn.style.background = 'var(--primary)';
    document.getElementById('btnCancel').style.display = 'none';

    document.querySelectorAll('input, textarea').forEach(i => i.value = '');
    document.getElementById('category').selectedIndex  = 0;
    document.getElementById('projType').selectedIndex  = 0;

    selectedTechs = [];
    renderTags();

    preview.style.display     = 'none';
    preview.src               = '';
    placeholder.style.display = 'block';
    uploadArea.classList.remove('has-image');

    toggleFields();
}

document.getElementById('btnCancel').addEventListener('click', resetForm);

// ============================================================
// 11. LISTING & SUPPRESSION PROJETS
// ============================================================
async function loadProjects() {
    const listContainer = document.getElementById('projectsList');
    listContainer.innerHTML = `<p style="text-align:center;color:#94a3b8;">Chargement...</p>`;

    const { data, error } = await supabaseClient
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        listContainer.innerHTML = `<p style="color:red">Erreur : ${Security.sanitizeHTML(error.message)}</p>`;
        return;
    }

    allProjects = data;

    if (data.length === 0) {
        listContainer.innerHTML = `<p style="text-align:center;color:var(--text-light);">Aucun projet.</p>`;
        return;
    }

    listContainer.innerHTML = '';
    data.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'card-preview';
        const imgDisplay = proj.image || 'https://placehold.co/600x400/e0e7ff/3730a3?text=No+Image';

        card.innerHTML = `
            <img src="${Security.sanitizeHTML(imgDisplay)}" alt="Projet" onerror="this.src='https://placehold.co/600x400/e0e7ff/3730a3?text=IMG'">
            <div class="card-info">
                <span class="card-cat">${Security.sanitizeHTML(proj.cat_label || proj.category)}</span>
                <div class="card-title">${Security.sanitizeHTML(proj.title_default)}</div>
                <div class="card-actions">
                    <button class="action-btn edit-btn" onclick="editProject(${proj.id})">✏️ Modifier</button>
                    <button class="action-btn delete-btn" onclick="deleteProject(${proj.id})">🗑️</button>
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

window.deleteProject = async (id) => {
    const confirmed = await confirmDialog(
        'Supprimer ce projet ?',
        'Cette action est irréversible. Le projet sera définitivement supprimé.',
        'Supprimer', 'danger'
    );
    if (!confirmed) return;

    // Récupère le projet avant suppression
    const proj = allProjects.find(p => p.id === id);

    const { error } = await supabaseClient.from('projects').delete().eq('id', id);
    if (error) {
        Toast.error('Erreur lors de la suppression.');
        return;
    }

    // Supprime l'image du bucket si elle vient de portfolio-images
    if (proj?.image) {
        try {
            const url = new URL(proj.image);
            const marker = '/portfolio-images/';
            const idx = url.pathname.indexOf(marker);

            if (idx !== -1) {
                const fileName = url.pathname.substring(idx + marker.length);
                const { error: storageError } = await supabaseClient.storage
                    .from('portfolio-images')
                    .remove([decodeURIComponent(fileName)]);

                if (storageError) {
                    console.warn('Image non supprimée du bucket :', storageError.message);
                    Toast.warning('Projet supprimé, mais l\'image n\'a pas pu être retirée du stockage.');
                }
            }
        } catch (e) {
            console.warn('Erreur parsing URL image :', e);
        }
    }

    Toast.success('Projet supprimé.');
    if (currentEditId === id) resetForm();
    loadProjects();
};

// Init
loadProjects();
toggleFields();

// ============================================================
// 12. GESTION DES COMPTES (POP-UP)
// ============================================================
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
    ['newUsername', 'newEmail', 'newPass'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function showAddUser() {
    document.getElementById('accMenu').style.display    = 'none';
    document.getElementById('accAddForm').style.display = 'block';
}

async function showDeleteUser() {
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

    const errors = [];
    if (!username)                               errors.push('Le nom est requis.');
    if (!email || !Security.isValidEmail(email)) errors.push('Email invalide.');
    if (!password)                               errors.push('Le mot de passe est requis.');
    else if (!Security.isStrongPassword(password)) {
        errors.push('Mot de passe trop faible. Minimum 8 caractères, 1 majuscule, 1 chiffre, 1 caractère spécial.');
    }

    if (errors.length > 0) {
        Toast.warning(errors.join(' '));
        return;
    }

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
            data: { display_name: username, role: dbRole, must_change_password: true }
        }
    });

    if (error) {
        Toast.error('Erreur lors de la création : ' + error.message);
        return;
    }

    if (data.user) {
        await supabaseClient.from('profiles').update({ role: dbRole }).eq('id', data.user.id);
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
    const isAdmin = await Security.requireRole('admin');
    if (!isAdmin) {
        Toast.error('Accès refusé.');
        return;
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session && session.user.id === targetId) {
        Toast.warning('Vous ne pouvez pas supprimer votre propre compte.');
        return;
    }

    const confirmed = await confirmDialog(
        'Supprimer ce compte ?',
        '⚠️ Cette action est irréversible. Elle supprimera le profil et l\'accès de connexion de cet utilisateur.',
        'Supprimer définitivement', 'danger'
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