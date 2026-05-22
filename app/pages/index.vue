<script setup lang="ts">
import type { SavedCompany, VerifyResult } from '~~/shared/types'

const result = ref<VerifyResult | null>(null)
const verifying = ref(false)
const saved = ref<SavedCompany[]>([])

async function loadSaved() {
  saved.value = await $fetch<SavedCompany[]>('/api/companies')
}

async function onVerify(payload: { ico: string, name?: string }) {
  verifying.value = true
  try {
    result.value = await $fetch<VerifyResult>('/api/verify', { method: 'POST', body: payload })
  }
  catch {
    result.value = { status: 'error', company: null, aresSource: null, geo: null, geoSource: null, nameMatch: null, message: 'Chyba při komunikaci se serverem.' }
  }
  finally {
    verifying.value = false
  }
}

async function onSave(result: VerifyResult) {
  if (result.status !== 'found' || !result.company) return
  await $fetch('/api/companies', {
    method: 'POST',
    body: {
      ...result.company,
      lat: result.geo?.lat ?? null,
      lon: result.geo?.lon ?? null,
      lastSource: result.aresSource,
    },
  })
  await loadSaved()
}

async function onRemove(ico: string) {
  await $fetch(`/api/companies/${ico}`, { method: 'DELETE' })
  await loadSaved()
}

function onReopen(company: SavedCompany) {
  result.value = {
    status: 'found',
    company,
    aresSource: company.lastSource,
    geo: company.lat != null && company.lon != null ? { lat: company.lat, lon: company.lon } : null,
    geoSource: company.lat != null ? 'cache' : null,
    nameMatch: null,
  }
}

await loadSaved()

const isSaved = computed(() =>
  !!result.value?.company && saved.value.some(c => c.ico === result.value!.company!.ico),
)
</script>

<template>
  <UContainer class="py-8 space-y-8">
    <div class="text-center space-y-3">
      <img
        src="~/assets/img/babicka.webp"
        alt="Babička s lupou kontroluje české firmy"
        width="640"
        height="640"
        class="mx-auto h-40 w-40 object-contain"
      >
      <h1 class="text-3xl font-bold">
        FirmaCheck
      </h1>
      <p class="text-(--ui-text-muted)">
        Rychlé ověření české firmy podle IČO
      </p>
    </div>

    <VerifyForm :loading="verifying" @verify="onVerify" />

    <CompanyDetail
      v-if="result"
      :result="result"
      :is-saved="isSaved"
      @save="onSave(result)"
    />

    <SavedCompanies
      :companies="saved"
      @reopen="onReopen"
      @remove="onRemove"
    />
  </UContainer>
</template>
