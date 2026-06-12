
<template>
  <!-- Main modal -->
  <div tabindex="-1" class="overflow-y-auto overflow-x-hidden fixed inset-0 z-50 flex justify-center items-center w-full h-full bg-black/50">
    <div class="relative p-4 w-11/12 max-w-5xl max-h-full ">
      <!-- Modal content -->
      <div class="relative bg-white rounded-xl shadow-2xl dark:bg-gray-800">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ $t('Generate image with AI') }}
          </h3>
          <button type="button" 
            @click="() => {stopGeneration = true; emit('close') }"
            class="text-gray-400 bg-transparent hover:bg-gray-100 hover:text-gray-900 rounded-lg w-8 h-8 inline-flex justify-center items-center dark:hover:bg-gray-700 dark:hover:text-white transition" >
            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
            </svg>
            <span class="sr-only">{{ $t('Close modal') }}</span>
          </button>
        </div>
        <!-- Modal body -->
        <div class="px-6 py-5 space-y-4">
          <!-- PROMPT TEXTAREA -->
          <!-- Textarea -->
          <textarea
            rows="3"
            class="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-200 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 resize-none"
            :placeholder="$t('Prompt which will be passed to AI network')"
            v-model="prompt"
            :title="$t('Prompt which will be passed to AI network')"
          ></textarea>

          <!-- Thumbnails -->
          <div class="flex flex-wrap gap-2">
            <div class="group relative" v-for="(img, key) in requestAttachmentFilesUrls" :key="key">
              <img
                :src="img"
                class="w-14 h-14 object-cover rounded-lg cursor-pointer border border-gray-200 hover:border-blue-500 transition"
                :alt="`Attachment ${key + 1}`"
                @click="zoomImage(img)"
              />
              <div
                class="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 bg-black absolute -top-2 -end-2 rounded-full border-2 border-white cursor-pointer hover:border-gray-300 hover:scale-110"
                @click="removeFileFromList(key)"
              >
                <Tooltip class="absolute top-0 end-0">
                  <div>
                    <div class="w-4 h-4 absolute"></div>
                    <IconCloseOutline class="w-3 h-3 text-white hover:text-gray-300" />
                  </div>
                  <template #tooltip>Remove file</template>
                </Tooltip>
              </div>
            </div>
            <input ref="fileInput" class="hidden" type="file" @change="handleAddFile" accept="image/*" />
            <button v-if="!uploading" @click="fileInput?.click()" type="button" :disabled="requestAttachmentFilesUrls.length >= 1" class=" upload-btn relative group hover:border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed transition border-gray-300 flex items-center justify-center w-14 h-14 border-2 border-dashed rounded-lg">
              <div class="flex flex-col items-center justify-center gap-1">
                <IconCloseOutline class="group-hover:text-gray-500 transition rotate-45 w-5 h-5 text-gray-300" />
                <p class="text-gray-300 group-hover:text-gray-500 transition text-[10px] leading-none">Ctrl+v</p>
              </div>
            </button>
            <Skeleton v-else type="image" class="w-14 h-14" />
          </div>

          <div class="grid grid-cols-[1fr_52px_1fr]">
            <span class="pb-2 text-sm font-medium text-gray-500 dark:text-gray-400">{{ $t('Original image') }}</span>
            <div></div>
            <span class="pb-2 text-sm font-medium text-gray-500 dark:text-gray-400">{{ $t('Generated image') }}</span>
            <div
              class="rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 aspect-[4/3] flex items-center justify-center"
              :class="requestAttachmentFilesUrls.length ? 'cursor-zoom-in' : ''"
              @click="requestAttachmentFilesUrls.length && zoomImage(requestAttachmentFilesUrls[0])"
            >
              <img
                v-if="requestAttachmentFilesUrls.length"
                :src="requestAttachmentFilesUrls[0]"
                class="w-full h-full object-cover"
              />
              <span v-else class="text-gray-400 dark:text-gray-500 text-sm">{{ $t('No image') }}</span>
            </div>

            <div class="flex items-center justify-center">
              <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </div>

            <div class="relative aspect-[4/3]">

              <div 
                v-if="loading"
                class="spinner absolute flex items-center justify-center inset-0 z-40 rounded-xl">
                <Spinner class="w-8 h-8" />
              </div>
              <div v-if="loadingTimer" class=" spinner-description absolute inset-0 z-40 flex items-center justify-center">
                <div class="text-gray-800 dark:text-gray-100 text-base font-semibold mt-20" v-if="!historicalAverage">
                  {{ formatTime(loadingTimer) }} {{ $t('passed...') }}
                </div>
                <div class="w-48" v-else>
                  <ProgressBar
                    class="max-w-full"
                    :currentValue="loadingTimer < historicalAverage ? loadingTimer : historicalAverage"
                    :minValue="0"
                    :maxValue="historicalAverage"
                    :showValues="false"
                    :progressFormatter="(_value: number, _percentage: number) => `${ formatTime(loadingTimer) } ( ~ ${ Math.floor( (loadingTimer < historicalAverage ? loadingTimer : historicalAverage) / historicalAverage * 100) }% )`"
                  />
                </div>
              </div>

              <div v-if="errorMessage" class="absolute inset-0 z-40 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-xl">
                <div class="text-red-500 dark:text-red-400 font-semibold text-sm text-center px-4">{{ errorMessage }}</div>
              </div>

              <div id="gallery" class="relative w-full h-full" data-carousel="static">
                <div
                  class="relative w-full h-full overflow-hidden rounded-xl"
                  :class="images.length > 0 ? 'cursor-zoom-in' : ''"
                  @click="zoomCurrentImage"
                >
                  <div v-for="(img, index) in images" :key="index" class="hidden duration-700 ease-in-out" data-carousel-item>
                    <img :src="img" class="absolute block w-full h-full object-cover -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2"
                      :alt="`Generated image ${index + 1}`"
                    />
                  </div>
                  <div v-if="images.length === 0" class="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700">
                    <span v-if="!loadingTimer" class="text-gray-400 dark:text-gray-500 text-sm">{{ $t('Your generated image will appear here') }}</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-start-3 flex items-center justify-center gap-3 pt-3">
              <button
                type="button"
                @click="slide(-1)"
                :disabled="images.length === 0"
                class="inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
              >
                <svg class="w-4 h-4 text-gray-700 dark:text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 1 1 5l4 4"/>
                </svg>
                <span class="sr-only">{{ $t('Previous') }}</span>
              </button>
              <button type="button" class="inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition shadow-sm"
                :disabled="loading"
                @click="slide(1)"
              >
                <svg class="w-4 h-4 text-gray-700 dark:text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 9 4-4-4-4"/>
                </svg>
                <span class="sr-only">{{ $t('Next') }}</span>
              </button>
            </div>
          </div>
        </div>
        <!-- Modal footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2">
            <Button
              @click="confirmImage"
              :disabled="loading || images.length === 0"
              variant="primary"
            >{{ $t('Use image') }}</Button>
            <Button
              @click="() => { stopGeneration = true; emit('close') }"
              variant="secondary"
            >{{ $t('Cancel') }}</Button>
          </div>
          <Button
            @click="generateImages"
            :disabled="loading"
            variant="primary"
          >{{ $t('Generate images') }}</Button>
        </div>

      </div>
    </div>
  </div>

  <div
    v-if="zoomedImage"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 cursor-zoom-out"
    @click="closeZoom"
  >
    <img
      :src="zoomedImage"
      class="max-w-[90vw] max-h-[90vh] rounded-lg object-contain select-none"
    />
    <button
      class="absolute top-4 right-4 text-white/70 hover:text-white w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 14 14">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
      </svg>
    </button>
  </div>

