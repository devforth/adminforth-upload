<template>
  <div class="relative w-full">
      <ImageGenerator v-if="showImageGen" @close="showImageGen = false" :record="record" :meta="meta" 
        @uploadImage="uploadGeneratedImage"
        :humanifySize="humanifySize"  
      ></ImageGenerator>

      <div v-if="meta.generateImages" class="absolute right-2 top-2 z-10">
        <Tooltip>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconOnly
            class="af-uploader-generate"
            :aria-label="$t('Generate image with AI')"
            @click="showImageGen = true"
          >
            <IconWandSparkles />
          </Button>
          <template #tooltip>{{ $t('Generate image with AI') }}</template>
        </Tooltip>
      </div>

      <label :for="inputId" 
        class="af-uploader flex flex-col items-center justify-center w-full min-h-32 px-3 py-5 border border-dashed rounded-lg cursor-pointer transition-colors hover:bg-lightDropzoneBackgroundHover hover:border-lightDropzoneBorderHover dark:hover:bg-darkDropzoneBackgroundHover dark:hover:border-darkDropzoneBorderHover"
        @dragover.prevent="() => dragging = true"
        @dragleave.prevent="() => dragging = false"
        @drop.prevent="onFileChange"  
        :class="dragging
          ? 'border-lightDropzoneBorderDragging bg-lightDropzoneBackgroundDragging dark:border-darkDropzoneBorderDragging dark:bg-darkDropzoneBackgroundDragging'
          : 'border-lightDropzoneBorder bg-lightDropzoneBackground dark:border-darkDropzoneBorder dark:bg-darkDropzoneBackground'"
      >
          <img v-if="typeof imgPreview === 'string' && imgPreview" :src="imgPreview" class="af-uploader-preview max-w-full h-40 mb-3 rounded-default object-contain" />

          <span v-else class="flex items-center justify-center w-9 h-9 mb-3 rounded-lg border border-lightDropzoneBorder bg-lightDropzoneBackgroundHover text-lightDropzoneIcon dark:border-darkDropzoneBorder dark:bg-darkDropzoneBackgroundHover dark:text-darkDropzoneIcon">
            <IconCloudUpload class="w-5 h-5" />
          </span>

          <template v-if="!uploaded">
            <p class="mb-2 text-sm text-lightDropzoneText dark:text-darkDropzoneText">
              <span class="font-medium text-lightPrimary dark:text-darkPrimary">{{ $t('Click to upload') }}</span> {{ $t('or drag and drop') }}
            </p>
            <p class="text-xs text-lightDropzoneText dark:text-darkDropzoneText">
              {{ allowedExtensionsLabel }} {{ meta.maxFileSize ? $t(`(up to {size})`, { size: humanifySize(meta.maxFileSize) }) : '' }}
            </p>
          </template>

          <div v-if="progress > 0 && !uploaded" class="w-full max-w-xs mt-3">
            <ProgressBar
              :currentValue="progress"
              :showValues="false"
              :progressFormatter="(value: number) => `${value}%`"
            />
          </div>

          <div v-else-if="uploaded" class="flex items-center justify-center gap-2 text-sm text-lightDropzoneText dark:text-darkDropzoneText">
            <IconCircleCheck class="w-4 h-4 text-lightSuccess dark:text-darkSuccess" aria-hidden="true" />
            <span class="text-lightSuccess dark:text-darkSuccess">{{ $t('File uploaded') }}</span>
            <span v-if="uploadedSize" class="text-xs">{{ humanifySize(uploadedSize) }}</span>
            <Button type="button" variant="ghost" size="sm" class="af-uploader-clear" @click.stop.prevent="clear">
              <IconX class="w-3.5 h-3.5" aria-hidden="true" />
              {{ $t('Clear') }}
            </Button>
          </div>

          <input :id="inputId" type="file" :accept="allowedExtensionsAttribute"  class="hidden" @change="onFileChange" ref="uploadInputRef" />
      </label>
  </div> 

</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, getCurrentInstance } from 'vue'
import { callAdminForthApi } from '@/utils'
import { Button, ProgressBar, Tooltip } from '@/afcl';
import { IconCircleCheck, IconCloudUpload, IconWandSparkles, IconX } from '@iconify-prerendered/vue-lucide';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const route = useRoute();
const { t } = useI18n();

