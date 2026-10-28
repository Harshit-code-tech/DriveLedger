export enum SaveFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
}

export enum FlipType {
  Vertical = 'vertical',
  Horizontal = 'horizontal',
}

export const ImageManipulator = {
  manipulate: jest.fn((source: string, options?: any) => ({
    resize: jest.fn().mockReturnThis(),
    rotate: jest.fn().mockReturnThis(),
    flip: jest.fn().mockReturnThis(),
    crop: jest.fn().mockReturnThis(),
    reset: jest.fn().mockReturnThis(),
    renderAsync: jest.fn().mockResolvedValue({
      width: 1920,
      height: 1080,
      saveAsync: jest.fn().mockResolvedValue({
        uri: `/mock/cache/manipulated_${Date.now()}.jpg`,
        width: 1920,
        height: 1080,
      }),
    }),
  })),
};

export const manipulateAsync = jest.fn().mockResolvedValue({
  uri: `/mock/cache/manipulated_${Date.now()}.jpg`,
  width: 1920,
  height: 1080,
});

export const useImageManipulator = jest.fn();
