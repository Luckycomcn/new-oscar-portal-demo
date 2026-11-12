// Messages used by the retained pages. Untranslated messages use English fallback.
export default {
  "nav": {
    "home": "Inicio",
    "search": "Buscar",
    "export": "Exportar",
    "language": "Idioma"
  },
  "header": {
    "portalName": "Portal de metadatos WIGOS",
    "portalTagline": "Sistemas mundiales de observación",
    "wmo1": "ORGANIZACIÓN",
    "wmo2": "METEOROLÓGICA",
    "wmo3": "MUNDIAL",
    "brandName": "OSCAR-Next",
    "brandSub1": "Nueva generación",
    "brandSub2": "Metadatos WIGOS",
    "brandSub3": "Portal del sistema"
  },
  "footer": {
    "version": "Versión: {version}",
    "disclaimer": "Las imágenes y los registros del catálogo pertenecen a sus proveedores. Este portal no representa a la OMM ni implica su respaldo.",
    "attribution": "Portal de demostración independiente"
  },
  "common": {
    "search": "Buscar",
    "searching": "Buscando...",
    "reset": "Restablecer",
    "retry": "Reintentar",
    "loading": "Cargando...",
    "clear": "Borrar",
    "close": "Cerrar",
    "download": "Descargar",
    "generating": "Generando...",
    "all": "Todos",
    "list": "Lista",
    "map": "Mapa",
    "unknown": "Desconocido",
    "nextPage": "Página siguiente",
    "previousPage": "Página anterior",
    "recordsPerPage": "Registros por página",
    "noResults": "No se encontraron resultados.",
    "noData": "Sin datos ({count} raíces cargadas)",
    "searchPlaceholder": "Buscar"
  },
  "route": {
    "home": "Página de inicio",
    "search": "Buscar",
    "station": "Estación",
    "stationSearch": "Búsqueda de estaciones",
    "stationReport": "Informe de estación",
    "export": "Exportar y descargar"
  },
  "sidebar": {
    "quickAccess": "Acceso rápido",
    "generateReportBy": "Generar informe de estación por:",
    "generateListsBy": "Generar listas de estaciones por:",
    "byProgram": "Por programa / red:",
    "byReportingStatus": "Por estado de notificación:",
    "stationName": "Nombre de la estación",
    "wigosId": "Identificador de estación WIGOS",
    "country": "País",
    "type": "Tipo",
    "class": "Clase",
    "programNetwork": "Programa / red",
    "reportingStatus": "Estado de notificación",
    "declared": "Declarado",
    "assessed": "Evaluado",
    "expandSidebar": "Expandir panel lateral",
    "collapseSidebar": "Contraer panel lateral",
    "program": {
      "wigos": "Componentes de WIGOS",
      "coSponsored": "Componentes copatrocinados",
      "other": "Otros componentes",
      "nonAffiliated": "No afiliado"
    },
    "status": {
      "operational": "Operativa",
      "partlyOperational": "Parcialmente operativa",
      "unknown": "Desconocido",
      "silent": "Sin transmisión",
      "closed": "Cerrada"
    }
  },
  "home": {
    "title": "Bienvenido al portal del sistema de metadatos WIGOS",
    "desc": "El portal del sistema de metadatos WIGOS ofrece información sobre estaciones de observación meteorológica de todo el mundo y permite buscar, consultar mapas y gestionar datos de WIGOS.",
    "searchPlaceholder": "Buscar por nombre, alias o identificador WIGOS...",
    "search": "Buscar",
    "advancedSearch": "Búsqueda avanzada",
    "stats": {
      "totalStations": "Total de estaciones",
      "totalStationsNote": "(declaradas + evaluadas)",
      "countries": "Países / territorios",
      "countriesNote": "con estaciones que notifican",
      "observationTypes": "Tipos de observación",
      "observationTypesNote": "Tipos del catálogo",
      "lastUpdate": "Última actualización",
      "lastUpdateNote": "(UTC)"
    },
    "searchRemoteError": "La búsqueda en el catálogo falló. Inténtelo de nuevo. No se muestran resultados de demostración.",
    "typeCountError": "No se pudo obtener el número de tipos de estaciones con datos.",
    "hint": {
      "none": "No se encontraron estaciones para «{term}». Se muestran todas las estaciones.",
      "found": "Se encontraron {count} estaciones y se localizó «{name}» ({id}). Precise las palabras clave para mejorar la coincidencia."
    }
  },
  "search": {
    "criteria": "Criterios",
    "keyword": "Palabra clave / identificador de estación WIGOS",
    "keywordPlaceholder": "Nombre, alias o 0-20000-0-60415",
    "results": "Resultados",
    "remoteCount": "{count} registros en el catálogo de recursos de la OMM",
    "remoteNote": "Se muestran {count} de {total} registros coincidentes · fecha del catálogo {date}",
    "remoteError": "No se pudo consultar el catálogo de recursos de la OMM: {message}",
    "loadingRemote": "Cargando estaciones del catálogo de recursos de la OMM…",
    "activeCriteria": "Criterios activos: {value}",
    "none": "ninguno",
    "noMatching": "No hay estaciones coincidentes. Ajuste o restablezca los criterios.",
    "pagination": "{page} / {count} · {total}",
    "filterAria": "Filtrar estaciones",
    "resultsDisplayMode": "Modo de visualización de resultados",
    "field": {
      "type": "Tipo de estación",
      "program": "Afiliación a programa / red",
      "variable": "Variable observada",
      "region": "Región de la OMM",
      "territory": "País / territorio"
    },
    "th": {
      "stationName": "Nombre de la estación",
      "type": "Tipo",
      "territory": "País / territorio",
      "position": "Posición",
      "status": "Estado",
      "program": "Programa / red"
    }
  },
  "export": {
    "title": "Exportación e interoperabilidad",
    "sub": "Los resultados pueden exportarse en JSON; un registro puede descargarse como WMDR V2 (JSON). Para el acceso automatizado, consulte el catálogo directamente mediante OGC API - Records.",
    "remoteError": "La solicitud al catálogo falló: {message}. No se generó ningún archivo. Inténtelo de nuevo.",
    "noQuery": "Busque estaciones antes de exportar los resultados filtrados.",
    "progress": "Obteniendo registros: {count} / {total}",
    "generated": "Se generaron {count} registros. Revise la vista previa y pulse Descargar. La vista previa se limita a 12.000 caracteres.",
    "cancelled": "Exportación cancelada. No se generó ningún archivo.",
    "cancel": "Cancelar exportación",
    "bulkTitle": "Exportación masiva de resultados",
    "scope": "Alcance de la exportación",
    "scopeFiltered": "Registros filtrados ({count})",
    "scopeAll": "Todos los registros del catálogo ({count})",
    "format": "Formato",
    "fields": "Campos",
    "fieldsMandatory": "Campos de resumen de estación",
    "fieldsFull": "Conjunto completo de elementos",
    "generateExport": "Generar exportación",
    "download": "Descargar",
    "recordsToExport": "{count} registros para exportar",
    "wmdrTitle": "Descarga de registro WMDR v2",
    "wmdrNote": "Obtenga el registro GeoJSON / WMDR2 original con su identificador WIGOS completo. Sin plantillas ni datos aleatorios.",
    "wigosStationIdentifier": "Identificador de estación WIGOS",
    "guideTitle": "Guía de acceso automatizado",
    "guideNote": "El catálogo proporciona la API mediante OGC API - Records; el portal solo guarda páginas y archivos de exportación.",
    "demoNote": "Conectado al catálogo en línea. Las exportaciones obtienen 250 registros por página y pueden cancelarse. La descarga utiliza los mismos datos que la vista previa."
  },
  "map": {
    "filteredSnapshot": "Mapa filtrado: instantánea del {date} UTC · {count} estaciones en esta vista (puntos densos agrupados)",
    "overviewSnapshot": "Vista general de estaciones (puntos densos agrupados), instantánea: {date} UTC",
    "overviewUnmapped": "{count} registros sin coordenadas puntuales válidas",
    "overviewZoomHint": "Pulse este punto para ampliar y consultar las estaciones.",
    "identifying": "Espere, identificando estaciones...",
    "wigosId": "Identificador de estación WIGOS",
    "stationType": "Tipo de estación",
    "declaredStatus": "Estado declarado de la estación",
    "programStatuses": "Estados declarados de los programas",
    "dateEstablished": "Fecha de establecimiento de la estación",
    "dateClosed": "Fecha de cierre de la estación",
    "stationReport": "Informe de estación",
    "openStationReport": "Abrir informe de estación",
    "zoomIn": "Acercar",
    "zoomOut": "Alejar",
    "resetView": "Restablecer vista",
    "basemap": "Mapa base",
    "basemapOsm": "Internacional · OpenStreetMap",
    "basemapAmap": "China · AMap",
    "basemapTianditu": "China · Tianditu",
    "basemapMissingKey": "Solicite al administrador que configure las credenciales de este mapa base.",
    "basemapLoadError": "No se pudo cargar este mapa base. Compruebe la red y la configuración del servicio.",
    "legend": {
      "air": "aire",
      "landOcean": "superficie terrestre u oceánica",
      "subsurface": "subsuperficie",
      "lake": "lago o río"
    }
  },
  "menu": {
    "home": "Inicio",
    "search": "Buscar"
  },
  "searchNav": {
    "station": "Estación"
  },
  "stationReport": {
    "programNote": "Las afiliaciones a programas y redes proceden de los metadatos de la estación. Su disponibilidad y estado dependen del registro de origen."
  }
}
