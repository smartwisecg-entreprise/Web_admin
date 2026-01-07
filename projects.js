// ============================================================
// CONFIGURATION SUPABASE
// ============================================================
const SUPABASE_URL = 'https://neensjugjhkvwcqslicr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lZW5zanVnamhrdndjcXNsaWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5Mjg1NzQsImV4cCI6MjA4MTUwNDU3NH0.eDEhhT8HzetCntUZ2LYkZhtoUjSjmFxPQqm03aAL8tU';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// GESTION DE LA MODALE AVATAR AVEC AJUSTEMENT
// ==========================================

let cropper; // Variable globale pour l'outil de recadrage
const modalPreview = document.getElementById('modalAvatarPreview');
const uploadBtn = document.querySelector('.upload-btn');

// 1. Ouvrir la modale
document.querySelector('.user-profile-box').onclick = function () {
    const currentSrc = document.getElementById('userAvatar').src;
    modalPreview.src = currentSrc;
    document.getElementById('avatarModal').style.display = 'flex';
};

// 2. Fermer la modale et nettoyer
function closeAvatarModal() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    document.getElementById('avatarModal').style.display = 'none';
    // Remettre le bouton dans son état initial
    uploadBtn.innerHTML = "<span>📷</span> Modifier";
    uploadBtn.onclick = triggerFileInput;
}

// 3. Déclencher le choix de fichier
function triggerFileInput() {
    document.getElementById('avatarInputHidden').click();
}

// 4. Charger l'image dans l'outil d'ajustement (Lancé après choix du fichier)
async function uploadAvatar(input) {
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        // 1. On affecte la source
        modalPreview.src = e.target.result;

        // 2. On attend que l'image soit chargée dans le DOM pour lancer Cropper
        modalPreview.onload = function () {
            // Détruire l'ancien cropper s'il existe
            if (cropper) {
                cropper.destroy();
            }

            // Initialiser Cropper.js
            cropper = new Cropper(modalPreview, {
                aspectRatio: 1,
                viewMode: 1, // Restreint la boîte de recadrage à l'intérieur du canvas
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
                    console.log("Cropper est prêt");
                    // Transformer le bouton
                    uploadBtn.innerHTML = "<span>✅</span> Valider ce cadrage";
                    uploadBtn.onclick = confirmCrop;
                }
            });
        };
    };
    reader.readAsDataURL(file);
}

// 5. Envoyer l'image recadrée sur Supabase
async function confirmCrop() {
    if (!cropper) return;

    // Récupérer le canvas de l'image recadrée (400x400px pour un bon ratio qualité/poids)
    cropper.getCroppedCanvas({ width: 400, height: 400 }).toBlob(async (blob) => {
        try {
            uploadBtn.innerText = "Chargement...";
            uploadBtn.disabled = true;

            const { data: { session } } = await supabaseClient.auth.getSession();
            const userId = session.user.id;

            // Nom de fichier unique pour éviter le cache navigateur
            const fileName = `${userId}/${Date.now()}.png`;

            // A. Upload vers le bucket 'avatars'
            const { error: uploadError } = await supabaseClient.storage
                .from('avatars')
                .upload(fileName, blob, { contentType: 'image/png', upsert: true });

            if (uploadError) throw uploadError;

            // B. Récupérer l'URL publique
            const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
            const publicUrl = urlData.publicUrl;

            // C. Mettre à jour la table 'profiles'
            const { error: dbError } = await supabaseClient
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', userId);

            if (dbError) throw dbError;

            // D. Mise à jour de l'interface en temps réel
            document.getElementById('userAvatar').src = publicUrl;
            alert("Photo de profil mise à jour !");
            closeAvatarModal();

        } catch (error) {
            alert("Erreur lors de l'enregistrement : " + error.message);
        } finally {
            uploadBtn.disabled = false;
        }
    }, 'image/png');
}

// 6. Supprimer l'avatar (Retour aux initiales)
async function deleteAvatar() {
    if (!confirm("Supprimer votre photo de profil ?")) return;

    const { data: { session } } = await supabaseClient.auth.getSession();
    const userId = session.user.id;

    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ avatar_url: null })
            .eq('id', userId);

        if (error) throw error;

        // Remettre l'avatar par défaut via l'API ui-avatars
        const name = document.getElementById('userName').innerText;
        const defaultAvatar = `https://ui-avatars.com/api/?name=${name}&background=4e7994&color=fff`;

        document.getElementById('userAvatar').src = defaultAvatar;
        alert("Photo supprimée.");
        closeAvatarModal();

    } catch (error) {
        alert("Erreur : " + error.message);
    }
}

