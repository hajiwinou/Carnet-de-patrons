(function() {
  'use strict';

  /* Bibliothèques lourdes chargées seulement au premier usage */
  var LIB_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var LIB_ZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  var LIB_SRI = {};
  LIB_SRI[LIB_PDF] = 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e';
  LIB_SRI[LIB_ZIP] = 'sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG';
  var libP = {};
  function loadLib(src) {
    if (!libP[src]) libP[src] = new Promise(function(res, rej) {
      var el = document.createElement('script');
      if (LIB_SRI[src]) { el.integrity = LIB_SRI[src]; el.crossOrigin = 'anonymous'; }
      el.src = src; el.onload = res;
      el.onerror = function() { delete libP[src]; rej(new Error('Chargement impossible')); };
      document.head.appendChild(el);
    });
    return libP[src];
  }
  async function pdfLib() {
    if (!window.pdfjsLib) await loadLib(LIB_PDF);
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    return pdfjsLib;
  }
  /* Polices standard + CMaps : sans eux, le texte de nombreux PDF reste invisible */
  var PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';
  function pdfOpen(data) {
    return pdfLib().then(function(L) {
      return L.getDocument({ data: data, cMapUrl: PDFJS_CDN + 'cmaps/', cMapPacked: true, standardFontDataUrl: PDFJS_CDN + 'standard_fonts/', useSystemFonts: true, disableFontFace: true }).promise;
    });
  }
  async function needZip() { if (!window.JSZip) await loadLib(LIB_ZIP); }

  /* ============ Catalogue des Polices & Thèmes ============ */
  var FONTS = {
    jakarta: { name: 'Plus Jakarta Sans (Moderne & doux)', body: "'Plus Jakarta Sans', system-ui, sans-serif", head: "'Plus Jakarta Sans', system-ui, sans-serif" },
    dm: { name: 'DM Sans (Géométrique & épuré)', body: "'DM Sans', system-ui, sans-serif", head: "'DM Sans', system-ui, sans-serif" },
    lora: { name: 'Lora & Playfair (Éditorial / Magazine)', body: "'Lora', Georgia, serif", head: "'Playfair Display', Georgia, serif" },
    times: { name: 'Times New Roman (Classique Serif)', body: "'Times New Roman', Times, Georgia, serif", head: "'Times New Roman', Times, Georgia, serif" },
    inter: { name: 'Inter & Space Grotesk (Classique)', body: "'Inter', system-ui, sans-serif", head: "'Space Grotesk', sans-serif" },
    system: { name: 'Police système (Apple / Android)', body: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", head: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }
  };

  var ACCENT_PRESETS = [
    ['#2A47C9', 'Bleu Cobalt'],
    ['#9D4E6C', 'Vieux Rose'],
    ['#2E6F5E', 'Vert Sauge'],
    ['#B85D3B', 'Terracotta'],
    ['#6B4C9A', 'Prune Doux'],
    ['#1E293B', 'Ardoise']
  ];

  /* ============ Catalogue des fournisseurs IA ============ */
  var AI_PROVIDERS = {
    gemini: {
      id: 'gemini',
      name: 'Google Gemini',
      model: 'gemini-2.5-flash',
      vision: true,
      freeNote: 'Quota gratuit quotidien généreux — recommandé pour les PDF et photos.',
      placeholder: 'AIzaSy...',
      url: 'https://aistudio.google.com/app/apikey',
      urlLabel: 'Créer une clé gratuite sur Google AI Studio'
    },
    groq: {
      id: 'groq',
      name: 'Groq (Llama 3.3 70B)',
      model: 'llama-3.3-70b-versatile',
      vision: false,
      freeNote: 'Gratuit et ultra-rapide — idéal en secours ou pour l\'analyse de texte.',
      placeholder: 'gsk_...',
      url: 'https://console.groq.com/keys',
      urlLabel: 'Créer une clé gratuite sur Groq Console'
    },
    openrouter: {
      id: 'openrouter',
      name: 'OpenRouter (Modèles gratuits)',
      model: 'google/gemini-2.0-flash-exp:free',
      vision: true,
      freeNote: 'Agrégateur avec accès gratuit à Gemini Flash, Llama et Mistral.',
      placeholder: 'sk-or-v1-...',
      url: 'https://openrouter.ai/keys',
      urlLabel: 'Créer une clé gratuite sur OpenRouter'
    },
    openai: {
      id: 'openai',
      name: 'OpenAI (GPT-4o mini)',
      model: 'gpt-4o-mini',
      vision: true,
      freeNote: 'Nécessite un compte OpenAI avec crédits actifs.',
      placeholder: 'sk-proj-...',
      url: 'https://platform.openai.com/api-keys',
      urlLabel: 'Gérer vos clés sur OpenAI Platform'
    },
    omniroute: {
      id: 'omniroute',
      name: 'OmniRoute (passerelle multi-IA)',
      model: 'auto',
      vision: true,
      freeNote: 'Une seule adresse pour 60+ IA, avec bascule et modèles gratuits gérés par OmniRoute.',
      placeholder: 'Clé API OmniRoute (facultative si non exigée)',
      urlPlaceholder: 'https://mon-omniroute.exemple.com/v1',
      url: 'https://github.com/ChrisCompton/omniroute',
      urlLabel: 'Installer OmniRoute (GitHub)'
    }
  };
  var PROVIDER_IDS = ['gemini', 'groq', 'openrouter', 'openai', 'omniroute'];

  /* ============ Stockage IndexedDB pour PDF, Photos, Vidéos & Fond d'écran ============ */
  var IDB = {
    db: null,
    open: function() {
      var self = this;
      if (self.db) return Promise.resolve(self.db);
      return new Promise(function(resolve, reject) {
        if (!window.indexedDB) return reject(new Error('IndexedDB non supporté'));
        var req = indexedDB.open('carnet_patrons_db', 1);
        req.onupgradeneeded = function(e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains('blobs')) {
            db.createObjectStore('blobs');
          }
        };
        req.onsuccess = function(e) {
          self.db = e.target.result;
          resolve(self.db);
        };
        req.onerror = function() {
          reject(req.error || new Error('Erreur IndexedDB'));
        };
      });
    },
    put: function(id, blob) {
      return this.open().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction('blobs', 'readwrite');
          tx.objectStore('blobs').put(blob, id);
          tx.oncomplete = function() { resolve(id); };
          tx.onerror = tx.onabort = function() { reject(tx.error || new Error('Transaction interrompue')); };
        });
      });
    },
    get: function(id) {
      return this.open().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction('blobs', 'readonly');
          var req = tx.objectStore('blobs').get(id);
          req.onsuccess = function() { resolve(req.result || null); };
          req.onerror = function() { reject(req.error); };
        });
      });
    },
    keys: function() {
      return this.open().then(function(db) {
        return new Promise(function(resolve, reject) {
          var tx = db.transaction('blobs', 'readonly'), req = tx.objectStore('blobs').getAllKeys();
          req.onsuccess = function() { resolve(req.result || []); };
          req.onerror = function() { reject(req.error || new Error('Lecture du stockage impossible')); };
        });
      });
    },
    del: function(id) {
      return this.open().then(function(db) {
        return new Promise(function(resolve) {
          var tx = db.transaction('blobs', 'readwrite');
          tx.objectStore('blobs').delete(id);
          tx.oncomplete = function() { resolve(); };
          tx.onerror = function() { resolve(); };
        });
      });
    }
  };

  var blobs = new Map();
  var blobUrls = new Map();

  function getBlobUrl(id) {
    if (!id) return '';
    if (blobUrls.has(id)) return blobUrls.get(id);
    if (blobs.has(id)) {
      var u = URL.createObjectURL(blobs.get(id));
      blobUrls.set(id, u);
      return u;
    }
    return '';
  }

  async function saveBlob(id, blob) {
    blobs.set(id, blob);
    if (blobUrls.has(id)) {
      URL.revokeObjectURL(blobUrls.get(id));
      blobUrls.delete(id);
    }
    try {
      await IDB.put(id, blob);
    } catch (e) {
      storageFailure(e); throw e;
    }
    return id;
  }

  async function loadBlob(id) {
    if (!id) return null;
    if (blobs.has(id)) return blobs.get(id);
    try {
      var b = await IDB.get(id);
      if (b) {
        blobs.set(id, b);
        return b;
      }
    } catch (e) {}
    return null;
  }

  /* Les médias stockés en IndexedDB ne sont lus qu'à l'approche de l'écran.
     Cela évite de charger toutes les photos d'une longue bibliothèque à chaque rendu. */
  var observedBlobImages = new WeakSet();
  function hydrateBlobImage(el) {
    var id = el && el.getAttribute('data-blob-id');
    if (!id) return;
    var cached = getBlobUrl(id);
    if (cached) {
      if (el.src !== cached) el.src = cached;
      el.removeAttribute('data-blob-id');
      return;
    }
    loadBlob(id).then(function(b) {
      if (b && document.body.contains(el)) {
        el.src = getBlobUrl(id);
        el.removeAttribute('data-blob-id');
      }
    });
  }
  var blobImageObserver = 'IntersectionObserver' in window ? new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (!entry.isIntersecting) return;
      blobImageObserver.unobserve(entry.target);
      hydrateBlobImage(entry.target);
    });
  }, { rootMargin: '360px 0px' }) : null;
  function resolveLazyMedia() {
    document.querySelectorAll('[data-blob-id]').forEach(function(el) {
      if (observedBlobImages.has(el)) return;
      observedBlobImages.add(el);
      if (blobImageObserver && !getBlobUrl(el.getAttribute('data-blob-id'))) {
        blobImageObserver.observe(el);
      } else {
        hydrateBlobImage(el);
      }
    });
  }

  /* ============ Schéma des données Patrons ============ */
  var SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  var KINDS = [['modele', 'Photo du patron'], ['fini', 'Résultat tricoté'], ['croquis', 'Croquis']];
  var MEASURES = [
    ['bust', 'Tour de poitrine fini'], ['waist', 'Tour de taille'], ['hip', 'Tour de hanches'],
    ['length', 'Longueur totale'], ['back_len', 'Longueur jusqu\'à l\'emmanchure'], ['armhole', 'Hauteur d\'emmanchure'],
    ['shoulder', 'Largeur d\'épaules'], ['neck_w', 'Largeur d\'encolure'], ['sleeve', 'Longueur de manche'],
    ['upper_arm', 'Tour de bras'], ['wrist', 'Tour de poignet'], ['hem_h', 'Hauteur des côtes du bas']
  ];
  var COUNTS = [
    ['caston', 'Montage du corps'], ['chest', 'Mailles au tour de poitrine'], ['waist', 'Mailles à la taille'],
    ['hip', 'Mailles aux hanches'], ['sl_caston', 'Montage des manches'], ['sl_max', 'Mailles de manche (max)'],
    ['neck', 'Mailles d\'encolure'], ['shoulder', 'Mailles par épaule'], ['rows_body', 'Rangs du corps'],
    ['rows_sleeve', 'Rangs de manche'], ['yarn_m', 'Métrage nécessaire (m)']
  ];
  var CORE_ROWS = { measures: ['bust', 'length', 'shoulder', 'sleeve'], counts: ['caston', 'chest'] };

  var GROUPDEF = {
    'Manches': { fields: ['sleeves', 'sleeve_shape', 'cuffs'], m: ['sleeve', 'upper_arm', 'wrist'], c: ['sl_caston', 'sl_max', 'rows_sleeve'] },
    'Encolure': { fields: ['neckline', 'neck_finish'], m: ['neck_w'], c: ['neck'] },
    'Bas et longueur': { fields: ['length', 'hem'], m: ['length', 'back_len', 'hem_h'], c: ['caston', 'hip', 'rows_body'] },
    'Fermeture': { fields: ['closure', 'buttons'], m: [], c: [] },
    'Poches': { fields: ['pockets'], m: [], c: [] },
    'Finitions': { fields: ['hem', 'cuffs', 'neck_finish', 'bind_off', 'blocking'], m: [], c: [] },
    'Autre': { fields: [], m: [], c: [] }
  };
  var GROUP_NAMES = Object.keys(GROUPDEF);

  var SCHEMA = [
    {
      id: 'ident', t: 'Identité du patron',
      why: 'Classe le patron et permet de filtrer les données par type de vêtement et de niveau.',
      f: [
        { k: 'designer', l: 'Créateur·rice', t: 'text' },
        { k: 'language', l: 'Langue du patron', t: 'select', o: ['Français', 'Anglais', 'Autre'], core: 1 },
        { k: 'garment', l: 'Type de vêtement', t: 'select', o: ['Pull', 'Cardigan', 'Gilet sans manches', 'Top / débardeur', 'Robe', 'Jupe', 'Pantalon / short', 'Bonnet', 'Écharpe / snood', 'Châle', 'Chaussettes', 'Mitaines / gants', 'Couverture', 'Sac', 'Autre'], core: 1 },
        { k: 'target', l: 'Public', t: 'select', o: ['Femme', 'Homme', 'Enfant', 'Bébé', 'Unisexe'], core: 1 },
        { k: 'difficulty', l: 'Niveau', t: 'select', o: ['Débutant', 'Facile', 'Intermédiaire', 'Avancé'], core: 1 },
        { k: 'season', l: 'Saison', t: 'select', o: ['Été', 'Mi-saison', 'Hiver', 'Toute saison'] }
      ]
    },
    {
      id: 'shape', t: 'Silhouette et coupe',
      why: 'Ce que l\'IA doit reconnaître sur une photo ou un croquis pour choisir la bonne construction.',
      f: [
        { k: 'silhouette', l: 'Silhouette', t: 'select', o: ['Droite', 'Trapèze', 'Ajustée', 'Boxy', 'Oversize', 'Cropped', 'Longue / tunique'], core: 1 },
        { k: 'ease_cm', l: 'Aisance au buste', t: 'number', u: 'cm', h: 'Positif = ample, négatif = ajusté', core: 1 },
        { k: 'length', l: 'Longueur du vêtement', t: 'select', o: ['Cropped (au-dessus de la taille)', 'Taille', 'Hanches', 'Mi-cuisse', 'Genou ou plus'], core: 1 },
        { k: 'neckline', l: 'Encolure', t: 'select', o: ['Rond', 'V', 'Bateau', 'Carré', 'Col roulé', 'Col montant', 'Col châle', 'Capuche', 'Ouvert (sans col)'], core: 1 },
        { k: 'sleeves', l: 'Manches', t: 'select', o: ['Longues', '3/4', 'Courtes', 'Sans manches', 'Bretelles'], core: 1 },
        { k: 'sleeve_shape', l: 'Forme des manches', t: 'select', o: ['Droite', 'Ajustée', 'Évasée', 'Ballon', 'Chauve-souris', 'Raglan effilé'] },
        { k: 'shoulder', l: 'Type d\'épaule', t: 'select', o: ['Tombante (drop)', 'Montée (set-in)', 'Raglan', 'Empiècement rond (yoke)', 'Saddle'], core: 1 },
        { k: 'construction', l: 'Construction', t: 'select', o: ['De haut en bas, sans couture', 'De bas en haut, sans couture', 'À plat, pièces cousues', 'Une seule pièce', 'De côté en côté'], core: 1 },
        { k: 'shaping_notes', l: 'Notes de forme', t: 'long', h: 'Taille cintrée, dos plus long, fentes latérales…' }
      ]
    },
    {
      id: 'sizes', t: 'Tailles et mesures',
      why: 'La base du patron multi-tailles. Les tableaux relient chaque taille à des mesures finies et à des nombres de mailles.',
      f: [
        { k: 'sizes', l: 'Tailles proposées', t: 'multi', o: SIZES, core: 1 },
        { k: 'size_system', l: 'Système de tailles du patron', t: 'select', o: ['Tailles vêtement (XS à 3XL)', 'Tour de poitrine (cm)', 'Âge enfant'] },
        { k: 'model_size', l: 'Taille portée sur la photo', t: 'text', core: 1 },
        { k: 'model_info', l: 'Mensurations du modèle', t: 'text', h: 'Taille, tour de poitrine…' },
        { k: 'size_map', l: 'Noms des tailles dans le patron', t: 'text', h: 'Ex. : XS = 34, S = 36, M = 38' },
        { k: '@measures' },
        { k: '@counts' }
      ]
    },
    {
      id: 'gauge', t: 'Échantillon',
      why: 'Permet de recalculer les mailles pour n\'importe quel échantillon (multi-gauge).',
      f: [
        { k: 'gauge_sts', l: 'Mailles pour 10 cm', t: 'number', core: 1 },
        { k: 'gauge_rows', l: 'Rangs pour 10 cm', t: 'number', core: 1 },
        { k: 'gauge_stitch', l: 'Point de l\'échantillon', t: 'select', o: ['Jersey', 'Côtes 1/1', 'Côtes 2/2', 'Point mousse', 'Point de riz', 'Point fantaisie', 'Torsades', 'Jacquard'], core: 1 },
        { k: 'needle_mm', l: 'Aiguilles', t: 'number', u: 'mm', core: 1 },
        { k: 'needle_type', l: 'Type d\'aiguilles', t: 'select', o: ['Circulaire', 'Droites', 'Double pointes', 'Mixte'] },
        { k: 'gauge_blocked', l: 'Mesuré', t: 'select', o: ['Après blocage', 'Avant blocage'], core: 1 },
        { k: 'gauge_range', l: 'Autres échantillons proposés', t: 'text', h: 'Ex. : 18 m. = tailles XS–S' }
      ]
    },
    {
      id: 'yarn', t: 'Fil',
      why: 'Associe un échantillon et un rendu (tombé, volume) à un type de fil.',
      f: [
        { k: 'yarn_name', l: 'Fil utilisé', t: 'text', core: 1 },
        { k: 'yarn_weight', l: 'Grosseur du fil', t: 'select', o: ['Dentelle', 'Fingering / 4 plis', 'Sport', 'DK', 'Worsted', 'Aran', 'Bulky', 'Super bulky'], core: 1 },
        { k: 'yarn_fiber', l: 'Composition', t: 'text', core: 1 },
        { k: 'yarn_meters', l: 'Mètres pour 100 g', t: 'number' },
        { k: 'yarn_colors', l: 'Nombre de couleurs', t: 'number' },
        { k: 'yarn_sub', l: 'Substituts conseillés', t: 'long' }
      ]
    },
    {
      id: 'stitches', t: 'Points et techniques',
      why: 'Liste ce que l\'IA devra savoir écrire : points, répétitions, augmentations, diminutions, montage.',
      f: [
        { k: 'stitches', l: 'Points utilisés', t: 'multi', o: ['Jersey', 'Côtes', 'Point mousse', 'Point de riz', 'Torsades', 'Ajouré', 'Jacquard', 'Intarsia', 'Mailles glissées', 'Bobbles', 'Rayures', 'Boutonnières'], core: 1 },
        { k: 'repeat', l: 'Multiple de mailles', t: 'text', h: 'Ex. : multiple de 4 + 2' },
        { k: 'cast_on', l: 'Montage', t: 'select', o: ['Classique', 'Italien', 'Provisoire', 'Tubulaire', 'Au crochet', 'Autre'] },
        { k: 'increases', l: 'Augmentations', t: 'text', h: 'Ex. : M1L / M1R, jetés' },
        { k: 'decreases', l: 'Diminutions', t: 'text', h: 'Ex. : 2 m. ens., surjet simple' },
        { k: 'short_rows', l: 'Rangs raccourcis', t: 'select', o: ['Non', 'Oui, rangs raccourcis', 'Oui, allemands (DS)', 'Oui, wrap & turn'] },
        { k: 'charts', l: 'Présentation des motifs', t: 'select', o: ['Texte seulement', 'Diagrammes seulement', 'Texte et diagrammes'], core: 1 }
      ]
    },
    {
      id: 'finish', t: 'Finitions',
      why: 'Les finitions changent le rendu final : elles doivent être décrites séparément pour pouvoir être choisies.',
      f: [
        { k: 'hem', l: 'Bas du vêtement', t: 'text', core: 1 },
        { k: 'cuffs', l: 'Poignets', t: 'text' },
        { k: 'neck_finish', l: 'Finition de l\'encolure', t: 'text', core: 1 },
        { k: 'closure', l: 'Fermeture', t: 'text', h: 'Boutons, zip, aucune…' },
        { k: 'buttons', l: 'Nombre de boutons', t: 'number' },
        { k: 'pockets', l: 'Poches', t: 'select', o: ['Aucune', 'Plaquées', 'Invisibles', 'Fentes'] },
        { k: 'bind_off', l: 'Rabat', t: 'select', o: ['Classique', 'Élastique', 'Tubulaire', 'Autre'] },
        { k: 'assembly', l: 'Ordre d\'assemblage', t: 'long' },
        { k: 'blocking', l: 'Blocage', t: 'text' }
      ]
    },
    {
      id: 'writing', t: 'Rédaction du patron',
      why: 'Définit le style d\'écriture que l\'IA devra reproduire pour que le patron reste fluide à lire.',
      f: [
        { k: 'notation', l: 'Notation', t: 'select', o: ['Abréviations françaises', 'Abréviations anglaises', 'Mots complets'] },
        { k: 'structure', l: 'Écriture des tailles', t: 'select', o: ['Une section par taille', 'Toutes les tailles entre parenthèses', 'Tableau par taille'], core: 1 },
        { k: 'parts', l: 'Parties du patron', t: 'text', h: 'Dos, devant, manches, finitions…', core: 1 },
        { k: 'abbrev', l: 'Glossaire du patron', t: 'long' },
        { k: 'errata', l: 'Erreurs connues', t: 'long' }
      ]
    },
    {
      id: 'result', t: 'Résultat tricoté',
      why: 'Compare le patron à la réalité. C\'est ce qui apprend à l\'IA si un patron donne bien l\'objet de la photo.',
      f: [
        { k: 'r_size', l: 'Taille tricotée', t: 'text' },
        { k: 'r_sts', l: 'Mailles obtenues pour 10 cm', t: 'number' },
        { k: 'r_rows', l: 'Rangs obtenus pour 10 cm', t: 'number' },
        { k: 'r_bust', l: 'Tour de poitrine mesuré', t: 'number', u: 'cm' },
        { k: 'r_length', l: 'Longueur mesurée', t: 'number', u: 'cm' },
        { k: 'r_fit', l: 'Écart au patron', t: 'select', o: ['Conforme', 'Plus petit', 'Plus grand', 'Plus court', 'Plus long'] },
        { k: 'r_rating', l: 'Conformité à la photo (1 à 5)', t: 'select', o: ['1', '2', '3', '4', '5'], core: 1 },
        { k: 'r_hours', l: 'Heures de tricot', t: 'number' },
        { k: 'r_yarn', l: 'Fil réellement utilisé', t: 'text' },
        { k: 'r_mods', l: 'Modifications faites', t: 'long' },
        { k: 'r_issues', l: 'Problèmes rencontrés', t: 'long' }
      ]
    }
  ];

  var ALLF = [];
  SCHEMA.forEach(function(s) {
    s.f.forEach(function(f) {
      if (f.k[0] !== '@') ALLF.push(f);
    });
  });
  var PHOTO_KEYS = ['garment', 'target', 'silhouette', 'length', 'neckline', 'sleeves', 'sleeve_shape', 'shoulder', 'construction', 'stitches', 'hem', 'cuffs', 'neck_finish', 'closure', 'pockets', 'yarn_weight', 'shaping_notes'];

  /* ============ Persistance localStorage ============ */
  function load(k, d) {
    try {
      var v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch (e) {
      return d;
    }
  }
  function keep(k, v) {
    if(k !== 'carnet.patterns' && k !== 'carnet.ts') IDB.put('meta_kv_'+k,JSON.stringify(v)).catch(storageFailure);
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  }

  var savedOpts = load('carnet.opts', {});
  var defaultAiConfig = {
    keys: {
      gemini: savedOpts.apiKey || '',
      groq: '',
      openrouter: '',
      openai: '',
      omniroute: ''
    },
    urls: { omniroute: '' },
    omniVision: true,
    models: {
      gemini: 'gemini-2.5-flash',
      groq: 'llama-3.3-70b-versatile',
      openrouter: 'google/gemini-2.0-flash-exp:free',
      openai: 'gpt-4o-mini',
      omniroute: 'auto'
    },
    prefText: 'gemini',
    prefVision: 'gemini',
    autoFailover: true
  };

  var DREAM_PALETTES = [
    ['Ciel', { main: '#315b91', desk: '#8fb5d8', paper: '#f7f0e7', pop: '#d99eae' }],
    ['Cyberpop 98', { main: '#24102f', desk: '#d889f4', paper: '#fff0fb', pop: '#00ddc2' }],
    ['Retro Dream', { main: '#55486f', desk: '#b9a8ff', paper: '#fff4e8', pop: '#f4a7d0' }],
    ['Pixel Dream', { main: '#6842a6', desk: '#bba4ff', paper: '#fbf1ff', pop: '#f08bdc' }],
    ['Bliss 95', { main: '#1556b8', desk: '#80bdf4', paper: '#f8f3e5', pop: '#65d8f2' }],
    ['Nuit', { main: '#2a3a6e', desk: '#1d2540', paper: '#e9e6f2', pop: '#e58fb0' }]
  ];
  var defaultUi = {
    dream: Object.assign({}, DREAM_PALETTES[0][1]),
    theme: load('carnet.theme', 'dreamos'),
    accent: '#315B91',
    bgColor: '',
    surfaceColor: '',
    font: 'jakarta',
    wallpaperId: '',
    overlayOpacity: 0.72
  };

  var S = {
    ui: Object.assign({}, defaultUi, load('carnet.ui', {})),
    pwHash: (function() { var h = load('carnet.pwHash', ''); return (typeof h === 'string' && /^(pbkdf2\$\d+\$[A-Za-z0-9+\/=]+\$[A-Za-z0-9+\/=]+|[0-9a-f]{64}|fallback_-?\d+)$/.test(h)) ? h : ''; })(),
    unlocked: false,
    group: (function(g) { return (g === 'garment' || g === 'author' || g === 'folder' || g === 'all') ? g : 'garment'; })(load('carnet.group', 'garment')),
    favAuthors: load('carnet.favAuthors', []),
    docQ: '',
    docSearch: false,
    ig: { url: '', title: '', busy: false, err: '', blob: null, objUrl: '', src: '', picker: null, direct: '', saved: false },
    igCfg: Object.assign({ endpoint: '', key: '' }, load('carnet.igApi', {})),
    collapsedGroups: load('carnet.collapsed', {}),
    fStatus: 'all',
    fStage: 'all',
    newAuth: null,
    stor: null,
    bkHide: false,
    fDiff: 'all',
    folders: load('carnet.folders', []),
    renameId: null,
    delF: null,
    tab: 'lib',
    toolSub: '',
    grids: load('carnet.grids', []),
    gridName: '',
    curGrid: null,
    gridDel: null,
    projects: load('carnet.projects', []),
    pjStage: load('carnet.pjStage', 'wip'),
    curProj: null,
    pjDraft: '',
    pjDel: false,
    pjDelEntry: null,
    rg: { sts: 20, rows: 28, width: 48, height: 38, garment: '', photoUrl: '', res: null },
    chart: Object.assign({ mode: 'color', w: 15, h: 15, tool: 0, palette: ['#ffffff', '#b45309', '#1c1917', '#d97706'], cells: { color: [], lace: [], cables: [] } }, load('carnet.chart', {})),
    cur: null,
    sub: 'fiche',
    editMode: false,
    activeSize: '',
    tv: 'clean',
    q: '',
    patterns: load('carnet.patterns', []),
    /* Nouveaux modules : Documentation (Blog), Idées (Pinterest + Bloc-note), Outils (Rangs Raccourcis + Convertisseur d'échantillon) */
    docs: load('carnet.docs', []),
    docEditorOpen: false,
    docDraft: { title: '', category: 'Technique', content: '', media: [] },
    ideas: load('carnet.ideas', []),
    boards: load('carnet.boards', []),
    ideaBoard: 'all',
    ideaTag: 'all',
    pinOpen: null,
    pinSel: null,
    bulkBoard: '',
    bulkTag: '',
    fq: '',
    inspoTarget: null,
    scratchpad: load('carnet.scratchpad', ''),
    ideaDraft: { title: '', note: '', tag: 'Inspiration', mediaId: '', mediaType: '' },
    sr: {
      totalSts: 60,
      centreSts: 20,
      turns: 4,
      method: 'gSR',
      dir: 'topdown'
    },
    r3: Object.assign({ sts: '', rows: '', per: '10', cm: '', nSts: '', nRows: '' }, load('carnet.r3', {})),
    gaugeCalc: {
      patSts: 20,
      patRows: 28,
      mySts: 18,
      myRows: 26,
      mode: 'sts',
      val: 100
    },
    open: { ident: 1 },
    log: [],
    busy: '',
    opts: Object.assign({ expand: false, headers: true, min: 20, max: 30, auto: true, autoFile: '' }, savedOpts),
    ai: Object.assign({}, defaultAiConfig, load('carnet.ai', {})),
    aiTestStatus: {},
    exp: { valid: false, photos: true },
    sim: { sts: '', rows: '' },
    delAsk: false
  };
  S.ai.keys = Object.assign({}, defaultAiConfig.keys, S.ai.keys || {});
  S.ai.models = Object.assign({}, defaultAiConfig.models, S.ai.models || {});
  S.ai.urls = Object.assign({}, defaultAiConfig.urls, S.ai.urls || {});

  if (!S.pwHash) S.unlocked = true;

  function saveAiCfg() { keep('carnet.ai', S.ai); }
  var uiT = null;
  function saveUiCfg() { keep('carnet.ui', S.ui); applyAppearance(); }
  function saveUiSoon() { applyAppearance(); clearTimeout(uiT); uiT = setTimeout(function() { keep('carnet.ui', S.ui); }, 300); }
  function saveDocs() { keep('carnet.docs', S.docs); }
  function saveIdeas() { keep('carnet.ideas', S.ideas); }
  function saveBoards() { keep('carnet.boards', S.boards); }
  function saveCollapsed() { keep('carnet.collapsed', S.collapsedGroups); }
  /* OmniRoute : configuré dès qu'une adresse est saisie (la clé est facultative) */
  function provReady(id) {
    if (id === 'omniroute') return !!((S.ai.urls && S.ai.urls.omniroute) || '').trim();
    return !!(S.ai.keys[id] || '').trim();
  }
  function provVision(id) {
    if (id === 'omniroute') return S.ai.omniVision !== false;
    return !!AI_PROVIDERS[id].vision;
  }
  function omniEndpoint() {
    var u = ((S.ai.urls && S.ai.urls.omniroute) || '').trim().replace(/\/+$/, '');
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = (/^(localhost|127\.|192\.168\.|10\.)/i.test(u) ? 'http://' : 'https://') + u;
    if (/\/chat\/completions$/i.test(u)) return u;
    if (!/\/v1$/i.test(u)) u += '/v1';
    return u + '/chat/completions';
  }
  function hasAnyAiKey() { return PROVIDER_IDS.some(provReady); }

  var thumbTried = {}, thumbQ = false;
  var V = { id: null, pdf: null, zoom: 1, pages: [], running: false, again: false };
  var pdfs = new Map(), procCache = new Map(), saveTimers = {};

  /* ============ Application dynamique du Thème, Couleurs, Police & Fond d'écran ============ */
  function hexToRgba(hex, alpha) {
    var c = String(hex || '').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length !== 6) return 'rgba(255,255,255,' + alpha + ')';
    var r = parseInt(c.slice(0, 2), 16);
    var g = parseInt(c.slice(2, 4), 16);
    var b = parseInt(c.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function lumOf(hex) {
    var c = String(hex || '').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length !== 6) return 1;
    var v = [0, 2, 4].map(function(i) { var x = parseInt(c.substr(i, 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function mixHex(a, b, t) {
    function p(h) { var c = String(h).replace('#', ''); if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]; return [0, 2, 4].map(function(i) { return parseInt(c.substr(i, 2), 16) || 0; }); }
    var x = p(a), y = p(b);
    return '#' + x.map(function(v, i) { return ('0' + Math.round(v * (1 - t) + y[i] * t).toString(16)).slice(-2); }).join('');
  }
  function applyFont(root, u) {
    if (u.theme === 'dreamos') { root.style.removeProperty('--font-body'); root.style.removeProperty('--font-head'); return; }
    var fObj = FONTS[u.font] || FONTS.jakarta;
    root.style.setProperty('--font-body', fObj.body);
    root.style.setProperty('--font-head', fObj.head);
  }
  function applyAppearance() {
    var root = document.documentElement;
    var u = S.ui;
    var isDark = u.theme === 'dark' || (u.theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    var dreamOn = u.theme === 'dreamos';
    if (dreamOn) root.setAttribute('data-theme', 'dreamos');
    else if (isDark) root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');

    /* dreamOS : palette personnalisable (mise à jour instantanée via variables CSS) */
    var DV = ['--dm', '--dm-ink', '--dd', '--dp', '--dpop', '--ink', '--muted', '--ink-in'];
    if (dreamOn) {
      var dz = Object.assign({}, DREAM_PALETTES[0][1], u.dream || {});
      /* Reconnaître les anciennes palettes enregistrées et les convertir vers leur nouvelle identité. */
      var oldDreamPresets = [
        [{ main: '#527b70', desk: '#c0d6c9', paper: '#f5f2e8', pop: '#d9a7b2' }, DREAM_PALETTES[2][1]],
        [{ main: '#9f5578', desk: '#e8b9ca', paper: '#fbf2ed', pop: '#8da9c3' }, DREAM_PALETTES[1][1]],
        [{ main: '#665d86', desk: '#c9c3dc', paper: '#f7f3f5', pop: '#d7aebc' }, DREAM_PALETTES[3][1]],
        [{ main: '#a96d57', desk: '#e8c6ae', paper: '#fbf3e9', pop: '#879eae' }, DREAM_PALETTES[4][1]]
      ];
      oldDreamPresets.forEach(function(pair) {
        var wasOld = Object.keys(pair[0]).every(function(k) { return dz[k] === pair[0][k]; });
        if (wasOld) dz = Object.assign({}, pair[1]);
      });
      S.ui.dream = Object.assign({}, dz);
      var dreamPaletteId = 'custom';
      DREAM_PALETTES.forEach(function(pl, i) {
        if (Object.keys(pl[1]).every(function(k) { return dz[k] === pl[1][k]; })) dreamPaletteId = ['ciel','cyberpop98','retrodream','pixeldream','bliss95','nuit'][i];
      });
      root.setAttribute('data-dream-palette', dreamPaletteId);
      root.style.setProperty('--dm', dz.main);
      root.style.setProperty('--dd', dz.desk);
      root.style.setProperty('--dp', dz.paper);
      root.style.setProperty('--dpop', dz.pop);
      root.style.setProperty('--dm-ink', lumOf(dz.main) > 0.55 ? '#1b1b22' : '#ffffff');
      var darkPaper = lumOf(dz.paper) < 0.4;
      root.style.setProperty('--ink', darkPaper ? '#f3eee8' : '#24242a');
      root.style.setProperty('--muted', darkPaper ? '#c9c2bb' : '#68636a');
      root.style.setProperty('--ink-in', lumOf(mixHex(dz.paper, '#ffffff', 0.35)) < 0.4 ? '#f3eee8' : '#24242a');
      ['--accent', '--accent-soft', '--bg', '--surface', '--surface-alpha', '--bg-overlay'].forEach(function(p) { root.style.removeProperty(p); });
    } else {
      DV.forEach(function(p) { root.style.removeProperty(p); });
    }

    if (!dreamOn) applyFont(root, u);

    if (dreamOn) { applyFont(root, u); return; }
    /* Couleur principale (Accent) */
    var acc = u.accent || (isDark ? '#8FA3FF' : '#2A47C9');
    root.style.setProperty('--accent', acc);
    root.style.setProperty('--accent-soft', hexToRgba(acc, isDark ? 0.22 : 0.12));

    /* Couleur de fond & cartes personnalisées */
    if (u.bgColor) {
      root.style.setProperty('--bg', u.bgColor);
    } else {
      root.style.removeProperty('--bg');
    }

    if (u.surfaceColor) {
      root.style.setProperty('--surface', u.surfaceColor);
      root.style.setProperty('--surface-alpha', hexToRgba(u.surfaceColor, 0.92));
    } else {
      root.style.removeProperty('--surface');
      root.style.removeProperty('--surface-alpha');
    }

    /* Fond d'écran personnalisé */
    var baseBg = u.bgColor || (isDark ? '#11151D' : '#F3F4F7');
    var op = typeof u.overlayOpacity === 'number' ? u.overlayOpacity : 0.72;
    root.style.setProperty('--bg-overlay', hexToRgba(baseBg, op));

    if (u.wallpaperId) {
      var wpUrl = getBlobUrl(u.wallpaperId);
      if (wpUrl) {
        root.style.setProperty('--bg-image', 'url("' + wpUrl + '")');
        document.body.classList.remove('no-wallpaper');
      } else {
        loadBlob(u.wallpaperId).then(function(b) {
          if (b) {
            var loadedUrl = getBlobUrl(u.wallpaperId);
            root.style.setProperty('--bg-image', 'url("' + loadedUrl + '")');
            document.body.classList.remove('no-wallpaper');
          }
        });
      }
    } else {
      root.style.setProperty('--bg-image', 'none');
      document.body.classList.add('no-wallpaper');
    }
  }
  applyAppearance();

  /* ============ Verrou de l'application (PBKDF2 + sel) ============
     C'est un verrou d'affichage : il masque l'application, il ne chiffre pas les données. */
  var PW_ITER = 600000, PW_MIN = 4, PW_FAIL_KEY = 'carnet.pwFail';
  function pwSupported() { return !!(window.crypto && crypto.subtle && crypto.getRandomValues); }
  function b64e(buf) { var a = new Uint8Array(buf), s = ''; for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function b64d(str) { var b = atob(str), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function sameBytes(x, y) { if (x.length !== y.length) return false; var r = 0; for (var i = 0; i < x.length; i++) r |= x[i] ^ y[i]; return r === 0; }
  async function pbkdf2(pw, salt, iter) {
    var key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iter }, key, 256));
  }
  async function hashPw(pw) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var d = await pbkdf2(pw, salt, PW_ITER);
    return 'pbkdf2$' + PW_ITER + '$' + b64e(salt) + '$' + b64e(d);
  }
  /* Anciens formats (SHA-256 simple, hash de secours) : lus une dernière fois pour migrer */
  async function legacySha256(str) {
    var hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(hashBuf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  function legacyFallback(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return 'fallback_' + h;
  }
  async function checkPw(pw, stored) {
    if (typeof stored !== 'string' || !stored) return false;
    try {
      if (stored.indexOf('pbkdf2$') === 0) {
        var p = stored.split('$');
        if (p.length !== 4) return false;
        var iter = parseInt(p[1], 10);
        if (!(iter >= 1000 && iter <= 5000000)) return false;
        return sameBytes(await pbkdf2(pw, b64d(p[2]), iter), b64d(p[3]));
      }
      if (/^[0-9a-f]{64}$/.test(stored)) return pwSupported() && (await legacySha256(pw)) === stored;
      if (stored.indexOf('fallback_') === 0) return legacyFallback(pw) === stored;
    } catch (e) {}
    return false;
  }
  function pwFailGet() {
    try { var o = JSON.parse(localStorage.getItem(PW_FAIL_KEY) || '{}'); return { n: o.n | 0, until: +o.until || 0 }; }
    catch (e) { return { n: 0, until: 0 }; }
  }
  function pwFailSet(o) {
    try { if (o) localStorage.setItem(PW_FAIL_KEY, JSON.stringify(o)); else localStorage.removeItem(PW_FAIL_KEY); } catch (e) {}
  }

  function syncLockScreen() {
    var ls = $('#lockScreen');
    if (!ls) return;
    if (S.pwHash && !S.unlocked) {
      ls.hidden = false;
      document.body.style.overflow = 'hidden';
      setTimeout(function() {
        var inp = $('#unlockInput');
        if (inp) inp.focus();
      }, 50);
    } else {
      ls.hidden = true;
      document.body.style.overflow = '';
    }
  }

  var unlockBusy = false;
  async function tryUnlock() {
    if (unlockBusy) return;
    var inp = $('#unlockInput');
    var err = $('#unlockErr');
    var val = inp ? inp.value.trim() : '';
    if (!val) return;
    function showErr(msg) { if (err) { err.textContent = msg; err.style.display = 'block'; } }
    var st = pwFailGet(), wait = Math.ceil((st.until - Date.now()) / 1000);
    if (wait > 0) { showErr('Trop d\'essais. Réessayez dans ' + wait + ' s.'); return; }
    var stored = S.pwHash || '';
    if (stored.indexOf('pbkdf2$') === 0 && !pwSupported()) {
      showErr('Ce navigateur ne peut pas vérifier le mot de passe (une connexion HTTPS est nécessaire).');
      return;
    }
    unlockBusy = true;
    try {
      if (await checkPw(val, stored)) {
        pwFailSet(null);
        if (stored.indexOf('pbkdf2$') !== 0 && pwSupported()) {
          try { S.pwHash = await hashPw(val); keep('carnet.pwHash', S.pwHash); } catch (e) {}
        }
        S.unlocked = true;
        if (inp) inp.value = '';
        if (err) err.style.display = 'none';
        syncLockScreen();
        render();
      } else {
        var n = st.n + 1, delay = n >= 3 ? Math.min(300, 2 * Math.pow(2, n - 3)) : 0;
        pwFailSet({ n: n, until: delay ? Date.now() + delay * 1000 : 0 });
        showErr(delay ? 'Mot de passe incorrect. Réessayez dans ' + delay + ' s.' : 'Mot de passe incorrect.');
      }
    } finally { unlockBusy = false; }
  }

  $('#unlockBtn').addEventListener('click', tryUnlock);
  $('#unlockInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') tryUnlock();
  });

  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function cur() { return S.patterns.find(function(p) { return p.id === S.cur; }); }

  var tt;
  function toastAct(m, label, act, id) {
    var t = $('#toast');
    t.innerHTML = esc(m) + ' <button type="button" data-act="' + act + '" data-id="' + esc(id || '') + '">' + esc(label) + '</button>';
    t.style.display = 'block';
    clearTimeout(tt);
    tt = setTimeout(function() { t.style.display = 'none'; }, 7000);
  }
  function toast(m) {
    var t = $('#toast');
    t.textContent = m;
    t.style.display = 'block';
    clearTimeout(tt);
    tt = setTimeout(function() { t.style.display = 'none'; }, 3800);
  }

  var ICON = {
    t_ig: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',
    t_calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8 11h2M14 11h2M8 15h2M14 15h2M8 18h2M14 18h2"/>',
    t_sr: '<path d="M3 6h7"/><path d="M3 12h13"/><path d="M3 18h7"/><path d="M13 7l5 5-5 5"/>',
    t_r3: '<path d="M4 7h9M4 12h6M4 17h9"/><path d="M16 6l4 4-4 4"/><path d="M20 18h-5"/>',
    t_gauge: '<rect x="3" y="8" width="18" height="8" rx="1"/><path d="M7 8v4M11 8v3M15 8v4M19 8v3"/>',
    t_rag: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    t_chart: '<rect x="3" y="3" width="18" height="18"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    pj: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 2h6v4H9z"/><path d="M9 14l2 2 4-4"/>',
    lib: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
    add: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="16" y2="18"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    idea: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>',
    ai: '<path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>',
    exp: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    fav: '<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'
  };
  /* dreamOS: bibliothèque d'icônes pixel-art intégrée (aucun fichier externe requis). */
  var DREAM_ICONS = {"photo":"assets/icons/photo.png","cloud":"assets/icons/cloud.png","chart":"assets/icons/chart.png","settings":"assets/icons/settings.png","camera":"assets/icons/camera.png","yarn":"assets/icons/yarn.png","search":"assets/icons/search.png","palette":"assets/icons/palette.png","folder":"assets/icons/folder.png","pdf":"assets/icons/pdf.png","recycle":"assets/icons/recycle.png","calculator":"assets/icons/calculator.png","sweater":"assets/icons/sweater.png","computer":"assets/icons/computer.png","bookmark":"assets/icons/bookmark.png","notebook":"assets/icons/notebook.png"};
  /* Icônes pixel-art DreamOS dédiées aux catégories de patrons et aux dossiers. */
  Object.assign(DREAM_ICONS, {
    'cat_pull': 'assets/icons/cat_pull.png',
    'cat_cardigan': 'assets/icons/cat_cardigan.png',
    'cat_vest': 'assets/icons/cat_vest.png',
    'cat_top': 'assets/icons/cat_top.png',
    'cat_dress': 'assets/icons/cat_dress.png',
    'cat_skirt': 'assets/icons/cat_skirt.png',
    'cat_beanie': 'assets/icons/cat_beanie.png',
    'cat_scarf': 'assets/icons/cat_scarf.png',
    'cat_shawl': 'assets/icons/cat_shawl.png',
    'cat_socks': 'assets/icons/cat_socks.png',
    'cat_mittens': 'assets/icons/cat_mittens.png',
    'cat_blanket': 'assets/icons/cat_blanket.png',
    'cat_bag': 'assets/icons/cat_bag.png',
    'cat_pants': 'assets/icons/cat_pants.png',
    'cat_other': 'assets/icons/cat_other.png',
    'folder_pixel': 'assets/icons/folder_pixel.png'
  });
  var dreamDecoded = false;
  function dreamDecode() {
    if (dreamDecoded) return;
    dreamDecoded = true;
    Object.keys(DREAM_ICONS).forEach(function(k) {
      try {
        var m = /^data:([^;]+);base64,(.*)$/.exec(DREAM_ICONS[k]); if (!m) return;
        var bin = atob(m[2]), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        DREAM_ICONS[k] = URL.createObjectURL(new Blob([arr], { type: m[1] }));
      } catch (e) {}
    });
  }
  DREAM_ICONS.star_pixel = "data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2013%2013%22%20shape-rendering=%22crispEdges%22%3E%3Crect%20x=%226%22%20y=%220%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%225%22%20y=%221%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%226%22%20y=%221%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%227%22%20y=%221%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%225%22%20y=%222%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%226%22%20y=%222%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%227%22%20y=%222%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%224%22%20y=%223%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%225%22%20y=%223%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%226%22%20y=%223%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%227%22%20y=%223%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%228%22%20y=%223%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%220%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%221%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%222%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%223%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%224%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%225%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%226%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%227%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%228%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%229%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%2210%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%2211%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%2212%22%20y=%224%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%221%22%20y=%225%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%222%22%20y=%225%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%223%22%20y=%225%22%20width=%221%22%20height=%221%22%20fill=%22%23fff6c4%22/%3E%3Crect%20x=%224%22%20y=%225%22%20width=%221%22%20height=%221%22%20fill=%22%23fff6c4%22/%3E%3Crect%20x=%225%22%20y=%225%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%226%22%20y=%225%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%227%22%20y=%225%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%228%22%20y=%225%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%229%22%20y=%225%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%2210%22%20y=%225%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%2211%22%20y=%225%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%222%22%20y=%226%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%223%22%20y=%226%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%224%22%20y=%226%22%20width=%221%22%20height=%221%22%20fill=%22%23fff6c4%22/%3E%3Crect%20x=%225%22%20y=%226%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%226%22%20y=%226%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%227%22%20y=%226%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%228%22%20y=%226%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%229%22%20y=%226%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%2210%22%20y=%226%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%223%22%20y=%227%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%224%22%20y=%227%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%225%22%20y=%227%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%226%22%20y=%227%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%227%22%20y=%227%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%228%22%20y=%227%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%229%22%20y=%227%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%223%22%20y=%228%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%224%22%20y=%228%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%225%22%20y=%228%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%226%22%20y=%228%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%227%22%20y=%228%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%228%22%20y=%228%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%229%22%20y=%228%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%222%22%20y=%229%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%223%22%20y=%229%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%224%22%20y=%229%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%225%22%20y=%229%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%226%22%20y=%229%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%227%22%20y=%229%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%228%22%20y=%229%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%229%22%20y=%229%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%2210%22%20y=%229%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%222%22%20y=%2210%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%223%22%20y=%2210%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%224%22%20y=%2210%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%225%22%20y=%2210%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%227%22%20y=%2210%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%228%22%20y=%2210%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%229%22%20y=%2210%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%2210%22%20y=%2210%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%221%22%20y=%2211%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%222%22%20y=%2211%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%223%22%20y=%2211%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%229%22%20y=%2211%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%2210%22%20y=%2211%22%20width=%221%22%20height=%221%22%20fill=%22%23ffd35c%22/%3E%3Crect%20x=%2211%22%20y=%2211%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%221%22%20y=%2212%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%222%22%20y=%2212%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%2210%22%20y=%2212%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3Crect%20x=%2211%22%20y=%2212%22%20width=%221%22%20height=%221%22%20fill=%22%2355486f%22/%3E%3C/svg%3E";
  var DREAM_ICON_ALIAS = {
    t_ig: 'camera', t_calc: 'calculator', t_r3: 'calculator', fav: 'star_pixel',
    lib: 'notebook', pj: 'sweater', calc: 'calculator', doc: 'pdf',
    idea: 'bookmark', settings: 'settings', add: 'folder', find: 'search',
    t_rag: 'yarn', t_chart: 'chart', ai: 'computer', exp: 'cloud',
    photo: 'photo', camera: 'camera', palette: 'palette', recycle: 'recycle',
    cat_pull: 'cat_pull', cat_cardigan: 'cat_cardigan', cat_vest: 'cat_vest', cat_top: 'cat_top',
    cat_dress: 'cat_dress', cat_skirt: 'cat_skirt', cat_beanie: 'cat_beanie', cat_scarf: 'cat_scarf',
    cat_shawl: 'cat_shawl', cat_socks: 'cat_socks', cat_mittens: 'cat_mittens', cat_blanket: 'cat_blanket',
    cat_bag: 'cat_bag', cat_pants: 'cat_pants', cat_other: 'cat_other', folder_pixel: 'folder_pixel'
  };
  function ico(n) {
    if (document.documentElement.getAttribute('data-theme') === 'dreamos' && DREAM_ICON_ALIAS[n]) {
      dreamDecode();
      var asset = DREAM_ICONS[DREAM_ICON_ALIAS[n]];
      if (asset) return '<img class="i dream-pixel-icon" src="' + asset + '" alt="" aria-hidden="true">';
    }
    return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ICON[n] + '</svg>';
  }

  /* ============ Persistance ============ */
  function lite(p) {
    var q = JSON.parse(JSON.stringify(p));
    delete q._v;
    return q;
  }
  var patJson = {}, allDirty = true, mirrorT = null, mirrorStr = null;
  function patStr(p) {
    if (!patJson[p.id]) patJson[p.id] = JSON.stringify(p, function(k, v) { return k === '_v' ? undefined : v; });
    return patJson[p.id];
  }
  function saveSoon(p) {
    delete patJson[p.id];
    clearTimeout(saveTimers[p.id]);
    saveTimers[p.id] = setTimeout(function() { persist(true); }, 500);
  }
  var persistTimer = null;
  function persist(light) {
    if (!light) patJson = {};
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistNow, 250);
  }
  function mirrorFlush() {
    if (mirrorT) { clearTimeout(mirrorT); mirrorT = null; }
    if (mirrorStr) { var m = mirrorStr; mirrorStr = null; IDB.put('meta_patterns', m).catch(function() {}); }
  }
  function persistFlush() {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; persistNow(); }
    mirrorFlush();
  }
  window.addEventListener('pagehide', persistFlush);
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'hidden') persistFlush(); });
  var durableQueue = Promise.resolve(), storageAlertAt = 0;
  function storageFailure(e) {
    console.error(e);
    if(Date.now()-storageAlertAt<8000) return;
    storageAlertAt=Date.now();
    toast('Échec de sauvegarde : gardez cette page ouverte et exportez un ZIP. ' + (e.message || 'Stockage indisponible'));
    if(!document.getElementById('storageFailure')) {
      var el=document.createElement('div'); el.id='storageFailure'; el.className='note bad';
      el.innerHTML='<span>Certaines modifications ne sont pas sauvegardées.</span><button class="btn small" data-act="fullBackup">Exporter un ZIP</button>'; document.body.appendChild(el);
    }
  }
  function persistNow() {
    persistTimer=null;
    var json=JSON.stringify(S.patterns.map(lite)), ts=Date.now();
    durableQueue=durableQueue.catch(function() {}).then(async function() {
      try { await IDB.put('meta_patterns',JSON.stringify({ts:ts,list:JSON.parse(json)})); }
      catch(e) { storageFailure(e); throw e; }
      try { localStorage.setItem('carnet.patterns',json); localStorage.setItem('carnet.ts',JSON.stringify(ts)); }
      catch(e) { console.warn('Cache local plein, copie IndexedDB conservée',e); }
    });
    durableQueue.catch(function() {}); return durableQueue;
  }
  async function safetySnapshot() {
    await persistNow();
    var snap={at:Date.now(),patterns:S.patterns.map(lite),projects:S.projects,folders:S.folders,docs:S.docs,ideas:S.ideas,boards:S.boards,grids:S.grids,scratchpad:S.scratchpad};
    await IDB.put('meta_snapshot_'+snap.at,JSON.stringify(snap));
    var keys=(await IDB.keys()).filter(function(k) { return String(k).startsWith('meta_snapshot_'); }).sort();
    for(var i=0;i<keys.length-8;i++) await IDB.del(keys[i]);
  }
  async function recoverLocalPatterns() {
    if(S.importRunning) { toast('Attendez la fin de l’import.'); return; }
    if(!await askConfirm('Rechercher les patrons perdus ?', 'Cette recherche peut aussi rétablir des patrons supprimés volontairement. Aucun patron actuel ne sera remplacé.', 'Rechercher')) return;
    S.busy='Recherche des patrons encore présents sur cet appareil…'; render(); var n=0;
    try {
      var keys=await IDB.keys(), snapshots=keys.filter(function(k) { return String(k).startsWith('meta_snapshot_'); }).sort().reverse();
      for(var k of snapshots) {
        var snap=JSON.parse(await IDB.get(k));
        (snap.patterns || []).forEach(function(p) { if(!S.patterns.some(function(x) {return x.id===p.id;})) { S.patterns.push(p); n++; } });
      }
      for(var k of keys.filter(function(k) {return String(k).startsWith('pdf_');})) {
        if(S.patterns.some(function(p) {return p.source && p.source.pdf===k;})) continue;
        var bl=await IDB.get(k); if(!bl || !bl.arrayBuffer) continue;
        S.patterns.push(newPattern(bl.name ? bl.name.replace(/\.pdf$/i,'') : 'Patron récupéré '+(n+1),'',{pdf:k,file:bl.name || 'PDF récupéré'})); n++;
      }
      await safetySnapshot(); toast(n+' patron(s) récupéré(s).');
    } catch(e) { storageFailure(e); }
    S.busy='';render();
  }
  /* ===== Fenêtres intégrées (remplacent prompt / confirm du navigateur) ===== */
  var DLG = null;
  function dlgOpen(o) {
    if (DLG) dlgClose(null);
    return new Promise(function(resolve) {
      DLG = { o: o, resolve: resolve, back: document.activeElement };
      var el = $('#dlg');
      el.innerHTML = '<div class="box" role="' + (o.input ? 'dialog' : 'alertdialog') + '" aria-modal="true" aria-labelledby="dlgT"' + (o.text ? ' aria-describedby="dlgD"' : '') + '>' +
        '<h2 id="dlgT">' + esc(o.title) + '</h2>' +
        (o.text ? '<p class="sub" id="dlgD" style="font-size:14px">' + esc(o.text) + '</p>' : '') +
        (o.input ? '<input class="in" id="dlgIn" type="text" maxlength="80" autocomplete="off" value="' + esc(o.value || '') + '" placeholder="' + esc(o.placeholder || '') + '" aria-label="' + esc(o.title) + '"><div class="note bad" id="dlgErr" role="alert" hidden></div>' : '') +
        '<div class="row"><button type="button" class="btn grow" data-act="dlgNo" id="dlgNo">Annuler</button><button type="button" class="btn grow ' + (o.danger ? 'danger' : 'primary') + '" data-act="dlgYes" id="dlgYes">' + esc(o.ok || 'OK') + '</button></div></div>';
      el.hidden = false;
      var inp = $('#dlgIn');
      if (inp) { inp.focus(); inp.select(); } else { var fb = $(o.danger ? '#dlgNo' : '#dlgYes'); if (fb) fb.focus(); }
    });
  }
  function dlgClose(val) {
    var d = DLG; if (!d) return;
    DLG = null;
    var el = $('#dlg'); el.hidden = true; el.innerHTML = '';
    try { if (d.back && d.back.focus && document.contains(d.back)) d.back.focus(); } catch (e) {}
    d.resolve(val);
  }
  function dlgSubmit() {
    if (!DLG) return;
    if (!DLG.o.input) { dlgClose(true); return; }
    var v = ($('#dlgIn').value || '').trim(), err = '';
    if (!v) err = 'Entrez un nom.';
    else if (DLG.o.check) err = DLG.o.check(v) || '';
    if (err) { var eb = $('#dlgErr'); eb.textContent = err; eb.hidden = false; $('#dlgIn').focus(); return; }
    dlgClose(v);
  }
  function askName(title, value, ok, check) { return dlgOpen({ title: title, input: true, value: value, ok: ok, placeholder: 'Nom du tableau', check: check }); }
  function askConfirm(title, text, ok) { return dlgOpen({ title: title, text: text, ok: ok, danger: true }); }
  $('#dlg').addEventListener('click', function(e) { if (e.target === this) dlgClose(null); });
  document.addEventListener('keydown', function(e) {
    if (!DLG) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); dlgClose(null); }
    else if (e.key === 'Enter' && e.target && e.target.id === 'dlgIn') { e.preventDefault(); e.stopPropagation(); dlgSubmit(); }
    else if (e.key === 'Tab') {
      var f = Array.prototype.slice.call($('#dlg').querySelectorAll('input,button')).filter(function(x) { return !x.disabled && !x.hidden; });
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i < 0 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
    }
  }, true);
  function boardNameCheck(exceptId) {
    return function(v) { return S.boards.some(function(b) { return b.id !== exceptId && String(b.name).trim().toLowerCase() === v.toLowerCase(); }) ? 'Un tableau porte déjà ce nom.' : ''; };
  }

  /* ===== Suppressions annulables ===== */
  var pend = null, pendT = null;
  function finalizePend() {
    if (!pend) return;
    clearTimeout(pendT); var p = pend; pend = null;
    try { p.fin(); } catch (e) {}
  }
  function deferDelete(msg, undo, fin) {
    finalizePend();
    pend = { undo: undo, fin: fin };
    toastAct(msg, 'Annuler', 'undoDel', '');
    pendT = setTimeout(finalizePend, 7500);
  }
  function undoPend() {
    if (!pend) return;
    clearTimeout(pendT); var p = pend; pend = null;
    p.undo(); render(); toast('Rétabli.');
  }
  function removeGridSoft(id) {
    var gi = S.grids.findIndex(function(g) { return g.id === id; });
    if (gi < 0) return;
    var g = S.grids[gi], wasCur = S.curGrid === id;
    S.grids.splice(gi, 1);
    if (wasCur) S.curGrid = null;
    saveGrids();
    deferDelete('Grille « ' + g.name + ' » supprimée.', function() {
      S.grids.splice(Math.min(gi, S.grids.length), 0, g);
      if (wasCur && !S.curGrid) S.curGrid = g.id;
      saveGrids();
    }, function() {});
    render();
  }
  function removeFolderSoft(id) {
    var fi = S.folders.findIndex(function(f) { return f.id === id; });
    if (fi < 0) return;
    var df = S.folders[fi], moved = S.patterns.filter(function(x) { return x.folder === df.id; });
    moved.forEach(function(x) { delete x.folder; });
    S.folders.splice(fi, 1);
    S.delF = null; S.renameId = null;
    saveFolders(); persist();
    deferDelete('Dossier « ' + df.name + ' » supprimé' + (moved.length ? ' (' + moved.length + ' patron' + (moved.length > 1 ? 's' : '') + ' sorti' + (moved.length > 1 ? 's' : '') + ' du dossier)' : '') + '.', function() {
      S.folders.splice(Math.min(fi, S.folders.length), 0, df);
      moved.forEach(function(x) { x.folder = df.id; });
      saveFolders(); persist();
    }, function() {});
    render();
  }
  function removePSoft(p) {
    var pi = S.patterns.indexOf(p), links = S.projects.filter(function(x) { return x.patternId === p.id; });
    S.patterns.splice(pi, 1);
    links.forEach(function(x) { x.patternId = ''; });
    delete patJson[p.id];
    saveProjects(); persist();
    deferDelete('Patron supprimé.', function() {
      S.patterns.splice(Math.min(pi, S.patterns.length), 0, p);
      links.forEach(function(x) { x.patternId = p.id; });
      saveProjects(); persist();
    }, function() {
      if (p.source && p.source.pdf) IDB.del(p.source.pdf);
      if (p.thumb) IDB.del(p.thumb);
      (p.photos || []).forEach(function(ph) { if (ph.id) IDB.del(ph.id); });
    });
  }
  function removeP(p) {
    if (p.source && p.source.pdf) IDB.del(p.source.pdf);
    if (p.thumb) IDB.del(p.thumb);
    (p.photos || []).forEach(function(ph) { if (ph.id) IDB.del(ph.id); });
    S.patterns = S.patterns.filter(function(x) { return x.id !== p.id; });
    S.projects.forEach(function(pr) { if (pr.patternId === p.id) pr.patternId = ''; });
    saveProjects();
    persist();
  }
  function saveFolders() { keep('carnet.folders', S.folders); IDB.put('meta_folders', JSON.stringify(S.folders)).catch(function() {}); }

  /* ============ Traitement du texte & Chunks ============ */
  var ABBR = [
    [/\bk2tog\b/gi, '2 mailles ensemble à l\'endroit (k2tog)'],
    [/\bp2tog\b/gi, '2 mailles ensemble à l\'envers (p2tog)'],
    [/\bssk\b/gi, 'surjet simple (ssk)'],
    [/\byo\b/gi, 'jeté (yo)'],
    [/\bm1l\b/gi, 'augmentation inclinée à gauche (m1l)'],
    [/\bm1r\b/gi, 'augmentation inclinée à droite (m1r)'],
    [/\bsts\b/gi, 'mailles'],
    [/\brnds?\b/gi, 'tour'],
    [/\brep\b/gi, 'répéter'],
    [/\bfoll\b/gi, 'suivant'],
    [/\bbeg\b/gi, 'début'],
    [/\bcont\b/gi, 'continuer'],
    [/\binc\b/gi, 'augmenter'],
    [/\bdec\b/gi, 'diminuer'],
    [/\balt\b/gi, 'alterner'],
    [/\bapprox\b/gi, 'environ'],
    [/\bpatt\b/gi, 'motif'],
    [/\brs\b/g, 'endroit de l\'ouvrage'],
    [/\bws\b/g, 'envers de l\'ouvrage'],
    [/\bend\.(?=\s|$)/gi, 'endroit'],
    [/\benv\.(?=\s|$)/gi, 'envers'],
    [/\bjers\.(?=\s|$)/gi, 'jersey'],
    [/\baug\.(?=\s|$)/gi, 'augmentation'],
    [/\bdim\.(?=\s|$)/gi, 'diminution'],
    [/\brgs?\b\.?/gi, 'rang']
  ];

  function cleanText(raw, o) {
    var pages = String(raw || '').split('\f').map(function(s) {
      return s.split('\n').map(function(l) { return l.trim(); });
    });
    if (o.headers && pages.length >= 3) {
      var cnt = new Map(), key = function(l) { return l.replace(/\d+/g, '#').toLowerCase(); };
      pages.forEach(function(pg) {
        var ed = new Set(pg.slice(0, 2).concat(pg.slice(-2)).filter(Boolean).map(key));
        ed.forEach(function(k) { cnt.set(k, (cnt.get(k) || 0) + 1); });
      });
      var th = Math.max(2, Math.ceil(pages.length * 0.5));
      pages = pages.map(function(pg) {
        return pg.filter(function(l, i) {
          if (!l) return true;
          var edge = i < 2 || i >= pg.length - 2;
          return !(edge && cnt.get(key(l)) >= th && l.length < 90);
        });
      });
    }
    var t = pages.map(function(pg) { return pg.join('\n'); }).join('\n');
    t = t.normalize('NFC').replace(/[\u00AD]/g, '').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/\u00A0/g, ' ')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[•▪●◦]\s*/g, '- ')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
    t = t.replace(/^\s*(?:page\s*)?\d{1,3}\s*(?:\/|sur|of)?\s*\d{0,3}\s*$/gim, '');
    t = t.replace(/([a-zà-ÿ])-\n([a-zà-ÿ])/g, '$1$2');
    t = t.replace(/([^\n.:;!?)\]])\n(?=[a-zàâçéèêëîïôûùüÿœ(])/g, '$1 ');
    t = t.replace(/(\d),(\d+)(\s*(?:mm|cm|m|g|kg|%))/g, '$1.$2$3')
      .replace(/(\d)\s*(?:millim[eè]tres?|mm)\b/gi, '$1 mm')
      .replace(/(\d)\s*(?:centim[eè]tres?|cm)\b/gi, '$1 cm');
    if (o.expand) ABBR.forEach(function(a) { t = t.replace(a[0], a[1]); });
    t = t.split('\n').map(function(l) { return l.replace(/[ \t]+/g, ' ').trim(); }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return t;
  }

  var HEAD = /^(taille|tailles|dos|devant|manches?|encolure|finitions?|montage|empi[eè]cement|assemblage|body|back|front|sleeves?|neck|neckline|yoke|finishing|assembly|mat[eé]riel|fournitures|[eé]chantillon|gauge|abr[eé]viations|materials)\b.{0,32}$/i;
  function isHeading(l) {
    return l.length < 46 && !/[.;]$/.test(l) && (HEAD.test(l) || (/^[A-ZÉÈÀÂÊÎÔÛÇ0-9 '\/&:-]{4,}$/.test(l) && /[A-ZÉÈÀ]{3}/.test(l)));
  }

  function chunkText(clean, o) {
    var min = Math.max(5, +o.min || 20), max = Math.max(min + 2, +o.max || 30), out = [], section = '', buf = [];
    function flush() {
      if (buf.length) {
        out.push({ section: section, text: buf.join(' '), words: buf.length });
        buf = [];
      }
    }
    function units(s) {
      var w = s.split(/\s+/).filter(Boolean);
      if (w.length <= max) return [w];
      var parts = s.replace(/([,;:])\s+/g, '$1\u0001').split('\u0001'), res = [];
      parts.forEach(function(p) {
        var pw = p.split(/\s+/).filter(Boolean);
        for (var i = 0; i < pw.length; i += max) res.push(pw.slice(i, i + max));
      });
      return res;
    }
    clean.split('\n').forEach(function(line) {
      line = line.trim();
      if (!line) { flush(); return; }
      if (isHeading(line)) { flush(); section = line.replace(/:$/, ''); return; }
      if (/^(rang|tour|row|rnd|rd)\b/i.test(line) && buf.length >= min / 2) flush();
      line.replace(/([.!?])\s+(?=[A-ZÉÈÀ0-9*(\[])/g, '$1\u0001').split('\u0001').forEach(function(sent) {
        units(sent).forEach(function(w) {
          if (buf.length + w.length > max) flush();
          buf = buf.concat(w);
          if (buf.length >= min) flush();
        });
      });
    });
    flush();
    return out.map(function(c, i) { c.i = i + 1; return c; });
  }

  function proc(p) {
    var k = p.id + '|' + (p.raw || '').length + '|' + (p._v || 0) + '|' + JSON.stringify(S.opts);
    var c = procCache.get(k);
    if (!c) {
      var clean = cleanText(p.raw || '', S.opts);
      c = { clean: clean, chunks: chunkText(clean, S.opts) };
      procCache.set(k, c);
    }
    return c;
  }

  /* ============ PDF & Images ============ */
  async function pdfToPages(file) {
    var buf = await file.arrayBuffer();
    var pdf = await pdfOpen(new Uint8Array(buf.slice(0))), pages = [];
    for (var n = 1; n <= pdf.numPages; n++) {
      var page = await pdf.getPage(n), tc = await page.getTextContent(), rows = [];
      tc.items.forEach(function(it) {
        if (!it.str) return;
        var y = Math.round(it.transform[5]), x = it.transform[4], row = rows.find(function(r) { return Math.abs(r.y - y) <= 2; });
        if (!row) { row = { y: y, items: [] }; rows.push(row); }
        row.items.push({ x: x, s: it.str, w: it.width });
      });
      rows.sort(function(a, b) { return b.y - a.y; });
      pages.push(rows.map(function(r) {
        r.items.sort(function(a, b) { return a.x - b.x; });
        var s = '', px = null;
        r.items.forEach(function(it) {
          if (px !== null && it.x - px > 1.5 && !/^\s/.test(it.s) && !/\s$/.test(s)) s += ' ';
          s += it.s;
          px = it.x + it.w;
        });
        return s.replace(/\s+/g, ' ').trim();
      }).filter(Boolean));
    }
    return { pages: pages, pdf: pdf };
  }

  async function shrink(file, max) {
    var bmp;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      bmp = await new Promise(function(res, rej) {
        var im = new Image();
        im.onload = function() { res(im); };
        im.onerror = rej;
        im.src = URL.createObjectURL(file);
      });
    }
    var w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, r = Math.min(1, max / Math.max(w, h));
    var c = document.createElement('canvas');
    c.width = Math.round(w * r);
    c.height = Math.round(h * r);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(function(res) { c.toBlob(function(b) { res(b); }, 'image/jpeg', 0.86); });
  }

  async function addPhotos(p, files, kind) {
    S.busy = 'Enregistrement des photos…';
    render();
    var n = 0;
    for (var i = 0; i < files.length; i++) {
      try {
        var b = await shrink(files[i], 1600);
        var id = 'img_' + uid();
        await saveBlob(id, b);
        p.photos = (p.photos || []).concat([{ id: id, kind: kind }]);
        n++;
      } catch (e) {
        toast('Photo ignorée');
      }
    }
    S.busy = '';
    persist();
    render();
    if (n) toast(n + ' photo(s) ajoutée(s).');
  }

  function blobToBase64(blob) {
    return new Promise(function(resolve, reject) {
      var fr = new FileReader();
      fr.onload = function() {
        var res = String(fr.result || '');
        var idx = res.indexOf(',');
        resolve(idx >= 0 ? res.slice(idx + 1) : res);
      };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  /* ============ Moteur Multi-IA ============ */
  function extractJsonBlock(text) {
    var clean = String(text || '').trim();
    clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    var first = clean.indexOf('{');
    var last = clean.lastIndexOf('}');
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1);
    return JSON.parse(clean);
  }

  async function callSingleProvider(provId, prompt, options) {
    var prov = AI_PROVIDERS[provId];
    var apiKey = (S.ai.keys[provId] || '').trim();
    if (!provReady(provId)) {
      var noKeyErr = new Error((provId === 'omniroute' ? 'Adresse du serveur non configurée pour ' : 'Clé API non configurée pour ') + prov.name);
      noKeyErr.code = 'no_key';
      throw noKeyErr;
    }
    var model = (S.ai.models[provId] || prov.model).trim();
    var hasImages = !!(options.images && options.images.length);
    if (hasImages && !provVision(provId)) {
      var noVisErr = new Error(prov.name + ' ne supporte pas la lecture d\'images.');
      noVisErr.code = 'no_vision';
      throw noVisErr;
    }

    if (provId === 'gemini') {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
      var parts = [{ text: prompt }];
      if (hasImages) {
        for (var i = 0; i < options.images.length; i++) {
          var b = options.images[i];
          var b64 = await blobToBase64(b);
          parts.push({ inlineData: { mimeType: b.type || 'image/jpeg', data: b64 } });
        }
      }
      var payload = { contents: [{ role: 'user', parts: parts }] };
      if (options.json) payload.generationConfig = { responseMimeType: 'application/json' };

      var resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload),
        signal: options.signal
      });
      var data = await resp.json().catch(function() { return null; });
      if (!resp.ok) {
        var e1 = new Error((data && data.error && data.error.message) || ('Erreur HTTP ' + resp.status));
        e1.status = resp.status;
        throw e1;
      }
      var txt = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
      if (!txt) throw new Error('Réponse vide de Gemini');
      return options.json ? extractJsonBlock(txt) : txt;
    }

    var endpoint = provId === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' :
      provId === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
      provId === 'omniroute' ? omniEndpoint() :
      'https://api.openai.com/v1/chat/completions';

    var headers = { 'Content-Type': 'application/json' };
    if (apiKey || provId !== 'omniroute') headers['Authorization'] = 'Bearer ' + apiKey;
    if (provId === 'openrouter') {
      headers['HTTP-Referer'] = window.location.href || 'https://carnet-patrons.local';
      headers['X-Title'] = 'knittingOS';
    }

    var userContent;
    if (hasImages) {
      userContent = [{ type: 'text', text: prompt }];
      for (var j = 0; j < options.images.length; j++) {
        var imgBlob = options.images[j];
        var imgB64 = await blobToBase64(imgBlob);
        userContent.push({ type: 'image_url', image_url: { url: 'data:' + (imgBlob.type || 'image/jpeg') + ';base64,' + imgB64 } });
      }
    } else {
      userContent = prompt;
    }

    var bodyObj = { model: model, messages: [{ role: 'user', content: userContent }], temperature: 0.1 };
    if (options.json && provId !== 'openrouter' && provId !== 'omniroute') bodyObj.response_format = { type: 'json_object' };

    var r2;
    try {
      r2 = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(bodyObj),
        signal: options.signal
      });
    } catch (netErr) {
      if (netErr && netErr.name === 'AbortError') throw netErr;
      if (provId === 'omniroute') {
        var ne = new Error('OmniRoute injoignable. Vérifiez l\'adresse : elle doit être accessible depuis cet appareil (en https si l\'appli est ouverte en ligne).');
        ne.code = 'network';
        throw ne;
      }
      throw netErr;
    }
    var d2 = await r2.json().catch(function() { return null; });
    if (!r2.ok) {
      var e2 = new Error((d2 && d2.error && d2.error.message) || ('Erreur HTTP ' + r2.status));
      e2.status = r2.status;
      throw e2;
    }
    var reply = d2 && d2.choices && d2.choices[0] && d2.choices[0].message && d2.choices[0].message.content;
    if (!reply) throw new Error('Réponse vide de ' + prov.name);
    return options.json ? extractJsonBlock(reply) : reply;
  }

  async function callAI(prompt, options) {
    options = options || {};
    var isVision = !!(options.images && options.images.length);
    var preferred = isVision ? S.ai.prefVision : S.ai.prefText;

    var queue = [];
    if (preferred && AI_PROVIDERS[preferred] && provReady(preferred) && (!isVision || provVision(preferred))) {
      queue.push(preferred);
    }
    if (S.ai.autoFailover || !queue.length) {
      PROVIDER_IDS.forEach(function(id) {
        if (queue.indexOf(id) < 0 && provReady(id) && (!isVision || provVision(id))) {
          queue.push(id);
        }
      });
    }

    if (!queue.length) {
      var err = new Error(isVision ?
        'Aucune IA vision configurée. Ajoutez une clé Gemini ou OpenRouter, ou une adresse OmniRoute, dans Réglages > IA.' :
        'Aucune IA configurée. Ajoutez une clé API ou une adresse OmniRoute dans Réglages > IA.');
      err.code = 'missing_config';
      throw err;
    }

    var lastErr = null;
    for (var i = 0; i < queue.length; i++) {
      var provId = queue[i];
      if (options.signal && options.signal.aborted) {
        var ae = new Error('Annulé');
        ae.code = 'cancelled';
        throw ae;
      }
      try {
        var result = await callSingleProvider(provId, prompt, options);
        if (i > 0) toast('Bascule automatique vers ' + AI_PROVIDERS[provId].name + '.');
        return { data: result, provider: AI_PROVIDERS[provId].name, providerId: provId };
      } catch (e) {
        if (e && (e.name === 'AbortError' || e.code === 'cancelled')) { e.code = 'cancelled'; throw e; }
        lastErr = e;
        if (i + 1 < queue.length) {
          S.busy = AI_PROVIDERS[provId].name + ' indisponible → bascule vers ' + AI_PROVIDERS[queue[i + 1]].name + '…';
          render();
        }
      }
    }
    throw lastErr || new Error('Toutes les IA configurées ont échoué.');
  }

  function aiMsg(e) {
    if (!e) return 'L\'analyse a échoué.';
    if (e.code === 'cancelled') return 'Analyse annulée.';
    if (e.code === 'missing_config') return e.message;
    if (e.status === 429) return 'Quota gratuit atteint sur vos clés configurées.';
    if (e.status === 401 || e.status === 403) return 'Clé API invalide ou refusée.';
    return 'Erreur IA : ' + (e.message || 'réessayez');
  }

  async function testProviderKey(provId) {
    S.aiTestStatus[provId] = { state: 'testing', msg: 'Test en cours…' };
    render();
    try {
      await callSingleProvider(provId, 'Réponds uniquement par le mot OK.', { json: false });
      S.aiTestStatus[provId] = { state: 'ok', msg: 'Clé valide et fonctionnelle !' };
    } catch (e) {
      S.aiTestStatus[provId] = { state: 'bad', msg: (e && e.message) || 'Échec du test' };
    }
    render();
  }

  /* ============ Heuristiques & Contrôles ============ */
  function guessAuthor(t) {
    t = String(t || '').slice(0, 8000);
    var cues = /(editor and designer|designed by|design by|designer|pattern by|created by|conçu par|créé par|modèle de|créatrice|créateur)\s*:?\s*/ig, m;
    while ((m = cues.exec(t))) {
      var rest = t.slice(m.index + m[0].length, m.index + m[0].length + 70);
      var n = rest.match(/^([A-ZÀ-Ý][\p{L}'’.-]+(?:[ \t]+[A-ZÀ-Ý][\p{L}'’.-]+){0,3})/u);
      if (n) return n[1].trim().replace(/[.,;:]+$/, '');
    }
    var c = t.match(/©\s*(?:\d{4}\s*)?([A-ZÀ-Ý][\p{L}'’.-]+(?:[ \t]+[A-ZÀ-Ý][\p{L}'’.-]+){0,2})/u);
    return c ? c[1].trim() : '';
  }

  var GARMENT_RE = [
    [/cardigan|gilet\b/i, 'Cardigan'], [/sweater|pullover|jumper|\bpull\b/i, 'Pull'],
    [/\b(?:hat|beanie|bonnet)\b/i, 'Bonnet'], [/scarf|snood|[eé]charpe|cowl/i, 'Écharpe / snood'],
    [/shawl|ch[aâ]le/i, 'Châle'], [/\bsocks?\b|chaussettes/i, 'Chaussettes'],
    [/mittens?|gloves?|mitaines|gants/i, 'Mitaines / gants'], [/blanket|couverture|plaid/i, 'Couverture'],
    [/\bdress\b|\brobe\b/i, 'Robe'], [/\bskirt\b|\bjupe\b/i, 'Jupe'],
    [/\b(?:trousers?|pants?|shorts?)\b|\bpantalon(?:s)?\b|\bshort\b/i, 'Pantalon / short'],
    [/\b(?:tank|top|d[eé]bardeur)\b/i, 'Top / débardeur'], [/\bvest\b/i, 'Gilet sans manches'],
    [/\bbag\b|\bsac\b/i, 'Sac']
  ];
  function guessGarment(t) {
    t = String(t || '').slice(0, 4000);
    for (var i = 0; i < GARMENT_RE.length; i++) if (GARMENT_RE[i][0].test(t)) return GARMENT_RE[i][1];
    return '';
  }

  /* ============ Projets ============ */
  var PJ_STAGES = [['attente', 'En attente'], ['wip', 'WIP'], ['termine', 'Terminés']];
  var PJ_ONE = { attente: 'En attente', wip: 'WIP', termine: 'Terminé' };
  var pjTimer = null;
  function saveProjects() {
    // Sauvegarder une fiche ne constitue pas une reprise du tricot :
    // seules les actions de travail (chronomètre / rangs) réinitialisent l'inactivité.
    keep('carnet.projects', S.projects);
    IDB.put('meta_projects', JSON.stringify(S.projects)).catch(function() {});
  }
  function saveProjectsQuiet() {
    keep('carnet.projects', S.projects);
    IDB.put('meta_projects', JSON.stringify(S.projects)).catch(function() {});
  }
  function saveSoonPj() { clearTimeout(pjTimer); pjTimer = setTimeout(function() { pjTimer = null; saveProjects(); }, 500); }
  window.addEventListener('pagehide', function() { if (pjTimer) { clearTimeout(pjTimer); pjTimer = null; saveProjects(); } });
  function curPj() { return S.projects.find(function(x) { return x.id === S.curProj; }); }
  function pjStageOf(pr) { return pr.stage === 'wip' || pr.stage === 'termine' ? pr.stage : 'attente'; }
  function patternOf(pr) { return pr.patternId ? S.patterns.find(function(p) { return p.id === pr.patternId; }) : null; }
  function projectsOf(pid) { return S.projects.filter(function(x) { return x.patternId === pid; }); }
  function nextPjSeq() { return S.projects.reduce(function(m, x) { return Math.max(m, x.seq || 0); }, 0) + 1; }
  function isAutoPjName(n) { return !n || n === 'Nouveau projet' || /^Projet \d+$/.test(n); }
  function newProject(o) {
    var seq = nextPjSeq();
    var pr = { id: 'j' + uid(), seq: seq, name: o.name || 'Projet ' + seq, stage: o.stage || 'attente', patternId: o.patternId || '', cover: '', size: '', yarns: [], needles: '', rows: 0, log: [], timer: { acc: 0, start: 0 }, created: Date.now(), stageAt: {} };
    pr.stageAt[pr.stage] = Date.now();
    if(pr.stage==='wip') pr.workAt=Date.now();
    S.projects.unshift(pr);
    saveProjects();
    return pr;
  }
  function lastActivity(pr) { return (pr.log && pr.log[0] && pr.log[0].ts) || pr.stageAt[pr.stage] || pr.created; }
  function pjCoverId(pr) {
    if (pr.cover) return pr.cover;
    if (pr.photos && pr.photos.length) return pr.photos[0];
    for (var i = 0; i < (pr.log || []).length; i++) if (pr.log[i].photos && pr.log[i].photos.length) return pr.log[i].photos[0];
    var p = patternOf(pr);
    return p && p.thumb ? p.thumb : '';
  }
  function blobImg(id, alt) {
    var url = getBlobUrl(id);
    if (url) return '<img alt="' + esc(alt) + '" loading="lazy" decoding="async" src="' + esc(url) + '">';
    return '<img alt="' + esc(alt) + '" loading="lazy" decoding="async" data-blob-id="' + esc(id) + '" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">';
  }
  function pjHasPdf(pr) { var p = patternOf(pr); return !!(p && ((p.source && p.source.pdf) || pdfs.has(p.id))); }
  function setPjStage(pr, st, quiet) {
    var from = pjStageOf(pr);
    if (from === st) return;
    pr.stagePrev = from;
    if (st === 'termine' && pr.timer && pr.timer.start) { pr.timer.acc += Date.now() - pr.timer.start; pr.timer.start = 0; }
    pr.stage = st;
    pr.stageAt[st] = Date.now();
    if (st === 'termine') { delete pr.islandSince; delete pr.islandPin; delete pr.leftIsland; }
    else if (st === 'wip' && from !== 'wip') { pr.workAt = Date.now(); }
    saveProjects();
    render();
    if (quiet) return;
    toastAct(st === 'wip' ? 'Projet en cours.' : st === 'termine' ? 'Projet terminé, bravo !' : 'Remis en attente.', 'Annuler', 'undoPj', pr.id);
  }
  function pjStageAction(pr) {
    var st = pjStageOf(pr), id = esc(pr.id);
    if (st === 'attente') return '<button class="btn small primary" data-act="pjStep" data-v="wip" data-id="' + id + '">Commencer</button>';
    if (st === 'wip') return '<button class="btn small primary" data-act="pjStep" data-v="termine" data-id="' + id + '">Marquer terminé</button>';
    return '';
  }
  function pjCardHtml(pr) {
    var cid = pjCoverId(pr), p = patternOf(pr), n = (pr.log || []).length, st = pjStageOf(pr);
    var cover = cid ? blobImg(cid, pr.name) : '<span class="ph">Ajouter une photo</span>';
    var info = [];
    if (p) info.push(esc(p.title));
    if (st === 'wip' && statOn('days')) info.push('commencé il y a ' + daysSince(pjStartTs(pr)) + ' j');
    if (st === 'termine' && ratingAvg(pr)) info.push('★ ' + ratingAvg(pr));
    if (st === 'termine' && pr.stageAt.termine && statOn('days')) info.push('terminé le ' + new Date(pr.stageAt.termine).toLocaleDateString('fr-BE'));
    if (n) info.push(n + ' entrée' + (n > 1 ? 's' : ''));
    var tot = tmTotal(pr);
    if (tot >= 60000 && statOn('time')) info.push('⏱ Tricoté : <span class="num" data-tmtot="' + esc(pr.id) + '">' + tmShort(tot) + '</span>');
    if (isIsland(pr)) info.push('Sur l’île depuis ' + Math.max(islandCfg().months, Math.floor((Date.now() - pjLastTouch(pr)) / 86400000 / 30.44)) + ' mois');
    var skn = pjSkeins(pr);
    if (skn && statOn('skeins')) info.push('🧶 ' + pjSkeinsTxt(pr));
    return '<div class="pcard"><button class="cover" data-act="openPj" data-id="' + esc(pr.id) + '" aria-label="Ouvrir le projet">' + cover + '</button><div class="pinfo">' +
      '<div class="stack" style="gap:4px"><button type="button" class="ptitle" data-act="openPj" data-id="' + esc(pr.id) + '">' + esc(pr.name || 'Sans nom') + '</button>' +
      (info.length ? '<span class="sub">' + info.join(' · ') + '</span>' : '') + (isIsland(pr) ? islandMiniTags(pr) : '') + '</div>' +
      '<div class="stack" style="gap:6px;margin-top:6px">' + pjStageAction(pr) +
      (pjHasPdf(pr) ? '<button class="btn small" data-act="viewPdf" data-id="' + esc(pr.patternId) + '" data-pj="' + esc(pr.id) + '">Voir le PDF</button>' : '') +
      '</div></div></div>';
  }
  /* ===== v32 : journal daté, fils multiples, statistiques configurables ===== */
  var PJ_STATS = [
    ['days', 'Jours depuis le début (ou date de fin)'],
    ['time', 'Temps tricoté au total'],
    ['rows', 'Rangs comptés'],
    ['skeins', 'Pelotes utilisées (bouton 🧶 à côté de chaque fil)']
  ];
  function statOn(k) { var st = S.ui && S.ui.stats; return !st || st[k] !== false; }
  function fmtEntryDate(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' }) + ' à ' + d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  }
  function pjYarns(pr) {
    if (!Array.isArray(pr.yarns)) {
      pr.yarns = [];
      if (pr.yarn && String(pr.yarn).trim()) pr.yarns.push({ id: 'y' + uid(), name: String(pr.yarn).trim(), used: 0 });
      delete pr.yarn;
    }
    return pr.yarns;
  }
  function pjSkeins(pr) { return pjYarns(pr).reduce(function(t, y) { return t + (y.used || 0); }, 0); }
  function pjYarnNames(pr) { return pjYarns(pr).map(function(y) { return [y.name, y.brand, y.color].join(' '); }).join(' '); }
  function migratePjV32() {
    var ch = false;
    var chrono = S.projects.slice().sort(function(a, b) { return (a.created || 0) - (b.created || 0); }), n = 0;
    chrono.forEach(function(pr) {
      n++;
      if (!pr.seq) { pr.seq = n; ch = true; }
      if (!pr.name || pr.name === 'Nouveau projet') { pr.name = 'Projet ' + pr.seq; ch = true; }
    });
    S.projects.forEach(function(pr) {
      if (!Array.isArray(pr.log)) { pr.log = []; ch = true; }
      if (pr.notes && String(pr.notes).trim()) {
        pr.log.push({ id: 'e' + uid(), ts: pr.created || Date.now(), text: String(pr.notes).trim(), photos: [] });
        pr.log.sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });
        ch = true;
      }
      if ('notes' in pr) { delete pr.notes; ch = true; }
      if (!Array.isArray(pr.yarns)) { pjYarns(pr); ch = true; }
    });
    if (ch) saveProjects();
  }
  var SIZES_STD = [
    ['Adulte', ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL']],
    ['Enfant / bébé', ['Naissance', '1 mois', '3 mois', '6 mois', '12 mois', '18 mois', '2 ans', '3 ans', '4 ans', '6 ans', '8 ans', '10 ans', '12 ans', '14 ans']],
    ['Autre', ['Taille unique', 'Sur mesure']]
  ];
  function sizeSelectHtml(pr, p) {
    var cur = pr.size || '', fromPat = (p && p.f && p.f.sizes && p.f.sizes.length) ? p.f.sizes : null;
    function opt(z) { return '<option value="' + esc(z) + '"' + (cur === z ? ' selected' : '') + '>' + esc(z) + '</option>'; }
    var o = '<option value="">— Choisir —</option>';
    if (fromPat) {
      if (cur && fromPat.indexOf(cur) < 0) o += opt(cur);
      o += fromPat.map(opt).join('');
    } else {
      var known = false;
      SIZES_STD.forEach(function(g) { if (g[1].indexOf(cur) >= 0) known = true; });
      if (cur && !known) o += opt(cur);
      o += SIZES_STD.map(function(g) { return '<optgroup label="' + esc(g[0]) + '">' + g[1].map(opt).join('') + '</optgroup>'; }).join('');
    }
    return '<label class="fl"><span class="n">Taille tricotée</span><select class="in" data-pj="size">' + o + '</select></label>';
  }
  function pjStatsHtml(pr, st) {
    var out = [], id = esc(pr.id);
    if (statOn('days')) out.push('<div><b class="num">' + (st === 'wip' ? daysSince(pjStartTs(pr)) + ' j' : st === 'termine' && pr.stageAt.termine ? new Date(pr.stageAt.termine).toLocaleDateString('fr-BE') : '—') + '</b><span>' + (st === 'wip' ? 'depuis le début' : st === 'termine' ? 'terminé le' : 'pas commencé') + '</span></div>');
    if (statOn('time')) out.push('<div><b class="num" data-tmtot="' + id + '">' + tmShort(tmTotal(pr)) + '</b><span>tricoté au total</span></div>');
    if (statOn('rows')) out.push('<div><b class="num">' + (pr.rows || 0) + '</b><span>rangs comptés</span></div>');
    if (statOn('skeins')) out.push('<div><b class="num" data-skeins="' + id + '">' + pjSkeinsTxt(pr) + '</b><span>pelote(s) utilisée(s)</span></div>');
    return out.length ? '<div class="pjst" style="grid-template-columns:repeat(' + (out.length === 4 ? 2 : out.length) + ',minmax(0,1fr))">' + out.join('') + '</div>' : '';
  }
  function yarnRowHtml(y) {
    var id = esc(y.id), on = statOn('skeins');
    function fld(k, ph) { return '<input class="in" data-yf="' + k + '" data-id="' + id + '" value="' + esc(y[k] || '') + '" placeholder="' + ph + '" aria-label="' + ph + '">'; }
    return '<div class="yrow" data-yrow="' + id + '">' +
      '<div class="yl"><input class="in" data-yn="' + id + '" value="' + esc(y.name || '') + '" placeholder="Nom du fil" aria-label="Nom du fil">' +
      '<button type="button" class="icon-btn" data-act="yarnDel" data-id="' + id + '" aria-label="Retirer ce fil">&#10005;</button></div>' +
      '<div class="yl">' + fld('brand', 'Marque') + colorBtnHtml('y:' + y.id, y, 'y') + '</div><div class="cpal" data-cpal="y:' + id + '" hidden></div>' +
      (on ? '<div class="yl"><label class="yplan"><span class="sub">Pelotes prévues</span><input class="in" type="number" inputmode="numeric" min="0" step="1" data-yf="planned" data-id="' + id + '" value="' + (y.planned > 0 ? y.planned : '') + '" placeholder="0" aria-label="Pelotes prévues"></label>' +
        '<span class="yskein"' + (y.name && String(y.name).trim() ? '' : ' hidden') + '><button type="button" class="icon-btn" data-act="yarnInc" data-id="' + id + '" data-v="-1" aria-label="Retirer une pelote">−</button>' +
        '<button type="button" class="btn small yinc" data-act="yarnInc" data-id="' + id + '" data-v="1" aria-label="Une pelote de plus">🧶 <b class="num" data-yused="' + id + '">' + yarnCountTxt(y) + '</b></button></span></div>' : '') +
      '</div>';
  }
  function yarnsHtml(pr) {
    return '<div class="fl"><span class="n">Fil</span><div class="stack" id="yarnList" style="gap:6px">' + pjYarns(pr).map(yarnRowHtml).join('') + '</div>' +
      '<div class="stack" style="gap:6px;align-items:flex-start"><button type="button" class="btn small" data-act="yarnAdd">+ Ajouter un fil</button>' +
      (statOn('skeins') ? '<span class="sub">Appuyez sur 🧶 à côté d\'un fil pour compter une pelote utilisée de plus.</span>' : '') + '</div></div>';
  }

  /* ===== v33 : WIP island ===== */
  /* Pour ajouter un animal : ajouter une ligne { id, name, img } (img = image en data: ou lien) */
  var ISLAND_ANIMALS = [
  { id: 'tortue', name: 'Tortue', img: 'assets/island/tortue.webp' },
  { id: 'tortue2', name: 'Tortue (banderole)', img: 'assets/island/tortue2.webp' },
  { id: 'narval', name: 'Narval', img: 'assets/island/narval.webp' },
  { id: 'poulpe', name: 'Poulpe', img: 'assets/island/poulpe.webp' },
  { id: 'etoile', name: 'Étoile de mer', img: 'assets/island/etoile.webp' },
  { id: 'mouton', name: 'Mouton', img: 'assets/island/mouton.webp' },
  { id: 'chat', name: 'Chat', img: 'assets/island/chat.webp' },
  { id: 'chien', name: 'Dalmatien', img: 'assets/island/chien.webp' },
  { id: 'chenille', name: 'Chenille', img: 'assets/island/chenille.webp' }
  ];
  function islandCfg() { var c = S.ui && S.ui.island; return { on: !!(c && c.on), months: Math.max(1, parseInt(c && c.months, 10) || 3), animal: (c && c.animal) || ISLAND_ANIMALS[0].id }; }
  function islandAnimal() { var id = islandCfg().animal; return ISLAND_ANIMALS.find(function(x) { return x.id === id; }) || ISLAND_ANIMALS[0]; }
  function pjLastTouch(pr) {
    if (pr.timer && pr.timer.start) return Date.now();
    if (pr.devAge) return pr.devAge; // simulation de test des réglages
    var rowsAt=(pr.rts&&pr.rts.length)?pr.rts[pr.rts.length-1]:0;
    return Math.max(pr.workAt||0, rowsAt||0, (pr.stageAt&&pr.stageAt.wip)||0, pr.created||0);
  }
  function isIsland(pr) {
    var c = islandCfg();
    if (!c.on || pjStageOf(pr) !== 'wip') return false;
    // Une fois sur l'île, le projet y reste jusqu'à ce qu'il soit terminé.
    if (pr.islandPin || pr.islandSince) return true;
    if ((Date.now() - pjLastTouch(pr)) > c.months * 30.44 * 86400000) {
      pr.islandSince = pjLastTouch(pr) + c.months * 30.44 * 86400000;
      saveProjectsQuiet();
      return true;
    }
    return false;
  }
  /* Appelée juste avant qu'une modification fasse sortir un WIP de l'île : on garde la trace pour pouvoir le remettre */
  function islandExit(pr) {
    var was = isIsland(pr);
    delete pr.islandPin;
    if (was) {
      pr.leftIsland = Date.now();
      toastAct('« ' + (pr.name || 'Sans nom') + ' » est sorti de WIP island.', 'Remettre sur l’île', 'islandBack', pr.id);
    }
  }
  function islandBackHtml(pr) {
    if (pjStageOf(pr) !== 'wip' || !islandCfg().on || isIsland(pr) || !pr.leftIsland || (Date.now() - pr.leftIsland) > 7 * 86400000) return '';
    return '<div class="note info"><div class="grow">Ce WIP vient de sortir de WIP island. Sorti sans faire exprès ?</div><button type="button" class="btn small" data-act="islandBack" data-id="' + esc(pr.id) + '">Remettre sur l’île</button></div>';
  }
  function pjStartTs(pr) { var t = (pr.stageAt && pr.stageAt.wip) || pr.created; return pr.devAge ? Math.min(t, pr.devAge) : t; }
  function islandFolderHtml(n) {
    var an = islandAnimal();
    return '<div class="island-entry"><button type="button" class="isl-folder" data-act="islandOpen" aria-label="Ouvrir le dossier WIP island : ' + n + ' projets"><img src="' + an.img + '" alt="' + esc(an.name) + '"><span class="sr-only">WIP island</span></button></div>';
  }
  var ISLAND_REASON_GROUPS = [
    ['Envie', [
      ['demotivated', 'Plus envie de le tricoter'], ['pattern', 'Le modèle ne me plaît plus'], ['colors', 'Les couleurs ne me plaisent plus'],
      ['newproj', 'Un autre projet est prioritaire'], ['boring', 'Trop répétitif'], ['pause', 'Pause volontaire']]],
    ['Technique', [
      ['modifications', 'À modifier'], ['mistake', 'Erreur à défaire'], ['gauge', 'Problème d’échantillon'],
      ['fit', 'La taille ne convient pas'], ['confusing', 'Patron difficile à suivre'], ['sleeve', 'Sleeve Island'], ['secondsock', 'Second sock syndrome']]],
    ['Matériel', [
      ['yarn', 'Manque de fil'], ['needles', 'Manque d’aiguilles'], ['buttons', 'J’attends boutons / accessoires']]],
    ['Vie', [
      ['time', 'Pas le temps en ce moment'], ['season', 'Pas la bonne saison'], ['lostnotes', 'Notes ou patron perdus'],
      ['finishing', 'Il ne reste que les finitions'], ['blocking', 'À bloquer / essayer'], ['gift', 'Cadeau sans urgence']]]
  ];
  var ISLAND_REASONS = [];
  ISLAND_REASON_GROUPS.forEach(function(g) { g[1].forEach(function(r) { ISLAND_REASONS.push(r); }); });
  function islandReasonLabel(id) { var r = ISLAND_REASONS.find(function(x) { return x[0] === id; }); return r ? r[1] : ''; }
  function islandReasonList(pr) { return (Array.isArray(pr.islandReasons) ? pr.islandReasons : []).map(islandReasonLabel).filter(Boolean); }
  function islandChosenHtml(pr) {
    var ls = islandReasonList(pr);
    return ls.length ? ls.map(function(l) { return '<span class="chip mute">' + esc(l) + '</span>'; }).join('') : '<span class="sub">Aucune raison choisie</span>';
  }
  function islandMiniTags(pr) {
    var ls = islandReasonList(pr);
    if (!ls.length) return '';
    return '<div class="itags mini">' + ls.slice(0, 2).map(function(l) { return '<span class="chip mute">' + esc(l) + '</span>'; }).join('') + (ls.length > 2 ? '<span class="chip mute">+' + (ls.length - 2) + '</span>' : '') + '</div>';
  }
  function islandReasonsHtml(pr) {
    var chosen = Array.isArray(pr.islandReasons) ? pr.islandReasons : [], open = S.islandOpen === pr.id;
    return '<div class="card stack" style="gap:8px"><div class="row"><h3 class="grow">Pourquoi sur l’île ?</h3>' +
      '<button type="button" class="btn small" data-act="islandReasonsToggle" data-id="' + esc(pr.id) + '">' + (open ? 'Fermer' : chosen.length ? 'Modifier' : 'Choisir') + '</button></div>' +
      '<div class="itags" id="islandChosen">' + islandChosenHtml(pr) + '</div>' +
      (open ? ISLAND_REASON_GROUPS.map(function(g) {
        return '<div class="igroup"><span class="sub">' + esc(g[0]) + '</span><div class="itags">' + g[1].map(function(r) {
          var on = chosen.indexOf(r[0]) >= 0;
          return '<label class="itag' + (on ? ' on' : '') + '"><input type="checkbox" data-island-reason="' + r[0] + '"' + (on ? ' checked' : '') + '><span>' + esc(r[1]) + '</span></label>';
        }).join('') + '</div></div>';
      }).join('') : '') + '</div>';
  }
  function islandNoteHtml(fresh) {
    if (!fresh.length) return '';
    var m = islandCfg().months;
    var t = fresh.length === 1 ? '« ' + esc(fresh[0].name || 'Sans nom') + ' » est parti sur l\'île 🏝️ : il n\'a pas bougé depuis ' + m + ' mois ou plus.' : fresh.length + ' WIP sont partis sur l\'île 🏝️ : ils n\'ont pas bougé depuis ' + m + ' mois ou plus.';
    return '<div class="note info" style="margin-bottom:12px"><div class="grow">' + t + ' Retrouve-' + (fresh.length === 1 ? 'le' : 'les') + ' dans le dossier « WIP island ».</div><button class="btn small" data-act="islandAck">OK</button></div>';
  }
  function localInput(ts) {
    var d = new Date(ts), p = function(n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function yarnCountTxt(y) { return (y.used || 0) + (y.planned > 0 ? ' / ' + y.planned : ''); }
  function pjSkeinsTxt(pr) { var pl = pjYarns(pr).reduce(function(t, y) { return t + (y.planned || 0); }, 0); return pjSkeins(pr) + (pl > 0 ? ' / ' + pl : ''); }

  /* ===== Chronomètre ===== */
  function tmLogMs(en) {
    if (en && typeof en.ms === 'number') return en.ms;
    var m = /^Temps tricoté : (\d+):(\d\d):(\d\d)/.exec((en && en.text) || '');
    return m ? ((+m[1] * 60 + +m[2]) * 60 + +m[3]) * 1000 : 0;
  }
  function tmTotal(pr) { var t = tmMs(pr); (pr.log || []).forEach(function(en) { t += tmLogMs(en); }); return t; }
  function tmShort(ms) {
    var m = Math.floor(ms / 60000), h = Math.floor(m / 60);
    if (ms > 0 && m < 1) return '< 1 min';
    return h ? h + ' h ' + (m % 60 < 10 ? '0' : '') + (m % 60) : m + ' min';
  }
  function tmMs(pr) { var t = pr.timer; return t ? (t.acc || 0) + (t.start ? Date.now() - t.start : 0) : 0; }
  function tmFmt(ms) {
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); s = s % 60;
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function tmToggle(pr) {
    S.projects.forEach(function(x) { if (x !== pr && x.timer && x.timer.start) { x.timer.acc += Date.now() - x.timer.start; x.timer.start = 0; } });
    if (!pr.timer) pr.timer = { acc: 0, start: 0 };
    pr.workAt = Date.now();
    if (pr.timer.start) { pr.timer.acc += Date.now() - pr.timer.start; pr.timer.start = 0; } else pr.timer.start = Date.now();
    saveProjects(); render();
  }
  function tmBar() {
    var r = S.projects.filter(function(x) { return x.timer && x.timer.start; })[0];
    if (!r || (S.tab === 'pjd' && S.curProj === r.id)) return '';
    return '<div class="tbar"><button class="btn small nm" data-act="openPj" data-id="' + esc(r.id) + '">⏱ ' + esc(r.name) + '</button><span class="num" data-timer="' + esc(r.id) + '">' + tmFmt(tmMs(r)) + '</span><button class="btn small primary" data-act="tmToggle" data-id="' + esc(r.id) + '">Pause</button></div>';
  }
  setInterval(function() {
    document.querySelectorAll('[data-timer]').forEach(function(el) {
      var pr = S.projects.find(function(x) { return x.id === el.dataset.timer; });
      if (pr) el.textContent = tmFmt(tmMs(pr));
    });
    document.querySelectorAll('[data-tmtot]').forEach(function(el) {
      var pr = S.projects.find(function(x) { return x.id === el.dataset.tmtot; });
      if (pr) el.textContent = tmShort(tmTotal(pr));
    });
  }, 1000);

  /* ===== Aiguilles ===== */
  var NEEDLES = ['2 mm', '2.25 mm', '2.5 mm', '2.75 mm', '3 mm', '3.25 mm', '3.5 mm', '3.75 mm', '4 mm', '4.5 mm', '5 mm', '5.5 mm', '6 mm', '6.5 mm', '7 mm', '8 mm', '9 mm', '10 mm', '12 mm', '15 mm'];
  function needleOpts(cur) {
    var l = NEEDLES.slice();
    if (cur && l.indexOf(cur) < 0) l.unshift(cur);
    return '<option value="">— Choisir —</option>' + l.map(function(n) { return '<option value="' + esc(n) + '"' + (cur === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
  }

  function viewPj() {
    var st = S.pjStage === 'island' ? 'wip' : S.pjStage;
    var all = S.projects.filter(function(x) { return pjStageOf(x) === st; }).sort(function(a, b) { return lastActivity(b) - lastActivity(a); });
    var isl = st === 'wip' ? all.filter(isIsland) : [];
    if (S.pjIsland && !isl.length) S.pjIsland = false;
    var empty = {
      attente: 'Les projets dont vous avez le patron mais que vous n\'avez pas encore commencés.',
      wip: 'Vos tricots en cours. Commencez un projet depuis « En attente ».',
      termine: 'Vos projets terminés apparaîtront ici.'
    };
    if (S.pjIsland && st === 'wip') {
      return '<div class="top"><button class="icon-btn" data-act="islandClose" aria-label="Retour aux WIP">' + ico('back') + '</button><h1 class="grow">WIP island</h1><span class="chip mute num">' + isl.length + '</span></div>' +
        '<div class="pgrid">' + isl.map(pjCardHtml).join('') + '</div>';
    }
    var list = st === 'wip' ? all.filter(function(x) { return !isIsland(x); }) : all;
    var cards = list.map(pjCardHtml).join('');
    return '<div class="top top-clear" style="justify-content:flex-end"><button class="btn primary small" data-act="newPj">+ Projet</button></div>' +
      '<div class="seg" style="margin-bottom:12px" role="tablist">' + PJ_STAGES.map(function(x) {
        var n = S.projects.filter(function(p) { return pjStageOf(p) === x[0]; }).length;
        return '<button data-act="pjStage" data-v="' + x[0] + '" class="' + (st === x[0] ? 'on' : '') + '">' + esc(x[1]) + ' <span class="num">' + n + '</span></button>';
      }).join('') + '</div>' +
      (st === 'wip' ? islandNoteHtml(isl.filter(function(x) { return !x.islandSeen; })) : '') +
      (st === 'wip' && isl.length ? islandFolderHtml(isl.length) : '') +
      (cards ? '<div class="pgrid">' + cards + '</div>' :
        '<div class="empty"><p>' + esc(empty[st]) + '</p><button class="btn primary" data-act="newPj">+ Nouveau projet</button></div>');
  }
  /* ===== Projets terminés : infos figées + notes en étoiles ===== */
  var RATING_KEYS = [
    ['pattern', 'Le patron', 'Clair, agréable à suivre'],
    ['yarn', 'Le fil', 'Toucher, rendu, tenue'],
    ['result', 'Le résultat final', 'Est-ce que j’adore le tricot fini ?'],
    ['fit', 'La coupe / la taille', 'Va-t-il bien ?'],
    ['comfort', 'Le confort au porté', 'Je le mets souvent ?'],
    ['difficulty', 'La difficulté ressentie', '1 = facile, 5 = très difficile']
  ];
  function ratingAvg(pr) {
    var r = pr.rating || {}, s = 0, n = 0;
    ['pattern', 'yarn', 'result', 'fit', 'comfort'].forEach(function(k) { if (r[k] > 0) { s += r[k]; n++; } });
    return n ? (Math.round(s / n * 10) / 10).toString().replace('.', ',') : '';
  }
  function starBtns(k, val) {
    var h = '';
    for (var i = 1; i <= 5; i++) h += '<button type="button" class="star' + (i <= val ? ' on' : '') + '" data-act="rate" data-k="' + k + '" data-v="' + i + '" aria-label="' + i + ' sur 5">★</button>';
    return h;
  }
  function ratingHtml(pr) {
    var r = pr.rating || {};
    return '<div class="card stack"><div class="row"><h3 class="grow">Mon avis</h3><span class="chip mute num" id="ratingAvg">' + (ratingAvg(pr) ? '★ ' + ratingAvg(pr) : '') + '</span></div>' +
      RATING_KEYS.map(function(c) {
        return '<div class="rrow"><div class="rl"><b>' + esc(c[1]) + '</b><span class="sub">' + esc(c[2]) + '</span></div><div class="stars" data-stars="' + c[0] + '">' + starBtns(c[0], r[c[0]] || 0) + '</div></div>';
      }).join('') +
      '<label class="toggle"><input type="checkbox" data-again="1"' + (pr.again ? ' checked' : '') + '> Je le retricoterais</label>' +
      '<label class="fl"><span class="n">Pour la prochaine fois</span><textarea class="in" rows="2" data-pj="ratingNote" placeholder="Ce que je referais autrement, modifications à noter…">' + esc(pr.ratingNote || '') + '</textarea></label></div>';
  }
  function roFieldHtml(label, val) {
    return '<div class="fl"><span class="n">' + esc(label) + '</span><div class="ro">' + (val ? esc(val) : '—') + '</div></div>';
  }
  function yarnsLockedHtml(pr) {
    var ys = pjYarns(pr);
    return '<div class="fl"><span class="n">Fil</span>' + (ys.length ? '<div class="stack" style="gap:6px">' + ys.map(function(y) {
      var hex = /^#[0-9a-f]{6}$/i.test(y.hex || '') ? y.hex : '', det = [y.brand, y.color].filter(Boolean).join(' · ');
      return '<div class="ro yro">' + (hex ? '<i class="cdot" style="background:' + hex + '"></i>' : '') + '<span class="grow">' + esc(y.name || 'Fil sans nom') + (det ? ' <span class="sub">· ' + esc(det) + '</span>' : '') + '</span>' + (y.used ? '<span class="sub">🧶 ' + yarnCountTxt(y) + '</span>' : '') + '</div>';
    }).join('') + '</div>' : '<div class="ro">—</div>') + '</div>';
  }

  /* ===== Couleurs de fil : on choisit au lieu d'écrire ===== */
  var YARN_COLORS = [
    ['Blanc', '#ffffff'], ['Écru', '#f1e9d8'], ['Crème', '#f7ecc9'], ['Beige', '#d9c3a0'], ['Camel', '#b98a55'], ['Marron', '#7b5233'], ['Chocolat', '#4b3022'],
    ['Gris perle', '#cfd3d6'], ['Gris', '#8c9096'], ['Anthracite', '#3d4147'], ['Noir', '#1a1a1a'],
    ['Rose pâle', '#f5d3dc'], ['Rose poudré', '#e3a9b8'], ['Rose vif', '#e0507f'], ['Fuchsia', '#b8236b'], ['Corail', '#ee7d6b'], ['Rouge', '#c62d2d'], ['Bordeaux', '#7a1f2e'],
    ['Orange', '#ec8a2d'], ['Moutarde', '#d6a21f'], ['Jaune', '#f2d43c'],
    ['Vert menthe', '#b9e0c4'], ['Vert sauge', '#9fb59a'], ['Vert', '#4f9a5a'], ['Vert sapin', '#25523b'], ['Kaki', '#7a7a45'],
    ['Turquoise', '#3fb5b0'], ['Bleu ciel', '#a9d2ee'], ['Bleu', '#3d78c4'], ['Bleu marine', '#1f2f5c'],
    ['Lavande', '#c4b2e0'], ['Violet', '#7a4fa8'], ['Prune', '#52284f']
  ];
  function colorNameFromHex(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return '';
    var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, best = '', bd = 1e9;
    YARN_COLORS.forEach(function(c) {
      var q = parseInt(c[1].slice(1), 16), d = Math.pow(r - ((q >> 16) & 255), 2) + Math.pow(g - ((q >> 8) & 255), 2) + Math.pow(b - (q & 255), 2);
      if (d < bd) { bd = d; best = c[0]; }
    });
    return best;
  }
  function colorBtnHtml(key, c, kind) {
    var hex = /^#[0-9a-f]{6}$/i.test(c.hex || '') ? c.hex : '', nm = (kind === 'y' ? c.color : c.name) || (hex ? colorNameFromHex(hex) : '');
    return '<button type="button" class="ccbtn" data-act="colorOpen" data-key="' + esc(key) + '" data-cbtn="' + esc(key) + '" aria-label="Choisir la couleur du fil">' +
      '<i class="cdot' + (hex ? '' : ' none') + '"' + (hex ? ' style="background:' + hex + '"' : '') + '></i><span data-cname>' + esc(nm || 'Choisir la couleur') + '</span></button>';
  }
  function colorPalHtml(key, hex) {
    var cur = String(hex || '').toLowerCase();
    return '<div class="cgrid">' + YARN_COLORS.map(function(c) {
      return '<button type="button" class="cswatch' + (cur === c[1] ? ' on' : '') + '" style="background:' + c[1] + '" data-act="colorSet" data-key="' + esc(key) + '" data-hex="' + c[1] + '" data-name="' + esc(c[0]) + '" title="' + esc(c[0]) + '" aria-label="' + esc(c[0]) + '"></button>';
    }).join('') + '<label class="cswatch cmore" title="Autre couleur">+<input type="color" data-colorpick="' + esc(key) + '" value="' + (/^#[0-9a-f]{6}$/i.test(cur) ? cur : '#d99eae') + '" aria-label="Autre couleur"></label></div>';
  }
  function colorTarget(pr, key) {
    var k = String(key).split(':');
    if (k[0] === 'y') return pjYarns(pr).find(function(x) { return x.id === k[1]; });
    return (pr.plannedColors || []).find(function(x) { return x.id === k[1]; });
  }
  function colorSet(key, hex, name) {
    var pr = curPj(), c = pr && colorTarget(pr, key);
    if (!c) return;
    c.hex = hex;
    if (String(key).charAt(0) === 'y') c.color = name; else c.name = name;
    document.querySelectorAll('[data-cbtn="' + key + '"]').forEach(function(btn) {
      var d = btn.querySelector('.cdot'), s = btn.querySelector('[data-cname]');
      if (d) { d.style.background = hex; d.classList.remove('none'); }
      if (s) s.textContent = name;
    });
    saveSoonPj();
  }
  function colorPalClose() { document.querySelectorAll('.cpal').forEach(function(el) { el.hidden = true; el.innerHTML = ''; }); }

  /* ===== Inspiration d'un projet (tableau façon Pinterest) ===== */
  function inspoItems(pr) {
    if (!Array.isArray(pr.inspo)) pr.inspo = [];
    return pr.inspo.map(function(e) {
      if (e.ideaId) {
        var it = S.ideas.find(function(x) { return x.id === e.ideaId; });
        return it ? { e: e, mediaId: it.mediaId, mediaType: it.mediaType, title: it.title, note: it.note } : null;
      }
      return { e: e, mediaId: e.mediaId, mediaType: e.mediaType || 'image', title: '', note: '' };
    }).filter(Boolean);
  }
  function inspoAddIdeas(pr, ids) {
    if (!Array.isArray(pr.inspo)) pr.inspo = [];
    var n = 0;
    ids.forEach(function(id) {
      if (!S.ideas.some(function(x) { return x.id === id; })) return;
      if (pr.inspo.some(function(e) { return e.ideaId === id; })) return;
      pr.inspo.push({ id: 'i' + uid(), ideaId: id }); n++;
    });
    return n;
  }
  function inspoMediaTag(mediaId, type, alt) {
    if (!mediaId) return '';
    if (type === 'video') {
      var u = getBlobUrl(mediaId);
      return u ? '<video controls playsinline src="' + esc(u) + '"></video>' : '<video controls playsinline data-blob-id="' + esc(mediaId) + '"></video>';
    }
    return '<button type="button" class="inspo-img" data-act="lightbox" data-id="' + esc(mediaId) + '" aria-label="Voir en plein écran">' + blobImg(mediaId, alt || 'Inspiration') + '</button>';
  }
  function inspoHtml(pr) {
    var items = inspoItems(pr);
    return '<div class="card stack"><div class="row"><h3 class="grow">Inspiration</h3>' + (items.length ? '<span class="chip mute num">' + items.length + '</span>' : '') + '</div>' +
      '<div class="row"><label class="btn small primary" for="inspoAddPh">+ Photos</label><input id="inspoAddPh" type="file" accept="image/*" multiple>' +
      '<button type="button" class="btn small" data-act="inspoFromIdeas">+ Depuis mes idées</button></div>' +
      (items.length ? '<div class="masonry">' + items.map(function(it) {
        return '<div class="pin inspo-pin">' + inspoMediaTag(it.mediaId, it.mediaType, it.title) +
          '<button type="button" class="pin-x" data-act="inspoDel" data-id="' + esc(it.e.id) + '" aria-label="Retirer de l’inspiration">&#10005;</button>' +
          ((it.title || (!it.mediaId && it.note)) ? '<div class="pin-body">' + (it.title ? '<h3>' + esc(it.title) + '</h3>' : '') + (!it.mediaId && it.note ? '<p class="sub" style="color:var(--ink)">' + esc(it.note) + '</p>' : '') + '</div>' : '') + '</div>';
      }).join('') + '</div>' : '<p class="sub">Ajoutez des photos d’inspiration ou piochez dans vos idées : elles s’afficheront ici en tableau.</p>') + '</div>';
  }
  function inspoBannerHtml() {
    if (!S.inspoTarget) return '';
    var p = S.projects.find(function(x) { return x.id === S.inspoTarget; });
    if (!p) { S.inspoTarget = null; return ''; }
    return '<div class="note info">Touchez les épingles à ajouter à l’inspiration de « ' + esc(p.name || 'Sans nom') + ' ». Elles resteront aussi dans vos idées.</div>';
  }
  function inspoPickBarHtml(n) {
    var dis = n ? '' : ' disabled';
    return '<div class="selbar"><div class="row"><b class="grow">' + n + ' sélectionnée' + (n > 1 ? 's' : '') + '</b><button class="btn small" data-act="pinPickAll">Tout</button><button class="btn small" data-act="pinPickNone">Aucune</button></div>' +
      '<div class="row" style="flex-wrap:nowrap"><button class="btn grow" data-act="inspoPickCancel">Annuler</button><button class="btn primary grow" data-act="inspoPickDone"' + dis + '>Ajouter au projet</button></div></div>';
  }
  function inspoSendRowHtml(dis) {
    var att = S.projects.filter(function(x) { return pjStageOf(x) === 'attente'; });
    if (!att.length) return '';
    return '<div class="row" style="flex-wrap:nowrap"><select class="in grow" id="bulkProj" aria-label="Projet en attente">' + att.map(function(p) { return '<option value="' + esc(p.id) + '">' + esc(p.name || 'Sans nom') + '</option>'; }).join('') +
      '</select><button class="btn small" data-act="pinBulk" data-v="toproj"' + dis + '>Vers ce projet</button></div>';
  }
  function inspoChipsFor(ideaId) {
    var names = S.projects.filter(function(pr) { return (pr.inspo || []).some(function(e) { return e.ideaId === ideaId; }); }).map(function(pr) { return pr.name || 'Sans nom'; });
    return names.length ? '<div class="chips">' + names.map(function(n) { return '<span class="chip mute">📌 ' + esc(n) + '</span>'; }).join('') + '</div>' : '';
  }

  function plannedColorsHtml(pr) {
    if (!Array.isArray(pr.plannedColors)) pr.plannedColors = [];
    var openKey = S.colorOpen; S.colorOpen = null;
    var rows = pr.plannedColors.map(function(c) {
      var key = 'p:' + c.id;
      return '<div class="planned-color" data-pcolor-row="' + esc(c.id) + '"><div class="pc-top">' + colorBtnHtml(key, c, 'p') +
        '<button class="icon-btn" data-act="plannedColorDel" data-id="' + esc(c.id) + '" aria-label="Retirer cette couleur">×</button></div>' +
        '<div class="cpal" data-cpal="' + esc(key) + '"' + (openKey === key ? '>' + colorPalHtml(key, c.hex) : ' hidden>') + '</div></div>';
    }).join('');
    return '<div class="card stack"><div class="row"><h3 class="grow">Couleurs de fil prévues</h3><span class="chip mute">' + pr.plannedColors.length + '</span></div>' +
      '<div class="planned-colors" id="plannedColors">' + rows + '</div>' +
      '<button type="button" class="btn small" data-act="plannedColorAdd">+ Ajouter une couleur</button></div>';
  }



  function stitchMarkersHtml(pr) {
    var ms=(pr.stitchMarkers||[]).slice().sort(function(a,b){return (+a.row||0)-(+b.row||0);});
    return '<div class="card stack"><div class="row"><h3 class="grow">Stitch markers</h3><span class="chip mute">'+ms.length+'</span></div>' +
      '<p class="sub">Garde une trace des rangs importants de ce projet.</p>' +
      '<div class="row"><label class="fl grow"><span class="n">Rang à marquer</span><input class="in" id="stitchRow" type="number" min="1" step="1" value="'+Math.max(1,pr.rows||1)+'" inputmode="numeric"></label><label class="fl grow"><span class="n">Repère (facultatif)</span><input class="in" id="stitchLabel" maxlength="48" placeholder="ex. début des diminutions"></label></div>' +
      '<button class="btn primary" data-act="stitchAdd" data-id="'+esc(pr.id)+'">Ajouter le stitch marker</button>' +
      (ms.length?'<div class="stack" style="gap:6px">'+ms.map(function(m){return '<div class="row card" style="padding:8px 10px"><b class="num">Rang '+esc(m.row)+'</b><span class="grow">'+esc(m.label||'Repère')+'</span><button class="btn small" data-act="stitchDel" data-id="'+esc(pr.id)+'" data-mid="'+esc(m.id)+'" aria-label="Supprimer le marqueur">✕</button></div>';}).join('')+'</div>':'<span class="sub">Aucun marqueur pour le moment.</span>')+'</div>';
  }

  function viewPjd() {
    var pr = curPj();
    if (!pr) { S.tab = 'pj'; return viewPj(); }
    var st = pjStageOf(pr), p = patternOf(pr);
    var pats = S.patterns.slice().sort(function(a, b) { return String(a.title).localeCompare(String(b.title), 'fr'); });
    var h = '<div class="top"><button class="icon-btn" data-act="tab" data-v="pj" aria-label="Retour">' + ico('back') + '</button><input class="in grow" id="pjName" data-pj="name" value="' + esc(pr.name) + '" aria-label="Nom du projet"></div>';
    var cv = pjCoverId(pr);
    h += '<div class="stack">' +
      /* 1. miniature + patron lié */
      '<div class="card row" style="gap:12px;flex-wrap:nowrap;align-items:flex-start">' +
      '<div style="position:relative;width:104px;flex:none;aspect-ratio:3/4;border-radius:10px;overflow:hidden;background:var(--line);display:grid;place-items:center">' + (cv ? blobImg(cv, 'Miniature') : '<span class="sub" style="padding:6px;text-align:center">Pas de photo</span>') + '</div>' +
      '<div class="stack grow" style="gap:8px;min-width:0"><label class="fl"><span class="n">Patron lié</span><select class="in" data-pj="patternId"><option value="">— Aucun —</option>' +
      pats.map(function(x) { return '<option value="' + esc(x.id) + '"' + (pr.patternId === x.id ? ' selected' : '') + '>' + esc(x.title) + '</option>'; }).join('') + '</select></label>' +
      (p ? (pjHasPdf(pr) ? '<button class="btn primary small" data-act="viewPdf" data-id="' + esc(p.id) + '" data-pj="' + esc(pr.id) + '">Voir le PDF</button>' + (st === 'wip' ? '<span class="sub">Compteur de rangs dans le PDF · rang ' + (pr.rows || 0) + '</span>' : '') : '') + '<button class="btn small" data-act="open" data-id="' + esc(p.id) + '">Fiche du patron</button>' +
        (pjHasPdf(pr) ? '' : '<span class="sub">Pas de PDF enregistré.</span>') : '<span class="sub">Liez un patron pour le consulter d\'un appui.</span>') + '</div></div>' +
      /* 2. infos du projet + statistiques */
      '<div class="card stack"><h3>Infos du projet</h3>' + (st==='wip' && !isIsland(pr)?'<button class="btn small" data-act="sendIsland" data-id="'+esc(pr.id)+'">Envoyer à WIP island</button>':'') + islandBackHtml(pr) + (isIsland(pr) ? '<div class="note info">Ce projet est classé dans WIP Island. Il y restera jusqu’à ce que tu le marques comme terminé.</div>' : '') +
      '<div class="seg" role="group" aria-label="Avancement">' + PJ_STAGES.map(function(x) {
        return '<button data-act="pjStep" data-id="' + esc(pr.id) + '" data-v="' + x[0] + '" class="' + (st === x[0] ? 'on' : '') + '">' + esc(PJ_ONE[x[0]]) + '</button>';
      }).join('') + '</div>' +
      (st === 'attente' ? plannedColorsHtml(pr) : pjStatsHtml(pr, st)) +
      (isIsland(pr) ? islandReasonsHtml(pr) : '') +
      (st === 'termine' ? roFieldHtml('Taille tricotée', pr.size) : sizeSelectHtml(pr, p)) +
      (st === 'attente' ? '' : st === 'termine' ? yarnsLockedHtml(pr) : yarnsHtml(pr)) +
      (st === 'termine' ? roFieldHtml('Taille des aiguilles', pr.needles) + '<span class="sub">Projet terminé : ces infos sont figées. Repassez-le en WIP pour les modifier ; photos et journal restent ouverts.</span>' :
        '<label class="fl"><span class="n">Taille des aiguilles</span><select class="in" data-pj="needles">' + needleOpts(pr.needles || '') + '</select></label>') + '</div>';
    if (st === 'termine') h += ratingHtml(pr);
    if (st === 'wip') h += stitchMarkersHtml(pr);
    if (st === 'attente') return h + inspoHtml(pr) + '</div>';
    if (inspoItems(pr).length) h += inspoHtml(pr);
    /* 3. photos : carrousel */
    var phs = []; if (pr.cover) phs.push(pr.cover); (pr.photos || []).forEach(function(id) { if (phs.indexOf(id) < 0) phs.push(id); });
    h += '<div class="card stack"><div class="row"><h3 class="grow">Photos</h3>' + (phs.length ? '<span class="chip mute num">' + phs.length + '</span>' : '') +
      '<label class="btn small primary" for="pjAddPh">Ajouter une photo</label><input id="pjAddPh" type="file" accept="image/*" multiple></div>' +
      (phs.length ? '<div class="pjcw">' + (phs.length > 1 ? '<button type="button" class="pjcar-nav pjcar-prev" data-act="pjCar" data-v="-1" aria-label="Photo précédente">‹</button><button type="button" class="pjcar-nav pjcar-next" data-act="pjCar" data-v="1" aria-label="Photo suivante">›</button>' : '') +
        '<div class="pjcar">' + phs.map(function(id) {
          return '<div class="pjslide"><button type="button" class="pjsl-img" data-act="lightbox" data-id="' + esc(id) + '" aria-label="Agrandir la photo">' + blobImg(id, 'Photo du projet') + '</button>' +
            '<button type="button" class="pjsl-x" data-act="pjPhotoDel" data-id="' + esc(id) + '" aria-label="Supprimer la photo">&#10005;</button></div>';
        }).join('') + '</div></div>' : '<p class="sub">Aucune photo pour l\'instant. Ajoutez celles de votre tricot : elles s\'afficheront ici en carrousel.</p>') + '</div>';
    /* chronomètre */
    var run = !!(pr.timer && pr.timer.start), tms = tmMs(pr);
    if (st !== 'termine') h += '<div class="card stack"><h3>Chronomètre</h3><div class="timer-big" data-timer="' + esc(pr.id) + '">' + tmFmt(tms) + '</div>' +
      '<div class="row"><button class="btn primary grow" data-act="tmToggle" data-id="' + esc(pr.id) + '">' + (run ? 'Pause' : (tms > 0 ? 'Reprendre' : 'Démarrer')) + '</button>' +
      '<button class="btn" data-act="tmLog">Ajouter au journal</button><button class="btn small" data-act="tmReset">Remettre à 0</button></div>' +
      '<span class="sub">Il continue de tourner même si vous changez de page.</span></div>';
    /* compteur : il vit maintenant dans le PDF (visionneuse). Ici : repli seulement si le projet n'a pas de PDF */
    if (st === 'wip') {
      h += '<div class="card stack"><span class="n" style="font-size:14px;font-weight:500">Compteur de rangs</span><div class="counter">' +
        '<button class="btn" data-act="pjRows" data-v="-1" aria-label="Moins un rang">−</button><span class="big" aria-live="polite">' + (pr.rows || 0) + '</span><button class="btn primary" data-act="pjRows" data-v="1" aria-label="Plus un rang">+1</button>' +
        '<button class="btn" data-act="pjRows" data-v="10">+10</button><button class="btn" data-act="pjRows" data-v="x" aria-label="Ajouter x rangs">+' + rowStepX() + '</button><button class="btn small" data-act="pjRows" data-v="0">Remettre à 0</button></div>' +
        '<div class="pj-sub" data-pjsub>' + pjSubHtml(pr) + '</div></div>';
    }
    /* journal */
    h += '<div class="card stack"><h3>Journal de progression</h3>' +
      '<textarea class="in" id="pjDraft" rows="3" placeholder="Une entrée de journal : avancement, modifications, mesures, idées…">' + esc(S.pjDraft) + '</textarea>' +
      '<div class="row"><label class="btn primary grow" for="pjPhotos">Ajouter des photos</label><input id="pjPhotos" type="file" accept="image/*" multiple><button class="btn grow" data-act="pjAddNote">Ajouter l\'entrée</button></div>' +
      '<span class="sub">Les photos sont ajoutées avec le texte écrit ci-dessus. La date et l\'heure sont enregistrées automatiquement.</span></div>';
    (pr.log || []).forEach(function(en) {
      if (S.pjEdit === en.id) {
        h += '<div class="card stack" style="gap:8px"><label class="fl"><span class="n">Date et heure</span><input class="in" type="datetime-local" id="pjEditTs" value="' + localInput(en.ts) + '"></label>' +
          '<label class="fl"><span class="n">Texte</span><textarea class="in" id="pjEditText" rows="4">' + esc(en.text || '') + '</textarea></label>' +
          '<div class="row"><button class="btn primary grow" data-act="pjEditSave" data-id="' + esc(en.id) + '">Enregistrer</button><button class="btn grow" data-act="pjEditCancel">Annuler</button></div></div>';
        return;
      }
      h += '<div class="card stack" style="gap:8px"><div class="row"><span class="sub grow">' + fmtEntryDate(en.ts) + '</span>' +
        '<button class="icon-btn" data-act="pjEditEntry" data-id="' + esc(en.id) + '" aria-label="Modifier l\'entrée">&#9998;</button>' +
        (S.pjDelEntry === en.id ? '<button class="btn small danger" data-act="pjDelEntryYes" data-id="' + esc(en.id) + '">Supprimer</button><button class="btn small" data-act="pjDelEntryNo">Annuler</button>' : '<button class="icon-btn" data-act="pjDelEntry" data-id="' + esc(en.id) + '" aria-label="Supprimer l\'entrée">&#10005;</button>') + '</div>' +
        (en.text ? '<p style="white-space:pre-wrap;overflow-wrap:anywhere">' + esc(en.text) + '</p>' : '') +
        ((en.photos || []).length ? '<div class="pjph">' + en.photos.map(function(id) { return '<button type="button" data-act="lightbox" data-id="' + esc(id) + '" aria-label="Agrandir la photo">' + blobImg(id, 'Progression') + '</button>'; }).join('') + '</div>' : '') + '</div>';
    });
    h +=
      '<div class="card stack"><h3>Supprimer</h3>' + (S.pjDel ? '<p class="sub">Supprimer définitivement « ' + esc(pr.name) + ' » et ses photos ?</p><div class="row"><button class="btn danger small" data-act="pjDelYes">Oui, supprimer</button><button class="btn small" data-act="pjDelNo">Annuler</button></div>' : '<button class="btn danger small" data-act="pjDel" style="align-self:flex-start">Supprimer ce projet</button>') + '</div></div>';
    return h;
  }
  function projectsBlock(p) {
    var l = projectsOf(p.id);
    return '<div class="card stack" style="margin-bottom:12px"><div class="row"><h3 class="grow">Projets avec ce patron</h3><span class="chip mute num">' + l.length + '</span></div>' +
      l.map(function(pr) { return '<button type="button" class="btn" style="justify-content:space-between;text-align:left" data-act="openPj" data-id="' + esc(pr.id) + '"><span>' + esc(pr.name) + '</span><span class="sub">' + esc(PJ_ONE[pjStageOf(pr)]) + '</span></button>'; }).join('') +
      '<button class="btn primary small" data-act="newProjFor" data-id="' + esc(p.id) + '" style="align-self:flex-start">+ Nouveau projet avec ce patron</button></div>';
  }
  function migrateStages() {
    if (load('carnet.migPj', 0)) return;
    S.patterns.forEach(function(p) {
      if (p.stage === 'wip' || p.stage === 'termine') {
        var pr = newProject({ name: p.title, patternId: p.id, stage: p.stage });
        if (p.stageAt && p.stageAt[p.stage]) pr.stageAt[p.stage] = p.stageAt[p.stage];
      }
    });
    saveProjects();
    keep('carnet.migPj', 1);
  }

  var STAGES = [['attente', 'En attente'], ['wip', 'WIP'], ['termine', 'Terminés']];
  var STAGE_ONE = { attente: 'En attente', wip: 'En cours (WIP)', termine: 'Terminé' };
  function stageOf(p) { return p.stage === 'wip' || p.stage === 'termine' ? p.stage : 'attente'; }
  function hasResultPhoto(p) { return (p.photos || []).some(function(x) { return x.kind === 'fini'; }); }
  function setStage(p, st, quiet) {
    var from = stageOf(p);
    if (from === st) return;
    p.stage = st;
    p.stageAt = p.stageAt || {};
    p.stageAt[st] = Date.now();
    p.stagePrev = from;
    persist();
    if (st === 'termine') S.open.result = 1;
    render();
    if (quiet) return;
    if (st === 'wip') toastAct('« ' + p.title + ' » est en cours.', 'Annuler', 'undoStage', p.id);
    else if (st === 'termine') toastAct(hasResultPhoto(p) ? 'Projet terminé, bravo !' : 'Projet terminé ! Pensez à ajouter la photo du résultat.', 'Annuler', 'undoStage', p.id);
    else toastAct('Remis en attente.', 'Annuler', 'undoStage', p.id);
  }
  function daysSince(ts) { return Math.max(0, Math.floor((Date.now() - ts) / 86400000)); }
  function stageChip(p) {
    var st = stageOf(p);
    return '<span class="chip ' + (st === 'termine' ? 'ok' : st === 'wip' ? 'warn' : 'mute') + '">' + esc(STAGE_ONE[st]) + '</span>';
  }
  function stageAction(p) {
    var st = stageOf(p), id = esc(p.id);
    if (st === 'attente') return '<button class="btn small primary" data-act="stage" data-v="wip" data-id="' + id + '">Commencer</button>';
    if (st === 'wip') return '<button class="btn small primary" data-act="stage" data-v="termine" data-id="' + id + '">Marquer terminé</button>';
    if (!hasResultPhoto(p)) return '<button class="btn small" data-act="resultPhoto" data-id="' + id + '">Ajouter la photo du résultat</button>';
    return '';
  }

  /* ============ Auteurs connus ============ */
  function knownAuthors() {
    var map = {};
    S.patterns.forEach(function(p) {
      var a = normAuthor(p.f && p.f.designer);
      if (!a) return;
      var k = gkey(a);
      map[k] = map[k] || { n: {}, c: 0 };
      map[k].n[a] = (map[k].n[a] || 0) + 1;
      map[k].c++;
    });
    return Object.keys(map).map(function(k) {
      var best = Object.keys(map[k].n).sort(function(x, y) { return map[k].n[y] - map[k].n[x]; })[0];
      return best;
    }).sort(function(a, b) { return a.localeCompare(b, 'fr'); });
  }
  function canonAuthor(a) {
    var k = gkey(a), l = knownAuthors();
    for (var i = 0; i < l.length; i++) if (gkey(l[i]) === k) return l[i];
    return normAuthor(a);
  }
  function authorFieldHtml(p, f, lab, badge, hint, ev) {
    var cur = normAuthor(p.f.designer), l = knownAuthors(), k = gkey(cur), showNew = S.newAuth === p.id;
    var sel = '<select class="in" id="f_designer_sel" data-authsel="1" aria-label="Auteur"><option value="">—</option>' +
      l.map(function(a) { return '<option value="' + esc(a) + '"' + (!showNew && gkey(a) === k ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') +
      '<option value="__new__"' + (showNew ? ' selected' : '') + '>+ Nouvel auteur…</option></select>';
    var inp = showNew ? '<input class="in" id="f_designer" data-k="designer" type="text" placeholder="Nom du créateur ou de la créatrice" value="' + esc(showNew ? '' : cur) + '">' : '';
    return '<div class="fl"><label for="f_designer_sel">' + lab + '</label>' + sel + inp + hint + ev + '</div>';
  }

  /* ============ Doublons ============ */
  var D = null;
  function dupKey(n) { return gkey(String(n || '').replace(/\.pdf$/i, '')); }
  function findDup(f) {
    var k = dupKey(f.name);
    return S.patterns.find(function(p) { return dupKey((p.source && p.source.file) || '') === k || dupKey(p.title) === k; });
  }
  function nameTaken(name, exceptId) {
    var k = dupKey(name);
    return S.patterns.some(function(p) { return p.id !== exceptId && (dupKey((p.source && p.source.file) || '') === k || dupKey(p.title) === k); });
  }
  function renameP(p, name) {
    p.title = name;
    p.source = p.source || {};
    p.source.file = name + '.pdf';
    persist();
  }
  function askDup(f, old) {
    return new Promise(function(resolve) {
      D = { step: 1, f: f, old: old, resolve: resolve, oldName: old.title, newName: f.name.replace(/\.pdf$/i, '') + ' (2)', err: '' };
      renderDupe();
    });
  }
  function closeDupe(res) {
    var r = D && D.resolve;
    D = null;
    var el = $('#dupe');
    el.hidden = true;
    el.innerHTML = '';
    if (r) r(res);
  }
  function renderDupe() {
    var el = $('#dupe');
    if (!D) { el.hidden = true; return; }
    var h = '';
    if (D.step === 1) {
      h = '<h2>Ce fichier existe déjà</h2><p>« ' + esc(D.f.name) + ' » porte le même nom qu\'un patron déjà présent dans votre carnet (« ' + esc(D.old.title) + ' »).</p><p><b>Voulez-vous garder les deux ?</b></p>' +
        '<div class="row"><button class="btn primary grow" data-act="dupBoth">Oui, garder les deux</button><button class="btn grow" data-act="dupNo">Non</button></div>';
    } else if (D.step === 2) {
      h = '<h2>Renommer pour les distinguer</h2><p class="sub">Modifiez le nom de l\'ancien PDF, du nouveau, ou des deux. Les deux noms doivent être différents.</p>' +
        '<label class="fl"><span class="n">Ancien PDF</span><input class="in" id="dupOld" type="text" value="' + esc(D.oldName) + '"></label>' +
        '<label class="fl"><span class="n">Nouveau PDF</span><input class="in" id="dupNew" type="text" value="' + esc(D.newName) + '"></label>' +
        (D.err ? '<div class="note bad">' + esc(D.err) + '</div>' : '') +
        '<div class="row"><button class="btn primary grow" data-act="dupOk">Valider</button><button class="btn grow" data-act="dupBack">Retour</button></div>';
    } else {
      h = '<h2>Lequel garder ?</h2><p class="sub">Un seul des deux restera dans votre carnet.</p>' +
        '<button class="btn primary" data-act="dupKeepOld">Garder l\'ancien</button><span class="sub" style="margin-top:-6px">Le nouveau fichier est ignoré.</span>' +
        '<button class="btn" data-act="dupKeepNew">Garder le nouveau</button><span class="sub" style="margin-top:-6px">Il remplace l\'ancien : la fiche, les photos et le PDF de l\'ancien sont supprimés.</span>' +
        '<button class="btn small" data-act="dupBack" style="align-self:flex-start">Retour</button>';
    }
    el.innerHTML = '<div class="box" role="dialog" aria-modal="true">' + h + '</div>';
    el.hidden = false;
  }

  function newPattern(title, raw, source) {
    var p = {
      id: uid(), title: title || 'Patron sans titre', created: Date.now(), status: 'brouillon',
      source: source || {}, raw: raw || '', f: {}, g: { measures: {}, counts: {} },
      photos: [], ai: {}, ev: {}, gai: {}, opts: []
    };
    var a = guessAuthor(raw);
    if (a) { p.f.designer = a; p.ai.designer = 1; p.ev.designer = 'Repéré dans le texte'; }
    var g = guessGarment((title || '') + ' ' + (raw || '').slice(0, 1500));
    if (g) { p.f.garment = g; p.ai.garment = 1; p.ev.garment = 'Déduit du titre'; }
    return p;
  }

  function gkey(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function normAuthor(s) { return String(s || '').replace(/\s+/g, ' ').replace(/[.,;:]+$/, '').trim(); }

  function folderFor(name) {
    var k = gkey(name), f = S.folders.find(function(x) { return gkey(x.name) === k; });
    if (!f) { f = { id: 'd' + uid(), name: name, created: Date.now() }; S.folders.push(f); saveFolders(); }
    return f;
  }
  function autoFile(p, mode) {
    var name = mode === 'author' ? normAuthor(p.f.designer) : String(p.f.garment || '');
    if (!name || p.folder) return false;
    p.folder = folderFor(name).id;
    persist();
    return true;
  }
  function autoFileAll(mode) {
    var n = 0;
    S.patterns.forEach(function(p) { if (autoFile(p, mode)) n++; });
    toast(n ? n + ' patron(s) classé(s).' : 'Rien à classer.');
  }

  function filled(v) { return Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && v !== ''); }
  function completeness(p) {
    var tot = 0, done = 0;
    ALLF.forEach(function(f) { if (f.core) { tot++; if (filled(p.f[f.k])) done++; } });
    var sizes = p.f.sizes || [];
    ['measures', 'counts'].forEach(function(g) {
      CORE_ROWS[g].forEach(function(r) {
        sizes.forEach(function(s) {
          tot++;
          if (filled((p.g[g][r] || {})[s])) done++;
        });
      });
    });
    tot += 2;
    var ph = p.photos || [];
    if (ph.some(function(x) { return x.kind !== 'fini'; })) done++;
    if (ph.some(function(x) { return x.kind === 'fini'; })) done++;
    return tot ? done / tot : 0;
  }

  function checks(p) {
    var out = [], f = p.f, sizes = f.sizes || [], g = p.g, gs = +f.gauge_sts, gr = +f.gauge_rows;
    if (!(p.raw || '').trim()) out.push(['bad', 'Aucun texte de patron. Importez un PDF ou collez le texte.']);
    if (!gs || !gr) out.push(['bad', 'Échantillon incomplet : indiquez les mailles et les rangs pour 10 cm.']);
    if (!sizes.length) out.push(['bad', 'Aucune taille sélectionnée.']);
    MEASURES.forEach(function(m) {
      var vals = sizes.map(function(s) { return [s, +(g.measures[m[0]] || {})[s]]; }).filter(function(x) { return x[1]; });
      for (var i = 1; i < vals.length; i++) {
        if (vals[i][1] < vals[i - 1][1]) {
          out.push(['warn', m[1] + ' : la taille ' + vals[i][0] + ' (' + vals[i][1] + ') est plus petite que ' + vals[i - 1][0] + ' (' + vals[i - 1][1] + ').']);
          break;
        }
      }
    });
    var okc = 0;
    if (gs) sizes.forEach(function(s) {
      var b = +(g.measures.bust || {})[s], c = +(g.counts.chest || {})[s];
      if (b && c) {
        var w = c / gs * 10, d = Math.abs(w - b) / b;
        if (d > 0.04) out.push(['warn', 'Taille ' + s + ' : ' + c + ' mailles donnent ~' + Math.round(w) + ' cm au lieu de ' + b + ' cm.']);
        else okc++;
      }
    });
    if (okc) out.push(['ok', okc + ' taille(s) : mailles et tour de poitrine concordent avec l\'échantillon.']);
    var ph = p.photos || [];
    if (!ph.some(function(x) { return x.kind !== 'fini'; })) out.push(['warn', 'Pas de photo ni de croquis du patron.']);
    if (!ph.some(function(x) { return x.kind === 'fini'; })) out.push(['warn', 'Pas de photo du résultat tricoté.']);
    return out;
  }

  /* ============ Extraction IA ============ */
  function coerce(f, v) {
    if (v === undefined || v === null || v === '') return undefined;
    if (f.t === 'select') { v = String(v); return f.o.indexOf(v) >= 0 ? v : undefined; }
    if (f.t === 'multi') {
      if (!Array.isArray(v)) return undefined;
      v = v.filter(function(x) { return f.o.indexOf(x) >= 0; });
      return v.length ? v : undefined;
    }
    if (f.t === 'number') { v = parseFloat(v); return isNaN(v) ? undefined : v; }
    return String(v).slice(0, 600);
  }
  function fieldDef(k) { return ALLF.find(function(x) { return x.k === k; }); }

  function applyAI(p, res, keys, over) {
    var n = 0;
    res = res || {};
    var fl = res.fields || (keys ? res : {});
    p.ev = p.ev || {};
    ALLF.forEach(function(f) {
      if (f.k.indexOf('r_') === 0) return;
      if (keys && keys.indexOf(f.k) < 0) return;
      var raw = fl[f.k], q = '';
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'v' in raw) { q = raw.q || ''; raw = raw.v; }
      var v = coerce(f, raw);
      if (v === undefined) return;
      if (filled(p.f[f.k]) && !(over && p.ai[f.k])) return;
      p.f[f.k] = v;
      p.ai[f.k] = 1;
      if (q) p.ev[f.k] = String(q).slice(0, 160);
      n++;
    });
    if (p.f.sizes) p.f.sizes.sort(function(a, b) { return SIZES.indexOf(a) - SIZES.indexOf(b); });
    if (!keys && res.size_map && typeof res.size_map === 'object' && (!filled(p.f.size_map) || (over && p.ai.size_map))) {
      var sm = Object.keys(res.size_map).filter(function(s) { return SIZES.indexOf(s) >= 0; }).map(function(s) { return s + ' = ' + res.size_map[s]; }).join(', ');
      if (sm) { p.f.size_map = sm; p.ai.size_map = 1; n++; }
    }
    return n;
  }

  function putGrid(p, target, kind, rows, src, prefix, over, used) {
    var n = 0;
    if (!src || typeof src !== 'object') return 0;
    rows.forEach(function(r) {
      var row = src[r[0]];
      if (!row || typeof row !== 'object') return;
      Object.keys(row).forEach(function(sz) {
        if (SIZES.indexOf(sz) < 0) return;
        var v = parseFloat(row[sz]);
        if (isNaN(v)) return;
        var t = target[kind][r[0]] = target[kind][r[0]] || {}, key = prefix + kind + '.' + r[0] + '.' + sz;
        if (!filled(t[sz]) || (over && p.gai[key])) {
          t[sz] = v;
          p.gai[key] = 1;
          if (used) used[sz] = 1;
          n++;
        }
      });
    });
    return n;
  }

  function applyGrids(p, res, over) {
    p.gai = p.gai || {};
    var used = {}, n = 0;
    res = res || {};
    n += putGrid(p, p.g, 'measures', MEASURES, res.measures, '', over, used);
    n += putGrid(p, p.g, 'counts', COUNTS, res.counts, '', over, used);
    if (!(p.f.sizes || []).length) {
      var us = Object.keys(used).sort(function(a, b) { return SIZES.indexOf(a) - SIZES.indexOf(b); });
      if (us.length) { p.f.sizes = us; p.ai.sizes = 1; }
    }
    return n;
  }

  function findOpt(p, g, name) {
    var k = (String(g) + '|' + String(name)).toLowerCase();
    return (p.opts || []).find(function(o) { return (o.group + '|' + o.name).toLowerCase() === k; });
  }

  function applyOptGrids(p, list, over) {
    var n = 0;
    if (!Array.isArray(list)) return 0;
    p.gai = p.gai || {};
    list.forEach(function(it) {
      var o = it && findOpt(p, it.group, it.name);
      if (!o) return;
      var def = GROUPDEF[o.group] || GROUPDEF.Autre;
      o.measures = o.measures || {};
      o.counts = o.counts || {};
      n += putGrid(p, o, 'measures', MEASURES.filter(function(r) { return def.m.indexOf(r[0]) >= 0; }), it.measures, o.id + '.', over, null);
      n += putGrid(p, o, 'counts', COUNTS.filter(function(r) { return def.c.indexOf(r[0]) >= 0; }), it.counts, o.id + '.', over, null);
    });
    return n;
  }

  function mergeOptions(p, list, over) {
    if (!Array.isArray(list)) return 0;
    p.opts = p.opts || [];
    var n = 0;
    if (over) p.opts = p.opts.filter(function(o) { return !o.ai; });
    list.forEach(function(o) {
      if (!o || !o.name || !GROUPDEF[o.group]) return;
      if (findOpt(p, o.group, o.name)) return;
      var def = GROUPDEF[o.group], of = {};
      Object.keys(o.fields || {}).forEach(function(k) {
        if (def.fields.indexOf(k) < 0) return;
        var f = fieldDef(k);
        if (!f) return;
        var raw = o.fields[k];
        if (raw && typeof raw === 'object' && 'v' in raw) raw = raw.v;
        var v = coerce(f, raw);
        if (v !== undefined) of[k] = v;
      });
      p.opts.push({
        id: uid(), group: o.group, name: String(o.name).slice(0, 80),
        desc: String(o.desc || '').slice(0, 500), f: of, measures: {}, counts: {},
        q: String(o.q || '').slice(0, 160), ai: 1
      });
      n++;
    });
    return n;
  }

  function specText(keys) {
    return ALLF.filter(function(f) { return keys ? keys.indexOf(f.k) >= 0 : f.k.indexOf('r_') !== 0; }).map(function(f) {
      return f.k + ' (' + ({
        text: 'texte court', long: 'texte', number: 'nombre' + (f.u ? ' en ' + f.u : ''),
        select: 'une valeur parmi : ' + (f.o || []).join(' | '),
        multi: 'liste de valeurs parmi : ' + (f.o || []).join(' | ')
      }[f.t]) + ') = ' + f.l;
    }).join('\n');
  }
  function groupSpec() {
    return GROUP_NAMES.map(function(g) { var d = GROUPDEF[g]; return '- ' + g + (d.fields.length ? ' (clés permises : ' + d.fields.join(', ') + ')' : ''); }).join('\n');
  }
  function rowSpec() {
    return 'Lignes de "measures" (cm) :\n' + MEASURES.map(function(m) { return m[0] + ' = ' + m[1]; }).join('\n') + '\n\nLignes de "counts" :\n' + COUNTS.map(function(m) { return m[0] + ' = ' + m[1]; }).join('\n');
  }
  function optList(p) {
    var l = (p.opts || []).map(function(o) { var d = GROUPDEF[o.group] || GROUPDEF.Autre; return '- groupe "' + o.group + '", nom "' + o.name + '" (lignes permises : ' + d.m.concat(d.c).join(', ') + ')'; });
    return l.length ? l.join('\n') : '(aucune variante détectée)';
  }
  function sizeInfo(p) {
    return (p.f.sizes && p.f.sizes.length ? p.f.sizes.join(', ') : 'à déterminer parmi XS, S, M, L, XL, XXL, 3XL') + (p.f.size_map ? '. Noms dans le patron : ' + p.f.size_map : '');
  }

  function prompt1(txt) {
    return 'Tu es spécialiste des patrons de tricot. Lis TOUT le texte ci-dessous et remplis la fiche technique. Réponds avec un seul objet JSON, sans autre texte :\n' +
      '{"fields":{"<clé>":{"v":<valeur>,"q":"citation courte du patron, 15 mots maximum"}},"size_map":{"XS":"nom ou numéro"},"options":[{"group":"<groupe>","name":"<nom du choix>","desc":"<une phrase>","fields":{"<clé>":<valeur>},"q":"citation courte"}]}\n\n' +
      'Règles :\n1. N\'invente rien. Omets toute clé absente.\n2. Pour un champ à choix, "v" reprend exactement une valeur de la liste.\n3. Tailles : associe les tailles du patron aux étiquettes XS, S, M, L, XL, XXL, 3XL.\n4. VARIANTES : mets chaque choix dans "options". Groupes possibles :\n' + groupSpec() + '\n5. Ne remplis aucune clé commençant par r_.\n\nChamps :\n' + specText(null) + '\n\nTexte du patron :\n' + txt;
  }

  function prompt2(txt, p) {
    return 'Tu lis un patron de tricot pour remplir deux tableaux par taille. Tailles proposées : ' + sizeInfo(p) + '.\n' +
      'Réponds uniquement avec un objet JSON : {"measures":{"<ligne>":{"<taille>":nombre}},"counts":{"<ligne>":{"<taille>":nombre}},"options":[{"group":"<groupe>","name":"<nom>","measures":{...},"counts":{...}}]}\n\n' +
      'Variantes connues :\n' + optList(p) + '\n\n' + rowSpec() + '\n\nTexte du patron :\n' + txt;
  }

  function promptVisual(p) {
    var empty = ALLF.filter(function(f) { return f.k.indexOf('r_') !== 0 && !filled(p.f[f.k]); }).map(function(f) { return f.k; });
    return 'Ces images sont des pages d\'un patron de tricot. Complète la fiche. Tailles : ' + sizeInfo(p) + '.\n' +
      'Réponds uniquement avec un objet JSON {"fields":{"<clé>":{"v":<valeur>,"q":"source"}},"measures":{...},"counts":{...}}.\n\n' +
      'Champs encore vides :\n' + specText(empty.slice(0, 40)) + '\n\n' + rowSpec();
  }

  function sig() {
    if (!S.ctl || S.ctl.signal.aborted) S.ctl = new AbortController();
    return S.ctl.signal;
  }

  async function analyze(p, o) {
    o = o || {};
    var over = !!o.over;
    if (!(p.raw || '').trim()) { toast('Ajoutez d\'abord le texte du patron.'); return false; }
    var txt = proc(p).clean.slice(0, 70000), n = 0, opt = 0, ok = false, usedProvider = '';
    var signal = sig();
    try {
      S.busy = 'Étape 1 sur 2 : fiche, tailles et variantes…';
      render();
      var r1 = await callAI(prompt1(txt), { json: true, signal: signal });
      usedProvider = r1.provider;
      n += applyAI(p, r1.data, null, over);
      opt += mergeOptions(p, r1.data && r1.data.options, over);
      persist();
      ok = true;
    } catch (e) {
      toast(aiMsg(e));
      if (e && e.code === 'cancelled') { S.busy = ''; render(); return false; }
    }
    if (ok) {
      try {
        S.busy = 'Étape 2 sur 2 : tableaux par taille…';
        render();
        var r2 = await callAI(prompt2(txt, p), { json: true, signal: signal });
        usedProvider = r2.provider || usedProvider;
        n += applyGrids(p, r2.data, over) + applyOptGrids(p, r2.data && r2.data.options, over);
      } catch (e) {
        toast(aiMsg(e));
      }
      p.analysis = { at: Date.now(), n: n, opts: (p.opts || []).length, provider: usedProvider };
      persist();
      toast(n + ' valeurs remplies via ' + usedProvider + '.');
    }
    if (ok && S.opts.autoFile && !p.folder) autoFile(p, S.opts.autoFile);
    S.busy = '';
    render();
    return ok;
  }

  async function renderPages(pdf, a, b) {
    var imgs = [];
    for (var n = a; n <= b; n++) {
      var page = await pdf.getPage(n), vp = page.getViewport({ scale: 1.5 }), c = document.createElement('canvas');
      c.width = vp.width;
      c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      imgs.push(await new Promise(function(r) { c.toBlob(r, 'image/jpeg', 0.85); }));
    }
    return imgs;
  }

  async function aiVisual(p) {
    var d = await getPdf(p);
    if (!d) { toast('Associez d\'abord le PDF.'); return; }
    var pdf = d.pdf, total = Math.min(pdf.numPages, 12), per = 3, n = 0, usedProv = '';
    try {
      for (var a = 1; a <= total; a += per) {
        var b = Math.min(total, a + per - 1);
        S.busy = 'Lecture des pages ' + a + ' à ' + b + '…';
        render();
        var imgs = await renderPages(pdf, a, b);
        var res = await callAI(promptVisual(p), { images: imgs, json: true, signal: sig() });
        usedProv = res.provider;
        n += applyAI(p, res.data, null, false) + applyGrids(p, res.data, false) + applyOptGrids(p, res.data && res.data.options, false);
      }
      persist();
      toast(n ? n + ' valeurs ajoutées (' + usedProv + ').' : 'Rien de nouveau.');
    } catch (e) { toast(aiMsg(e)); }
    S.busy = '';
    render();
  }

  async function aiPhoto(p) {
    var ph = (p.photos || []).filter(function(x) { return x.kind !== 'fini'; }).slice(0, 3);
    if (!ph.length) ph = (p.photos || []).slice(0, 3);
    if (!ph.length) { toast('Ajoutez une photo d\'abord.'); return; }
    S.busy = 'Analyse visuelle des photos…';
    render();
    try {
      var bl = (await Promise.all(ph.map(function(x) { return loadBlob(x.id); }))).filter(Boolean);
      var prompt = 'Ces images montrent un modèle de tricot. Décris ce que tu vois pour remplir une fiche. Réponds uniquement avec un objet JSON {clé:valeur}.\n\nChamps :\n' + specText(PHOTO_KEYS);
      var res = await callAI(prompt, { images: bl, json: true, signal: sig() });
      var n = applyAI(p, res.data, PHOTO_KEYS, false);
      persist();
      toast(n ? n + ' champs proposés via ' + res.provider + '.' : 'Rien de nouveau détecté.');
    } catch (e) { toast(aiMsg(e)); }
    S.busy = '';
    render();
  }

  async function aiRead(p) {
    var d = await getPdf(p);
    if (!d) { toast('Associez le PDF.'); return false; }
    var pdf = d.pdf, total = Math.min(pdf.numPages, 12), out = [], per = 3, usedProv = '';
    try {
      for (var a = 1; a <= total; a += per) {
        var b = Math.min(total, a + per - 1);
        S.busy = 'Transcription OCR des pages ' + a + ' à ' + b + '…';
        render();
        var imgs = await renderPages(pdf, a, b);
        var res = await callAI('Transcris fidèlement le texte de ces pages d\'un patron de tricot, sans rien résumer. Réponds uniquement avec la transcription.', { images: imgs, signal: sig() });
        usedProv = res.provider;
        out.push(res.data);
      }
      p.raw = out.join('\n\f\n');
      p.scanned = false;
      p._v = (p._v || 0) + 1;
      persist();
      toast('Texte transcrit via ' + usedProv + '.');
      return true;
    } catch (e) { toast(aiMsg(e)); return false; }
  }

  async function readAndAnalyze(p) {
    var ok = await aiRead(p);
    S.busy = '';
    render();
    if (ok && S.opts.auto) await analyze(p);
  }

  /* ============ Import PDF, Miniatures et Visionneuse ============ */
  async function storeThumb(p, pdf) {
    var page = await pdf.getPage(1), v0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 360 / v0.width });
    var c = document.createElement('canvas');
    c.width = Math.round(vp.width);
    c.height = Math.round(vp.height);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    var b = await new Promise(function(res) { c.toBlob(res, 'image/jpeg', 0.8); });
    var tid = 'th_' + p.id;
    await saveBlob(tid, b);
    p.thumb = tid;
    persist();
    if (S.tab === 'lib') render();
  }

  async function handleFiles(files) {
    if(S.importRunning) {toast('Un import est déjà en cours.');return;}
    S.importRunning=true; S.importStop=false; S.importRows=files.map(function(f){return {name:f.name,status:'En attente'};});
    if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function(){});
    try {await safetySnapshot();} catch(e) {S.importRunning=false;storageFailure(e);return;}
    S.tab = 'add';
    var last = null, made = [];
    for (var i = 0; i < files.length; i++) {
      if(S.importStop) break;
      var item=S.importRows[i],pendingReplace=null;item.status='Lecture en cours';
      var f = files[i];
      if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
        item.status='Format non supporté'; S.log.unshift({ ok: 0, m: f.name + ' : format non supporté (PDF uniquement).' });
        continue;
      }
      var fname = f.name, old = findDup(f);
      if (old) {
        S.busy = '';
        render();
        var dd = await askDup(f, old);
        if (dd.action === 'old') { item.status='Ignoré (doublon)';
          S.log.unshift({ ok: 1, m: f.name + ' : ignoré, l\'ancien est conservé.' });
          continue;
        }
        if (dd.action === 'new') {
          pendingReplace=old;
        }
        if (dd.action === 'both') {
          renameP(old, dd.oldName);
          fname = dd.newName + '.pdf';
        }
      }
      S.busy = 'Lecture de ' + fname + '…';
      render();
      try {
        var r = await pdfToPages(f);
        var raw = r.pages.map(function(pg) { return pg.join('\n'); }).join('\n\f\n');
        var chars = raw.replace(/\s/g, '').length;
        var p = newPattern(fname.replace(/\.pdf$/i, ''), raw.slice(0, 90000), { file: fname, pages: r.pages.length });
        if (chars < 150 * Math.max(1, Math.min(r.pages.length, 3))) p.scanned = true;
        var pdfId = 'pdf_' + p.id;
        await saveBlob(pdfId, f);
        p.source.pdf = pdfId;
        pdfs.set(p.id, r);
        if (S.opts.autoFile) autoFile(p, S.opts.autoFile);
        if (S.opts.autoProj) newProject({ name: p.title, patternId: p.id, stage: 'attente' });
        S.patterns.unshift(p);
        clearTimeout(persistTimer);persistTimer=null;
        try {await persistNow();} catch(e) {S.patterns=S.patterns.filter(function(x){return x.id!==p.id;});throw e;}
        if(pendingReplace) {pdfs.delete(pendingReplace.id);removeP(pendingReplace);await persistNow();}
        last = p;
        made.push(p);
        try {await storeThumb(p,r.pdf);await persistNow();} catch(e) {console.warn(e);}
        item.status='Enregistré'; if(r.pdf.destroy) await r.pdf.destroy();pdfs.delete(p.id);blobs.delete(pdfId);
        S.log.unshift({ ok: 1, m: fname + ' : ' + r.pages.length + ' page(s) importée(s).' });
      } catch (e) {
        item.status='Échec : '+(e.message || 'lecture ou stockage impossible');
        S.log.unshift({ok:0,m:fname+' : '+item.status});
        if(e.name==='QuotaExceededError' || document.getElementById('storageFailure')) S.importStop=true;
      }
    }
    S.importRunning=false;S.importRows.forEach(function(x){if(x.status==='En attente') x.status='Non traité (arrêt)';});
    try {await safetySnapshot();} catch(e) {storageFailure(e);}
    S.bkHide=false; S.busy = '';
    if (last && files.length === 1) openP(last.id);
    else render();

    if (S.opts.auto && made.length && hasAnyAiKey()) {
      for (var j = 0; j < made.length; j++) {
        var q = made[j];
        if (q.scanned) {
          var rd = await aiRead(q);
          S.busy = '';
          if (!rd) continue;
        }
        await analyze(q);
      }
    }
  }

  async function getPdf(p) {
    var d = pdfs.get(p.id);
    if (d && d.pdf) return d;
    if (!p.source || !p.source.pdf) return null;
    try {
      var b = await loadBlob(p.source.pdf);
      if (!b) return null;
      var buf = await b.arrayBuffer();
      var pdf = await pdfOpen(new Uint8Array(buf));
      d = { pdf: pdf };
      pdfs.set(p.id, d);
      return d;
    } catch (e) { return null; }
  }

  async function queueThumbs() {
    if (thumbQ) return;
    thumbQ = true;
    try {
      var list = S.patterns.slice();
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (p.thumb) { await loadBlob(p.thumb); continue; }
        if (thumbTried[p.id]) continue;
        if (!(pdfs.has(p.id) || (p.source && p.source.pdf))) continue;
        thumbTried[p.id] = 1;
        var d = await getPdf(p);
        if (!d) continue;
        await storeThumb(p, d.pdf);
      }
      resolveLazyMedia();
    } catch (e) {}
    thumbQ = false;
  }

  async function attachPdf(p, f) {
    S.busy = 'Enregistrement du PDF…';
    render();
    try {
      var buf = await f.arrayBuffer();
      var pdf = await pdfOpen(new Uint8Array(buf.slice(0)));
      pdfs.set(p.id, { pdf: pdf });
      p.source = p.source || {};
      var pdfId = 'pdf_' + p.id;
      await saveBlob(pdfId, f);
      p.source.pdf = pdfId;
      p.source.file = p.source.file || f.name;
      p.source.pages = pdf.numPages;
      delete p.thumb;
      await storeThumb(p, pdf);
      persist();
      toast('PDF associé au patron.');
    } catch (e) { toast('Impossible d\'associer ce PDF.'); }
    S.busy = '';
    render();
  }

  function pageLabel() {
    var box = $('#vscroll'), ref = box.scrollTop + box.clientHeight / 3, n = 1;
    V.pages.forEach(function(pg, i) { if (pg.el.offsetTop <= ref) n = i + 1; });
    $('#vpage').textContent = V.pages.length ? n + ' / ' + V.pages.length : '';
  }

  async function renderVisible() {
    if (V.running) { V.again = true; return; }
    V.running = true;
    try {
      do {
        V.again = false;
        var box = $('#vscroll'), top = box.scrollTop, bot = top + box.clientHeight;
        var mid = top + box.clientHeight / 2, order = V.pages.map(function(q, k) { return k; });
        order.sort(function(a, b) { return Math.abs(V.pages[a].el.offsetTop - mid) - Math.abs(V.pages[b].el.offsetTop - mid); });
        for (var oi = 0; oi < order.length && V.pdf; oi++) {
          var i = order[oi];
          var pg = V.pages[i], el = pg.el, y = el.offsetTop, h = el.offsetHeight;
          var near = !(y + h < top - 900 || y > bot + 900), far = (y + h < top - 3000 || y > bot + 3000);
          if (far && pg.done) { vClear(pg); continue; }
          if (!near || pg.done) continue;
          var page = await V.pdf.getPage(i + 1);
          if (!V.pdf) break;
          var v0 = page.getViewport({ scale: 1 }), dpr = Math.min(window.devicePixelRatio || 1, V.zoom > 1 ? 1.5 : 2);
          var w0 = el.clientWidth || 320, sc0 = w0 * dpr / v0.width;
          if (v0.width * v0.height * sc0 * sc0 > 12e6) sc0 = Math.sqrt(12e6 / (v0.width * v0.height));
          var vp = page.getViewport({ scale: sc0 });
          var c = document.createElement('canvas');
          c.width = Math.floor(vp.width);
          c.height = Math.floor(vp.height);
          await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          var oc = el.querySelector('canvas');
          if (oc) el.replaceChild(c, oc); else el.insertBefore(c, el.firstChild);
          el.style.aspectRatio = '';
          pg.done = Math.abs(el.clientWidth - w0) < 3;
          if (!pg.done) V.again = true;
        }
      } while (V.again && V.pdf);
    } catch (e) {}
    V.running = false;
  }

  async function buildViewer() {
    var box = $('#vscroll');
    box.innerHTML = '';
    box.style.setProperty('--z', V.zoom);
    V.pages = [];
    var first = await V.pdf.getPage(1), v = first.getViewport({ scale: 1 }), ar = v.width + ' / ' + v.height;
    for (var n = 1; n <= V.pdf.numPages; n++) {
      var d = document.createElement('div');
      d.className = 'vpage';
      d.innerHTML = '<div class="vov"></div>';
      d.style.aspectRatio = ar;
      box.appendChild(d);
      V.pages.push({ el: d, done: false, ar: ar });
    }
    box.scrollTop = 0;
    vOv();
    vRestore(); /* le PDF s'ouvre directement au repère (sinon à la dernière position lue) */
    pageLabel();
    renderVisible();
  }

  async function openViewer(p, pjId) {
    S.busy = 'Ouverture du PDF…';
    render();
    var d = await getPdf(p);
    S.busy = '';
    render();
    if (!d) { toast('PDF introuvable.'); return; }
    V.id = p.id; V.pjId=pjId || ''; 
    V.pdf = d.pdf;
    V.zoom = 1;
    V.mark = load('carnet.vmark.' + p.id, null); V.hl = load('carnet.vhl.' + p.id, {}); V.sm = load('carnet.vsm.' + p.id, {}); V.dark = 0; V.tool = ''; V.tc = {};
    $('#vtitle').textContent = p.title;
    $('#viewer').hidden = false;
    vTools(); vWake(true);
    toast(navigator.wakeLock ? '☀️ Écran gardé allumé pendant la lecture' : '⚠️ Ce navigateur ne peut pas garder l’écran allumé');
    document.body.style.overflow = 'hidden';
    vrcOpen(p, pjId);
    buildViewer();
  }

  function closeViewer() {
    var sheet=document.getElementById('pdfToolSheet');if(sheet)sheet.remove();S.pdfToolReturn=null;SHEET.mode='';
    $('#viewer').classList.remove('tools-open');$('#viewer').style.removeProperty('--vsh');
    clearTimeout(V.pt); vposNow(); vWake(false);
    var hadRows = vrcClose();
    $('#viewer').hidden = true;
    document.body.style.overflow = '';
    V.pdf = null;
    V.pages = [];
    $('#vscroll').innerHTML = '';
    if (hadRows && (S.tab === 'pjd' || S.tab === 'pj')) render();
  }

  /* ===== Objectif de rangs (compteur précis) =====
     Les rangs restent TOUS comptés dans pr.rows (statistiques) ; pr.sub n'est qu'un objectif temporaire. */
  function rowStepX() { var v = parseInt(load('carnet.rowStep', 5), 10); return v >= 2 && v <= 999 ? v : 5; }
  function subAdvance(pr, d) {
    var sb = pr && pr.sub;
    if (!sb || !(sb.target > 0) || !d) return false;
    sb.n = Math.max(0, (sb.n || 0) + d);
    if (sb.n >= sb.target) {
      var t = sb.target; pr.sub = null; pr.subDone = (pr.subDone || 0) + 1;
      toast('Objectif de ' + t + ' rangs atteint 🎉 Vos rangs restent comptés.');
      return true;
    }
    return false;
  }
  function rowsApply(pr, n) {
    var was = pr.rows || 0;
    pr.rows = n === 0 ? 0 : Math.max(0, was + n);
    if (pr.rows === was) return false;
    if (n === 1) { (pr.rts = pr.rts || []).push(Date.now()); if (pr.rts.length > 40) pr.rts.shift(); }
    else if (n === -1) { if (pr.rts && pr.rts.length) pr.rts.pop(); }
    else pr.rts = [];
    pr.workAt = Date.now();
    if (n !== 0) subAdvance(pr, pr.rows - was);
    return true;
  }
  function askGoal(pr) {
    return dlgOpen({ title: 'Objectif de rangs', text: 'Combien de rangs voulez-vous tricoter ? Ce compteur disparaît une fois l’objectif atteint ; tous vos rangs restent comptés dans vos statistiques.', input: true, value: pr.sub && pr.sub.target ? String(pr.sub.target) : '', ok: 'Valider', placeholder: 'ex. 20',
      check: function(v) { return /^\d{1,4}$/.test(v) && parseInt(v, 10) > 0 ? '' : 'Entrez un nombre entier (1 à 9999).'; } }).then(function(v) {
      if (v == null) return false;
      var t = parseInt(v, 10), keep0 = pr.sub && pr.sub.n < t ? pr.sub.n : 0;
      pr.sub = { target: t, n: keep0, at: Date.now() };
      return true;
    });
  }
  function askStepX() {
    return dlgOpen({ title: 'Choisir x', text: 'Nombre de rangs ajoutés par le bouton « +x » (de 2 à 999).', input: true, value: String(rowStepX()), ok: 'Enregistrer', placeholder: 'ex. 5',
      check: function(v) { var n = parseInt(v, 10); return /^\d{1,3}$/.test(v) && n >= 2 ? '' : 'Entrez un nombre entre 2 et 999.'; } }).then(function(v) {
      if (v == null) return false;
      keep('carnet.rowStep', parseInt(v, 10));
      return true;
    });
  }
  function pjSubHtml(pr) {
    var sb = pr && pr.sub;
    if (sb && sb.target > 0) return '<span class="sub">Objectif : <b>' + (sb.n || 0) + ' / ' + sb.target + ' rangs</b></span>' +
      '<span><button type="button" class="pj-lk" data-act="pjGoal">modifier</button> · <button type="button" class="pj-lk" data-act="pjXSet">choisir x (+' + rowStepX() + ')</button> · <button type="button" class="pj-lk" data-act="pjGoalDrop">abandonner</button></span>';
    return '<span><button type="button" class="pj-lk" data-act="pjGoal">＋ objectif de rangs</button> · <button type="button" class="pj-lk" data-act="pjXSet">choisir x (+' + rowStepX() + ')</button></span>';
  }
  function pjSubRefresh(pr) {
    document.querySelectorAll('[data-pjsub]').forEach(function(el) { el.innerHTML = pjSubHtml(pr); });
    document.querySelectorAll('[data-act="pjRows"][data-v="x"]').forEach(function(el) { el.textContent = '+' + rowStepX(); });
  }
  function vrcSubUi() {
    var box = $('#vrcSub'), pr = VRC.pr; if (!box) return;
    if (!pr) { box.hidden = true; box.innerHTML = ''; return; }
    var sb = pr.sub, x = rowStepX();
    box.hidden = false;
    box.innerHTML = sb && sb.target > 0
      ? '<button type="button" class="vrc-sl" data-r="goalMenu" aria-label="Objectif de rangs : options">' + (sb.n || 0) + ' / ' + sb.target + '</button><button type="button" data-r="10" aria-label="Ajouter dix rangs">+10</button><button type="button" data-r="x" aria-label="Ajouter ' + x + ' rangs">+' + x + '</button>'
      : '<button type="button" class="vrc-sl" data-r="goal">＋ objectif de rangs</button>';
    box.innerHTML += '<button type="button" data-r="note" aria-label="Écrire une note dans le journal" title="Note au journal">📝</button>';
    var xb = $('#vrcXb'); if (xb) xb.textContent = '+' + x + ' rangs';
    var gd = $('#vrcGoalDrop'); if (gd) gd.hidden = !(sb && sb.target > 0);
  }

  /* ===== Compteur de rangs sur le PDF ===== */
  var VRC = { pr: null, t: null, x: 0, y: 0, drag: false, arm: 0, st: null };
  function vrcProject(p, pjId) {
    var l = projectsOf(p.id), pr = pjId && l.find(function(x) { return x.id === pjId; });
    if(pjId) return pr && pjStageOf(pr)==='wip' ? pr : null;
    l = l.filter(function(x) { return pjStageOf(x) === 'wip'; }).sort(function(a, b) { return (b.act || 0) - (a.act || 0); });
    return l.length===1 ? l[0] : null;
  }
  function vrcOpen(p, pjId) {
    var el = $('#vrc'), pr = vrcProject(p, pjId);
    VRC.pr = pr; syncCounterButton();
    if (!pr) { el.hidden = true; return; }
    var pos = load('carnet.vrcPos', null), mn = load('carnet.vrcMin', 0);
    el.hidden = false; el.classList.toggle('min', !!mn); syncCounterButton();
    $('#vrcMenu').hidden = true;
    $('#vrcPj').textContent = 'Projet : ' + (pr.name || 'Sans nom');
    $('#vrcV').textContent = pr.rows || 0;
    vrcStat(); vrcSubUi();
    vrcPlace(pos);
  }
  /* l'ancien bouton « Recentrer le compteur » de l'en-tête a été supprimé : toucher le petit numéro rouvre la bulle réduite */
  function syncCounterButton() {}
  function restoreCounter() {
    var p=S.patterns.find(function(x){return x.id===V.id;});
    var pr=VRC.pr && S.projects.find(function(x){return x.id===VRC.pr.id;});
    if(!pr && p) pr=vrcProject(p,V.pjId);
    if(!pr) {toast('Ouvrez le PDF depuis un projet en cours pour afficher son compteur.');return;}
    VRC.pr=pr; var el=$('#vrc');el.hidden=false;el.classList.remove('min','custom','scrolling');el.style.left='';el.style.top='';
    $('#vrcMenu').hidden=true;$('#vrcV').textContent=pr.rows||0;$('#vrcPj').textContent='Projet : '+pr.name;
    keep('carnet.vrcMin',0);keep('carnet.vrcPos',null);vrcStat();vrcSubUi();vrcPlace(null);syncCounterButton();
  }
  var SHEET = { mode: '', snap: 'half', page: 1 };
  function vCurPage() {
    var box = $('#vscroll'), ref = box.scrollTop + 90, k = 0;
    V.pages.forEach(function(pg, i) { if (pg.el.offsetTop <= ref) k = i; });
    return k + 1;
  }
  function sheetTitle() {
    if (SHEET.mode === 'note') return 'Note au journal';
    var cur = TOOLS.find(function(t) { return t[0] === S.toolSub; });
    return cur ? cur[1] : 'Outils du PDF';
  }
  function sheetHeadHtml() {
    var back = SHEET.mode !== 'note' && S.toolSub ? '<button class="icon-btn" data-act="toolSub" data-v="" aria-label="Retour à la liste des outils">‹</button>' : '';
    return back + '<b class="pdf-tool-title">' + esc(sheetTitle()) + '</b><button class="btn small pdf-tool-close" data-act="pdfToolsReturn" aria-label="Fermer et revenir au PDF">Fermer ✕</button>';
  }
  function noteCtx(pr) {
    var parts = [];
    if (V.pages.length) parts.push('p. ' + (SHEET.page || 1));
    if (pr && pr.rows) parts.push('rang ' + pr.rows);
    return parts.join(' · ');
  }
  function noteSheetHtml(pr) {
    return '<div class="stack" style="gap:8px"><textarea class="in" id="pdfNoteText" rows="2" style="min-height:64px" placeholder="Une idée, une modification, une remarque…">' + esc(S.pdfNote || '') + '</textarea>' +
      '<span class="sub">Ajoutée au journal' + (noteCtx(pr) ? ' · ' + esc(noteCtx(pr)) : '') + '</span>' +
      '<div class="row" style="justify-content:flex-end"><button class="btn small" data-act="pdfNoteClear">Effacer</button><button class="btn primary" data-act="pdfNoteSave">Enregistrer</button></div></div>';
  }
  function sheetVsh(panel) {
    var sh = document.getElementById('pdfToolSheet'), kb = sh ? (parseFloat(sh.style.bottom) || 0) : 0;
    $('#viewer').style.setProperty('--vsh', Math.round(panel.offsetHeight + kb) + 'px');
  }
  function sheetSize(panel, snap) {
    var vh = window.innerHeight;
    if (snap === 'compact') { panel.style.height = ''; panel.style.maxHeight = Math.round(vh * 0.6) + 'px'; }
    else { SHEET.snap = snap; panel.style.maxHeight = ''; panel.style.height = Math.round(vh * (snap === 'full' ? 0.9 : 0.52)) + 'px'; }
    sheetVsh(panel);
  }
  function sheetDrag(panel) {
    var top = panel.querySelector('.pdf-tool-top'), st = null;
    top.addEventListener('pointerdown', function(e) {
      if (e.target.closest('button')) return;
      st = { y: e.clientY, h: panel.offsetHeight, moved: false, id: e.pointerId };
      try { top.setPointerCapture(e.pointerId); } catch (x) {}
      panel.style.transition = 'none';
    });
    top.addEventListener('pointermove', function(e) {
      if (!st || e.pointerId !== st.id) return;
      var dy = e.clientY - st.y;
      if (Math.abs(dy) > 6) st.moved = true;
      if (!st.moved) return;
      panel.style.maxHeight = ''; panel.style.height = Math.max(80, Math.min(window.innerHeight * 0.92, st.h - dy)) + 'px';
      sheetVsh(panel);
    });
    function end(e) {
      if (!st || e.pointerId !== st.id) return;
      var was = st, vh = window.innerHeight, compact = panel.classList.contains('compact'), h = panel.offsetHeight;
      st = null; panel.style.transition = '';
      if (!was.moved) { if (!compact) sheetSize(panel, SHEET.snap === 'full' ? 'half' : 'full'); return; }
      if (h < (compact ? was.h * 0.6 : vh * 0.3)) { returnToPdf(); return; }
      if (compact) { sheetSize(panel, 'compact'); return; }
      sheetSize(panel, h > vh * 0.72 ? 'full' : 'half');
    }
    top.addEventListener('pointerup', end); top.addEventListener('pointercancel', end);
  }
  function sheetKeyboard() {
    var vv = window.visualViewport, sh = document.getElementById('pdfToolSheet');
    if (!vv || !sh) return;
    sh.style.bottom = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) + 'px';
    var pn = sh.querySelector('.pdf-tool-panel'); if (pn) sheetVsh(pn);
  }
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', sheetKeyboard); window.visualViewport.addEventListener('scroll', sheetKeyboard); }
  function openPdfSheet(mode) {
    if (!V.pdf) return;
    if (document.getElementById('pdfToolSheet') && SHEET.mode === mode) { returnToPdf(); return; }
    vrcFlush(); var pr = VRC.pr;
    if (mode === 'note' && !pr) { toast('Ouvrez le PDF depuis un projet en cours pour écrire dans son journal.'); return; }
    if (!S.pdfToolReturn) {
      S.pdfToolReturn = { tab: S.tab, sub: S.sub, curProj: S.curProj, toolSub: S.toolSub, scroll: window.scrollY, tnPj: S.tnPj, projectId: pr ? pr.id : '' };
      S.tnPj = pr ? pr.id : '';
      S.toolSub = '';
    }
    SHEET.mode = mode; SHEET.page = vCurPage();
    vposNow();
    var old = document.getElementById('pdfToolSheet'); if (old) old.remove();
    var sheet = document.createElement('div');
    sheet.id = 'pdfToolSheet'; sheet.className = 'pdf-tool-sheet';
    sheet.innerHTML = '<section class="pdf-tool-panel' + (mode === 'note' ? ' compact' : '') + '" role="dialog" aria-label="' + (mode === 'note' ? 'Note au journal' : 'Outils du PDF') + '"><div class="pdf-tool-top"><div class="pdf-tool-grip"></div><div class="pdf-tool-head" id="pdfToolHead">' + sheetHeadHtml() + '</div></div><div id="pdfToolSheetBody">' + (mode === 'note' ? noteSheetHtml(pr) : viewTools() + toolNoteHtml()) + '</div></section>';
    $('#viewer').appendChild(sheet);
    $('#viewer').classList.add('tools-open');
    var panel = sheet.querySelector('.pdf-tool-panel');
    sheetSize(panel, mode === 'note' ? 'compact' : SHEET.snap);
    sheetDrag(panel);
    if (mode === 'note') { var ta = $('#pdfNoteText'); if (ta) setTimeout(function() { ta.focus(); }, 80); }
  }
  function openPdfTools() { openPdfSheet('tools'); }
  function returnToPdf() {
    var ctx = S.pdfToolReturn; if (!ctx) return;
    var sheet = document.getElementById('pdfToolSheet'); if (sheet) sheet.remove();
    var vw = $('#viewer'); vw.classList.remove('tools-open'); vw.style.removeProperty('--vsh');
    SHEET.mode = '';
    S.toolSub = ctx.toolSub || ''; S.tnPj = ctx.tnPj || ''; S.pdfToolReturn = null;
    render();
    document.body.style.overflow = 'hidden'; vWake(true);
    if (VRC.pr) { $('#vrcV').textContent = VRC.pr.rows || 0; vrcStat(); vrcSubUi(); vrcPlace(load('carnet.vrcPos', null)); }
    syncCounterButton();
  }
  function journalToolProject() {
    var id=S.pdfToolReturn && S.pdfToolReturn.projectId || S.tnPj;
    return S.projects.find(function(p){return p.id===id && pjStageOf(p)==='wip';});
  }
  function vrcFmt(ms) {
    var s = Math.round(ms / 1000);
    if (s < 60) return s + ' s';
    var m = Math.floor(s / 60);
    if (m < 60) return m + ' min' + (m < 10 && s % 60 ? ' ' + String(s % 60).padStart(2, '0') : '');
    return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0');
  }
  function vrcStat() {
    var el = $('#vrcSt'), pr = VRC.pr;
    if (!pr) { el.hidden = true; return; }
    var t = pr.rts || [], iv = [], i;
    for (i = 1; i < t.length; i++) { var d = t[i] - t[i - 1]; if (d > 0 && d < 900000) iv.push(d); }
    var tot = pr.rowsTotal || 0, rows = pr.rows || 0, out = '';
    if (iv.length) {
      var l = iv.slice(-20), avg = l.reduce(function(a, b) { return a + b; }, 0) / l.length;
      out = '⏱ ' + vrcFmt(avg) + ' / rang';
      if (tot > rows) out += ' · reste ≈ ' + vrcFmt(avg * (tot - rows));
      else if (tot) out += ' · terminé 🎉';
    } else if (tot) out = rows + ' / ' + tot + ' rangs';
    el.textContent = out; el.hidden = !out;
  }
  function vrcPlace(pos) {
    var el = $('#vrc'), box = $('#viewer');
    if (!pos || typeof pos.x !== 'number') { el.classList.remove('custom'); el.style.left = el.style.top = ''; return; }
    var W = box.clientWidth, H = box.clientHeight, w = el.offsetWidth, h = el.offsetHeight;
    var x = Math.max(4, Math.min(W - w - 4, pos.x * W)), y = Math.max(4, Math.min(H - h - 4, pos.y * H));
    el.classList.add('custom'); el.style.left = x + 'px'; el.style.top = y + 'px';
  }
  function vrcFlush() { if (VRC.t) { clearTimeout(VRC.t); VRC.t = null; saveProjectsQuiet(); } }
  function vrcClose() {
    var had = !!VRC.pr; vrcFlush(); VRC.pr = null; $('#vrc').hidden = true; $('#vrcMenu').hidden = true; return had;
  }
  function vrcAdd(n) {
    var pr = VRC.pr; if (!pr) return;
    if (!rowsApply(pr, n)) return;
    vrcStat(); vrcSubUi();
    var v = $('#vrcV'), nb = $('#vrcN');
    v.textContent = pr.rows;
    nb.classList.remove('bump'); void nb.offsetWidth; nb.classList.add('bump');
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {}
    clearTimeout(VRC.t); VRC.t = setTimeout(function() { VRC.t = null; saveProjectsQuiet(); }, 600);
  }
  (function() {
    var el = $('#vrc'), menu = $('#vrcMenu'), rst = $('#vrcReset'), sd = null;
    function disarm() { VRC.arm = 0; rst.classList.remove('arm'); rst.textContent = 'Remettre à 0'; }
    el.addEventListener('click', function(e) {
      var b = e.target.closest('[data-r]');
      if (!b) { return; }
      var r = b.dataset.r;
      if (r === 'reset') {
        if (!VRC.arm) { VRC.arm = 1; rst.classList.add('arm'); rst.textContent = 'Appuyer encore pour confirmer'; clearTimeout(VRC.st); VRC.st = setTimeout(disarm, 3000); }
        else { disarm(); vrcAdd(0); menu.hidden = true; }
        return;
      }
      if (r === 'total') {
        menu.hidden = true;
        dlgOpen({ title: 'Nombre de rangs au total', text: 'Sert à estimer le temps restant (0 pour effacer).', input: true, value: VRC.pr && VRC.pr.rowsTotal ? String(VRC.pr.rowsTotal) : '', ok: 'Enregistrer', placeholder: 'ex. 180', check: function(v) { return /^\d{1,5}$/.test(v) ? '' : 'Entrez un nombre.'; } }).then(function(v) {
          if (v == null || !VRC.pr) return;
          VRC.pr.rowsTotal = parseInt(v, 10) || 0; vrcFlush(); saveProjectsQuiet(); vrcStat();
        });
        return;
      }
      if (r === 'note') { menu.hidden = true; openPdfSheet('note'); return; }
      if (r === 'x') { vrcAdd(rowStepX()); menu.hidden = true; return; }
      if (r === 'step') { menu.hidden = true; askStepX().then(function(ok) { if (ok) vrcSubUi(); }); return; }
      if (r === 'goalMenu') { menu.hidden = !menu.hidden; return; }
      if (r === 'goal') {
        menu.hidden = true;
        var gp = VRC.pr; if (!gp) return;
        askGoal(gp).then(function(ok) { if (ok) { saveProjectsQuiet(); vrcSubUi(); toast('Objectif de ' + gp.sub.target + ' rangs enregistré.'); } });
        return;
      }
      if (r === 'goalDrop') {
        menu.hidden = true;
        askConfirm('Abandonner l’objectif ?', 'Ce compteur précis sera supprimé. Vos rangs restent comptés.', 'Abandonner').then(function(y) { if (y && VRC.pr) { VRC.pr.sub = null; saveProjectsQuiet(); vrcSubUi(); } });
        return;
      }
      if (r === 'min') { var m = !el.classList.contains('min'); el.classList.toggle('min', m); keep('carnet.vrcMin', m ? 1 : 0); syncCounterButton(); menu.hidden = true; vrcPlace(load('carnet.vrcPos', null)); return; }
      vrcAdd(parseInt(r, 10));
      if (r === '10' || r === '-10') menu.hidden = true;
    });
    /* le numéro : toucher = options, glisser = déplacer le compteur */
    var nb = $('#vrcN');
    nb.addEventListener('pointerdown', function(e) {
      sd = { x: e.clientX, y: e.clientY, r: el.getBoundingClientRect(), moved: false, id: e.pointerId };
      try { nb.setPointerCapture(e.pointerId); } catch (x) {}
    });
    nb.addEventListener('pointermove', function(e) {
      if (!sd || e.pointerId !== sd.id) return;
      var dx = e.clientX - sd.x, dy = e.clientY - sd.y;
      if (!sd.moved && Math.abs(dx) + Math.abs(dy) < 8) return;
      sd.moved = true; menu.hidden = true;
      var vb = $('#viewer').getBoundingClientRect(), w = sd.r.width, h = sd.r.height;
      var x = Math.max(4, Math.min(vb.width - w - 4, sd.r.left - vb.left + dx)), y = Math.max(4, Math.min(vb.height - h - 4, sd.r.top - vb.top + dy));
      el.classList.add('custom'); el.style.left = x + 'px'; el.style.top = y + 'px';
    });
    function end(e) {
      if (!sd || e.pointerId !== sd.id) return;
      var was = sd; sd = null;
      if (was.moved) {
        var vb = $('#viewer').getBoundingClientRect(), r = el.getBoundingClientRect();
        keep('carnet.vrcPos', { x: (r.left - vb.left) / vb.width, y: (r.top - vb.top) / vb.height });
      } else if (e.type === 'pointerup') { disarm(); if(el.classList.contains('min'))restoreCounter();else menu.hidden = !menu.hidden; }
    }
    nb.addEventListener('keydown',function(e){if(e.key==='Enter' || e.key===' '){e.preventDefault();if(el.classList.contains('min'))restoreCounter();else menu.hidden=!menu.hidden;}});
    nb.addEventListener('pointerup', end); nb.addEventListener('pointercancel', end);
    /* toucher ailleurs ferme le menu */
    $('#vscroll').addEventListener('pointerdown', function() { menu.hidden = true; disarm(); }, { passive: true });
    window.addEventListener('resize', function() { if (VRC.pr) vrcPlace(load('carnet.vrcPos', null)); });
    window.addEventListener('pagehide', vrcFlush);
  })();

  /* ===== Zoom (pincement / Ctrl+molette / boutons sur PC) ===== */
  function vClear(pg) {
    var oc = pg.el.querySelector('canvas');
    if (oc) oc.remove();
    pg.el.style.aspectRatio = pg.ar; pg.done = false;
  }
  function setZoom(z, mx, my) {
    if (!V.pdf) return;
    z = Math.max(0.6, Math.min(4, z));
    if (Math.abs(z - V.zoom) < 0.001) return;
    var box = $('#vscroll'), r = box.getBoundingClientRect();
    if (mx == null) { mx = r.left + r.width / 2; my = r.top + r.height / 2; }
    var cx = mx - r.left, cy = my - r.top;
    var fx = (box.scrollLeft + cx) / Math.max(1, box.scrollWidth), fy = (box.scrollTop + cy) / Math.max(1, box.scrollHeight);
    V.zoom = z; box.style.setProperty('--z', z);
    box.scrollLeft = fx * box.scrollWidth - cx; box.scrollTop = fy * box.scrollHeight - cy;
    clearTimeout(V.zt); V.zt = setTimeout(vRerender, 220);
  }
  function vRerender() {
    if (!V.pdf) return;
    var box = $('#vscroll'), top = box.scrollTop, bot = top + box.clientHeight;
    V.pages.forEach(function(pg) {
      var y = pg.el.offsetTop, h = pg.el.offsetHeight;
      if (y + h < top - 900 || y > bot + 900) vClear(pg); else pg.done = false;
    });
    renderVisible();
  }
  (function() {
    var sc = $('#vscroll'), pz = null;
    function dist(e) { return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
    function mid(e) { return [(e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2]; }
    sc.addEventListener('touchstart', function(e) { if (e.touches.length === 2) { pz = { d: dist(e), z: V.zoom }; V.pinch = 1; } }, { passive: true });
    sc.addEventListener('touchmove', function(e) {
      if (!pz || e.touches.length !== 2) return;
      e.preventDefault();
      var m = mid(e); setZoom(pz.z * dist(e) / pz.d, m[0], m[1]);
    }, { passive: false });
    function end(e) { if (pz && e.touches.length < 2) { pz = null; setTimeout(function() { V.pinch = 0; }, 350); } }
    sc.addEventListener('touchend', end); sc.addEventListener('touchcancel', end);
    sc.addEventListener('wheel', function(e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); setZoom(V.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), e.clientX, e.clientY);
    }, { passive: false });
  })();

  /* ===== Écran allumé pendant la lecture ===== */
  var WL = null;
  async function vWake(on) {
    try {
      if (on) {
        if (!WL && navigator.wakeLock) { WL = await navigator.wakeLock.request('screen'); WL.addEventListener('release', function() { WL = null; }); }
      } else if (WL) { var w = WL; WL = null; await w.release(); }
    } catch (e) { WL = null; }
  }
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible' && V.pdf) vWake(true); });

  /* ===== Repère du rang, surlignage, mode sombre ===== */
  function vTools() {
    $('#vmark').classList.toggle('on', V.tool === 'mark');
    $('#vhl').classList.toggle('on', V.tool === 'hl');
    $('#vmark').setAttribute('aria-pressed', V.tool === 'mark' ? 'true' : 'false');
    $('#vhl').setAttribute('aria-pressed', V.tool === 'hl' ? 'true' : 'false');
    $('#vsm').classList.toggle('on', V.tool === 'sm');
    $('#vsm').setAttribute('aria-pressed', V.tool === 'sm' ? 'true' : 'false');
    $('#vmark').title = V.tool === 'mark' ? 'Repère actif — toucher le PDF pour poser, toucher ici pour annuler' : 'Poser un repère de rang';
    V.dark=0;
    $('#vscroll').className = 'vscroll d' + (V.dark || 0) + (V.tool ? ' tool' : '');
  }
  function vToolSet(t) {
    V.tool = V.tool === t ? '' : t; vTools();
    var msg = {
      mark: ['Repère activé : touchez la ligne où vous en êtes. Il se désactive après la pose.', 'Repère annulé.'],
      hl: ['Surlignage activé : touchez une ligne pour la surligner, touchez-la encore pour l’enlever.', 'Surlignage désactivé.'],
      sm: ['Marqueurs activés : touchez une ligne pour poser un marqueur dans la marge, touchez-le encore pour l’enlever.', 'Marqueurs désactivés.']
    }[t];
    toast(msg[V.tool ? 0 : 1]);
  }
  function vOvPage(i) {
    var pg = V.pages[i], o = pg && pg.el.querySelector('.vov');
    if (!o) return;
    var h = '';
    (V.hl[i] || []).forEach(function(r) { h += '<i class="vhl" style="left:' + r.x0 * 100 + '%;top:' + r.y0 * 100 + '%;width:' + (r.x1 - r.x0) * 100 + '%;height:' + (r.y1 - r.y0) * 100 + '%"></i>'; });
    if (V.mark && V.mark.i === i) h += '<i class="vmk" style="top:' + V.mark.y * 100 + '%"></i>';
    ((V.sm && V.sm[i]) || []).forEach(function(m) { h += '<i class="vsm" style="left:' + m.x * 100 + '%;top:' + m.y * 100 + '%"></i>'; });
    o.innerHTML = h;
  }
  function vOv() { V.pages.forEach(function(pg, i) { vOvPage(i); }); }
  function vRestore() {
    var box = $('#vscroll'), useMark = !!(V.mark && V.pages[V.mark.i]), t = useMark ? V.mark : load('carnet.vpos.' + V.id, null);
    if (!t || !V.pages[t.i]) return;
    var el = V.pages[t.i].el, f = useMark ? V.mark.y : t.f;
    box.scrollTop = Math.max(0, el.offsetTop + f * el.offsetHeight - (useMark ? box.clientHeight * 0.3 : 90));
  }
  function vposNow() {
    if (!V.pdf || !V.pages.length) return;
    var box = $('#vscroll'), ref = box.scrollTop + 90, k = 0;
    V.pages.forEach(function(pg, i) { if (pg.el.offsetTop <= ref) k = i; });
    var el = V.pages[k].el;
    keep('carnet.vpos.' + V.id, { i: k, f: Math.max(0, Math.min(1, (ref - el.offsetTop) / Math.max(1, el.offsetHeight))) });
  }
  function vposSave() { clearTimeout(V.pt); V.pt = setTimeout(vposNow, 600); }
  async function vLine(i, fx, fy) {
    try {
      var page = await V.pdf.getPage(i + 1), v0 = page.getViewport({ scale: 1 }), W = v0.width, H = v0.height;
      var tc = V.tc[i] || (V.tc[i] = await page.getTextContent());
      var its = [];
      tc.items.forEach(function(t) {
        if (!t.str || !t.str.trim()) return;
        var hh = t.height || Math.abs(t.transform[3]) || 10;
        var a = v0.convertToViewportPoint(t.transform[4], t.transform[5]), b = v0.convertToViewportPoint(t.transform[4] + t.width, t.transform[5] + hh);
        var yt = Math.min(a[1], b[1]), yb = Math.max(a[1], b[1]), hv = yb - yt;
        its.push({ x0: Math.min(a[0], b[0]) / W, x1: Math.max(a[0], b[0]) / W, y0: yt / H, y1: (yb + hv * 0.25) / H, m: (yt + hv * 0.6) / H, hh: hv / H });
      });
      var best = null, bd = 1e9;
      its.forEach(function(t) { var d = Math.abs(t.m - fy); if (d < bd) { bd = d; best = t; } });
      if (!best || bd > best.hh * 1.3) return null;
      var row = its.filter(function(t) { return Math.abs(t.m - best.m) < best.hh * 0.5; });
      return {
        x0: Math.max(0, Math.min.apply(null, row.map(function(t) { return t.x0; })) - 0.006),
        x1: Math.min(1, Math.max.apply(null, row.map(function(t) { return t.x1; })) + 0.006),
        y0: Math.min.apply(null, row.map(function(t) { return t.y0; })),
        y1: Math.max.apply(null, row.map(function(t) { return t.y1; }))
      };
    } catch (e) { return null; }
  }
  $('#vscroll').addEventListener('click', function(e) {
    if (!V.tool || V.pinch || !V.pdf) return;
    var el = e.target.closest('.vpage'); if (!el) return;
    var i = V.pages.findIndex(function(pg) { return pg.el === el; }); if (i < 0) return;
    var r = el.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    vLine(i, fx, fy).then(function(L) {
      if (!V.pdf) return;
      if (V.tool === 'mark') {
        var o = V.mark;
        if (o && o.i === i && Math.abs(o.y - fy) < 0.012) { V.mark = null; keep('carnet.vmark.' + V.id, null); vOvPage(i); V.tool='';vTools();toast('Repère retiré · mode désactivé'); return; }
        V.mark = { i: i, y: L ? L.y1 : fy };
        if (o) vOvPage(o.i);
        vOvPage(i); keep('carnet.vmark.' + V.id, V.mark);
        V.tool='';vTools();
        toast('Repère posé et enregistré ✓');
      } else if (V.tool === 'sm') {
        var sa = V.sm[i] = V.sm[i] || [];
        var sx = L ? Math.max(0.012, L.x0 - 0.03) : 0.02, sy = L ? (L.y0 + L.y1) / 2 : fy;
        var sk = sa.findIndex(function(m) { return Math.abs(m.y - sy) < 0.008; });
        if (sk >= 0) { sa.splice(sk, 1); toast('Marqueur retiré.'); } else { sa.push({ x: sx, y: sy }); toast('Marqueur posé dans la marge ✓'); }
        if (!sa.length) delete V.sm[i];
        vOvPage(i); keep('carnet.vsm.' + V.id, V.sm);
      } else {
        var a = V.hl[i] = V.hl[i] || [];
        var k = a.findIndex(function(h) { return fy >= h.y0 && fy <= h.y1 && fx >= h.x0 - 0.02 && fx <= h.x1 + 0.02; });
        if (k >= 0) a.splice(k, 1); else a.push(L || { x0: 0.05, x1: 0.95, y0: Math.max(0, fy - 0.01), y1: fy + 0.012 });
        vOvPage(i); keep('carnet.vhl.' + V.id, V.hl);
      }
    });
  });

  function openP(id) {
    S.cur = id;
    S.tab = 'det';
    S.sub = 'fiche';
    S.editMode = false;
    S.activeSize = '';
    S.delAsk = false;
    S.sim = { sts: '', rows: '' };
    render();
    window.scrollTo(0, 0);
  }

  /* ============ Export & Sauvegarde ============ */
  function brief(p) {
    var f = p.f, b = [];
    b.push('Crée un patron de tricot' + (f.garment ? ' : ' + f.garment.toLowerCase() : '') + (f.target ? ' pour ' + f.target.toLowerCase() : '') + '.');
    var d = [];
    ['silhouette', 'length', 'neckline', 'sleeves', 'sleeve_shape', 'shoulder', 'construction'].forEach(function(k) { if (filled(f[k])) d.push(f[k]); });
    if (d.length) b.push('Coupe : ' + d.join(', ') + '.');
    if (filled(f.ease_cm)) b.push('Aisance au buste : ' + f.ease_cm + ' cm.');
    if ((f.sizes || []).length) b.push('Tailles : ' + f.sizes.join(', ') + '.');
    if (f.gauge_sts && f.gauge_rows) b.push('Échantillon : ' + f.gauge_sts + ' mailles et ' + f.gauge_rows + ' rangs pour 10 cm.');
    return b.join(' ');
  }

  function photoFile(ph) { return 'photos/' + ph.id + '.jpg'; }
  function selected() { return S.patterns.filter(function(p) { return !S.exp.valid || p.status === 'validé'; }); }

  function buildFiles() {
    var ps = selected(), f = {};
    f['patterns.jsonl'] = ps.map(function(p) {
      var c = proc(p);
      return JSON.stringify({
        id: p.id, title: p.title, status: p.status, stage: stageOf(p), folder: p.folder || null, source: p.source,
        fields: p.f, options: p.opts || [], measures: p.g.measures, counts: p.g.counts,
        photos: (p.photos || []).map(function(x) { return { id: x.id, file: photoFile(x), kind: x.kind }; }),
        raw: p.raw || '', text: c.clean, chunks: c.chunks
      });
    }).join('\n');

    f['chunks.jsonl'] = ps.flatMap(function(p) {
      return proc(p).chunks.map(function(c) {
        return JSON.stringify({
          pattern_id: p.id, chunk: c.i, section: c.section, text: c.text, words: c.words,
          garment: p.f.garment || null, sizes: p.f.sizes || [], language: p.f.language || null
        });
      });
    }).join('\n');

    f['finetune.jsonl'] = ps.filter(function(p) { return (p.raw || '').trim(); }).map(function(p) {
      var imgs = (p.photos || []).filter(function(x) { return x.kind !== 'fini'; }).map(photoFile);
      return JSON.stringify({
        messages: [{ role: 'user', content: brief(p) }, { role: 'assistant', content: proc(p).clean }],
        images: imgs,
        finished_images: (p.photos || []).filter(function(x) { return x.kind === 'fini'; }).map(photoFile)
      });
    }).join('\n');

    f['documentation.json'] = JSON.stringify(S.docs, null, 2);
    f['idees.json'] = JSON.stringify({ ideas: S.ideas, boards: S.boards, scratchpad: S.scratchpad }, null, 2);
    return f;
  }

  function downloadBlob(filename, data) {
    try {
      var blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { if(a.isConnected)a.remove(); URL.revokeObjectURL(url); }, 300000);
      return true;
    } catch (e) { toast('Téléchargement impossible.'); return false; }
  }

  async function exportZip() {
    try { await needZip(); } catch (e) { toast('Module ZIP indisponible (connexion requise la première fois).'); return; }
    S.busy = 'Préparation de l\'archive complète…';
    render();
    try {
      var files = buildFiles(), z = new JSZip();
      Object.keys(files).forEach(function(k) { z.file(k, files[k]); });
      if (S.exp.photos) {
        var ids = {};
        selected().forEach(function(p) { (p.photos || []).forEach(function(x) { ids[x.id] = 1; }); });
        var idList = Object.keys(ids);
        for (var i = 0; i < idList.length; i++) {
          var bl = await loadBlob(idList[i]);
          if (bl) z.file('photos/' + idList[i] + '.jpg', bl);
        }
      }
      var blob = await z.generateAsync({ type: 'blob' });
      S.busy = '';
      render();
      if (downloadBlob('atelier-tricot-sauvegarde.zip', blob)) toast('Archive complète téléchargée !');
    } catch (e) {
      S.busy = '';
      render();
      toast('Erreur lors de la création de l\'archive.');
    }
  }

  function mergeById(cur, inc) {
    var out = (cur || []).slice();
    (inc || []).forEach(function(x) {
      var i = x && x.id ? out.findIndex(function(y) { return y.id === x.id; }) : -1;
      if (i >= 0) out[i] = x; else out.push(x);
    });
    return out;
  }
  async function shareOrDownload(name, blob, type) {
    try {
      var file = new File([blob], name, { type: type || 'application/zip' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return true;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
    return downloadBlob(name, blob);
  }
  var backupRunning=false, backupArtifact=null;
  var ZIP_CRC_TABLE=(function(){var a=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;a[n]=c>>>0;}return a;})();
  async function zipCrc(blob) {
    var crc=0xffffffff;
    for(var off=0;off<blob.size;off+=1048576) {
      var bytes=new Uint8Array(await blob.slice(off,off+1048576).arrayBuffer());
      for(var i=0;i<bytes.length;i++) crc=ZIP_CRC_TABLE[(crc^bytes[i])&255]^(crc>>>8);
    }
    return (crc^0xffffffff)>>>0;
  }
  async function buildStoredZip(entries,onprogress) {
    if(entries.length>65535) throw new Error('Trop de fichiers pour un ZIP standard.');
    var parts=[],central=[],offset=0,centralSize=0,encoder=new TextEncoder(),d=new Date();
    var date=((Math.max(1980,d.getFullYear())-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
    var time=(d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2);
    for(var i=0;i<entries.length;i++) {
      var en=entries[i],bl=en.blob,name=encoder.encode(en.name);
      if(bl.size>=0xffffffff || offset+bl.size+30+name.length>=0xffffffff) throw new Error('Archive supérieure à la limite de 4 Go. Exportez par lots.');
      var crc=await zipCrc(bl),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);
      v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(10,time,true);v.setUint16(12,date,true);
      v.setUint32(14,crc,true);v.setUint32(18,bl.size,true);v.setUint32(22,bl.size,true);v.setUint16(26,name.length,true);h.set(name,30);
      var ch=new Uint8Array(46+name.length),cv=new DataView(ch.buffer);
      cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(12,time,true);cv.setUint16(14,date,true);
      cv.setUint32(16,crc,true);cv.setUint32(20,bl.size,true);cv.setUint32(24,bl.size,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);ch.set(name,46);
      parts.push(h,bl);central.push(ch);centralSize+=ch.length;offset+=h.length+bl.size;
      if(onprogress) onprogress(i+1,entries.length,en.name);
      await new Promise(function(r){setTimeout(r,0);});
    }
    if(offset+centralSize+22>=0xffffffff) throw new Error('Archive trop volumineuse pour ce format ZIP.');
    var end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
    return new Blob(parts.concat(central,[end]),{type:'application/zip'});
  }
  var BACKUP_PART_BYTES = 200 * 1048576; /* taille max d'une partie du ZIP (200 Mo) */
  var BACKUP_LABELS = {pdf_:'PDF',img_:'photos',th_:'miniatures',docm_:'médias doc',pjc_:'photos projets',pjp_:'photos projets',wall_:'fonds',idea_:'idées',inspo_:'inspiration'};
  function bkSize(n) {return n>=1073741824 ? (n/1073741824).toFixed(1).replace('.',',')+' Go' : Math.max(1,Math.round(n/1048576))+' Mo';}
  function bkPad(n) {return (n<10?'0':'')+n;}
  function backupPanel(text,ready) {
    var el=document.getElementById('backupPanel'),A=backupArtifact;
    if(!el) {el=document.createElement('div');el.id='backupPanel';el.className='backup-panel';document.body.appendChild(el);}
    var multi=!!(A && A.parts && A.parts.length>1),last=!multi || A.idx>=A.parts.length-1,tag=multi?' (partie '+(A.idx+1)+'/'+A.parts.length+')':'',btns='';
    if(ready) {
      btns='<button class="btn primary" data-act="backupDownload">Télécharger le ZIP'+tag+'</button><button class="btn" data-act="backupShare">Partager / Enregistrer dans Fichiers'+tag+'</button>';
      if(multi && !last) btns+='<button class="btn" data-act="backupNext">Préparer la partie suivante ('+(A.idx+2)+'/'+A.parts.length+')</button>';
      btns+='<p class="sub">'+(multi ? 'La sauvegarde est découpée en '+A.parts.length+' fichiers : enregistrez chaque partie, puis préparez la suivante. Pour restaurer, sélectionnez toutes les parties ensemble (ou une par une, en commençant par la partie 1).' : 'La préparation est terminée. Touchez un bouton puis vérifiez que le fichier est bien enregistré. Aucun enregistrement automatique sur votre appareil ne peut être garanti.')+'</p><button class="btn small" data-act="backupClose">Fermer</button>';
    }
    el.innerHTML='<div class="card stack"><h2>Sauvegarde ZIP complète</h2><p id="backupProgress" role="status">'+esc(text)+'</p>'+btns+'</div>';
  }
  function backupProgress(text) {var el=document.getElementById('backupProgress');if(el)el.textContent=text;}
  async function backupBuildPart(i) {
    var A=backupArtifact,P=A.parts[i],types={},multi=A.parts.length>1,list=(i===0?[A.dataEntry]:[]);
    P.items.forEach(function(it) {types[it.key]=it.blob.type||'';list.push({name:it.name,blob:it.blob});});
    list.push({name:'types.json',blob:new Blob([JSON.stringify(types)],{type:'application/json'})});
    A.blob=null; /* libère la partie précédente */
    var out=await buildStoredZip(list,function(k,n){backupProgress('Création '+(multi?'de la partie '+(i+1)+'/'+A.parts.length:'du ZIP')+' : '+Math.round(k/n*100)+' %');});
    A.idx=i;A.blob=out;
    A.name='carnet-sauvegarde-'+A.stamp+(multi?'-partie-'+bkPad(i+1)+'-sur-'+bkPad(A.parts.length):'')+'.zip';
    var msg='ZIP prêt : '+bkSize(out.size)+(multi?' (partie '+(i+1)+' sur '+A.parts.length+')':'')+'.';
    if(i===0) msg+=' Total des fichiers : '+bkSize(A.totalBytes)+(A.detail?' — '+A.detail:'')+'.';
    backupPanel(msg+' Choisissez où le conserver.',true);
  }
  async function backupNext() {
    var A=backupArtifact;
    if(!A || backupRunning || A.idx>=A.parts.length-1)return;
    backupRunning=true;
    try {await backupBuildPart(A.idx+1);}
    catch(e) {backupPanel('Échec : '+(e.message||'erreur inconnue')+'.',false);document.getElementById('backupPanel').querySelector('.card').insertAdjacentHTML('beforeend','<button class="btn" data-act="backupClose">Fermer</button>');console.error(e);}
    finally {backupRunning=false;}
  }
  async function fullBackup() {
    if(backupRunning) {toast('Une sauvegarde est déjà en préparation.');return;}
    if(S.importRunning) {toast('Attendez la fin de l’import avant la sauvegarde complète.');return;}
    if(backupArtifact) {backupPanel('Un ZIP est déjà prêt. Téléchargez-le ou fermez ce panneau pour en préparer un nouveau.',true);return;}
    backupRunning=true;backupPanel('Lecture des données et des fichiers…',false);
    try {
      // Export also works if the browser can no longer persist the catalog.
      try {await persistNow();} catch(e) {console.warn('Export de secours depuis la mémoire',e);}
      var data={v:1,at:Date.now(),patterns:S.patterns.map(lite),folders:S.folders,projects:S.projects,grids:S.grids,docs:S.docs,ideas:S.ideas,boards:S.boards,scratchpad:S.scratchpad,ui:{wallpaperId:S.ui.wallpaperId||'',stats:S.ui.stats||null,island:S.ui.island||null}};
      data.viewer = {}; try { for (var ki = 0; ki < localStorage.length; ki++) { var kk = localStorage.key(ki); if (/^carnet\.(vhl|vmark|vsm|vpos)\./.test(kk)) data.viewer[kk] = load(kk, null); } } catch (e) {}
      var keys=Array.from(new Set((await IDB.keys()).concat(Array.from(blobs.keys())))).filter(function(k){return !String(k).startsWith('meta_');});
      var required=new Set();
      function refs(x,key) {
        if(!x)return;
        if(typeof x==='string') {if(/^(pdf_|img_|th_|docm_|pjc_|pjp_|wall_|idea_|inspo_)/.test(x) && !['raw','text','content','note','name','title','file'].includes(key))required.add(x);return;}
        if(Array.isArray(x))x.forEach(function(y){refs(y,key);});else if(typeof x==='object')Object.keys(x).forEach(function(k){refs(x[k],k);});
      }
      refs(data,'');
      required.forEach(function(k){if(!keys.includes(k))throw new Error('Fichier référencé manquant : '+k);});
      var items=[],sizes={},total=0;
      for(var i=0;i<keys.length;i++) {
        backupProgress('Lecture des fichiers : '+(i+1)+' / '+keys.length);
        var bl=blobs.get(keys[i]) || await IDB.get(keys[i]);
        if(!bl) {if(required.has(keys[i]))throw new Error('Fichier illisible : '+keys[i]);continue;}
        if(!(bl instanceof Blob))throw new Error('Contenu non reconnu : '+keys[i]);
        items.push({name:'blobs/'+keys[i],blob:bl,key:keys[i]});
        var pf=(String(keys[i]).match(/^[a-z]+_/)||['autre'])[0];
        if(!sizes[pf])sizes[pf]=[0,0];
        sizes[pf][0]+=bl.size;sizes[pf][1]++;total+=bl.size;
      }
      /* découpe en parties de 200 Mo maximum (un fichier plus gros reste seul dans sa partie) */
      var parts=[],curP={items:[],size:0};
      items.forEach(function(it) {
        if(curP.items.length && curP.size+it.blob.size>BACKUP_PART_BYTES) {parts.push(curP);curP={items:[],size:0};}
        curP.items.push(it);curP.size+=it.blob.size;
      });
      parts.push(curP);
      var detail=Object.keys(sizes).sort(function(a,b){return sizes[b][0]-sizes[a][0];}).slice(0,4).map(function(k){return (BACKUP_LABELS[k]||k)+' '+bkSize(sizes[k][0])+' ('+sizes[k][1]+')';}).join(' · ');
      var stamp=new Date().toISOString().replace(/[:.]/g,'-');
      backupArtifact={parts:parts,idx:0,stamp:stamp,dataEntry:{name:'data.json',blob:new Blob([JSON.stringify(data)],{type:'application/json'})},blob:null,name:'',totalBytes:total,detail:detail,done:{}};
      await backupBuildPart(0);
    } catch(e) {
      backupArtifact=null;
      backupPanel('Échec : '+(e.message||'erreur inconnue')+'. Aucun ZIP complet n’a été annoncé comme enregistré.',false);
      document.getElementById('backupPanel').querySelector('.card').insertAdjacentHTML('beforeend','<button class="btn" data-act="backupClose">Fermer</button>');
      console.error(e);
    } finally {backupRunning=false;}
  }
  function backupMarkDone() {
    var A=backupArtifact;if(!A)return;
    A.done[A.idx]=true;
    if(Object.keys(A.done).length>=A.parts.length)keep('carnet.lastBackup',Date.now());
  }
  function backupDownload() {
    var A=backupArtifact;
    if(!A||!A.blob)return;
    if(downloadBlob(A.name,A.blob)) {backupMarkDone();backupProgress('Téléchargement demandé. Vérifiez le fichier dans vos téléchargements ou Fichiers.');}
  }
  async function backupShare() {
    var A=backupArtifact;
    if(!A||!A.blob)return;
    try {
      var f=new File([A.blob],A.name,{type:'application/zip'});
      if(navigator.share && navigator.canShare && navigator.canShare({files:[f]})) {
        await navigator.share({files:[f],title:'Sauvegarde du carnet'});backupMarkDone();backupProgress('Partage terminé. Vérifiez que le fichier est conservé dans Fichiers.');
      } else backupDownload();
    } catch(e) {if(e.name!=='AbortError')backupProgress('Partage impossible : '+e.message+'. Essayez « Télécharger le ZIP ».');}
  }
  async function restoreBlobsFrom(zipObj) {
    var types = {};
    if (zipObj.file('types.json')) types = JSON.parse(await zipObj.file('types.json').async('string'));
    var names = [];
    zipObj.folder('blobs').forEach(function(rel, entry) { if (!entry.dir) names.push(rel); });
    for (var i = 0; i < names.length; i++) {
      var raw = await zipObj.file('blobs/' + names[i]).async('blob');
      var ty = types[names[i]] || (names[i].indexOf('pdf_') === 0 ? 'application/pdf' : 'image/jpeg');
      await saveBlob(names[i], new Blob([raw], { type: ty }));
    }
    return names.length;
  }
  async function restoreFull(zipObj) {
    var data = JSON.parse(await zipObj.file('data.json').async('string'));
    await restoreBlobsFrom(zipObj);
    S.patterns = mergeById(S.patterns, data.patterns);
    S.folders = mergeById(S.folders, data.folders);
    S.projects = mergeById(S.projects, data.projects);
    migratePjV32();
    saveProjects();
    S.grids = mergeById(S.grids, data.grids);
    saveGrids();
    S.docs = mergeById(S.docs, data.docs);
    S.ideas = mergeById(S.ideas, data.ideas);
    if (data.boards) { S.boards = mergeById(S.boards, data.boards); saveBoards(); }
    if (data.scratchpad && !S.scratchpad) { S.scratchpad = data.scratchpad; keep('carnet.scratchpad', S.scratchpad); }
    if (data.ui && data.ui.stats && !S.ui.stats) { S.ui.stats = data.ui.stats; saveUiCfg(); }
    if (data.ui && data.ui.island && !S.ui.island) { S.ui.island = data.ui.island; saveUiCfg(); }
    if (data.ui && data.ui.wallpaperId && !S.ui.wallpaperId) { S.ui.wallpaperId = data.ui.wallpaperId; saveUiCfg(); }
    if (data.viewer && typeof data.viewer === 'object') Object.keys(data.viewer).forEach(function(k) { if (/^carnet\.(vhl|vmark|vsm|vpos)\./.test(k) && load(k, null) == null) keep(k, data.viewer[k]); });
    saveFolders(); saveDocs(); saveIdeas(); persist();
    thumbTried = {};
  }
  async function restoreParts(list) {
    S.busy = 'Restauration en cours…';
    render();
    try {
      await needZip();
      list = list.slice().sort(function(a, b) { return a.name.localeCompare(b.name); });
      var full = false, nb = 0;
      for (var i = 0; i < list.length; i++) {
        S.busy = 'Restauration : partie ' + (i + 1) + ' / ' + list.length + '…';
        render();
        var z = await JSZip.loadAsync(list[i]);
        if (z.file('data.json')) { await restoreFull(z); full = true; }
        else nb += await restoreBlobsFrom(z);
        z = null;
      }
      thumbTried = {};
      S.busy = '';
      render();
      toast(full ? 'Sauvegarde complète restaurée : patrons, PDF et photos.' : nb + ' fichier(s) restauré(s). Restaurez aussi la partie 1, qui contient les patrons.');
    } catch (e) {
      S.busy = '';
      render();
      toast('Fichier invalide.');
      console.error(e);
    }
  }
  async function restoreBackup(arg) {
    var list = Array.isArray(arg) ? arg : [arg], file = list[0];
    if (list.length > 1 || /-partie-\d+-sur-\d+/i.test(file.name || '')) { return restoreParts(list); }
    S.busy = 'Restauration en cours…';
    render();
    try {
      var jsonlText = '';
      var zipObj = null;
      if (/\.zip$/i.test(file.name)) {
        await needZip(); zipObj = await JSZip.loadAsync(file);
        if (zipObj.file('data.json')) {
          await restoreFull(zipObj);
          S.busy = '';
          render();
          toast('Sauvegarde complète restaurée : patrons, PDF et photos.');
          return;
        }
        var entry = zipObj.file('patterns.jsonl');
        if (entry) jsonlText = await entry.async('string');
        var docEntry = zipObj.file('documentation.json');
        if (docEntry) { S.docs = JSON.parse(await docEntry.async('string')); saveDocs(); }
        var ideaEntry = zipObj.file('idees.json');
        if (ideaEntry) {
          var idData = JSON.parse(await ideaEntry.async('string'));
          if (idData.ideas) { S.ideas = idData.ideas; saveIdeas(); }
          if (idData.boards) { S.boards = idData.boards; saveBoards(); }
          if (typeof idData.scratchpad === 'string') { S.scratchpad = idData.scratchpad; keep('carnet.scratchpad', S.scratchpad); }
        }
      } else {
        jsonlText = await file.text();
      }
      if (jsonlText) {
        var lines = jsonlText.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
        for (var i = 0; i < lines.length; i++) {
          var rec = JSON.parse(lines[i]);
          if (!rec || !rec.id) continue;
          var photos = [];
          if (Array.isArray(rec.photos)) {
            for (var j = 0; j < rec.photos.length; j++) {
              var ph = rec.photos[j];
              var phId = ph.id || 'img_' + uid();
              if (zipObj && ph.file && zipObj.file(ph.file)) {
                await saveBlob(phId, await zipObj.file(ph.file).async('blob'));
              }
              photos.push({ id: phId, kind: ph.kind || 'modele' });
            }
          }
          var pat = {
            id: rec.id, title: rec.title || 'Patron restauré', created: rec.created || Date.now(),
            status: rec.status || 'brouillon', stage: rec.stage || undefined, folder: rec.folder || undefined, source: rec.source || {},
            raw: rec.raw || rec.text || '', f: rec.fields || {},
            g: { measures: rec.measures || {}, counts: rec.counts || {} },
            photos: photos, ai: {}, ev: {}, gai: {}, opts: rec.options || []
          };
          var idx = S.patterns.findIndex(function(x) { return x.id === pat.id; });
          if (idx >= 0) S.patterns[idx] = pat;
          else S.patterns.unshift(pat);
        }
        persist();
      }
      S.busy = '';
      render();
      toast('Sauvegarde restaurée avec succès !');
    } catch (e) {
      S.busy = '';
      render();
      toast('Fichier invalide.');
    }
  }

  /* ============ Outils Tricot : 1) Calculateur de Rangs Raccourcis & 2) Convertisseur d'échantillon ============ */
  function computeShortRows() {
    var total = Math.max(4, parseInt(S.sr.totalSts, 10) || 60);
    var centre = Math.max(0, Math.min(total - 4, parseInt(S.sr.centreSts, 10) || 20));
    var turns = Math.max(1, Math.min(30, parseInt(S.sr.turns, 10) || 4));
    var sideSts = total - centre;
    var sideEach = Math.floor(sideSts / 2);
    var remSide = sideSts % 2;

    if (sideEach < turns) {
      return { error: 'Pas assez de mailles sur les côtés (' + sideEach + ' m. par côté) pour effectuer ' + turns + ' allers-retours. Réduisez les mailles centrales ou le nombre de tours.' };
    }

    var baseStep = Math.floor(sideEach / turns);
    var extra = sideEach % turns;
    var segments = [];
    for (var i = 0; i < turns; i++) {
      segments.push(baseStep + (i < extra ? 1 : 0));
    }

    var methodNames = {
      gSR: { name: 'Rangs raccourcis à l\'allemande (German Short Rows)', turn: 'tourner l\'ouvrage et faire une maille double (DS)', resolve: 'tricoter les 2 brins de la maille double ensemble' },
      wnt: { name: 'Enrouler et tourner (Wrap & Turn)', turn: 'enrouler la maille suivante (W&T) et tourner', resolve: 'relever le fil enroulé et le tricoter ensemble avec sa maille' },
      shadow: { name: 'Rangs raccourcis japonais / Shadow Wraps', turn: 'faire une maille jumelle (Shadow Wrap) et tourner', resolve: 'tricoter les deux boucles de la maille jumelle ensemble' }
    };
    var mInfo = methodNames[S.sr.method] || methodNames.gSR;

    var steps = [];
    var cActual = centre + remSide;
    if (S.sr.dir === 'topdown') {
      steps.push('Rang d\'installation (Endroit) : tricoter jusqu\'au marqueur central, tricoter les ' + cActual + ' mailles centrales, puis tricoter ' + segments[0] + ' m., ' + mInfo.turn + '.');
      steps.push('Rang 2 (Envers) : tricoter jusqu\'au marqueur central, tricoter les ' + cActual + ' mailles centrales, puis tricoter ' + segments[0] + ' m., ' + mInfo.turn + '.');
      var cum = segments[0];
      for (var t = 1; t < turns; t++) {
        cum += segments[t];
        steps.push('Aller-retour ' + (t + 1) + ' (Endroit) : tricoter jusqu\'au point de tour précédent, ' + mInfo.resolve + ', tricoter ' + segments[t] + ' m. supplémentaires (' + cum + ' m. depuis le centre), ' + mInfo.turn + '.');
        steps.push('Aller-retour ' + (t + 1) + ' (Envers) : tricoter jusqu\'au point de tour précédent, ' + mInfo.resolve + ', tricoter ' + segments[t] + ' m. supplémentaires (' + cum + ' m. depuis le centre), ' + mInfo.turn + '.');
      }
      steps.push('Rang de finition : tricoter jusqu\'au bout du rang en résolvant le dernier point de tour (' + mInfo.resolve + '), puis au rang suivant résoudre le dernier point de tour de l\'autre côté.');
    } else {
      var startPos = total - segments[0];
      steps.push('Rang 1 (Endroit) : tricoter ' + startPos + ' m. (laisser ' + segments[0] + ' m. non tricotées à la fin), ' + mInfo.turn + '.');
      var inner = startPos - segments[0];
      steps.push('Rang 2 (Envers) : tricoter ' + inner + ' m. (laisser ' + segments[0] + ' m. non tricotées de l\'autre côté), ' + mInfo.turn + '.');
      for (var k = 1; k < turns; k++) {
        inner -= segments[k];
        steps.push('Aller-retour ' + (k + 1) + ' (Endroit) : tricoter ' + inner + ' m. (s\'arrêter ' + segments[k] + ' m. avant le point de tour précédent), ' + mInfo.turn + '.');
        inner -= segments[k];
        steps.push('Aller-retour ' + (k + 1) + ' (Envers) : tricoter ' + inner + ' m. (s\'arrêter ' + segments[k] + ' m. avant le point de tour précédent), ' + mInfo.turn + '.');
      }
      steps.push('Finition : reprendre le tricot sur toutes les mailles en résolvant chaque point de tour (' + mInfo.resolve + ') au passage.');
    }

    return {
      total: total,
      centre: cActual,
      sideEach: sideEach,
      segments: segments,
      methodName: mInfo.name,
      steps: steps
    };
  }

  function viewToolShortRows() {
    var res = computeShortRows();
    var sr = S.sr;
    return '<div class="stack">' +
      '<div class="card stack">' +
      '<p class="sub">Calculez automatiquement la répartition symétrique de vos rangs raccourcis (encolure dos, épaules tombantes, bas du dos) avec instructions rang par rang.</p>' +
      '<div class="row">' +
      '<label class="fl grow"><span class="n">Nombre total de mailles</span><input class="in" type="number" inputmode="numeric" data-sr="totalSts" value="' + sr.totalSts + '"></label>' +
      '<label class="fl grow"><span class="n">Mailles centrales (repos)</span><input class="in" type="number" inputmode="numeric" data-sr="centreSts" value="' + sr.centreSts + '"></label>' +
      '</div>' +
      '<div class="row">' +
      '<label class="fl grow"><span class="n">Allers-retours par côté</span><input class="in" type="number" inputmode="numeric" data-sr="turns" value="' + sr.turns + '"></label>' +
      '<label class="fl grow"><span class="n">Sens du tricot</span><select class="in" data-sr="dir">' +
      '<option value="topdown"' + (sr.dir === 'topdown' ? ' selected' : '') + '>Du centre vers les côtés (ex. encolure)</option>' +
      '<option value="bottomup"' + (sr.dir === 'bottomup' ? ' selected' : '') + '>Des côtés vers le centre (ex. épaules)</option>' +
      '</select></label>' +
      '</div>' +
      '<label class="fl"><span class="n">Technique de rangs raccourcis</span><select class="in" data-sr="method">' +
      '<option value="gSR"' + (sr.method === 'gSR' ? ' selected' : '') + '>Rangs raccourcis à l\'allemande (German Short Rows)</option>' +
      '<option value="wnt"' + (sr.method === 'wnt' ? ' selected' : '') + '>Enrouler et tourner (Wrap & Turn)</option>' +
      '<option value="shadow"' + (sr.method === 'shadow' ? ' selected' : '') + '>Rangs raccourcis japonais (Shadow Wraps)</option>' +
      '</select></label>' +
      '</div>' +
      '<div id="srRes">' + (res.error ? '<div class="note bad">' + esc(res.error) + '</div>' :
        '<div class="card stack">' +
        '<div class="row"><h2 class="grow">Répartition calculée</h2><button class="btn small" data-act="copySr">Copier les instructions</button></div>' +
        '<div class="chips">' +
        '<span class="chip">Centre : ' + res.centre + ' m.</span>' +
        '<span class="chip">Chaque côté : ' + res.sideEach + ' m.</span>' +
        '<span class="chip ok">Segments : ' + res.segments.join(' - ') + ' m.</span>' +
        '</div>' +
        '<div class="stack" style="gap:8px;margin-top:4px">' +
        res.steps.map(function(st, idx) {
          return '<div class="chunk"><small>Étape ' + (idx + 1) + '</small><span>' + esc(st) + '</span></div>';
        }).join('') +
        '</div>' +
        '</div>') + '</div>' +
      '</div>';
  }

  function patchFrom(html, id) {
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    var n = tmp.querySelector('#' + id), c = document.getElementById(id);
    if (n && c) c.innerHTML = n.innerHTML;
  }

  function viewToolGauge() {
    var gc = S.gaugeCalc;
    var pSts = parseFloat(gc.patSts) || 0;
    var pRows = parseFloat(gc.patRows) || 0;
    var mSts = parseFloat(gc.mySts) || 0;
    var mRows = parseFloat(gc.myRows) || 0;
    var val = parseFloat(gc.val) || 0;

    var resHtml = '';
    if (gc.mode === 'sts') {
      if (pSts > 0 && mSts > 0 && val > 0) {
        var cm = (val / pSts) * 10;
        var adjSts = Math.round((val * mSts) / pSts);
        var diffPct = Math.round(((mSts - pSts) / pSts) * 100);
        resHtml = '<div class="calc-res">' +
          '<span class="sub" style="color:var(--ink)">Nombre de mailles ajusté pour votre échantillon :</span>' +
          '<div class="big">' + adjSts + ' mailles <span class="sub" style="font-weight:400">(au lieu de ' + val + ' m.)</span></div>' +
          '<span class="sub">Largeur correspondante : <b>' + cm.toFixed(1) + ' cm</b> · Écart d\'échantillon : ' + (diffPct > 0 ? '+' : '') + diffPct + ' %</span>' +
          '</div>';
      } else {
        resHtml = '<div class="note info">Saisissez les mailles pour 10 cm des deux échantillons et le nombre de mailles du patron.</div>';
      }
    } else if (gc.mode === 'rows') {
      if (pRows > 0 && mRows > 0 && val > 0) {
        var cmR = (val / pRows) * 10;
        var adjRows = Math.round((val * mRows) / pRows);
        var diffPctR = Math.round(((mRows - pRows) / pRows) * 100);
        resHtml = '<div class="calc-res">' +
          '<span class="sub" style="color:var(--ink)">Nombre de rangs ajusté pour votre échantillon :</span>' +
          '<div class="big">' + adjRows + ' rangs <span class="sub" style="font-weight:400">(au lieu de ' + val + ' rgs)</span></div>' +
          '<span class="sub">Hauteur correspondante : <b>' + cmR.toFixed(1) + ' cm</b> · Écart d\'échantillon : ' + (diffPctR > 0 ? '+' : '') + diffPctR + ' %</span>' +
          '</div>';
      } else {
        resHtml = '<div class="note info">Saisissez les rangs pour 10 cm des deux échantillons et le nombre de rangs du patron.</div>';
      }
    } else {
      if (mSts > 0 && val > 0) {
        var targetSts = Math.round((val * mSts) / 10);
        var targetRows = mRows > 0 ? Math.round((val * mRows) / 10) : 0;
        resHtml = '<div class="calc-res">' +
          '<span class="sub" style="color:var(--ink)">Pour obtenir <b>' + val + ' cm</b> avec votre échantillon :</span>' +
          '<div class="big">' + targetSts + ' mailles' + (targetRows ? ' · ' + targetRows + ' rangs' : '') + '</div>' +
          (pSts > 0 ? '<span class="sub">À titre comparatif, le patron prévoit ' + Math.round((val * pSts) / 10) + ' mailles pour cette mesure.</span>' : '') +
          '</div>';
      } else {
        resHtml = '<div class="note info">Saisissez votre échantillon et la mesure souhaitée en centimètres.</div>';
      }
    }

    var modeLabels = {
      sts: 'Mailles du patron à convertir',
      rows: 'Rangs du patron à convertir',
      cm: 'Mesure souhaitée (en cm)'
    };

    return '<div class="stack">' +
      '<div class="card stack">' +
      '<p class="sub">Adaptez n\'importe quel patron à votre propre échantillon (multi-gauge) ou calculez le nombre de mailles et de rangs pour une mesure donnée.</p>' +
      '<div class="row">' +
      '<div class="stack grow" style="gap:8px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--bg)">' +
      '<h3>Échantillon du patron (10×10 cm)</h3>' +
      '<div class="row">' +
      '<label class="fl grow"><span class="n">Mailles</span><input class="in" type="number" inputmode="decimal" step="any" data-gc="patSts" value="' + gc.patSts + '"></label>' +
      '<label class="fl grow"><span class="n">Rangs</span><input class="in" type="number" inputmode="decimal" step="any" data-gc="patRows" value="' + gc.patRows + '"></label>' +
      '</div></div>' +
      '<div class="stack grow" style="gap:8px;padding:10px;border:1px solid var(--accent);border-radius:12px;background:var(--bg)">' +
      '<h3>Votre échantillon (10×10 cm)</h3>' +
      '<div class="row">' +
      '<label class="fl grow"><span class="n">Mailles</span><input class="in" type="number" inputmode="decimal" step="any" data-gc="mySts" value="' + gc.mySts + '"></label>' +
      '<label class="fl grow"><span class="n">Rangs</span><input class="in" type="number" inputmode="decimal" step="any" data-gc="myRows" value="' + gc.myRows + '"></label>' +
      '</div></div>' +
      '</div>' +
      '<label class="fl"><span class="n">Que souhaitez-vous calculer ?</span><select class="in" data-gc="mode">' +
      '<option value="sts"' + (gc.mode === 'sts' ? ' selected' : '') + '>Convertir un nombre de mailles du patron</option>' +
      '<option value="rows"' + (gc.mode === 'rows' ? ' selected' : '') + '>Convertir un nombre de rangs du patron</option>' +
      '<option value="cm"' + (gc.mode === 'cm' ? ' selected' : '') + '>Calculer mailles / rangs depuis une mesure en cm</option>' +
      '</select></label>' +
      '<label class="fl"><span class="n">' + modeLabels[gc.mode] + '</span><input class="in" type="number" inputmode="decimal" step="any" data-gc="val" value="' + gc.val + '"></label>' +
      '<div id="gcRes">' + resHtml + '</div>' +
      '</div></div>';
  }

  /* ---- Outil : patron sur mesure depuis une photo ---- */
  function even(n) { return Math.round(n / 2) * 2; }
  function viewToolRag() {
    var g = S.rg, res = g.res;
    var garments = ['Pull', 'Cardigan', 'Gilet sans manches', 'Top / débardeur', 'Robe', 'Jupe', 'Pantalon / short', 'Bonnet', 'Écharpe / snood', 'Châle', 'Chaussettes', 'Mitaines / gants', 'Couverture', 'Sac', 'Autre'];
    var out = '';
    if (res) {
      var refs = S.patterns.filter(function(p) { return !res.garment || p.f.garment === res.garment; }).slice(0, 6);
      out = '<div class="card stack"><h3>Résultat</h3>' +
        '<div class="note info"><div>Calcul simple à partir de votre échantillon. La lecture automatique de la photo par IA n\'est pas branchée dans cet outil : choisissez vous-même le type de pièce et les dimensions.</div></div>' +
        '<div class="card stack" style="gap:6px;font-variant-numeric:tabular-nums">' +
        '<span>Montage : <b>' + res.cast + ' mailles</b> pour ' + res.width + ' cm</span>' +
        '<span>Hauteur du corps : <b>' + res.rows + ' rangs</b> pour ' + res.height + ' cm</span>' +
        '<span class="sub">Échantillon : ' + res.sts + ' m. et ' + res.rws + ' rangs pour 10 cm.</span></div>' +
        '<h3>Patrons de votre carnet à consulter' + (res.garment ? ' (' + esc(res.garment) + ')' : '') + '</h3>' +
        (refs.length ? refs.map(function(p) {
          return '<button type="button" class="btn" style="justify-content:flex-start;text-align:left" data-act="open" data-id="' + esc(p.id) + '">' + esc(p.title) + (p.f.gauge_sts ? ' · ' + esc(p.f.gauge_sts) + ' m./10 cm' : '') + '</button>';
        }).join('') : '<p class="sub">Aucun patron correspondant dans le carnet.</p>') + '</div>';
    }
    return '<div class="stack"><div class="card stack">' +
      '<p class="sub">Importez une photo d\'inspiration, indiquez votre échantillon et les dimensions voulues.</p>' +
      '<label class="btn" for="rgPhoto">' + (g.photoUrl ? 'Changer la photo' : 'Choisir une photo') + '</label><input id="rgPhoto" type="file" accept="image/*">' +
      (g.photoUrl ? '<img alt="Photo d\'inspiration" src="' + esc(g.photoUrl) + '" style="max-height:240px;object-fit:contain;border-radius:12px;align-self:center">' : '') +
      '<div class="row"><label class="fl grow"><span class="n">Mailles (10 cm)</span><input class="in" type="number" inputmode="decimal" step="any" data-rg="sts" value="' + esc(g.sts) + '"></label>' +
      '<label class="fl grow"><span class="n">Rangs (10 cm)</span><input class="in" type="number" inputmode="decimal" step="any" data-rg="rows" value="' + esc(g.rows) + '"></label></div>' +
      '<div class="row"><label class="fl grow"><span class="n">Largeur voulue (cm)</span><input class="in" type="number" inputmode="decimal" step="any" data-rg="width" value="' + esc(g.width) + '"></label>' +
      '<label class="fl grow"><span class="n">Hauteur voulue (cm)</span><input class="in" type="number" inputmode="decimal" step="any" data-rg="height" value="' + esc(g.height) + '"></label></div>' +
      '<label class="fl"><span class="n">Type de pièce</span><select class="in" data-rg="garment"><option value="">—</option>' + garments.map(function(o) { return '<option' + (g.garment === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></label>' +
      '<button class="btn primary" data-act="rgRun">Calculer</button></div>' + out + '</div>';
  }

  /* ---- Outil : grilles de points ---- */
  var CHART_TOOLS = {
    color: [['Fond', '#ffffff'], ['Principal', '#b45309'], ['Contraste', '#1c1917'], ['Accent', '#d97706']],
    lace: [['Endroit', '|'], ['Envers', '-'], ['Jeté', '○'], ['2 m. ens.', '/'], ['Surjet', '\\']],
    cables: [['Endroit', '|'], ['Envers', '-'], ['Torsade G', '⋔'], ['Torsade D', '⋍']]
  };
  function chartTools(mode) {
    if (mode === 'color') { var pl = S.chart.palette, nm = ['Fond', 'Principal', 'Contraste', 'Accent']; return nm.map(function(n, i) { return [n, pl[i]]; }); }
    return CHART_TOOLS[mode];
  }
  function chartGrid() {
    var c = S.chart, w = Math.max(5, Math.min(40, parseInt(c.w, 10) || 15)), h = Math.max(5, Math.min(40, parseInt(c.h, 10) || 15));
    var blank = c.mode === 'color' ? c.palette[0] : '';
    var old = c.cells[c.mode] || [], g = [];
    for (var r = 0; r < h; r++) {
      g.push([]);
      for (var x = 0; x < w; x++) g[r].push((old[r] && old[r][x] !== undefined) ? old[r][x] : blank);
    }
    c.cells[c.mode] = g;
    return g;
  }
  function chartCell(r, x, v) {
    var color = S.chart.mode === 'color';
    return '<button type="button" class="ccell" data-act="cell" data-r="' + r + '" data-c="' + x + '" aria-label="Rang ' + (r + 1) + ', maille ' + (x + 1) + '"' + (color ? ' style="background:' + esc(v) + '"' : '') + '>' + (color ? '' : esc(v)) + '</button>';
  }
  function saveGrids() {
    keep('carnet.grids', S.grids);
    IDB.put('meta_grids', JSON.stringify(S.grids)).catch(function() {});
  }
  function drawGrid(cells, mode, cs) {
    var h = cells.length, w = cells[0].length, c = document.createElement('canvas');
    c.width = w * cs + 1; c.height = h * cs + 1;
    var x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    for (var r = 0; r < h; r++) for (var q = 0; q < w; q++) {
      var v = cells[r][q];
      if (mode === 'color') { x.fillStyle = v || '#ffffff'; x.fillRect(q * cs, r * cs, cs, cs); }
      else if (v) { x.fillStyle = '#1c1917'; x.font = 'bold ' + Math.round(cs * 0.6) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(v, q * cs + cs / 2, r * cs + cs / 2 + 1); }
    }
    x.strokeStyle = '#c9ccd3'; x.lineWidth = 1;
    for (var i = 0; i <= w; i++) { x.beginPath(); x.moveTo(i * cs + .5, 0); x.lineTo(i * cs + .5, h * cs); x.stroke(); }
    for (var j = 0; j <= h; j++) { x.beginPath(); x.moveTo(0, j * cs + .5); x.lineTo(w * cs, j * cs + .5); x.stroke(); }
    return c;
  }
  function gridThumb(cells, mode) {
    var big = drawGrid(cells, mode, 12), sc = Math.min(1, 112 / Math.max(big.width, big.height));
    var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(big.width * sc)); c.height = Math.max(1, Math.round(big.height * sc));
    c.getContext('2d').drawImage(big, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }
  var MODE_NAMES = { color: 'Couleurs', lace: 'Dentelle', cables: 'Torsades' };
  function savedGridsHtml() {
    var c = S.chart, curG = S.grids.find(function(g) { return g.id === S.curGrid; });
    var out = '<div class="card stack"><h3>Mes grilles</h3>' +
      '<div class="row"><input class="in grow" id="gridName" placeholder="Nom de la grille" value="' + esc(S.gridName) + '" aria-label="Nom de la grille"><button class="btn primary" data-act="gridSave">' + (curG ? 'Mettre à jour' : 'Enregistrer') + '</button></div>' +
      '<div class="row">' + (curG ? '<button class="btn small" data-act="gridSaveNew">Enregistrer comme nouvelle</button>' : '') + '<button class="btn small" data-act="gridNew">Nouvelle grille vide</button><button class="btn small" data-act="gridPng">Exporter en image</button></div>';
    if (curG) out += '<span class="sub">Grille ouverte : « ' + esc(curG.name) + ' »</span>';
    if (!S.grids.length) out += '<p class="sub">Aucune grille enregistrée pour l\'instant.</p>';
    out += S.grids.map(function(g) {
      return '<div class="row" style="flex-wrap:nowrap;gap:10px;border-top:1px solid var(--line);padding-top:10px"><img class="gthumb" alt="" src="' + esc(g.thumb || '') + '">' +
        '<div class="grow stack" style="gap:2px"><b style="overflow-wrap:anywhere">' + esc(g.name) + '</b><span class="sub">' + esc(MODE_NAMES[g.mode] || g.mode) + ' · ' + g.w + '×' + g.h + ' · ' + new Date(g.ts).toLocaleDateString('fr-BE') + '</span></div>' +
        '<button class="btn small" data-act="gridOpen" data-id="' + esc(g.id) + '">Ouvrir</button><button class="icon-btn" data-act="gridDel" data-id="' + esc(g.id) + '" aria-label="Supprimer la grille">&#10005;</button></div>';
    }).join('');
    return out + '</div>';
  }
  function gridSave(asNew) {
    var c = S.chart, cells = c.cells[c.mode], name = (S.gridName || '').trim();
    if (!cells || !cells.length) { toast('La grille est vide.'); return; }
    if (!name) { toast('Donnez un nom à la grille.'); return; }
    var data = { name: name, mode: c.mode, w: cells[0].length, h: cells.length, cells: JSON.parse(JSON.stringify(cells)), ts: Date.now(), thumb: gridThumb(cells, c.mode) };
    var ex = !asNew && S.grids.find(function(g) { return g.id === S.curGrid; });
    if (ex) Object.assign(ex, data);
    else { data.id = 'g' + uid(); S.grids.unshift(data); S.curGrid = data.id; }
    saveGrids(); render(); toast(ex ? 'Grille mise à jour.' : 'Grille enregistrée.');
  }
  function viewToolChart() {
    var c = S.chart, g = chartGrid(), tools = chartTools(c.mode);
    if (c.tool >= tools.length) c.tool = 0;
    var modes = [['color', 'Couleurs (jacquard)'], ['lace', 'Dentelle'], ['cables', 'Torsades']];
    return '<div class="stack"><div class="card stack"><h2>Grilles de points</h2>' +
      '<label class="fl"><span class="n">Type de grille</span><select class="in" data-chartcfg="mode">' + modes.map(function(m) { return '<option value="' + m[0] + '"' + (c.mode === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></label>' +
      '<div class="row"><label class="fl grow"><span class="n">Largeur (mailles)</span><input class="in" type="number" inputmode="numeric" min="5" max="40" data-chartcfg="w" value="' + g[0].length + '"></label>' +
      '<label class="fl grow"><span class="n">Hauteur (rangs)</span><input class="in" type="number" inputmode="numeric" min="5" max="40" data-chartcfg="h" value="' + g.length + '"></label></div>' +
      '<div class="chips">' + tools.map(function(t, i) {
        return '<button type="button" class="chip' + (c.tool === i ? ' on' : '') + '" data-act="ctool" data-v="' + i + '">' + (c.mode === 'color' ? '<span style="display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid var(--line);background:' + t[1] + ';margin-right:6px;vertical-align:-2px"></span>' : '<b style="margin-right:6px">' + esc(t[1]) + '</b>') + esc(t[0]) + '</button>';
      }).join('') + '</div>' +
      (c.mode === 'color' ? '<div class="row" style="gap:14px">' + tools.map(function(t, i) { return '<label class="fl" style="align-items:center"><span class="n">' + esc(t[0]) + '</span><input type="color" class="pcol" data-cc="' + i + '" value="' + esc(t[1]) + '"></label>'; }).join('') + '</div>' : '') +
      '<div class="scroll-x" style="border:1px solid var(--line);border-radius:12px;padding:8px;max-height:60vh;overflow:auto"><div id="cgrid" style="display:grid;grid-template-columns:repeat(' + g[0].length + ',30px);gap:1px;width:max-content;background:var(--line)">' +
      g.map(function(row, r) { return row.map(function(v, x) { return chartCell(r, x, v); }).join(''); }).join('') + '</div></div>' +
      '<div class="row"><button class="btn small" data-act="cclear">Effacer la grille</button></div>' +
      '<p class="sub">Appuyez sur une case pour appliquer l\'outil choisi. Chaque type de grille garde son propre dessin.</p></div>' + savedGridsHtml() + '</div>';
  }

  var TOOLS = [
    ['sr', 'Rangs raccourcis', 'Calculez les rangs raccourcis pour les épaules, le dos ou le col.'],
    ['gauge', 'Convertisseur d\'échantillon', 'Adaptez un patron à votre échantillon.'],
    ['rag', 'Depuis une photo', 'Montage et rangs sur mesure à partir d\'une photo d\'inspiration.'],
    ['r3', 'Règle de 3', 'Entrez une gauge : convertissez des cm en mailles ou rangs, et inversement.'],
    ['chart', 'Grilles de points', 'Dessinez des diagrammes : jacquard, dentelle, torsades.'],
    ['ig', 'Télécharger une vidéo (Cobalt)', 'Liens des plateformes prises en charge par votre serveur ; enregistrement sur l’appareil ou dans Documentation.'],
    ['calc', 'Calculatrice', 'Additions, pourcentages et calculs rapides, aux couleurs de votre thème.']
  ];

  /* ===== Outil : vidéo Instagram -> MP4 (via un service compatible Cobalt) ===== */
  function igReset(keepUrl) {
    var ig = S.ig;
    if (ig.objUrl) { try { URL.revokeObjectURL(ig.objUrl); } catch (e) {} }
    S.ig = { url: keepUrl ? ig.url : '', title: '', busy: false, err: '', blob: null, objUrl: '', src: '', picker: null, direct: '', saved: false };
  }
  function igEndpoint() {
    var u=(S.igCfg.endpoint||'').trim();if(!u)return '';
    if(!/^https?:\/\//i.test(u))u=(/^(localhost|127\.|192\.168\.|10\.)/i.test(u)?'http://':'https://')+u;
    try{var x=new URL(u);if(!/^https?:$/.test(x.protocol)||x.username||x.password)return '';return x.href;}catch(e){return '';}
  }
  function igIsLoopback(host){return /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(host);}
  function igNetworkCheck(ep){
    var u=new URL(ep);
    if(!/^https?:$/.test(u.protocol)||u.username||u.password)throw new Error('Adresse du service invalide.');
    // Localhost is valid when Cobalt runs on the device using this page.
    // Do not infer the device from the address hosting the application.
    if(location.protocol==='https:'&&u.protocol==='http:'&&!igIsLoopback(u.hostname))throw new Error('Ce service distant est en HTTP. Depuis cette application HTTPS, utilisez une adresse HTTPS, par exemple celle de Tailscale Serve.');
  }
  function igAbs(u,ep){
    var x=new URL(u,ep);
    if(!/^https?:$/.test(x.protocol)||x.username||x.password)throw new Error('Adresse vidéo invalide renvoyée par le service.');
    if(location.protocol==='https:'&&x.protocol==='http:'&&!igIsLoopback(x.hostname))throw new Error('Le fichier vidéo est renvoyé en HTTP par un serveur distant. Vérifiez son adresse HTTPS et API_URL dans Cobalt.');
    return x.href;
  }
  async function igRequest(url,options,mode,timeout){
    var ctl=new AbortController(),timer=setTimeout(function(){ctl.abort();},timeout||30000);
    try{
      var req=Object.assign({},options||{},{signal:ctl.signal});
      // Ask explicitly for media when Cobalt returns a tunnel/redirect URL.
      // Accept is a CORS-safelisted request header and does not trigger a preflight by itself.
      if(mode==='blob'){
        req.headers=Object.assign({},req.headers||{},{Accept:'video/*,application/octet-stream;q=0.9,*/*;q=0.8'});
        req.cache='no-store';
      }
      var r;
      try{ r=await fetch(url,req); }
      catch(e0){
        if(e0&&(e0.name==='DataCloneError'||/could not be cloned/i.test(e0.message||''))){
          var req2=Object.assign({},req);delete req2.signal;
          r=await Promise.race([fetch(url,req2),new Promise(function(_,rej){setTimeout(function(){var te=new Error('timeout');te.name='AbortError';rej(te);},timeout||30000);})]);
        } else throw e0;
      }
      if(mode==='blob'){
        if(!r.ok)throw new Error('Le fichier répond HTTP '+r.status+'.');
        var media=await r.blob();
        if(!media.size)throw new Error('Le serveur a renvoyé un fichier vide.');
        if(/^(text\/|application\/(json|html))/i.test(media.type||''))throw new Error('Cobalt a répondu avec une page ou un message au lieu du fichier vidéo. Vérifiez le lien de téléchargement annoncé par son API.');
        return media;
      }
      var text=await r.text(),j;
      try{j=JSON.parse(text);}catch(e){throw new Error('Réponse HTTP '+r.status+' non reconnue : utilisez l’adresse de l’API Cobalt, pas celle de son interface web.');}
      if(!r.ok)throw new Error(igErrMsg(j.error&&j.error.code)+' (HTTP '+r.status+')');
      return j;
    }catch(e){
      if(e.name==='AbortError')throw new Error('Délai dépassé. Vérifiez que Cobalt est lancé et que son adresse est correcte. Pour un accès à distance seulement, vérifiez aussi Tailscale et que le PC reste allumé.');
      if(e instanceof TypeError)throw new Error('Connexion au service impossible ou bloquée par le navigateur. Vérifiez que Cobalt est lancé, son adresse, CORS et les éventuelles autorisations d’accès au réseau local. Tailscale est nécessaire seulement si vous utilisez cette voie d’accès à distance.');
      throw e;
    }finally{clearTimeout(timer);}
  }
  function igHeaders(post){var h={Accept:'application/json'};if(post)h['Content-Type']='application/json';if((S.igCfg.key||'').trim())h.Authorization='Api-Key '+S.igCfg.key.trim();return h;}
  async function igTest(){
    var ig=S.ig,ep=igEndpoint();ig.err='';ig.diagnostic='';S.igOpen=true;
    if(!ep){ig.err='Collez une adresse valide pour l’API Cobalt.';render();return;}
    ig.busy=true;render();
    try{
      igNetworkCheck(ep);var j=await igRequest(ep,{headers:igHeaders(false)},'json',20000);
      if(!j.cobalt)throw new Error('Ce serveur ne s’identifie pas comme une API Cobalt. Vérifiez son adresse.');
      ig.services=Array.isArray(j.cobalt.services)?j.cobalt.services:[];
      ig.diagnostic='API Cobalt joignable depuis cet appareil'+(j.cobalt.version?' (version '+j.cobalt.version+')':'')+'. Ce test ne valide pas encore le téléchargement d’une vidéo.';
      if(j.cobalt.url){var reported=new URL(j.cobalt.url,ep),chosen=new URL(ep);if(reported.origin!==chosen.origin||reported.pathname.replace(/\/$/,'')!==chosen.pathname.replace(/\/$/,''))ig.diagnostic+=' Le serveur annonce une autre adresse pour ses fichiers. Elle doit être accessible depuis l’appareil utilisé : localhost peut convenir sur le PC qui héberge Cobalt, mais pas pour joindre ce PC depuis un téléphone.';}
    }catch(e){ig.err=e.message;}
    ig.busy=false;render();
  }
  function igErrMsg(code){
    code=String(code||'inconnu');
    if(/auth/.test(code))return 'Clé d’accès absente ou refusée ('+code+').';
    if(/rate|limit/.test(code))return 'Limite du service atteinte. Réessayez plus tard ('+code+').';
    if(/private|login|age/.test(code))return 'Ce contenu demande une connexion ou n’est pas accessible à cette instance ('+code+').';
    if(/unsupported|disabled/.test(code))return 'Cette plateforme ou ce type de lien n’est pas pris en charge par votre serveur ('+code+').';
    if(/unavailable|not_found|empty|fetch/.test(code))return 'Vidéo indisponible ou récupération bloquée par la plateforme ('+code+').';
    return 'Demande refusée par le service ('+code+').';
  }
  async function igUseFile(fileUrl,srcUrl){
    var ig=S.ig;
    try{
      fileUrl=igAbs(fileUrl,igEndpoint());var b=await igRequest(fileUrl,{},'blob',180000);
      if(!b.size||/text|json|html/.test(b.type))throw new Error('La réponse n’est pas un fichier vidéo.');
      var ext=ig.ext||'',mime=b.type;
      if(mime==='video/webm')ext='webm';else if(mime==='video/mp4')ext='mp4';else if(mime==='video/quicktime')ext='mov';else if(mime==='video/x-matroska')ext='mkv';
      if(!ext){var head=new Uint8Array(await b.slice(0,16).arrayBuffer());if(String.fromCharCode.apply(null,head.slice(4,8))==='ftyp')ext='mp4';else if(head[0]===0x1a&&head[1]===0x45&&head[2]===0xdf&&head[3]===0xa3)ext='webm';else ext='bin';}
      ig.ext=ext;
      if(!/^video\//.test(mime)&&['mp4','webm','mov','mkv'].includes(ext))b=new Blob([b],{type:{mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',mkv:'video/x-matroska'}[ext]});
      if(ig.objUrl)URL.revokeObjectURL(ig.objUrl);ig.blob=b;ig.objUrl=URL.createObjectURL(b);ig.src=srcUrl;if(!ig.title)ig.title='Vidéo téléchargée';ig.saved=false;
    }catch(e){ig.direct=/^https?:/i.test(fileUrl)?fileUrl:'';ig.err=e.message+' Si le lien direct s’ouvre, vous pouvez enregistrer le fichier puis l’ajouter à Documentation.';}
  }
  async function igGo(){
    var ig=S.ig,url=(ig.url||'').trim();ig.err='';ig.direct='';ig.picker=null;ig.ext='';
    try{var parsed=new URL(url);if(!/^https?:$/.test(parsed.protocol)||parsed.username||parsed.password)throw new Error();}catch(e){ig.err='Collez un lien vidéo complet en https://. Le serveur vérifiera si la plateforme est prise en charge.';render();return;}
    var ep=igEndpoint();if(!ep){ig.err='Réglez d’abord l’adresse de votre API Cobalt.';S.igOpen=true;render();return;}
    if(ig.objUrl){URL.revokeObjectURL(ig.objUrl);ig.objUrl='';ig.blob=null;}
    ig.busy=true;render();
    try{
      igNetworkCheck(ep);
      var j=await igRequest(ep,{method:'POST',headers:igHeaders(true),body:JSON.stringify({url:url,videoQuality:'1080',downloadMode:'auto',filenameStyle:'basic'})},'json',90000);
      if(j.filename){var m=String(j.filename).match(/\.([a-z0-9]{2,5})$/i);ig.ext=m?m[1].toLowerCase():'';if(!ig.title)ig.title=String(j.filename).replace(/\.[a-z0-9]{2,5}$/i,'');}
      if(j.status==='tunnel'||j.status==='redirect')await igUseFile(igAbs(j.url,ep),url);
      else if(j.status==='picker'){var vids=(j.picker||[]).filter(function(x){return x.type==='video'||x.type==='gif';});if(vids.length===1)await igUseFile(igAbs(vids[0].url,ep),url);else if(vids.length)ig.picker=vids.map(function(x){return igAbs(x.url,ep);});else ig.err='Cette publication ne contient pas de vidéo récupérable.';}
      else if(j.status==='local-processing')ig.err='Le serveur impose un assemblage sur l’appareil, non pris en charge ici. Vérifiez la configuration de traitement de Cobalt.';
      else ig.err=igErrMsg(j.error&&j.error.code);
    }catch(e){ig.err=e.message;}
    ig.busy=false;render();
  }
  function igFileName(){return ((S.ig.title||'video').replace(/[\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim()||'video')+'.'+(S.ig.ext||'bin');}
  async function igToDoc(){
    var ig=S.ig;if(!ig.blob)return;
    try{var mid='docm_'+uid();await saveBlob(mid,ig.blob);S.docs.unshift({id:uid(),title:(ig.title||'').trim()||'Vidéo téléchargée',category:'Tutoriel Vidéo',content:'Source : '+ig.src,media:[{id:mid,type:'video'}],created:Date.now()});saveDocs();ig.saved=true;render();toast('Vidéo enregistrée dans Documentation.');}catch(e){toast('Vidéo non enregistrée : '+e.message);}
  }
  function viewToolIg(){
    var ig=S.ig,cfgOpen=S.igOpen||!igEndpoint();
    var setup='<details class="sec"'+(cfgOpen?' open':'')+'><summary><h3>Service Cobalt et accès à distance</h3></summary><div class="body"><p class="sub">Sur le PC qui exécute Cobalt, conservez votre adresse locale habituelle : localhost et 127.0.0.1 sont autorisés. Depuis le téléphone, utilisez une adresse qui permet de joindre ce PC, par exemple celle de Tailscale Serve en HTTPS. Le PC doit rester allumé et Cobalt actif.</p><label class="fl"><span class="n">Adresse de l’API Cobalt — locale sur PC ou HTTPS à distance</span><input class="in" data-ig="endpoint" placeholder="Adresse habituelle de Cobalt sur ce PC, ou adresse HTTPS Tailscale" value="'+esc(S.igCfg.endpoint)+'" autocomplete="off"></label><label class="fl"><span class="n">Clé d’accès, si nécessaire</span><input class="in" type="password" data-ig="key" value="'+esc(S.igCfg.key)+'" autocomplete="off"></label><button class="btn small" data-act="igTest"'+(ig.busy?' disabled':'')+'>Tester depuis cet appareil</button><p class="sub">Si le serveur répond mais pas le fichier, vérifiez l’adresse de téléchargement annoncée par Cobalt (API_URL). L’accès depuis le navigateur dépend aussi de CORS et de ses autorisations réseau. Ne modifiez pas votre configuration locale si elle fonctionne.</p>'+(ig.diagnostic?'<p role="status">'+esc(ig.diagnostic)+'</p>':'')+(ig.services&&ig.services.length?'<p class="sub">Plateformes annoncées par votre instance : '+esc(ig.services.join(', '))+'. La disponibilité dépend de sa configuration et des restrictions des plateformes.</p>':'')+'</div></details>';
    var res='';
    if(ig.blob)res='<div class="card stack ig-prev"><video controls playsinline src="'+esc(ig.objUrl)+'"></video><span class="sub">Format reçu : '+esc((ig.ext||'inconnu').toUpperCase())+'. Aucun renommage artificiel en MP4.</span>'+(/^(jpe?g|png|webp|gif|heic|avif)$/i.test(ig.ext||'')?'<span class="sub" style="color:#c0392b">⚠ Cobalt a renvoyé une IMAGE, pas une vidéo. Le lien désigne probablement une photo ou un carrousel (essayez le lien du reel sans « ?img_index=… »), ou Instagram n\u2019a pas donné la vidéo à Cobalt.</span>':'')+'<label class="fl"><span class="n">Titre de la vidéo</span><input class="in" id="igTitle" value="'+esc(ig.title)+'"></label><div class="row"><button class="btn primary grow" data-act="igDevice">Télécharger sur mon appareil</button><button class="btn grow" data-act="igDoc"'+(ig.saved?' disabled':'')+'>'+(ig.saved?'Enregistrée':'Enregistrer dans Documentation')+'</button></div><button class="btn small" data-act="igNew">Nouvelle vidéo</button></div>';
    else if(ig.picker)res='<div class="card stack"><h3>Plusieurs vidéos trouvées</h3>'+ig.picker.map(function(u,i){return '<button class="btn" data-act="igPick" data-v="'+i+'">Vidéo '+(i+1)+'</button>';}).join('')+'</div>';
    return '<div class="stack"><div class="card stack"><label class="fl"><span class="n">Lien de la vidéo</span><input class="in" id="igUrl" type="url" inputmode="url" placeholder="Collez le lien complet de la vidéo" value="'+esc(ig.url)+'" autocomplete="off"></label><button class="btn primary" data-act="igGo"'+(ig.busy?' disabled':'')+'>'+(ig.busy?'Récupération en cours…':'Récupérer la vidéo')+'</button><span class="sub">Plusieurs plateformes sont possibles selon votre serveur Cobalt. Contenus publics uniquement, dans le respect des droits de leur auteur.</span></div>'+(ig.err?'<div class="note warn"><div>'+esc(ig.err)+(ig.direct?'<div class="row"><a class="btn small" href="'+esc(ig.direct)+'" target="_blank" rel="noopener">Ouvrir le fichier directement</a></div>':'')+'</div></div>':'')+res+setup+'</div>';
  }
  function r3Num(v) { var n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; }
  function r3Fmt(n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); }
  function viewToolR3() {
    var r = S.r3, ps = r3Num(r.sts), pr = r3Num(r.rows), per = r3Num(r.per) || 10;
    var cm = r3Num(r.cm), nS = r3Num(r.nSts), nR = r3Num(r.nRows);
    function box(label, big, small) {
      return '<div class="calc-res"><span class="sub" style="color:var(--ink)">' + label + '</span><div class="big">' + big + '</div>' + (small ? '<span class="sub">' + small + '</span>' : '') + '</div>';
    }
    var a = '';
    if (!ps && !pr) a = '<div class="note info">Renseignez d’abord votre gauge ci-dessus.</div>';
    else if (!cm) a = '<div class="note info">Entrez une mesure en cm.</div>';
    else {
      if (ps) { var s = cm * ps / per; a += box(r3Fmt(cm) + ' cm = ', Math.round(s) + ' mailles', 'Valeur exacte : ' + r3Fmt(s)); }
      if (pr) { var w = cm * pr / per; a += box(r3Fmt(cm) + ' cm = ', Math.round(w) + ' rangs', 'Valeur exacte : ' + r3Fmt(w)); }
    }
    var b = '';
    if (!ps && !pr) b = '<div class="note info">Renseignez d’abord votre gauge ci-dessus.</div>';
    else if (!nS && !nR) b = '<div class="note info">Entrez un nombre de mailles et/ou de rangs.</div>';
    else {
      if (nS && ps) b += box(r3Fmt(nS) + ' mailles = ', r3Fmt(nS * per / ps) + ' cm', '');
      if (nR && pr) b += box(r3Fmt(nR) + ' rangs = ', r3Fmt(nR * per / pr) + ' cm', '');
      if (!b) b = '<div class="note info">Il manque la gauge correspondante (mailles ou rangs).</div>';
    }
    function inp(k, ph) { return '<input class="in" data-r3="' + k + '" type="text" inputmode="decimal" autocomplete="off" placeholder="' + ph + '" value="' + esc(r[k]) + '">'; }
    return '<div class="stack">' +
      '<div class="card stack"><h2>Ma gauge</h2>' +
      '<div class="row"><label class="fl grow"><span class="n">Mailles</span>' + inp('sts', 'ex. 22') + '</label><label class="fl grow"><span class="n">Rangs</span>' + inp('rows', 'ex. 30') + '</label></div>' +
      '<label class="fl"><span class="n">pour combien de cm ?</span>' + inp('per', '10') + '</label>' +
      '<span class="sub">Ex. : 22 mailles et 30 rangs pour 10 cm. Vous pouvez ne remplir que l’un des deux.</span></div>' +
      '<div class="card stack"><h2>cm → mailles / rangs</h2>' + '<label class="fl"><span class="n">Mesure en cm</span>' + inp('cm', 'ex. 48') + '</label><div id="r3A" class="stack">' + a + '</div></div>' +
      '<div class="card stack"><h2>Mailles / rangs → cm</h2>' +
      '<div class="row"><label class="fl grow"><span class="n">Mailles</span>' + inp('nSts', 'ex. 106') + '</label><label class="fl grow"><span class="n">Rangs</span>' + inp('nRows', 'ex. 140') + '</label></div><div id="r3B" class="stack">' + b + '</div></div>' +
      '</div>';
  }
  /* ===== Notes de WIP depuis les outils ===== */
  function toolNoteText() {
    var t = S.toolSub, tt = TOOLS.find(function(x) { return x[0] === t; }), body = '';
    function boxes(ids) {
      var out = [];
      ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) Array.prototype.forEach.call(el.querySelectorAll('.calc-res'), function(n) { out.push(n.innerText.replace(/\s*\n\s*/g, ' ').trim()); });
      });
      return out;
    }
    if (t === 'sr') {
      var r = computeShortRows();
      if (!r.error) body = r.methodName + '\nTotal : ' + r.total + ' m. · Centre : ' + r.centre + ' m. · Chaque côté : ' + r.sideEach + ' m. · Segments : ' + r.segments.join(' - ') + ' m.\n' + r.steps.join('\n');
    } else if (t === 'gauge') {
      var gc = S.gaugeCalc, b = boxes(['gcRes']);
      if (b.length) body = 'Gauge patron : ' + gc.patSts + ' m. / ' + gc.patRows + ' rgs · Mon échantillon : ' + gc.mySts + ' m. / ' + gc.myRows + ' rgs (10 cm)\n' + b.join('\n');
    } else if (t === 'r3') {
      var rr = S.r3, b3 = boxes(['r3A', 'r3B']);
      if (b3.length) body = 'Gauge : ' + (rr.sts ? rr.sts + ' m.' : '') + (rr.sts && rr.rows ? ' et ' : '') + (rr.rows ? rr.rows + ' rgs' : '') + ' pour ' + (rr.per || 10) + ' cm\n' + b3.join('\n');
    } else if (t === 'rag') {
      var rs = S.rg && S.rg.res;
      if (rs) body = (rs.garment ? rs.garment + ' · ' : '') + 'Échantillon : ' + rs.sts + ' m. et ' + rs.rws + ' rgs pour 10 cm\nMontage : ' + rs.cast + ' mailles pour ' + rs.width + ' cm\nHauteur du corps : ' + rs.rows + ' rangs pour ' + rs.height + ' cm';
    } else if (t === 'chart') {
      var c = S.chart, g = chartGrid(), tools = chartTools(c.mode), has = false, lines = [];
      var names = { color: 'Jacquard', lace: 'Dentelle', cables: 'Torsades' };
      for (var y = g.length - 1; y >= 0; y--) {
        var cells = g[y].map(function(v) {
          if (c.mode === 'color') { var k = c.palette.indexOf(v); if (k > 0) has = true; return 'ABCD'.charAt(k < 0 ? 0 : k); }
          if (v) has = true; return v || '.';
        });
        lines.push('Rang ' + (g.length - y) + ' : ' + cells.join(' '));
      }
      if (has) body = 'Grille ' + (names[c.mode] || '') + (S.gridName ? ' « ' + S.gridName + ' »' : '') + ' — ' + g[0].length + ' mailles × ' + g.length + ' rangs (lecture de bas en haut)' +
        (c.mode === 'color' ? '\nLégende : ' + tools.map(function(x, i) { return 'ABCD'.charAt(i) + ' = ' + x[0] + ' (' + x[1] + ')'; }).join(', ') : '') + '\n' + lines.join('\n');
    } else if (t === 'ig') {
      if (S.ig && (S.ig.url || S.ig.title)) body = 'Vidéo : ' + (S.ig.title ? S.ig.title + ' — ' : '') + (S.ig.url || '');
    } else if (t === 'calc') {
      var kd = kcState();
      if (kd.expr) { var kcv = kcCalc(kd.expr); if (kcv.ok) body = 'Calcul : ' + (kd.done ? String(kd.last || '').replace(/ =$/, '') : kcShow(kd.expr)) + ' = ' + kcFmtNum(kcv.v); }
    }
    if (!body) return '';
    return '— ' + (tt ? tt[1] : 'Outil') + ' —\n' + body;
  }
  function toolNoteHtml() {
    var wips = S.projects.filter(function(p) { return pjStageOf(p) === 'wip'; });
    var h = '<div class="card stack" style="margin-top:12px"><h2>Ajouter au journal d’un WIP</h2>';
    if (!wips.length) return h + '<p class="sub">Aucun projet en WIP pour l’instant.</p></div>';
    var ctx=S.pdfToolReturn, bound=ctx && ctx.projectId;
    var target=journalToolProject();
    if(bound) return h+'<p>Projet lié au PDF : <strong>'+esc(target ? target.name : 'Ce WIP n’est plus disponible')+'</strong></p><label class="fl"><span class="n">Ajouter une description (facultatif)</span><textarea class="in" id="toolJournalDescription" rows="3" placeholder="Décris ce que tu as fait, les essais, les ajustements…">'+esc(S.toolJournalDescription||'')+'</textarea></label><button class="btn primary" data-act="tnSave"'+(!target?' disabled':'')+'>Enregistrer dans ce journal</button><p class="sub">Le résultat de l’outil et ta description seront ajoutés ensemble.</p></div>';
    var sel = S.tnPj || '';
    return h + '<label class="fl"><span class="n">Projet WIP</span><select class="in" data-tn="pj"><option value="">— Choisir un WIP —</option>' +
      wips.map(function(p) { return '<option value="' + esc(p.id) + '"' + (sel === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fl"><span class="n">Ajouter une description (facultatif)</span><textarea class="in" id="toolJournalDescription" rows="3" placeholder="Décris ce que tu as fait, les essais, les ajustements…">'+esc(S.toolJournalDescription||'')+'</textarea></label>' +
      '<button class="btn primary" data-act="tnSave">Enregistrer dans le journal</button>' +
      '<span class="sub">Le résultat de l’outil et ta description seront ajoutés ensemble.</span></div>';
  }
  /* ===== Outil : calculatrice ===== */
  function kcState() { return S.kc || (S.kc = { expr: '', done: false, last: '', err: '' }); }
  function kcFmtNum(n) {
    if (!isFinite(n)) return 'Erreur';
    var r = parseFloat(n.toPrecision(12));
    if (Math.abs(r) >= 1e15 || (r !== 0 && Math.abs(r) < 1e-9)) return String(r).replace('.', ',').replace('-', '−');
    return r.toLocaleString('fr-FR', { maximumFractionDigits: 10 }).replace('-', '−');
  }
  function kcShow(ex) {
    var out = '', prev = '';
    for (var i = 0; i < ex.length; i++) {
      var c = ex.charAt(i), isOp = /[+−×÷]/.test(c), un = c === '−' && (prev === '' || /[+−×÷(]/.test(prev));
      if (c === '.') c = ',';
      out += (isOp && !un) ? ' ' + c + ' ' : c;
      prev = ex.charAt(i);
    }
    return out;
  }
  function kcEval(s) {
    var i = 0;
    function pk() { return s.charAt(i); }
    function num() {
      var st = i;
      while (i < s.length && /[0-9.]/.test(s.charAt(i))) i++;
      var v = parseFloat(s.slice(st, i));
      if (i === st || isNaN(v)) throw new Error('x');
      return v;
    }
    function primary() {
      if (pk() === '(') { i++; var v = expr(); if (pk() !== ')') throw new Error('x'); i++; return { v: v, pct: false }; }
      return { v: num(), pct: false };
    }
    function unary() {
      if (pk() === '−') { i++; var u = unary(); return { v: -u.v, pct: false }; }
      var p = primary();
      while (pk() === '%') { i++; p = { v: p.v / 100, pct: true }; }
      return p;
    }
    function term() {
      var a = unary(), pct = a.pct, v = a.v;
      while (pk() === '×' || pk() === '÷') {
        var op = s.charAt(i++), b = unary();
        if (op === '×') v = v * b.v; else { if (b.v === 0) throw new Error('div0'); v = v / b.v; }
        pct = false;
      }
      return { v: v, pct: pct };
    }
    function expr() {
      var left = term().v;
      while (pk() === '+' || pk() === '−') {
        var op = s.charAt(i++), t = term(), r = t.pct ? left * t.v : t.v;
        left = op === '+' ? left + r : left - r;
      }
      return left;
    }
    var res = expr();
    if (i !== s.length) throw new Error('x');
    return res;
  }
  function kcCalc(src) {
    var s = String(src || '').replace(/[+−×÷.(]+$/, '');
    if (!s) return { err: '' };
    var open = (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
    while (open-- > 0) s += ')';
    try {
      var v = kcEval(s);
      if (!isFinite(v)) return { err: 'Résultat impossible' };
      return { ok: true, v: v };
    } catch (e) { return { err: e.message === 'div0' ? 'Division par zéro' : 'Calcul incomplet' }; }
  }
  function kcDisplay() {
    var st = kcState();
    if (st.err) return { ex: st.last || kcShow(st.expr), rs: st.err, bad: true };
    if (st.done) return { ex: st.last || '', rs: kcFmtNum(parseFloat(st.expr.replace('−', '-'))) };
    var c = kcCalc(st.expr);
    if (c.ok && /[+−×÷%]/.test(st.expr.replace(/^−/, ''))) return { ex: kcShow(st.expr), rs: kcFmtNum(c.v) };
    return { ex: '', rs: st.expr ? kcShow(st.expr) : '0' };
  }
  function kcRefresh() {
    var ex = document.getElementById('kcExpr'), rs = document.getElementById('kcRes');
    if (!ex || !rs) return;
    var d = kcDisplay();
    ex.textContent = d.ex; rs.textContent = d.rs; rs.classList.toggle('err', !!d.bad);
  }
  function kcKey(k) {
    var st = kcState(), e = st.expr, last = e.slice(-1), isOp = /[+−×÷]/;
    st.err = '';
    if (k === 'AC') { st.expr = ''; st.done = false; st.last = ''; kcRefresh(); return; }
    if (k === 'DEL') { if (st.done) { st.expr = ''; st.done = false; st.last = ''; } else st.expr = e.slice(0, -1); kcRefresh(); return; }
    if (k === '=') {
      if (st.done) { kcRefresh(); return; }
      var c = kcCalc(e);
      if (c.ok) {
        var r = parseFloat(c.v.toPrecision(12)), str = String(r);
        if (/e/i.test(str)) { st.last = kcShow(e) + ' = ' + kcFmtNum(r); st.expr = ''; st.done = false; }
        else if (/[+−×÷%(]/.test(e.replace(/^−/, ''))) { st.last = kcShow(e) + ' ='; st.expr = str.replace('-', '−'); st.done = true; }
      } else if (c.err) st.err = c.err;
      kcRefresh(); return;
    }
    if (st.done) {
      if (/[0-9.]|PAR/.test(k)) { st.expr = ''; e = ''; last = ''; st.last = ''; }
      st.done = false;
    }
    if (/^[0-9]$/.test(k)) { if (last === ')' || last === '%') e += '×'; e += k; }
    else if (k === '.') {
      if (last === ')' || last === '%') e += '×';
      var seg = e.match(/[0-9.]*$/)[0];
      if (seg.indexOf('.') < 0) { if (!seg) e += '0'; e += '.'; }
    }
    else if (isOp.test(k)) {
      if (!e) { if (k === '−') e = '−'; }
      else if (e === '−') { /* rien */ }
      else if (isOp.test(last)) {
        if (k === '−' && (last === '×' || last === '÷')) e += k;
        else e = e.replace(/[+−×÷]+$/, '') + k;
      }
      else if (last === '(') { if (k === '−') e += k; }
      else e += k;
    }
    else if (k === '%') { if (/[0-9)%]/.test(last)) e += '%'; }
    else if (k === 'PAR') {
      var o = (e.match(/\(/g) || []).length, cl = (e.match(/\)/g) || []).length;
      if (o > cl && /[0-9)%]/.test(last)) e += ')';
      else { if (/[0-9)%]/.test(last)) e += '×'; e += '('; }
    }
    st.expr = e;
    kcRefresh();
  }
  function viewToolCalc() {
    var d = kcDisplay();
    function key(label, k, cls, aria) { return '<button type="button" class="kc-k' + (cls ? ' ' + cls : '') + '" data-act="kcKey" data-v="' + k + '"' + (aria ? ' aria-label="' + aria + '"' : '') + '>' + label + '</button>'; }
    return '<div class="card stack kc">' +
      '<div class="kc-disp" aria-live="polite"><div class="kc-expr" id="kcExpr">' + esc(d.ex) + '</div><div class="kc-big' + (d.bad ? ' err' : '') + '" id="kcRes">' + esc(d.rs) + '</div></div>' +
      '<div class="kc-pad">' +
      key('AC', 'AC', 'fn', 'Tout effacer') + key('⌫', 'DEL', 'fn', 'Effacer le dernier signe') + key('%', '%', 'op', 'Pourcentage') + key('÷', '÷', 'op', 'Divisé par') +
      key('7', '7') + key('8', '8') + key('9', '9') + key('×', '×', 'op', 'Multiplié par') +
      key('4', '4') + key('5', '5') + key('6', '6') + key('−', '−', 'op', 'Moins') +
      key('1', '1') + key('2', '2') + key('3', '3') + key('+', '+', 'op', 'Plus') +
      key('( )', 'PAR', 'fn', 'Parenthèse') + key('0', '0') + key(',', '.', '', 'Virgule') + key('=', '=', 'eq', 'Égal') +
      '</div>' +
      '<p class="sub">Astuce : « 200 + 10 % » donne 220. Le résultat peut être ajouté au journal d’un WIP, plus bas.</p></div>';
  }
  document.addEventListener('keydown', function(e) {
    if (S.toolSub !== 'calc' || !document.getElementById('kcRes') || DLG) return;
    var t = e.target; if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var map = { '*': '×', '/': '÷', '-': '−', ',': '.', 'Enter': '=', Backspace: 'DEL', Escape: 'AC', Delete: 'AC' };
    var k = map[e.key] || e.key;
    if (/^[0-9.+%=]$|^[×÷−]$|^(DEL|AC)$/.test(k)) { e.preventDefault(); kcKey(k); }
  });

  function viewTools() {
    var lock = S.pwHash ? '<button class="icon-btn" data-act="lockNow" title="Verrouiller l\'application">' + ico('lock') + '</button>' : '';
    if (!S.toolSub) {
      return '<div class="hub">' +
        TOOLS.map(function(t) { return '<button type="button" class="hubt" data-act="toolSub" data-v="' + t[0] + '">' + ico('t_' + t[0]) + '<b>' + esc(t[1]) + '</b><span>' + esc(t[2]) + '</span></button>'; }).join('') + '</div>';
    }
    var cur = TOOLS.find(function(t) { return t[0] === S.toolSub; }) || TOOLS[0];
    return '<div class="top"><button class="icon-btn" data-act="toolSub" data-v="" aria-label="Retour aux outils">' + ico('back') + '</button><h1 class="grow">' + esc(cur[1]) + '</h1>' + lock + '</div>' +
      (S.toolSub === 'gauge' ? viewToolGauge() : S.toolSub === 'r3' ? viewToolR3() : S.toolSub === 'rag' ? viewToolRag() : S.toolSub === 'chart' ? viewToolChart() : S.toolSub === 'ig' ? viewToolIg() : S.toolSub === 'calc' ? viewToolCalc() : viewToolShortRows()) + toolNoteHtml();
  }

  /* ============ Onglet Documentation (Blog Multimédia) ============ */
  function viewDocs() {
    var draft = S.docDraft;
    var dq = gkey(S.docQ || '');
    function docHit(post) { return !dq || gkey([post.title, post.content, post.category].join(' ')).indexOf(dq) >= 0; }
    var nHits = S.docs.filter(docHit).length;
    var editor = S.docEditorOpen ?
      '<div class="card stack" style="border-color:var(--accent)">' +
      '<div class="row"><h2 class="grow">Nouvel article / tutoriel</h2><button class="btn small" data-act="docToggleEditor">Fermer</button></div>' +
      '<input class="in" id="docTitle" placeholder="Titre de l\'article (ex. : Maîtriser le montage tubulaire)" value="' + esc(draft.title) + '">' +
      '<select class="in" id="docCat">' +
      ['Technique', 'Tutoriel Vidéo', 'Fils & Échantillons', 'Astuce Tricot', 'Autre'].map(function(c) {
        return '<option' + (draft.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('') +
      '</select>' +
      '<textarea class="in" id="docBody" rows="6" placeholder="Rédigez vos explications, notes techniques, liens ou étapes…">' + esc(draft.content) + '</textarea>' +
      '<div class="row">' +
      '<label class="btn small" for="docMediaIn">+ Ajouter photos ou vidéos</label>' +
      '<input id="docMediaIn" type="file" accept="image/*,video/*" multiple>' +
      '<span class="sub">' + draft.media.length + ' média(s) joint(s)</span>' +
      '</div>' +
      (draft.media.length ? '<div class="row">' + draft.media.map(function(m, idx) {
        return '<span class="chip">' + (m.type === 'video' ? '🎬 Vidéo' : '🖼️ Image') + ' ' + (idx + 1) + '</span>';
      }).join('') + '</div>' : '') +
      '<button class="btn primary" data-act="docSave">Publier dans ma documentation</button>' +
      '</div>' :
      '<button class="btn primary" data-act="docToggleEditor">+ Écrire un article / ajouter une vidéo</button>';

    var posts = S.docs.length ? S.docs.map(function(post, idx) {
      if (!docHit(post)) return '';
      var mediaHtml = (post.media || []).map(function(m) {
        var u = getBlobUrl(m.id);
        if (m.type === 'video') {
          return u ? '<video controls playsinline src="' + esc(u) + '"></video>' :
            '<video controls playsinline data-blob-id="' + esc(m.id) + '"></video>';
        }
        return u ? '<img loading="lazy" src="' + esc(u) + '" alt="Illustration">' :
          '<img loading="lazy" data-blob-id="' + esc(m.id) + '" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Illustration">';
      }).join('');

      return '<article class="blog-post">' +
        '<div class="row">' +
        '<span class="chip">' + esc(post.category || 'Note') + '</span>' +
        '<span class="sub grow">' + new Date(post.created).toLocaleDateString('fr-FR') + '</span>' +
        '<button class="btn small danger" data-act="docDel" data-i="' + idx + '">Supprimer</button>' +
        '</div>' +
        '<h2>' + esc(post.title) + '</h2>' +
        (post.content ? '<div class="blog-content">' + esc(post.content) + '</div>' : '') +
        (mediaHtml ? '<div class="stack">' + mediaHtml + '</div>' : '') +
        '</article>';
    }).join('') : '<div class="empty"><h2>Votre blog et base de connaissances</h2><p>Archivez ici vos propres tutoriels vidéo, explications de points, astuces de montage et fiches techniques.</p></div>';

    if (S.docs.length && dq && !nHits) posts = '<div class="empty"><p>Aucun résultat pour « ' + esc(S.docQ.trim()) + ' ».</p></div>';
    var searchBar = (S.docSearch || dq) ?
      '<div class="row" style="margin-bottom:12px"><input class="search grow" id="docQ" type="search" placeholder="Rechercher dans ma documentation…" autocomplete="off" value="' + esc(S.docQ) + '" style="margin:0"><span class="sub num" id="docCount">' + (dq ? nHits + ' / ' + S.docs.length : '') + '</span></div>' : '';
    var docPill = (S.docs.length && !S.docSearch && !dq) ? '<button type="button" class="btn" data-act="docSearch" style="width:100%;justify-content:flex-start;gap:8px;margin-bottom:12px;color:var(--muted)">' + ico('find') + ' Rechercher dans ma documentation</button>' : '';
    return '<div class="stack">' + editor + '<div class="stack" id="docList">' + posts + '</div></div>';
  }

  /* ============ Onglet Idées (Tableau Pinterest + Bloc-note rapide) ============ */
  function searchBtn() {
    return '<button class="icon-btn" data-act="tab" data-v="find" aria-label="Rechercher"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></button>';
  }
  function findHtml(q) {
    var k = gkey(q);
    if (k.length < 2) return '<p class="sub">Tapez au moins 2 lettres pour chercher dans vos patrons, projets et épingles.</p>';
    function grp(t, rows) { return rows.length ? '<div class="card stack"><div class="row"><h3 class="grow">' + t + '</h3><span class="chip mute num">' + rows.length + '</span></div>' + rows.join('') + '</div>' : ''; }
    var st = 'justify-content:flex-start;text-align:left';
    var pats = S.patterns.filter(function(p) { return gkey(p.title + ' ' + JSON.stringify(p.f || {})).indexOf(k) >= 0; }).slice(0, 20).map(function(p) {
      return '<button type="button" class="btn" style="' + st + '" data-act="open" data-id="' + esc(p.id) + '">' + esc(p.title) + (p.f && p.f.designer ? ' <span class="sub">· ' + esc(p.f.designer) + '</span>' : '') + '</button>';
    });
    var pjs = S.projects.filter(function(x) { return gkey([x.name, (x.log || []).map(function(e) { return e.text || ''; }).join(' '), pjYarnNames(x), x.needles, x.size].join(' ')).indexOf(k) >= 0; }).slice(0, 20).map(function(x) {
      return '<button type="button" class="btn" style="' + st + '" data-act="openPj" data-id="' + esc(x.id) + '">' + esc(x.name) + ' <span class="sub">· ' + esc(PJ_ONE[pjStageOf(x)]) + '</span></button>';
    });
    var pins = S.ideas.filter(function(i) {
      var bn = pinBoardIds(i).map(function(id) { return S.boards.filter(function(b) { return b.id === id; })[0].name; }).join(' ');
      return gkey([i.title, i.note, i.tag, bn].join(' ')).indexOf(k) >= 0;
    }).slice(0, 20).map(function(i) {
      var lab = esc(i.title || i.note || i.tag || 'Épingle') + ' <span class="sub">· ' + esc(i.tag || 'Idée') + '</span>';
      return (i.mediaId && i.mediaType !== 'video') ? '<button type="button" class="btn" style="' + st + '" data-act="lightbox" data-id="' + esc(i.mediaId) + '">' + lab + '</button>' : '<button type="button" class="btn" style="' + st + '" data-act="tab" data-v="idea">' + lab + '</button>';
    });
    var docsR = S.docs.filter(function(x) { return gkey([x.title, x.content, x.category].join(' ')).indexOf(k) >= 0; }).slice(0, 20).map(function(x) {
      return '<button type="button" class="btn" style="' + st + '" data-act="docFind" data-q="' + esc(q) + '">' + esc(x.title) + ' <span class="sub">· ' + esc(x.category || 'Note') + '</span></button>';
    });
    return (grp('Patrons', pats) + grp('Projets', pjs) + grp('Documentation', docsR) + grp('Épingles', pins)) || '<p class="sub">Aucun résultat.</p>';
  }
  function viewFav() {
    var ps = S.patterns.filter(function(p) { return p.fav; });
    return '<div class="top"><button class="icon-btn" data-act="tab" data-v="lib" aria-label="Retour">' + ico('back') + '</button><h1 class="grow">Mes favoris</h1><span class="chip mute num">' + ps.length + '</span></div>' +
      (ps.length ? '<div class="pgrid">' + ps.map(cardHtml).join('') + '</div>' :
        '<div class="empty"><p>Aucun favori pour l’instant. Appuie sur l’étoile d’un patron pour le retrouver ici.</p><button class="btn small" data-act="tab" data-v="lib">Voir mes patrons</button></div>');
  }
  function viewFind() {
    return '<div class="top"><button class="icon-btn" data-act="tab" data-v="lib" aria-label="Retour">' + ico('back') + '</button><h1 class="grow">Recherche</h1></div>' +
      '<div class="stack"><input class="in" id="gq" type="search" placeholder="Patrons, projets, épingles…" autocomplete="off" value="' + esc(S.fq) + '"><div id="gRes" class="stack">' + findHtml(S.fq) + '</div></div>';
  }
  function ideaTags() {
    var t = ['Inspiration', 'Point / Motif', 'Association Fils', 'Coupe / Col', 'Projet Futur'];
    S.ideas.forEach(function(i) { if (i.tag && t.indexOf(i.tag) < 0) t.push(i.tag); });
    return t;
  }
  function pinBoardIds(item) { return (item.boards || []).filter(function(id) { return S.boards.some(function(b) { return b.id === id; }); }); }
  function pinHtml(item, idx) {
    var u = item.mediaId ? getBlobUrl(item.mediaId) : '', mediaTag = '';
    if (item.mediaId) {
      if (item.mediaType === 'video') mediaTag = u ? '<video controls playsinline src="' + esc(u) + '"></video>' : '<video controls playsinline data-blob-id="' + esc(item.mediaId) + '"></video>';
      else mediaTag = u ? '<img loading="lazy" src="' + esc(u) + '" alt="' + esc(item.title) + '">' : '<img loading="lazy" data-blob-id="' + esc(item.mediaId) + '" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="' + esc(item.title) + '">';
    }
    if (item.mediaId && item.mediaType !== 'video') mediaTag = '<button type="button" data-act="lightbox" data-id="' + esc(item.mediaId) + '" aria-label="Voir en plein écran" style="display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in">' + mediaTag + '</button>';
    var ids = pinBoardIds(item), open = S.pinOpen === item.id, picked = !!(S.pinSel && S.pinSel[item.id]);
    var names = ids.map(function(id) { return S.boards.filter(function(b) { return b.id === id; })[0].name; });
    return '<div class="pin' + (picked ? ' picked' : '') + '">' + (S.pinSel ? '<button type="button" class="pin-pick' + (picked ? ' on' : '') + '" data-act="pinPick" data-id="' + esc(item.id) + '" aria-pressed="' + picked + '" aria-label="Sélectionner l\'épingle"></button>' : '') + mediaTag + '<div class="pin-body">' +
      '<div class="row"><select class="in" data-pintag="' + idx + '" aria-label="Catégorie" style="width:auto;min-height:30px;font-size:12px;padding:0 6px;max-width:75%">' +
      ideaTags().map(function(t) { return '<option' + ((item.tag || 'Inspiration') === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select><span class="grow"></span>' +
      '<button class="btn small danger" style="min-height:28px;padding:0 8px;font-size:12px" data-act="ideaDel" data-i="' + idx + '">✕</button></div>' +
      (item.title ? '<h3>' + esc(item.title) + '</h3>' : '') +
      (item.note ? '<p class="sub" style="color:var(--ink)">' + esc(item.note) + '</p>' : '') +
      '<div class="chips">' + (names.length ? names.map(function(n) { return '<span class="chip mute">' + esc(n) + '</span>'; }).join('') : '<span class="sub">Sans tableau</span>') + '</div>' + inspoChipsFor(item.id) +
      '<button class="btn small" data-act="pinBoards" data-id="' + esc(item.id) + '">' + (open ? 'Fermer' : 'Classer dans…') + '</button>' +
      (open ? (S.boards.length ? S.boards.map(function(b) { return '<label class="toggle"><input type="checkbox" data-pinboard="' + idx + '" data-bid="' + esc(b.id) + '"' + (ids.indexOf(b.id) >= 0 ? ' checked' : '') + '> ' + esc(b.name) + '</label>'; }).join('') : '<span class="sub">Créez d\'abord un tableau.</span>') : '') +
      '</div></div>';
  }
  function pinsShown() {
    var bd = S.ideaBoard, tg = S.ideaTag, out = [];
    S.ideas.forEach(function(item) {
      var ids = pinBoardIds(item);
      if (bd === 'none' ? ids.length : (bd !== 'all' && ids.indexOf(bd) < 0)) return;
      if (tg !== 'all' && (item.tag || 'Inspiration') !== tg) return;
      out.push(item);
    });
    return out;
  }
  function pinSelBar() {
    var n = Object.keys(S.pinSel).filter(function(id) { return S.ideas.some(function(x) { return x.id === id; }); }).length;
    if (S.inspoTarget) return inspoPickBarHtml(n);
    var dis = n ? '' : ' disabled', cb = S.bulkBoard || (S.boards.some(function(b) { return b.id === S.ideaBoard; }) ? S.ideaBoard : '');
    var bopts = S.boards.map(function(b) { return '<option value="' + esc(b.id) + '"' + (cb === b.id ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') +
      '<option value="none"' + (cb === 'none' ? ' selected' : '') + '>Sans tableau</option><option value="__new__">+ Nouveau tableau…</option>';
    return '<div class="selbar"><div class="row"><b class="grow">' + n + ' sélectionnée' + (n > 1 ? 's' : '') + '</b>' +
      '<button class="btn small" data-act="pinPickAll">Tout</button><button class="btn small" data-act="pinPickNone">Aucune</button></div>' +
      '<div class="row" style="flex-wrap:nowrap"><select class="in grow" id="bulkBoard" aria-label="Tableau">' + bopts + '</select>' +
      '<button class="btn small primary" data-act="pinBulk" data-v="move"' + dis + '>Déplacer</button><button class="btn small" data-act="pinBulk" data-v="add"' + dis + '>Ajouter</button></div>' +
      '<div class="row" style="flex-wrap:nowrap"><select class="in grow" id="bulkTag" aria-label="Catégorie">' + ideaTags().map(function(t) { return '<option' + (S.bulkTag === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<button class="btn small" data-act="pinBulk" data-v="tag"' + dis + '>Catégorie</button><button class="btn small danger" data-act="pinBulk" data-v="del"' + dis + '>Supprimer</button></div>' + inspoSendRowHtml(dis) + '</div>';
  }
  async function pinBulk(kind) {
    var ids = Object.keys(S.pinSel || {}), items = S.ideas.filter(function(x) { return ids.indexOf(x.id) >= 0; });
    if (!items.length) { toast('Sélectionnez d\'abord des épingles.'); return; }
    var n = items.length, pl = n > 1 ? 's' : '';
    if (kind === 'move' || kind === 'add') {
      var bv = ($('#bulkBoard') || {}).value;
      if (bv === '__new__') {
        var nm = await askName('Nouveau tableau', '', 'Créer', boardNameCheck());
        if (!nm) return;
        var nb = { id: uid(), name: nm }; S.boards.push(nb); saveBoards(); bv = nb.id;
      }
      if (!bv) { toast('Choisissez un tableau.'); return; }
      if (kind === 'add' && bv === 'none') { toast('Choisissez un tableau pour y ajouter les épingles.'); return; }
      items.forEach(function(it) {
        if (bv === 'none') it.boards = [];
        else if (kind === 'move') it.boards = [bv];
        else { var l = pinBoardIds(it).slice(); if (l.indexOf(bv) < 0) l.push(bv); it.boards = l; }
      });
      saveIdeas();
      var bn = bv === 'none' ? '' : (S.boards.find(function(x) { return x.id === bv; }) || {}).name;
      toast(bv === 'none' ? n + ' épingle' + pl + ' retirée' + pl + ' des tableaux.' : n + ' épingle' + pl + (kind === 'move' ? ' déplacée' : ' ajoutée') + pl + ' dans « ' + bn + ' ».');
    } else if (kind === 'toproj') {
      var tpId = ($('#bulkProj') || {}).value, tgp = S.projects.find(function(x) { return x.id === tpId && pjStageOf(x) === 'attente'; });
      if (!tgp) { toast('Choisissez un projet en attente.'); return; }
      var addedN = inspoAddIdeas(tgp, items.map(function(x) { return x.id; }));
      saveProjects();
      toast(addedN ? addedN + ' épingle' + (addedN > 1 ? 's' : '') + ' ajoutée' + (addedN > 1 ? 's' : '') + ' à « ' + (tgp.name || 'Sans nom') + ' » (elle' + (addedN > 1 ? 's restent' : ' reste') + ' aussi dans vos idées).' : 'Déjà dans l’inspiration de « ' + (tgp.name || 'Sans nom') + ' ».');
    } else if (kind === 'tag') {
      var tv = ($('#bulkTag') || {}).value;
      if (!tv) return;
      items.forEach(function(it) { it.tag = tv; });
      saveIdeas();
      toast('Catégorie « ' + tv + ' » appliquée à ' + n + ' épingle' + pl + '.');
    } else if (kind === 'del') {
      if (!(await askConfirm('Supprimer ' + n + ' épingle' + pl + ' ?', 'Cette action est définitive.', 'Supprimer'))) return;
      items.forEach(function(it) { if (it.mediaId) IDB.del(it.mediaId); });
      S.ideas = S.ideas.filter(function(x) { return ids.indexOf(x.id) < 0; });
      saveIdeas();
      toast(n + ' épingle' + pl + ' supprimée' + pl + '.');
    }
    S.pinSel = null; S.bulkBoard = '';
    render();
  }

  /* ===== Plein écran : glisser pour changer de photo, pincer pour zoomer ===== */
  var LB = { ids: [], i: 0, s: 1, x: 0, y: 0, ptrs: new Map(), g: null, lastTap: 0, tok: 0 };
  function lbApply(anim) {
    var im = $('#lightbox img');
    im.style.transition = anim ? 'transform .18s ease-out' : 'none';
    im.style.transform = 'translate(' + LB.x + 'px,' + LB.y + 'px) scale(' + LB.s + ')';
  }
  function lbClamp() {
    var im = $('#lightbox img'), el = $('#lightbox');
    var mx = Math.max(0, (im.offsetWidth * LB.s - el.clientWidth) / 2), my = Math.max(0, (im.offsetHeight * LB.s - el.clientHeight) / 2);
    LB.x = Math.max(-mx, Math.min(mx, LB.x));
    LB.y = Math.max(-my, Math.min(my, LB.y));
  }
  function lbReset() { LB.s = 1; LB.x = 0; LB.y = 0; }
  function lbShow(i) {
    var id = LB.ids[i];
    if (!id) return;
    LB.i = i; lbReset();
    var tok = ++LB.tok;
    loadBlob(id).then(function(bl) {
      if (tok !== LB.tok || !bl) return;
      var el = $('#lightbox');
      $('#lightbox img').src = getBlobUrl(id);
      lbApply(false);
      el.dataset.single = LB.ids.length < 2 ? '1' : '0';
      el.querySelector('.lb-count').textContent = (i + 1) + ' / ' + LB.ids.length;
      el.hidden = false;
      [i - 1, i + 1].forEach(function(j) { if (LB.ids[j]) loadBlob(LB.ids[j]); });
    });
  }
  function lbOpen(btn) {
    var grp = btn.closest('.masonry, .pjph, .pjcar'), ids = [];
    (grp ? grp.querySelectorAll('[data-act="lightbox"]') : [btn]).forEach(function(n) { var d = n.dataset.id; if (d && ids.indexOf(d) < 0) ids.push(d); });
    var i = ids.indexOf(btn.dataset.id);
    if (i < 0) { ids = [btn.dataset.id]; i = 0; }
    LB.ids = ids;
    lbShow(i);
  }
  function lbStep(d) { var j = LB.i + d; if (j >= 0 && j < LB.ids.length) lbShow(j); }
  function lbClose() { $('#lightbox').hidden = true; LB.ptrs.clear(); LB.g = null; LB.tok++; }
  (function() {
    var el = $('#lightbox');
    function pts() { return Array.from(LB.ptrs.values()); }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function zoomAt(cx, cy, s1) {
      var r = el.getBoundingClientRect(), fx = cx - r.left - r.width / 2, fy = cy - r.top - r.height / 2, k = s1 / LB.s;
      LB.x = fx - (fx - LB.x) * k; LB.y = fy - (fy - LB.y) * k; LB.s = s1;
      if (s1 <= 1) lbReset(); else lbClamp();
    }
    el.addEventListener('pointerdown', function(e) {
      if (e.target.closest('button')) return;
      try { el.setPointerCapture(e.pointerId); } catch (x) {}
      LB.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      var p = pts();
      if (p.length === 1) LB.g = { sx: p[0].x, sy: p[0].y, bx: LB.x, by: LB.y, moved: false, mode: '' };
      else if (p.length === 2) LB.g = { d0: Math.max(1, dist(p[0], p[1])), s0: LB.s, cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2, x0: LB.x, y0: LB.y, moved: true, mode: 'pinch' };
    });
    el.addEventListener('pointermove', function(e) {
      if (!LB.ptrs.has(e.pointerId) || !LB.g) return;
      LB.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      var p = pts(), g = LB.g;
      if (g.mode === 'pinch' && p.length >= 2) {
        var r = el.getBoundingClientRect(), s1 = Math.max(1, Math.min(5, g.s0 * dist(p[0], p[1]) / g.d0));
        var mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
        var fx = g.cx - r.left - r.width / 2, fy = g.cy - r.top - r.height / 2, k = s1 / g.s0;
        LB.s = s1; LB.x = fx + (mx - g.cx) - (fx - g.x0) * k; LB.y = fy + (my - g.cy) - (fy - g.y0) * k;
        if (s1 <= 1) lbReset(); else lbClamp();
        lbApply(false);
        return;
      }
      if (p.length !== 1) return;
      var dx = p[0].x - g.sx, dy = p[0].y - g.sy;
      if (!g.moved && Math.hypot(dx, dy) > 8) { g.moved = true; g.mode = LB.s > 1 ? 'pan' : (Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'down'); }
      if (g.mode === 'pan') { LB.x = g.bx + dx; LB.y = g.by + dy; lbClamp(); lbApply(false); }
      else if (g.mode === 'swipe') { LB.x = dx; LB.y = 0; lbApply(false); }
      else if (g.mode === 'down') { LB.x = 0; LB.y = Math.max(0, dy); lbApply(false); }
    });
    function up(e) {
      if (!LB.ptrs.has(e.pointerId)) return;
      LB.ptrs.delete(e.pointerId);
      var g = LB.g;
      if (!g) return;
      if (g.mode === 'pinch' && LB.ptrs.size === 1) {
        var rest = pts()[0];
        if (LB.s < 1.05) lbReset();
        LB.g = { sx: rest.x, sy: rest.y, bx: LB.x, by: LB.y, moved: true, mode: LB.s > 1 ? 'pan' : 'none' };
        lbApply(true);
        return;
      }
      if (LB.ptrs.size > 0) return;
      LB.g = null;
      if (g.mode === 'pinch' || g.mode === 'pan') { if (LB.s < 1.05) lbReset(); lbClamp(); lbApply(true); return; }
      if (g.mode === 'swipe') {
        var dx = LB.x;
        if (Math.abs(dx) > 70 && ((dx < 0 && LB.i < LB.ids.length - 1) || (dx > 0 && LB.i > 0))) lbStep(dx < 0 ? 1 : -1);
        else { LB.x = 0; lbApply(true); }
        return;
      }
      if (g.mode === 'down') { if (LB.y > 110) lbClose(); else { LB.y = 0; lbApply(true); } return; }
      if (g.moved) return;
      var now = Date.now();
      if (now - LB.lastTap < 300) {
        LB.lastTap = 0;
        if (LB.s > 1) { lbReset(); } else { zoomAt(e.clientX, e.clientY, 2.5); }
        lbApply(true);
      } else {
        LB.lastTap = now;
        setTimeout(function() { if (LB.lastTap === now && LB.s === 1 && !el.hidden) { LB.lastTap = 0; lbClose(); } }, 300);
      }
    }
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', function(e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.max(1, Math.min(5, LB.s * Math.exp(-e.deltaY * 0.002))));
      lbApply(false);
    }, { passive: false });
    el.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    el.addEventListener('gesturestart', function(e) { e.preventDefault(); });
    document.addEventListener('keydown', function(e) {
      if (el.hidden) return;
      if (e.key === 'Escape') lbClose();
      else if (e.key === 'ArrowLeft') lbStep(-1);
      else if (e.key === 'ArrowRight') lbStep(1);
    });
  })();

  function viewIdeas() {
    var d = S.ideaDraft, bd = S.ideaBoard, tg = S.ideaTag;
    if (bd !== 'all' && bd !== 'none' && !S.boards.some(function(b) { return b.id === bd; })) bd = S.ideaBoard = 'all';
    var shown = [];
    S.ideas.forEach(function(item, idx) {
      var ids = pinBoardIds(item);
      if (bd === 'none' ? ids.length : (bd !== 'all' && ids.indexOf(bd) < 0)) return;
      if (tg !== 'all' && (item.tag || 'Inspiration') !== tg) return;
      shown.push(pinHtml(item, idx));
    });
    var board = shown.length ? '<div class="masonry">' + shown.join('') + '</div>' :
      '<div class="empty"><p>' + (S.ideas.length ? 'Aucune épingle dans ce filtre.' : 'Aucune épingle pour le moment. Ajoutez des photos d\'inspiration, vidéos ou croquis ci-dessus.') + '</p></div>';
    var bchips = [['all', 'Tous'], ['none', 'Sans tableau']].concat(S.boards.map(function(b) { return [b.id, b.name]; }));
    var boardBar = '<div class="chips">' + bchips.map(function(c) { return '<button type="button" class="chip' + (bd === c[0] ? ' on' : '') + '" data-act="ideaBoard" data-v="' + esc(c[0]) + '">' + esc(c[1]) + '</button>'; }).join('') +
      '<button type="button" class="chip" data-act="boardNew">+ Tableau</button></div>' +
      '<div class="row"><select class="in grow" data-ideafilter="1" aria-label="Filtrer par catégorie"><option value="all">Toutes les catégories</option>' +
      ideaTags().map(function(t) { return '<option' + (tg === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
      (bd !== 'all' && bd !== 'none' ? '<button class="btn small" data-act="boardRen">Renommer</button><button class="btn small danger" data-act="boardDel">Supprimer le tableau</button>' : '') +
      '<button class="btn small' + (S.pinSel ? ' primary' : '') + '" data-act="pinSelMode">' + (S.pinSel ? 'Terminer' : 'Sélectionner') + '</button></div>';

    return '' +
      '<div class="stack">' + inspoBannerHtml() +
      '<details class="sec" open><summary><h3>Bloc-note rapide</h3></summary><div class="body">' +
      '<textarea class="in" id="scratchpad" rows="4" placeholder="Notez vos idées en vrac, échantillons en cours, associations de fils, mesures…">' + esc(S.scratchpad) + '</textarea>' +
      '</div></details>' +
      '<div class="card stack">' +
      '<h2>Épingler une inspiration</h2>' +
      '<div class="row">' +
      '<input class="in grow" id="ideaTitle" placeholder="Titre de l\'idée (ex. : Pull torsades col camionneur)" value="' + esc(d.title) + '">' +
      '<select class="in" id="ideaTag" style="width:auto">' + ideaTags().map(function(t) { return '<option' + (d.tag === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<textarea class="in" id="ideaNote" rows="2" placeholder="Notes, détails de construction, fil imaginé…">' + esc(d.note) + '</textarea>' +
      '<div class="row">' +
      '<label class="btn small" for="ideaMediaIn">' + (d.mediaId ? '✓ Média prêt (changer)' : '+ Photo ou Vidéo') + '</label>' +
      '<input id="ideaMediaIn" type="file" accept="image/*,video/*">' +
      '<label class="btn small" for="ideaMultiIn">+ Plusieurs photos</label>' +
      '<input id="ideaMultiIn" type="file" accept="image/*,video/*" multiple>' +
      '<button class="btn primary small" data-act="ideaAdd">Épingler' + (bd !== 'all' && bd !== 'none' ? ' dans ce tableau' : '') + '</button>' +
      '</div>' +
      '</div>' +
      boardBar + board + (S.pinSel ? pinSelBar() : '') +
      '</div>';
  }

  /* ============ Onglet Réglages (Apparence, Police, Fond d'écran, Sécurité, Multi-IA, Export) ============ */
  function genericColorsHtml(u) {
    return '<div class="stack" style="gap:6px"><span class="n" style="font-weight:500;font-size:14px">Couleur principale (boutons & accents)</span>' +
      '<div class="swatches">' +
      ACCENT_PRESETS.map(function(pr) {
        return '<button type="button" class="swatch' + (u.accent === pr[0] ? ' active' : '') + '" style="background:' + pr[0] + '" data-act="setAccent" data-v="' + pr[0] + '" title="' + esc(pr[1]) + '"></button>';
      }).join('') +
      '<input type="color" data-ui="accent" value="' + esc(u.accent || '#2A47C9') + '" style="width:36px;height:32px;border:0;background:transparent;cursor:pointer" title="Couleur personnalisée">' +
      '</div></div>' +

      '<div class="row">' +
      '<label class="fl grow"><span class="n">Couleur de fond</span><div class="row"><input type="color" data-ui="bgColor" value="' + esc(u.bgColor || '#F3F4F7') + '" style="width:42px;height:38px;border:1px solid var(--line);border-radius:8px;cursor:pointer"><button class="btn small" data-act="resetColors">Réinitialiser couleurs</button></div></label>' +
      '<label class="fl grow"><span class="n">Couleur des cartes</span><input type="color" data-ui="surfaceColor" value="' + esc(u.surfaceColor || '#FFFFFF') + '" style="width:42px;height:38px;border:1px solid var(--line);border-radius:8px;cursor:pointer"></label>' +
      '</div>';
  }
  function dreamColorsHtml(u) {
    var d = Object.assign({}, DREAM_PALETTES[0][1], u.dream || {});
    function same(p) { return p.main === d.main && p.desk === d.desk && p.paper === d.paper && p.pop === d.pop; }
    var pals = DREAM_PALETTES.map(function(pl, i) {
      var c = pl[1];
      return '<button type="button" class="dpal' + (same(c) ? ' active' : '') + '" data-act="dreamPal" data-v="' + i + '" aria-label="Palette ' + esc(pl[0]) + '">' +
        '<i><b style="background:' + c.main + '"></b><b style="background:' + c.desk + '"></b><b style="background:' + c.paper + '"></b><b style="background:' + c.pop + '"></b></i>' + esc(pl[0]) + '</button>';
    }).join('');
    function pick(k, lab) { return '<label class="fl"><span class="n">' + lab + '</span><input type="color" data-dream="' + k + '" value="' + esc(d[k]) + '"></label>'; }
    return '<div class="stack" style="gap:8px"><span class="n" style="font-weight:500;font-size:14px">Palette dreamOS</span><div class="dpals">' + pals + '</div>' +
      '<div class="dcols">' + pick('main', 'Barres et boutons') + pick('desk', 'Bureau (fond)') + pick('paper', 'Fenêtres et cartes') + pick('pop', 'Détails (progression)') + '</div>' +
      '<span class="sub">Les changements s\'appliquent tout de suite. Le texte s\'adapte automatiquement pour rester lisible.</span></div>';
  }
  function viewSettings() {
    var u = S.ui;
    var configuredText = PROVIDER_IDS.filter(provReady);
    var configuredVision = configuredText.filter(provVision);

    var aiCards = PROVIDER_IDS.map(function(id) {
      var p = AI_PROVIDERS[id];
      var keyVal = S.ai.keys[id] || '';
      var hasKey = provReady(id);
      var isOmni = id === 'omniroute';
      var ts = S.aiTestStatus[id];
      return '<div class="prov-card' + (hasKey ? ' active' : '') + '">' +
        '<div class="row">' +
        '<div class="grow"><h3>' + esc(p.name) + '</h3><span class="sub">' + esc(p.freeNote) + '</span></div>' +
        '<span class="chip ' + (provVision(id) ? 'ok' : 'mute') + '">' + (provVision(id) ? 'Texte + Vision' : 'Texte seul') + '</span>' +
        '</div>' +
        (isOmni ? '<input class="in" type="url" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" data-aiurl="' + id + '" placeholder="' + esc(p.urlPlaceholder) + '" value="' + esc((S.ai.urls && S.ai.urls[id]) || '') + '">' : '') +
        '<div class="row">' +
        '<input class="in grow" type="password" data-aikey="' + id + '" placeholder="' + esc(p.placeholder) + '" value="' + esc(keyVal) + '">' +
        '<button class="btn small" data-act="testAi" data-v="' + id + '"' + (hasKey ? '' : ' disabled') + '>Tester</button>' +
        '</div>' +
        '<details><summary class="hint" style="cursor:pointer">Modèle & lien clé API</summary>' +
        '<div class="stack" style="margin-top:8px">' +
        '<a href="' + esc(p.url) + '" target="_blank" rel="noopener noreferrer" style="font-size:13px">↗ ' + esc(p.urlLabel) + '</a>' +
        '<input class="in" type="text" data-aimodel="' + id + '" value="' + esc(S.ai.models[id] || p.model) + '">' +
        (isOmni ? '<span class="sub">Modèle : <b>auto</b>, le nom d\'un combo OmniRoute, ou un modèle précis (ex. <i>if/kimi-k2-thinking</i>).</span>' +
          '<label class="toggle"><input type="checkbox" data-aiomnivision="1"' + (S.ai.omniVision !== false ? ' checked' : '') + '> Ce modèle sait lire les images (PDF scannés, photos)</label>' +
          '<span class="sub">L\'adresse doit être joignable depuis cet appareil : « localhost » ne marche que si l\'appli tourne sur le même ordinateur. Sur téléphone, utilisez l\'adresse https de votre serveur ou de votre tunnel.</span>' : '') +
        '</div></details>' +
        (ts ? '<div class="note ' + (ts.state === 'ok' ? 'ok' : ts.state === 'bad' ? 'bad' : 'info') + '">' + esc(ts.msg) + '</div>' : '') +
        '</div>';
    }).join('');

    var ps = selected();

    return '' +
      '<div class="stack">' +

      /* 1. Apparence, Police, Couleurs & Fond d'écran */
      '<details class="sec" open><summary><h3>Apparence, police et fond d\'écran</h3></summary><div class="body">' +
      '<label class="fl"><span class="n">Mode d\'affichage</span><select class="in" data-ui="theme">' +
      '<option value="dreamos"' + (u.theme === 'dreamos' ? ' selected' : '') + '>♡ dreamOS (Windows rétro)</option>' +
      '<option value="light"' + (u.theme === 'light' ? ' selected' : '') + '>Clair</option>' +
      '<option value="dark"' + (u.theme === 'dark' ? ' selected' : '') + '>Sombre</option>' +
      '<option value="auto"' + (u.theme === 'auto' ? ' selected' : '') + '>Automatique (selon l\'appareil)</option>' +
      '</select></label>' +

      (u.theme === 'dreamos' ? '' :
      '<label class="fl"><span class="n">Police d\'écriture de l\'application</span><select class="in" data-ui="font">' +
      Object.keys(FONTS).map(function(fk) {
        return '<option value="' + fk + '"' + (u.font === fk ? ' selected' : '') + '>' + esc(FONTS[fk].name) + '</option>';
      }).join('') +
      '</select></label>') +

      (u.theme === 'dreamos' ? dreamColorsHtml(u) : genericColorsHtml(u)) +

      (u.theme === 'dreamos' ? '' :
      '<div class="stack" style="gap:8px;border-top:1px solid var(--line);padding-top:12px">' +
      '<span class="n" style="font-weight:500;font-size:14px">Image de fond d\'écran personnalisée</span>' +
      '<div class="row">' +
      '<label class="btn small" for="wallpaperIn">Choisir une photo de fond</label>' +
      '<input id="wallpaperIn" type="file" accept="image/*">' +
      (u.wallpaperId ? '<button class="btn small danger" data-act="clearWallpaper">Retirer le fond</button>' : '') +
      '</div>' +
      (u.wallpaperId ? '<label class="fl"><span class="n">Voile de lisibilité sur le fond (' + Math.round((u.overlayOpacity || 0.72) * 100) + ' %)</span><input type="range" min="0.2" max="0.95" step="0.05" data-ui="overlayOpacity" value="' + (u.overlayOpacity || 0.72) + '"></label>' : '') +
      '</div>') +
      '</div></details>' +

      /* 1b. Statistiques des projets */
      '<details class="sec"><summary><h3>Statistiques des projets</h3></summary><div class="body">' +
      '<p class="sub">Choisissez celles qui s\'affichent sur la page d\'un projet (et dans la liste). Le changement est immédiat.</p>' +
      PJ_STATS.map(function(x) { return '<label class="toggle"><input type="checkbox" data-stat="' + x[0] + '"' + (statOn(x[0]) ? ' checked' : '') + '> ' + esc(x[1]) + '</label>'; }).join('') +
      '</div></details>' +

      /* 1c. WIP island */
      '<details class="sec"><summary><h3>WIP island</h3>' + (islandCfg().on ? '<span class="chip ok">Actif</span>' : '<span class="chip mute">Désactivé</span>') + '</summary><div class="body">' +
      '<p class="sub">Un WIP resté sans modification (rangs, journal, fils, photos, infos, chronomètre) plus longtemps que la durée choisie part sur l\'île : il reste dans WIP mais se range dans un dossier « WIP island » (avec l\'animal de votre choix). Dès que vous le modifiez, il sort du dossier.</p>' +
      '<label class="toggle"><input type="checkbox" data-island="on"' + (islandCfg().on ? ' checked' : '') + '> Ranger automatiquement les WIP inactifs dans « WIP island »</label>' +
      '<label class="fl"><span class="n">Animal du dossier</span><select class="in" data-island="animal">' + ISLAND_ANIMALS.map(function(x) { return '<option value="' + esc(x.id) + '"' + (islandCfg().animal === x.id ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="fl"><span class="n">Après combien de mois sans activité de tricot ?</span><input class="in" type="number" inputmode="numeric" min="1" step="1" data-island="months" value="' + islandCfg().months + '" style="max-width:120px"></label>' +
      '</div></details>' +

      /* 2. Protection par mot de passe */
      '<details class="sec"><summary><h3>Verrou de l\'application</h3>' + (S.pwHash ? '<span class="chip ok">Actif</span>' : '<span class="chip mute">Désactivé</span>') + '</summary><div class="body">' +
      '<p class="sub">Masque l\'application derrière un mot de passe sur cet appareil, par exemple si quelqu\'un utilise votre téléphone. Ce n\'est pas un chiffrement : les données restent stockées dans le navigateur. Pour les protéger vraiment, utilisez aussi le verrouillage de votre appareil.</p>' +
      '<div class="row">' +
      '<input class="in grow" type="password" id="newPwIn" placeholder="' + (S.pwHash ? 'Nouveau mot de passe…' : 'Choisir un mot de passe…') + '">' +
      '<button class="btn primary small" data-act="setPw">' + (S.pwHash ? 'Modifier' : 'Activer') + '</button>' +
      '</div>' +
      (S.pwHash ? '<div class="row"><button class="btn small" data-act="lockNow">Verrouiller maintenant</button><button class="btn small danger" data-act="removePw">Désactiver le verrou</button></div>' : '') +
      '</div></details>' +

      /* 3. Gestionnaire Multi-IA */
      '<details class="sec"><summary><h3>Clés API et multi-IA</h3>' + (configuredText.length ? '<span class="chip ok">' + configuredText.length + ' active(s)</span>' : '') + '</summary><div class="body">' +
      '<label class="fl"><span class="n">IA prioritaire (Texte & Fiches)</span><select class="in" data-aipref="prefText">' +
      (configuredText.length ? configuredText.map(function(id) { return '<option value="' + id + '"' + (S.ai.prefText === id ? ' selected' : '') + '>' + esc(AI_PROVIDERS[id].name) + '</option>'; }).join('') : '<option value="">Ajoutez une clé ci-dessous</option>') +
      '</select></label>' +
      '<label class="fl"><span class="n">IA prioritaire (Vision & PDF)</span><select class="in" data-aipref="prefVision">' +
      (configuredVision.length ? configuredVision.map(function(id) { return '<option value="' + id + '"' + (S.ai.prefVision === id ? ' selected' : '') + '>' + esc(AI_PROVIDERS[id].name) + '</option>'; }).join('') : '<option value="">Ajoutez une clé Gemini/OpenRouter ou OmniRoute</option>') +
      '</select></label>' +
      '<label class="toggle"><input type="checkbox" data-aifailover="1"' + (S.ai.autoFailover ? ' checked' : '') + '> Basculer automatiquement si le quota est atteint</label>' +
      aiCards +
      '</div></details>' +

      /* 4. Export Dataset & Sauvegarde complète */
      '<details class="sec"><summary><h3>Sauvegarde et export IA</h3></summary><div class="body">' +
      '<p class="sub num">' + ps.length + ' patron(s) · ' + S.docs.length + ' article(s) · ' + S.ideas.length + ' idée(s)</p>' +
      '<label class="toggle"><input type="checkbox" data-exp="valid"' + (S.exp.valid ? ' checked' : '') + '> Exporter uniquement les patrons validés</label>' +
      '<label class="toggle"><input type="checkbox" data-exp="photos"' + (S.exp.photos ? ' checked' : '') + '> Inclure les photos dans l\'archive ZIP</label>' +
      '<p class="sub">' + storText() + '</p>' +
      '<button class="btn primary" data-act="fullBackup">Sauvegarde complète : patrons, PDF et photos (.zip)</button>' +
      '<p class="sub">À faire de temps en temps et à garder dans Fichiers ou iCloud. En cas de perte, « Restaurer » remet tout en place.</p>' +
      '<button class="btn" data-act="zip">Export pour l\'IA (.zip)</button>' +
      '<div class="row">' +
      '<button class="btn small" data-act="file" data-v="patterns.jsonl">patterns.jsonl</button>' +
      '<button class="btn small" data-act="file" data-v="finetune.jsonl">finetune.jsonl</button>' +
      '</div>' +
      '<div style="border-top:1px solid var(--line);padding-top:10px">' +
      '<label class="btn small" for="restoreIn">Restaurer depuis une archive (.zip / .jsonl)</label>' +
      '<input id="restoreIn" type="file" multiple accept=".zip,.jsonl,application/zip,application/json">' +
      '</div>' +
      '</div></details>' +

      /* 5. Développeur */
      '<details class="sec"><summary><h3>Développeur 🛠️</h3></summary><div class="body">' +
      '<p class="sub">Pour tester WIP island sans attendre : choisissez un WIP et faites-le « vieillir ». Il se comporte alors comme s\'il avait été commencé et modifié pour la dernière fois il y a ce nombre de mois. Toute vraie modification du WIP met fin à la simulation. Activez d\'abord WIP island ci-dessus.</p>' +
      (function() {
        var wl = S.projects.filter(function(x) { return pjStageOf(x) === 'wip'; });
        if (!wl.length) return '<p class="sub">Aucun projet en WIP pour l\'instant.</p>';
        return '<label class="fl"><span class="n">Projet WIP</span><select class="in" data-dev="pj">' + wl.map(function(x) { return '<option value="' + esc(x.id) + '">' + esc(x.name || 'Sans nom') + (x.devAge ? ' (simulation active)' : '') + '</option>'; }).join('') + '</select></label>' +
          '<label class="fl"><span class="n">Durée de pause simulée (mois)</span><input class="in" type="number" inputmode="numeric" min="1" step="1" data-dev="months" value="' + (islandCfg().months + 1) + '" style="max-width:120px"></label>' +
          '<div class="row"><button class="btn primary small" data-act="devAge">Faire vieillir ce WIP</button><button class="btn small" data-act="devReset">Annuler la simulation</button></div>';
      })() +
      '</div></details>' +

      '</div>';
  }

  /* ============ Composants existants (Patrons, Fiche, Ajout) ============ */
  function storText() {
    var st = S.stor;
    if (!st) return 'Stockage : vérification…';
    var mb = st.usage ? ' · ' + Math.round(st.usage / 1048576) + ' Mo utilisés' : '';
    var proto = location.protocol === 'file:' ? ' Fichier ouvert directement : le navigateur peut vider ces données, surtout sur iPhone. Hébergez le carnet sur une adresse web puis « Ajouter à l\'écran d\'accueil », ou sauvegardez régulièrement.' : '';
    return 'Stockage du navigateur : ' + (st.persisted ? 'protégé (non effacé automatiquement)' : 'non garanti') + mb + '.' + proto;
  }
  function checkStorage() {
    var out = { persisted: false, usage: 0 };
    var p1 = (navigator.storage && navigator.storage.persist) ? navigator.storage.persist().then(function(ok) { out.persisted = !!ok; }).catch(function() {}) : Promise.resolve();
    return p1.then(function() {
      return (navigator.storage && navigator.storage.estimate) ? navigator.storage.estimate().then(function(e) { out.usage = e.usage || 0; }).catch(function() {}) : null;
    }).then(function() { S.stor = out; if (S.tab === 'set') render(); });
  }
  function statusChip(s) {
    return '<span class="chip ' + (s === 'validé' ? 'ok' : s === 'à vérifier' ? 'warn' : 'mute') + '">' + esc(s) + '</span>';
  }

  function tabbar() {
    var T = [
      ['lib', 'Patrons', 'lib'],
      ['pj', 'Projets', 'pj'],
      ['calc', 'Outils', 'calc'],
      ['doc', 'Doc', 'doc'],
      ['idea', 'Idées', 'idea'],
      ['set', 'Réglages', 'settings']
    ];
    var configured = hasAnyAiKey();
    return '<div class="tabbar"><nav>' + T.map(function(t) {
      var on = S.tab === t[0] || ((S.tab === 'det' || S.tab === 'add' || S.tab === 'fav') && t[0] === 'lib') || (S.tab === 'pjd' && t[0] === 'pj');
      var dot = (t[0] === 'set' && configured) ? '<span class="dot"></span>' : '';
      return '<button data-act="tab" data-v="' + t[0] + '" class="' + (on ? 'on' : '') + '">' + ico(t[2]) + dot + '<span>' + t[1] + '</span></button>';
    }).join('') + '</nav></div>';
  }

  function coverImgHtml(p, alt) {
    var url = p.thumb ? getBlobUrl(p.thumb) : '';
    if (url) return '<img alt="' + esc(alt) + '" src="' + esc(url) + '" loading="lazy" decoding="async">';
    if (p.thumb) return '<img alt="' + esc(alt) + '" loading="lazy" decoding="async" data-blob-id="' + esc(p.thumb) + '" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">';
    var has = !!((p.source && p.source.pdf) || pdfs.has(p.id));
    return '<span class="ph">' + (has ? 'Miniature…' : 'Sans PDF') + '</span>';
  }

  function cardHtml(p) {
    var c = Math.round(completeness(p) * 100);
    var meta = [p.f.designer, p.f.garment].filter(Boolean).map(esc).join(' · ');
    return '<div class="pcard">' +
      '<button class="cover" data-act="viewPdf" data-id="' + esc(p.id) + '" aria-label="Voir le PDF">' + coverImgHtml(p, 'Première page') + '</button>' +
      '<div class="pinfo">' +
      '<div class="stack" style="gap:4px">' +
      '<button type="button" class="ptitle" data-act="viewPdf" data-id="' + esc(p.id) + '" title="Ouvrir le PDF">' + esc(p.title) + '</button>' +
      (meta ? '<span class="sub">' + meta + '</span>' : '') +
      '<span class="chips">' + (function() {
        var fk = p.f.designer ? gkey(normAuthor(p.f.designer)) : '';
        return '<button type="button" class="chip favb' + (p.fav ? ' on' : '') + '" data-act="favPat" data-id="' + esc(p.id) + '" aria-pressed="' + !!p.fav + '">' + (p.fav ? '★ Favori' : '☆ Favori') + '</button>'; 
      })() + (projectsOf(p.id).length ? '<span class="chip ok">' + projectsOf(p.id).length + ' projet' + (projectsOf(p.id).length > 1 ? 's' : '') + '</span>' : '') + statusChip(p.status) + '</span>' +
      '</div>' +
      '<div class="stack" style="gap:6px;margin-top:6px">' +
      '<span class="row"><span class="bar grow"><i style="width:' + c + '%"></i></span><span class="sub num">' + c + ' %</span></span>' +
      '<button class="btn small" data-act="newProjFor" data-id="' + esc(p.id) + '">+ Nouveau projet</button>' +
      '<button class="btn small" data-act="open" data-id="' + esc(p.id) + '">Ouvrir la fiche</button>' +
      '</div>' +
      '</div></div>';
  }

  function isFavA(k) { return S.favAuthors.indexOf(k) >= 0; }
  function favFirst(ps) {
    if (!S.favAuthors.length) return ps;
    var f = [], o = [];
    ps.forEach(function(p) { (p.f.designer && isFavA(gkey(normAuthor(p.f.designer))) ? f : o).push(p); });
    return f.concat(o);
  }
  function groupsOf(ps, mode) {
    var map = {}, order = [];
    function add(key, label, fid, p) {
      if (!map[key]) { map[key] = { key: key, label: label, fid: fid, ps: [] }; order.push(key); }
      if (p) map[key].ps.push(p);
    }
    if (mode === 'folder') S.folders.forEach(function(f) { add(f.id, f.name, f.id, null); });
    if (mode === 'garment') {
      /* Ces deux collections restent visibles même avant d'y ranger un patron. */
      add(gkey('Robe'), 'Robe', null, null);
      add(gkey('Pantalon / short'), 'Pantalon / short', null, null);
    }
    ps.forEach(function(p) {
      if (mode === 'folder') {
        var f = S.folders.find(function(x) { return x.id === p.folder; });
        if (f) add(f.id, f.name, f.id, p);
        else add('_none', 'Sans dossier', null, p);
      } else if (mode === 'author') {
        var a = normAuthor(p.f.designer);
        add(a ? gkey(a) : '_none', a || 'Auteur inconnu', null, p);
      } else {
        var g = p.f.garment;
        add(g ? gkey(g) : '_none', g || 'Pièce non précisée', null, p);
      }
    });
    var arr = order.map(function(k) { return map[k]; });
    if (S.q.trim() || S.fStatus !== 'all' || S.fDiff !== 'all' || S.fStage !== 'all') arr = arr.filter(function(g) { return g.ps.length; });
    arr.forEach(function(g) { g.fav = mode === 'author' && isFavA(g.key); });
    arr.sort(function(a, b) {
      if (a.key === '_none') return 1;
      if (b.key === '_none') return -1;
      if (a.fav !== b.fav) return a.fav ? -1 : 1;
      return String(a.label).localeCompare(String(b.label), 'fr');
    });
    return arr;
  }

  function groupCollapseId(g) {
    return S.group + ':' + g.key;
  }

  function isGroupCollapsed(g) {
    var id = groupCollapseId(g);
    return S.collapsedGroups[id] !== undefined ? !!S.collapsedGroups[id] : true;
  }

  function groupHead(g) {
    var col = isGroupCollapsed(g);
    var cid = groupCollapseId(g);
    var garmentIcons = {
      'pull': 'cat_pull', 'cardigan': 'cat_cardigan', 'gilet sans manches': 'cat_vest',
      'top / debardeur': 'cat_top', 'robe': 'cat_dress', 'jupe': 'cat_skirt',
      'bonnet': 'cat_beanie', 'echarpe / snood': 'cat_scarf', 'chale': 'cat_shawl',
      'chaussettes': 'cat_socks', 'mitaines / gants': 'cat_mittens', 'couverture': 'cat_blanket',
      'sac': 'cat_bag', 'pantalon / short': 'cat_pants', 'autre': 'cat_other'
    };
    var iconKey = S.group === 'folder' ? (garmentIcons[gkey(g.label)] || 'folder_pixel') : S.group === 'author' ? 'pj' :
      S.group === 'garment' ? (garmentIcons[gkey(g.label)] || 'cat_other') : 'lib';
    var groupIcon = S.group === 'author' ? '<span class="folder-count">' + g.ps.length + '</span>' : ico(iconKey);
    var h = '<div class="gh" data-act="toggleGrp" data-gid="' + esc(cid) + '" role="button" tabindex="0" aria-expanded="' + (!col) + '">' +
      '<span class="chev" aria-hidden="true">' + (col ? '▸' : '▾') + '</span>' +
      '<span class="library-folder-icon" aria-hidden="true">' + groupIcon + '</span>' +
      '<h2>' + esc(g.label) + '</h2>' +
      (S.group === 'author' ? '' : '<span class="chip mute num">' + g.ps.length + '</span>') +
      (S.group === 'author' && g.key !== '_none' ? '<button type="button" class="chip favb' + (g.fav ? ' on' : '') + '" data-act="favAuth" data-a="' + esc(g.key) + '" aria-pressed="' + !!g.fav + '" title="Auteur favori">' + (g.fav ? '★ Favori' : '☆ Favori') + '</button>' : '');

    if (S.group === 'folder' && g.fid) {
      if (S.renameId === g.fid) {
        h += '<div class="row" style="width:100%" data-stop="1"><input class="in grow" id="renameIn" value="' + esc(g.label) + '"><button class="btn small primary" data-act="renSave" data-id="' + esc(g.fid) + '">Enregistrer</button><button class="btn small" data-act="renCancel">Annuler</button></div>';
      } else {
        h += '<button class="btn small" data-act="renF" data-id="' + esc(g.fid) + '">Renommer</button><button class="btn small danger" data-act="delF" data-id="' + esc(g.fid) + '">Supprimer</button>';
      }
    }
    return h + '</div>';
  }

  function filteredPatterns() {
    var q = S.q.trim().toLowerCase();
    return S.patterns.filter(function(p) {
      if (S.fStatus !== 'all' && p.status !== S.fStatus) return false;
      if (S.fStage !== 'all' && stageOf(p) !== S.fStage) return false;
      if (S.fDiff !== 'all' && p.f.difficulty !== S.fDiff) return false;
      if (q && (p.title + ' ' + (p.f.garment || '') + ' ' + (p.f.designer || '') + ' ' + (p.f.yarn_name || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  function listHtml() {
    var ps = filteredPatterns();
    if (!S.patterns.length) {
      return '<div class="empty"><h2>Aucun patron pour l\'instant</h2><p>Importez vos patrons PDF ou collez un texte pour construire votre bibliothèque et entraîner votre futur générateur.</p><div class="row" style="justify-content:center"><button class="btn primary" data-act="tab" data-v="add">+ Importer un patron</button><label class="btn" for="restoreIn2">Restaurer une sauvegarde</label><input id="restoreIn2" type="file" multiple accept=".zip,.jsonl,application/zip,application/json"></div></div>';
    }
    if (!ps.length) {
      return '<div class="empty"><p>Aucun patron ne correspond à vos filtres.</p><button class="btn small" data-act="resetFilters">Réinitialiser</button></div>';
    }
    if (S.group === 'all') return '<div class="pgrid">' + favFirst(ps).map(cardHtml).join('') + '</div>';
    var gs = groupsOf(ps, S.group), nFav = gs.filter(function(g) { return g.fav; }).length, seen = 0, other = false;
    return '<div class="library-groups' + ((S.group === 'folder' || S.group === 'garment' || S.group === 'author') ? ' folder-gallery' : '') + '">' + gs.map(function(g) {
      var col = isGroupCollapsed(g);
      var body = col ? '' : (g.ps.length ? '<div class="pgrid">' + favFirst(g.ps).map(cardHtml).join('') + '</div>' : '<p class="sub" style="padding:4px 8px">Aucun patron.</p>');
      var lab = '';
      if (nFav && g.fav && !seen) lab = '<p class="favhead">★ Auteurs favoris</p>';
      else if (nFav && !g.fav && !other) { lab = '<p class="favhead">Autres auteurs</p>'; other = true; }
      if (g.fav) seen++;
      return lab + '<section class="library-group' + ((S.group === 'folder' || S.group === 'garment' || S.group === 'author') ? ' is-folder' : '') + (!col && (S.group === 'folder' || S.group === 'garment' || S.group === 'author') ? ' is-open' : '') + '">' + groupHead(g) + body + '</section>';
    }).join('') + '</div>';
  }

  function folderTools() {
    return '<div class="card stack" style="margin-bottom:12px">' +
      '<div class="row"><input class="in grow" id="newFolder" placeholder="Nom du dossier (ex. Whimsical, Classic…)"><button class="btn small primary" data-act="addF">Créer</button></div>' +
      '</div>';
  }

  function backupBanner() {
    if (!S.patterns.length || S.bkHide) return '';
    var last = load('carnet.lastBackup', 0), old = !last || daysSince(last) >= 7;
    var local = location.protocol === 'file:';
    if (!old && !local) return '';
    var msg = local ?
      'Le carnet est ouvert depuis un fichier : le navigateur peut effacer ces données. ' :
      '';
    msg += last ? 'Dernière sauvegarde : il y a ' + daysSince(last) + ' j.' : 'Aucune sauvegarde faite pour le moment.';
    return '<div class="note warn" style="margin-bottom:10px"><div class="grow">' + esc(msg) +
      '<div class="row" style="margin-top:8px"><button class="btn small primary" data-act="fullBackup">Sauvegarder maintenant</button><button class="btn small" data-act="bkHide">Plus tard</button></div></div></div>';
  }
  function viewLib() {
    var ph = 0, avg = 0;
    S.patterns.forEach(function(p) {
      ph += (p.photos || []).length;
      avg += completeness(p);
    });
    avg = S.patterns.length ? Math.round(avg / S.patterns.length * 100) : 0;
    var modes = [['garment', 'Pièces'], ['author', 'Auteurs'], ['all', 'Tous'], ['folder', 'Dossiers']];
    var statuses = [['all', 'Tous statuts'], ['brouillon', 'Brouillon'], ['à vérifier', 'À vérifier'], ['validé', 'Validé']];

    var collapseBar = (S.group !== 'all' && (S.patterns.length || S.folders.length)) ?
      '<div class="row" style="justify-content:flex-end;margin-bottom:8px">' +
      '<button class="btn small" data-act="collapseAll">Tout plier</button>' +
      '<button class="btn small" data-act="expandAll">Tout déplier</button>' +
      '</div>' : '';

    return '<div class="stats">' +
      '<div class="stat"><b>' + S.patterns.length + '</b><span>patrons</span></div>' +
      '<div class="stat"><b>' + ph + '</b><span>photos</span></div>' +
      '<div class="stat"><b>' + avg + ' %</b><span>complets</span></div>' +
      '</div>' +
      '<div class="stages">' + STAGES.map(function(st) {
        var n = S.projects.filter(function(p) { return pjStageOf(p) === st[0]; }).length;
        return '<button type="button" class="stage" data-act="goPj" data-v="' + st[0] + '"><b>' + n + '</b><span>' + esc(st[1]) + '</span></button>';
      }).join('') + '</div>' +
      backupBanner() +
      (S.patterns.length || S.folders.length ?
        '<input class="search" id="q" type="search" placeholder="Rechercher un patron, auteur, fil…" value="' + esc(S.q) + '">' +
        '<div class="filter-bar">' +
        statuses.map(function(st) { return '<button type="button" class="chip' + (S.fStatus === st[0] ? ' on' : '') + '" data-act="fStatus" data-v="' + esc(st[0]) + '">' + esc(st[1]) + '</button>'; }).join('') +
        '</div>' +
        '<div class="seg" style="margin-bottom:10px">' + modes.map(function(m) { return '<button data-act="grp" data-v="' + m[0] + '" class="' + (S.group === m[0] ? 'on' : '') + '">' + m[1] + '</button>'; }).join('') + '</div>' : '') +
      (S.group === 'folder' ? folderTools() : '') +
      collapseBar +
      '<div id="list">' + listHtml() + '</div>';
  }

  function importProgressHtml() {
    if(!S.importRows) return '';
    var done=S.importRows.filter(function(x){return x.status!=='En attente' && x.status!=='Lecture en cours';}).length;
    return '<section class="card stack"><h2>Import : '+done+' / '+S.importRows.length+'</h2><progress max="'+S.importRows.length+'" value="'+done+'" style="width:100%;height:22px"></progress><ul class="import-files">'+S.importRows.map(function(x){return '<li><span>'+esc(x.name)+'</span><span>'+esc(x.status)+'</span></li>';}).join('')+'</ul>'+(S.importRunning?'<button class="btn" data-act="importStop">Arrêter après ce fichier</button>':'<p>Import terminé. Pensez à créer un ZIP.</p>')+'</section>';
  }
  function safetyControlsHtml() {
    return '<section class="card stack"><h2>Sauvegarde et récupération</h2><button class="btn" data-act="recoverLocal">Rechercher des patrons perdus sur cet appareil</button><button class="btn primary" data-act="fullBackup">Sauvegarde ZIP complète</button><p class="sub">Les instantanés restent sur cet appareil. Conservez aussi un ZIP ailleurs. La recherche peut retrouver des patrons supprimés volontairement.</p></section>';
  }
  function viewAdd() {
    var ready = hasAnyAiKey();
    return '<div class="top"><button class="icon-btn" data-act="tab" data-v="lib" aria-label="Retour">' + ico('back') + '</button><h1>Ajouter un patron</h1></div><div class="stack">' +
      (!ready ? '<div class="note warn"><div><b>Analyse IA non configurée :</b> vous pouvez importer vos PDF dès maintenant, ou <a href="#" data-act="tab" data-v="set">ajouter une clé API dans Réglages</a> pour le remplissage automatique.</div></div>' : '') +
      safetyControlsHtml() + importProgressHtml() + '<div class="card stack"><h2>Importer des PDF</h2>' +
      '<div class="dropzone" id="pdfDrop">' +
      ico('upload') +
      '<p><b>Glissez-déposez vos fichiers PDF ici</b></p>' +
      '<label class="btn primary" for="pdfIn">Choisir des PDF</label>' +
      '<input id="pdfIn" type="file" accept="application/pdf,.pdf" multiple>' +
      '</div>' +
      '<label class="toggle"><input type="checkbox" data-opt="auto"' + (S.opts.auto ? ' checked' : '') + '> Remplir la fiche automatiquement avec l\'IA après l\'import</label>' +
      '<label class="toggle"><input type="checkbox" data-opt="autoProj"' + (S.opts.autoProj ? ' checked' : '') + '> Créer aussi un projet « En attente » pour chaque patron importé</label>' +
      '</div>' +
      '<div class="card stack"><h2>Coller du texte</h2>' +
      '<input class="in" id="pasteTitle" placeholder="Titre du patron">' +
      '<textarea class="in" id="pasteText" rows="5" placeholder="Collez le texte du patron ici"></textarea>' +
      '<button class="btn" data-act="paste">Ajouter ce texte</button>' +
      '</div>' +
      (S.log.length ? '<div class="stack">' + S.log.slice(0, 6).map(function(l) { return '<div class="note ' + (l.ok ? 'ok' : 'bad') + '">' + esc(l.m) + '</div>'; }).join('') + '</div>' : '') +
      '</div>';
  }

  function fieldHtml(p, f) {
    var v = p.f[f.k], id = 'f_' + f.k, badge = p.ai[f.k] ? '<span class="ai">IA</span>' : '', core = f.core ? '<span class="core"></span>' : '';
    var lab = '<span class="n">' + core + esc(f.l) + (f.u ? ' (' + esc(f.u) + ')' : '') + badge + '</span>';
    var hint = f.h ? '<span class="hint">' + esc(f.h) + '</span>' : '';
    var ev = (p.ai[f.k] && p.ev && p.ev[f.k]) ? '<span class="hint">Dans le patron : « ' + esc(p.ev[f.k]) + ' »</span>' : '';
    if (f.t === 'multi') {
      return '<div class="stack" style="gap:6px"><span class="n" style="font-size:14px;font-weight:500;display:flex;gap:6px;align-items:center">' + core + esc(f.l) + badge + '</span><div class="chips" data-chips="' + f.k + '">' + f.o.map(function(o) { return '<button type="button" class="chip' + ((v || []).indexOf(o) >= 0 ? ' on' : '') + '" data-act="chip" data-k="' + f.k + '" data-v="' + esc(o) + '">' + esc(o) + '</button>'; }).join('') + '</div>' + ev + '</div>';
    }
    if (f.k === 'designer') return authorFieldHtml(p, f, lab, badge, hint, ev);
    var inp;
    if (f.t === 'select') inp = '<select class="in" id="' + id + '" data-k="' + f.k + '"><option value="">—</option>' + f.o.map(function(o) { return '<option' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
    else if (f.t === 'long') inp = '<textarea class="in" id="' + id + '" data-k="' + f.k + '" rows="3">' + esc(v || '') + '</textarea>';
    else if (f.t === 'number') inp = '<input class="in" id="' + id + '" data-k="' + f.k + '" type="number" inputmode="decimal" step="any" value="' + esc(v === undefined ? '' : v) + '">';
    else inp = '<input class="in" id="' + id + '" data-k="' + f.k + '" type="text" value="' + esc(v || '') + '">';
    return '<label class="fl" for="' + id + '">' + lab + inp + hint + ev + '</label>';
  }

  function gridHtml(p, kind, rows, title) {
    var sizes = (p.f.sizes && p.f.sizes.length) ? p.f.sizes : SIZES;
    var curSz = (S.activeSize && sizes.indexOf(S.activeSize) >= 0) ? S.activeSize : sizes[0];
    var unit = kind === 'measures' ? ' cm' : '';

    var tabs = '<div class="size-tabs" role="tablist">' + sizes.map(function(s) {
      return '<button type="button" class="size-tab' + (s === curSz ? ' on' : '') + '" data-act="setActiveSize" data-v="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('') + '</div>';

    var visibleRows = S.editMode ? rows : rows.filter(function(r) {
      var v = (p.g[kind][r[0]] || {})[curSz];
      return v !== undefined && v !== '';
    });

    var listBody = visibleRows.length ? '<div class="single-size-list">' + visibleRows.map(function(r) {
      var v = (p.g[kind][r[0]] || {})[curSz];
      if (S.editMode) {
        return '<div class="single-size-row"><span>' + esc(r[1]) + '</span><input type="number" inputmode="decimal" step="any" data-g="' + kind + '" data-r="' + r[0] + '" data-s="' + esc(curSz) + '" value="' + esc(v === undefined ? '' : v) + '"></div>';
      }
      return '<div class="single-size-row"><span>' + esc(r[1]) + '</span><b>' + esc(v) + unit + '</b></div>';
    }).join('') + '</div>' : '<p class="sub">Aucune donnée renseignée pour la taille ' + esc(curSz) + '.</p>';

    return '<div class="stack" style="gap:8px"><span class="n" style="font-size:14px;font-weight:600">' + esc(title) + '</span>' + tabs + listBody + '</div>';
  }

  function optGridHtml(o, i, sizes, kind, rows) {
    if (!rows.length) return '';
    return '<div class="scroll-x"><table class="grid"><thead><tr><th></th>' + sizes.map(function(s) { return '<th>' + s + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function(r) {
        return '<tr><td>' + esc(r[1]) + '</td>' + sizes.map(function(s) {
          var v = ((o[kind] || {})[r[0]] || {})[s];
          return '<td><input type="number" inputmode="decimal" step="any" data-oi="' + i + '" data-og="' + kind + '" data-r="' + r[0] + '" data-s="' + s + '" value="' + esc(v === undefined ? '' : v) + '"></td>';
        }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function optsHtml(p) {
    var list = p.opts || [], sizes = (p.f.sizes && p.f.sizes.length) ? p.f.sizes : SIZES;
    var cards = list.map(function(o, i) {
      var def = GROUPDEF[o.group] || GROUPDEF.Autre;
      var fs = def.fields.map(function(k) {
        var f = fieldDef(k), v = o.f[k], inp;
        if (f.t === 'select') inp = '<select class="in" data-oi="' + i + '" data-of="f:' + k + '"><option value="">—</option>' + f.o.map(function(x) { return '<option' + (v === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>';
        else if (f.t === 'number') inp = '<input class="in" type="number" inputmode="decimal" step="any" data-oi="' + i + '" data-of="f:' + k + '" value="' + esc(v === undefined ? '' : v) + '">';
        else inp = '<input class="in" type="text" data-oi="' + i + '" data-of="f:' + k + '" value="' + esc(v || '') + '">';
        return '<label class="fl"><span class="n">' + esc(f.l) + '</span>' + inp + '</label>';
      }).join('');
      var ms = MEASURES.filter(function(r) { return def.m.indexOf(r[0]) >= 0; }), cs = COUNTS.filter(function(r) { return def.c.indexOf(r[0]) >= 0; });
      return '<div class="opt"><div class="row"><select class="in grow" data-oi="' + i + '" data-of="group">' + GROUP_NAMES.map(function(g) { return '<option' + (o.group === g ? ' selected' : '') + '>' + esc(g) + '</option>'; }).join('') + '</select>' +
        (o.ai ? '<span class="ai">IA</span>' : '') + '<button class="btn small danger" data-act="delOpt" data-i="' + i + '">Retirer</button></div>' +
        '<label class="fl"><span class="n">Nom de l\'option</span><input class="in" type="text" data-oi="' + i + '" data-of="name" value="' + esc(o.name) + '"></label>' +
        '<label class="fl"><span class="n">Description</span><textarea class="in" rows="2" data-oi="' + i + '" data-of="desc">' + esc(o.desc || '') + '</textarea></label>' +
        fs + optGridHtml(o, i, sizes, 'measures', ms) + optGridHtml(o, i, sizes, 'counts', cs) + '</div>';
    }).join('');
    return '<details class="sec" data-sec="opts"' + (S.open.opts || list.length ? ' open' : '') + '><summary><h3>Variantes et options</h3><span class="sub num">' + list.length + '</span></summary><div class="body">' +
      cards + '<button class="btn small" data-act="addOpt" style="align-self:flex-start">Ajouter une option</button></div></details>';
  }

  function renderReadSection(p, s) {
    var items = [];
    var grids = [];
    s.f.forEach(function(f) {
      if (f.k === '@measures') {
        var hasM = Object.keys(p.g.measures || {}).some(function(r) { return Object.keys(p.g.measures[r] || {}).length > 0; });
        if (hasM) grids.push(gridHtml(p, 'measures', MEASURES, 'Mesures finies (cm)'));
      } else if (f.k === '@counts') {
        var hasC = Object.keys(p.g.counts || {}).some(function(r) { return Object.keys(p.g.counts[r] || {}).length > 0; });
        if (hasC) grids.push(gridHtml(p, 'counts', COUNTS, 'Mailles et rangs'));
      } else if (filled(p.f[f.k])) {
        var val = Array.isArray(p.f[f.k]) ? p.f[f.k].join(', ') : (p.f[f.k] + (f.u ? ' ' + f.u : ''));
        items.push('<div class="summary-item"><span>' + esc(f.l) + '</span><b>' + esc(val) + '</b></div>');
      }
    });
    if (!items.length && !grids.length) return '';
    var isDefaultOpen = (s.id === 'ident' || s.id === 'shape' || s.id === 'gauge' || s.id === 'sizes');
    var openAttr = (S.open[s.id] !== undefined ? S.open[s.id] : isDefaultOpen) ? ' open' : '';
    return '<details class="sec" data-sec="' + s.id + '"' + openAttr + '><summary><h3>' + esc(s.t) + '</h3><span class="sub num">' + items.length + '</span></summary><div class="body">' +
      (items.length ? '<div class="summary-grid">' + items.join('') + '</div>' : '') +
      grids.join('') +
      '</div></details>';
  }

  function tabFiche(p) {
    var hasPdf = !!(pdfs.has(p.id) || (p.source && p.source.pdf));
    var ready = hasAnyAiKey();

    if (!S.editMode) {
      var readSecs = SCHEMA.map(function(s) { return renderReadSection(p, s); }).filter(Boolean);
      var optsSummary = (p.opts && p.opts.length) ? '<details class="sec" data-sec="opts"><summary><h3>Variantes et options</h3><span class="sub num">' + p.opts.length + '</span></summary><div class="body">' +
        p.opts.map(function(o) {
          return '<div class="summary-item"><span>' + esc(o.group) + '</span><b>' + esc(o.name || 'Option') + '</b>' + (o.desc ? '<span style="margin-top:4px;color:var(--ink)">' + esc(o.desc) + '</span>' : '') + '</div>';
        }).join('') + '</div></details>' : '';

      var emptyBanner = !readSecs.length ? '<div class="empty"><p>Cette fiche est encore vide.</p><div class="row">' +
        (ready ? '<button class="btn primary small" data-act="aiFill">Remplir avec l\'IA</button>' : '') +
        '<button class="btn small" data-act="toggleEdit">Remplir manuellement</button></div></div>' : '';

      return '<div class="stack">' + emptyBanner + readSecs.join('') + optsSummary + '</div>';
    }

    var ai = '<div class="card stack"><div><h3>Extraction automatique IA</h3><p class="sub">' +
      (ready ? 'Analyse le texte ou les images pour pré-remplir les champs.' : 'Configurez une clé API dans Réglages > Clés API.') +
      '</p></div>' +
      '<div class="row">' +
      (ready ?
        '<button class="btn primary small" data-act="aiFill">Tout remplir</button>' +
        (p.analysis ? '<button class="btn small" data-act="aiRe">Relire</button>' : '') +
        (hasPdf ? '<button class="btn small" data-act="aiVisual">Lire schémas PDF</button>' : '') +
        ((p.photos && p.photos.length) ? '<button class="btn small" data-act="aiPhoto">Lire photos</button>' : '') :
        '<button class="btn primary small" data-act="tab" data-v="set">Configurer une IA</button>') +
      '</div></div>';

    var secs = SCHEMA.map(function(s) {
      var n = 0, d = 0;
      s.f.forEach(function(f) { if (f.k[0] !== '@' && f.core) { n++; if (filled(p.f[f.k])) d++; } });
      return '<details class="sec" data-sec="' + s.id + '"' + (S.open[s.id] ? ' open' : '') + '><summary><h3>' + esc(s.t) + '</h3>' + (n ? '<span class="sub num">' + d + '/' + n + '</span>' : '') + '</summary><div class="body">' +
        s.f.map(function(f) {
          return f.k === '@measures' ? gridHtml(p, 'measures', MEASURES, 'Mesures finies (cm)') :
            f.k === '@counts' ? gridHtml(p, 'counts', COUNTS, 'Nombres de mailles et de rangs') :
            fieldHtml(p, f);
        }).join('') + '</div></details>';
    }).join('');
    return '<div class="stack">' + ai + optsHtml(p) + secs + '</div>';
  }

  function tabTexte(p) {
    var c = proc(p), words = c.clean ? c.clean.split(/\s+/).length : 0, o = S.opts;
    var body;
    if (S.tv === 'raw') body = '<textarea class="in" id="rawText" rows="14">' + esc(p.raw || '') + '</textarea>';
    else body = '<div class="card"><pre class="txt">' + esc(c.clean || '(vide)') + '</pre></div>';

    var hasPdf = !!(pdfs.has(p.id) || (p.source && p.source.pdf));
    return '<div class="stack">' +
      (p.scanned ? '<div class="note warn"><div>Ce PDF semble scanné.' + (hasPdf ? ' <button class="btn small" data-act="aiRead" style="margin-top:8px">Transcrire avec l\'IA</button>' : '') + '</div></div>' : '') +
      '<div class="card stack"><div class="sub num">' + words + ' mots</div>' +
      '<label class="toggle"><input type="checkbox" data-opt="headers"' + (o.headers ? ' checked' : '') + '> Retirer en-têtes et pieds de page répétés</label>' +
      '<label class="toggle"><input type="checkbox" data-opt="expand"' + (o.expand ? ' checked' : '') + '> Développer les abréviations tricot</label>' +
      '</div>' +
      '<div class="seg">' + [['clean', 'Nettoyé'], ['raw', 'Brut']].map(function(t) { return '<button data-act="tv" data-v="' + t[0] + '" class="' + (S.tv === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      body + '</div>';
  }

  function tabPhotos(p) {
    var ph = p.photos || [];
    var add = '<div class="card stack" id="photoDrop"><h3>Ajouter des photos</h3><div class="row">' +
      KINDS.map(function(k) {
        return '<label class="btn small" for="ph_' + k[0] + '">' + esc(k[1]) + '</label><input id="ph_' + k[0] + '" type="file" accept="image/*" multiple data-kind="' + k[0] + '">';
      }).join('') + '</div></div>';

    var grid = ph.length ? '<div class="photos">' + ph.map(function(x, i) {
      var u = getBlobUrl(x.id);
      var imgTag = u ? '<img loading="lazy" alt="' + esc(x.kind) + '" src="' + esc(u) + '">' :
        '<img loading="lazy" alt="' + esc(x.kind) + '" data-blob-id="' + esc(x.id) + '" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">';
      return '<div class="photo">' + imgTag + '<div class="pc">' +
        '<select class="in" data-pk="' + i + '">' +
        KINDS.map(function(k) { return '<option value="' + k[0] + '"' + (x.kind === k[0] ? ' selected' : '') + '>' + esc(k[1]) + '</option>'; }).join('') +
        '</select><button class="btn small danger" data-act="delPhoto" data-i="' + i + '">Retirer</button></div></div>';
    }).join('') + '</div>' : '<p class="sub">Aucune photo associée.</p>';

    return '<div class="stack">' + add + grid + '</div>';
  }

  function tabChecks(p) {
    var cs = checks(p), c = Math.round(completeness(p) * 100);
    return '<div class="stack">' +
      '<div class="card stack"><h3>Fiche complète à ' + c + ' %</h3><div class="bar"><i style="width:' + c + '%"></i></div>' +
      '<label class="fl"><span class="n">Statut</span><select class="in" data-status="1">' +
      ['brouillon', 'à vérifier', 'validé'].map(function(s) { return '<option' + (p.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
      '</select></label></div>' +
      (cs.length ? cs.map(function(x) { return '<div class="note ' + x[0] + '">' + esc(x[1]) + '</div>'; }).join('') : '<div class="note ok">Aucun problème de cohérence détecté.</div>') +
      '<div class="card stack"><h3>Supprimer</h3>' +
      (S.delAsk ? '<p class="sub">Supprimer définitivement « ' + esc(p.title) + ' » ?</p><div class="row"><button class="btn danger small" data-act="delYes">Oui, supprimer</button><button class="btn small" data-act="delNo">Annuler</button></div>' :
        '<button class="btn danger small" data-act="delAsk" style="align-self:flex-start">Supprimer ce patron</button>') +
      '</div></div>';
  }

  function tabPdf(p) {
    var has = !!(pdfs.has(p.id) || (p.source && p.source.pdf));
    return '<div class="stack"><div class="card row" style="gap:12px;align-items:flex-start;flex-wrap:nowrap">' +
      (p.thumb ? '<button class="cover" data-act="viewPdf" data-id="' + esc(p.id) + '" style="width:110px;flex:none;border-radius:8px">' + coverImgHtml(p, 'Première page') + '</button>' : '') +
      '<div class="stack grow"><span class="sub">' + esc((p.source && p.source.file) || 'Aucun PDF') + '</span>' +
      (has ? '<button class="btn primary" data-act="viewPdf" data-id="' + esc(p.id) + '">Ouvrir la visionneuse PDF</button>' : '<div class="note warn">Aucun PDF enregistré.</div>') +
      '<label class="btn small" for="attachIn">' + (has ? 'Remplacer le PDF' : 'Associer un PDF') + '</label><input id="attachIn" type="file" accept="application/pdf,.pdf">' +
      '</div></div></div>';
  }

  function suggestFolder(p) {
    var a = normAuthor(p.f.designer);
    if (!a || p.folder) return '';
    var ex = S.folders.find(function(f) { return gkey(f.name) === gkey(a); });
    return '<div class="row" style="margin:-4px 0 12px"><button type="button" class="btn small" data-act="fileAuthor" data-id="' + esc(p.id) + '">' + (ex ? 'Ranger dans « ' + esc(ex.name) + ' »' : 'Créer le dossier « ' + esc(a) + ' » et ranger') + '</button></div>';
  }
  function viewDet() {
    var p = cur();
    if (!p) { S.tab = 'lib'; return viewLib(); }
    var hasPdf = !!(pdfs.has(p.id) || (p.source && p.source.pdf));
    var c = Math.round(completeness(p) * 100);
    var subs = [['fiche', 'Fiche'], ['photos', 'Photos'], ['texte', hasPdf ? 'PDF' : 'Texte & PDF'], ['ctl', 'Gestion']];
    var titleEl = S.editMode ?
      '<input class="in grow" id="title" value="' + esc(p.title) + '">' :
      '<h1 class="grow">' + esc(p.title) + '</h1>';

    var metaChips = [];
    if (p.f.designer) metaChips.push('<span class="chip mute">' + esc(p.f.designer) + '</span>');
    if (p.f.garment) metaChips.push('<span class="chip mute">' + esc(p.f.garment) + '</span>');
    metaChips.push(statusChip(p.status));

    var editControls = S.editMode ?
      '<div class="card stack" style="margin-bottom:12px">' +
      projectsBlock(p) +
      '</div>' :
      (projectsOf(p.id).length ? '<div style="margin-bottom:12px">' + projectsBlock(p) + '</div>' : '');

    return '<div class="top"><button class="icon-btn" data-act="back" aria-label="Retour">' + ico('back') + '</button>' + titleEl + '</div>' +
      '<div class="row" style="margin-bottom:12px">' +
      (hasPdf ? '<button class="btn primary small" data-act="viewPdf" data-id="' + esc(p.id) + '">Ouvrir le PDF</button>' : '') +
      '<button class="btn small' + (S.editMode ? ' primary' : '') + '" data-act="toggleEdit">' + (S.editMode ? 'Terminer l\'édition' : 'Modifier') + '</button>' +
      '<button type="button" class="btn small" data-act="favPat" data-id="' + esc(p.id) + '" aria-pressed="' + !!p.fav + '">' + (p.fav ? '★ Favori' : '☆ Favori') + '</button>' +
      '<span class="grow"></span>' +
      '<div class="chips">' + metaChips.join('') + '</div>' +
      '</div>' +
      editControls +
      '<div class="seg" style="margin-bottom:14px">' + subs.map(function(s) {
        return '<button data-act="sub" data-v="' + s[0] + '" class="' + (S.sub === s[0] ? 'on' : '') + '">' + s[1] + '</button>';
      }).join('') + '</div>' +
      (S.sub === 'fiche' ? tabFiche(p) : S.sub === 'photos' ? tabPhotos(p) : S.sub === 'texte' ? (hasPdf ? tabPdf(p) + (p.scanned ? '<div class="note warn" style="margin-top:12px"><div>Ce PDF semble scanné. <button class="btn small" data-act="aiRead" style="margin-top:8px">Transcrire avec l\'IA</button></div></div>' : '') : tabPdf(p) + '<div style="height:12px"></div>' + tabTexte(p)) : tabChecks(p));
  }

  var dreamMinimized = false, dreamMaximized = false;
  var lastView = '';
  var lastTabs = '';
  function render() {
    if (S.pwHash && !S.unlocked) {
      syncLockScreen();
      return;
    }
    var vk = S.tab + '|' + S.sub + '|' + S.curProj + '|' + S.cur + '|' + S.toolSub, sy = vk === lastView ? window.scrollY : 0;
    var a = document.activeElement, keepId = a && a.id && /^(q|title|rawText|pasteText|pasteTitle|newFolder|renameIn|scratchpad|docTitle|docBody|docQ|igUrl|igTitle|ideaTitle|ideaNote|pjDraft|pjNotes)$/.test(a.id) ? a.id : null;
    var h = '';
    if (S.tab === 'lib') h = viewLib();
    else if (S.tab === 'add') h = viewAdd();
    else if (S.tab === 'det') h = viewDet();
    else if (S.tab === 'pj') h = viewPj();
    else if (S.tab === 'pjd') h = viewPjd();
    else if (S.tab === 'find') h = viewFind();
    else if (S.tab === 'fav') h = viewFav();
    else if (S.tab === 'calc') h = viewTools();
    else if (S.tab === 'doc') h = viewDocs();
    else if (S.tab === 'idea') h = viewIdeas();
    else h = viewSettings();

    document.body.dataset.view=S.tab;
    if(S.pdfToolReturn && !V.pdf) h='<button class="btn primary pdf-return" data-act="pdfToolsReturn">Revenir au PDF'+(S.pdfToolReturn.projectId?' de « '+esc((S.projects.find(function(p){return p.id===S.pdfToolReturn.projectId;})||{}).name||'WIP')+' »':'')+'</button>'+h;
    if (S.busy) {
      h += '<div class="note info" style="position:fixed;left:16px;right:16px;bottom:calc(80px + env(safe-area-inset-bottom,0px));z-index:25;max-width:748px;margin:0 auto;box-shadow:0 4px 16px rgba(0,0,0,0.2)">' +
        '<span class="spin"></span><span class="grow">' + esc(S.busy) + '</span><button class="btn small" data-act="cancel">Annuler</button></div>';
    }
    if (S.ui && S.ui.theme === 'dreamos') {
      var dreamTitles = {
        lib: 'knittingOS', add: 'Importer un patron', det: 'Fiche du patron',
        pj: 'Mes projets', pjd: 'Espace projet', find: 'Recherche',
        calc: 'Boîte à outils', doc: 'Documentation',
        idea: 'Carnet d’idées', set: 'Paramètres système', fav: 'Mes favoris'
      };
      var dreamTitle = dreamTitles[S.tab] || 'Atelier Tricot';
      dreamDecode(); var dreamIcon = DREAM_ICONS.computer;
      h = '<section class="dream-window' + (dreamMaximized ? ' dream-maximized' : '') + (dreamMinimized ? ' dream-minimized' : '') + '" aria-label="' + esc(dreamTitle) + '">' +
        '<header class="dream-titlebar"><img src="' + dreamIcon + '" alt="" aria-hidden="true"><span class="dream-window-title">' + esc(dreamTitle) + '</span>' +
        '<div class="dream-window-controls dream-quick-actions"><button type="button" ' + 'data-act="tab" data-v="find" aria-label="Rechercher" title="Rechercher"' + '>' + ico('find') + '</button><button type="button" data-act="tab" data-v="add" aria-label="Ajouter un patron" title="Ajouter un patron"><span class="dream-pixel-plus">+</span></button><button type="button" data-act="tab" data-v="fav" aria-label="Mes favoris" title="Mes favoris">' + ico('fav') + '</button></div></header>' +
        '<div class="dream-window-content">' + (dreamMinimized ? '<div class="dream-minimized-note">Fenêtre réduite — choisissez une rubrique pour continuer.</div>' : h) + '</div>' +
        '<footer class="dream-statusbar"><span>♡ DREAM OS</span><span>READY</span><span>' + esc(dreamTitle) + '</span></footer></section>';
    } else if (S.tab === 'calc' || S.tab === 'doc' || S.tab === 'idea' || S.tab === 'set') {
      /* thèmes sans barre de fenêtre : petit en-tête avec titre et loupe */
      var plainT = { calc: 'Outils tricot', doc: 'Documentation', idea: 'Tableau d\'idées', set: 'Réglages' };
      if (!(S.tab === 'calc' && S.toolSub)) h = '<div class="top"><h1 class="grow">' + esc(plainT[S.tab]) + '</h1>' +
        searchBtn() +
        (S.pwHash ? '<button class="icon-btn" data-act="lockNow" title="Verrouiller">' + ico('lock') + '</button>' : '') + '</div>' + h;
    }
    $('#view').innerHTML = h + tmBar();
    var pdfSheetBody = document.getElementById('pdfToolSheetBody');
    if (pdfSheetBody && S.pdfToolReturn && SHEET.mode !== 'note') { pdfSheetBody.innerHTML = viewTools() + toolNoteHtml(); var phd = document.getElementById('pdfToolHead'); if (phd) phd.innerHTML = sheetHeadHtml(); }
    document.body.classList.toggle('has-sel', !!(S.tab === 'idea' && S.pinSel));
    document.body.classList.toggle('inspo-pick', !!(S.tab === 'idea' && S.inspoTarget));
    var tbHtml = tabbar();
    if (tbHtml !== lastTabs) { $('#tabs').innerHTML = tbHtml; lastTabs = tbHtml; }
    lastView = vk;
    if (sy) window.scrollTo(0, sy);
    if (keepId) {
      var e = document.getElementById(keepId);
      if (e) e.focus();
    }
    resolveLazyMedia();
    if (S.tab === 'find' && !S.fq) { var gq0 = $('#gq'); if (gq0) gq0.focus(); }
    if (S.tab === 'lib') queueThumbs();
  }

  /* ============ Événements ============ */
  function refreshMeta(p) {
    var c = Math.round(completeness(p) * 100), b = $('#cbar'), t = $('#cpct');
    if (b) b.style.width = c + '%';
    if (t) t.textContent = c + ' %';
  }

  document.addEventListener('input', function(e) {
    var t = e.target, p = cur();
    if (t.dataset.cc !== undefined) return;
    if (t.id === 'gq') { S.fq = t.value; patchFrom(viewFind(), 'gRes'); return; }
    if (t.id === 'gridName') { S.gridName = t.value; return; }
    if (t.id === 'pjDraft') { S.pjDraft = t.value; return; }
    if (t.id === 'pdfNoteText') { S.pdfNote = t.value; return; }
    if (t.id === 'toolJournalDescription') { S.toolJournalDescription = t.value; return; }
    if (t.dataset.yf) {
      var yq = curPj(), yy1 = yq && pjYarns(yq).find(function(x) { return x.id === t.dataset.id; });
      if (yy1) {
        yy1[t.dataset.yf] = t.dataset.yf === 'planned' ? Math.max(0, parseInt(t.value, 10) || 0) : t.value;
        if (t.dataset.yf === 'planned') {
          document.querySelectorAll('[data-yused="' + yy1.id + '"]').forEach(function(el) { el.textContent = yarnCountTxt(yy1); });
          var sk1 = document.querySelector('[data-skeins]'); if (sk1) sk1.textContent = pjSkeinsTxt(yq);
        }
        saveSoonPj();
      }
      return;
    }
    if (t.dataset.yn) {
      var ypr = curPj(), yy0 = ypr && pjYarns(ypr).find(function(x) { return x.id === t.dataset.yn; });
      if (yy0) {
        yy0.name = t.value; saveSoonPj();
        var ysk = t.closest('.yrow') && t.closest('.yrow').querySelector('.yskein');
        if (ysk) ysk.hidden = !t.value.trim();
      }
      return;
    }
    if (t.dataset.island) {
      var io = Object.assign({ on: false, months: 3, animal: ISLAND_ANIMALS[0].id }, S.ui.island || {});
      if (t.dataset.island === 'on') io.on = t.checked; else if (t.dataset.island === 'animal') io.animal = t.value; else io.months = Math.max(1, parseInt(t.value, 10) || 3);
      S.ui.island = io; keep('carnet.ui', S.ui); if (t.dataset.island === 'animal') render();
      return;
    }
    if (t.dataset.again) { var agp = curPj(); if (agp) { agp.again = t.checked; saveSoonPj(); } return; }
    if (t.dataset.colorpick) { colorSet(t.dataset.colorpick, t.value, colorNameFromHex(t.value)); return; }
    if (t.dataset.islandReason) {
      var irp = curPj();
      if (irp) {
        if (!Array.isArray(irp.islandReasons)) irp.islandReasons = [];
        if (t.checked && irp.islandReasons.indexOf(t.dataset.islandReason) < 0) irp.islandReasons.push(t.dataset.islandReason);
        if (!t.checked) irp.islandReasons = irp.islandReasons.filter(function(x) { return x !== t.dataset.islandReason; });
        saveProjectsQuiet();
        var itg = t.closest('.itag'); if (itg) itg.classList.toggle('on', t.checked);
        var ich = document.getElementById('islandChosen'); if (ich) ich.innerHTML = islandChosenHtml(irp);
      }
      return;
    }
    if (t.dataset.stat) {
      var sObj = Object.assign({}, S.ui.stats || {}); sObj[t.dataset.stat] = t.checked; S.ui.stats = sObj;
      keep('carnet.ui', S.ui);
      return;
    }
    if (t.dataset.pj && t.tagName !== 'SELECT') { var pj0 = curPj(); if (pj0) { pj0[t.dataset.pj] = t.value; saveSoonPj(); } return; }
    if (t.id === 'dupOld') { if (D) D.oldName = t.value; return; }
    if (t.id === 'dupNew') { if (D) D.newName = t.value; return; }
    if (t.id === 'q') { S.q = t.value; $('#list').innerHTML = listHtml(); resolveLazyMedia(); return; }
    if (t.id === 'scratchpad') { S.scratchpad = t.value; keep('carnet.scratchpad', S.scratchpad); return; }
    if (t.id === 'igUrl') { S.ig.url = t.value; return; }
    if (t.id === 'igTitle') { S.ig.title = t.value; return; }
    if (t.dataset.ig) { S.igCfg[t.dataset.ig] = t.value; keep('carnet.igApi', S.igCfg); return; }
    if (t.id === 'docQ') {
      S.docQ = t.value; patchFrom(viewDocs(), 'docList');
      var dcn = $('#docCount'), dqk = gkey(S.docQ);
      if (dcn) dcn.textContent = dqk ? S.docs.filter(function(x) { return gkey([x.title, x.content, x.category].join(' ')).indexOf(dqk) >= 0; }).length + ' / ' + S.docs.length : '';
      resolveLazyMedia(); return;
    }
    if (t.id === 'docTitle') { S.docDraft.title = t.value; return; }
    if (t.id === 'docCat') { S.docDraft.category = t.value; return; }
    if (t.id === 'docBody') { S.docDraft.content = t.value; return; }
    if (t.id === 'ideaTitle') { S.ideaDraft.title = t.value; return; }
    if (t.id === 'ideaTag') { S.ideaDraft.tag = t.value; return; }
    if (t.id === 'ideaNote') { S.ideaDraft.note = t.value; return; }

    if (t.dataset.rg) { S.rg[t.dataset.rg] = t.value; return; }
    if (t.dataset.chartcfg && (t.dataset.chartcfg === 'w' || t.dataset.chartcfg === 'h')) { S.chart[t.dataset.chartcfg] = t.value; return; }

    /* Calculateur rangs raccourcis */
    if (t.dataset.sr) {
      S.sr[t.dataset.sr] = t.value;
      if (t.tagName === 'SELECT') render(); else patchFrom(viewToolShortRows(), 'srRes');
      return;
    }

    if (t.dataset.tn !== undefined) { S.tnPj = t.value; return; }

    /* Règle de 3 */
    if (t.dataset.r3 !== undefined) {
      S.r3[t.dataset.r3] = t.value; keep('carnet.r3', S.r3);
      var r3v = viewToolR3(); patchFrom(r3v, 'r3A'); patchFrom(r3v, 'r3B');
      return;
    }

    /* Convertisseur d'échantillon */
    if (t.dataset.gc) {
      S.gaugeCalc[t.dataset.gc] = t.value;
      if (t.tagName === 'SELECT') render(); else patchFrom(viewToolGauge(), 'gcRes');
      return;
    }

    /* Apparence & Personnalisation */
    if (t.dataset.ui) {
      var uk = t.dataset.ui;
      S.ui[uk] = uk === 'overlayOpacity' ? parseFloat(t.value) : t.value;
      if (uk === 'theme' || uk === 'font') { saveUiCfg(); render(); } else saveUiSoon();
      return;
    }
    if (t.dataset.dream) {
      S.ui.dream = Object.assign({}, DREAM_PALETTES[0][1], S.ui.dream || {});
      S.ui.dream[t.dataset.dream] = t.value;
      saveUiSoon();
      return;
    }

    /* Réglages Multi-IA */
    if (t.dataset.aikey || t.dataset.aiurl) {
      var pid = t.dataset.aikey || t.dataset.aiurl;
      if (t.dataset.aiurl) S.ai.urls[pid] = t.value.trim();
      else S.ai.keys[pid] = t.value;
      delete S.aiTestStatus[pid];
      if (provReady(pid)) {
        if (!S.ai.prefText || !provReady(S.ai.prefText)) S.ai.prefText = pid;
        if (provVision(pid) && (!S.ai.prefVision || !provReady(S.ai.prefVision))) S.ai.prefVision = pid;
      }
      saveAiCfg();
      return;
    }
    if (t.dataset.aiomnivision) { S.ai.omniVision = t.checked; saveAiCfg(); render(); return; }
    if (t.dataset.aimodel) { S.ai.models[t.dataset.aimodel] = t.value; saveAiCfg(); return; }
    if (t.dataset.aipref) { S.ai[t.dataset.aipref] = t.value; saveAiCfg(); return; }
    if (t.dataset.aifailover) { S.ai.autoFailover = t.checked; saveAiCfg(); return; }

    if (t.dataset.opt) {
      var k = t.dataset.opt;
      S.opts[k] = t.type === 'checkbox' ? t.checked : Math.max(1, parseInt(t.value, 10) || S.opts[k]);
      keep('carnet.opts', S.opts);
      if (t.type === 'checkbox') render();
      return;
    }
    if (t.dataset.exp) { S.exp[t.dataset.exp] = t.checked; render(); return; }
    if (!p) return;

    if (t.id === 'title') { p.title = t.value; saveSoon(p); return; }
    if (t.id === 'rawText') { p.raw = t.value.slice(0, 90000); p._v = (p._v || 0) + 1; saveSoon(p); return; }
    if (t.dataset.status) { p.status = t.value; persist(); render(); return; }
    if (t.dataset.folder) { if (t.value) p.folder = t.value; else delete p.folder; persist(); return; }
    if (t.dataset.pk !== undefined) { p.photos[+t.dataset.pk].kind = t.value; persist(); return; }

    if (t.dataset.oi !== undefined) {
      var o = (p.opts || [])[+t.dataset.oi];
      if (!o) return;
      if (t.dataset.og) {
        var gg = o[t.dataset.og] = o[t.dataset.og] || {}, rr = t.dataset.r, ss = t.dataset.s;
        gg[rr] = gg[rr] || {};
        if (t.value === '') delete gg[rr][ss];
        else gg[rr][ss] = parseFloat(t.value);
      } else {
        var key = t.dataset.of;
        if (key.indexOf('f:') === 0) {
          var fk = key.slice(2), ff = fieldDef(fk), vv = t.value;
          if (ff && ff.t === 'number') vv = vv === '' ? '' : parseFloat(vv);
          if (vv === '' || vv === undefined) delete o.f[fk];
          else o.f[fk] = vv;
        } else o[key] = t.value;
        o.ai = 0;
        if (key === 'group') { persist(); render(); return; }
      }
      saveSoon(p);
      return;
    }

    if (t.dataset.k) {
      var f = ALLF.find(function(x) { return x.k === t.dataset.k; });
      var v = t.value;
      if (f && f.t === 'number') v = v === '' ? '' : parseFloat(v);
      if (v === '' || v === undefined) delete p.f[t.dataset.k];
      else p.f[t.dataset.k] = v;
      delete p.ai[t.dataset.k];
      saveSoon(p);
      refreshMeta(p);
      return;
    }

    if (t.dataset.g) {
      var g = p.g[t.dataset.g], r = t.dataset.r, s = t.dataset.s;
      g[r] = g[r] || {};
      if (t.value === '') delete g[r][s];
      else g[r][s] = parseFloat(t.value);
      saveSoon(p);
      refreshMeta(p);
    }
  });

  document.addEventListener('change', async function(e) {
    var t = e.target;
    if (t.dataset.cc !== undefined) {
      var ci = +t.dataset.cc, pl = S.chart.palette, oldC = String(pl[ci]).toLowerCase(), newC = t.value;
      if (oldC !== newC) {
        (S.chart.cells.color || []).forEach(function(r) { r.forEach(function(v, x) { if (v && String(v).toLowerCase() === oldC) r[x] = newC; }); });
        pl[ci] = newC; keep('carnet.chart', S.chart);
      }
      render(); return;
    }
    if (t.dataset.pintag !== undefined) { var it = S.ideas[+t.dataset.pintag]; if (it) { it.tag = t.value; saveIdeas(); render(); } return; }
    if (t.dataset.pinboard !== undefined) {
      var ib = S.ideas[+t.dataset.pinboard];
      if (ib) { var bl = (ib.boards || []).filter(function(x) { return x !== t.dataset.bid; }); if (t.checked) bl.push(t.dataset.bid); ib.boards = bl; saveIdeas(); render(); }
      return;
    }
    if (t.id === 'bulkBoard') { S.bulkBoard = t.value; return; }
    if (t.id === 'bulkTag') { S.bulkTag = t.value; return; }
    if (t.dataset.ideafilter) { S.ideaTag = t.value; render(); return; }
    if (t.dataset.aikey || t.dataset.aiurl) { render(); return; }
    if (t.id === 'pdfIn' && t.files && t.files.length) {
      var fs = Array.from(t.files); t.value = ''; handleFiles(fs); return;
    }
    if (t.id === 'attachIn' && t.files && t.files.length) {
      var af = t.files[0], ap = cur(); t.value = ''; if (ap) attachPdf(ap, af); return;
    }
    if (t.dataset.pj && t.tagName === 'SELECT') {
      var pj1 = curPj();
      if (pj1) { pj1[t.dataset.pj] = t.value; if (t.dataset.pj === 'patternId' && t.value && isAutoPjName(pj1.name)) { var lp = S.patterns.find(function(x) { return x.id === t.value; }); if (lp) pj1.name = lp.title; } saveProjects(); render(); }
      return;
    }
    if (t.id === 'pjCover' && t.files && t.files[0]) {
      var pj2 = curPj(), cf = t.files[0]; t.value = '';
      if (pj2) {
        S.busy = 'Enregistrement de la photo…'; render();
        try {
          var cb = await shrink(cf, 1200), cid2 = 'pjc_' + uid();
          await saveBlob(cid2, cb);
          if (pj2.cover) IDB.del(pj2.cover);
          pj2.cover = cid2; saveProjects();
        } catch (er) { toast('Photo impossible à enregistrer.'); }
        S.busy = ''; render();
      }
      return;
    }
    if (t.id === 'inspoAddPh' && t.files && t.files.length) {
      var inspoP = curPj(), inspoF = Array.from(t.files); t.value = '';
      if (inspoP) {
        S.busy = 'Enregistrement des photos…'; render();
        if (!Array.isArray(inspoP.inspo)) inspoP.inspo = [];
        var inspoN = 0;
        for (var inspoK = 0; inspoK < inspoF.length; inspoK++) {
          try { var inspoB = await shrink(inspoF[inspoK], 1400), inspoI = 'pji_' + uid(); await saveBlob(inspoI, inspoB); inspoP.inspo.push({ id: 'i' + uid(), mediaId: inspoI, mediaType: 'image' }); inspoN++; } catch (eI) {}
        }
        if (inspoN) { saveProjects(); toast(inspoN + ' photo(s) ajoutée(s) à l’inspiration.'); } else toast('Photo impossible à enregistrer.');
        S.busy = ''; render();
      }
      return;
    }
    if (t.id === 'pjAddPh' && t.files && t.files.length) {
      var pj4 = curPj(), pf4 = Array.from(t.files); t.value = '';
      if (pj4) {
        S.busy = 'Enregistrement des photos…'; render();
        var nid = 0;
        if (!pj4.photos) pj4.photos = [];
        for (var q4 = 0; q4 < pf4.length; q4++) {
          try { var b4 = await shrink(pf4[q4], 1400), i4 = 'pjc_' + uid(); await saveBlob(i4, b4); pj4.photos.push(i4); nid++; } catch (e4) {}
        }
        if (nid) { saveProjects(); toast(nid + ' photo(s) ajoutée(s).'); } else toast('Photo impossible à enregistrer.');
        S.busy = ''; render();
      }
      return;
    }
    if (t.id === 'pjPhotos' && t.files && t.files.length) {
      var pj3 = curPj(), pfs = Array.from(t.files); t.value = '';
      if (pj3) {
        S.busy = 'Enregistrement des photos…'; render();
        var ids = [];
        for (var pi = 0; pi < pfs.length; pi++) {
          try { var pb = await shrink(pfs[pi], 1600), pid = 'pjp_' + uid(); await saveBlob(pid, pb); ids.push(pid); } catch (er2) {}
        }
        if (ids.length) {
          pj3.log.unshift({ id: 'e' + uid(), ts: Date.now(), text: S.pjDraft.trim(), photos: ids });
          S.pjDraft = ''; saveProjects();
          toast(ids.length + ' photo(s) ajoutée(s).');
        } else toast('Photos impossibles à enregistrer.');
        S.busy = ''; render();
      }
      return;
    }
    if (t.id === 'rgPhoto' && t.files && t.files[0]) {
      if (S.rg.photoUrl) URL.revokeObjectURL(S.rg.photoUrl);
      S.rg.photoUrl = URL.createObjectURL(t.files[0]); t.value = ''; render(); return;
    }
    if (t.dataset.chartcfg) {
      var cc = t.dataset.chartcfg;
      if (cc === 'mode') { S.chart.mode = t.value; S.chart.tool = 0; }
      else S.chart[cc] = Math.max(5, Math.min(40, parseInt(t.value, 10) || 15));
      keep('carnet.chart', S.chart); render(); return;
    }
    if (t.dataset.authsel) {
      var ap2 = cur();
      if (ap2) {
        if (t.value === '__new__') { S.newAuth = ap2.id; render(); var ni = $('#f_designer'); if (ni) ni.focus(); }
        else { S.newAuth = null; if (t.value) ap2.f.designer = t.value; else delete ap2.f.designer; delete ap2.ai.designer; persist(); render(); }
      }
      return;
    }
    if (t.dataset.k === 'designer') {
      var dp = cur();
      if (dp) {
        var cv = t.value.trim();
        if (cv) { dp.f.designer = canonAuthor(cv); delete dp.ai.designer; }
        else delete dp.f.designer;
        S.newAuth = null; persist(); render();
      }
      return;
    }
    if ((t.id === 'restoreIn' || t.id === 'restoreIn2') && t.files && t.files.length) {
      var rfs = Array.from(t.files); t.value = ''; restoreBackup(rfs.length > 1 ? rfs : rfs[0]); return;
    }
    if (t.dataset.kind && t.files && t.files.length) {
      var p = cur(), fs2 = Array.from(t.files), k = t.dataset.kind; t.value = ''; if (p) addPhotos(p, fs2, k); return;
    }

    /* Fond d'écran personnalisé */
    if (t.id === 'wallpaperIn' && t.files && t.files[0]) {
      var wf = t.files[0]; t.value = '';
      S.busy = 'Chargement du fond d\'écran…'; render();
      var wb = await shrink(wf, 1920);
      var wid = 'wp_' + uid();
      if (S.ui.wallpaperId) IDB.del(S.ui.wallpaperId);
      await saveBlob(wid, wb);
      S.ui.wallpaperId = wid;
      saveUiCfg();
      S.busy = ''; render();
      toast('Fond d\'écran appliqué !');
      return;
    }

    /* Médias Documentation (Blog) */
    if (t.id === 'docMediaIn' && t.files && t.files.length) {
      var mfiles = Array.from(t.files); t.value = '';
      S.busy = 'Ajout des médias…'; render();
      for (var i = 0; i < mfiles.length; i++) {
        var mf = mfiles[i];
        var isVid = mf.type.indexOf('video/') === 0;
        var mid = 'docm_' + uid();
        var blobToStore = isVid ? mf : await shrink(mf, 1600);
        await saveBlob(mid, blobToStore);
        S.docDraft.media.push({ id: mid, type: isVid ? 'video' : 'image' });
      }
      S.busy = ''; render();
      return;
    }

    /* Plusieurs photos d'un coup */
    if (t.id === 'ideaMultiIn' && t.files && t.files.length) {
      var mfs = Array.from(t.files); t.value = '';
      var made = [], tagM = (S.ideaTag !== 'all' ? S.ideaTag : (S.ideaDraft.tag || 'Inspiration')), brd = (S.ideaBoard !== 'all' && S.ideaBoard !== 'none') ? [S.ideaBoard] : [];
      try {
        for (var mi = 0; mi < mfs.length; mi++) {
          if (mi && !S.busy) break;
          var mf = mfs[mi];
          if (!/^(image|video)\//.test(mf.type)) continue;
          S.busy = 'Import ' + (mi + 1) + ' / ' + mfs.length + '…'; render();
          var mVid = mf.type.indexOf('video/') === 0, mid2 = 'ideam_' + uid();
          await saveBlob(mid2, mVid ? mf : await shrink(mf, 1400));
          made.push({ id: uid(), title: '', tag: tagM, note: '', mediaId: mid2, mediaType: mVid ? 'video' : 'image', boards: brd.slice(), created: Date.now() });
        }
      } catch (e2) { toast('Import interrompu après ' + made.length + ' fichier(s).'); }
      if (made.length) {
        S.ideas = made.concat(S.ideas); saveIdeas();
        S.pinSel = {}; made.forEach(function(x) { S.pinSel[x.id] = 1; });
      }
      S.busy = ''; render();
      if (made.length) toast(made.length + ' épingle' + (made.length > 1 ? 's ajoutées' : ' ajoutée') + '. Choisissez un tableau en bas pour les ranger.');
      return;
    }

    /* Média Idée (Pinterest) */
    if (t.id === 'ideaMediaIn' && t.files && t.files[0]) {
      var imf = t.files[0]; t.value = '';
      S.busy = 'Préparation du média…'; render();
      var isVid2 = imf.type.indexOf('video/') === 0;
      var imid = 'ideam_' + uid();
      var b2 = isVid2 ? imf : await shrink(imf, 1400);
      await saveBlob(imid, b2);
      if (S.ideaDraft.mediaId) IDB.del(S.ideaDraft.mediaId);
      S.ideaDraft.mediaId = imid;
      S.ideaDraft.mediaType = isVid2 ? 'video' : 'image';
      S.busy = ''; render();
      toast('Média prêt à être épinglé.');
      return;
    }
  });

  document.addEventListener('toggle', function(e) {
    var d = e.target;
    if (d.classList && d.classList.contains('sec') && d.dataset.sec) S.open[d.dataset.sec] = d.open ? 1 : 0;
  }, true);

  document.addEventListener('click', async function(e) {
    if (e.target.closest('[data-stop]')) return;
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var a = b.dataset.act, v = b.dataset.v, p = cur();

    if(a==='backupDownload'){backupDownload();return;}
    if(a==='backupShare'){backupShare();return;}
    if(a==='backupNext'){backupNext();return;}
    if(a==='backupClose'){if(!backupRunning){var bp=document.getElementById('backupPanel');if(bp)bp.remove();backupArtifact=null;}return;}
    if(a==='pdfToolsOpen'){openPdfTools();return;}
    if(a==='pdfToolsReturn'){returnToPdf();return;}
    if(a==='stitchAdd'){
      var sp=S.projects.find(function(x){return x.id===b.dataset.id;});
      var srEl=document.getElementById('stitchRow'), slEl=document.getElementById('stitchLabel');
      var sr=srEl?parseInt(srEl.value,10):0, sl=slEl?(slEl.value||'').trim():'';
      if(!sp||!Number.isFinite(sr)||sr<1){toast('Indique un numéro de rang valide.');return;}
      sp.stitchMarkers=sp.stitchMarkers||[];
      sp.stitchMarkers.push({id:'sm'+uid(),row:sr,label:sl,created:Date.now()});
      saveProjectsQuiet();render();toast('Stitch marker ajouté au rang '+sr+' ✓');return;
    }
    if(a==='stitchDel'){
      var dp=S.projects.find(function(x){return x.id===b.dataset.id;});
      if(dp){dp.stitchMarkers=(dp.stitchMarkers||[]).filter(function(m){return m.id!==b.dataset.mid;});saveProjectsQuiet();render();}
      return;
    }
    if(a==='recoverLocal'){recoverLocalPatterns();return;}
    if(a==='importStop'){S.importStop=true;toast('Arrêt demandé après le fichier actuel.');return;}
    if(a==='sendIsland'){var ip=S.projects.find(function(p){return p.id===b.dataset.id;});if(ip){S.ui.island=Object.assign({},S.ui.island||{},{on:true});saveUiCfg();ip.islandPin=true;delete ip.leftIsland;ip.islandSeen=true;saveProjectsQuiet();render();}return;}
    if (a === 'dlgYes') { dlgSubmit(); return; }
    if (a === 'dlgNo') { dlgClose(null); return; }
    if (a === 'dreamMin') { dreamMinimized = !dreamMinimized; render(); return; }
    if (a === 'dreamMax') { dreamMaximized = !dreamMaximized; render(); return; }
    if (a === 'dreamClose') { dreamMinimized = false; dreamMaximized = false; S.tab = 'lib'; S.sub = ''; render(); window.scrollTo(0, 0); return; }
    if (a === 'tab') {
      if (b.tagName === 'A') e.preventDefault();
      if (v !== 'idea' && S.inspoTarget) { S.inspoTarget = null; S.pinSel = null; }
      S.tab = v; S.delAsk = false; if (v === 'calc') S.toolSub = ''; render(); window.scrollTo(0, 0);
    }
    else if (a === 'toolSub') { S.toolSub = v; render(); }
    else if (a === 'kcKey') kcKey(v);
    else if (a === 'igGo') igGo();
    else if (a === 'igNew') { igReset(false); render(); }
    else if (a === 'igDevice') {
      if (S.ig.blob) {
        var dlOk=downloadBlob(igFileName(),S.ig.blob);
        if(!dlOk && S.ig.objUrl){
          var dlLink=document.createElement('a');dlLink.href=S.ig.objUrl;dlLink.target='_blank';dlLink.rel='noopener';dlLink.click();
          toast('Le téléchargement automatique a été bloqué : la vidéo a été ouverte dans un nouvel onglet.');
        }
      }
    }
    else if (a === 'igDoc') igToDoc();
    else if (a === 'igPick') { var ipu = S.ig.picker && S.ig.picker[+v]; if (ipu) { S.ig.busy = true; S.ig.picker = null; render(); igUseFile(ipu, S.ig.url).then(function() { S.ig.busy = false; render(); }); } }
    else if (a === 'gridSave') gridSave(false);
    else if (a === 'gridSaveNew') gridSave(true);
    else if (a === 'gridNew') { S.chart.cells[S.chart.mode] = []; S.curGrid = null; S.gridName = ''; keep('carnet.chart', S.chart); render(); }
    else if (a === 'gridOpen') {
      var og = S.grids.find(function(x) { return x.id === b.dataset.id; });
      if (og) { S.chart.mode = og.mode; S.chart.w = og.w; S.chart.h = og.h; S.chart.tool = 0; S.chart.cells[og.mode] = JSON.parse(JSON.stringify(og.cells)); S.curGrid = og.id; S.gridName = og.name; keep('carnet.chart', S.chart); render(); window.scrollTo(0, 0); }
    }
    else if (a === 'gridDel') { removeGridSoft(b.dataset.id); }
    else if (a === 'gridPng') {
      var gc = S.chart.cells[S.chart.mode];
      if (gc && gc.length) drawGrid(gc, S.chart.mode, 32).toBlob(function(bl) { shareOrDownload(((S.gridName || 'grille').replace(/[^\w\- ]+/g, '_')) + '.png', bl, 'image/png'); }, 'image/png');
    }
    else if (a === 'goPj') { S.pjIsland = false; S.pjStage = v; keep('carnet.pjStage', v); S.tab = 'pj'; render(); window.scrollTo(0, 0); }
    else if (a === 'pjStage') { S.pjIsland = false; S.pjStage = v; keep('carnet.pjStage', v); render(); }
    else if (a === 'tmToggle') { var tmp = S.projects.find(function(x) { return x.id === (b.dataset.id || S.curProj); }); if (tmp) tmToggle(tmp); }
    else if (a === 'tmReset') { var tmr = curPj(); if (tmr) { tmr.timer = { acc: 0, start: 0 }; saveProjects(); render(); } }
    else if (a === 'tmLog') {
      var tml = curPj();
      if (tml) { var tms2 = tmMs(tml); if (tms2 < 1000) toast('Le chronomètre est à zéro.'); else { tml.log.unshift({ id: 'e' + uid(), ts: Date.now(), text: 'Temps tricoté : ' + tmFmt(tms2), ms: tms2, photos: [] }); tml.workAt=Date.now(); tml.timer = { acc: 0, start: 0 }; saveProjects(); render(); toast('Temps ajouté au journal.'); } }
    }
    else if (a === 'islandBack') {
      var ibk = S.projects.find(function(x) { return x.id === b.dataset.id; });
      if (ibk) {
        if (!islandCfg().on) toast('Activez d’abord WIP island dans les réglages.');
        else { ibk.islandPin = true; delete ibk.leftIsland; ibk.islandSeen = true; saveProjectsQuiet(); $('#toast').style.display = 'none'; render(); toast('Remis sur WIP island 🏝️'); }
      }
    }
    else if (a === 'rate') {
      var rtp = curPj();
      if (rtp && pjStageOf(rtp) === 'termine') {
        if (!rtp.rating) rtp.rating = {};
        var rk = b.dataset.k, rv = +v; rtp.rating[rk] = rtp.rating[rk] === rv ? 0 : rv;
        saveProjects();
        var rbox = document.querySelector('[data-stars="' + rk + '"]'); if (rbox) rbox.innerHTML = starBtns(rk, rtp.rating[rk]);
        var rav = document.getElementById('ratingAvg'); if (rav) rav.textContent = ratingAvg(rtp) ? '★ ' + ratingAvg(rtp) : '';
      }
    }
    else if (a === 'islandReasonsToggle') { S.islandOpen = S.islandOpen === b.dataset.id ? null : b.dataset.id; render(); }
    else if (a === 'colorOpen') {
      var cpk = b.dataset.key, cpr = curPj(), ctg = cpr && colorTarget(cpr, cpk);
      if (ctg) {
        var cWas = false;
        document.querySelectorAll('.cpal').forEach(function(el) { if (el.dataset.cpal === cpk && !el.hidden) cWas = true; });
        colorPalClose();
        if (!cWas) { var cpe = document.querySelector('[data-cpal="' + cpk + '"]'); if (cpe) { cpe.innerHTML = colorPalHtml(cpk, ctg.hex || ''); cpe.hidden = false; } }
      }
    }
    else if (a === 'colorSet') { colorSet(b.dataset.key, b.dataset.hex, b.dataset.name); colorPalClose(); }
    else if (a === 'inspoFromIdeas') {
      var ifp = curPj();
      if (ifp) { S.inspoTarget = ifp.id; S.pinSel = {}; S.ideaBoard = 'all'; S.ideaTag = 'all'; S.tab = 'idea'; render(); window.scrollTo(0, 0); }
    }
    else if (a === 'inspoPickDone' || a === 'inspoPickCancel') {
      var ipt = S.projects.find(function(x) { return x.id === S.inspoTarget; }), ipN = 0;
      if (ipt && a === 'inspoPickDone') { ipN = inspoAddIdeas(ipt, Object.keys(S.pinSel || {})); saveProjects(); }
      S.inspoTarget = null; S.pinSel = null;
      if (ipt) { S.curProj = ipt.id; S.tab = 'pjd'; }
      render(); window.scrollTo(0, 0);
      if (a === 'inspoPickDone') toast(ipN ? ipN + ' épingle' + (ipN > 1 ? 's' : '') + ' ajoutée' + (ipN > 1 ? 's' : '') + ' à l’inspiration.' : 'Ces épingles étaient déjà dans le projet.');
    }
    else if (a === 'inspoDel') {
      var idp = curPj(), ide = idp && (idp.inspo || []).find(function(x) { return x.id === b.dataset.id; });
      if (ide) {
        if (ide.mediaId && !ide.ideaId) { if (!(await askConfirm('Supprimer cette photo ?', 'Elle sera retirée de l’inspiration de ce projet.', 'Supprimer'))) return; IDB.del(ide.mediaId); }
        idp.inspo = idp.inspo.filter(function(x) { return x.id !== ide.id; });
        saveProjects(); render();
        if (ide.ideaId) toast('Retirée du projet (elle reste dans vos idées).');
      }
    }
    else if (a === 'ideaBoard') { S.ideaBoard = v; render(); }
    else if (a === 'pinSelMode') { S.pinSel = S.pinSel ? null : {}; S.bulkBoard = ''; render(); }
    else if (a === 'pinPick') { if (S.pinSel) { var pk = b.dataset.id; if (S.pinSel[pk]) delete S.pinSel[pk]; else S.pinSel[pk] = 1; render(); } }
    else if (a === 'pinPickAll') { if (S.pinSel) { pinsShown().forEach(function(x) { S.pinSel[x.id] = 1; }); render(); } }
    else if (a === 'pinPickNone') { if (S.pinSel) { S.pinSel = {}; render(); } }
    else if (a === 'pinBulk') { pinBulk(v); }
    else if (a === 'igTest') { igTest(); }
    else if (a === 'pinBoards') { S.pinOpen = S.pinOpen === b.dataset.id ? null : b.dataset.id; render(); }
    else if (a === 'boardNew') {
      var bn = await askName('Nouveau tableau', '', 'Créer', boardNameCheck());
      if (bn) { var nb = { id: uid(), name: bn }; S.boards.push(nb); saveBoards(); S.ideaBoard = nb.id; render(); }
    }
    else if (a === 'boardRen') {
      var rb = S.boards.find(function(x) { return x.id === S.ideaBoard; });
      if (rb) { var rn = await askName('Renommer le tableau', rb.name, 'Renommer', boardNameCheck(rb.id)); if (rn) { rb.name = rn; saveBoards(); render(); } }
    }
    else if (a === 'boardDel') {
      var db = S.boards.find(function(x) { return x.id === S.ideaBoard; });
      var dbn = db ? S.ideas.filter(function(i) { return (i.boards || []).indexOf(db.id) >= 0; }).length : 0;
      if (db && await askConfirm('Supprimer le tableau « ' + db.name + ' » ?', dbn ? (dbn + ' épingle' + (dbn > 1 ? 's sont rangées' : ' est rangée') + ' dans ce tableau. Elles sont conservées, mais ne seront plus classées dans aucun tableau.') : 'Ce tableau est vide. Les épingles ne sont pas concernées.', 'Supprimer')) {
        S.boards = S.boards.filter(function(x) { return x.id !== db.id; });
        S.ideas.forEach(function(i) { if (i.boards) i.boards = i.boards.filter(function(x) { return x !== db.id; }); });
        S.ideaBoard = 'all'; saveBoards(); saveIdeas(); render();
      }
    }
    else if (a === 'newPj') {
      var np = newProject({ stage: S.pjStage === 'island' ? 'wip' : S.pjStage });
      S.curProj = np.id; S.tab = 'pjd'; S.pjDel = false; render(); window.scrollTo(0, 0);
      var nin = $('#pjName'); if (nin) { nin.focus(); nin.select(); }
    }
    else if (a === 'newProjFor') {
      var sp = S.patterns.find(function(x) { return x.id === b.dataset.id; });
      if (sp) { var np2 = newProject({ name: sp.title, patternId: sp.id, stage: 'attente' }); S.curProj = np2.id; S.tab = 'pjd'; S.pjDel = false; render(); window.scrollTo(0, 0); toast('Projet créé, il est « En attente ».'); }
    }
    else if (a === 'openPj') { S.curProj = b.dataset.id; S.tab = 'pjd'; S.pjDel = false; S.pjDelEntry = null; S.pjEdit = null; render(); window.scrollTo(0, 0); }
    else if (a === 'pjStep') { var ps = S.projects.find(function(x) { return x.id === (b.dataset.id || S.curProj); }); if (ps) setPjStage(ps, v); }
    else if (a === 'undoPj') { var up = S.projects.find(function(x) { return x.id === b.dataset.id; }); if (up) { setPjStage(up, up.stagePrev || 'attente', true); $('#toast').style.display = 'none'; } }
    else if (a === 'pjRows') {
      var pr9 = curPj();
      if (pr9) {
        rowsApply(pr9, v === '0' ? 0 : (v === 'x' ? rowStepX() : parseInt(v, 10)));
        saveSoonPj();
        document.querySelectorAll('.counter .big').forEach(function(el) { el.textContent = pr9.rows; });
        pjSubRefresh(pr9);
      }
    }
    else if (a === 'pjGoal') { var pg = curPj(); if (pg) askGoal(pg).then(function(ok) { if (ok) { saveSoonPj(); pjSubRefresh(pg); toast('Objectif de ' + pg.sub.target + ' rangs enregistré.'); } }); }
    else if (a === 'pjXSet') { var pg2 = curPj(); askStepX().then(function(ok) { if (ok && pg2) pjSubRefresh(pg2); }); }
    else if (a === 'pjGoalDrop') { var pg3 = curPj(); if (pg3) askConfirm('Abandonner l’objectif ?', 'Ce compteur précis sera supprimé. Vos rangs restent comptés.', 'Abandonner').then(function(y) { if (y) { pg3.sub = null; saveSoonPj(); pjSubRefresh(pg3); } }); }
    else if (a === 'devAge' || a === 'devReset') {
      var dsel = document.querySelector('[data-dev="pj"]'), dmo = document.querySelector('[data-dev="months"]');
      var dpr = dsel && S.projects.find(function(x) { return x.id === dsel.value; });
      if (!dpr) toast('Choisissez un WIP.');
      else if (a === 'devReset') { delete dpr.devAge; delete dpr.islandSince; saveProjects(); toast('Simulation annulée pour « ' + dpr.name + ' ».'); }
      else {
        var dm = Math.max(1, parseInt(dmo && dmo.value, 10) || 1);
        dpr.devAge = Date.now() - dm * 30.44 * 86400000 - 86400000; delete dpr.islandSince; delete dpr.islandSeen;
        saveProjects();
        toast('« ' + dpr.name + ' » : pause simulée depuis ' + dm + ' mois.' + (islandCfg().on ? '' : ' Activez WIP island pour le voir.'));
      }
    }
    else if (a === 'islandOpen') {
      S.projects.forEach(function(x) { if (isIsland(x)) x.islandSeen = true; });
      saveProjects(); S.pjIsland = true; render(); window.scrollTo(0, 0);
    }
    else if (a === 'islandClose') { S.pjIsland = false; render(); window.scrollTo(0, 0); }
    else if (a === 'islandAck') { S.projects.forEach(function(x) { if (isIsland(x)) x.islandSeen = true; }); saveProjects(); render(); }
    else if (a === 'pjEditEntry') { S.pjEdit = b.dataset.id; S.pjDelEntry = null; render(); }
    else if (a === 'pjEditCancel') { S.pjEdit = null; render(); }
    else if (a === 'pjEditSave') {
      var epr = curPj(), een = epr && (epr.log || []).find(function(x) { return x.id === b.dataset.id; });
      if (een) {
        var etx = ($('#pjEditText') ? $('#pjEditText').value : '').trim(), ets = new Date($('#pjEditTs') ? $('#pjEditTs').value : '').getTime();
        if (!etx && !(een.photos || []).length) toast('Écrivez un texte, ou supprimez l\'entrée.');
        else {
          een.text = etx;
          if (!isNaN(ets)) een.ts = ets;
          epr.log.sort(function(x, y) { return (y.ts || 0) - (x.ts || 0); });
          S.pjEdit = null; saveProjects(); render(); toast('Entrée modifiée ✓');
        }
      }
    }
    else if (a === 'yarnInc') {
      var ypc = curPj(), yyc = ypc && pjYarns(ypc).find(function(x) { return x.id === b.dataset.id; });
      if (yyc) {
        yyc.used = Math.max(0, (yyc.used || 0) + (parseInt(v, 10) || 0));
        document.querySelectorAll('[data-yused="' + yyc.id + '"]').forEach(function(el) { el.textContent = yarnCountTxt(yyc); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); });
        var skc = document.querySelector('[data-skeins]');
        if (skc) { skc.textContent = pjSkeinsTxt(ypc); skc.classList.remove('pop'); void skc.offsetWidth; skc.classList.add('pop'); }
        saveSoonPj();
      }
    }
    else if (a === 'yarnAdd') {
      var ypa = curPj();
      if (ypa) {
        var nyy = { id: 'y' + uid(), name: '', used: 0 };
        pjYarns(ypa).push(nyy); saveProjects();
        var yla = document.getElementById('yarnList');
        if (yla) { yla.insertAdjacentHTML('beforeend', yarnRowHtml(nyy)); var nin = yla.querySelector('[data-yn="' + nyy.id + '"]'); if (nin) nin.focus(); }
      }
    }
    else if (a === 'yarnDel') {
      var ypd = curPj(), yfd = ypd && pjYarns(ypd).find(function(x) { return x.id === b.dataset.id; });
      if (yfd) {
        var yok = true;
        if (yfd.name || yfd.used || yfd.brand || yfd.color) yok = await askConfirm('Retirer ce fil ?', '« ' + (yfd.name || 'Fil sans nom') + ' »' + (yfd.used ? ' et son compteur (' + yfd.used + ' pelote' + (yfd.used > 1 ? 's' : '') + ')' : '') + ' seront supprimés du projet.', 'Retirer');
        if (yok) {
          ypd.yarns = pjYarns(ypd).filter(function(x) { return x.id !== yfd.id; });
          var yrw = document.querySelector('[data-yrow="' + yfd.id + '"]'); if (yrw) yrw.remove();
          var skd = document.querySelector('[data-skeins]'); if (skd) skd.textContent = pjSkeinsTxt(ypd);
          saveProjects();
        }
      }
    }
    else if (a === 'plannedColorAdd') {
      var pca = curPj();
      if (pca) { if (!Array.isArray(pca.plannedColors)) pca.plannedColors = []; var npc = { id: 'pc' + uid(), hex: '', name: '', yarn: 'À définir' }; pca.plannedColors.push(npc); S.colorOpen = 'p:' + npc.id; saveProjects(); render(); }
    }
    else if (a === 'plannedColorDel') {
      var pcd = curPj();
      if (pcd) { pcd.plannedColors = (pcd.plannedColors || []).filter(function(x) { return x.id !== b.dataset.id; }); saveProjects(); render(); }
    }
    else if (a === 'pjAddNote') {
      var pr8 = curPj();
      if (pr8) { if (!S.pjDraft.trim()) toast('Écrivez une entrée d\'abord.'); else { pr8.log.unshift({ id: 'e' + uid(), ts: Date.now(), text: S.pjDraft.trim(), photos: [] }); S.pjDraft = ''; saveProjects(); render(); } }
    }
    else if (a === 'pjDelEntry') { S.pjDelEntry = b.dataset.id; render(); }
    else if (a === 'pjDelEntryNo') { S.pjDelEntry = null; render(); }
    else if (a === 'pjDelEntryYes') {
      var pr7 = curPj();
      if (pr7) { var en = pr7.log.find(function(x) { return x.id === b.dataset.id; }); if (en) (en.photos || []).forEach(function(id) { IDB.del(id); }); pr7.log = pr7.log.filter(function(x) { return x.id !== b.dataset.id; }); saveProjects(); }
      S.pjDelEntry = null; render();
    }
    else if (a === 'pjCar') {
      var cw = b.closest('.pjcw'), car = cw && cw.querySelector('.pjcar');
      if (car) car.scrollBy({ left: (+v) * car.clientWidth * 0.75, behavior: 'smooth' });
    }
    else if (a === 'pjPhotoDel') {
      var pr9 = curPj(), pid9 = b.dataset.id;
      if (pr9 && confirm('Supprimer cette photo ?')) {
        if (pr9.cover === pid9) pr9.cover = '';
        pr9.photos = (pr9.photos || []).filter(function(x) { return x !== pid9; });
        IDB.del(pid9); saveProjects(); render();
      }
    }
    else if (a === 'pjCoverDel') { var pr6 = curPj(); if (pr6 && pr6.cover) { IDB.del(pr6.cover); pr6.cover = ''; saveProjects(); render(); } }
    else if (a === 'pjDel') { S.pjDel = true; render(); }
    else if (a === 'pjDelNo') { S.pjDel = false; render(); }
    else if (a === 'pjDelYes') {
      var pr5 = curPj();
      if (pr5) {
        var pi5 = S.projects.indexOf(pr5);
        S.projects.splice(pi5, 1);
        saveProjects(); S.curProj = null; S.pjDel = false; S.tab = 'pj'; render();
        deferDelete('Projet supprimé.', function() { S.projects.splice(Math.min(pi5, S.projects.length), 0, pr5); saveProjects(); }, function() {
          if (pr5.cover) IDB.del(pr5.cover);
          (pr5.photos || []).forEach(function(id) { IDB.del(id); });
          (pr5.inspo || []).forEach(function(e) { if (e.mediaId && !e.ideaId) IDB.del(e.mediaId); });
          (pr5.log || []).forEach(function(en2) { (en2.photos || []).forEach(function(id) { IDB.del(id); }); });
        });
      }
    }
    else if (a === 'lightbox') { lbOpen(b); }
    else if (a === 'lbClose') { lbClose(); }
    else if (a === 'lbPrev') { lbStep(-1); }
    else if (a === 'lbNext') { lbStep(1); }
    else if (a === 'rgRun') {
      var g0 = S.rg, st = parseFloat(g0.sts) || 20, rw = parseFloat(g0.rows) || 28, wd = parseFloat(g0.width) || 48, ht = parseFloat(g0.height) || 38;
      g0.res = { sts: st, rws: rw, width: wd, height: ht, cast: even(wd * st / 10), rows: Math.round(ht * rw / 10), garment: g0.garment };
      render();
    }
    else if (a === 'ctool') { S.chart.tool = parseInt(v, 10) || 0; keep('carnet.chart', S.chart); render(); }
    else if (a === 'cell') {
      var cr = +b.dataset.r, cx = +b.dataset.c, tl = chartTools(S.chart.mode)[S.chart.tool], val = tl[1];
      S.chart.cells[S.chart.mode][cr][cx] = val;
      if (S.chart.mode === 'color') b.style.background = val; else b.textContent = val;
      keep('carnet.chart', S.chart);
    }
    else if (a === 'cclear') { S.chart.cells[S.chart.mode] = []; keep('carnet.chart', S.chart); render(); }
    else if (a === 'toggleGrp') {
      var gid = b.dataset.gid;
      if (gid) {
        // Les groupes sont repliés par défaut : undefined signifie donc
        // « replié ». Il faut enregistrer explicitement 0 pour les ouvrir.
        var currentlyCollapsed = S.collapsedGroups[gid] !== undefined
          ? !!S.collapsedGroups[gid]
          : true;
        S.collapsedGroups[gid] = currentlyCollapsed ? 0 : 1;
        saveCollapsed();
        render();
      }
    }
    else if (a === 'collapseAll') {
      groupsOf(filteredPatterns(), S.group).forEach(function(g) {
        S.collapsedGroups[groupCollapseId(g)] = 1;
      });
      saveCollapsed();
      render();
    }
    else if (a === 'expandAll') {
      groupsOf(filteredPatterns(), S.group).forEach(function(g) {
        delete S.collapsedGroups[groupCollapseId(g)];
      });
      saveCollapsed();
      render();
    }
    else if (a === 'testAi') testProviderKey(v);
    else if (a === 'dreamPal') { var dpl = DREAM_PALETTES[+v]; if (dpl) { S.ui.dream = Object.assign({}, dpl[1]); saveUiCfg(); render(); } }
    else if (a === 'setAccent') { S.ui.accent = v; saveUiCfg(); render(); }
    else if (a === 'resetColors') { S.ui.bgColor = ''; S.ui.surfaceColor = ''; S.ui.accent = '#2A47C9'; saveUiCfg(); render(); toast('Couleurs réinitialisées.'); }
    else if (a === 'clearWallpaper') {
      if (S.ui.wallpaperId) IDB.del(S.ui.wallpaperId);
      S.ui.wallpaperId = ''; saveUiCfg(); render(); toast('Fond d\'écran retiré.');
    }
    else if (a === 'setPw') {
      var pw = ($('#newPwIn').value || '').trim();
      if (!pw) { toast('Saisissez un mot de passe.'); return; }
      if (pw.length < PW_MIN) { toast('Le mot de passe doit faire au moins ' + PW_MIN + ' caractères.'); return; }
      if (!pwSupported()) { toast('Le verrou nécessite une connexion HTTPS : ce navigateur ne le permet pas ici.'); return; }
      S.pwHash = await hashPw(pw);
      keep('carnet.pwHash', S.pwHash);
      pwFailSet(null);
      S.unlocked = true;
      render();
      toast('Mot de passe enregistré !');
    }
    else if (a === 'removePw') {
      S.pwHash = ''; keep('carnet.pwHash', ''); pwFailSet(null); S.unlocked = true; render(); toast('Verrou désactivé.');
    }
    else if (a === 'lockNow') {
      S.unlocked = false; syncLockScreen();
    }
    else if (a === 'copySr') {
      var res = computeShortRows();
      if (!res.error) {
        var txt = res.steps.join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(function() { toast('Instructions copiées !'); }).catch(function() {
            var ta = document.createElement('textarea');
            ta.value = txt;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            toast('Instructions copiées !');
          });
        } else {
          var ta2 = document.createElement('textarea');
          ta2.value = txt;
          document.body.appendChild(ta2);
          ta2.select();
          document.execCommand('copy');
          document.body.removeChild(ta2);
          toast('Instructions copiées !');
        }
      }
    }
    else if (a === 'docFind') { S.docQ = b.dataset.q || ''; S.docSearch = true; S.tab = 'doc'; render(); window.scrollTo(0, 0); }
    else if (a === 'docSearch') {
      S.docSearch = !S.docSearch; if (!S.docSearch) S.docQ = '';
      render();
      if (S.docSearch) { var dqi = $('#docQ'); if (dqi) dqi.focus(); }
    }
    else if (a === 'docToggleEditor') { S.docEditorOpen = !S.docEditorOpen; render(); }
    else if (a === 'docSave') {
      var d = S.docDraft;
      if (!d.title.trim() && !d.content.trim() && !d.media.length) { toast('Ajoutez un titre, du texte ou une vidéo.'); return; }
      S.docs.unshift({ id: uid(), title: d.title.trim() || 'Article sans titre', category: d.category, content: d.content, media: d.media, created: Date.now() });
      saveDocs();
      S.docDraft = { title: '', category: 'Technique', content: '', media: [] };
      S.docEditorOpen = false;
      render();
      toast('Article publié !');
    }
    else if (a === 'docDel') {
      var rdd = +b.dataset.i, remDoc = S.docs.splice(rdd, 1)[0];
      saveDocs(); render();
      if (remDoc) deferDelete('Article supprimé.', function() { S.docs.splice(Math.min(rdd, S.docs.length), 0, remDoc); saveDocs(); }, function() { if (remDoc.media) remDoc.media.forEach(function(m) { IDB.del(m.id); }); });
    }
    else if (a === 'ideaAdd') {
      var idr = S.ideaDraft;
      if (!idr.title.trim() && !idr.note.trim() && !idr.mediaId) { toast('Ajoutez une photo, un titre ou une note.'); return; }
      S.ideas.unshift({ id: uid(), title: idr.title.trim(), tag: idr.tag, note: idr.note.trim(), mediaId: idr.mediaId, mediaType: idr.mediaType, boards: (S.ideaBoard !== 'all' && S.ideaBoard !== 'none') ? [S.ideaBoard] : [], created: Date.now() });
      saveIdeas();
      S.ideaDraft = { title: '', note: '', tag: 'Inspiration', mediaId: '', mediaType: '' };
      render();
      toast('Idée épinglée !');
    }
    else if (a === 'ideaDel') {
      var rdi = +b.dataset.i, remIdea = S.ideas.splice(rdi, 1)[0];
      saveIdeas(); render();
      if (remIdea) deferDelete('Épingle supprimée.', function() { S.ideas.splice(Math.min(rdi, S.ideas.length), 0, remIdea); saveIdeas(); }, function() { if (remIdea.mediaId) IDB.del(remIdea.mediaId); });
    }
    else if (a === 'fStatus') { S.fStatus = v; render(); }
    else if (a === 'fStage') { S.fStage = (S.fStage === v ? 'all' : v); render(); }
    else if (a === 'stage') { var sp0 = S.patterns.find(function(x) { return x.id === b.dataset.id; }); if (sp0) setStage(sp0, v); }
    else if (a === 'undoDel') { undoPend(); }
    else if (a === 'undoStage') {
      var up0 = S.patterns.find(function(x) { return x.id === b.dataset.id; });
      if (up0) { var pv = up0.stagePrev || 'attente'; setStage(up0, pv, true); $('#toast').style.display = 'none'; }
    }
    else if (a === 'resultPhoto') { openP(b.dataset.id); S.sub = 'photos'; render(); }
    else if (a === 'fileAuthor') {
      var fp = S.patterns.find(function(x) { return x.id === b.dataset.id; });
      if (fp && fp.f.designer) { fp.folder = folderFor(normAuthor(fp.f.designer)).id; persist(); render(); toast('Patron rangé.'); }
    }
    else if (a === 'bkHide') { S.bkHide = true; render(); }
    else if (a === 'fullBackup') fullBackup();
    else if (a === 'dupBoth' && D) { D.step = 2; renderDupe(); }
    else if (a === 'dupNo' && D) { D.step = 3; renderDupe(); }
    else if (a === 'dupBack' && D) { D.step = 1; D.err = ''; renderDupe(); }
    else if (a === 'dupKeepOld' && D) closeDupe({ action: 'old' });
    else if (a === 'dupKeepNew' && D) closeDupe({ action: 'new' });
    else if (a === 'dupOk' && D) {
      var on = (D.oldName || '').trim().replace(/\.pdf$/i, ''), nn = (D.newName || '').trim().replace(/\.pdf$/i, '');
      if (!on || !nn) D.err = 'Les deux noms sont obligatoires.';
      else if (dupKey(on) === dupKey(nn)) D.err = 'Les deux noms doivent être différents.';
      else if (nameTaken(on, D.old.id)) D.err = 'Le nom de l\'ancien PDF est déjà utilisé par un autre patron.';
      else if (nameTaken(nn, D.old.id)) D.err = 'Le nom du nouveau PDF est déjà utilisé par un autre patron.';
      else { closeDupe({ action: 'both', oldName: on, newName: nn }); return; }
      renderDupe();
    }
    else if (a === 'fDiff') { S.fDiff = (S.fDiff === v ? 'all' : v); render(); }
    else if (a === 'resetFilters') { S.q = ''; S.fStatus = 'all'; S.fDiff = 'all'; S.fStage = 'all'; render(); }
    else if (a === 'open') openP(b.dataset.id);
    else if (a === 'back') { if (p) persist(); S.tab = 'lib'; render(); window.scrollTo(0, 0); }
    else if (a === 'sub') { S.sub = v; render(); }
    else if (a === 'toggleEdit') { S.editMode = !S.editMode; if (S.editMode) S.sub = 'fiche'; render(); }
    else if (a === 'setActiveSize') { S.activeSize = v; render(); }
    else if (a === 'tv') { S.tv = v; render(); }
    else if (a === 'chip' && p) {
      var f = ALLF.find(function(x) { return x.k === b.dataset.k; }), arr = (p.f[f.k] || []).slice(), i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1);
      else arr.push(v);
      if (f.k === 'sizes') arr.sort(function(x, y) { return SIZES.indexOf(x) - SIZES.indexOf(y); });
      if (arr.length) p.f[f.k] = arr;
      else delete p.f[f.k];
      persist();
      if (f.k === 'sizes') render();
      else { b.classList.toggle('on'); refreshMeta(p); }
    }
    else if (a === 'paste') {
      var tx = ($('#pasteText').value || '').trim();
      if (!tx) { toast('Collez d\'abord du texte.'); return; }
      var np = newPattern(($('#pasteTitle').value || '').trim() || 'Patron collé', tx.slice(0, 90000), { pasted: 1 });
      S.patterns.unshift(np);
      persist();
      openP(np.id);
    }
    else if (a === 'favAuth') {
      var fk2 = b.dataset.a, fi = S.favAuthors.indexOf(fk2);
      if (fi >= 0) S.favAuthors.splice(fi, 1); else S.favAuthors.push(fk2);
      keep('carnet.favAuthors', S.favAuthors); render();
    }
    else if (a === 'tnSave') {
      var tnPr = journalToolProject(), tnTxt = toolNoteText();
      if (!tnPr) toast('Choisissez d’abord un WIP.');
      else if (!tnTxt) toast('Rien à enregistrer : générez d’abord un résultat avec l’outil.');
      else {
        if (!Array.isArray(tnPr.log)) tnPr.log = [];
        var tnDesc=(S.toolJournalDescription||'').trim();
        tnPr.log.unshift({ id: 'e' + uid(), ts: Date.now(), text: tnTxt+(tnDesc?'\n\nNotes : '+tnDesc:''), photos: [] });
        S.toolJournalDescription='';
        saveProjectsQuiet();
        toast('Ajouté au journal de « ' + tnPr.name + ' » ✓');
        render();
      }
    }
    else if (a === 'favPat') {
      var fpp = S.patterns.find(function(x) { return x.id === b.dataset.id; });
      if (fpp) {
        if (fpp.fav) delete fpp.fav; else fpp.fav = true;
        persist(); render();
        toast(fpp.fav ? 'Ajouté aux favoris ★' : 'Retiré des favoris');
      }
    }
    else if (a === 'grp') { S.group = v; keep('carnet.group', v); render(); }
    else if (a === 'addF') {
      var nm = ($('#newFolder').value || '').trim();
      if (nm) { S.folders.push({ id: 'd' + uid(), name: nm, created: Date.now() }); saveFolders(); render(); }
    }
    else if (a === 'renF') { S.renameId = b.dataset.id; S.delF = null; render(); }
    else if (a === 'renCancel') { S.renameId = null; render(); }
    else if (a === 'renSave') {
      var rn = ($('#renameIn').value || '').trim(), rf = S.folders.find(function(f) { return f.id === b.dataset.id; });
      if (rf && rn) { rf.name = rn; saveFolders(); }
      S.renameId = null; render();
    }
    else if (a === 'delF') { removeFolderSoft(b.dataset.id); }
    else if (a === 'autoAuthor') { autoFileAll('author'); render(); }
    else if (a === 'autoGarment') { autoFileAll('garment'); render(); }
    else if (a === 'viewPdf') {
      var vp = S.patterns.find(function(x) { return x.id === b.dataset.id; });
      if (vp) {
        if (pdfs.has(vp.id) || (vp.source && vp.source.pdf)) openViewer(vp, b.dataset.pj);
        else { openP(vp.id); S.sub = 'texte'; render(); }
      }
    }
    else if (a === 'vclose') closeViewer();
    else if (a === 'vzoomin') setZoom(V.zoom * 1.25);
    else if (a === 'vzoomout') setZoom(V.zoom / 1.25);
    else if (a === 'vmark') vToolSet('mark');
    else if (a === 'vhl') vToolSet('hl');
    else if (a === 'vsm') vToolSet('sm');
    else if (a === 'pdfNoteClear') { S.pdfNote = ''; var pnt = $('#pdfNoteText'); if (pnt) { pnt.value = ''; pnt.focus(); } }
    else if (a === 'pdfNoteSave') {
      var npr = VRC.pr, ntx = (S.pdfNote || '').trim();
      if (!npr) toast('Ouvrez le PDF depuis un projet en cours pour écrire dans son journal.');
      else if (!ntx) toast('Écrivez une note d’abord.');
      else {
        if (!Array.isArray(npr.log)) npr.log = [];
        var nctx = noteCtx(npr);
        npr.log.unshift({ id: 'e' + uid(), ts: Date.now(), text: (nctx ? nctx + ' — ' : '') + ntx, photos: [] });
        npr.workAt = Date.now(); S.pdfNote = ''; saveProjectsQuiet();
        toast('Note ajoutée au journal de « ' + (npr.name || 'ce projet') + ' » ✓');
        returnToPdf();
      }
    }
    else if (a === 'cancel') { if(S.importRunning){S.importStop=true;toast('Arrêt demandé après le fichier actuel.');return;} if (S.ctl) S.ctl.abort(); S.busy = ''; render(); }
    else if (a === 'aiFill' && p) analyze(p);
    else if (a === 'aiRe' && p) analyze(p, { over: true });
    else if (a === 'aiVisual' && p) aiVisual(p);
    else if (a === 'addOpt' && p) {
      p.opts = p.opts || [];
      p.opts.push({ id: uid(), group: 'Manches', name: '', desc: '', f: {}, measures: {}, counts: {}, ai: 0 });
      S.open.opts = 1; persist(); render();
    }
    else if (a === 'delOpt' && p) { p.opts.splice(+b.dataset.i, 1); persist(); render(); }
    else if (a === 'aiPhoto' && p) aiPhoto(p);
    else if (a === 'aiRead' && p) readAndAnalyze(p);
    else if (a === 'delPhoto' && p) {
      var rem = p.photos.splice(+b.dataset.i, 1)[0];
      if (rem && rem.id) IDB.del(rem.id);
      persist(); render();
    }
    else if (a === 'delAsk') { S.delAsk = true; render(); }
    else if (a === 'delNo') { S.delAsk = false; render(); }
    else if (a === 'delYes' && p) { removePSoft(p); S.tab = 'lib'; S.cur = null; S.delAsk = false; render(); }
    else if (a === 'zip') exportZip();
    else if (a === 'file') {
      var fl = buildFiles();
      downloadBlob(v, fl[v]);
    }
  });

  /* Support clavier Entrée/Espace sur les en-têtes de dossiers pliables */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !$('#viewer').hidden) { if(S.pdfToolReturn) returnToPdf(); else closeViewer(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('gh')) {
      e.preventDefault();
      e.target.click();
    }
  });

  /* Glisser-déposer PDF & Photos */
  document.addEventListener('dragover', function(e) {
    var dz = e.target.closest('#pdfDrop, #photoDrop');
    if (dz) { e.preventDefault(); dz.classList.add('dragover'); }
  });
  document.addEventListener('dragleave', function(e) {
    var dz = e.target.closest('#pdfDrop, #photoDrop');
    if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('dragover');
  });
  document.addEventListener('drop', function(e) {
    var pdfDz = e.target.closest('#pdfDrop');
    if (pdfDz) {
      e.preventDefault(); pdfDz.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files));
      return;
    }
    var photoDz = e.target.closest('#photoDrop');
    if (photoDz && cur()) {
      e.preventDefault(); photoDz.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        var imgs = Array.from(e.dataTransfer.files).filter(function(f) { return f.type.indexOf('image/') === 0; });
        if (imgs.length) addPhotos(cur(), imgs, 'modele');
      }
    }
  });

  (function() {
    var sc = $('#vscroll'), ticking = false;
    sc.addEventListener('scroll', function() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function() { ticking = false; pageLabel(); renderVisible(); vposSave(); });
      var rc = $('#vrc'); rc.classList.add('scrolling');
      clearTimeout(rc._t); rc._t = setTimeout(function() { rc.classList.remove('scrolling'); }, 450);
    }, { passive: true });
  })();

  /* préchauffe pdf.js quand le navigateur est au repos (ouverture du PDF plus rapide) */
  window.addEventListener('load', function() {
    setTimeout(function() {
      (window.requestIdleCallback || function(f) { f(); })(function() {
        if (S.patterns.some(function(p) { return p.source && p.source.pdf; })) pdfLib().catch(function() {});
      });
    }, 2500);
  });

  async function restoreAuxiliary() {
    for(var k of ['projects','folders','docs','ideas','boards','grids','scratchpad','ui']) {
      try { var raw=await IDB.get('meta_kv_carnet.'+k); if(raw) S[k]=JSON.parse(raw); } catch(e) {console.warn(e);}
    }
  }
  setInterval(function() {if(booted && !S.importRunning && S.patterns.length && document.visibilityState==='visible') safetySnapshot().catch(storageFailure);},300000);
  var booted = false;
  function restoreFromMirror() {
    return restoreAuxiliary().then(function() { return IDB.get('meta_patterns').then(function(m) {
      if (!m) return;
      var o = JSON.parse(m);
      var lsTs = load('carnet.ts', 0);
      if (o && Array.isArray(o.list) && o.list.length && (!S.patterns.length || (o.ts || 0) > lsTs)) {
        S.patterns = o.list;
        keep('carnet.patterns', o.list);
        keep('carnet.ts', o.ts || Date.now());
      }
    }).catch(function() {}).then(function() {
      return IDB.get('meta_projects').then(function(m) {
        if (m && !S.projects.length) { var l = JSON.parse(m); if (Array.isArray(l)) { S.projects = l; keep('carnet.projects', l); } }
      }).catch(function() {});
    }).then(function() {
      return IDB.get('meta_grids').then(function(m) {
        if (m && !S.grids.length) { var l = JSON.parse(m); if (Array.isArray(l)) { S.grids = l; keep('carnet.grids', l); } }
      }).catch(function() {});
    }).then(function() {
      return IDB.get('meta_folders').then(function(m) {
        if (m && !S.folders.length) { var f = JSON.parse(m); if (Array.isArray(f)) { S.folders = f; keep('carnet.folders', f); } }
      }).catch(function() {});
    }); });
  }
  IDB.open().catch(function() {}).then(restoreFromMirror).then(function() {
    migrateStages();
    migratePjV32();
    if (S.patterns.length) persist();
    checkStorage();
  }).finally(function() {
    booted = true;
    applyAppearance();
    syncLockScreen();
    render();
  });
  setTimeout(function() {
    if (booted) return;
    applyAppearance();
    syncLockScreen();
    render();
  }, 2500);
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', function() { navigator.serviceWorker.register('sw.js').catch(function() {}); });
  }
})();