</template>

<script setup lang="ts">

import { ref, onMounted, nextTick, Ref, onUnmounted } from 'vue'
import { Carousel } from 'flowbite';
import { callAdminForthApi } from '@/utils';
import { useI18n } from 'vue-i18n';
import adminforth from '@/adminforth';
import { ProgressBar, Button } from '@/afcl';
import { IconCloseOutline } from '@iconify-prerendered/vue-flowbite';
import { Tooltip, Skeleton, Spinner } from '@/afcl'
import { useRoute } from 'vue-router';

const { t: $t, t } = useI18n();
const route = useRoute();


const prompt = ref('');
const emit = defineEmits(['close', 'uploadImage']);
const props = defineProps({
  meta: Object,
  record: Object,
  humanifySize: Function,
});
const images = ref([]);
const loading = ref(false);
const attachmentFiles = ref<string[]>([])
const requestAttachmentFiles = ref<Blob[] | null>([]);
const requestAttachmentFilesUrls = ref<string[]>([]);
const stopGeneration = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const caurosel = ref(null);
onMounted(async () => {
  // Initialize carousel
  let template = '';
  if (props.meta.generationPrompt) {
    template = props.meta.generationPrompt;
  } else {
    template = 'Generate image for field {{field}} in {{resource}}. No text should be on image.';
  }
  // iterate over all variables in template and replace them with their values from props.record[field]. 
  // if field is not present in props.record[field] then replace it with empty string and drop warning
  const { default: Handlebars } = await import('handlebars');
  const tpl = Handlebars.compile(template);
  const compiledTemplate = tpl(props.record);
  prompt.value = compiledTemplate;
  
  const recordId = props.record[props.meta.recorPkFieldName];
  if (!recordId) return;

  try {
    const resp = await callAdminForthApi({
      path: `/plugin/${props.meta.pluginInstanceId}/get_attachment_files`,
      method: 'POST',
      body: { recordId },
    });

    if (resp?.files?.length) {
      requestAttachmentFilesUrls.value = resp.files;
    }
  } catch (err) {
    console.error('Failed to fetch attachment files', err);
  }

  for ( const fileUrl in requestAttachmentFilesUrls.value ) {
    const image = await fetch(fileUrl);
    const imageBlob = await image.blob();
    requestAttachmentFiles.value!.push(imageBlob);
  }
});