// Fermer la modale si on clique à côté
window.onclick = function (event) {
    const modal = document.getElementById('avatarModal');
    if (event.target == modal) closeAvatarModal();
}


// ==========================================
// 3. AUTHENTIFICATION ET PROFIL
// ==========================================
async function checkUser() {
    // 1. Vérification de la session
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    try {
        // 2. Récupération du profil complet depuis Supabase
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('display_name, avatar_url, role')
            .eq('id', session.user.id)
            .single();

        if (error) throw error;

        // 3. Affichage du contenu principal
        document.getElementById('adminContent').style.display = 'block';

        // 4. Mise à jour de la barre utilisateur (Nom, Rôle, Avatar)
        const nameDisplay = document.getElementById('userName');
        const avatarDisplay = document.getElementById('userAvatar');
        const roleDisplay = document.getElementById('userRole');

        nameDisplay.innerText = profile.display_name || session.user.email;

        // Définition du rôle (par défaut 'editeur' si vide)
        const userRole = profile.role || "editeur";
        if (roleDisplay) roleDisplay.innerText = userRole.toUpperCase();

        // Gestion de l'avatar
        if (profile.avatar_url) {
            avatarDisplay.src = profile.avatar_url;
        } else {
            avatarDisplay.src = `https://ui-avatars.com/api/?name=${profile.display_name || 'Admin'}&background=4e7994&color=fff`;
        }
        avatarDisplay.style.display = 'block';

        // --- 🔴 LOGIQUE D'AFFICHAGE DU BOUTON COMPTES 🔴 ---
        // Si le rôle est 'admin', on affiche le bouton caché
        if (userRole === 'admin' || userRole === 'administrator') {
            const btnAccounts = document.getElementById('btnManageAccounts');
            if (btnAccounts) {
                btnAccounts.style.display = 'inline-block'; // Ou 'flex' selon votre CSS
            }
        }
        // ----------------------------------------------------

        // 5. Chargement des données de la page
        // IMPORTANT : Si tu es sur la page "Projets", garde loadProjects()
        // Si tu es sur la page "News", mets loadNews()
        loadProjects();

    } catch (err) {
        console.error("Erreur profil:", err);
        // En cas d'erreur (ex: pas de profil créé), on affiche quand même l'email
        document.getElementById('userName').innerText = session.user.email;
        document.getElementById('adminContent').style.display = 'block';

        loadProjects();
    }
}
async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) alert("Erreur lors de la déconnexion");
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
});

checkUser();
// ============================================================
// VARIABLES GLOBALES
// ============================================================
let allProjects = [];
let currentEditId = null;
let currentEditImageUrl = "";

// ============================================================
// GESTION IMAGE PREVIEW (Drag & Drop style)
// ============================================================
const imageInput = document.getElementById('imageFile');
const preview = document.getElementById('currentImagePreview');
const placeholder = document.getElementById('uploadPlaceholder');
const uploadArea = document.getElementById('uploadArea');

imageInput.addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
            uploadArea.classList.add('has-image');
        }
        reader.readAsDataURL(file);
    }
});

// ============================================================
// LOGIQUE TAGS TECH
// ============================================================
const availableTechs = [
    "HTML5", "CSS3", "JavaScript", "TypeScript", "Python", "PHP", "Java", "C#", "Go", "Swift",
    "React", "Vue.js", "Angular", "Next.js", "Node.js", "Django", "Laravel", "Spring Boot",
    "WordPress", "Shopify", "MySQL", "PostgreSQL", "MongoDB", "Firebase", "Supabase",
    "Docker", "Kubernetes", "AWS", "Google Cloud", "Figma", "Adobe XD", "Flutter", "React Native"
];
let selectedTechs = [];
const techInput = document.getElementById('techInput');
const suggestionsBox = document.getElementById('suggestionsBox');
const techWrapper = document.getElementById('techWrapper');