const instanceUid = getCurrentInstance()?.uid ?? Math.floor(Math.random() * 1000000);
const inputId = computed(() => `dropzone-file-${props.meta.pluginInstanceId}-${instanceUid}`);

import ImageGenerator from '@@/plugins/UploadPlugin/imageGenerator.vue';
import adminforth from '@/adminforth';


const props = defineProps({
  meta: Object,
  record: Object,
  value: [String, Number, Boolean, Object, Array, null],
})

const emit = defineEmits([
  'update:value',
  'update:inValidity',
  'update:emptiness',
]);

const uploadInputRef = ref(null);

const showImageGen = ref(false);
const dragging = ref(false);

const imgPreview = ref(null);
const progress = ref(0);

const uploaded = ref(false);
const uploadedSize = ref(0);
const downloadFileUrl = ref('');

watch(uploaded, (value) => {
  emit('update:emptiness', !value);
});

function uploadGeneratedImage(imgBlob) {
  // update the value

  const file = new File([imgBlob], 'generated.png', { type: imgBlob.type });
  onFileChange({
    target: {
      files: [file],
    },
  });
}

onMounted(async () => {
  const previewColumnName = `previewUrl_${props.meta.pluginInstanceId}`;
  let queryValues;
  try { 
    queryValues = JSON.parse(atob(route.query.values as string));
  } catch (e) {
    queryValues = {};
  }


  if (typeof queryValues?.[props.meta.pathColumnName] === 'string' && queryValues[props.meta.pathColumnName]) {
    downloadFileUrl.value = queryValues[props.meta.pathColumnName];

    const resp = await callAdminForthApi({
        path: `/plugin/${props.meta.pluginInstanceId}/get-file-download-url`,
        method: 'POST',
        body: {
          filePath: queryValues[props.meta.pathColumnName]
        },
    });
    if (resp.error) {
        adminforth.alert({
          message: t('Error getting file url for field {field}:', { field: props.meta.pathColumnName }),
          variant: 'danger'
        });
      return;
    }
    const filename = resp.url.split('/').pop()?.split('?')[0] || `file`;
    const filenameParts = filename.split('.');
    const extension = filenameParts.length > 1 ? filenameParts.pop() : '';
    const nameWithoutExt = filenameParts.join('.');
    const newFileName = extension 
      ? `${nameWithoutExt}_copy_${Date.now()}.${extension}`
      : `${filename}_copy_${Date.now()}`;


    const res = await fetch(resp.url);
    const fileBlob = await res.blob();
    const file = new File([fileBlob], newFileName, { type: fileBlob.type });
    onFileChange({
      target: {
        files: [file],
      },
    });
  } 

  const existingValue = (props as any).value;
  const existingFilePath =
  typeof existingValue === 'string' && existingValue.trim() ? existingValue : null;
  if (!uploaded.value && props.record?.[previewColumnName]) {
    if (Array.isArray(props.record[previewColumnName]) && props.record[previewColumnName].length > 0) {
      const resp = await callAdminForthApi({
        path: `/plugin/${props.meta.pluginInstanceId}/get-file-download-url`,
        method: 'POST',
        body: { filePath: existingFilePath },
      });
      if (!resp?.error && resp?.url) {
        imgPreview.value = resp.url;
        uploaded.value = true;
        emit('update:emptiness', false);
        return;
      }
      imgPreview.value = resp.url;
    } else {
      imgPreview.value = props.record[previewColumnName];
      uploaded.value = true;
      emit('update:emptiness', false);
    }
  } else if (!uploaded.value && existingFilePath) {
    const resp = await callAdminForthApi({
      path: `/plugin/${props.meta.pluginInstanceId}/get-file-download-url`,
      method: 'POST',
      body: { filePath: existingFilePath },
    });

    if (!resp?.error && resp?.url) {
      imgPreview.value = resp.url;
      uploaded.value = true;
      emit('update:emptiness', false);
      return;
    }
  }

});

const allowedExtensionsLabel = computed(() => {
  const allowedExtensions = props.meta.allowedExtensions || []
  if (allowedExtensions.length === 0) {
    return t('Any file type')
  }
  // make upper case and write in format EXT1, EXT2 or EXT3
  let label = allowedExtensions.map(ext => ext.toUpperCase()).join(', ');
  // last comma to 'or'
  label = label.replace(/,([^,]*)$/, ` ${t('or')}$1`)
  return label
});

