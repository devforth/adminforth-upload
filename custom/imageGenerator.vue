<template>
  <Dialog
    ref="dialogRef"
    class="af-image-generator w-11/12 max-w-5xl"
    :header="$t('Generate image with AI')"
    :buttons="dialogButtons"
    :closeByClickOutside="false"
    :closeByEsc="!zoomedImage"
    :beforeCancelFunction="close"
  >
    <div class="space-y-4">
      <Textarea
        v-model="prompt"
        rows="3"
        class="resize-none"
        :placeholder="$t('Prompt which will be passed to AI network')"
        :title="$t('Prompt which will be passed to AI network')"
      />

      <!-- Thumbnails -->
      <div class="flex flex-wrap gap-2">
        <div class="group relative" v-for="(img, key) in requestAttachmentFilesUrls" :key="key">
          <img
            :src="img"
            class="w-14 h-14 object-cover rounded-default cursor-zoom-in border border-lightFormBorder hover:border-lightPrimary dark:border-darkFormBorder dark:hover:border-darkPrimary transition-colors"
            :alt="`Attachment ${key + 1}`"
            @click="zoomImage(img)"
          />
          <button
            type="button"
            class="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 absolute -top-2 -end-2 flex items-center justify-center w-5 h-5 rounded-full border-2 border-lightDialogBackgorund bg-lightButtonsBackground text-lightButtonsText dark:border-darkDialogBackgorund dark:bg-darkButtonsBackground dark:text-darkButtonsText transition-opacity"
            :aria-label="$t('Remove file')"
            :title="$t('Remove file')"
            @click="removeFileFromList(key)"
          >
            <IconX class="w-3 h-3" />
          </button>
        </div>
        <input ref="fileInput" class="hidden" type="file" @change="handleAddFile" accept="image/*" />
        <button
          v-if="!uploading"
          type="button"
          :disabled="requestAttachmentFilesUrls.length >= 1"
          class="flex flex-col items-center justify-center gap-1 w-14 h-14 rounded-default border border-dashed border-lightDropzoneBorder bg-lightDropzoneBackground text-lightDropzoneIcon hover:border-lightDropzoneBorderHover hover:bg-lightDropzoneBackgroundHover dark:border-darkDropzoneBorder dark:bg-darkDropzoneBackground dark:text-darkDropzoneIcon dark:hover:border-darkDropzoneBorderHover dark:hover:bg-darkDropzoneBackgroundHover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          :aria-label="$t('Add image')"
          @click="fileInput?.click()"
        >
          <IconPlus class="w-4 h-4" />
          <span class="font-mono text-[10px] leading-none">Ctrl+V</span>
        </button>
        <Skeleton v-else type="image" class="w-14 h-14" />
      </div>

      <div class="grid grid-cols-[1fr_32px_1fr] sm:grid-cols-[1fr_52px_1fr]">
        <span class="pb-2 text-xs sm:text-sm font-medium text-lightInputIconColor dark:text-darkInputIconColor">{{ $t('Original image') }}</span>
        <div></div>
        <span class="pb-2 text-xs sm:text-sm font-medium text-lightInputIconColor dark:text-darkInputIconColor">{{ $t('Generated image') }}</span>

        <div
          class="aspect-[4/3] flex items-center justify-center overflow-hidden rounded-lg border border-lightFormBorder bg-lightFormHeading dark:border-darkFormBorder dark:bg-darkFormHeading"
          :class="requestAttachmentFilesUrls.length ? 'cursor-zoom-in' : ''"
          @click="requestAttachmentFilesUrls.length && zoomImage(requestAttachmentFilesUrls[0])"
        >
          <img
            v-if="requestAttachmentFilesUrls.length"
            :src="requestAttachmentFilesUrls[0]"
            class="w-full h-full object-cover"
          />
          <span v-else class="px-2 text-center text-xs sm:text-sm text-lightInputPlaceholderText dark:text-darkInputPlaceholderText">{{ $t('No image') }}</span>
        </div>

        <div class="flex items-center justify-center">
          <IconArrowRight class="w-5 h-5 text-lightInputIconColor dark:text-darkInputIconColor" aria-hidden="true" />
        </div>

        <div class="relative aspect-[4/3] overflow-hidden rounded-lg">
          <img
            v-if="images.length"
            :src="images[activeIndex]"
            class="w-full h-full object-cover cursor-zoom-in"
            :alt="`Generated image ${activeIndex + 1}`"
            @click="zoomImage(images[activeIndex])"
          />
          <div v-else class="w-full h-full flex items-center justify-center rounded-lg border border-dashed border-lightDropzoneBorder bg-lightDropzoneBackground dark:border-darkDropzoneBorder dark:bg-darkDropzoneBackground">
            <span v-if="!loading" class="px-2 text-center text-xs sm:text-sm text-lightInputPlaceholderText dark:text-darkInputPlaceholderText">{{ $t('Your generated image will appear here') }}</span>
          </div>

          <div
            v-if="loading"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-lightDialogBackgorund/80 backdrop-blur-sm dark:bg-darkDialogBackgorund/80"
          >
            <Spinner class="w-8 h-8" />
            <template v-if="loadingTimer !== null">
              <span v-if="!historicalAverage" class="text-sm font-medium text-lightDialogHeaderText dark:text-darkDialogHeaderText">
                {{ formatTime(loadingTimer) }} {{ $t('passed...') }}
              </span>
              <div v-else class="w-48 max-w-full">
                <ProgressBar
                  :currentValue="loadingTimer < historicalAverage ? loadingTimer : historicalAverage"
                  :minValue="0"
                  :maxValue="historicalAverage"
                  :showValues="false"
                  :progressFormatter="(_value: number, _percentage: number) => `${ formatTime(loadingTimer) } ( ~ ${ Math.floor( (loadingTimer < historicalAverage ? loadingTimer : historicalAverage) / historicalAverage * 100) }% )`"
                />
              </div>
            </template>
          </div>

          <div v-if="errorMessage" class="absolute inset-0 flex items-center justify-center bg-lightDialogBackgorund/80 dark:bg-darkDialogBackgorund/80">
            <p class="px-4 text-center text-sm font-medium text-lightDanger dark:text-darkDanger">{{ errorMessage }}</p>
          </div>
        </div>

        <div class="col-start-3 flex items-center justify-center gap-2 pt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconOnly
            :disabled="images.length === 0 || activeIndex === 0"
            :aria-label="$t('Previous')"
            @click="slide(-1)"
          >
            <IconChevronLeft />
          </Button>
          <span v-if="images.length" class="min-w-10 text-center text-xs tabular-nums text-lightInputIconColor dark:text-darkInputIconColor">
            {{ activeIndex + 1 }} / {{ images.length }}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconOnly
            :disabled="loading || images.length === 0"
            :aria-label="$t('Next')"
            @click="slide(1)"
          >
            <IconChevronRight />
          </Button>
        </div>
      </div>
    </div>
  </Dialog>

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
      type="button"
      class="absolute top-4 right-4 flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
      :aria-label="$t('Close')"
    >
      <IconX class="w-4 h-4" />
    </button>
  </div>