techInput.addEventListener('input', function () {
    const val = this.value.toLowerCase();
    suggestionsBox.innerHTML = '';
    if (!val) { suggestionsBox.style.display = 'none'; return; }
    const matches = availableTechs.filter(t => t.toLowerCase().includes(val) && !selectedTechs.includes(t));
    if (matches.length > 0) {
        matches.forEach(tech => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = tech;
            div.onclick = () => addTech(tech);
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    } else { suggestionsBox.style.display = 'none'; }
});

function addTech(techName) {
    if (selectedTechs.includes(techName)) return;
    selectedTechs.push(techName);
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
    const existingTags = techWrapper.querySelectorAll('.tech-tag');
    existingTags.forEach(t => t.remove());
    selectedTechs.forEach(tech => {
        const tag = document.createElement('div');
        tag.className = 'tech-tag';
        tag.innerHTML = `${tech} <span onclick="removeTech('${tech}')">&times;</span>`;
        techWrapper.insertBefore(tag, techInput);
    });
}

document.addEventListener('click', function (e) {
    if (!techWrapper.contains(e.target)) suggestionsBox.style.display = 'none';
});

// ============================================================
// LOGIQUE FORMULAIRE
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

document.getElementById('btnSave').addEventListener('click', async () => {
    const btn = document.getElementById('btnSave');
    const status = document.getElementById('statusMessage');

    // Get values
    const titleFR = document.getElementById('titleDefault').value;
    const descFR = document.getElementById('descDefault').value;
    const fullDescFR = document.getElementById('fullDesc').value;

    const titleEN = document.getElementById('titleEn').value;
    const descEN = document.getElementById('descEn').value;
    const fullDescEN = document.getElementById('fullDescEn').value;

    if (!titleFR) return alert("Le titre en français est obligatoire !");

    btn.disabled = true;
    btn.innerHTML = currentEditId ? "💾 Modification..." : "⏳ Publication...";
    status.style.display = 'none';

    try {
        // 1. Image Upload Logic
        let imageUrl = currentEditImageUrl || "https://placehold.co/600x400/e0e7ff/4e7994?text=Projet";
        const fileInput = document.getElementById('imageFile');

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileExt = file.name.split('.').pop();
            const cleanName = `proj_${Date.now()}.${fileExt}`;

            const { error: upError } = await supabaseClient.storage.from('portfolio-images').upload(cleanName, file);
            if (upError) throw upError;

            const { data: publicUrlData } = supabaseClient.storage.from('portfolio-images').getPublicUrl(cleanName);
            imageUrl = publicUrlData.publicUrl;
        }

        // 2. Data Preparation
        const catValue = document.getElementById('category').value;
        const type = document.getElementById('projType').value;

        // Gestion Tags manuels si pas dans la liste
        if (selectedTechs.length === 0 && techInput.value.trim() !== "") {
            selectedTechs.push(techInput.value.trim());
        }
        const techString = selectedTechs.join(', ');

        // Traductions automatiques Catégories
        const labelsFR = {
            'web': 'Développement Web', 'logiciel': 'Logiciels & Desktop', 'mobile': 'Applications Mobiles',
            'infra': 'Infrastructure & Cloud', 'devops': 'DevOps & CI/CD', 'data': 'Data & IA',
            'uiux': 'Design UI/UX', 'cyber': 'Cybersécurité'
        };
        const labelsEN = {
            'web': 'Web Development', 'logiciel': 'Software & Desktop', 'mobile': 'Mobile Apps',
            'infra': 'Infrastructure & Cloud', 'devops': 'DevOps & CI/CD', 'data': 'Data & AI',
            'uiux': 'UI/UX Design', 'cyber': 'Cybersecurity'
        };

        const modalDetailsFR = {
            title: titleFR,
            client: document.getElementById('clientName').value,
            full_desc: fullDescFR,
            tech: techString
        };
        const modalDetailsEN = {
            title: titleEN || titleFR,
            client: document.getElementById('clientName').value,
            full_desc: fullDescEN || fullDescFR,
            tech: techString
        };

        const projectData = {
            type: type,
            category: catValue,
            image: imageUrl,
            cat_key: `cat_${catValue}`,
            cat_label: labelsFR[catValue],
            cat_label_en: labelsEN[catValue],
            title_default: titleFR,
            desc_default: descFR,
            modal_details: type === 'modal' ? modalDetailsFR : null,
            title_en: titleEN || titleFR,
            desc_en: descEN || descFR,
            modal_details_en: type === 'modal' ? modalDetailsEN : null,
            link_url: type === 'link' ? document.getElementById('linkUrl').value : null
        };

        // 3. Insert or Update
        if (currentEditId) {
            const { error } = await supabaseClient.from('projects').update(projectData).eq('id', currentEditId);
            if (error) throw error;
            status.innerHTML = "✅ Projet modifié avec succès !";
        } else {
            const { error } = await supabaseClient.from('projects').insert([projectData]);
            if (error) throw error;
            status.innerHTML = "✨ Projet ajouté avec succès !";
        }

        status.style.background = "#d1fae5";
        status.style.color = "#065f46";
        status.style.display = "block";

        setTimeout(() => status.style.display = 'none', 3000);
        resetForm();
        loadProjects();

    } catch (error) {
        console.error(error);
        status.textContent = "❌ Erreur : " + error.message;
        status.style.background = "#fee2e2";
        status.style.color = "#991b1b";
        status.style.display = "block";
    } finally {
        btn.disabled = false;
        btn.innerHTML = currentEditId ? "🚀 Mettre à jour" : "🚀 Publier le Projet";
    }
});

