
import { PluginOptions } from './types.js';
import { AdminForthPlugin, AdminForthResourceColumn, AdminForthResource, Filters, IAdminForth, IHttpServer, suggestIfTypo } from "adminforth";
import { Readable } from "stream";
import { RateLimiter } from "adminforth";
import { randomUUID } from "crypto";
import { interpretResource } from 'adminforth';
import { ActionCheckSource } from 'adminforth'; 

const ADMINFORTH_NOT_YET_USED_TAG = 'adminforth-candidate-for-cleanup';
const jobs = new Map();
export default class UploadPlugin extends AdminForthPlugin {
  options: PluginOptions;

  adminforth!: IAdminForth;

  totalCalls: number;
  totalDuration: number;

  resourceConfig: AdminForthResource;

  rateLimiter: RateLimiter;

  getFileDownloadUrl: ((path: string) => Promise<string>); 

  getFileUploadUrl: ( originalFilename, contentType, size, originalExtension, recordPk ) => Promise<{ uploadUrl: string, tagline?: string, filePath?: string, uploadExtraParams?: Record<string, string>, previewUrl?: string, error?: string } | {error: string}>;

  constructor(options: PluginOptions) {
    super(options, import.meta.url);
    this.options = options;

    // for calcualting average time
    this.totalCalls = 0;
    this.totalDuration = 0;
    this.getFileDownloadUrl = async (path: string, expiresInSeconds: number = 1800) : Promise<string> => {
      if (!path) {
        return '';
      }
      return this.options.storageAdapter.getDownloadUrl(path, expiresInSeconds);
    }

    this.getFileUploadUrl = async ( originalFilename, contentType, size, originalExtension, recordPk ) : Promise<{ uploadUrl: string, tagline?: string, filePath?: string, uploadExtraParams?: Record<string, string>, previewUrl?: string, error?: string } | {error: string}> => {

        if (this.options.allowedFileExtensions && !this.options.allowedFileExtensions.includes(originalExtension.toLowerCase())) {
          return {
            error: `File extension "${originalExtension}" is not allowed, allowed extensions are: ${this.options.allowedFileExtensions.join(', ')}`
          };
        }

        let record = undefined;
        if (recordPk) {
          // get record by recordPk
          const pkName = this.resourceConfig.columns.find((column: any) => column.primaryKey)?.name;
          record = await this.adminforth.resource(this.resourceConfig.resourceId).get(
            [Filters.EQ(pkName, recordPk)]
          )
        }

        const filePath: string = this.options.filePath({ originalFilename, originalExtension, contentType, record });
        if (filePath.startsWith('/')) {
          throw new Error('s3Path should not start with /, please adjust s3path function to not return / at the start of the path');
        }
        const { uploadUrl, uploadExtraParams } = await this.options.storageAdapter.getUploadSignedUrl(filePath, contentType, 1800);
        let previewUrl;
        if (this.options.preview?.previewUrl) {
          previewUrl = this.options.preview.previewUrl({ filePath });
        } else {
          previewUrl = await this.options.storageAdapter.getDownloadUrl(filePath, 1800);
        }
        const tagline = `${ADMINFORTH_NOT_YET_USED_TAG}=true`;
        
        return {
          uploadUrl,
          tagline,
          filePath,
          uploadExtraParams,
          previewUrl,
        };
    };

    if (this.options.generation?.rateLimit?.limit) {
      this.rateLimiter = new RateLimiter(this.options.generation.rateLimit?.limit)
    }
  }

  private normalizePaths(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    return [String(value)];
  }

  private async callStorageAdapter(primaryMethod: string, fallbackMethod: string, filePath: string) {
    const adapter: any = this.options.storageAdapter as any;
    const fn = adapter?.[primaryMethod] ?? adapter?.[fallbackMethod];
    if (typeof fn !== 'function') {
      throw new Error(`Storage adapter is missing method "${primaryMethod}" (fallback "${fallbackMethod}")`);
    }
    await fn.call(adapter, filePath);
  }

  private markKeyForNotDeletion(filePath: string) {
    return this.callStorageAdapter('markKeyForNotDeletion', 'markKeyForNotDeletation', filePath);
  }

  private markKeyForDeletion(filePath: string) {
    return this.callStorageAdapter('markKeyForDeletion', 'markKeyForDeletation', filePath);
  }

