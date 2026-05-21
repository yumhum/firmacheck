<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { verifySchema, type VerifyInput } from '~~/shared/schema'

defineProps<{ loading?: boolean }>()
const emit = defineEmits<{ verify: [payload: { ico: string, name?: string }] }>()

const state = reactive<Partial<VerifyInput>>({ ico: '', name: '' })

function onSubmit(event: FormSubmitEvent<VerifyInput>) {
  emit('verify', { ico: event.data.ico, name: event.data.name || undefined })
}
</script>

<template>
  <UForm
    :schema="verifySchema"
    :state="state"
    class="space-y-4 max-w-md mx-auto"
    @submit="onSubmit"
  >
    <UFormField label="IČO" name="ico" required>
      <UInput v-model="state.ico" placeholder="02823519" class="w-full" />
    </UFormField>

    <UFormField label="Název firmy (volitelné)" name="name">
      <UInput v-model="state.name" placeholder="ideabox" class="w-full" />
    </UFormField>

    <UButton type="submit" :loading="loading" block>
      Ověřit firmu
    </UButton>
  </UForm>
</template>