// ============================================================
// EDIT & RESET
// ============================================================
window.editProject = (id) => {
    const proj = allProjects.find(p => p.id === id);
    if (!proj) return;

    currentEditId = id;
    currentEditImageUrl = proj.image;

    // UI Changes
    document.getElementById('formTitle').innerText = "Modifier le Projet";
    const btn = document.getElementById('btnSave');
    btn.innerHTML = "💾 Mettre à jour";
    btn.style.background = "#f59e0b"; // Warning color
    document.getElementById('btnCancel').style.display = 'flex';

    // Fill Simple Fields
    document.getElementById('projType').value = proj.type;
    document.getElementById('category').value = proj.category;

    document.getElementById('titleDefault').value = proj.title_default;
    document.getElementById('titleEn').value = proj.title_en || "";
    document.getElementById('descDefault').value = proj.desc_default;
    document.getElementById('descEn').value = proj.desc_en || "";

    // Fill Image Preview
    if (proj.image) {
        preview.src = proj.image;
        preview.style.display = 'block';
        placeholder.style.display = 'none';
        uploadArea.classList.add('has-image');
    }

    // Fill Modal Fields
    if (proj.type === 'modal' && proj.modal_details) {
        document.getElementById('clientName').value = proj.modal_details.client || "";
        document.getElementById('fullDesc').value = proj.modal_details.full_desc || "";
        document.getElementById('fullDescEn').value = (proj.modal_details_en && proj.modal_details_en.full_desc) || "";

        // Restore Tags
        selectedTechs = [];
        if (proj.modal_details.tech) {
            selectedTechs = proj.modal_details.tech.split(',').map(s => s.trim()).filter(s => s);
        }
        renderTags();
    }

    // Fill Link Fields
    if (proj.type === 'link') {
        document.getElementById('linkUrl').value = proj.link_url || "";
    }

    toggleFields();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    currentEditId = null;
    currentEditImageUrl = "";
    document.getElementById('formTitle').innerText = "Nouveau Projet";
    const btn = document.getElementById('btnSave');
    btn.innerHTML = "🚀 Publier le Projet";
    btn.style.background = "var(--primary)";
    document.getElementById('btnCancel').style.display = 'none';

    // Reset Inputs
    document.querySelectorAll('input, textarea').forEach(i => i.value = "");
    document.getElementById('category').selectedIndex = 0;
    document.getElementById('projType').selectedIndex = 0;

    // Reset Tags
    selectedTechs = [];
    renderTags();

    // Reset Image
    preview.style.display = 'none';
    preview.src = "";
    placeholder.style.display = 'block';
    uploadArea.classList.remove('has-image');

    toggleFields();
}

document.getElementById('btnCancel').addEventListener('click', resetForm);

