<script setup lang="ts">
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'

const props = defineProps<{ lat: number, lon: number, label?: string }>()
const el = ref<HTMLElement | null>(null)
const config = useRuntimeConfig()
let map: L.Map | null = null

const icon = L.icon({
  iconUrl: markerIconUrl,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function render() {
  if (!el.value) return
  const apiKey = config.public.mapyApiKey as string

  map = L.map(el.value).setView([props.lat, props.lon], 16)

  L.tileLayer(`https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${apiKey}`, {
    minZoom: 0,
    maxZoom: 19,
    attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s. a další</a>',
  }).addTo(map)

  // Required Mapy.com logo control
  const LogoControl = L.Control.extend({
    options: { position: 'bottomleft' as const },
    onAdd() {
      const container = L.DomUtil.create('div')
      container.innerHTML = '<a href="https://mapy.com/" target="_blank"><img src="https://api.mapy.com/img/api/logo.svg" alt="Mapy.com" style="height:18px"></a>'
      L.DomEvent.disableClickPropagation(container)
      return container
    },
  })
  new LogoControl().addTo(map)

  L.marker([props.lat, props.lon], { icon }).addTo(map).bindPopup(props.label ?? '')
}

onMounted(render)

watch(() => [props.lat, props.lon], () => {
  if (map) {
    map.remove()
    map = null
  }
  render()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="el" class="h-72 w-full rounded-lg overflow-hidden border border-(--ui-border)" />
</template>
