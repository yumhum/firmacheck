<script setup lang="ts">
import type { SavedCompany } from '~~/shared/types'

const props = defineProps<{ companies: SavedCompany[] }>()
defineEmits<{ reopen: [company: SavedCompany], remove: [ico: string] }>()

const toast = useToast()

const page = ref(1)
const PER_PAGE = 5
const paginated = computed(() => {
  const start = (page.value - 1) * PER_PAGE
  return props.companies.slice(start, start + PER_PAGE)
})
// Keep the page in range when items are removed.
watch(() => props.companies.length, (len) => {
  const maxPage = Math.max(1, Math.ceil(len / PER_PAGE))
  if (page.value > maxPage) page.value = maxPage
})

function download(format: 'csv' | 'json') {
  window.location.href = `/api/companies/export?format=${format}`
}

function downloadOne(ico: string, format: 'csv' | 'json') {
  window.location.href = `/api/companies/export?format=${format}&ico=${ico}`
}

async function copyJson() {
  await navigator.clipboard.writeText(JSON.stringify(props.companies, null, 2))
  toast.add({ title: 'JSON zkopírován do schránky', color: 'success' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('cs-CZ')
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg font-semibold">
          Uložené firmy
        </h2>
        <div v-if="companies.length" class="flex gap-2">
          <UButton size="sm" variant="outline" icon="i-lucide-download" @click="download('csv')">
            CSV
          </UButton>
          <UButton size="sm" variant="outline" icon="i-lucide-download" @click="download('json')">
            JSON
          </UButton>
          <UButton size="sm" variant="ghost" icon="i-lucide-copy" @click="copyJson">
            Kopírovat JSON
          </UButton>
        </div>
      </div>
    </template>

    <div v-if="!companies.length" class="text-center py-8 space-y-3">
      <img src="~/assets/img/empty-state.png" alt="Žádné uložené firmy" class="mx-auto h-40 w-auto opacity-90">
      <p class="text-(--ui-text-muted)">
        Zatím nemáte uložené žádné firmy. Ověřte firmu a uložte ji.
      </p>
    </div>

    <ul v-else class="divide-y divide-(--ui-border)">
      <li
        v-for="c in paginated"
        :key="c.ico"
        class="flex items-center justify-between gap-4 py-3"
      >
        <button class="text-left flex-1 cursor-pointer" @click="$emit('reopen', c)">
          <p class="font-medium">{{ c.name }}</p>
          <p class="text-sm text-(--ui-text-muted)">
            IČO {{ c.ico }} · {{ c.address }}
          </p>
          <p class="text-xs text-(--ui-text-muted)">
            Ověřeno: {{ formatDate(c.lastVerifiedAt) }}
          </p>
        </button>
        <div class="flex items-center gap-1">
          <UDropdownMenu
            :items="[
              { label: 'Export CSV', icon: 'i-lucide-download', onSelect: () => downloadOne(c.ico, 'csv') },
              { label: 'Export JSON', icon: 'i-lucide-download', onSelect: () => downloadOne(c.ico, 'json') },
            ]"
          >
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis-vertical"
              aria-label="Export firmy"
            />
          </UDropdownMenu>
          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            aria-label="Odebrat firmu"
            @click="$emit('remove', c.ico)"
          />
        </div>
      </li>
    </ul>

    <div v-if="companies.length > PER_PAGE" class="flex justify-center pt-4">
      <UPagination
        v-model:page="page"
        :total="companies.length"
        :items-per-page="PER_PAGE"
      />
    </div>
  </UCard>
</template>