// ============================================================
// LISTING & DELETE
// ============================================================
async function loadProjects() {
    const listContainer = document.getElementById('projectsList');
    const { data, error } = await supabaseClient
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        listContainer.innerHTML = `<p style="color:red">Erreur : ${error.message}</p>`;
        return;
    }

    allProjects = data; // Store globally
    listContainer.innerHTML = "";

    if (data.length === 0) {
        listContainer.innerHTML = `<p style="text-align:center; color: var(--text-light);">Aucun projet.</p>`;
        return;
    }

    data.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'card-preview';
        const imgDisplay = proj.image ? proj.image : 'https://placehold.co/600x400/e0e7ff/3730a3?text=No+Image';

        card.innerHTML = `
                <img src="${imgDisplay}" alt="Proj">
                <div class="card-info">
                    <span class="card-cat">${proj.cat_label || proj.category}</span>
                    <div class="card-title">${proj.title_default}</div>
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
    if (confirm("Voulez-vous vraiment supprimer ce projet ?")) {
        await supabaseClient.from('projects').delete().eq('id', id);
        if (currentEditId === id) resetForm();
        loadProjects();
    }
}

// Init
loadProjects();
toggleFields();

// ==========================================
// GESTION DES COMPTES (POP-UP)
// ==========================================

// 1. Ouvrir / Fermer la modale
function openAccountModal() {
    resetAccView();
    document.getElementById('accountModal').style.display = 'flex';
}

function closeAccountModal() {
    document.getElementById('accountModal').style.display = 'none';
}

// 2. Navigation dans la modale
function resetAccView() {
    document.getElementById('accMenu').style.display = 'flex';
    document.getElementById('accAddForm').style.display = 'none';
    document.getElementById('accListPanel').style.display = 'none';
    document.getElementById('newUsername').value = ''; // <--- RAJOUTER ICI
    document.getElementById('newEmail').value = '';
    document.getElementById('newPass').value = '';
}

function showAddUser() {
    document.getElementById('accMenu').style.display = 'none';
    document.getElementById('accAddForm').style.display = 'block';
}

async function showDeleteUser() {
    document.getElementById('accMenu').style.display = 'none';
    document.getElementById('accListPanel').style.display = 'block';
    loadUsersList();
}

// 3. CRÉER UN UTILISATEUR (Avec traduction du rôle)
async function createUser() {
    const username = document.getElementById('newUsername').value;
    const email = document.getElementById('newEmail').value;
    const password = document.getElementById('newPass').value;
    const rawRole = document.getElementById('newRole').value; // Récupère la valeur du HTML

    if (!email || !password || !username) return alert("Email, Nom et mot de passe requis.");

    // --- TRADUCTION JAVASCRIPT ---
    // On convertit le français vers les termes techniques de la Base de Données
    let dbRole = 'editor'; // valeur par défaut

    // Si la valeur est 'admin' ou 'administrateur', on envoie 'admin'
    if (rawRole.toLowerCase().includes('admin')) {
        dbRole = 'admin';
    }
    // Sinon on force 'editor' (pour gérer 'editeur', 'éditeur', 'editor', etc.)
    else {
        dbRole = 'editor';
    }
    // -----------------------------

    // Création Auth Supabase
    const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
            data: {
                display_name: username,
                role: dbRole, // <--- On envoie la version traduite (anglais)
                must_change_password: true
            }
        }
    });

    if (error) {
        alert("Erreur : " + error.message);
    } else {
        // Mise à jour de sécurité si le trigger n'a pas tout attrapé (optionnel mais recommandé)
        if (data.user) {
            await supabaseClient.from('profiles').update({
                role: dbRole, // On s'assure que le profil a bien le rôle en anglais
            }).eq('id', data.user.id);
        }

        alert("✅ Utilisateur créé avec succès !");
        resetAccView();
    }
}

// 4. LISTER LES UTILISATEURS
async function loadUsersList() {
    const container = document.getElementById('usersListContainer');
    container.innerHTML = "Chargement...";

    // Note : J'ai retiré 'email' du select au cas où la colonne n'existe pas.
    // Si tu es sûr qu'elle existe, tu peux la remettre.
    const { data: profiles, error } = await supabaseClient
        .from('profiles')
        .select('id, display_name, role');

    if (error) {
        console.error(error);
        container.innerHTML = "Erreur de chargement.";
        return;
    }

    let html = '<ul style="list-style:none; padding:0; margin:0;">';

    profiles.forEach(p => {
        // --- TRADUCTION INVERSE POUR L'AFFICHAGE ---
        let displayRole = 'Editeur'; // Défaut
        if (p.role === 'admin') displayRole = 'Administrateur';
        if (p.role === 'editor') displayRole = 'Editeur';
        // -------------------------------------------

        html += `
        <li style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <strong>${p.display_name || 'Sans nom'}</strong> <br>
                <small style="color:#666; background:#f3f4f6; padding:2px 6px; border-radius:4px; font-size:0.8em;">
                    ${displayRole}
                </small>
            </div>
            <button onclick="deleteUserProfile('${p.id}')" title="Supprimer le profil" style="background:#fee2e2; color:c53030; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold;">
                ✕
            </button>
        </li>
        `;
    });
    html += '</ul>';

    if (profiles.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#888;'>Aucun utilisateur trouvé.</p>";
    } else {
        container.innerHTML = html;
    }
}


// 5. SUPPRESSION COMPLÈTE (PROFIL + AUTH)
async function deleteUserProfile(targetId) {
    // Le message change car maintenant on supprime TOUT pour de vrai
    if (!confirm("⚠️ ATTENTION : Cette action est IRRÉVERSIBLE.\n\nCela supprimera définitivement :\n- Le profil public\n- L'accès de connexion (Auth)\n\nÊtes-vous sûr ?")) {
        return;
    }

    // ICI c'est le changement important : on utilise .rpc() au lieu de .from().delete()
    const { error } = await supabaseClient.rpc('delete_user_account', {
        user_id: targetId
    });

    if (error) {
        console.error("Erreur RPC:", error);
        alert("Erreur lors de la suppression : " + error.message);
    } else {
        alert("✅ Utilisateur et compte Auth supprimés définitivement !");
        loadUsersList(); // Rafraîchir la liste
    }
}