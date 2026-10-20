export class Directory {
  uri: string;
  constructor(parent: any, name: string) {
    this.uri = `${typeof parent === 'string' ? parent : parent?.uri ?? ''}/${name}`;
  }
  create = jest.fn();
  exists = jest.fn().mockReturnValue(true);
  createFile = jest.fn((name: string) => new File(this, name));
  static pickDirectoryAsync = jest.fn().mockResolvedValue({
    createFile: jest.fn((name: string) => new File('/mock/saf', name)),
    uri: '/mock/saf',
  });
}

export class File {
  uri: string;
  constructor(parent: any, name: string) {
    this.uri = `${typeof parent === 'string' ? parent : parent?.uri ?? ''}/${name}`;
  }
  create = jest.fn();
  write = jest.fn();
  delete = jest.fn();
  text = jest.fn().mockResolvedValue('');
  bytes = jest.fn().mockResolvedValue(new Uint8Array());
  exists = jest.fn().mockReturnValue(true);
  static pickFileAsync = jest.fn().mockResolvedValue({ canceled: true });
}

export const Paths = {
  cache: '/mock/cache',
  document: '/mock/document',
};

export const documentDirectory = '/mock/document/';
export const cacheDirectory = '/mock/cache/';
export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
};
export const readAsStringAsync = jest.fn().mockResolvedValue('');
export const writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
export const deleteAsync = jest.fn().mockResolvedValue(undefined);
export const getInfoAsync = jest.fn().mockResolvedValue({ exists: true, size: 100 });