</template>

<script setup lang="ts">

import { ref, computed, onMounted, Ref, onUnmounted } from 'vue'
import { callAdminForthApi } from '@/utils';
import { useI18n } from 'vue-i18n';
import adminforth from '@/adminforth';
import { Button, Dialog, ProgressBar, Skeleton, Spinner, Textarea } from '@/afcl';
import { IconArrowRight, IconChevronLeft, IconChevronRight, IconPlus, IconX } from '@iconify-prerendered/vue-lucide';
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
const requestAttachmentFilesUrls = ref<string[]>([]);
const stopGeneration = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const dialogRef = ref(null);
const activeIndex = ref(0);

const dialogButtons = computed(() => [
  {
    label: t('Cancel'),
    options: { variant: 'secondary' },
    onclick: (dialog) => dialog.hide(true),
  },
  {
    label: t('Generate images'),
    // generating is the main action until there is an image to use
    options: { variant: images.value.length ? 'secondary' : 'primary', disabled: loading.value, loader: loading.value },
    onclick: () => generateImages(),
  },
  {
    label: t('Use image'),
    options: { variant: images.value.length ? 'primary' : 'secondary', disabled: loading.value || images.value.length === 0 },
    onclick: () => confirmImage(),
  },
]);

function close() {
  stopGeneration.value = true;
  emit('close');
}

onMounted(async () => {
  dialogRef.value.open();
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
});


async function slide(direction: number) {
  // next on the last image generates a new one
  if (direction === 1 && activeIndex.value === images.value.length - 1) {
    await generateImages();
  }
  activeIndex.value = Math.min(Math.max(activeIndex.value + direction, 0), images.value.length - 1);
}

async function confirmImage() {
  loading.value = true;

  const img = images.value[activeIndex.value];
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
    loadingTimer.value = (Date.now() - start) / 1000;
  }, 100);

  try {
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
      return;
    }

    images.value = [
      ...images.value,
      ...(jobResponse?.job?.images || []),
    ];
  } finally {
    clearInterval(ticker);
    loadingTimer.value = null;
    loading.value = false;
  }
}

const zoomedImage = ref(null)

function zoomImage(img) {
  zoomedImage.value = img
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
    const file = files[i];
    const fileUrl = await uploadFile(file);
    if (!fileUrl) continue;
    requestAttachmentFilesUrls.value.push(fileUrl);
  }
  fileInput.value!.value = '';
}

function removeFileFromList(index: number) {
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
    const { uploadUrl, uploadExtraParams, filePath, error, previewUrl, contentType: uploadContentType } = await callAdminForthApi({
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
      xhr.setRequestHeader('Content-Type', uploadContentType || type);
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