async function slide(direction: number) {
  if (!caurosel.value) return;
  const curPos = caurosel.value.getActiveItem().position;
  if (curPos === 0 && direction === -1) return;
  if (curPos === images.value.length - 1 && direction === 1) {
    await generateImages();
  }
  if (direction === 1) {
    caurosel.value.next();
  } else {
    caurosel.value.prev();
  }
}

async function confirmImage() {
  loading.value = true;

  const currentIndex = caurosel.value?.getActiveItem()?.position || 0;
  const img = images.value[currentIndex];
  // read  url to base64 and send it to the parent component

  let imgBlob;
  if (img.startsWith('data:')) {
    const base64 = img.split(',')[1];
    const mimeType = img.split(';')[0].split(':')[1];
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    imgBlob = new Blob([byteArray], { type: mimeType });
  } else {
    imgBlob = await fetch(
      `${import.meta.env.VITE_ADMINFORTH_PUBLIC_PATH || ''}/adminapi/v1/plugin/${props.meta.pluginInstanceId}/cors-proxy?url=${encodeURIComponent(img)}`
    ).then(res => { return res.blob() });
  }

  emit('uploadImage', imgBlob);
  emit('close');

  loading.value = false;
}

const loadingTimer: Ref<number | null> = ref(null);


const errorMessage: Ref<string | null> = ref(null);

const historicalAverage: Ref<number | null> = ref(null);


