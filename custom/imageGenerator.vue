
<template>
  <!-- Main modal -->
  <div tabindex="-1" class="overflow-y-auto overflow-x-hidden fixed top-0 right-0 left-0 bottom-0 z-50 flex justify-center items-center w-full md:inset-0 h-full max-h-full bg-white bg-opacity-50 dark:bg-gray-900 dark:bg-opacity-50">
    <div class="relative p-4 w-10/12 max-w-full max-h-full ">
        <!-- Modal content -->
        <div class="relative bg-white rounded-lg shadow-xl dark:bg-gray-700">
            <!-- Modal header -->
            <div class="flex items-center justify-between p-3 md:p-4 border-b rounded-t dark:border-gray-600">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                    {{ $t('Generate image with AI') }}
                </h3>
                <button type="button" 
                  @click="() => {stopGeneration = true; emit('close')}"
                  class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white" >
                    <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                        <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
                    </svg>
                    <span class="sr-only">{{ $t('Close modal') }}</span>
                </button>
            </div>
            <!-- Modal body -->
            <div class="p-4 md:p-5 space-y-4">
              <!-- PROMPT TEXTAREA -->
              <!-- Textarea -->
              <textarea
                id="message"
                rows="3"
                class="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                :placeholder="$t('Prompt which will be passed to AI network')"
                v-model="prompt"
                :title="$t('Prompt which will be passed to AI network')"
              ></textarea>

              <!-- Thumbnails -->
              <div class="mt-2 flex flex-wrap gap-2">
                <div class="group relative" v-for="(img, key) in requestAttachmentFilesUrls">
                  <img
                    :key="key"
                    :src="img"
                    class="w-20 h-20 object-cover rounded cursor-pointer border hover:border-blue-500 transition"
                    :alt="`Generated image ${key + 1}`"
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
                      <template #tooltip>
                        Remove file
                      </template>
                    </Tooltip>
                  </div>
                </div>
                <input 
                  ref="fileInput"
                  class="hidden"
                  type="file"
                  @change="handleAddFile"
                  accept="image/*" 
                />
                <button @click="fileInput?.click()" type="button" class="group hover:border-gray-500 transition border-gray-300 flex items-center justify-center w-20 h-20 border-2 border-dashed rounded-md">
                  <IconCloseOutline class="group-hover:text-gray-500 transition rotate-45 w-10 h-10 text-gray-300 hover:text-gray-300" />
                </button>
              </div>

              <!-- Fullscreen Modal -->
              <div
                v-if="zoomedImage"
                class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80"
                @click.self="closeZoom"
              >
                <img
                  :src="zoomedImage"
                  ref="zoomedImg"
                  class="max-w-full max-h-full rounded-lg object-contain cursor-grab z-75"
              />
            </div>

              <div class="flex flex-col items-center justify-center w-full relative">
                <div 
                  v-if="loading"  
                  class=" absolute flex items-center justify-center w-full h-full z-40 bg-white/80 dark:bg-gray-900/80 rounded-lg"
                >
                    <div role="status" class="absolute -translate-x-1/2 -translate-y-1/2 top-2/4 left-1/2">
                        <svg aria-hidden="true" class="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600" viewBox="0 0 100 101" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor"/><path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="currentFill"/></svg>
                        <span class="sr-only">{{ $t('Loading...') }}</span>
                    </div>
                </div>

                <div v-if="loadingTimer" class="absolute pt-12 flex items-center justify-center w-full h-full z-40 bg-white/80 dark:bg-gray-900/80 rounded-lg">
                  <div class="text-gray-800 dark:text-gray-100 text-lg font-semibold" 
                    v-if="!historicalAverage"
                  >
                   {{ formatTime(loadingTimer) }} {{ $t('passed...') }} 
                  </div>
                  <div class="w-64" v-else>
                    <ProgressBar
                      class="absolute max-w-full"
                      :currentValue="loadingTimer < historicalAverage ? loadingTimer : historicalAverage"
                      :minValue="0"
                      :maxValue="historicalAverage"
                      :showValues="false"
                      :progressFormatter="(value: number, percentage: number) => `${ formatTime(loadingTimer) } ( ~ ${ Math.floor( (
                        loadingTimer < historicalAverage ? loadingTimer : historicalAverage
                      ) / historicalAverage * 100) }% )`"
                    />
                  </div>
                </div>

                <div v-if="errorMessage" class="absolute flex items-center justify-center w-full h-full z-40 bg-white/80 dark:bg-gray-900/80 rounded-lg">
                  <div class="pt-20 text-red-500 dark:text-red-400 text-lg font-semibold">
                    {{ errorMessage }}
                  </div>
                </div>

                
                <div id="gallery" class="relative w-full" data-carousel="static">
                  <!-- Carousel wrapper -->
                  <div class="relative h-56 overflow-hidden rounded-lg md:h-[calc(100vh-400px)]">
                      <!-- Item 1 -->
                      <div v-for="(img, index) in images" :key="index" class="hidden duration-700 ease-in-out" data-carousel-item>
                          <img :src="img" class="absolute block max-w-full max-h-full -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 object-cover" 
                            :alt="`Generated image ${index + 1}`"
                          />
                      </div>
                      
                      <div v-if="images.length === 0" class="flex items-center justify-center w-full h-full">
                        
                        <button @click="generateImages" type="button" class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 
                          focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center 
                          dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 ms-2">{{ $t('Generate images') }}</button>

                      </div>
                     
                  </div>
                  <!-- Slider controls -->
                  <button type="button" class="absolute top-0 start-0 z-30 flex items-center justify-center h-full px-4 cursor-pointer group focus:outline-none"
                    @click="slide(-1)"
                    :disabled="images.length === 0"
                  >
                      <span class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/30 dark:bg-gray-800/30 group-hover:bg-white/50 dark:group-hover:bg-gray-800/60 group-focus:ring-4 group-focus:ring-white dark:group-focus:ring-gray-800/70 group-focus:outline-none ">
                          <svg class="w-4 h-4 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10"
                            :class="{
                              'text-gray-800 dark:text-gray-200': images.length > 0,
                              'text-gray-200 dark:text-gray-800': images.length === 0
                             }"
                            >
                              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 1 1 5l4 4"/>
                          </svg>
                          <span class="sr-only">{{ $t('Previous') }}</span>
                      </span>
                  </button>
                  <button type="button" class="absolute top-0 end-0 z-30 flex items-center justify-center h-full px-4 cursor-pointer group focus:outline-none " 
                    :disabled="images.length === 0"
                    @click="slide(1)"
                  >
                      <span class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/30 dark:bg-gray-800/30 group-hover:bg-white/50 dark:group-hover:bg-gray-800/60 group-focus:ring-4 group-focus:ring-white dark:group-focus:ring-gray-800/70 group-focus:outline-none ">
                          <svg class="w-4 h-4 rtl:rotate-180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10"
                            :class="{
                              'text-gray-800 dark:text-gray-200': images.length > 0,
                              'text-gray-200 dark:text-gray-800': images.length === 0
                             }"
                          >
                              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 9 4-4-4-4"/>
                          </svg>
                          <span class="sr-only">{{ $t('Next') }}</span>
                      </span>
                  </button>

                  
                </div>
              </div>
            </div>
            <!-- Modal footer -->
            <div class="flex items-center p-4 md:p-5 border-t border-gray-200 rounded-b dark:border-gray-600">
                <button type="button" @click="confirmImage"
                  :disabled="loading || images.length === 0"
                  class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center 
                  dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 
                  disabled:opacity-50 disabled:cursor-not-allowed"
                >{{ $t('Use image') }}</button>
                <button type="button" class="py-2.5 px-5 ms-3 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700"
                  @click="() => {stopGeneration = true; emit('close')}"
                >{{ $t('Cancel') }}</button>
            </div>
        </div>
    </div>
  </div>

  
  

</template>

<script setup lang="ts">

import { ref, onMounted, nextTick, Ref, h, computed, watch, reactive } from 'vue'
import { Carousel } from 'flowbite';
import { callAdminForthApi } from '@/utils';
import { useI18n } from 'vue-i18n';
import adminforth from '@/adminforth';
import { ProgressBar } from '@/afcl';
import * as Handlebars from 'handlebars';
import { IconCloseOutline } from '@iconify-prerendered/vue-flowbite';
import { Tooltip } from '@/afcl'
import { useRoute } from 'vue-router';

const { t: $t, t } = useI18n();
const route = useRoute();


const prompt = ref('');
const emit = defineEmits(['close', 'uploadImage']);
const props = defineProps({
  meta: Object,
  record: Object,
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
      if (jobStatus === 'failed') {
        error = jobResponse?.job?.error || $t('Image generation job failed');
      }
      if (jobStatus === 'timeout') {
        error = jobResponse?.job?.error || $t('Image generation job timeout');
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

import mediumZoom from 'medium-zoom'

const zoomedImage = ref(null)
const zoomedImg = ref(null)

function zoomImage(img) {
  zoomedImage.value = img
}

function closeZoom() {
  zoomedImage.value = null
}

watch(zoomedImage, async (val) => {
  await nextTick()
  if (val && zoomedImg.value) {
    mediumZoom(zoomedImg.value, {
      margin: 24,
      background: 'rgba(0, 0, 0, 0.9)',
      scrollOffset: 150
    }).show()
  }
})

async function handleAddFile(event) {
  const files = event.target.files;
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
    requestAttachmentFiles.value!.push(file);
    const fileUrl = await uploadFile(file);
    requestAttachmentFilesUrls.value.push(fileUrl);
  }
  fileInput.value!.value = '';
}

function removeFileFromList(index: number) {
  requestAttachmentFiles.value!.splice(index, 1);
  requestAttachmentFilesUrls.value.splice(index, 1);
}

const uploaded = ref(false);
const progress = ref(0);

async function uploadFile(file: any): Promise<string> {
  const { name, size, type } = file;
  let imgPreview = '';

  const extension = name.split('.').pop();
  const nameNoExtension = name.replace(`.${extension}`, '');

  try {
    // supports preview
    if (type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imgPreview = e.target.result as string;
      }
      reader.readAsDataURL(file);
    }
    
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

    if (success) {
      imgPreview = previewUrl;    
    } else {
      throw new Error('File upload failed');
    }
  } catch (err) {
    console.error('File upload failed', err);
  }
  return imgPreview;
}
</script>
