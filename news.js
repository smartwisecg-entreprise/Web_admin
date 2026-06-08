// ==========================================
// NEWS - CRUD actualités (uniquement)
// ==========================================

let allNewsData = [];
let currentEditId = null;
let currentEditImageUrl = '';

document.getElementById('date').valueAsDate = new Date();

const CAT_TRANSLATIONS = {
    'Produits & Services': 'Products & Services',
    'Entreprise':          'Corporate',
    'Technologie':         'Technology',
    'Info Pratique':       'Useful Info',
    'Impact':              'Social Impact',
    'Événement':           'Event'
};

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

    const errors = validateArticleForm(fields);
    if (errors.length > 0) {
        Toast.warning(errors.join(' '));
        document.getElementById('title_fr').focus();
        return;
    }

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
        'Supprimer', 'danger'
    );
    if (!confirmed) return;

    const article = allNewsData.find(n => n.id === id);

    const { error } = await supabaseClient.from('news').delete().eq('id', id);
    if (error) {
        Toast.error('Erreur lors de la suppression.');
        return;
    }

    if (article?.image) {
        try {
            const url = new URL(article.image);
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

// ---- Init ----
checkUser(() => loadNews());
