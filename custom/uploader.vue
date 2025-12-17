<template>
  <div class="relative w-full">
      <ImageGenerator v-if="showImageGen" @close="showImageGen = false" :record="record" :meta="meta" 
        @uploadImage="uploadGeneratedImage"  
      ></ImageGenerator>

      <button v-if="meta.generateImages" 
        type="button" @click="showImageGen = true" 
        class="text-white bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 hover:bg-gradient-to-br focus:ring-4 focus:outline-none focus:ring-purple-300 dark:focus:ring-purple-800 
          font-medium rounded-lg text-sm px-2.5 py-2.5 text-center me-2 mb-2 absolute right-0 top-2">
          <IconMagic class="w-5 h-5"/>
      </button>

      <label :for="inputId" 
        class="af-uploader flex flex-col px-3 items-center justify-center w-full h-64 border-2  border-dashed rounded-lg cursor-pointer  dark:hover:!bg-darkDropzoneBackgroundHover dark:hover:bg-gray-800 hover:!bg-lightDropzoneBackgroundHover hover:bg-gray-100  dark:hover:!border-darkDropzoneBorderHover dark:hover:border-gray-500 dark:hover:!bg-darkDropzoneBackgroundHover dark:hover:bg-gray-600 hover:!border-lightDropzoneBorderHover"
        @dragover.prevent="() => dragging = true"
        @dragleave.prevent="() => dragging = false"
        @drop.prevent="onFileChange"  
        :class="{
          'border-blue-600 dark:border-blue-400 !border-lightDropzoneBorderDragging dark:!border-darkDropzoneBorderDragging': dragging,
          'border-gray-300 dark:border-gray-600 !border-lightDropzoneBorder dark:!border-darkDropzoneBorder': !dragging,
          'bg-blue-50 dark:bg-blue-800 !bg-lightDropzoneBackgroundDragging dark:!bg-darkDropzoneBackgroundDragging': dragging,
          'bg-gray-50 dark:bg-gray-800 !bg-lightDropzoneBackground dark:!bg-darkDropzoneBackground': !dragging,
        }"
      >
          <div class="flex flex-col items-center justify-center pt-5 pb-6">
              <img v-if="typeof imgPreview === 'string' && imgPreview" :src="imgPreview" class="w-100 mt-4 rounded-lg h-40 object-contain" />

              <svg v-else class="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400 !text-lightDropzoneText dark:!text-darkDropzoneText" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
              </svg>

              <template v-if="!uploaded">
                <p class="mb-2 text-sm text-gray-500 dark:text-gray-400 !text-lightDropzoneText dark:!text-darkDropzoneText"><span class="font-semibold">{{ $t('Click to upload') }}</span> {{ $t('or drag and drop') }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 !text-lightDropzoneText dark:!text-darkDropzoneText">
                  {{ allowedExtensionsLabel }} {{ meta.maxFileSize ? $t(`(up to {size})`, { size: humanifySize(meta.maxFileSize) }) : '' }}
                </p>
              </template>

              <div class="w-full bg-gray-200 rounded-full dark:bg-gray-700 mt-1 mb-2" v-if="progress > 0 && !uploaded">
                <!-- progress bar  with smooth progress animation -->
                <div class="bg-blue-600 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-full
                  transition-all duration-200 ease-in-out" 
                  :style="{width: `${progress}%`}">{{ progress }}%
                </div>
              </div>

              <div v-else-if="uploaded" class="flex items-center justify-center w-full mt-1">
                <svg class="w-4 h-4 text-green-600 dark:text-green-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
                <p class="ml-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                  {{ $t('File uploaded') }}
                  <span class="text-xs text-gray-500 dark:text-gray-400 !text-lightDropzoneText dark:!text-darkDropzoneText">{{ humanifySize(uploadedSize) }}</span>
                </p>

                <button @click.stop.prevent="clear" class="ml-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-500
                  hover:underline dark:hover:underline focus:outline-none !text-lightDropzoneText hover:!text-lightDropzoneText dark:!text-darkDropzoneText dark:hover:!text-darkDropzoneText">{{ $t('Clear') }}</button>
              </div>
              
          </div>
          <input :id="inputId" type="file" :accept="allowedExtensionsAttribute"  class="hidden" @change="onFileChange" ref="uploadInputRef" />
      </label>
  </div> 

</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, getCurrentInstance } from 'vue'
import { callAdminForthApi } from '@/utils'
import { IconMagic } from '@iconify-prerendered/vue-mdi';
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
    imgPreview.value = props.record[previewColumnName];
    uploaded.value = true;
    emit('update:emptiness', false);
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
    return 'Any file type'
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
  console.log('File details:', { name, extension, size, type });
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
    
    const { uploadUrl, uploadExtraParams, filePath, error } = await callAdminForthApi({
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
      xhr.setRequestHeader('Content-Type', type);
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