import { AdminUser, ImageGenerationAdapter, StorageAdapter } from "adminforth";

export type PluginOptions = {

  /**
   * The name of the column where the path to the uploaded file is stored.
   * On place of this column, a file upload field will be shown.
   */
  pathColumnName: string;

  /**
   * the list of allowed file extensions
   */
  allowedFileExtensions?: string[]; // allowed file extensions

  /**
   * the maximum file size in bytes
   */
  maxFileSize?: number;

  /**
   * The path where the file will be uploaded to the S3 bucket, same path will be stored in the database
   * in the column specified in {@link pathColumnName}
   * 
   * example:
   * 
   * ```typescript
   * s3Path: ({originalFilename}) => `/aparts/${originalFilename}`
   * ```
   * 
   */
  filePath: ({originalFilename, originalExtension, contentType, record }: {
    originalFilename: string,
    originalExtension: string,
    contentType: string,
    record?: any,
  }) => string,


  preview?: {

    /**
     * Whether to use preview components provided by the plugin. BY default true
     */
    usePreviewComponents?: boolean,

    /**
     * Maximum width of the preview image
     */
    maxWidth?: string,

    /**
     * Maximum width of the preview image in list view
     */
    maxListWidth?: string,

    /**
     * Maximum width of the preview image in show view
     */
    maxShowWidth?: string,
    

    /**
     * Minimum width of the preview image
     */
    minWidth?: string,

    /**
     * Minimum width of the preview image in list view
     */
    minListWidth?: string,

    /**
     * Minimum width of the preview image in show view
     */
    minShowWidth?: string,

    /**
     * Used to display preview (if it is image) in list and show views.
     * Defaulted to the AWS S3 presigned URL if resource is private or public URL if resource is public.
     * Can be used to generate custom e.g. CDN(e.g. Cloudflare) URL to worm up cache and deliver preview faster.
     * 
     * Example:
     * 
     * ```typescript
     * previewUrl: ({record, path}) => `https://my-bucket.s3.amazonaws.com/${path}`,
     * ```
     * 
     */ 
    previewUrl?: ({filePath}) => string,
  }


  /**
   * AI image generation options
   */
  generation?: {
    adapter: ImageGenerationAdapter,

    /**
     * The size of the generated image.
     */
    outputSize?: string,

    /**
     * Fields for conetext which will be used to generate the image.
     * If specified, the plugin will use fields from the record to provide additional context to the AI model.
     */
    fieldsForContext?: string[],

    /**
     * The number of images to generate
     * in one request
     */
    countToGenerate: number,

    /**
     * Prompt which will be suggested to user during image generation. You can use record fields with mustache brackets:
     * E.g. 'Generate a photo of car {{ model }} from {{ brand }} in {{ color }} color of {{ year }} year'. For now plugin get's these fields from open create/edit form
     * so they should be present in the form.
     * 
     * Reserved variables:
     * - {{field}} - label of resource
     * - {{resource}} - label of resource
     */
    generationPrompt?: string,

    /**
     * If you want to use some image as reference for generation, you can use this function to get the path to the image.
     */
    attachFiles?: ({ record, adminUser }: {
      record: any,
      adminUser: AdminUser,
    }) => string[],

    
    /**
     * Since AI generation can be expensive, we can limit the number of requests per IP.
     */
    rateLimit?: {

      /**
       * E.g. 5/1d - 5 requests per day
       * 3/1h - 3 requests per hour
       */ 
      limit: string,

      /**
       * !Not used now
       * Message shown to user when rate limit is reached
       */
      errorMessage: string,
    },

    
  }

  /**
   * The adapter used to store the files.
   * For now only S3 adapter is supported.
   */
    
  storageAdapter: StorageAdapter,
}