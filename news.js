// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
const SUPABASE_URL = 'https://neensjugjhkvwcqslicr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lZW5zanVnamhrdndjcXNsaWNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5Mjg1NzQsImV4cCI6MjA4MTUwNDU3NH0.eDEhhT8HzetCntUZ2LYkZhtoUjSjmFxPQqm03aAL8tU';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
// 2. GESTION DE LA MODALE AVATAR AVEC AJUSTEMENT
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
        // 2. Récupération du profil
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('display_name, avatar_url, role')
            .eq('id', session.user.id)
            .single();

        if (error) throw error;

        // 3. Affichage du contenu
        document.getElementById('adminContent').style.display = 'block';

        const nameDisplay = document.getElementById('userName');
        const avatarDisplay = document.getElementById('userAvatar');
        const roleDisplay = document.getElementById('userRole');

        nameDisplay.innerText = profile.display_name || session.user.email;
        const userRole = profile.role || "editeur";
        if (roleDisplay) roleDisplay.innerText = userRole.toUpperCase();

        if (profile.avatar_url) {
            avatarDisplay.src = profile.avatar_url;
        } else {
            avatarDisplay.src = `https://ui-avatars.com/api/?name=${profile.display_name || 'Admin'}&background=4e7994&color=fff`;
        }
        avatarDisplay.style.display = 'block';

        if (userRole === 'admin' || userRole === 'administrator') {
            const btnAccounts = document.getElementById('btnManageAccounts');
            if (btnAccounts) btnAccounts.style.display = 'inline-block';
        }

        // --- CORRECTION ICI : loadProjects() devient loadNews() ---
        loadNews();

    } catch (err) {
        console.error("Erreur profil:", err);
        document.getElementById('userName').innerText = session.user.email;
        document.getElementById('adminContent').style.display = 'block';

        // --- CORRECTION ICI AUSSI ---
        loadNews();
    }
}

async function logout() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) alert("Erreur lors de la déconnexion");
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') window.location.href = 'index.html';
});

// Lancement unique de la vérification
checkUser();

// ==========================================
// 4. GESTION DES ARTICLES (CRUD)
// ==========================================
let allNewsData = [];
let currentEditId = null;
let currentEditImageUrl = "";

document.getElementById('date').valueAsDate = new Date();

// SAUVEGARDER (CRÉER OU MODIFIER)
document.getElementById('btnSave').addEventListener('click', async () => {
    const btn = document.getElementById('btnSave');
    const status = document.getElementById('status');
    const fileInput = document.getElementById('imageFile');
    const file = fileInput.files[0];

    const titleFR = document.getElementById('title_fr').value;
    const titleEN = document.getElementById('title_en').value;
    const summaryFR = document.getElementById('summary_fr').value;
    const summaryEN = document.getElementById('summary_en').value;
    const contentFR = document.getElementById('content_fr').value;
    const contentEN = document.getElementById('content_en').value;
    const dateVal = document.getElementById('date').value;
    const catFR = document.getElementById('category').value;

    status.style.display = 'none';

    if (!titleFR) {
        alert("Le titre en français est obligatoire");
        document.getElementById('title_fr').focus();
        return;
    }

    btn.disabled = true;
    btn.innerHTML = currentEditId ? "<span>💾 Enregistrement...</span>" : "<span>⏳ Publication...</span>";

    try {
        let imageUrl = currentEditImageUrl;

        if (!currentEditId && !file) {
            imageUrl = "https://placehold.co/800x400?text=Smart+Wise";
        }

        if (file) {
            const fileExt = file.name.split('.').pop();
            const cleanName = Date.now() + Math.random().toString(36).substring(7);
            const fileName = `news_${cleanName}.${fileExt}`;

            const { error: upErr } = await supabaseClient.storage.from('news-images').upload(fileName, file);
            if (upErr) throw upErr;

            const { data: urlData } = supabaseClient.storage.from('news-images').getPublicUrl(fileName);
            imageUrl = urlData.publicUrl;
        }

        const catTranslations = {
            "Produits & Services": "Products & Services",
            "Entreprise": "Corporate",
            "Technologie": "Technology",
            "Info Pratique": "Useful Info",
            "Impact": "Social Impact",
            "Événement": "Event"
        };
        const catEN = catTranslations[catFR] || catFR;

        const payload = {
            date: dateVal,
            image: imageUrl,
            title_fr: titleFR,
            category_fr: catFR,
            summary_fr: summaryFR,
            content_fr: contentFR,
            title_en: titleEN || titleFR,
            category_en: catEN,
            summary_en: summaryEN || summaryFR,
            content_en: contentEN || contentFR
        };

        let error = null;

        if (currentEditId) {
            const { error: updateErr } = await supabaseClient.from('news').update(payload).eq('id', currentEditId);
            error = updateErr;
            status.innerText = "✅ Article modifié avec succès !";
        } else {
            const { error: insertErr } = await supabaseClient.from('news').insert([payload]);
            error = insertErr;
            status.innerText = "✅ Article publié avec succès !";
        }

        if (error) throw error;

        status.style.background = "#d1fae5";
        status.style.color = "#065f46";
        status.style.display = 'block';

        setTimeout(() => { status.style.display = 'none'; }, 2000);

        resetForm();
        loadNews();

    } catch (e) {
        console.error(e);
        status.innerText = "❌ Erreur: " + e.message;
        status.style.background = "#fee2e2";
        status.style.color = "#991b1b";
        status.style.display = 'block';
    } finally {
        btn.disabled = false;
        if (!currentEditId) btn.innerHTML = "<span>🚀 Publier l'article</span>";
    }
});

