
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
                  @click="emit('close')"
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
                <img
                  v-for="(img, idx) in attachmentFiles"
                  :key="idx"
                  :src="img"
                  class="w-20 h-20 object-cover rounded cursor-pointer border hover:border-blue-500 transition"
                  :alt="`Generated image ${idx + 1}`"
                  @click="zoomImage(img)"
                />
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
                  @click="emit('close')"
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

const { t: $t } = useI18n();

const prompt = ref('');
const emit = defineEmits(['close', 'uploadImage']);
const props = defineProps(['meta', 'record']);
const images = ref([]);
const loading = ref(false);
const attachmentFiles = ref<string[]>([])

function minifyField(field: string): string {
  if (field.length > 100) {
    return field.slice(0, 100) + '...';
  }
  return field;
}

const caurosel = ref(null);
onMounted(async () => {
  // Initialize carousel
  const context = {
    field: props.meta.pathColumnLabel,
    resource: props.meta.resourceLabel,
  }; 
  let template = '';
  if (props.meta.generationPrompt) {
    template = props.meta.generationPrompt;
  } else {
    template = 'Generate image for field {{field}} in {{resource}}. No text should be on image.';
  }
  // iterate over all variables in template and replace them with their values from props.record[field]. 
  // if field is not present in props.record[field] then replace it with empty string and drop warning
  const regex = /{{(.*?)}}/g;
  const matches = template.match(regex);
  if (matches) {
    matches.forEach((match) => {
      const field = match.replace(/{{|}}/g, '').trim();
      if (field in context) {
        return;
      } else if (field in props.record) {
        context[field] = minifyField(props.record[field]);
      } else {
        adminforth.alert({
          message: $t('Field {{field}} defined in template but not found in record', { field }),
          variant: 'warning',
          timeout: 15,
        });
      } 
    });
  }

  prompt.value = template.replace(regex, (_, field) => {
    return context[field.trim()] || '';
  });
  
  const recordId = props.record[props.meta.recorPkFieldName];
  if (!recordId) return;

  try {
    const resp = await callAdminForthApi({
      path: `/plugin/${props.meta.pluginInstanceId}/get_attachment_files`,
      method: 'POST',
      body: { recordId },
    });

    if (resp?.files?.length) {
      attachmentFiles.value = resp.files;
      console.log('attachmentFiles', attachmentFiles.value);
    }
  } catch (err) {
    console.error('Failed to fetch attachment files', err);
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
      path: `/plugin/${props.meta.pluginInstanceId}/generate_images`,
      method: 'POST',
      body: {
        prompt: prompt.value,
        recordId: props.record[props.meta.recorPkFieldName]
      },
    });
  } catch (e) {
    console.error(e);
  } finally {
    clearInterval(ticker);
    loadingTimer.value = null;
    loading.value = false;
  }
  if (resp?.error) {
    error = resp.error;
  }
  if (!resp) {
    error = $t('Error generating images, something went wrong');
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

  images.value = [
    ...images.value,
    ...resp.images,
  ];

  // images.value = [
  //   'https://via.placeholder.com/600x400?text=Image+1',
  //   'https://via.placeholder.com/600x400?text=Image+2',
  // ];
  await nextTick();


  caurosel.value = new Carousel(
    document.getElementById('gallery'), 
    images.value.map((img, index) => {
      console.log('mapping image', img, index);
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
</script>
