<template>
  <div>
    <template v-if="urls.length">
      <div class="flex flex-wrap gap-2 items-start">
        <template v-for="(u, i) in urls" :key="`${u}-${i}`">
          <ZoomableImage
            v-if="guessContentTypeFromUrl(u)?.startsWith('image')"
            :src="u"
            class="rounded-default"
            :style="[maxWidth, minWidth]"
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

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n';
import { ZoomableImage, buttonBaseStyles, buttonVariantStyles } from '@/afcl';
import { IconDownload } from '@iconify-prerendered/vue-lucide';

const { t } = useI18n();

const props = defineProps({
  record: Object,
  column: Object,
  meta: Object,
})

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

</script>