// LISTER LES ARTICLES
async function loadNews() {
    const div = document.getElementById('newsList');
    const { data, error } = await supabaseClient.from('news').select('*').order('date', { ascending: false });

    if (error) {
        div.innerHTML = `<p style="color:red">Erreur: ${error.message}</p>`;
        return;
    }

    allNewsData = data || [];

    if (allNewsData.length === 0) {
        div.innerHTML = `<p style="text-align:center; color:#94a3b8;">Aucun article en ligne.</p>`;
        return;
    }

    div.innerHTML = "";
    allNewsData.forEach(item => {
        const dateStr = new Date(item.date).toLocaleDateString('fr-FR');
        div.innerHTML += `
            <div class="news-item">
                <div class="news-content">
                    <img src="${item.image}" alt="Cover" onerror="this.src='https://placehold.co/80?text=IMG'">
                    <div class="news-info">
                        <h3>${item.title_fr}</h3>
                        <div class="news-meta">
                            <span>📅 ${dateStr}</span>
                            <span class="badge">${item.category_fr}</span>
                        </div>
                    </div>
                </div>
                <div class="actions">
                    <button class="action-btn edit-btn" onclick="editNews(${item.id})">✏️ Modifier</button>
                    <button class="action-btn delete-btn" onclick="deleteNews(${item.id})">🗑️</button>
                </div>
            </div>
        `;
    });
}

// FONCTION EDITER
window.editNews = (id) => {
    const article = allNewsData.find(n => n.id === id);
    if (!article) return;

    currentEditId = id;
    currentEditImageUrl = article.image;

    document.getElementById('formTitle').innerText = "Modifier l'actualité";
    document.getElementById('btnSave').innerHTML = "<span>💾 Mettre à jour</span>";
    document.getElementById('btnSave').style.background = "#f59e0b";
    document.getElementById('btnCancel').style.display = "flex";

    document.getElementById('date').value = article.date;
    document.getElementById('category').value = article.category_fr;
    document.getElementById('title_fr').value = article.title_fr;
    document.getElementById('summary_fr').value = article.summary_fr || "";
    document.getElementById('content_fr').value = article.content_fr;
    document.getElementById('title_en').value = article.title_en || "";
    document.getElementById('summary_en').value = article.summary_en || "";
    document.getElementById('content_en').value = article.content_en || "";

    const imgPrev = document.getElementById('currentImagePreview');
    imgPrev.src = article.image;
    imgPrev.style.display = 'block';

    // Gérer l'affichage du placeholder
    document.getElementById('uploadPlaceholder').style.display = 'none';
    document.getElementById('uploadArea').classList.add('has-image');

    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// FONCTION RESET
function resetForm() {
    currentEditId = null;
    currentEditImageUrl = "";

    document.getElementById('formTitle').innerText = "Publier une Actualité";
    document.getElementById('btnSave').innerHTML = "<span>🚀 Publier l'article</span>";
    document.getElementById('btnSave').style.background = "var(--primary)";
    document.getElementById('btnCancel').style.display = "none";

    // Reset Image Preview
    const preview = document.getElementById('currentImagePreview');
    preview.style.display = 'none';
    preview.src = "";
    document.getElementById('uploadPlaceholder').style.display = 'block';
    document.getElementById('uploadArea').classList.remove('has-image');

    document.querySelectorAll('input[type="text"], textarea').forEach(el => el.value = "");
    document.getElementById('imageFile').value = "";
    document.getElementById('date').valueAsDate = new Date();
}

document.getElementById('btnCancel').addEventListener('click', () => { resetForm(); });

// SUPPRIMER
window.deleteNews = async (id) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet article définitivement ?")) {
        const { error } = await supabaseClient.from('news').delete().eq('id', id);
        if (error) alert("Erreur lors de la suppression");
        loadNews();
        if (currentEditId === id) resetForm();
    }
}

// GESTION APERÇU IMAGE (FILE READER)
document.getElementById('imageFile').addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('currentImagePreview');
            preview.src = e.target.result;
            preview.style.display = 'block';
            document.getElementById('uploadPlaceholder').style.display = 'none';
            document.getElementById('uploadArea').classList.add('has-image');
        }
        reader.readAsDataURL(file);
    }
});

// Initialisation
loadNews();
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