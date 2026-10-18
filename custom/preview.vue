<template>
  <div>
    <template v-if="urls.length">
      <div class="flex flex-wrap gap-2 items-start">
        <template v-for="(u, i) in urls" :key="`${u}-${i}`">
          <img
            v-if="guessContentTypeFromUrl(u)?.startsWith('image')"
            :src="u"
            class="rounded-default cursor-zoom-in"
            :style="[maxWidth, minWidth]"
            ref="img"
            @click.stop="openZoom(i)"
          />
          <video
            v-else-if="guessContentTypeFromUrl(u)?.startsWith('video')"
            :src="u"
            class="rounded-default"
            controls
            @click.stop
          />
          <a
            v-else
            :href="u"
            target="_blank"
            class="af-preview-download"
            :class="[buttonBaseStyles, buttonVariantStyles.secondary]"
          >
            <IconDownload class="w-4 h-4 text-lightInputIconColor dark:text-darkInputIconColor" aria-hidden="true" />
            {{ $t('Download file') }}
          </a>
        </template>
      </div>
    </template>
    <span v-else class="text-lightInputPlaceholderText dark:text-darkInputPlaceholderText">
      {{ t('No image') }}
    </span>
    
  </div>
</template>

<style>
  .medium-zoom-image--opened {
    z-index: 999999;
    background: rgba(0, 0, 0, 0.8);
  }
  .medium-zoom-overlay {
    z-index: 99;
    background: theme('colors.lightHtml / 90%') !important;
  }
  html.dark .medium-zoom-overlay {
    background: theme('colors.darkHtml / 90%') !important;
  }
  body.medium-zoom--opened aside {
    filter: grayscale(1)
  } 
</style>

<style scoped>
  /* img {
    min-width: 150px;
  }
  video {
    min-width: 200px;
  } */
</style>
<script setup>
import { ref, computed , onMounted, watch, nextTick} from 'vue'
import mediumZoom from 'medium-zoom'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n';
import { buttonBaseStyles, buttonVariantStyles } from '@/afcl';
import { IconDownload } from '@iconify-prerendered/vue-lucide';

const { t } = useI18n();

const img = ref(null);
const zoom = ref(null);

const props = defineProps({
  record: Object,
  column: Object,
  meta: Object,
})

const trueContentType  = ref(null);

onMounted(async () => {
  // try to get HEAD request (single url only). For arrays we just guess by extension.
  if (!url.value) return;
  if (Array.isArray(url.value)) return;
  try {
    const response = await fetch(url.value, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-0' // this approach is better then HEAD in terms of CDN/CORS, but same for efficiency as HEAD
      },
      mode: 'cors',
    });
    const ct = response.headers.get('Content-Type');
    if (ct) {
      trueContentType.value = ct;
    }
  } catch (e) {
    console.error('fetch error for getting content type, please check CORS allowed for HEAD request', e);
  }
});

const contentType = computed(() => {
  if (trueContentType.value) {
    return trueContentType.value;
  }
  return guessedContentType.value;
});

const route = useRoute();
const url = computed(() => {
  return props.record[`previewUrl_${props.meta.pluginInstanceId}`];
});

const urls = computed(() => {
  if (!url.value) return [];
  return Array.isArray(url.value) ? url.value : [url.value];
});

const maxWidth = computed(() => {
  const isShowPage = route.path.includes('/show/');
  const width = isShowPage 
    ? (props.meta.maxShowWidth || props.meta.maxWidth)
    : (props.meta.maxListWidth || props.meta.maxWidth);

  return width ? { maxWidth: `min(100%, ${width})` } : {};
});

const minWidth = computed(() => {
  const isShowPage = route.path.includes('/show/');
  const width = isShowPage 
    ? (props.meta.minShowWidth || props.meta.minWidth)
    : (props.meta.minListWidth || props.meta.minWidth);

  return width ? { minWidth: width } : {};
});
// since we have no way to know the content type of the file, we will try to guess it from extension
// for better experience probably we should check whether user saves content type in the database and use it here
const guessedContentType = computed(() => {
  if (!url.value) {
    return null;
  }
  if (Array.isArray(url.value)) return null;
  const u = new URL(url.value, url.value.startsWith('http') ? undefined : location.origin);
  return guessContentType(u.pathname);
});

function guessContentType(url) {
  if (!url) {
    return null;
  }
  const ext = url.split('.').pop();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff'].includes(ext)) {
    return 'image';
  }
  if (['mp4', 'webm', 'ogg', 'avi', 'mov', 'flv', 'wmv', 'mkv'].includes(ext)) {
    return 'video';
  }
}

function guessContentTypeFromUrl(u) {
  if (!u) return null;
  try {
    const parsed = new URL(u, u.startsWith('http') ? undefined : location.origin);
    return guessContentType(parsed.pathname);
  } catch (e) {
    return guessContentType(u);
  }
}

watch([contentType], async ([contentType]) => {
  // since content type might change after true guessing (HEAD request might be slow) we need to try initializing zoom again
  if (zoom.value) {
    zoom.value.detach();
  }
  await nextTick();
  // For arrays we use click-to-open per image, for single we keep existing behavior.
  if (contentType?.startsWith('image') && !Array.isArray(url.value)) {
    zoom.value = mediumZoom(img.value, { margin: 24 });
  }

}, { immediate: true });

function openZoom(index) {
  if (!urls.value?.length) return;
  const el = Array.isArray(img.value) ? img.value[index] : img.value;
  if (!el) return;
  const z = mediumZoom(el, { margin: 24 });
  z.open();
}

</script>