function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes % 60}m ${Math.floor(seconds % 60)}s`;
}


async function getHistoricalAverage() {
  const resp = await callAdminForthApi({
    path: `/plugin/${props.meta.pluginInstanceId}/averageDuration`,
    method: 'GET',
  });
  historicalAverage.value = resp?.averageDuration || null;
}

async function generateImages() {
  errorMessage.value = null;
  loading.value = true;
  loadingTimer.value = 0;
  const start = Date.now();
  const ticker = setInterval(() => {
    const elapsed = (Date.now() - start) / 1000;
    loadingTimer.value = elapsed;
  }, 100);
  const currentIndex = caurosel.value?.getActiveItem()?.position || 0;

  await getHistoricalAverage();
  let resp = null;
  let error = null;
  try {
    resp = await callAdminForthApi({
      path: `/plugin/${props.meta.pluginInstanceId}/create-image-generation-job`,
      method: 'POST',
      body: {
        prompt: prompt.value,
        recordId: props.record[props.meta.recorPkFieldName],
        requestAttachmentFiles: requestAttachmentFilesUrls.value,
      },
    });
  } catch (e) {
    console.error(e);
    return;
  }

  if (resp?.error) {
    error = resp.error;
  }
  if (!resp) {
    error = $t('Error creating image generation job');
  }

  if (error) {
    if (images.value.length === 0) {
      errorMessage.value = error;
    } else {
      adminforth.alert({
        message: error,
        variant: 'danger',
        timeout: 'unlimited',
      });
    }
    return;
  }

  const jobId = resp.jobId;
  let jobStatus = null;
  let jobResponse = null;
  do {
    jobResponse = await callAdminForthApi({
      path: `/plugin/${props.meta.pluginInstanceId}/get-image-generation-job-status`,
      method: 'POST',
      body: { jobId },
    });
    if (jobResponse !== null) {
      if (jobResponse?.error) {
        error = jobResponse.error;
        break;
      };
      jobStatus = jobResponse?.job?.status;
      if (jobResponse?.job?.error) {
        error = jobResponse.job.error;
      } else if (jobStatus === 'failed') {
        error = $t('Image generation job failed');
      } else if (jobStatus === 'timeout') {
        error = $t('Image generation job timeout');
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } while ((jobStatus === 'in_progress' || jobStatus === null) && !stopGeneration.value);
  
  if (error) {
      adminforth.alert({
        message: error,
        variant: 'danger',
        timeout: 'unlimited',
      });
      clearInterval(ticker);
      loadingTimer.value = null;
      loading.value = false;
    return;
  }

  const respImages = jobResponse?.job?.images || [];

  images.value = [
    ...images.value,
    ...respImages,
  ];

  clearInterval(ticker);
  loadingTimer.value = null;
  loading.value = false;
  

  // images.value = [
  //   'https://via.placeholder.com/600x400?text=Image+1',
  //   'https://via.placeholder.com/600x400?text=Image+2',
  // ];
  await nextTick();


  caurosel.value = new Carousel(
    document.getElementById('gallery'), 
    images.value.map((img, index) => {
      return {
        image: img,
        el: document.getElementById('gallery').querySelector(`[data-carousel-item]:nth-child(${index + 1})`),
        position: index,
      };
    }),
    {
      internal: 0,
      defaultPosition: currentIndex,
    },
    {
      override: true,
    }
  );
  await nextTick();
  
  loading.value = false;
}

const zoomedImage = ref(null)

function zoomImage(img) {
  zoomedImage.value = img
}

function zoomCurrentImage() {
  if (images.value.length === 0) return;
  const index = caurosel.value?.getActiveItem()?.position || 0;
  zoomImage(images.value[index]);
}

function closeZoom() {
  zoomedImage.value = null
}

function onZoomKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeZoom();
}

async function handleAddFile(event, clipboardFile = null) {
  if (clipboardFile) {
    clipboardFile = renameFile(clipboardFile, `pasted_image_${Date.now()}.png`);
  }
  const files = event?.target?.files || (clipboardFile ? [clipboardFile] : []);
  for (let i = 0; i < files.length; i++) {
    if (requestAttachmentFiles.value.find((f: any) => f.name === files[i].name)) {
      adminforth.alert({
        message: $t('File with the same name already added'),
        variant: 'warning',
        timeout: 5000,
      });
      continue;
    }
    const file = files[i];
    const fileUrl = await uploadFile(file);
    if (!fileUrl) continue;
    requestAttachmentFiles.value!.push(file);
    requestAttachmentFilesUrls.value.push(fileUrl);
  }
  fileInput.value!.value = '';
}

function removeFileFromList(index: number) {
  requestAttachmentFiles.value!.splice(index, 1);
  requestAttachmentFilesUrls.value.splice(index, 1);
}

const uploading = ref(false);

async function uploadFile(file: any): Promise<string> {
  const { name, size, type } = file;

  let imgPreview = '';

  const extension = name.split('.').pop();
  const nameNoExtension = name.replace(`.${extension}`, '');

  if (props.meta.maxFileSize && size > props.meta.maxFileSize) {
    adminforth.alert({
      message: t('Sorry but the file size {size} is too large. Please upload a file with a maximum size of {maxFileSize}', {
        size: props.humanifySize(size),
        maxFileSize: props.humanifySize(props.meta.maxFileSize),
      }),
      variant: 'danger'
    });
    return;
  }

  try {
    uploading.value = true;
    const { uploadUrl, uploadExtraParams, filePath, error, previewUrl } = await callAdminForthApi({
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
      imgPreview = null;
      return;
    }

    const xhr = new XMLHttpRequest();
    const success = await new Promise((resolve) => {
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

    if (success) {
      imgPreview = previewUrl;    
    } else {
      throw new Error('File upload failed');
    }
  } catch (err) {
    uploading.value = false;
    console.error('File upload failed', err);
  }
  uploading.value = false;
  return imgPreview;
}

async function uploadImageOnPaste(event) {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (let item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        await handleAddFile(null, file);
      }
    }
  }
}

function renameFile(file, newName) {
  return new File([file], newName, { type: file.type });
}

onMounted(() => {
  document.addEventListener('paste', uploadImageOnPaste);
  document.addEventListener('keydown', onZoomKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('paste', uploadImageOnPaste);
  document.removeEventListener('keydown', onZoomKeyDown);
});
</script>
