import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The main goal of these tests: flows existing apps rely on keep working after the upload
// URL got bound to the file size.

const adminforthMock = vi.hoisted(() => {
  class AdminForthPlugin {
    adminforth: any;
    pluginInstanceId = 'test-plugin';

    constructor(public pluginOptions: any, _metaUrl: string) {}

    modifyResourceConfig(adminforth: any, resourceConfig: any) {
      this.adminforth = adminforth;
    }

    componentPath(file: string) {
      return `component:${file}`;
    }
  }

  const Filters = {
    EQ: (field: string, value: any) => ({ field, operator: 'eq', value }),
  };

  return {
    AdminForthPlugin,
    Filters,
    AllowedActionsEnum: { create: 'create', edit: 'edit' },
    ActionCheckSource: { CreateRequest: 'create', EditRequest: 'edit', CustomActionRequest: 'custom' },
    interpretResource: vi.fn(),
    suggestIfTypo: () => null,
    RateLimiter: class {},
  };
});

vi.mock('adminforth', () => adminforthMock);

const UploadPlugin = (await import('../index.js')).default;

function createStorageAdapter() {
  return {
    getUploadSignedUrl: vi.fn(async (key: string) => ({ uploadUrl: `https://storage/${key}?signed`, uploadExtraParams: {} })),
    getDownloadUrl: vi.fn(async (key: string) => `https://storage/${key}?download`),
    markKeyForDeletion: vi.fn(async () => {}),
    markKeyForNotDeletion: vi.fn(async () => {}),
    setupLifecycle: vi.fn(async () => {}),
  };
}

const ADMIN_USER = { pk: 'user-1', username: 'admin', dbUser: {} };

function setup({ isArray = false, records = [] as any[], allowed = { create: true, edit: true } } = {}) {
  const storageAdapter = createStorageAdapter();
  // the hooks get records from core, the tests only keep them in memory
  const resource = { records };
  const resourceConfig: any = {
    resourceId: 'photos',
    label: 'Photos',
    columns: [
      { name: 'id', primaryKey: true },
      { name: 'path', label: 'Path', showIn: { show: true, list: true }, ...(isArray && { isArray: { enabled: true } }) },
    ],
    hooks: {
      create: { afterSave: [] },
      edit: { afterSave: [] },
      delete: { afterSave: [] },
      show: { afterDatasourceResponse: [] },
      list: { afterDatasourceResponse: [] },
    },
  };
  const adminforth: any = { resource: () => resource };
  const plugin: any = new UploadPlugin({
    pathColumnName: 'path',
    storageAdapter,
    allowedFileExtensions: ['png', 'jpg'],
    maxFileSize: 1000,
    filePath: ({ originalFilename, originalExtension }: any) => `photos/${originalFilename}.${originalExtension}`,
  } as any);
  plugin.modifyResourceConfig(adminforth, resourceConfig);
  plugin.validateConfigAfterDiscover(adminforth, resourceConfig);

  const endpoints: Record<string, any> = {};
  plugin.setupEndpoints({ endpoint: (definition: any) => { endpoints[definition.path] = definition.handler; } });
  const callEndpoint = (name: string, body: any) => {
    const response = { setStatus: vi.fn() };
    return endpoints[`/plugin/test-plugin/${name}`]({ body, adminUser: ADMIN_USER, response });
  };

  adminforthMock.interpretResource.mockResolvedValue({ allowedActions: allowed });

  // after save hooks run on the stored state, like in core: the record is already updated or deleted
  const editRecord = async (id: string, updates: any) => {
    const record = resource.records.find((r) => r.id === id);
    const oldRecord = { ...record };
    Object.assign(record, updates);
    for (const hook of resourceConfig.hooks.edit.afterSave) {
      await hook({ updates, oldRecord });
    }
  };
  const deleteRecord = async (id: string) => {
    const record = resource.records.find((r) => r.id === id);
    resource.records = resource.records.filter((r) => r.id !== id);
    for (const hook of resourceConfig.hooks.delete.afterSave) {
      await hook({ record });
    }
  };
  const createRecord = async (record: any) => {
    resource.records.push(record);
    for (const hook of resourceConfig.hooks.create.afterSave) {
      await hook({ record });
    }
  };

  return { plugin, storageAdapter, resource, callEndpoint, editRecord, deleteRecord, createRecord };
}

