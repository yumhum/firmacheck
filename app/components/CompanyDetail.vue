<script setup lang="ts">
import type { VerifyResult } from '~~/shared/types'

const props = defineProps<{ result: VerifyResult, isSaved?: boolean }>()
defineEmits<{ save: [] }>()

const statusBadge = computed(() => {
  switch (props.result.status) {
    case 'found': return { color: 'success' as const, label: 'Firma nalezena' }
    case 'not_found': return { color: 'warning' as const, label: 'Firma nenalezena' }
    default: return { color: 'error' as const, label: 'Chyba při načítání dat' }
  }
})

const nameMatchText = computed(() => {
  switch (props.result.nameMatch) {
    case 'match': return { color: 'success' as const, text: 'Zadaný název odpovídá názvu v ARES.' }
    case 'partial': return { color: 'warning' as const, text: 'Zadaný název částečně odpovídá názvu v ARES.' }
    case 'mismatch': return { color: 'error' as const, text: 'Zadaný název se liší od názvu v ARES.' }
    default: return null
  }
})

const mapyLink = computed(() =>
  props.result.geo
    ? `https://mapy.cz/zakladni?q=${encodeURIComponent(props.result.company?.address ?? '')}`
    : null,
)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <UBadge :color="statusBadge.color" variant="subtle">
          {{ statusBadge.label }}
        </UBadge>
        <div v-if="result.status === 'found'" class="flex gap-2">
          <UBadge variant="outline">
            ARES: {{ result.aresSource === 'api' ? 'API' : 'SQLite cache' }}
          </UBadge>
          <UBadge v-if="result.geoSource" variant="outline">
            Geocoding: {{ result.geoSource === 'api' ? 'API' : 'SQLite cache' }}
          </UBadge>
        </div>
      </div>
    </template>

    <div v-if="result.status !== 'found'" class="text-(--ui-text-muted)">
      {{ result.message }}
    </div>

    <div v-else-if="result.company" class="space-y-4">
      <UAlert
        v-if="nameMatchText"
        :color="nameMatchText.color"
        variant="subtle"
        :title="nameMatchText.text"
      />

      <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <div>
          <dt class="text-sm text-(--ui-text-muted)">IČO</dt>
          <dd class="font-medium">{{ result.company.ico }}</dd>
        </div>
        <div>
          <dt class="text-sm text-(--ui-text-muted)">Obchodní název</dt>
          <dd class="font-medium">{{ result.company.name }}</dd>
        </div>
        <div>
          <dt class="text-sm text-(--ui-text-muted)">Právní forma</dt>
          <dd class="font-medium">{{ result.company.legalForm }}</dd>
        </div>
        <div>
          <dt class="text-sm text-(--ui-text-muted)">Datum vzniku</dt>
          <dd class="font-medium">{{ result.company.foundedDate ?? '—' }}</dd>
        </div>
        <div>
          <dt class="text-sm text-(--ui-text-muted)">Stav subjektu</dt>
          <dd class="font-medium">{{ result.company.status }}</dd>
        </div>
        <div>
          <dt class="text-sm text-(--ui-text-muted)">DIČ</dt>
          <dd class="font-medium">{{ result.company.dic ?? '—' }}</dd>
        </div>
        <div class="sm:col-span-2">
          <dt class="text-sm text-(--ui-text-muted)">Adresa sídla</dt>
          <dd class="font-medium">{{ result.company.address }}</dd>
        </div>
      </dl>

      <div v-if="result.geo" class="space-y-2">
        <MapView :lat="result.geo.lat" :lon="result.geo.lon" :label="result.company.name" />
        <div class="flex items-center justify-between text-sm text-(--ui-text-muted)">
          <span>Souřadnice: {{ result.geo.lat.toFixed(5) }}, {{ result.geo.lon.toFixed(5) }}</span>
          <ULink v-if="mapyLink" :to="mapyLink" target="_blank">Otevřít v Mapy.cz</ULink>
        </div>
      </div>

      <div class="flex justify-end">
        <UButton
          v-if="!isSaved"
          icon="i-lucide-bookmark"
          @click="$emit('save')"
        >
          Uložit firmu
        </UButton>
        <UButton
          v-else
          icon="i-lucide-check"
          color="success"
          variant="subtle"
          disabled
        >
          Uloženo
        </UButton>
      </div>
    </div>
  </UCard>
</template>