const allowedExtensionsAttribute = computed(() => {
  const allowedExtensions = props.meta.allowedExtensions || [];
  return allowedExtensions.length > 0 
    ? allowedExtensions.map(ext => `.${ext}`).join(', ') 
    : '';
});

function clear() {
  imgPreview.value = null;
  progress.value = 0;
  uploaded.value = false;
  uploadedSize.value = 0;
  uploadInputRef.value.value = null;
  emit('update:value', null);
}

function humanifySize(size) {
  if (!size) {
    return '';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}


const onFileChange = async (e) => {
  // if empty then return
  const files = e.target?.files || e.dataTransfer.files

  if (!files  || files.length === 0)  {
    return;
  }

  imgPreview.value = null;
  progress.value = 0;
  uploaded.value = false;
  
  const file = files[0];

  // get filename, extension, size, mimeType
  const { name, size, type } = file;

  uploadedSize.value = size;

  
  const extension = name.split('.').pop();
  const nameNoExtension = name.replace(`.${extension}`, '');
  // validate file extension
  const allowedExtensions = props.meta.allowedExtensions || []
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension.toLowerCase())) {
    adminforth.alert({
      message: t('Sorry but the file type {extension} is not allowed. Please upload a file with one of the following extensions: {allowedExtensionsLabel}', {
        extension,
        allowedExtensionsLabel: allowedExtensionsLabel.value,
      }),
      variant: 'danger'
    });
    return;
  }

  // validate file size
  if (props.meta.maxFileSize && size > props.meta.maxFileSize) {
    adminforth.alert({
      message: t('Sorry but the file size {size} is too large. Please upload a file with a maximum size of {maxFileSize}', {
        size: humanifySize(size),
        maxFileSize: humanifySize(props.meta.maxFileSize),
      }),
      variant: 'danger'
    });
    return;
  }

  emit('update:inValidity', t('Upload in progress...'));
  try {
    // supports preview
    if (type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imgPreview.value = e.target.result;
      }
      reader.readAsDataURL(file);
    }
    
    const { uploadUrl, uploadExtraParams, filePath, error, contentType: uploadContentType } = await callAdminForthApi({
        path: `/plugin/${props.meta.pluginInstanceId}/get_file_upload_url`,
        method: 'POST',
        body: {
          originalFilename: nameNoExtension,
          contentType: type,
          size,
          originalExtension: extension,
          recordPk: route?.params?.primaryKey,
        },
    });

    if (error) {
      adminforth.alert({
        message: t('File was not uploaded because of error: {error}', { error }),
        variant: 'danger'
      });
      imgPreview.value = null;
      uploaded.value = false;
      progress.value = 0;
      return;
    }

    const xhr = new XMLHttpRequest();
    const success = await new Promise((resolve) => {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          progress.value = Math.round((e.loaded / e.total) * 100);
        }
      };
      xhr.addEventListener('loadend', () => {
        const success = xhr.readyState === 4 && xhr.status === 200;
        // try to read response
        resolve(success);
      });
      xhr.open('PUT', uploadUrl, true);
      xhr.setRequestHeader('Content-Type', uploadContentType || type);
      uploadExtraParams && Object.entries(uploadExtraParams).forEach(([key, value]: [string, string]) => {
        xhr.setRequestHeader(key, value);
      })
      xhr.send(file);
    });
    if (!success) {
      adminforth.alert({
        messageHtml: `<div>${t('Sorry but the file was not uploaded because of internal storage Request Error:')}</div>
        <pre style="white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%;">${
          xhr.responseText.replace(/</g, '&lt;').replace(/>/g, '&gt;')
        }</pre>`,
        variant: 'danger',
        timeout: 30,
      });
      imgPreview.value = null;
      uploaded.value = false;
      progress.value = 0;
      return;
    }
    uploaded.value = true;
    emit('update:value', filePath);
  } catch (error) {
    console.error('Error uploading file:', error);
    adminforth.alert({
      message: t('Sorry but the file was not be uploaded. Please try again: {error}', { error: error.message }),
      variant: 'danger'
    });
    imgPreview.value = null;
    uploaded.value = false;
    progress.value = 0;
  } finally {
    emit('update:inValidity', false);
  }
}



</script>