beforeEach(() => {
  adminforthMock.interpretResource.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('get_file_upload_url', () => {
  it('returns an upload URL for an allowed file, signed for its size and safe content type', async () => {
    const { callEndpoint, storageAdapter } = setup();

    const result = await callEndpoint('get_file_upload_url', {
      originalFilename: 'cat', originalExtension: 'png', contentType: 'image/png', size: 500,
    });

    expect(result).toMatchObject({ uploadUrl: 'https://storage/photos/cat.png?signed', contentType: 'image/png', filePath: 'photos/cat.png' });
    expect(storageAdapter.getUploadSignedUrl).toHaveBeenCalledWith('photos/cat.png', 'image/png', 1800, 500);
  });

  it('takes the content type from the extension, not from the client', async () => {
    const { callEndpoint, storageAdapter } = setup();

    const result = await callEndpoint('get_file_upload_url', {
      originalFilename: 'cat', originalExtension: 'png', contentType: 'text/html', size: 500,
    });

    expect(result.contentType).toBe('image/png');
    expect(storageAdapter.getUploadSignedUrl).toHaveBeenCalledWith('photos/cat.png', 'image/png', 1800, 500);
  });

  it('keeps rejecting not allowed extensions and too big files', async () => {
    const { callEndpoint, storageAdapter } = setup();

    expect(await callEndpoint('get_file_upload_url', {
      originalFilename: 'page', originalExtension: 'html', contentType: 'text/html', size: 10,
    })).toEqual({ error: expect.stringContaining('File extension "html" is not allowed') });
    expect(await callEndpoint('get_file_upload_url', {
      originalFilename: 'cat', originalExtension: 'png', contentType: 'image/png', size: 1001,
    })).toEqual({ error: expect.stringContaining('File size 1001 is too large') });
    expect(storageAdapter.getUploadSignedUrl).not.toHaveBeenCalled();
  });
});

describe('server-side callers', () => {
  it('getFileUploadUrl without size (e.g. oauth avatars) is not limited, as before', async () => {
    const { plugin, storageAdapter } = setup();

    const result = await plugin.getFileUploadUrl('avatar', 'image/png', null, 'png', null);

    expect(result.error).toBeUndefined();
    expect(storageAdapter.getUploadSignedUrl).toHaveBeenCalledWith('photos/avatar.png', 'image/png', 1800, undefined);
  });

  it('getUploadUrl without size keeps working without the size in the URL', async () => {
    const { plugin, storageAdapter } = setup();

    await plugin.getUploadUrl({ filename: 'cat.png', contentType: 'image/png' });

    expect(storageAdapter.getUploadSignedUrl).toHaveBeenCalledWith('photos/cat.png', 'image/png', 1800, undefined);
  });

  it('uploadFromBufferToNewRecord signs the exact buffer size', async () => {
    const { plugin, storageAdapter } = setup();
    plugin.adminforth.createResourceRecord = vi.fn(async ({ record }: any) => ({ createdRecord: { id: 'new', ...record } }));
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await plugin.uploadFromBufferToNewRecord({ filename: 'cat.png', contentType: 'image/png', buffer: Buffer.alloc(300), adminUser: ADMIN_USER });

    expect(storageAdapter.getUploadSignedUrl).toHaveBeenCalledWith('photos/cat.png', 'image/png', 1800, 300);
    expect(fetchMock).toHaveBeenCalledWith('https://storage/photos/cat.png?signed', expect.objectContaining({ method: 'PUT' }));
  });
});

describe('cleanup marks', () => {
  it('a saved file is kept, as before', async () => {
    const { createRecord, storageAdapter } = setup();

    await createRecord({ id: '1', path: 'photos/new.png' });

    expect(storageAdapter.markKeyForNotDeletion).toHaveBeenCalledWith('photos/new.png');
  });

  it('replacing a file marks the old one for deletion and keeps the new one, as before', async () => {
    const { editRecord, storageAdapter } = setup({ records: [{ id: '1', path: 'photos/old.png' }] });

    await editRecord('1', { path: 'photos/new.png' });

    expect(storageAdapter.markKeyForDeletion).toHaveBeenCalledWith('photos/old.png');
    expect(storageAdapter.markKeyForNotDeletion).toHaveBeenCalledWith('photos/new.png');
  });

  it('clearing a file marks it for deletion, as before', async () => {
    const { editRecord, storageAdapter } = setup({ records: [{ id: '1', path: 'photos/old.png' }] });

    await editRecord('1', { path: null });

    expect(storageAdapter.markKeyForDeletion).toHaveBeenCalledWith('photos/old.png');
  });

  it('deleting a record marks its file for deletion, as before', async () => {
    const { deleteRecord, storageAdapter } = setup({ records: [{ id: '1', path: 'photos/old.png' }] });

    await deleteRecord('1');

    expect(storageAdapter.markKeyForDeletion).toHaveBeenCalledWith('photos/old.png');
  });

  it('editing other fields does not touch the file of an existing record', async () => {
    const { editRecord, storageAdapter } = setup({ records: [{ id: '1', path: 'photos/old.png', title: 'a' }] });

    await editRecord('1', { title: 'b' });

    expect(storageAdapter.markKeyForDeletion).not.toHaveBeenCalled();
    expect(storageAdapter.markKeyForNotDeletion).not.toHaveBeenCalled();
  });

  it('array column: only the removed file is marked, the kept ones are not', async () => {
    const { editRecord, storageAdapter } = setup({ isArray: true, records: [{ id: '1', path: ['photos/a.png', 'photos/b.png'] }] });

    await editRecord('1', { path: ['photos/a.png', 'photos/c.png'] });

    expect(storageAdapter.markKeyForDeletion).toHaveBeenCalledTimes(1);
    expect(storageAdapter.markKeyForDeletion).toHaveBeenCalledWith('photos/b.png');
    expect(storageAdapter.markKeyForNotDeletion).toHaveBeenCalledWith('photos/c.png');
  });

});

describe('get-file-download-url', () => {
  it('signs a file of an existing record (edit preview, clone of a record)', async () => {
    const { callEndpoint } = setup({ records: [{ id: '1', path: 'photos/old.png' }] });

    expect(await callEndpoint('get-file-download-url', { filePath: 'photos/old.png' }))
      .toEqual({ url: 'https://storage/photos/old.png?download' });
  });

  it('still requires create or edit permission', async () => {
    const { callEndpoint } = setup({ records: [{ id: '1', path: 'photos/old.png' }], allowed: { create: false, edit: false } });

    expect(await callEndpoint('get-file-download-url', { filePath: 'photos/old.png' }))
      .toEqual({ error: 'You do not have permission to download this file' });
  });
});
