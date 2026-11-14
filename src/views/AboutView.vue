<template>
  <article class="about-page">
    <h1>APIs and tools</h1>

    <section>
      <h2>Global Observing Facility Catalogue (GOFC)</h2>
      <p>
        WIGOS metadata is also available using geospatial Web Application Programming Interfaces (APIs) adhering to
        international standards. They are designed to support machine to machine interaction, and can be used in Web,
        mobile or desktop applications and tools.
      </p>
      <p>
        The WIGOS Global Observing Facility Catalogue (GOF) supports the
        <a href="https://ogcapi.ogc.org/records" target="_blank" rel="noopener noreferrer">OGC API - Records</a>
        standard which facilitates interoperable discovery of observing facility metadata. OGC standards play an
        important role in lowering the barrier to weather/climate/water data exchange as part of the WMO Information
        System and are supported by numerous off the shelf open source and commercial tools.
      </p>
      <p>
        The WIGOS GOFC API is available at
        <a :href="gofcUrl" target="_blank" rel="noopener noreferrer">{{ gofcUrl }}</a>. The API provides discovery,
        access, visualization and processing functionality to all WIGOS metadata, as well as online services processes
        for metadata validation, reporting and quality assessment.
      </p>

      <h3>Example API links</h3>
      <p>The below links and examples provide an overview of API functionality:</p>
      <dl class="about-examples">
        <template v-for="example in examples" :key="example.href">
          <dt>{{ example.label }}</dt>
          <dd><a :href="example.href" target="_blank" rel="noopener noreferrer">{{ example.href }}</a></dd>
        </template>
      </dl>

      <p>
        Note that the WIGOS GOFC provides search results in HTML or JSON. JSON results are made available by adding
        <code>f=json</code> to search queries.
      </p>
      <p>
        For developers, a Swagger interface is available at
        <a :href="`${gofcUrl}/openapi`" target="_blank" rel="noopener noreferrer">{{ gofcUrl }}/openapi</a>.
      </p>
      <p>
        The WIGOS GOFC is powered by
        <a href="https://pygeoapi.io" target="_blank" rel="noopener noreferrer">pygeoapi</a>, a Reference
        Implementation of the <a href="https://ogcapi.ogc.org" target="_blank" rel="noopener noreferrer">OGC API</a>
        standards.
      </p>
    </section>

    <section>
      <h2>Tools</h2>
      <p>The following GitHub examples provide high level access and workflow examples of integrating WOUDC Web services:</p>
      <ul>
        <li>
          <a href="https://github.com/wmo-im/pywmdr" target="_blank" rel="noopener noreferrer">pywmdr</a>:
          pywmdr provides validation and quality assessment capabilities for the WMO WIGOS Metadata Representation (WMDR2)
        </li>
      </ul>
    </section>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { WIGOS_API_BASE } from '../api/wigos'

// Mirrors the {{ VITE_WIGOS_GOFC_URL }} placeholders in the source text, using
// the same configured catalogue host as the rest of the application.
const gofcUrl = WIGOS_API_BASE.replace(/\/+$/, '')
const collection = `${gofcUrl}/collections/wigos-observing-facility-metadata`
const items = `${collection}/items`

const examples = computed(() => [
  { label: 'View WIGOS metadata collection', href: collection },
  { label: 'View all WIGOS observing facility metadata', href: items },
  { label: 'Query for all observing facilities using a bounding geometry (bbox)', href: `${items}?bbox=-142,42,-53,84` },
  { label: 'Query for all fixed land observing facilities', href: `${items}?facilityType.id=landFixed` },
  { label: 'Query for all observing facilities in WMO Region III (South America)', href: `${items}?wmoRegion.id=southAmerica` },
  { label: 'Query for all observing facilities in Norway', href: `${items}?territories.territory.id=NOR` },
  { label: 'Query for all observing facilities affiliated with GBON', href: `${items}?observations.programAffiliations.programAffiliation.id=GBON` },
  { label: 'Query for all observing facilities measuring total column ozone', href: `${items}?observations.observedProperty.id=263` },
])
</script>

<style scoped lang="scss">
.about-page {
  max-width: 900px;
  padding: 8px 4px 32px;
  color: #2c3f50;
  line-height: 1.65;
  font-size: 14px;
}

h1 {
  margin: 0 0 20px;
  color: #005288;
  font-size: 26px;
  font-weight: 600;
}

h2 {
  margin: 26px 0 12px;
  color: #005288;
  font-size: 19px;
  font-weight: 600;
}

h3 {
  margin: 22px 0 10px;
  font-size: 16px;
  font-weight: 600;
}

p { margin: 0 0 12px; }

a {
  color: #005288;
  overflow-wrap: anywhere;
}

code {
  padding: 1px 5px;
  border-radius: 3px;
  background: #f1f5f9;
  font-size: 13px;
}

ul { padding-left: 22px; }

.about-examples {
  margin: 0 0 18px;

  dt { font-weight: 600; margin-top: 12px; }
  dd { margin: 2px 0 0; }
}
</style>