  private async generateImages(jobId: string, prompt: string, recordId: any, adminUser: any, headers: any) {
    if (this.options.generation.rateLimit?.limit) {
      // rate limit
      // const { error } = RateLimiter.checkRateLimit(
      //   this.pluginInstanceId, 
      //   this.options.generation.rateLimit?.limit,
      //   this.adminforth.auth.getClientIp(headers),
      // );
      if (!await this.rateLimiter.consume(`${this.pluginInstanceId}-${this.adminforth.auth.getClientIp(headers)}`)) {
        jobs.set(jobId, { status: "failed", error: this.options.generation.rateLimit.errorMessage });
        return { error: this.options.generation.rateLimit.errorMessage };
      }
    }
    let attachmentFiles = [];
    if (this.options.generation.attachFiles) {
      // TODO - does it require additional allowed action to check this record id has access to get the image?
      // or should we mention in docs that user should do validation in method itself
      const record = await this.adminforth.resource(this.resourceConfig.resourceId).get(
        [Filters.EQ(this.resourceConfig.columns.find(c => c.primaryKey)?.name, recordId)]
      );


      if (!record) {
        return { error: `Record with id ${recordId} not found` };
      }
      
      attachmentFiles = await this.options.generation.attachFiles({ record, adminUser });
      // if files is not array, make it array
      if (!Array.isArray(attachmentFiles)) {
        attachmentFiles = [attachmentFiles];
      }

    }
    
    let error: string | undefined = undefined;

    const STUB_MODE = false;

    const images = await Promise.all(
      (new Array(this.options.generation.countToGenerate)).fill(0).map(async () => {
        if (STUB_MODE) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return `https://picsum.photos/200/300?random=${Math.floor(Math.random() * 1000)}`;
        }
        const start = +new Date();
        let resp;
        try {
          resp = await this.options.generation.adapter.generate(
            {
              prompt,
              inputFiles: attachmentFiles,
              n: 1,
              size: this.options.generation.outputSize,
            }
          )
        } catch (e: any) {
          error = `No response from image generation provider: ${e.message}. Please check your prompt or try again later.`;
          return;
        }

        if (resp.error) {
          console.error('Error generating image', resp.error);
          error = resp.error;
          return;
        }

        this.totalCalls++;
        this.totalDuration += (+new Date() - start) / 1000;
        
        return resp.imageURLs[0]

      })
    );
    jobs.set(jobId, { status: "completed", images, error });
    return { ok: true };
  };

  instanceUniqueRepresentation(pluginOptions: any) : string {
    return `${pluginOptions.pathColumnName}`;
  }

  async setupLifecycleRule() {
    const adapterUserUniqueRepresentation = `${this.resourceConfig.resourceId}-${this.pluginInstanceId}`;
    this.options.storageAdapter.setupLifecycle(adapterUserUniqueRepresentation);
  }

  async genPreviewUrl(record: any) {
    const value = record?.[this.options.pathColumnName];
    const paths = this.normalizePaths(value);
    if (!paths.length) return;

    const makeUrl = async (filePath: string) => {
      if (this.options.preview?.previewUrl) {
        return this.options.preview.previewUrl({ filePath });
      }
      return await this.options.storageAdapter.getDownloadUrl(filePath, 1800);
    };

    const urls = await Promise.all(paths.map(makeUrl));
    record[`previewUrl_${this.pluginInstanceId}`] = Array.isArray(value) ? urls : urls[0];
  }

  async modifyResourceConfig(adminforth: IAdminForth, resourceConfig: AdminForthResource) {
    super.modifyResourceConfig(adminforth, resourceConfig);
    this.resourceConfig = resourceConfig;
    // after column to store the path of the uploaded file, add new VirtualColumn,
    // show only in edit and create views
    // use component uploader.vue
    const { pathColumnName } = this.options;
    const pathColumnIndex = resourceConfig.columns.findIndex((column: any) => column.name === pathColumnName);
    if (pathColumnIndex === -1) {
      throw new Error(`Column with name "${pathColumnName}" not found in resource "${resourceConfig.label}"`);
    }

    if (this.options.generation?.fieldsForContext) {
      this.options.generation?.fieldsForContext.forEach((field: string) => {
        if (!resourceConfig.columns.find((column: any) => column.name === field)) {
          const similar = suggestIfTypo(resourceConfig.columns.map((column: any) => column.name), field);
          throw new Error(`Field "${field}" specified in fieldsForContext not found in
 resource "${resourceConfig.label}". ${similar ? `Did you mean "${similar}"?` : ''}`);
        }
      });
    }

    const pluginFrontendOptions = {
      allowedExtensions: this.options.allowedFileExtensions,
      maxFileSize: this.options.maxFileSize,
      pluginInstanceId: this.pluginInstanceId,
      resourceLabel: resourceConfig.label,
      generateImages: this.options.generation ? true : false,
      pathColumnLabel: resourceConfig.columns[pathColumnIndex].label,
      maxWidth: this.options.preview?.maxWidth,
      maxListWidth: this.options.preview?.maxListWidth,
      maxShowWidth: this.options.preview?.maxShowWidth,
      minWidth: this.options.preview?.minWidth,
      minListWidth: this.options.preview?.minListWidth,
      minShowWidth: this.options.preview?.minShowWidth,
      generationPrompt: this.options.generation?.generationPrompt,
      recorPkFieldName: this.resourceConfig.columns.find((column: any) => column.primaryKey)?.name,
      pathColumnName: this.options.pathColumnName,
    };
    // define components which will be imported from other components
    this.componentPath('imageGenerator.vue');

    if (!resourceConfig.columns[pathColumnIndex].components) {
      resourceConfig.columns[pathColumnIndex].components = {};
    }
    const pathColumn = resourceConfig.columns[pathColumnIndex];
    
    // add preview column to list
    if (this.options.preview?.usePreviewComponents !== false) {
      resourceConfig.columns[pathColumnIndex].components.list = {
        file: this.componentPath('preview.vue'),
        meta: pluginFrontendOptions,
      };

      resourceConfig.columns[pathColumnIndex].components.show = {
        file: this.componentPath('preview.vue'),
        meta: pluginFrontendOptions,
      };
    }

    resourceConfig.columns[pathColumnIndex].components.create = {
      file: this.componentPath('uploader.vue'),
      meta: pluginFrontendOptions,
    }

    resourceConfig.columns[pathColumnIndex].components.edit = {
      file: this.componentPath('uploader.vue'),
      meta: pluginFrontendOptions,
    }

    // ** HOOKS FOR CREATE **//


    // in afterSave hook, aremove tag adminforth-not-yet-used from the file
    resourceConfig.hooks.create.afterSave.push(async ({ record }: { record: any }) => {
      process.env.HEAVY_DEBUG && console.log('💾💾  after save ', record?.id);
      
      const paths = this.normalizePaths(record?.[pathColumnName]);
      await Promise.all(paths.map(async (p) => {
        process.env.HEAVY_DEBUG && console.log('🪥🪥 remove ObjectTagging', p);
        // let it crash if it fails: this is a new file which just was uploaded.
        await this.markKeyForNotDeletion(p);
      }));
      return { ok: true };
    });

    // ** HOOKS FOR SHOW **//


    // add show hook to get presigned URL
    if (pathColumn.showIn.show) {

      resourceConfig.hooks.show.afterDatasourceResponse.push(async ({ response }: { response: any }) => {
        const record = response[0];
        if (!record) {
          return { ok: true };
        }
        if (record[pathColumnName]) {
          await this.genPreviewUrl(record)
        }
        return { ok: true };
      });
    }

    // ** HOOKS FOR LIST **//


    if (pathColumn.showIn.list) {
      resourceConfig.hooks.list.afterDatasourceResponse.push(async ({ response }: { response: any }) => {
       await Promise.all(response.map(async (record: any) => {
          if (record[this.options.pathColumnName]) {
            await this.genPreviewUrl(record)
          }
        }));
        return { ok: true };
      })
    }

    // ** HOOKS FOR DELETE **//

    // add delete hook which sets tag adminforth-candidate-for-cleanup to true
    resourceConfig.hooks.delete.afterSave.push(async ({ record }: { record: any }) => {
      const paths = this.normalizePaths(record?.[pathColumnName]);
      await Promise.all(paths.map(async (p) => {
        try {
          await this.markKeyForDeletion(p);
        } catch (e) {
          // file might be e.g. already deleted, so we catch error
          console.error(`Error setting tag ${ADMINFORTH_NOT_YET_USED_TAG} to true for object ${p}. File will not be auto-cleaned up`, e);
        }
      }));
      return { ok: true };
    });


    // ** HOOKS FOR EDIT **//



    // add edit postSave hook to delete old file and remove tag from new file
    resourceConfig.hooks.edit.afterSave.push(async ({ updates, oldRecord }: { updates: any, oldRecord: any }) => {

      if (updates[pathColumnName] || updates[pathColumnName] === null) {
        const oldValue = oldRecord?.[pathColumnName];
        const newValue = updates?.[pathColumnName];

        const oldPaths = this.normalizePaths(oldValue);
        const newPaths = newValue === null ? [] : this.normalizePaths(newValue);

        const oldSet = new Set(oldPaths);
        const newSet = new Set(newPaths);

        const toDelete = oldPaths.filter((p) => !newSet.has(p));
        const toKeep = newPaths.filter((p) => !oldSet.has(p));

        await Promise.all(toDelete.map(async (p) => {
          // put tag to delete old file
          try {
            await this.markKeyForDeletion(p);
          } catch (e) {
            // file might be e.g. already deleted, so we catch error
            console.error(`Error setting tag ${ADMINFORTH_NOT_YET_USED_TAG} to true for object ${p}. File will not be auto-cleaned up`, e);
          }
        }));

        await Promise.all(toKeep.map(async (p) => {
          // remove tag from new file
          // in this case we let it crash if it fails: this is a new file which just was uploaded.
          await this.markKeyForNotDeletion(p);
        }));
      }
      return { ok: true };
    });

    
  }

  validateConfigAfterDiscover(adminforth: IAdminForth, resourceConfig: any) {
    this.adminforth = adminforth;
    // called here because modifyResourceConfig can be called in build time where there is no environment and AWS secrets
    this.setupLifecycleRule();
  }
  

  setupEndpoints(server: IHttpServer) {
    server.endpoint({
      method: 'GET',
      path: `/plugin/${this.pluginInstanceId}/averageDuration`,
      handler: async () => {
        return {
          totalCalls: this.totalCalls,
          totalDuration: this.totalDuration,
          averageDuration: this.totalCalls ? this.totalDuration / this.totalCalls : null,
        };
      }
    });

    server.endpoint({
      method: 'POST',
      path: `/plugin/${this.pluginInstanceId}/get_file_upload_url`,
      handler: async ({ body }) => {
        const { originalFilename, contentType, size, originalExtension, recordPk } = body;

        return this.getFileUploadUrl( originalFilename, contentType, size, originalExtension, recordPk );
        
      }
    });

    // generation: {
    //   provider: 'openai-dall-e',
    //   countToGenerate: 3,
    //   openAiOptions: {
    //     model: 'dall-e-3',
    //     size: '1792x1024',
    //     apiKey: process.env.OPENAI_API_KEY as string,
    //   },
    // },

  //   curl https://api.openai.com/v1/images/generations \
  // -H "Content-Type: application/json" \
  // -H "Authorization: Bearer $OPENAI_API_KEY" \
  // -d '{
  //   "model": "dall-e-3",
  //   "prompt": "A cute baby sea otter",
  //   "n": 1,
  //   "size": "1024x1024"
  // }'

    server.endpoint({
      method: 'POST',
      path: `/plugin/${this.pluginInstanceId}/create-image-generation-job`,
      handler: async ({ body, adminUser, headers }) => {
        const { prompt, recordId } = body;

        const jobId = randomUUID();
        jobs.set(jobId, { status: "in_progress" });

        this.generateImages(jobId, prompt, recordId, adminUser, headers);
        setTimeout(() => jobs.delete(jobId), 1_800_000);
        setTimeout(() => {jobs.set(jobId, { status: "timeout" });}, 300_000);

        return { ok: true, jobId };
      }
    });

    server.endpoint({
      method: 'POST',
      path: `/plugin/${this.pluginInstanceId}/get-image-generation-job-status`,
      handler: async ({ body, adminUser, headers }) => {
        const jobId = body.jobId;
        if (!jobId) {
          return { error: "Can't find job id" };
        }
        const job = jobs.get(jobId);
        if (!job) {
          return { error: "Job not found" };
        }
        return { ok: true, job };
      }
    });

    server.endpoint({
      method: 'GET',
      path: `/plugin/${this.pluginInstanceId}/cors-proxy`,
      handler: async ({ query, response  }) => {
        const { url } = query;
        const resp = await fetch(url);
        response.setHeader('Content-Type', resp.headers.get('Content-Type'));
        //@ts-ignore
        Readable.fromWeb( resp.body ).pipe( response.blobStream() );
        return null
      }
    });
    
    server.endpoint({
      method: 'POST',
      path: `/plugin/${this.pluginInstanceId}/get_attachment_files`,
      handler: async ({ body, adminUser }) => {
        const { recordId } = body;
    
        if (!recordId) return { error: 'Missing recordId' };
    
        const record = await this.adminforth.resource(this.resourceConfig.resourceId).get([
          Filters.EQ(this.resourceConfig.columns.find((col: any) => col.primaryKey)?.name, recordId),
        ]);
    
        if (!record) return { error: 'Record not found' };
    
        if (!this.options.generation.attachFiles) return { files: [] };
    
        const files = await this.options.generation.attachFiles({ record, adminUser });
    
        return {
          files: Array.isArray(files) ? files : [files],
        };
      },
    });

    server.endpoint({
      method: 'POST',
      path: `/plugin/${this.pluginInstanceId}/get-file-download-url`,
      handler: async ({ body, adminUser }) => {
        const { filePath } = body;
        if (!filePath) {
          return { error: 'Missing filePath' };
        }
        const allowedActions = await interpretResource( adminUser, this.resourceConfig, '', ActionCheckSource.CustomActionRequest, this.adminforth  )
        if (allowedActions.allowedActions.create === true || allowedActions.allowedActions.edit === true) {
          const url = await this.options.storageAdapter.getDownloadUrl(filePath, 1800);
    
          return {
            url,
          };
        }
        return { error: 'You do not have permission to download this file' };
      },
    });

  }
  

}