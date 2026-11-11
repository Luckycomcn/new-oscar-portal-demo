// Messages used by the retained pages. Untranslated messages use English fallback.
export default {
  "nav": {
    "home": "Accueil",
    "search": "Recherche",
    "export": "Exporter",
    "language": "Langue"
  },
  "header": {
    "wmo1": "ORGANISATION",
    "wmo2": "MÉTÉOROLOGIQUE",
    "wmo3": "MONDIALE",
    "brandName": "OSCAR-Next",
    "brandSub1": "Nouvelle génération",
    "brandSub2": "Métadonnées WIGOS",
    "brandSub3": "Portail du système"
  },
  "footer": {
    "version": "Version : {version}",
    "disclaimer": "Les images et les données du catalogue restent la propriété de leurs fournisseurs. Ce portail ne représente pas l’OMM et ne bénéficie pas de son approbation.",
    "attribution": "Portail de démonstration indépendant"
  },
  "common": {
    "search": "Rechercher",
    "searching": "Recherche en cours...",
    "reset": "Réinitialiser",
    "retry": "Réessayer",
    "loading": "Chargement...",
    "clear": "Effacer",
    "close": "Fermer",
    "download": "Télécharger",
    "generating": "Génération en cours...",
    "all": "Tous",
    "list": "Liste",
    "map": "Carte",
    "unknown": "Inconnu",
    "nextPage": "Page suivante",
    "previousPage": "Page précédente",
    "recordsPerPage": "Enregistrements par page",
    "noResults": "Aucun résultat.",
    "noData": "Aucune donnée ({count} racines chargées)",
    "searchPlaceholder": "Rechercher"
  },
  "route": {
    "home": "Page d’accueil",
    "search": "Recherche",
    "station": "Station",
    "stationSearch": "Recherche de stations",
    "stationReport": "Rapport de station",
    "export": "Exporter et télécharger"
  },
  "sidebar": {
    "quickAccess": "Accès rapide",
    "generateReportBy": "Générer un rapport de station par :",
    "generateListsBy": "Générer des listes de stations par :",
    "byProgram": "Par programme / réseau :",
    "byReportingStatus": "Par état de transmission :",
    "stationName": "Nom de la station",
    "wigosId": "Identifiant de station WIGOS",
    "country": "Pays",
    "type": "Type",
    "class": "Classe",
    "programNetwork": "Programme / réseau",
    "reportingStatus": "État de transmission",
    "declared": "Déclaré",
    "assessed": "Évalué",
    "expandSidebar": "Développer le panneau latéral",
    "collapseSidebar": "Réduire le panneau latéral",
    "program": {
      "wigos": "Composantes du WIGOS",
      "coSponsored": "Composantes coparrainées",
      "other": "Autres composantes",
      "nonAffiliated": "Non affilié"
    },
    "status": {
      "operational": "Opérationnelle",
      "partlyOperational": "Partiellement opérationnelle",
      "unknown": "Inconnu",
      "silent": "Silencieuse",
      "closed": "Fermée"
    }
  },
  "home": {
    "title": "Bienvenue sur le portail du système de métadonnées WIGOS",
    "desc": "Le portail du système de métadonnées WIGOS fournit des informations sur les stations d’observation météorologique du monde entier et permet la recherche, la cartographie et la gestion des données WIGOS.",
    "searchPlaceholder": "Rechercher par nom, alias ou identifiant WIGOS...",
    "search": "Rechercher",
    "advancedSearch": "Recherche avancée",
    "stats": {
      "totalStations": "Nombre total de stations",
      "totalStationsNote": "(déclarées + évaluées)",
      "countries": "Pays / territoires",
      "countriesNote": "avec des stations déclarantes",
      "observationTypes": "Types d’observation",
      "observationTypesNote": "Types du catalogue",
      "lastUpdate": "Dernière mise à jour",
      "lastUpdateNote": "(UTC)"
    },
    "searchRemoteError": "La recherche dans le catalogue a échoué. Veuillez réessayer. Aucun résultat de démonstration n’est affiché.",
    "typeCountError": "Impossible de récupérer le nombre de types de stations renseignés.",
    "hint": {
      "none": "Aucune station trouvée pour « {term} ». Toutes les stations sont affichées.",
      "found": "{count} stations trouvées, « {name} » ({id}) localisée. Affinez les mots-clés pour une correspondance précise."
    }
  },
  "search": {
    "criteria": "Critères",
    "keyword": "Mot-clé / identifiant de station WIGOS",
    "keywordPlaceholder": "Nom, alias ou 0-20000-0-60415",
    "results": "Résultats",
    "remoteCount": "{count} enregistrements dans le catalogue de ressources de l’OMM",
    "remoteNote": "{count} enregistrements sur {total} correspondances · horodatage du catalogue {date}",
    "remoteError": "Impossible d’interroger le catalogue de ressources de l’OMM : {message}",
    "loadingRemote": "Chargement des stations du catalogue de ressources de l’OMM…",
    "activeCriteria": "Critères actifs : {value}",
    "none": "aucun",
    "noMatching": "Aucune station correspondante. Modifiez ou réinitialisez les critères.",
    "pagination": "{page} / {count} · {total}",
    "filterAria": "Filtrer les stations",
    "resultsDisplayMode": "Mode d’affichage des résultats",
    "field": {
      "type": "Type de station",
      "program": "Affiliation au programme / réseau",
      "variable": "Variable observée",
      "region": "Région OMM",
      "territory": "Pays / territoire"
    },
    "th": {
      "stationName": "Nom de la station",
      "type": "Type",
      "territory": "Pays / territoire",
      "position": "Position",
      "status": "État",
      "program": "Programme / réseau"
    }
  },
  "export": {
    "title": "Exportation et interopérabilité",
    "sub": "Les résultats peuvent être exportés en CSV et JSON ; une fiche peut être téléchargée au format WMDR V2 (JSON). Pour un accès automatisé, interrogez directement le catalogue via OGC API - Records.",
    "remoteError": "Échec de la requête au catalogue : {message}. Aucun fichier généré. Veuillez réessayer.",
    "noQuery": "Effectuez une recherche de stations avant d’exporter les résultats filtrés.",
    "progress": "Récupération des enregistrements : {count} / {total}",
    "generated": "{count} enregistrements générés. Vérifiez l’aperçu puis cliquez sur Télécharger. L’aperçu est limité à 12 000 caractères.",
    "cancelled": "Exportation annulée. Aucun fichier généré.",
    "cancel": "Annuler l’exportation",
    "bulkTitle": "Exportation groupée des résultats",
    "scope": "Périmètre d’exportation",
    "scopeFiltered": "Enregistrements filtrés ({count})",
    "scopeAll": "Tous les enregistrements du catalogue ({count})",
    "format": "Format",
    "fields": "Champs",
    "fieldsMandatory": "Champs récapitulatifs de station",
    "fieldsFull": "Ensemble complet des éléments",
    "generateExport": "Générer l’exportation",
    "download": "Télécharger",
    "recordsToExport": "{count} enregistrements à exporter",
    "wmdrTitle": "Téléchargement d’une fiche WMDR v2",
    "wmdrNote": "Récupérez la fiche GeoJSON / WMDR2 originale avec son identifiant WIGOS complet. Aucun modèle ni donnée aléatoire.",
    "wigosStationIdentifier": "Identifiant de station WIGOS",
    "guideTitle": "Guide d’accès automatisé",
    "guideNote": "L’API est fournie par le catalogue via OGC API - Records ; le portail enregistre uniquement des pages et des fichiers d’exportation.",
    "demoNote": "Connecté au catalogue en ligne. Les exportations récupèrent 250 enregistrements par page et peuvent être annulées. Le CSV est converti depuis les enregistrements de l’API ; le téléchargement utilise les mêmes données que l’aperçu."
  },
  "map": {
    "filteredSnapshot": "Carte filtrée : instantané du {date} UTC · {count} stations dans cette vue (points denses regroupés)",
    "overviewSnapshot": "Aperçu des stations (points denses regroupés), instantané : {date} UTC",
    "overviewUnmapped": "{count} fiches sans coordonnées ponctuelles valides",
    "overviewZoomHint": "Cliquez sur ce point pour zoomer et consulter les stations.",
    "identifying": "Veuillez patienter, identification des stations...",
    "wigosId": "Identifiant de station WIGOS",
    "stationType": "Type de station",
    "declaredStatus": "État déclaré de la station",
    "programStatuses": "États déclarés des programmes",
    "dateEstablished": "Date de création de la station",
    "dateClosed": "Date de fermeture de la station",
    "stationReport": "Rapport de station",
    "openStationReport": "Ouvrir le rapport de station",
    "zoomIn": "Zoom avant",
    "zoomOut": "Zoom arrière",
    "resetView": "Réinitialiser la vue",
    "basemap": "Fond de carte",
    "basemapOsm": "International · OpenStreetMap",
    "basemapAmap": "Chine · AMap",
    "basemapTianditu": "Chine · Tianditu",
    "basemapMissingKey": "Demandez à votre administrateur de configurer les identifiants de ce fond de carte.",
    "basemapLoadError": "Impossible de charger ce fond de carte. Vérifiez le réseau et la configuration du service.",
    "legend": {
      "air": "air",
      "landOcean": "surface terrestre ou océanique",
      "subsurface": "sous la surface",
      "lake": "lac ou rivière"
    }
  },
  "menu": {
    "home": "Accueil",
    "search": "Recherche"
  },
  "searchNav": {
    "station": "Station"
  },
  "stationReport": {
    "programNote": "Les affiliations aux programmes et réseaux proviennent des métadonnées de la station. Leur disponibilité et leur statut dépendent de la fiche source."
  }
}
