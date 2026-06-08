// ==========================================
// PROJECTS - CRUD projets (uniquement)
// ==========================================

let allProjects = [];
let currentEditId = null;
let currentEditImageUrl = '';

// ---- IMAGE PREVIEW ----
const imageInput = document.getElementById('imageFile');
const preview    = document.getElementById('currentImagePreview');
const placeholder = document.getElementById('uploadPlaceholder');
const uploadArea  = document.getElementById('uploadArea');

imageInput.addEventListener('change', function () {
    const file = this.files[0];
    if (!file) return;

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

// ---- TAGS TECH ----
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

// ---- FORMULAIRE ----
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

function validateProjectForm(fields) {
    const errors = [];
    if (!fields.titleFR.trim()) {
        errors.push('Le titre en français est obligatoire.');
    } else if (fields.titleFR.length > 200) {
        errors.push('Le titre ne peut pas dépasser 200 caractères.');
    }
    return errors;
}

// ---- Sauvegarder ----
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

    const errors = validateProjectForm(fields);
    if (errors.length > 0) {
        Toast.warning(errors.join(' '));
        document.getElementById('titleDefault').focus();
        return;
    }

    btn.disabled  = true;
    btn.innerHTML = currentEditId ? '💾 Modification...' : '⏳ Publication...';

    try {
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

        if (selectedTechs.length === 0 && techInput.value.trim() !== '') {
            selectedTechs.push(Security.truncate(techInput.value.trim(), 50));
        }
        const techString = selectedTechs.join(', ');

        const modalDetailsFR = {
            title: fields.titleFR, client: fields.client,
            full_desc: fields.fullDescFR, tech: techString,
        };
        const modalDetailsEN = {
            title: fields.titleEN || fields.titleFR, client: fields.client,
            full_desc: fields.fullDescEN || fields.fullDescFR, tech: techString,
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

// ---- Edit & Reset ----
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
            ? (proj.modal_details_en.full_desc || '') : '';

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

// ---- Listing & Delete ----
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

    const proj = allProjects.find(p => p.id === id);

    const { error } = await supabaseClient.from('projects').delete().eq('id', id);
    if (error) {
        Toast.error('Erreur lors de la suppression.');
        return;
    }

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

// ---- Init ----
checkUser(() => loadProjects());
toggleFields();
